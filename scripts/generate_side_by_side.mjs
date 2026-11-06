import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9225;
const OUT_DIR = path.resolve('release/chats_comparison');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PREVIEW_IMG = path.resolve('release/preview_captures/preview_chats_top.png');
const IOS_IMG = path.resolve('release/ios/verification/chats_top.png');
const ANDROID_IMG = path.resolve('release/android/verification/chats_top.png');
const ANDROID_MENU_IMG = path.resolve('release/android/verification/chats_menu_open.png');

function toBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IndiChat Chats Parity Comparison</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0e12;
      color: #e9edef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #10b981;
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
      letter-spacing: 0.5px;
      padding: 5px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.08);
      color: #d1d7db;
    }
    .badge.preview {
      background: rgba(16, 185, 129, 0.18);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge.native {
      background: rgba(59, 130, 246, 0.18);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .img-wrap {
      width: 390px;
      height: 844px;
      border-radius: 40px;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
      background: #070b0e;
    }
    .img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .audit-notes {
      margin-top: 32px;
      max-width: 1200px;
      width: 100%;
      background: #111b21;
      border: 1px solid #202c33;
      border-radius: 16px;
      padding: 20px;
    }
    .audit-notes h2 {
      font-size: 16px;
      color: #00a884;
      margin-bottom: 12px;
    }
    .audit-notes ul {
      list-style-type: disc;
      padding-left: 20px;
      font-size: 13px;
      line-height: 20px;
      color: #d1d7db;
    }
    .audit-notes li {
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
  <h1>Chats Screen Verification & Visual Comparison</h1>
  <p class="subtitle">Comparing approved HTML/CSS Preview reference against fresh iOS and Android native production builds</p>
  
  <div class="comparison-grid">
    <!-- 1. Approved Preview -->
    <div class="col">
      <div class="badge preview">Approved Preview Reference</div>
      <div class="img-wrap">
        <img src="data:image/png;base64,${toBase64(PREVIEW_IMG)}" alt="Approved Preview Reference">
      </div>
    </div>

    <!-- 2. iOS Native -->
    <div class="col">
      <div class="badge native">iOS Native (iPhone 17)</div>
      <div class="img-wrap">
        <img src="data:image/png;base64,${toBase64(IOS_IMG)}" alt="iOS Native Build">
      </div>
    </div>

    <!-- 3. Android Native -->
    <div class="col">
      <div class="badge native">Android Native (Pixel 8)</div>
      <div class="img-wrap">
        <img src="data:image/png;base64,${toBase64(ANDROID_IMG)}" alt="Android Native Build">
      </div>
    </div>

    <!-- 4. Secondary Menu -->
    <div class="col">
      <div class="badge native">Relocated Secondary Menu</div>
      <div class="img-wrap">
        <img src="data:image/png;base64,${toBase64(ANDROID_MENU_IMG)}" alt="Secondary Menu Open">
      </div>
    </div>
  </div>
</body>
</html>`;

const HTML_PATH = path.join(OUT_DIR, 'chats_comparison.html');
fs.writeFileSync(HTML_PATH, htmlContent);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureGrid() {
  const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1800,1100',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch (e) {
      await sleep(200);
    }
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome CDP connection failed');
  }

  const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(`file://${HTML_PATH}`)}`, { method: 'PUT' });
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

  await new Promise((resolve) => ws.onopen = resolve);

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

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const outShotPath = path.join(OUT_DIR, 'chats_side_by_side_comparison.png');
  fs.writeFileSync(outShotPath, Buffer.from(shot.data, 'base64'));
  console.log(`Saved composite comparison screenshot: ${outShotPath}`);

  ws.close();
  chromeProc.kill();
}

captureGrid().catch((e) => {
  console.error('Error generating side-by-side comparison:', e);
});
