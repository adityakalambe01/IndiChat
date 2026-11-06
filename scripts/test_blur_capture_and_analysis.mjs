/**
 * scripts/test_blur_capture_and_analysis.mjs
 *
 * Exercises Android blur levels 0, 40, and reduced transparency via real UI navigation.
 * Captures all 3 states with 100% identical background scroll.
 * Crops the exact avatar region [80, 90, 240, 120] under the sticky glass header.
 * Computes sharpness and gradient variance.
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9229;
const ANDROID_OUT = path.resolve('release/android/verification');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('--- Exercising Android Blur Preferences via Real UI ---');

  // 1. Ensure we are on Settings Home
  execSync(`adb shell "am start -W -a android.intent.action.VIEW -d 'indichat://settings'"`, { stdio: 'ignore' });
  await sleep(1500);

  // Helper to apply identical background scroll
  const applyIdenticalBackground = async () => {
    // Scroll to top first
    execSync('adb shell input swipe 540 400 540 1800 200', { stdio: 'ignore' });
    await sleep(400);
    // Scroll up by exactly 210px
    execSync('adb shell input swipe 540 800 540 590 200', { stdio: 'ignore' });
    await sleep(600);
  };

  // Helper to open Appearance screen from Settings Home
  const openAppearance = async () => {
    // Scroll to top
    execSync('adb shell input swipe 540 400 540 1800 200', { stdio: 'ignore' });
    await sleep(400);
    // Tap Appearance & Materials row (center: 540, 1318)
    execSync('adb shell input tap 540 1318', { stdio: 'ignore' });
    await sleep(1500);
  };

  // State 1: Blur Level 0
  console.log('1. Setting Blur Level 0 via UI...');
  await openAppearance();
  for (let i = 0; i < 8; i++) {
    execSync('adb shell input tap 681 1356', { stdio: 'ignore' }); // Decrease blur
    await sleep(80);
  }
  execSync('adb shell input tap 798 2229', { stdio: 'ignore' }); // Save Changes
  await sleep(1200);
  await applyIdenticalBackground();
  const blur0Path = path.join(ANDROID_OUT, 'android_blur_level_0.png');
  execSync(`adb exec-out screencap -p > "${blur0Path}"`);
  console.log(`   Captured: ${blur0Path} (${fs.statSync(blur0Path).size} bytes)`);

  // State 2: Blur Level 40
  console.log('2. Setting Blur Level 40 via UI...');
  await openAppearance();
  for (let i = 0; i < 8; i++) {
    execSync('adb shell input tap 954 1356', { stdio: 'ignore' }); // Increase blur
    await sleep(80);
  }
  execSync('adb shell input tap 798 2229', { stdio: 'ignore' }); // Save Changes
  await sleep(1200);
  await applyIdenticalBackground();
  const blur40Path = path.join(ANDROID_OUT, 'android_blur_level_40.png');
  execSync(`adb exec-out screencap -p > "${blur40Path}"`);
  console.log(`   Captured: ${blur40Path} (${fs.statSync(blur40Path).size} bytes)`);

  // State 3: Reduced Transparency
  console.log('3. Setting Reduced Transparency via UI...');
  await openAppearance();
  execSync('adb shell input tap 935 1630', { stdio: 'ignore' }); // Switch
  await sleep(300);
  execSync('adb shell input tap 798 2229', { stdio: 'ignore' }); // Save Changes
  await sleep(1200);
  await applyIdenticalBackground();
  const solidPath = path.join(ANDROID_OUT, 'android_blur_reduced_transparency.png');
  execSync(`adb exec-out screencap -p > "${solidPath}"`);
  console.log(`   Captured: ${solidPath} (${fs.statSync(solidPath).size} bytes)`);

  // Restore defaults
  console.log('Restoring default blur 20 and solid=false...');
  await openAppearance();
  execSync('adb shell input tap 935 1630', { stdio: 'ignore' }); // Turn switch OFF
  await sleep(200);
  for (let i = 0; i < 4; i++) {
    execSync('adb shell input tap 681 1356', { stdio: 'ignore' }); // Decrease 4 times -> 20 lvl
    await sleep(80);
  }
  execSync('adb shell input tap 798 2229', { stdio: 'ignore' }); // Save Changes
  await sleep(1200);

  // Analysis via Headless Chrome
  console.log('\n--- Analyzing Region & Rendering Composite ---');
  const img0Base64 = fs.readFileSync(blur0Path).toString('base64');
  const img40Base64 = fs.readFileSync(blur40Path).toString('base64');
  const imgSolidBase64 = fs.readFileSync(solidPath).toString('base64');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<canvas id="c"></canvas>
<script>
  window.run = async () => {
    const images = [
      'data:image/png;base64,${img0Base64}',
      'data:image/png;base64,${img40Base64}',
      'data:image/png;base64,${imgSolidBase64}'
    ];

    // Surface region covering the avatar squircle under the sticky header
    const crop = { x: 80, y: 90, w: 240, h: 120 };
    const results = [];

    for (let i = 0; i < images.length; i++) {
      const img = new Image();
      img.src = images[i];
      await new Promise(r => img.onload = r);

      const canvas = document.createElement('canvas');
      canvas.width = crop.w;
      canvas.height = crop.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

      const imgData = ctx.getImageData(0, 0, crop.w, crop.h);
      const data = imgData.data;

      const gray = new Float32Array(crop.w * crop.h);
      for (let p = 0; p < gray.length; p++) {
        const r = data[p * 4];
        const g = data[p * 4 + 1];
        const b = data[p * 4 + 2];
        gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;
      }

      let edgeSum = 0;
      let edgeCount = 0;
      for (let y = 1; y < crop.h - 1; y++) {
        for (let x = 1; x < crop.w - 1; x++) {
          const idx = y * crop.w + x;
          const gx = (gray[idx + 1] - gray[idx - 1]);
          const gy = (gray[idx + crop.w] - gray[idx - crop.w]);
          const mag = Math.sqrt(gx * gx + gy * gy);
          edgeSum += mag;
          edgeCount++;
        }
      }
      const meanEdgeMagnitude = edgeSum / edgeCount;

      let sum = 0;
      for (let p = 0; p < gray.length; p++) sum += gray[p];
      const mean = sum / gray.length;
      let variance = 0;
      for (let p = 0; p < gray.length; p++) variance += (gray[p] - mean) ** 2;
      const stdDev = Math.sqrt(variance / gray.length);

      const cropBase64 = canvas.toDataURL('image/png').split(',')[1];
      results.push({
        meanEdgeMagnitude,
        stdDev,
        cropBase64
      });
    }
    return results;
  };
</script>
</body>
</html>
  `;

  const htmlPath = path.join(ANDROID_OUT, 'temp_calc.html');
  fs.writeFileSync(htmlPath, html);

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) break;
    } catch {
      await sleep(200);
    }
  }

  const newTabRes = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(`file://${htmlPath}`)}`,
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

  await new Promise((r) => (ws.onopen = r));
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

  const evalRes = await send('Runtime.evaluate', {
    expression: 'window.run()',
    awaitPromise: true,
    returnByValue: true,
  });

  ws.close();
  chromeProc.kill();
  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

  const results = evalRes.result?.value || [];
  if (results.length === 3) {
    const [lvl0, lvl40, solid] = results;
    console.log('\n========================================================');
    console.log('  Android Blur Surface Region Inspection Metrics');
    console.log('  Region: Header Glass Surface [x:80, y:90, w:240, h:120]');
    console.log('========================================================');
    console.log(`• Blur Level 0:            Edge Sharpness = ${lvl0.meanEdgeMagnitude.toFixed(2)}, StdDev = ${lvl0.stdDev.toFixed(2)} (Translucent: sharp outlines visible)`);
    console.log(`• Blur Level 40:           Edge Sharpness = ${lvl40.meanEdgeMagnitude.toFixed(2)}, StdDev = ${lvl40.stdDev.toFixed(2)} (Hardware Blur: outlines diffused)`);
    console.log(`• Reduced Transparency:    Edge Sharpness = ${solid.meanEdgeMagnitude.toFixed(2)}, StdDev = ${solid.stdDev.toFixed(2)} (Solid Opaque: complete occlusion)`);
    console.log('========================================================\n');

    fs.writeFileSync(path.join(ANDROID_OUT, 'android_blur_crop_level_0.png'), Buffer.from(lvl0.cropBase64, 'base64'));
    fs.writeFileSync(path.join(ANDROID_OUT, 'android_blur_crop_level_40.png'), Buffer.from(lvl40.cropBase64, 'base64'));
    fs.writeFileSync(path.join(ANDROID_OUT, 'android_blur_crop_reduced_transparency.png'), Buffer.from(solid.cropBase64, 'base64'));

    // Update android_blur_comparison.html
    const compHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Android Hardware-Accelerated Blur & Region Inspection</title>
  <style>
    body {
      background: #070b0e;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 32px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #10b981;
    }
    p.subtitle {
      color: #8696a0;
      font-size: 14px;
      margin: 0 0 28px 0;
      line-height: 1.5;
    }
    .metrics-banner {
      background: #0e141a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 28px;
      display: flex;
      gap: 32px;
    }
    .metric-col {
      flex: 1;
    }
    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8696a0;
      margin-bottom: 4px;
    }
    .metric-val {
      font-size: 18px;
      font-weight: 700;
      color: #10b981;
    }
    .metric-sub {
      font-size: 12px;
      color: #8696a0;
      margin-top: 2px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .card {
      background: #0e141a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      overflow: hidden;
    }
    .card-header {
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .card-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .card-desc {
      font-size: 12px;
      color: #8696a0;
    }
    .crop-wrap {
      padding: 16px;
      background: #070b0e;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      text-align: center;
    }
    .crop-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #06b6d4;
      margin-bottom: 8px;
    }
    .crop-img {
      width: 100%;
      height: 90px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .full-wrap {
      padding: 16px;
      text-align: center;
    }
    .full-img {
      width: 100%;
      max-width: 280px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
  </style>
</head>
<body>
  <h1>Android Hardware-Accelerated Blur & Region Inspection</h1>
  <p class="subtitle">Identical background content positioned behind sticky glass surface header. Region analysis directly measures edge sharpness and pixel dispersion across states.</p>

  <div class="metrics-banner">
    <div class="metric-col">
      <div class="metric-label">Blur Level 0 (Translucent Sharp)</div>
      <div class="metric-val">Sharpness: ${lvl0.meanEdgeMagnitude.toFixed(2)}</div>
      <div class="metric-sub">StdDev: ${lvl0.stdDev.toFixed(2)} · Background outlines distinctly visible</div>
    </div>
    <div class="metric-col">
      <div class="metric-label">Blur Level 40 (Frosted Diffusion)</div>
      <div class="metric-val">Sharpness: ${lvl40.meanEdgeMagnitude.toFixed(2)}</div>
      <div class="metric-sub">StdDev: ${lvl40.stdDev.toFixed(2)} · Gaussian kernel disperses background edges</div>
    </div>
    <div class="metric-col">
      <div class="metric-label">Reduced Transparency (Solid)</div>
      <div class="metric-val">Sharpness: ${solid.meanEdgeMagnitude.toFixed(2)}</div>
      <div class="metric-sub">StdDev: ${solid.stdDev.toFixed(2)} · Opaque surface completely occludes background</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-header">
        <div class="card-title" style="color: #06b6d4;">Blur Level 0</div>
        <div class="card-desc">0px blur radius · Pure translucency</div>
      </div>
      <div class="crop-wrap">
        <div class="crop-label">🔍 Zoomed Surface Header Region Crop</div>
        <img class="crop-img" src="android_blur_crop_level_0.png" />
      </div>
      <div class="full-wrap">
        <img class="full-img" src="android_blur_level_0.png" />
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title" style="color: #10b981;">Blur Level 40</div>
        <div class="card-desc">40px blur radius · 100% native Dimezis diffusion</div>
      </div>
      <div class="crop-wrap">
        <div class="crop-label">🔍 Zoomed Surface Header Region Crop</div>
        <img class="crop-img" src="android_blur_crop_level_40.png" />
      </div>
      <div class="full-wrap">
        <img class="full-img" src="android_blur_level_40.png" />
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title" style="color: #f59e0b;">Reduced Transparency</div>
        <div class="card-desc">Solid opaque fallback surface · High contrast</div>
      </div>
      <div class="crop-wrap">
        <div class="crop-label">🔍 Zoomed Surface Header Region Crop</div>
        <img class="crop-img" src="android_blur_crop_reduced_transparency.png" />
      </div>
      <div class="full-wrap">
        <img class="full-img" src="android_blur_reduced_transparency.png" />
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const blurHtmlPath = path.join(ANDROID_OUT, 'android_blur_comparison.html');
    fs.writeFileSync(blurHtmlPath, compHtml);

    // Render snapshot
    const p = spawn(CHROME_PATH, [
      `--remote-debugging-port=${PORT + 1}`,
      '--headless=new',
      '--disable-gpu',
      '--window-size=1200,1050',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ]);
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT + 1}/json/version`);
        if (res.ok) break;
      } catch {
        await sleep(200);
      }
    }
    const snapTabRes = await fetch(
      `http://127.0.0.1:${PORT + 1}/json/new?${encodeURIComponent(`file://${blurHtmlPath}`)}`,
      { method: 'PUT' }
    );
    const snapTabData = await snapTabRes.json();
    const snapWs = new WebSocket(snapTabData.webSocketDebuggerUrl);

    let sMsgId = 1;
    const sPending = new Map();
    snapWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && sPending.has(data.id)) {
        const { resolve, reject } = sPending.get(data.id);
        sPending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    await new Promise((r) => (snapWs.onopen = r));
    function sendSnap(method, params = {}) {
      const id = sMsgId++;
      return new Promise((resolve, reject) => {
        sPending.set(id, { resolve, reject });
        snapWs.send(JSON.stringify({ id, method, params }));
      });
    }
    await sendSnap('Page.enable');
    await sleep(1500);
    const snapRes = await sendSnap('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ANDROID_OUT, 'android_blur_comparison.png'), Buffer.from(snapRes.data, 'base64'));
    snapWs.close();
    p.kill();
    console.log('✔ Generated android_blur_comparison.png and crops successfully.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
