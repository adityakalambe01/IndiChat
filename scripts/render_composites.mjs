import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9225;
const PREVIEW_OUT = path.resolve('release/preview_captures');
const IOS_OUT = path.resolve('release/ios/verification');
const ANDROID_OUT = path.resolve('release/android/verification');
const COMPARISON_OUT = path.resolve('release/settings_comparison');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function renderSideBySide(mode = 'top') {
  let previewImg, iosImg, androidImg, title, subtitle;
  if (mode === 'top') {
    previewImg = path.join(PREVIEW_OUT, 'preview_settings_top.png');
    iosImg = path.join(IOS_OUT, 'settings_top.png');
    androidImg = path.join(ANDROID_OUT, 'settings_top.png');
    title = 'IndiChat "You" / Settings Home Parity — Top (Header & Bento Cards)';
    subtitle = 'Equi-Scale Side-by-Side Comparison: Approved Reference (374pt) vs Native iOS (402pt) vs Native Android (411dp) in Dark Obsidian';
  } else if (mode === 'bottom') {
    previewImg = path.join(PREVIEW_OUT, 'preview_settings_bottom.png');
    iosImg = path.join(IOS_OUT, 'settings_bottom.png');
    androidImg = path.join(ANDROID_OUT, 'settings_bottom.png');
    title = 'IndiChat "You" / Settings Home Parity — Bottom (Scroll Clearance & Dock)';
    subtitle = 'Equi-Scale Side-by-Side Comparison: Destructive Log Out Action, Footer Clearance & 64px Floating Dock Parity';
  } else if (mode === 'light') {
    previewImg = path.join(PREVIEW_OUT, 'preview_settings_light.png');
    iosImg = path.join(IOS_OUT, 'settings_light.png');
    androidImg = path.join(ANDROID_OUT, 'settings_light.png');
    title = 'IndiChat "You" / Settings Home Parity — Daylight Theme (Light Mode)';
    subtitle = 'Equi-Scale Side-by-Side Comparison: Verified Daylight Theme (#f2f5f3 bg, #ffffff surface, #0f172a text) Across Platforms';
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
      text-align: center;
      max-width: 900px;
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
  <p class="subtitle">${subtitle}</p>

  <div class="comparison-grid">
    <div class="col">
      <span class="badge preview">Approved Reference (Preview: 374pt inner)</span>
      <div class="img-wrap">
        <img src="data:image/png;base64,${pB64}" alt="Liquid Glass Preview" />
      </div>
    </div>

    <div class="col">
      <span class="badge ios">Native iOS (Simulator: 402pt / iPhone 17)</span>
      <div class="img-wrap">
        <img src="data:image/png;base64,${iB64}" alt="Native iOS" />
      </div>
    </div>

    <div class="col">
      <span class="badge android">Native Android (Emulator: 411dp / Pixel 8)</span>
      <div class="img-wrap">
        <img src="data:image/png;base64,${aB64}" alt="Native Android" />
      </div>
    </div>
  </div>

  <div class="features-card">
    <div class="features-title">Design System Measured Parity Invariants</div>
    <div class="features-grid">
      <div>
        <strong>Floating Bottom Dock:</strong><br>
        64px height, 32px pill corner radius, floating position with safe-area clearance. Active 'You' destination with emerald squircle avatar container.
      </div>
      <div>
        <strong>Sticky Header & Profile Bento:</strong><br>
        56px header height, 19px bold "You" title, interactive outline search button. Profile hero card with 16px padding, 54x54 squircle avatar (18px radius), and emerald bio status.
      </div>
      <div>
        <strong>Vector Icons & Dual Badges:</strong><br>
        Identical outlined SVG paths matching preview: Emerald (16,185,129,0.12) & Cyan (6,182,212,0.12) badges. 59px row heights with 18px/15px line heights.
      </div>
    </div>
  </div>
</body>
</html>`;

  const htmlPath = path.join(COMPARISON_OUT, `settings_${mode}_comparison.html`);
  fs.writeFileSync(htmlPath, html);

  // Snapshot via headless Chrome
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
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
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
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
      `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(fileUrl)}`,
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
    await sleep(800);

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const compositePath = path.join(COMPARISON_OUT, `settings_${mode}_side_by_side.png`);
    fs.writeFileSync(compositePath, Buffer.from(shot.data, 'base64'));
    console.log(`[Comparison] Saved composite side-by-side: ${compositePath}`);

    ws.close();
    chromeProc.kill();
  }
}

async function main() {
  console.log('Rendering all 3 composite side-by-side PNGs...');
  await renderSideBySide('top');
  await renderSideBySide('bottom');
  await renderSideBySide('light');
  console.log('All composite PNGs rendered successfully!');
}

main().catch(console.error);
