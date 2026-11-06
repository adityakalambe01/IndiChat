import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9223;
const PREVIEW_URL = `file://${path.resolve('preview/preview-liquid-glass.html')}`;
const PREVIEW_OUT = path.resolve('release/preview_captures');
const IOS_OUT = path.resolve('release/ios/verification');
const ANDROID_OUT = path.resolve('release/android/verification');
const COMPARISON_OUT = path.resolve('release/settings_comparison');
const IOS_UDID = '7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52';

fs.mkdirSync(PREVIEW_OUT, { recursive: true });
fs.mkdirSync(IOS_OUT, { recursive: true });
fs.mkdirSync(ANDROID_OUT, { recursive: true });
fs.mkdirSync(COMPARISON_OUT, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------
// 1. Capture Preview Settings Top & Bottom via Chrome CDP
// ---------------------------------------------------------------------
async function capturePreviewSettings() {
  console.log('[Preview] Launching headless Chrome for CDP capture...');
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1600,1200',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {
      await sleep(200);
    }
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Failed to connect to Chrome CDP');
  }

  const newTabRes = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PREVIEW_URL)}`,
    { method: 'PUT' }
  );
  const tabData = await newTabRes.json();
  const ws = new WebSocket(tabData.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));

  function send(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await sleep(1500);

  console.log('[Preview] Navigating to settings...');
  await send('Runtime.evaluate', { expression: `navigateTo('settings');` });
  await sleep(500);

  // Get bounding box of inner content of #phoneDevice (excluding 8px outer border)
  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.getElementById('phoneDevice');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      // Outer border is 8px solid #1c2227; inner content box is inset by 8px
      return { x: rect.x + 8, y: rect.y + 8, width: rect.width - 16, height: rect.height - 16 };
    })()`,
    returnByValue: true,
  });

  const rect = evalRes.result?.value;
  if (!rect) {
    chromeProc.kill();
    throw new Error('Could not find #phoneDevice');
  }

  // Capture Top (Dark Obsidian)
  const shotTop = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
  });
  const topPath = path.join(PREVIEW_OUT, 'preview_settings_top.png');
  fs.writeFileSync(topPath, Buffer.from(shotTop.data, 'base64'));
  console.log(`[Preview] Saved top: ${topPath}`);

  // Scroll .phone-body to bottom and capture
  console.log('[Preview] Scrolling .phone-body to bottom...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const body = document.querySelector('.phone-body');
      if (body) {
        body.scrollTop = body.scrollHeight;
      }
    })()`,
  });
  await sleep(400);

  const shotBottom = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
  });
  const bottomPath = path.join(PREVIEW_OUT, 'preview_settings_bottom.png');
  fs.writeFileSync(bottomPath, Buffer.from(shotBottom.data, 'base64'));
  console.log(`[Preview] Saved bottom: ${bottomPath}`);

  // Switch to Daylight (Light Mode) and capture Top
  console.log('[Preview] Switching to Daylight (Light) mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      userSettings.appearanceMode = 'light';
      applyMaterialPreferences();
      render();
      const body = document.querySelector('.phone-body');
      if (body) body.scrollTop = 0;
    })()`,
  });
  await sleep(600);

  const shotLight = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
  });
  const lightPath = path.join(PREVIEW_OUT, 'preview_settings_light.png');
  fs.writeFileSync(lightPath, Buffer.from(shotLight.data, 'base64'));
  console.log(`[Preview] Saved light: ${lightPath}`);

  // Switch back to Dark Obsidian
  await send('Runtime.evaluate', {
    expression: `(() => {
      userSettings.appearanceMode = 'dark';
      applyMaterialPreferences();
      render();
    })()`,
  });

  ws.close();
  chromeProc.kill();
}

// ---------------------------------------------------------------------
// 2. Capture iOS Native Settings Top, Bottom & Light Mode
// ---------------------------------------------------------------------
async function captureIOSSettings() {
  console.log('[iOS] Setting appearance dark...');
  execSync(`xcrun simctl ui ${IOS_UDID} appearance dark`, { stdio: 'ignore' });
  execSync(`xcrun simctl launch ${IOS_UDID} com.indichat.app`, { stdio: 'ignore' });
  await sleep(1000);
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://chats"`, { stdio: 'ignore' });
  await sleep(600);
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://settings?theme=dark&scroll=top"`, { stdio: 'ignore' });
  await sleep(1500);

  const topPath = path.join(IOS_OUT, 'settings_top.png');
  const tempPath = path.join(IOS_OUT, 'temp_ios.png');
  execSync(`xcrun simctl io ${IOS_UDID} screenshot "${tempPath}"`, { stdio: 'ignore' });
  fs.copyFileSync(tempPath, topPath);
  console.log(`[iOS] Saved top: ${topPath}`);

  console.log('[iOS] Navigating to Settings Bottom...');
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://settings?theme=dark&scroll=bottom"`, { stdio: 'ignore' });
  await sleep(1500);

  const bottomPath = path.join(IOS_OUT, 'settings_bottom.png');
  execSync(`xcrun simctl io ${IOS_UDID} screenshot "${tempPath}"`, { stdio: 'ignore' });
  fs.copyFileSync(tempPath, bottomPath);
  console.log(`[iOS] Saved bottom: ${bottomPath}`);

  console.log('[iOS] Setting appearance light (Daylight mode)...');
  execSync(`xcrun simctl ui ${IOS_UDID} appearance light`, { stdio: 'ignore' });
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://chats"`, { stdio: 'ignore' });
  await sleep(600);
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://settings?theme=light&scroll=top"`, { stdio: 'ignore' });
  await sleep(1500);

  const lightPath = path.join(IOS_OUT, 'settings_light.png');
  execSync(`xcrun simctl io ${IOS_UDID} screenshot "${tempPath}"`, { stdio: 'ignore' });
  fs.copyFileSync(tempPath, lightPath);
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  console.log(`[iOS] Saved light: ${lightPath}`);

  // Restore dark appearance
  execSync(`xcrun simctl ui ${IOS_UDID} appearance dark`, { stdio: 'ignore' });
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://chats"`, { stdio: 'ignore' });
  await sleep(400);
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://settings?theme=dark&scroll=top"`, { stdio: 'ignore' });
}

// ---------------------------------------------------------------------
// 3. Capture Android Native Settings Top, Bottom & Light Mode
// ---------------------------------------------------------------------
async function captureAndroidSettings() {
  console.log('[Android] Setting night mode yes...');
  execSync('adb shell "cmd uimode night yes"', { stdio: 'ignore' });
  execSync('adb shell "am start -n com.indichat.app/.MainActivity"', { stdio: 'ignore' });
  await sleep(2500);

  console.log('[Android] Navigating to Settings Top (Dark Obsidian)...');
  execSync('adb shell "am start -W -a android.intent.action.VIEW -d \'indichat://settings?theme=dark&scroll=top\'"', { stdio: 'ignore' });
  await sleep(1200);
  execSync('adb shell input tap 972 2280', { stdio: 'ignore' });
  await sleep(1000);
  execSync('adb shell input swipe 540 600 540 2000 300', { stdio: 'ignore' });
  await sleep(600);
  execSync('adb shell input swipe 540 600 540 2000 300', { stdio: 'ignore' });
  await sleep(1000);

  const topPath = path.join(ANDROID_OUT, 'settings_top.png');
  execSync(`adb exec-out screencap -p > "${topPath}"`);
  console.log(`[Android] Saved top: ${topPath}`);

  console.log('[Android] Scrolling to Settings Bottom...');
  execSync('adb shell input swipe 540 1800 540 600 300', { stdio: 'ignore' });
  await sleep(600);
  execSync('adb shell input swipe 540 1800 540 600 300', { stdio: 'ignore' });
  await sleep(600);
  execSync('adb shell input swipe 540 1800 540 600 300', { stdio: 'ignore' });
  await sleep(1000);

  const bottomPath = path.join(ANDROID_OUT, 'settings_bottom.png');
  execSync(`adb exec-out screencap -p > "${bottomPath}"`);
  console.log(`[Android] Saved bottom: ${bottomPath}`);

  console.log('[Android] Setting night mode no (Daylight mode)...');
  execSync('adb shell "cmd uimode night no"', { stdio: 'ignore' });
  await sleep(1500);
  execSync('adb shell "am start -W -a android.intent.action.VIEW -d \'indichat://settings?theme=light&scroll=top\'"', { stdio: 'ignore' });
  await sleep(1200);
  execSync('adb shell input tap 972 2280', { stdio: 'ignore' });
  await sleep(1000);
  execSync('adb shell input swipe 540 600 540 2000 300', { stdio: 'ignore' });
  await sleep(600);
  execSync('adb shell input swipe 540 600 540 2000 300', { stdio: 'ignore' });
  await sleep(1000);

  const lightPath = path.join(ANDROID_OUT, 'settings_light.png');
  execSync(`adb exec-out screencap -p > "${lightPath}"`);
  console.log(`[Android] Saved light: ${lightPath}`);

  // Restore night mode yes and dark theme
  execSync('adb shell "cmd uimode night yes"', { stdio: 'ignore' });
  await sleep(800);
  execSync('adb shell "am start -W -a android.intent.action.VIEW -d \'indichat://settings?theme=dark&scroll=top\'"', { stdio: 'ignore' });
  await sleep(1000);
  execSync('adb shell input tap 972 2280', { stdio: 'ignore' });
}

// ---------------------------------------------------------------------
// 4. Generate Side-by-Side Comparison HTML and Composite PNGs
// ---------------------------------------------------------------------
async function generateSideBySide(mode = 'top') {
  let previewImg, iosImg, androidImg, title;
  if (mode === 'top') {
    previewImg = path.join(PREVIEW_OUT, 'preview_settings_top.png');
    iosImg = path.join(IOS_OUT, 'settings_top.png');
    androidImg = path.join(ANDROID_OUT, 'settings_top.png');
    title = 'IndiChat "You" / Settings Home Parity — Top (Header & Bento Cards)';
  } else if (mode === 'bottom') {
    previewImg = path.join(PREVIEW_OUT, 'preview_settings_bottom.png');
    iosImg = path.join(IOS_OUT, 'settings_bottom.png');
    androidImg = path.join(ANDROID_OUT, 'settings_bottom.png');
    title = 'IndiChat "You" / Settings Home Parity — Bottom (Scroll Clearance & Dock)';
  } else if (mode === 'light') {
    previewImg = path.join(PREVIEW_OUT, 'preview_settings_light.png');
    iosImg = path.join(IOS_OUT, 'settings_light.png');
    androidImg = path.join(ANDROID_OUT, 'settings_light.png');
    title = 'IndiChat "You" / Settings Home Parity — Daylight Theme (Light Mode)';
  }

  const pB64 = fs.readFileSync(previewImg).toString('base64');
  const iB64 = fs.readFileSync(iosImg).toString('base64');
  const aB64 = fs.readFileSync(androidImg).toString('base64');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #070b0e;
      color: #e9edef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 30px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #10b981;
      letter-spacing: -0.4px;
    }
    p.subtitle {
      font-size: 13px;
      color: #8696a0;
      margin-bottom: 24px;
    }
    .comparison-grid {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      justify-content: center;
    }
    .col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .badge {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 6px 14px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.08);
      color: #d1d7db;
    }
    .badge.preview {
      background: rgba(16, 185, 129, 0.18);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge.ios {
      background: rgba(6, 182, 212, 0.18);
      color: #06b6d4;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }
    .badge.android {
      background: rgba(59, 130, 246, 0.18);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .img-wrap {
      width: 390px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
      background: #070b0e;
      display: flex;
      flex-direction: column;
    }
    .img-wrap img {
      width: 390px;
      height: auto;
      display: block;
    }
    .features-card {
      margin-top: 28px;
      max-width: 1218px;
      width: 100%;
      background: rgba(17, 27, 33, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      padding: 20px 24px;
      backdrop-filter: blur(20px);
    }
    .features-title {
      font-size: 14px;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      font-size: 12.5px;
      color: #aebac1;
      line-height: 1.5;
    }
    .features-grid strong {
      color: #ffffff;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="subtitle">Equi-Scale Side-by-Side Verification: Approved Liquid Glass Preview vs Native iOS Simulator vs Native Android Emulator</p>

  <div class="comparison-grid">
    <div class="col">
      <span class="badge preview">Approved Reference (Preview)</span>
      <div class="img-wrap">
        <img src="data:image/png;base64,${pB64}" alt="Liquid Glass Preview" />
      </div>
    </div>

    <div class="col">
      <span class="badge ios">Native iOS (Simulator)</span>
      <div class="img-wrap">
        <img src="data:image/png;base64,${iB64}" alt="Native iOS" />
      </div>
    </div>

    <div class="col">
      <span class="badge android">Native Android (Emulator)</span>
      <div class="img-wrap">
        <img src="data:image/png;base64,${aB64}" alt="Native Android" />
      </div>
    </div>
  </div>

  <div class="features-card">
    <div class="features-title">Design System Parity Invariants</div>
    <div class="features-grid">
      <div>
        <strong>Floating Bottom Dock:</strong><br>
        5 core destinations (Updates, Calls, Circles, Chats, You). Active You tab highlighted with emerald avatar capsule.
      </div>
      <div>
        <strong>Header & Profile Bento:</strong><br>
        19px bold "You" sticky header, interactive search action, 54x54 squircle avatar (18px radius), emerald bio text, chevron glyphs.
      </div>
      <div>
        <strong>Outlined Icons & Dual Badges:</strong><br>
        Emerald (16,185,129,0.12) & Cyan (6,182,212,0.12) outlined icon badges. Red destructive badge for Log Out. Full bottom clearance above dock.
      </div>
    </div>
  </div>
</body>
</html>`;

  const htmlPath = path.join(COMPARISON_OUT, `settings_${mode}_comparison.html`);
  fs.writeFileSync(htmlPath, html);

  // Snapshot via headless Chrome
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT + 1}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,1400',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT + 1}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {
      await sleep(200);
    }
  }

  if (versionData) {
    const fileUrl = `file://${htmlPath}`;
    const newTabRes = await fetch(
      `http://127.0.0.1:${PORT + 1}/json/new?${encodeURIComponent(fileUrl)}`,
      { method: 'PUT' }
    );
    const tabData = await newTabRes.json();
    const ws = new WebSocket(tabData.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    await new Promise((resolve) => (ws.onopen = resolve));

    function send(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await sleep(1000);

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const compositePath = path.join(COMPARISON_OUT, `settings_${mode}_side_by_side.png`);
    fs.writeFileSync(compositePath, Buffer.from(shot.data, 'base64'));
    console.log(`[Comparison] Saved composite side-by-side: ${compositePath}`);

    ws.close();
    chromeProc.kill();
  }
}

async function main() {
  console.log('====================================================');
  console.log('  IndiChat "You" / Settings Parity Verification Engine');
  console.log('====================================================');

  await capturePreviewSettings();
  await captureIOSSettings();
  await captureAndroidSettings();

  console.log('\nGenerating Side-by-Side Comparisons...');
  await generateSideBySide('top');
  await generateSideBySide('bottom');
  await generateSideBySide('light');

  console.log('\n====================================================');
  console.log('✔ All Settings comparisons generated successfully!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal comparison error:', err);
  process.exit(1);
});
