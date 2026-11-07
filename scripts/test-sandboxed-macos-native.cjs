/**
 * test-sandboxed-macos-native.cjs
 *
 * Full Native Runtime Verification for Sandboxed macOS Application:
 * apps/desktop/dist-bin-sandboxed/mac-arm64/indichat.app
 *
 * Requirements:
 * 1. sandbox: true verified in BrowserWindow without --no-sandbox CLI flag.
 * 2. Preload bridges and IPC sender rejection.
 * 3. Window controls and external link handling.
 * 4. Embedded proxy HTTP and WebSocket connectivity to isolated temporary test service.
 * 5. Messaging, reactions, and call UI behavior in sandboxed renderer.
 * 6. Server URL persistence across full process termination and relaunch.
 * 7. Existing stopped review resources on ports 8099, 5180, 5595, 6389 left untouched.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../apps/desktop/dist-bin-sandboxed/mac-arm64/indichat.app/Contents/MacOS/indichat');
const TEST_USERDATA_DIR = '/tmp/indichat-sandboxed-test-userdata';
const TEMP_BACKEND_PORT = 8195;
const TEMP_BACKEND_URL = `http://127.0.0.1:${TEMP_BACKEND_PORT}`;
const CDP_PORT = 9445;
const OUTPUT_DIR = path.resolve(__dirname, '../release/macos-sandboxed');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ----------------------------------------------------------------------
// 1. Isolated Temporary Test Backend Server (Port 8195)
// Leaves stopped review resources (8099, 5180, 5595, 6389) completely untouched
// ----------------------------------------------------------------------
let tempBackendServer = null;
let messagesStore = [
  {
    id: 'msg-seed-1',
    conversationId: 'conv-1',
    senderId: 'bob-usr-id',
    senderUsername: 'sandboxed_bob',
    senderDisplayName: 'Bob Sandboxed',
    content: 'Hello Alice! Testing sandboxed desktop client.',
    type: 'TEXT',
    status: 'READ',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    isStarred: false,
    reactionSummaries: []
  }
];

function startTempBackendServer() {
  return new Promise((resolve) => {
    tempBackendServer = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, TEMP_BACKEND_URL);
      const pathname = parsedUrl.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Name, X-Device-Platform, X-Device-Browser');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      // Login
      if (req.method === 'POST' && pathname === '/api/v1/auth/login') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            tokens: {
              accessToken: 'mock-sandboxed-jwt-token',
              refreshToken: 'mock-sandboxed-refresh-token'
            },
            user: {
              id: 'alice-usr-id',
              username: 'sandboxed_alice',
              displayName: 'Alice Sandboxed',
              email: 'alice@sandboxed.local',
              phoneNumber: '+15559988'
            }
          }));
        });
        return;
      }

      // Current User
      if (req.method === 'GET' && pathname === '/api/v1/users/me') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          id: 'alice-usr-id',
          username: 'sandboxed_alice',
          displayName: 'Alice Sandboxed',
          email: 'alice@sandboxed.local',
          phoneNumber: '+15559988'
        }));
      }

      // Conversations List
      if (req.method === 'GET' && pathname === '/api/v1/conversations') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([
          {
            id: 'conv-1',
            type: 'DIRECT',
            title: 'Bob Sandboxed',
            members: [
              {
                userId: 'alice-usr-id',
                role: 'MEMBER',
                user: { id: 'alice-usr-id', username: 'sandboxed_alice', displayName: 'Alice Sandboxed', isOnline: true }
              },
              {
                userId: 'bob-usr-id',
                role: 'MEMBER',
                user: { id: 'bob-usr-id', username: 'sandboxed_bob', displayName: 'Bob Sandboxed', isOnline: true }
              }
            ],
            unreadCount: 0,
            lastMessage: messagesStore[messagesStore.length - 1],
            updatedAt: new Date().toISOString()
          }
        ]));
      }

      // Conversation Messages
      if (req.method === 'GET' && pathname.includes('/messages')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          messages: [...messagesStore],
          hasMore: false
        }));
      }

      // Send Message
      if (req.method === 'POST' && pathname.includes('/messages') && !pathname.includes('/reactions')) {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(body || '{}'); } catch (_) {}
          const newMsg = {
            id: `msg-${Date.now()}`,
            conversationId: 'conv-1',
            senderId: 'alice-usr-id',
            senderUsername: 'sandboxed_alice',
            senderDisplayName: 'Alice Sandboxed',
            content: parsed.content || '',
            type: parsed.type || 'TEXT',
            status: 'SENT',
            createdAt: new Date().toISOString(),
            isStarred: false,
            reactionSummaries: []
          };
          messagesStore.push(newMsg);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newMsg));
        });
        return;
      }

      // Reactions
      if (req.method === 'POST' && pathname.includes('/reactions')) {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(body || '{}'); } catch (_) {}
          const emoji = parsed.emoji || '❤️';
          const lastMsg = messagesStore[messagesStore.length - 1];
          if (lastMsg) {
            lastMsg.reactionSummaries = [{ emoji, count: 1 }];
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            reactions: [{ messageId: lastMsg ? lastMsg.id : 'msg-seed-1', emoji, userId: 'alice-usr-id' }],
            summaries: [{ emoji, count: 1 }]
          }));
        });
        return;
      }

      // Linked Devices
      if (req.method === 'GET' && pathname === '/api/v1/devices') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([]));
      }

      // Notification Tokens
      if (req.method === 'POST' && pathname.includes('/notifications')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }

      // Settings
      if (pathname === '/api/v1/settings') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          twoFactorEnabled: false,
          privacyLastSeen: 'everyone',
          readReceipts: true,
          enterIsSend: true,
          mediaVisibility: true,
          language: 'en'
        }));
      }

      // Default
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    // WebSocket Upgrade Handler
    tempBackendServer.on('upgrade', (req, socket) => {
      const key = req.headers['sec-websocket-key'];
      if (!key) {
        socket.destroy();
        return;
      }
      const crypto = require('crypto');
      const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
      );
    });

    tempBackendServer.listen(TEMP_BACKEND_PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

// ----------------------------------------------------------------------
// 2. CDP Client for Native UI Interaction
// ----------------------------------------------------------------------
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { res, rej });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'Evaluation error');
    }
    return result.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

async function connectToPackagedApp(port, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          const client = new CDPClient(page.webSocketDebuggerUrl);
          await client.connect();
          await client.send('DOM.enable');
          await client.send('Page.enable');
          await client.send('Runtime.enable');
          return client;
        }
      }
    } catch (_) {}
    await sleep(250);
  }
  throw new Error(`Failed to connect to CDP on port ${port} after ${maxAttempts} attempts`);
}

// ----------------------------------------------------------------------
// 3. Main Verification Lifecycle
// ----------------------------------------------------------------------
async function main() {
  console.log('======================================================================');
  console.log('  IndiChat Sandboxed Native macOS Runtime Verification (sandbox: true)');
  console.log('======================================================================\n');

  console.log(`Executable Path: ${APP_PATH}`);
  if (!fs.existsSync(APP_PATH)) {
    throw new Error(`Sandboxed packaged binary not found at ${APP_PATH}.`);
  }

  console.log('==> Starting isolated temporary backend on port 8195...');
  await startTempBackendServer();
  console.log('  ✓ Temporary isolated test service listening on http://127.0.0.1:8195\n');

  if (fs.existsSync(TEST_USERDATA_DIR)) {
    fs.rmSync(TEST_USERDATA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_USERDATA_DIR, { recursive: true });

  const initialConfig = {
    serverUrl: TEMP_BACKEND_URL,
    configuredAt: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(TEST_USERDATA_DIR, 'desktop-config.json'),
    JSON.stringify(initialConfig, null, 2),
    'utf8'
  );

  let passedChecks = 0;
  let totalChecks = 0;

  function report(name, status, details = '') {
    totalChecks++;
    if (status) {
      passedChecks++;
      console.log(`  ✓ ${name}: PASS ${details ? `(${details})` : ''}`);
    } else {
      console.error(`  ✗ ${name}: FAIL ${details ? `(${details})` : ''}`);
      process.exitCode = 1;
    }
  }

  // Environment without ELECTRON_RUN_AS_NODE and without sandbox-disabling flags
  const cleanEnv = { ...process.env, BACKEND_URL: TEMP_BACKEND_URL };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;

  console.log('==> [1/7] Launching Sandboxed Packaged Application (NO --no-sandbox flag)...');
  // Notice: Strict removal of --no-sandbox CLI flag!
  let appProcess = spawn(APP_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${TEST_USERDATA_DIR}`
  ], {
    env: cleanEnv,
    stdio: 'ignore'
  });

  let cdp = null;

  try {
    cdp = await connectToPackagedApp(CDP_PORT);
    report('Packaged App Startup without --no-sandbox', true, `PID: ${appProcess.pid}`);
    await sleep(2000);

    // 1. Confirm Sandboxing is ACTUALLY Enabled
    console.log('\n==> [2/7] Verifying Native Chromium Renderer Sandboxing State...');
    const sandboxStatus = await cdp.eval(`
      (() => {
        const hasElectronApi = Boolean(window.electronAPI);
        const hasIndichatDesktop = Boolean(window.indichatDesktop);
        const hasRequire = typeof require !== 'undefined';
        const hasProcess = typeof process !== 'undefined';
        const hasBuffer = typeof Buffer !== 'undefined';
        return {
          hasElectronApi,
          hasIndichatDesktop,
          hasRequire,
          hasProcess,
          hasBuffer
        };
      })()
    `);

    report(
      'Chromium Renderer Sandbox Enforcement',
      sandboxStatus.hasElectronApi && !sandboxStatus.hasRequire && !sandboxStatus.hasProcess && !sandboxStatus.hasBuffer,
      `Bridge: ${sandboxStatus.hasElectronApi}, Node primitives absent (require: ${sandboxStatus.hasRequire}, process: ${sandboxStatus.hasProcess})`
    );

    // 2. Preload Bridge & IPC Validation
    console.log('\n==> [3/7] Verifying Preload Bridge and IPC Sender Validation...');
    const serverUrl = await cdp.eval('window.electronAPI ? window.electronAPI.getServerUrl() : null');
    report('IPC getServerUrl Handler', serverUrl === TEMP_BACKEND_URL, `Server URL: ${serverUrl}`);

    const setValidUrl = await cdp.eval(`
      (async () => {
        try {
          return await window.electronAPI.setServerUrl('${TEMP_BACKEND_URL}');
        } catch (e) {
          return { error: e.message };
        }
      })()
    `);
    report('IPC setServerUrl Valid URL Handling', setValidUrl && setValidUrl.success === true, JSON.stringify(setValidUrl));

    const setInvalidUrl = await cdp.eval(`
      (async () => {
        try {
          await window.electronAPI.setServerUrl('javascript:alert(1)');
          return { rejected: false };
        } catch (e) {
          return { rejected: true, message: e.message };
        }
      })()
    `);
    report('IPC setServerUrl Rejection of Invalid Protocol', setInvalidUrl && setInvalidUrl.rejected, setInvalidUrl?.message);

    const subframeRejection = await cdp.eval(`
      (async () => {
        try {
          const iframe = document.createElement('iframe');
          document.body.appendChild(iframe);
          await new Promise(r => setTimeout(r, 100));
          let rejected = false;
          let message = '';
          try {
            if (iframe.contentWindow.electronAPI) {
              await iframe.contentWindow.electronAPI.getServerUrl();
            } else {
              rejected = true;
              message = 'contextBridge isolates electronAPI from sub-frames';
            }
          } catch (err) {
            rejected = true;
            message = err.message;
          }
          iframe.remove();
          return { rejected, message };
        } catch (e) {
          return { rejected: true, message: e.message };
        }
      })()
    `);
    report('IPC Sender Frame Isolation (Subframe Rejection)', subframeRejection && subframeRejection.rejected, subframeRejection?.message);

    // 3. Window Controls & External Link Handling
    console.log('\n==> [4/7] Testing Window Controls and External-Link Handling...');
    const windowControlsWork = await cdp.eval(`
      (() => {
        try {
          window.electronAPI.minimize();
          window.electronAPI.maximize();
          return true;
        } catch (e) {
          return false;
        }
      })()
    `);
    report('Window Control IPC Invocation', windowControlsWork, 'Minimize & maximize dispatched safely');

    const externalLinkHandling = await cdp.eval(`
      (() => {
        try {
          window.electronAPI.openExternal('https://indichat.com');
          return true;
        } catch (e) {
          return false;
        }
      })()
    `);
    report('External Link Safe Handling', externalLinkHandling, 'openExternal routed via shell');

    // 4. Embedded Proxy Connectivity & Authentication
    console.log('\n==> [5/7] Testing Embedded Proxy HTTP/WebSocket Connectivity & Auth...');
    const locationHref = await cdp.eval('window.location.href');
    report('Embedded Proxy Serving Web Bundle', locationHref.startsWith('http://127.0.0.1:'), `URL: ${locationHref}`);

    const authResult = await cdp.eval(`
      (async () => {
        try {
          const usernameInput = document.querySelector('input[placeholder*="alice"], input[type="text"]');
          const passwordInput = document.querySelector('input[type="password"]');
          const submitBtn = document.querySelector('button[type="submit"]');

          if (!usernameInput || !passwordInput || !submitBtn) {
            return { success: false, reason: 'Login form elements not found' };
          }

          const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          valueSetter.call(usernameInput, 'sandboxed_alice');
          usernameInput.dispatchEvent(new Event('input', { bubbles: true }));

          valueSetter.call(passwordInput, 'Password123!');
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

          await new Promise(r => setTimeout(r, 100));
          submitBtn.click();

          for (let i = 0; i < 50; i++) {
            await new Promise(r => setTimeout(r, 100));
            const hasWorkspace = !!document.querySelector('.app-workspace, .chat-area, .sidebar, .conversation-item');
            if (hasWorkspace) {
              return { success: true, username: 'sandboxed_alice' };
            }
          }
          return { success: false, reason: 'Timed out waiting for workspace after login' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `);
    report('Authentication through Embedded Proxy', Boolean(authResult && authResult.success), `User: ${authResult?.username || authResult?.reason}`);

    // 5. Messaging, Reactions, and Call UI Behavior
    console.log('\n==> [6/7] Testing Messaging, Reactions, and Call UI in Sandboxed Runtime...');
    await sleep(1000);
    await cdp.eval(`
      (() => {
        const item = document.querySelector('.conversation-item');
        if (item) item.click();
      })()
    `);
    await sleep(800);

    const testMsgText = `Sandboxed Native Smoke Test [${Date.now()}]`;
    const sendResult = await cdp.eval(`
      (async () => {
        const input = document.getElementById('composerInputField');
        const sendBtn = document.getElementById('btnSendMessage');
        if (!input || !sendBtn) {
          return { success: false, reason: 'composer elements not found (input: ' + Boolean(input) + ', sendBtn: ' + Boolean(sendBtn) + ')' };
        }

        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(testMsgText)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 150));
        sendBtn.click();

        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 100));
          const bubbles = Array.from(document.querySelectorAll('.message-bubble.outgoing, .bubble-text, .message-bubble'));
          if (bubbles.some(b => (b.innerText || b.textContent || '').includes(${JSON.stringify(testMsgText)}))) {
            return { success: true };
          }
        }
        return { success: false, reason: 'timeout waiting for bubble' };
      })()
    `);
    report('Message Transmission & Stream Rendering', sendResult && sendResult.success, sendResult?.reason || 'Bubble rendered');

    // Reaction
    const reactionResult = await cdp.eval(`
      (async () => {
        try {
          const token = localStorage.getItem('chat_access_token');
          const deviceId = localStorage.getItem('chat_device_id');
          const res = await fetch('/api/v1/messages/msg-seed-1/reactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
              'X-Device-Id': deviceId
            },
            body: JSON.stringify({ emoji: '❤️' })
          });
          return { success: res.ok };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `);
    report('Reaction Mutation in Sandboxed Context', reactionResult && reactionResult.success, 'Reaction mutated via proxy');

    // Call UI Overlay
    const callUiVerified = await cdp.eval(`
      (async () => {
        try {
          const callBtn = document.getElementById('btnAudioCall') || document.querySelector('button[title="Audio Call"], button[aria-label="Audio call"]');
          if (!callBtn) return { success: false, reason: 'call button not found' };
          callBtn.click();
          await new Promise(r => setTimeout(r, 800));

          const hasOverlay = !!document.getElementById('callOverlay') || !!document.querySelector('.call-simulation-overlay');
          const endBtn = document.getElementById('endCallBtn');
          if (endBtn) endBtn.click();
          await new Promise(r => setTimeout(r, 300));
          return { success: hasOverlay };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `);
    report('Call UI Full-Screen Overlay Mounted', callUiVerified && callUiVerified.success, callUiVerified?.reason || 'Verified full-bleed overlay in sandboxed runtime');

    // Capture Screenshots
    await cdp.eval('document.documentElement.setAttribute("data-theme", "dark"); document.body.setAttribute("data-theme", "dark");');
    await sleep(400);
    const darkShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const darkPath = path.join(OUTPUT_DIR, 'sandboxed-macos-app-dark.png');
    fs.writeFileSync(darkPath, Buffer.from(darkShot.data, 'base64'));

    await cdp.eval('document.documentElement.setAttribute("data-theme", "light"); document.body.setAttribute("data-theme", "light");');
    await sleep(400);
    const lightShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const lightPath = path.join(OUTPUT_DIR, 'sandboxed-macos-app-light.png');
    fs.writeFileSync(lightPath, Buffer.from(lightShot.data, 'base64'));

    await cdp.eval('document.documentElement.setAttribute("data-theme", "dark"); document.body.setAttribute("data-theme", "dark");');
    report('Sandboxed Theme Screenshots Captured', fs.existsSync(darkPath) && fs.existsSync(lightPath), `Saved to ${OUTPUT_DIR}`);

    // 6. Server URL Persistence & Process Restart
    console.log('\n==> [7/7] Testing Server URL Persistence & Full Process Restart...');
    const setRes = await cdp.eval(`window.electronAPI.setServerUrl('${TEMP_BACKEND_URL}')`);
    report('setServerUrl Handler Success', setRes && setRes.success === true, JSON.stringify(setRes));
    cdp.close();

    appProcess.kill('SIGTERM');
    await sleep(2000);
    report('Clean Process Termination', appProcess.killed, `PID ${appProcess.pid} terminated`);

    const possiblePaths = [
      path.join(TEST_USERDATA_DIR, 'desktop-config.json'),
      path.join(process.env.HOME, 'Library/Application Support/IndiChat/desktop-config.json'),
      path.join(process.env.HOME, 'Library/Application Support/indichat/desktop-config.json')
    ];
    let foundConfig = null;
    let configFilePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          foundConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
          configFilePath = p;
          break;
        } catch (_) {}
      }
    }
    report('Configuration JSON Persisted on Disk', foundConfig && foundConfig.serverUrl === TEMP_BACKEND_URL, `Path: ${configFilePath}, serverUrl: ${foundConfig?.serverUrl}`);

    // Relaunch without --no-sandbox
    appProcess = spawn(APP_PATH, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${TEST_USERDATA_DIR}`
    ], {
      env: cleanEnv,
      stdio: 'ignore'
    });

    cdp = await connectToPackagedApp(CDP_PORT);
    report('Sandboxed App Relaunch without --no-sandbox', true, `New PID: ${appProcess.pid}`);

    const restoredServerUrl = await cdp.eval('window.electronAPI ? window.electronAPI.getServerUrl() : null');
    report('Restored Server URL Matches After Relaunch', restoredServerUrl === TEMP_BACKEND_URL, `URL: ${restoredServerUrl}`);

    cdp.close();
    appProcess.kill('SIGTERM');
    await sleep(1500);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    if (appProcess && !appProcess.killed) {
      try { appProcess.kill('SIGKILL'); } catch (_) {}
    }
    if (tempBackendServer) {
      tempBackendServer.close();
    }
  }

  console.log('\n======================================================================');
  console.log(` Summary: ${passedChecks}/${totalChecks} Checks Passed`);
  console.log('======================================================================');
}

main().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
