/**
 * scripts/render_all_composites.mjs
 * Renders HTML comparisons to standalone PNG composites via Chrome CDP
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9225;
const ANDROID_OUT = path.resolve('release/android/verification');
const COMPARISON_OUT = path.resolve('release/settings_comparison');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function renderHtmlToPng(htmlPath, outPngPath, viewportWidth = 1400) {
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    `--window-size=${viewportWidth},1200`,
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

  const url = `file://${path.resolve(htmlPath)}`;
  const newTabRes = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,
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

  const evalRect = await send('Runtime.evaluate', {
    expression: `(() => {
      const body = document.body;
      const html = document.documentElement;
      const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
      const width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
      return { width, height };
    })()`,
    returnByValue: true,
  });

  const { width, height } = evalRect.result.value;

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });

  fs.writeFileSync(outPngPath, Buffer.from(shot.data, 'base64'));
  console.log(`[Composite] Saved: ${outPngPath} (${width}x${height}px)`);

  ws.close();
  chromeProc.kill();
}

async function main() {
  console.log('Rendering composite comparison PNGs...\n');

  // 1. Android Blur Demonstration HTML
  const b0 = fs.readFileSync(path.join(ANDROID_OUT, 'android_blur_level_0.png')).toString('base64');
  const b40 = fs.readFileSync(path.join(ANDROID_OUT, 'android_blur_level_40.png')).toString('base64');
  const bSolid = fs.readFileSync(path.join(ANDROID_OUT, 'android_blur_reduced_transparency.png')).toString('base64');

  const blurHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IndiChat Android Native Blur Demonstration</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #070b0e; color: #e9edef;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", Roboto, sans-serif;
      padding: 30px; display: flex; flex-direction: column; align-items: center;
    }
    h1 { font-size: 24px; font-weight: 700; color: #10b981; margin-bottom: 6px; }
    p.subtitle { font-size: 13px; color: #8696a0; margin-bottom: 24px; }
    .grid { display: flex; gap: 24px; justify-content: center; align-items: flex-start; }
    .col { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .badge {
      font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
      padding: 6px 14px; border-radius: 12px;
    }
    .badge.b0 { background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge.b40 { background: rgba(16, 185, 129, 0.18); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge.solid { background: rgba(245, 158, 11, 0.18); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .viewport {
      width: 411.43px; border-radius: 16px; overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 16px 40px rgba(0,0,0,0.7);
      background: #0b1016;
    }
    .viewport img { width: 411.43px; height: auto; display: block; }
    .desc-card {
      margin-top: 24px; max-width: 1280px; width: 100%;
      background: rgba(17, 27, 33, 0.85); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px; padding: 18px 24px; font-size: 13px; color: #aebac1; line-height: 1.6;
    }
    .desc-card strong { color: #fff; }
  </style>
</head>
<body>
  <h1>Android Native Backdrop Blur Demonstration</h1>
  <p class="subtitle">Identical Scroll Position (scrollY=210) · Same Content Behind Surface Across All Three States</p>

  <div class="grid">
    <div class="col">
      <span class="badge b0">State 1: Blur Level 0 (0px / 0%)</span>
      <div class="viewport">
        <img src="data:image/png;base64,${b0}" alt="Blur Level 0" />
      </div>
    </div>
    <div class="col">
      <span class="badge b40">State 2: Blur Level 40 (100% Native Frosted Glass)</span>
      <div class="viewport">
        <img src="data:image/png;base64,${b40}" alt="Blur Level 40" />
      </div>
    </div>
    <div class="col">
      <span class="badge solid">State 3: Reduced Transparency (Solid Opaque Surface)</span>
      <div class="viewport">
        <img src="data:image/png;base64,${bSolid}" alt="Reduced Transparency Solid" />
      </div>
    </div>
  </div>

  <div class="desc-card">
    <strong>Technical Invariants & Verification Evidence:</strong><br>
    1. <strong>Identical Content Alignment</strong>: In all three captures, the scroll view is locked at scrollY=210 so the Profile Card ("Alice Cooper") and Quick Actions sit directly under the sticky page header.<br>
    2. <strong>Blur Level 0</strong>: Renders unblurred translucent glass. The avatar squircle and text behind the header remain crisply visible through the surfaceHeader background.<br>
    3. <strong>Blur Level 40</strong>: Renders full native backdrop blur via expo-blur with dimezisBlurViewSdk31Plus and BlurTargetView ref. Content behind the header is softly diffused and frosted.<br>
    4. <strong>Reduced Transparency</strong>: Renders a completely solid, high-contrast surface (palette.surface) with borderStrong, fully occluding background content for accessibility compliance.
  </div>
</body>
</html>`;

  const blurHtmlPath = path.join(ANDROID_OUT, 'android_blur_comparison.html');
  fs.writeFileSync(blurHtmlPath, blurHtml);
  console.log(`[HTML] Saved: ${blurHtmlPath}`);

  // Render PNGs
  await renderHtmlToPng(blurHtmlPath, path.join(ANDROID_OUT, 'android_blur_comparison.png'), 1400);
  await renderHtmlToPng(path.join(COMPARISON_OUT, 'ios_402pt_parity_comparison.html'), path.join(COMPARISON_OUT, 'ios_402pt_parity_composite.png'), 1000);
  await renderHtmlToPng(path.join(COMPARISON_OUT, 'android_411dp_parity_comparison.html'), path.join(COMPARISON_OUT, 'android_411dp_parity_composite.png'), 1000);

  console.log('\nAll composite comparison PNGs rendered successfully.');
}

main().catch(console.error);
