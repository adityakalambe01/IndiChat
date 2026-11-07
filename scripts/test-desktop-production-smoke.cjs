// Native Electron Production Smoke Test
// Verifies:
// 1. Settings persistence across actual app reload & visible failure reporting in DOM
// 2. Full termination and relaunch of the Electron app
// 3. Server URL persistence across processes and actual backend routing via embedded proxy

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const TEST_BACKEND_PORT = 8191;
const testConfigDir = path.join(__dirname, '..', 'tmp-electron-smoke-config');
const testConfigPath = path.join(testConfigDir, 'desktop-config.json');
const testUserDataDir = path.join(__dirname, '..', 'tmp-electron-smoke-userdata');

// Ensure clean directories
if (!fs.existsSync(testConfigDir)) fs.mkdirSync(testConfigDir, { recursive: true });
if (!fs.existsSync(testUserDataDir)) fs.mkdirSync(testUserDataDir, { recursive: true });

app.setPath('userData', testUserDataDir);
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Backend state on port 8191
const backendStatePath = path.join(testConfigDir, 'backend-state.json');
let backendSettings = {
  twoFactorEnabled: false,
  privacyLastSeen: 'everyone',
  readReceipts: true,
  enterIsSend: true,
  mediaVisibility: true,
  language: 'en'
};
if (fs.existsSync(backendStatePath)) {
  try {
    backendSettings = JSON.parse(fs.readFileSync(backendStatePath, 'utf8'));
  } catch (e) {}
}
let backendShouldFail = false;
let backendReceivedUpdates = [];

// Mock backend server handling REST endpoints used by web client
const testBackendServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${TEST_BACKEND_PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Smoke-Backend-Port', String(TEST_BACKEND_PORT));

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Current user endpoint
  if (url.pathname === '/api/v1/users/me') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      id: 'smoke-user-1',
      username: 'smoke_user',
      displayName: 'Smoke User',
      email: 'smoke@example.com',
      avatarUrl: null,
      phoneNumber: '+1234567890'
    }));
  }

  // Settings GET
  if (req.method === 'GET' && url.pathname === '/api/v1/settings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(backendSettings));
  }

  // Settings PUT
  if (req.method === 'PUT' && url.pathname === '/api/v1/settings') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (backendShouldFail) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Database write rejected: read-only snapshot lock' }));
      }
      try {
        const parsed = JSON.parse(body);
        backendReceivedUpdates.push(parsed);
        backendSettings = { ...backendSettings, ...parsed };
        try {
          fs.writeFileSync(backendStatePath, JSON.stringify(backendSettings, null, 2), 'utf8');
        } catch (e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(backendSettings));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Devices
  if (url.pathname === '/api/v1/devices') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify([
      { id: 'smoke-dev-1', name: 'Desktop Client', platform: 'macOS', isCurrent: true }
    ]));
  }

  // Conversations
  if (url.pathname === '/api/v1/conversations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify([]));
  }

  // Channels, communities, contacts
  if (url.pathname.startsWith('/api/v1/channels') || 
      url.pathname.startsWith('/api/v1/communities') || 
      url.pathname.startsWith('/api/v1/contacts') ||
      url.pathname.startsWith('/api/v1/status') ||
      url.pathname.startsWith('/api/v1/notifications')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify([]));
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'OK', target: 'smoke-backend' }));
});

const isRelaunch = process.argv.includes('--relaunch');

app.whenReady().then(async () => {
  if (!isRelaunch) {
    // =========================================================================
    // PROCESS 1: First Run
    // =========================================================================
    console.log('======================================================================');
    console.log(' Starting Native Desktop Smoke Test — Process 1 (Initial Run)');
    console.log('======================================================================\n');

    await new Promise(resolve => testBackendServer.listen(TEST_BACKEND_PORT, '127.0.0.1', resolve));
    console.log(`==> [1/6] Mock backend listening on http://127.0.0.1:${TEST_BACKEND_PORT}`);

    // Load main modules
    const { startServer } = require(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'server.cjs'));
    const { savePersistedServerUrl } = require(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'main.cjs'));

    // 1. Set server URL via persistence helper
    const targetUrl = `http://127.0.0.1:${TEST_BACKEND_PORT}`;
    savePersistedServerUrl(targetUrl, testConfigPath);
    console.log(`==> [2/6] Server URL configured & saved to disk: ${targetUrl}`);

    // 2. Start embedded proxy server pointing to test backend
    const staticDir = path.resolve(__dirname, '..', 'apps', 'web', 'dist');
    const { localUrl, server: embeddedProxy } = await startServer({
      staticDir,
      targetBackendUrl: targetUrl
    });
    console.log(`==> [3/6] Embedded proxy started at: ${localUrl}`);

    // 3. Launch actual BrowserWindow and load web app
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'apps', 'desktop', 'src', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    await win.loadURL(localUrl);
    console.log('==> [4/6] Initial index.html loaded. Seeding user auth session into localStorage...');

    // Seed authenticated session and reload so App mounts authenticated UI
    await win.webContents.executeJavaScript(`
      localStorage.setItem('chat_access_token', 'mock_jwt_smoke');
      localStorage.setItem('chat_user', JSON.stringify({
        id: 'smoke-user-1',
        username: 'smoke_user',
        displayName: 'Smoke User'
      }));
    `);
    await win.webContents.reload();

    // Helper: wait for selector in DOM
    const waitForSelector = async (selector, timeoutMs = 8000) => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        const found = await win.webContents.executeJavaScript(`
          Boolean(document.querySelector('${selector}'))
        `);
        if (found) return true;
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error(`Timeout waiting for DOM selector: ${selector}`);
    };

    // Wait for NavigationRail settings button to render
    await waitForSelector('#railSettingsBtn');
    console.log('  ✓ NavigationRail rendered with settings button');

    // Open FullSettingsModal
    await win.webContents.executeJavaScript(`
      document.getElementById('railSettingsBtn').click();
    `);
    await waitForSelector('button[data-settings-tab="account"]');
    console.log('  ✓ FullSettingsModal opened with tab navigation');

    // Navigate to Account & Security tab
    await win.webContents.executeJavaScript(`
      document.querySelector('button[data-settings-tab="account"]').click();
    `);
    await waitForSelector('#check2FAEnabled');
    console.log('  ✓ Account & Security tab active; #check2FAEnabled checkbox found');

    // Verify initial checkbox state is false
    const initialChecked = await win.webContents.executeJavaScript(`
      document.getElementById('check2FAEnabled').checked
    `);
    if (initialChecked !== false) {
      throw new Error(`Expected initial twoFactorEnabled to be false, got ${initialChecked}`);
    }
    console.log('  ✓ Initial state confirmed: twoFactorEnabled = false');

    // 4. Toggle setting and confirm server-backed persistence
    console.log('\n==> [5/6] Toggling twoFactorEnabled in actual UI and verifying persistence...');
    await win.webContents.executeJavaScript(`
      document.getElementById('check2FAEnabled').click();
    `);

    // Allow async handleUpdateSetting -> PUT /api/v1/settings to complete
    await new Promise(r => setTimeout(r, 800));

    if (backendSettings.twoFactorEnabled !== true) {
      throw new Error(`Backend settings were not updated: ${JSON.stringify(backendSettings)}`);
    }
    console.log('  ✓ Backend received PUT /api/v1/settings and persisted twoFactorEnabled=true');

    // Reload the app in BrowserWindow to verify restore
    console.log('  -> Reloading window to test restore across app reload...');
    await win.webContents.reload();
    await waitForSelector('#railSettingsBtn');

    // Re-open settings modal and inspect checkbox
    await win.webContents.executeJavaScript(`
      document.getElementById('railSettingsBtn').click();
    `);
    await waitForSelector('button[data-settings-tab="account"]');
    await win.webContents.executeJavaScript(`
      document.querySelector('button[data-settings-tab="account"]').click();
    `);
    await waitForSelector('#check2FAEnabled');

    const restoredChecked = await win.webContents.executeJavaScript(`
      document.getElementById('check2FAEnabled').checked
    `);
    if (restoredChecked !== true) {
      throw new Error(`twoFactorEnabled failed to restore after reload: expected true, got ${restoredChecked}`);
    }
    console.log('  ✓ Verified: Server-backed setting correctly restored to true after app reload');

    // 5. Test visible error reporting in DOM on failed save
    console.log('\n==> [6/6] Arming mock backend to fail and verifying visible DOM error reporting...');
    backendShouldFail = true;

    // Click checkbox to toggle from true to false, triggering failed save
    await win.webContents.executeJavaScript(`
      document.getElementById('check2FAEnabled').click();
    `);

    // Wait for #settingsErrorBanner to appear in the DOM
    await waitForSelector('#settingsErrorBanner');

    const bannerDetails = await win.webContents.executeJavaScript(`
      (() => {
        const banner = document.getElementById('settingsErrorBanner');
        const checkbox = document.getElementById('check2FAEnabled');
        return {
          exists: Boolean(banner),
          text: banner ? banner.innerText : null,
          checkboxRolledBack: checkbox ? checkbox.checked : null
        };
      })()
    `);

    if (!bannerDetails.exists || !bannerDetails.text.includes('Database write rejected')) {
      throw new Error(`Error banner did not display expected server error message: ${JSON.stringify(bannerDetails)}`);
    }
    if (bannerDetails.checkboxRolledBack !== true) {
      throw new Error(`UI switch state was not rolled back on server failure: ${JSON.stringify(bannerDetails)}`);
    }

    console.log(`  ✓ Visible error banner rendered in DOM: "${bannerDetails.text.trim()}"`);
    console.log('  ✓ UI checkbox successfully rolled back to previous state (true)');

    // Clean up Process 1
    embeddedProxy.close();
    testBackendServer.close();
    win.destroy();

    console.log('\n======================================================================');
    console.log(' Process 1 Complete — Fully terminating Electron app...');
    console.log('======================================================================\n');

    app.exit(0);

  } else {
    // =========================================================================
    // PROCESS 2: Relaunch Run
    // =========================================================================
    console.log('======================================================================');
    console.log(' Starting Native Desktop Smoke Test — Process 2 (Relaunch Run)');
    console.log('======================================================================\n');

    await new Promise(resolve => testBackendServer.listen(TEST_BACKEND_PORT, '127.0.0.1', resolve));

    const { startServer } = require(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'server.cjs'));
    const { loadPersistedServerUrl } = require(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'main.cjs'));

    // 1. Verify URL persistence across complete process restart
    const persistedUrl = loadPersistedServerUrl(testConfigPath);
    console.log(`==> [1/3] Read persisted URL on fresh startup: ${persistedUrl}`);
    if (persistedUrl !== `http://127.0.0.1:${TEST_BACKEND_PORT}`) {
      throw new Error(`URL persistence failed across restart: expected http://127.0.0.1:${TEST_BACKEND_PORT}, got ${persistedUrl}`);
    }
    console.log('  ✓ Server URL successfully persisted across full application termination');

    // 2. Start embedded proxy using the persisted URL
    const staticDir = path.resolve(__dirname, '..', 'apps', 'web', 'dist');
    const { localUrl, server: embeddedProxy } = await startServer({
      staticDir,
      targetBackendUrl: persistedUrl
    });
    console.log(`==> [2/3] Process 2 embedded proxy started at: ${localUrl}`);

    // 3. Verify actual backend routing through embedded proxy
    console.log('==> [3/3] Verifying actual backend routing through embedded proxy...');
    const routedResponse = await new Promise((resolve, reject) => {
      http.get(`${localUrl}/api/v1/settings`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }));
      }).on('error', reject);
    });

    if (routedResponse.status !== 200 || 
        routedResponse.body.twoFactorEnabled !== true ||
        routedResponse.headers['x-smoke-backend-port'] !== '8191') {
      throw new Error(`Backend routing verification failed: ${JSON.stringify(routedResponse)}`);
    }
    console.log('  ✓ Request to embedded proxy (/api/v1/settings) correctly routed to persisted backend');
    console.log(`  ✓ Backend response verified: status=${routedResponse.status}, portHeader=${routedResponse.headers['x-smoke-backend-port']}, twoFactorEnabled=${routedResponse.body.twoFactorEnabled}`);

    embeddedProxy.close();
    testBackendServer.close();

    // Clean up test directories
    if (fs.existsSync(testConfigDir)) fs.rmSync(testConfigDir, { recursive: true, force: true });
    if (fs.existsSync(testUserDataDir)) fs.rmSync(testUserDataDir, { recursive: true, force: true });

    console.log('\n======================================================================');
    console.log(' Desktop Relaunch & Routing Verification PASSED COMPLETELY!');
    console.log('======================================================================\n');

    app.exit(0);
  }
});
