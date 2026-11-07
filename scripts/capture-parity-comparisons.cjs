const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BACKEND_PORT = 8099;
const WEB_PORT = 5180;
const ARTIFACT_DIR = '/Users/innodaredevil/.gemini/antigravity/brain/ef0571b7-3b6c-4291-961b-77465a860271';
const comparisonDir = path.join(ARTIFACT_DIR, 'comparisons');
if (!fs.existsSync(comparisonDir)) fs.mkdirSync(comparisonDir, { recursive: true });

const tmpUserData = path.join(__dirname, '..', 'tmp-parity-userdata');
if (!fs.existsSync(tmpUserData)) fs.mkdirSync(tmpUserData, { recursive: true });
app.setPath('userData', tmpUserData);

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

function postJson(urlPath, payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...extraHeaders
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

app.whenReady().then(async () => {
  try {
    console.log('==> [1/4] Authenticating review_alice against backend on 8099...');
    const aliceDeviceId = 'a43ab2e2-7ed5-4845-bb6b-ddc2a7569928';
    const loginRes = await postJson('/api/v1/auth/login', {
      usernameOrEmail: 'review_alice',
      password: 'Password123!'
    }, {
      'X-Device-Id': aliceDeviceId,
      'X-Device-Name': 'Parity Review Client',
      'X-Device-Platform': 'web',
      'X-Device-Browser': 'Electron'
    });

    if (loginRes.status !== 200) {
      throw new Error(`Alice login failed with HTTP ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }

    const aliceToken = loginRes.data.tokens?.accessToken || loginRes.data.accessToken;
    const aliceUser = loginRes.data.user;
    if (!aliceToken || !aliceUser) {
      throw new Error('Missing token or user object in login response');
    }
    console.log(`  ✓ Authenticated as ${aliceUser.username} (${aliceUser.id})`);

    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'apps', 'desktop', 'src', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const previewWebUrl = `file://${path.resolve(__dirname, '..', 'preview', 'preview-web.html')}`;
    const previewMacosUrl = `file://${path.resolve(__dirname, '..', 'preview', 'preview-desktop-macos.html')}`;
    const prodBaseUrl = `http://127.0.0.1:${WEB_PORT}`;

    async function capturePageToFile(url, width, height, filename, setupFn = null) {
      win.setSize(width, height);
      await win.loadURL(url);
      if (setupFn) {
        await win.webContents.executeJavaScript(setupFn);
        await new Promise(r => setTimeout(r, 800));
      }
      await new Promise(r => setTimeout(r, 2000));
      const img = await win.webContents.capturePage();
      const outPath = path.join(comparisonDir, filename);
      fs.writeFileSync(outPath, img.toPNG());
      console.log(`  ✓ Saved: ${filename} (${width}x${height})`);
    }

    const injectAuthScript = `
      localStorage.setItem('chat_device_id', ${JSON.stringify(aliceDeviceId)});
      localStorage.setItem('chat_access_token', ${JSON.stringify(aliceToken)});
      localStorage.setItem('chat_user', JSON.stringify(${JSON.stringify(aliceUser)}));
    `;

    // 1. Approved Previews
    console.log('\n==> [2/4] Capturing Approved Design Previews...');
    // 1440x900 Dark Web
    await capturePageToFile(previewWebUrl, 1440, 900, 'preview-web-1440-dark.png');
    // 1440x900 Light Web
    await capturePageToFile(previewWebUrl, 1440, 900, 'preview-web-1440-light.png', `
      document.documentElement.setAttribute('data-theme', 'light');
      const toggle = document.querySelector('.theme-toggle-btn');
      if (toggle) toggle.textContent = '🌙';
    `);
    // 1024x768 Dark Web
    await capturePageToFile(previewWebUrl, 1024, 768, 'preview-web-1024-dark.png');
    // 1024x768 Light Web
    await capturePageToFile(previewWebUrl, 1024, 768, 'preview-web-1024-light.png', `
      document.documentElement.setAttribute('data-theme', 'light');
    `);
    // macOS Desktop Previews
    await capturePageToFile(previewMacosUrl, 1440, 900, 'preview-macos-1440-dark.png');
    await capturePageToFile(previewMacosUrl, 1024, 768, 'preview-macos-1024-dark.png');

    // 2. Production App
    console.log('\n==> [3/4] Capturing Corrected Production App...');
    // Seed Alice auth into production origin
    await win.loadURL(prodBaseUrl);
    await win.webContents.executeJavaScript(injectAuthScript);
    await win.webContents.reload();
    await new Promise(r => setTimeout(r, 2500));

    // Helper to ensure first conversation is selected and details panel is set
    const setupProd = (detailsWanted) => `
      (function() {
        const item = document.querySelector('.conversation-item');
        if (item && !item.classList.contains('active')) item.click();
        const details = document.getElementById('detailsPanel');
        const toggleBtn = document.getElementById('btnToggleDetails');
        if (${detailsWanted} && !details && toggleBtn) {
          toggleBtn.click();
        } else if (!${detailsWanted} && details && toggleBtn) {
          toggleBtn.click();
        }
      })();
    `;

    // 1440x900 Dark Web (Details panel open)
    await capturePageToFile(`${prodBaseUrl}/?platform=web&theme=dark`, 1440, 900, 'prod-web-1440-dark.png', setupProd(true));
    // 1440x900 Light Web (Details panel open)
    await capturePageToFile(`${prodBaseUrl}/?platform=web&theme=light`, 1440, 900, 'prod-web-1440-light.png', setupProd(true));
    // 1024x768 Dark Web (Details panel closed)
    await capturePageToFile(`${prodBaseUrl}/?platform=web&theme=dark`, 1024, 768, 'prod-web-1024-dark.png', setupProd(false));
    // 1024x768 Light Web (Details panel closed)
    await capturePageToFile(`${prodBaseUrl}/?platform=web&theme=light`, 1024, 768, 'prod-web-1024-light.png', setupProd(false));

    // macOS Desktop Production Emulation
    await capturePageToFile(`${prodBaseUrl}/?platform=macos&theme=dark`, 1440, 900, 'prod-macos-1440-dark.png', setupProd(true));
    await capturePageToFile(`${prodBaseUrl}/?platform=macos&theme=dark`, 1024, 768, 'prod-macos-1024-dark.png', setupProd(false));

    // 3. Generate HTML & Composite Comparison Sheets
    console.log('\n==> [4/4] Generating Side-by-Side Comparison Sheets...');

    function makeCompositeHtml(title, previewFile, prodFile, width, height) {
      const prevB64 = fs.readFileSync(path.join(comparisonDir, previewFile)).toString('base64');
      const prodB64 = fs.readFileSync(path.join(comparisonDir, prodFile)).toString('base64');
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #06090d;
      color: #f0f4f2;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #10b981;
      margin-bottom: 6px;
    }
    p {
      font-size: 13px;
      color: #8696a0;
    }
    .pair-container {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      justify-content: center;
      width: 100%;
    }
    .panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #0f171f;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
    }
    .label-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-preview {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    .badge-prod {
      background: rgba(6, 182, 212, 0.15);
      color: #06b6d4;
      border: 1px solid rgba(6, 182, 212, 0.35);
    }
    .img-frame {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
    }
    .img-frame img {
      width: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>Left: Approved Preview Specification (Design Source of Truth) · Right: Verified Production React Application</p>
  </div>
  <div class="pair-container">
    <div class="panel">
      <span class="label-badge badge-preview">Approved Design Preview</span>
      <div class="img-frame">
        <img src="data:image/png;base64,${prevB64}" alt="Approved Preview">
      </div>
    </div>
    <div class="panel">
      <span class="label-badge badge-prod">Live Production React App</span>
      <div class="img-frame">
        <img src="data:image/png;base64,${prodB64}" alt="Production App">
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    const composites = [
      {
        title: 'IndiChat 1440x900 Dark Obsidian Visual Parity Comparison',
        prev: 'preview-web-1440-dark.png',
        prod: 'prod-web-1440-dark.png',
        out: 'composite-1440-dark.png'
      },
      {
        title: 'IndiChat 1440x900 Daylight Light Visual Parity Comparison',
        prev: 'preview-web-1440-light.png',
        prod: 'prod-web-1440-light.png',
        out: 'composite-1440-light.png'
      },
      {
        title: 'IndiChat 1024x768 Dark Obsidian Visual Parity Comparison',
        prev: 'preview-web-1024-dark.png',
        prod: 'prod-web-1024-dark.png',
        out: 'composite-1024-dark.png'
      },
      {
        title: 'IndiChat 1024x768 Daylight Light Visual Parity Comparison',
        prev: 'preview-web-1024-light.png',
        prod: 'prod-web-1024-light.png',
        out: 'composite-1024-light.png'
      },
      {
        title: 'IndiChat macOS Native Desktop Visual Parity Comparison',
        prev: 'preview-macos-1440-dark.png',
        prod: 'prod-macos-1440-dark.png',
        out: 'composite-macos-titlebar.png'
      }
    ];

    for (const c of composites) {
      const html = makeCompositeHtml(c.title, c.prev, c.prod, 1440, 900);
      const tempHtmlPath = path.join(tmpUserData, `${c.out}.html`);
      fs.writeFileSync(tempHtmlPath, html);

      win.setSize(2000, 1150);
      await win.loadURL(`file://${tempHtmlPath}`);
      await new Promise(r => setTimeout(r, 1200));
      const shot = await win.webContents.capturePage();
      const compOutPath = path.join(comparisonDir, c.out);
      fs.writeFileSync(compOutPath, shot.toPNG());
      console.log(`  ✓ Rendered Composite: ${c.out}`);
    }

    win.destroy();
    if (fs.existsSync(tmpUserData)) fs.rmSync(tmpUserData, { recursive: true, force: true });
    console.log('\n======================================================================');
    console.log(' All Visual Parity Comparisons Captured and Generated Successfully!');
    console.log(` Output Directory: ${comparisonDir}`);
    console.log('======================================================================\n');
    app.exit(0);

  } catch (err) {
    console.error('❌ Parity Capture Failure:', err);
    app.exit(1);
  }
});

