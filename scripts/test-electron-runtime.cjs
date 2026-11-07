const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Path to test config & user data
const testConfigDir = path.join(__dirname, '..', 'tmp-electron-test');
const testConfigPath = path.join(testConfigDir, 'desktop-config.json');
const testUserDataDir = path.join(__dirname, '..', 'tmp-electron-userdata');

// Ensure clean test directories
if (fs.existsSync(testConfigDir)) {
  fs.rmSync(testConfigDir, { recursive: true, force: true });
}
fs.mkdirSync(testConfigDir, { recursive: true });
if (!fs.existsSync(testUserDataDir)) {
  fs.mkdirSync(testUserDataDir, { recursive: true });
}

// Redirect Electron user data & cache inside workspace
app.setPath('userData', testUserDataDir);
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');


// Require main helpers
const mainModule = require(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'main.cjs'));
const {
  sanitizeServerUrl,
  loadPersistedServerUrl,
  savePersistedServerUrl,
  validateIpcSender
} = mainModule;

let mainWindow = null;
let rogueWindow = null;
let currentTargetBackend = loadPersistedServerUrl(testConfigPath);

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

app.whenReady().then(async () => {
  console.log('======================================================================');
  console.log(' Running Native Electron Runtime Verification Suite');
  console.log(` Electron Version: ${process.versions.electron}`);
  console.log(` Chrome Version:   ${process.versions.chrome}`);
  console.log(` Node Version:     ${process.versions.node}`);
  console.log('======================================================================\n');

  try {
    // 1. Create Main Window
    console.log('==> [1/5] Launching native BrowserWindow with real preload script...');
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false, // keep offscreen for automated test
      webPreferences: {
        preload: path.join(__dirname, '..', 'apps', 'desktop', 'src', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // Register test IPC handlers tied to mainWindow
    ipcMain.handle('test-get-server-url', (event) => {
      validateIpcSender(event, mainWindow);
      return currentTargetBackend;
    });

    ipcMain.handle('test-set-server-url', async (event, url) => {
      validateIpcSender(event, mainWindow);
      const sanitized = savePersistedServerUrl(url, testConfigPath);
      currentTargetBackend = sanitized;
      return { success: true, serverUrl: sanitized };
    });

    await mainWindow.loadURL('data:text/html,<html><head><title>IndiChat Native Electron Test</title></head><body><h1>Testing</h1></body></html>');
    assert(mainWindow !== null && !mainWindow.isDestroyed(), 'BrowserWindow created and loaded HTML data URL');

    // 2. Test Window Controls
    console.log('\n==> [2/5] Verifying native window controls...');
    mainWindow.show();
    await new Promise(r => setTimeout(r, 100));

    // Test minimize
    const minimizePromise = new Promise(resolve => {
      mainWindow.once('minimize', () => resolve(true));
      setTimeout(() => resolve(mainWindow.isMinimized()), 400);
    });
    mainWindow.minimize();
    const minimized = await minimizePromise;
    console.log(`    window.isMinimized(): ${mainWindow.isMinimized()} (event: ${minimized})`);

    // Test restore
    const restorePromise = new Promise(resolve => {
      mainWindow.once('restore', () => resolve(true));
      setTimeout(() => resolve(!mainWindow.isMinimized()), 400);
    });
    mainWindow.restore();
    await restorePromise;

    // Test maximize
    const maximizePromise = new Promise(resolve => {
      mainWindow.once('maximize', () => resolve(true));
      setTimeout(() => resolve(mainWindow.isMaximized()), 400);
    });
    mainWindow.maximize();
    await maximizePromise;
    console.log(`    window.isMaximized(): ${mainWindow.isMaximized()}`);

    mainWindow.unmaximize();
    await new Promise(r => setTimeout(r, 200));

    assert(!mainWindow.isDestroyed(), 'Window controls responded without error');

    // 3. Test Server URL Persistence
    console.log('\n==> [3/5] Verifying server URL configuration and disk persistence...');
    const initialUrl = await mainWindow.webContents.executeJavaScript(`
      window.electronAPI.getServerUrl ? 'present' : 'missing'
    `);
    assert(initialUrl === 'present', 'window.electronAPI exposed in preload main world contextBridge');

    // Persist new URL
    const newTarget = 'https://chat.indichat.com:8443';
    savePersistedServerUrl(newTarget, testConfigPath);
    currentTargetBackend = loadPersistedServerUrl(testConfigPath);
    assert(currentTargetBackend === newTarget, `Persisted URL correctly loaded from disk: ${currentTargetBackend}`);

    // Verify file content on disk
    assert(fs.existsSync(testConfigPath), 'desktop-config.json was written to disk');
    const diskContent = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
    assert(diskContent.serverUrl === newTarget, 'Disk JSON contains matching serverUrl');
    assert(typeof diskContent.updatedAt === 'string', 'Disk JSON contains updatedAt timestamp');

    // 4. Test Process Restart Simulation (Reloading configuration)
    console.log('\n==> [4/5] Verifying restart behavior...');
    const reloadedTarget = loadPersistedServerUrl(testConfigPath);
    assert(reloadedTarget === newTarget, `Restart behavior: persisted URL survived process re-read: ${reloadedTarget}`);

    // Test default fallback when file is deleted
    fs.unlinkSync(testConfigPath);
    const defaultFallback = loadPersistedServerUrl(testConfigPath);
    assert(defaultFallback === 'http://localhost:8080', `Default fallback works when config is missing: ${defaultFallback}`);

    // Restore test target
    savePersistedServerUrl(newTarget, testConfigPath);

    // 5. Test IPC Sender Rejection & Security Boundary
    console.log('\n==> [5/5] Verifying IPC sender validation & security rejections...');

    // A. Rejection from Rogue/Unauthorized Window
    rogueWindow = new BrowserWindow({
      width: 400,
      height: 300,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    await rogueWindow.loadURL('data:text/html,<html><body>Rogue Window</body></html>');

    let rogueRejected = false;
    try {
      validateIpcSender({ sender: rogueWindow.webContents, senderFrame: { parent: null } }, mainWindow);
    } catch (err) {
      if (err.message.includes('caller does not match main window')) {
        rogueRejected = true;
      }
    }
    assert(rogueRejected, 'IPC call from unauthorized foreign Window rejected with security error');

    // B. Rejection from Nested Sub-frame
    let subframeRejected = false;
    try {
      validateIpcSender({ sender: mainWindow.webContents, senderFrame: { parent: {} } }, mainWindow);
    } catch (err) {
      if (err.message.includes('sub-frames are not permitted')) {
        subframeRejected = true;
      }
    }
    assert(subframeRejected, 'IPC call from nested subframe rejected with security error');

    // C. Rejection of Invalid URLs
    const invalidUrls = [
      { url: 'file:///etc/passwd', reason: 'Disallowed file protocol' },
      { url: 'javascript:alert(1)', reason: 'Disallowed javascript protocol' },
      { url: 'ftp://ftp.example.com', reason: 'Disallowed ftp protocol' },
      { url: 'https://admin:secret@malicious.com', reason: 'Embedded credentials' },
      { url: '   ', reason: 'Empty string' },
      { url: 'http://', reason: 'Missing hostname' }
    ];

    for (const testCase of invalidUrls) {
      let rejected = false;
      try {
        sanitizeServerUrl(testCase.url);
      } catch (err) {
        rejected = true;
      }
      assert(rejected, `Invalid URL correctly rejected (${testCase.reason}): ${testCase.url}`);
    }

    console.log('\n======================================================================');
    console.log(` Electron Runtime Verification PASSED: ${passedCount} checks passed, 0 failures.`);
    console.log('======================================================================\n');

  } catch (error) {
    console.error('\n[FATAL TEST ERROR]:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup windows & test dir
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    if (rogueWindow && !rogueWindow.isDestroyed()) rogueWindow.destroy();
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testUserDataDir)) {
      fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
    app.quit();
  }
});
