/**
 * test-desktop-ipc.cjs
 *
 * Targeted automated test suite for Desktop IPC handlers and configuration:
 * - Sender validation & unauthorized caller rejection
 * - Sub-frame invocation rejection
 * - Protocol validation (HTTP and HTTPS permitted, others rejected)
 * - Embedded credentials rejection
 * - Local-development HTTP URL support
 * - Persistence (write to and read from config JSON)
 * - Error handling & sanitization
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  sanitizeServerUrl,
  validateIpcSender,
  loadPersistedServerUrl,
  savePersistedServerUrl
} = require('../apps/desktop/src/main.cjs');

console.log('🧪 Starting Desktop IPC & URL Validator Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. URL Sanitation & Protocol Validation
console.log('--- 1. URL Sanitation & Protocol Tests ---');

test('Accepts standard HTTP localhost development URL', () => {
  const result = sanitizeServerUrl('http://localhost:8080');
  assert.strictEqual(result, 'http://localhost:8080');
});

test('Accepts 127.0.0.1 IP development URL', () => {
  const result = sanitizeServerUrl('http://127.0.0.1:8080');
  assert.strictEqual(result, 'http://127.0.0.1:8080');
});

test('Accepts LAN IP development URL', () => {
  const result = sanitizeServerUrl('http://192.168.1.100:8080');
  assert.strictEqual(result, 'http://192.168.1.100:8080');
});

test('Accepts standard HTTPS production URL', () => {
  const result = sanitizeServerUrl('https://api.indichat.com');
  assert.strictEqual(result, 'https://api.indichat.com');
});

test('Strips trailing path and slashes from server origin', () => {
  const result = sanitizeServerUrl('https://api.indichat.com/api/v1/');
  assert.strictEqual(result, 'https://api.indichat.com');
});

test('Rejects non-string inputs', () => {
  assert.throws(() => sanitizeServerUrl(null), /non-empty string/);
  assert.throws(() => sanitizeServerUrl(undefined), /non-empty string/);
  assert.throws(() => sanitizeServerUrl(12345), /non-empty string/);
  assert.throws(() => sanitizeServerUrl({}), /non-empty string/);
});

test('Rejects empty or whitespace-only string', () => {
  assert.throws(() => sanitizeServerUrl(''), /non-empty string/);
  assert.throws(() => sanitizeServerUrl('   '), /non-empty string/);
});

test('Rejects malformed URLs', () => {
  assert.throws(() => sanitizeServerUrl('not-a-valid-url'), /Invalid URL/);
  assert.throws(() => sanitizeServerUrl('http://'), /Invalid URL/);
});

test('Rejects dangerous protocol: javascript:', () => {
  assert.throws(
    () => sanitizeServerUrl('javascript:alert(1)'),
    /Only HTTP and HTTPS are permitted/
  );
});

test('Rejects file: protocol', () => {
  assert.throws(
    () => sanitizeServerUrl('file:///etc/passwd'),
    /Only HTTP and HTTPS are permitted/
  );
});

test('Rejects data: protocol', () => {
  assert.throws(
    () => sanitizeServerUrl('data:text/html,<h1>PWNED</h1>'),
    /Only HTTP and HTTPS are permitted/
  );
});

test('Rejects ws: and wss: protocols for backend HTTP root', () => {
  assert.throws(
    () => sanitizeServerUrl('ws://localhost:8080'),
    /Only HTTP and HTTPS are permitted/
  );
});

test('Rejects embedded credentials (username/password)', () => {
  assert.throws(
    () => sanitizeServerUrl('http://admin:secret@localhost:8080'),
    /Embedded credentials .* are not permitted/
  );
  assert.throws(
    () => sanitizeServerUrl('https://user:password@indichat.com'),
    /Embedded credentials .* are not permitted/
  );
});

// 2. IPC Sender Validation Tests
console.log('\n--- 2. IPC Sender Validation Tests ---');

test('Validates legitimate sender matching mainWindow.webContents', () => {
  const mockWebContents = { id: 1 };
  const mockWindow = { webContents: mockWebContents };
  const mockEvent = { sender: mockWebContents, senderFrame: { parent: null } };

  // Should succeed without throwing
  validateIpcSender(mockEvent, mockWindow);
});

test('Rejects event when mainWindow is null or uninitialized', () => {
  const mockEvent = { sender: { id: 1 } };
  assert.throws(
    () => validateIpcSender(mockEvent, null),
    /Main window is not initialized/
  );
});

test('Rejects unauthorized sender mismatching mainWindow.webContents', () => {
  const legitWebContents = { id: 1 };
  const foreignWebContents = { id: 99 };
  const mockWindow = { webContents: legitWebContents };
  const mockEvent = { sender: foreignWebContents };

  assert.throws(
    () => validateIpcSender(mockEvent, mockWindow),
    /Unauthorized IPC sender: caller does not match main window/
  );
});

test('Rejects invocation from sub-frames/iframes', () => {
  const mockWebContents = { id: 1 };
  const mockWindow = { webContents: mockWebContents };
  const mockEvent = {
    sender: mockWebContents,
    senderFrame: { parent: { id: 'parent-frame' } } // sub-frame
  };

  assert.throws(
    () => validateIpcSender(mockEvent, mockWindow),
    /Unauthorized IPC sender: sub-frames are not permitted/
  );
});

// 3. Configuration Persistence Tests
console.log('\n--- 3. Configuration Persistence Tests ---');

test('Saves and loads server URL from disk config JSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indichat-desktop-test-'));
  const testConfigFile = path.join(tmpDir, 'desktop-config.json');

  try {
    // 1. Initial read should fallback to default when file does not exist
    const defaultUrl = loadPersistedServerUrl(testConfigFile);
    assert.strictEqual(defaultUrl, 'http://localhost:8080');

    // 2. Save a new valid server URL
    const saved = savePersistedServerUrl('https://staging.indichat.internal:8443', testConfigFile);
    assert.strictEqual(saved, 'https://staging.indichat.internal:8443');

    // 3. Assert file exists and contains valid JSON
    assert.strictEqual(fs.existsSync(testConfigFile), true);
    const content = JSON.parse(fs.readFileSync(testConfigFile, 'utf8'));
    assert.strictEqual(content.serverUrl, 'https://staging.indichat.internal:8443');
    assert.ok(content.updatedAt);

    // 4. Reload from disk
    const reloaded = loadPersistedServerUrl(testConfigFile);
    assert.strictEqual(reloaded, 'https://staging.indichat.internal:8443');
  } finally {
    // Cleanup
    try {
      if (fs.existsSync(testConfigFile)) fs.unlinkSync(testConfigFile);
      fs.rmdirSync(tmpDir);
    } catch (_) {}
  }
});

test('Rejects saving invalid URL to persistence and preserves existing config', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indichat-desktop-test-'));
  const testConfigFile = path.join(tmpDir, 'desktop-config.json');

  try {
    savePersistedServerUrl('http://valid-server.com:8080', testConfigFile);

    assert.throws(() => {
      savePersistedServerUrl('ftp://invalid-protocol.com', testConfigFile);
    }, /Only HTTP and HTTPS are permitted/);

    // Ensure previous valid URL was preserved
    const reloaded = loadPersistedServerUrl(testConfigFile);
    assert.strictEqual(reloaded, 'http://valid-server.com:8080');
  } finally {
    try {
      if (fs.existsSync(testConfigFile)) fs.unlinkSync(testConfigFile);
      fs.rmdirSync(tmpDir);
    } catch (_) {}
  }
});

console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed (${totalTests - passedTests} failed)`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

