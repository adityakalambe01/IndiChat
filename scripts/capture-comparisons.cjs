const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/innodaredevil/.gemini/antigravity/brain/ef0571b7-3b6c-4291-961b-77465a860271';
const comparisonDir = path.join(ARTIFACT_DIR, 'comparisons');
if (!fs.existsSync(comparisonDir)) fs.mkdirSync(comparisonDir, { recursive: true });

const tmpUserData = path.join(__dirname, '..', 'tmp-capture-userdata');
if (!fs.existsSync(tmpUserData)) fs.mkdirSync(tmpUserData, { recursive: true });
app.setPath('userData', tmpUserData);

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  try {
    const previewWebPath = `file://${path.resolve(__dirname, '..', 'preview', 'preview-web.html')}`;
    const previewMacosPath = `file://${path.resolve(__dirname, '..', 'preview', 'preview-desktop-macos.html')}`;
    const prodUrl = 'http://127.0.0.1:5180';

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

    async function capture(url, width, height, filename, setupFn = null) {
      win.setSize(width, height);
      await win.loadURL(url);
      if (setupFn) {
        await win.webContents.executeJavaScript(setupFn);
        await win.webContents.reload();
      }
      await new Promise(r => setTimeout(r, 2000));
      const img = await win.webContents.capturePage();
      const outPath = path.join(comparisonDir, filename);
      fs.writeFileSync(outPath, img.toPNG());
      console.log(`Saved: ${outPath} (${width}x${height})`);
    }

    const aliceAuthScript = `
      localStorage.setItem('chat_device_id', 'a43ab2e2-7ed5-4845-bb6b-ddc2a7569928');
      localStorage.setItem('chat_user', JSON.stringify({
        id: '6d9b4a1e-3fc5-4cf1-9b12-92549f90abf2',
        username: 'review_alice',
        displayName: 'Alice Reviewer'
      }));
    `;

    console.log('Capturing Approved Previews...');
    await capture(previewWebPath, 1440, 900, 'preview-web-1440.png');
    await capture(previewWebPath, 1024, 768, 'preview-web-1024.png');
    await capture(previewMacosPath, 1440, 900, 'preview-macos-1440.png');
    await capture(previewMacosPath, 1024, 768, 'preview-macos-1024.png');

    console.log('Capturing Current Production App...');
    await capture(prodUrl, 1440, 900, 'prod-web-1440.png', aliceAuthScript);
    await capture(prodUrl, 1024, 768, 'prod-web-1024.png');

    console.log('Capturing Production Desktop (macOS emulation)...');
    await capture(`${prodUrl}?platform=macos`, 1440, 900, 'prod-macos-1440.png');
    await capture(`${prodUrl}?platform=macos`, 1024, 768, 'prod-macos-1024.png');

    win.destroy();
    if (fs.existsSync(tmpUserData)) fs.rmSync(tmpUserData, { recursive: true, force: true });
    console.log('All comparisons captured successfully!');
    app.exit(0);
  } catch (e) {
    console.error('Capture error:', e);
    app.exit(1);
  }
});
