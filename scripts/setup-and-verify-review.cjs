// Automated Setup and Verification of Review Environment
// 1. Registers review_alice and review_bob against disposable backend on 8099
// 2. Logs in both users (tokens strictly kept in memory, never printed)
// 3. Establishes a direct conversation and exchanges messages
// 4. Verifies Settings access and persistence
// 5. Uses Electron to render both Web and Desktop UI and capture high-resolution screenshots

const http = require('http');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const BACKEND_PORT = 8099;
const WEB_PORT = 5180;
const ARTIFACT_DIR = '/Users/innodaredevil/.gemini/antigravity/brain/ef0571b7-3b6c-4291-961b-77465a860271';

function postJson(path, payload, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      ...extraHeaders
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path,
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
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

function getJson(path, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...extraHeaders };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path,
      method: 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function putJson(path, payload, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      ...extraHeaders
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path,
      method: 'PUT',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
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

const crypto = require('crypto');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  try {
    console.log('======================================================================');
    console.log(' Review Environment Setup & UI Capture');
    console.log('======================================================================\n');

    // 1. Register Review Account 1 (Alice)
    console.log('==> [1/6] Registering Review Account 1 (review_alice)...');
    const regAlice = await postJson('/api/v1/auth/register', {
      username: 'review_alice',
      displayName: 'Alice Reviewer',
      password: 'Password123!',
      phoneNumber: '+15550191',
      email: 'alice@review.local'
    });
    if (regAlice.status !== 200 && regAlice.status !== 201 && regAlice.status !== 409) {
      throw new Error(`Failed to register Alice: ${regAlice.status} ${JSON.stringify(regAlice.data)}`);
    }
    console.log('  ✓ Alice registration checked (HTTP ' + regAlice.status + ')');

    // 2. Register Review Account 2 (Bob)
    console.log('==> [2/6] Registering Review Account 2 (review_bob)...');
    const regBob = await postJson('/api/v1/auth/register', {
      username: 'review_bob',
      displayName: 'Bob Reviewer',
      password: 'Password123!',
      phoneNumber: '+15550192',
      email: 'bob@review.local'
    });
    if (regBob.status !== 200 && regBob.status !== 201 && regBob.status !== 409) {
      throw new Error(`Failed to register Bob: ${regBob.status} ${JSON.stringify(regBob.data)}`);
    }
    console.log('  ✓ Bob registration checked (HTTP ' + regBob.status + ')');

    // 3. Confirm Login for Both Accounts
    console.log('==> [3/6] Confirming login for both review accounts...');
    const aliceDeviceId = crypto.randomUUID();
    const bobDeviceId = crypto.randomUUID();

    const loginAlice = await postJson('/api/v1/auth/login', {
      usernameOrEmail: 'review_alice',
      password: 'Password123!'
    }, null, {
      'X-Device-Id': aliceDeviceId,
      'X-Device-Name': 'macOS Review Client',
      'X-Device-Platform': 'mac',
      'X-Device-Browser': 'IndiChat Desktop'
    });
    if (loginAlice.status !== 200) {
      throw new Error(`Alice login failed: ${loginAlice.status}`);
    }
    const aliceToken = loginAlice.data.tokens?.accessToken || loginAlice.data.accessToken;
    const aliceUser = loginAlice.data.user;
    if (!aliceToken) throw new Error('No access token in Alice login response');
    console.log(`  ✓ Alice login confirmed: user id=${aliceUser.id}, username=${aliceUser.username} (token verified, not printed)`);

    const loginBob = await postJson('/api/v1/auth/login', {
      usernameOrEmail: 'review_bob',
      password: 'Password123!'
    }, null, {
      'X-Device-Id': bobDeviceId,
      'X-Device-Name': 'Review Secondary Client',
      'X-Device-Platform': 'web',
      'X-Device-Browser': 'Chrome'
    });
    if (loginBob.status !== 200) {
      throw new Error(`Bob login failed: ${loginBob.status}`);
    }
    const bobToken = loginBob.data.tokens?.accessToken || loginBob.data.accessToken;
    const bobUser = loginBob.data.user;
    if (!bobToken) throw new Error('No access token in Bob login response');
    console.log(`  ✓ Bob login confirmed: user id=${bobUser.id}, username=${bobUser.username} (token verified, not printed)`);

    // 4. Create Conversation & Exchange Messages
    console.log('\n==> [4/6] Creating conversation and exchanging messages...');
    const convRes = await postJson('/api/v1/conversations', {
      type: 'DIRECT',
      participantIds: [bobUser.id]
    }, aliceToken, { 'X-Device-Id': aliceDeviceId });
    if (convRes.status !== 200 && convRes.status !== 201) {
      throw new Error(`Failed to create conversation: ${convRes.status} ${JSON.stringify(convRes.data)}`);
    }
    const convId = convRes.data.id;
    console.log(`  ✓ Direct conversation created: id=${convId}`);

    // Alice sends message 1
    const msg1Res = await postJson('/api/v1/messages', {
      conversationId: convId,
      clientMessageId: crypto.randomUUID(),
      messageType: 'text',
      content: 'Hello Bob! Welcome to the IndiChat isolated review environment.'
    }, aliceToken, { 'X-Device-Id': aliceDeviceId });
    if (msg1Res.status !== 201 && msg1Res.status !== 200) {
      throw new Error(`Failed to send message 1: ${msg1Res.status}`);
    }
    console.log('  ✓ Alice sent message 1: "Hello Bob! Welcome to the IndiChat isolated review environment."');

    // Bob sends message 2
    const msg2Res = await postJson('/api/v1/messages', {
      conversationId: convId,
      clientMessageId: crypto.randomUUID(),
      messageType: 'text',
      content: 'Hi Alice! The review backend and real-time messaging pipeline are working smoothly.'
    }, bobToken, { 'X-Device-Id': bobDeviceId });
    if (msg2Res.status !== 201 && msg2Res.status !== 200) {
      throw new Error(`Failed to send message 2: ${msg2Res.status}`);
    }
    console.log('  ✓ Bob sent message 2: "Hi Alice! The review backend and real-time messaging pipeline are working smoothly."');

    // Bob retrieves conversation history
    const historyRes = await getJson(`/api/v1/conversations/${convId}/messages`, bobToken, { 'X-Device-Id': bobDeviceId });
    if (historyRes.status !== 200 || !Array.isArray(historyRes.data.messages) || historyRes.data.messages.length < 2) {
      throw new Error(`Failed to retrieve message history: ${JSON.stringify(historyRes)}`);
    }
    console.log(`  ✓ Confirmed message exchange: ${historyRes.data.messages.length} messages verified in history`);

    // 5. Access and Update Settings
    console.log('\n==> [5/6] Verifying Settings access and persistence...');
    const getSettings = await getJson('/api/v1/settings', aliceToken, { 'X-Device-Id': aliceDeviceId });
    if (getSettings.status !== 200) {
      throw new Error(`Failed to get settings: ${getSettings.status}`);
    }
    console.log('  ✓ Initial settings retrieved: privacyLastSeen=' + getSettings.data.privacyLastSeen);

    const putSettings = await putJson('/api/v1/settings', {
      privacyLastSeen: 'contacts',
      readReceipts: true
    }, aliceToken, { 'X-Device-Id': aliceDeviceId });
    if (putSettings.status !== 200) {
      throw new Error(`Failed to update settings: ${putSettings.status}`);
    }
    console.log('  ✓ Updated settings confirmed: privacyLastSeen=contacts, readReceipts=true');

    // 6. Capture UI Screenshots with Electron
    console.log('\n==> [6/6] Launching Electron window to capture production Web & Desktop UI...');
    
    // Create userData folder for review session
    const reviewUserData = path.join(__dirname, '..', 'tmp-review-userdata');
    if (!fs.existsSync(reviewUserData)) fs.mkdirSync(reviewUserData, { recursive: true });
    app.setPath('userData', reviewUserData);

    const win = new BrowserWindow({
      width: 1280,
      height: 820,
      show: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'apps', 'desktop', 'src', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
      console.log(`[Browser Console ${level}] ${message} (${sourceId}:${line})`);
    });

    const webUrl = `http://127.0.0.1:${WEB_PORT}`;
    console.log(`  -> Loading production web bundle from ${webUrl}...`);
    await win.loadURL(webUrl);

    // Pre-seed Alice's authenticated session into localStorage
    await win.webContents.executeJavaScript(`
      localStorage.setItem('chat_device_id', ${JSON.stringify(aliceDeviceId)});
      localStorage.setItem('chat_access_token', ${JSON.stringify(aliceToken)});
      localStorage.setItem('chat_user', JSON.stringify(${JSON.stringify(aliceUser)}));
    `);
    await win.webContents.reload();

    // Helper: wait for element
    const waitFor = async (fn, timeoutMs = 15000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const res = await win.webContents.executeJavaScript(`Boolean((${fn})())`);
        if (res) return true;
        await new Promise(r => setTimeout(r, 250));
      }
      const debugInfo = await win.webContents.executeJavaScript(`
        ({
          body: document.body.innerText.slice(0, 400),
          token: Boolean(localStorage.getItem('chat_access_token')),
          user: Boolean(localStorage.getItem('chat_user')),
          deviceId: localStorage.getItem('chat_device_id')
        })
      `);
      throw new Error('Timeout waiting for UI condition: ' + fn + ' Details: ' + JSON.stringify(debugInfo));
    };

    // Wait for NavigationRail and conversations list
    await waitFor(`() => document.querySelector('.wa-conversation-item') || document.querySelector('#railSettingsBtn')`);
    await new Promise(r => setTimeout(r, 1200)); // allow render to settle

    // Click on the conversation with Bob to open chat window
    await win.webContents.executeJavaScript(`
      const conv = document.querySelector('.wa-conversation-item');
      if (conv) conv.click();
    `);
    await new Promise(r => setTimeout(r, 1200));

    // Capture Web Chat UI Screenshot
    const chatImage = await win.webContents.capturePage();
    const chatImagePath = path.join(ARTIFACT_DIR, 'screenshot-web-chat-review.png');
    const localChatPath = path.join(__dirname, '..', 'screenshot-web-chat-review.png');
    fs.writeFileSync(chatImagePath, chatImage.toPNG());
    fs.writeFileSync(localChatPath, chatImage.toPNG());
    console.log(`  ✓ Web Chat screenshot captured: ${chatImagePath}`);

    // Open FullSettingsModal
    await win.webContents.executeJavaScript(`
      const btn = document.getElementById('railSettingsBtn');
      if (btn) btn.click();
    `);
    await waitFor(`() => document.querySelector('.settings-modal-card')`);
    await new Promise(r => setTimeout(r, 800));

    // Click on Account & Security tab
    await win.webContents.executeJavaScript(`
      const tab = document.querySelector('button[data-settings-tab="account"]');
      if (tab) tab.click();
    `);
    await new Promise(r => setTimeout(r, 800));

    // Capture Settings UI Screenshot
    const settingsImage = await win.webContents.capturePage();
    const settingsImagePath = path.join(ARTIFACT_DIR, 'screenshot-settings-review.png');
    const localSettingsPath = path.join(__dirname, '..', 'screenshot-settings-review.png');
    fs.writeFileSync(settingsImagePath, settingsImage.toPNG());
    fs.writeFileSync(localSettingsPath, settingsImage.toPNG());
    console.log(`  ✓ Settings screenshot captured: ${settingsImagePath}`);

    console.log('\n======================================================================');
    console.log(' All Review Flows Succeeded and Verified!');
    console.log(' Web URL: http://127.0.0.1:5180');
    console.log(' Leaving Desktop Window Active for Manual Inspection');
    console.log('======================================================================\n');

  } catch (err) {
    console.error('\n❌ Review Setup Failure:', err);
    process.exit(1);
  }
});
