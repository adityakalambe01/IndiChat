/**
 * scripts/test_auth_recovery.mjs
 *
 * Comprehensive regression tests for Authentication Recovery & WebSocket Session Governance.
 *
 * Verifies three distinct layers:
 *  1. Backend Endpoint Tests (Direct REST API contract verification)
 *  2. Live Backend Integration Evidence (Direct WebSocket handshake rejection & live token refresh against Spring Boot)
 *  3. Production WebSocketClient Tests (Executing production WebSocketClient from apps/mobile/services/websocket.ts
 *     with injected transport, storage, API, and timer mocks to verify state machine correctness without duplicated logic)
 *
 * Key Invariants Tested:
 *  - Authentication rejection (1008) triggers refresh, stores returned tokens, and reconnects using new token.
 *  - Invalid/revoked refresh credentials terminate the session and notify the application.
 *  - Actual reconnect scheduling stops at the configured limit (MAX_RECONNECT_ATTEMPTS = 5).
 *  - Logout during an in-flight refresh prevents token writes and socket resurrection.
 *  - Late events from an old socket cannot disrupt a newer connection.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import http from 'http';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

// Register TypeScript / external mock loader
register(pathToFileURL(path.resolve('scripts/test-resolver.mjs')));

// Import actual production WebSocketClient and Storage keys
const { WebSocketClient } = await import('../apps/mobile/services/websocket.ts');
const { STORAGE_KEYS } = await import('../apps/mobile/services/storage.ts');

// ============================================================================
// 1. HTTP Helpers for Direct Backend Testing
// ============================================================================

async function loginUser(username, password) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve(JSON.parse(body)));
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify({ username, password }));
    req.end();
  });
}

async function refreshTokensViaBackend(refreshToken) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/api/v1/auth/refresh',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify({ refreshToken }));
    req.end();
  });
}

// ============================================================================
// 2. Mocks for External Dependencies (Transport, Storage, API)
// ============================================================================

class MockStorage {
  constructor(initial = {}) {
    this.store = new Map(Object.entries(initial));
    this.writes = [];
  }

  async getItem(key) {
    return this.store.get(key) || null;
  }

  async setItem(key, val) {
    this.store.set(key, val);
    this.writes.push({ key, val, timestamp: Date.now() });
  }

  async removeItem(key) {
    this.store.delete(key);
  }
}

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sentMessages = [];
    this.closeCalls = [];
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = '') {
    this.readyState = 3; // CLOSED
    this.closeCalls.push({ code, reason });
  }

  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) this.onopen();
  }

  simulateClose(code, reason = '') {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason });
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }

  simulateError(err = new Error('Socket error')) {
    if (this.onerror) this.onerror(err);
  }
}

class MockApi {
  constructor() {
    this.refreshCalls = [];
    this.refreshHandler = null;
  }

  async refreshTokens(refreshToken) {
    this.refreshCalls.push(refreshToken);
    if (this.refreshHandler) {
      return this.refreshHandler(refreshToken);
    }
    return {
      accessToken: `refreshed-access-for-${refreshToken}`,
      refreshToken: `refreshed-refresh-for-${refreshToken}`,
    };
  }
}

// ============================================================================
// LAYER 1: BACKEND ENDPOINT TESTS (DIRECT REST API)
// ============================================================================

test('Layer 1 (Backend Endpoint): /api/v1/auth/refresh returns fresh tokens with a valid refresh token', async () => {
  const loginRes = await loginUser('charlie', 'Password123!');
  const initialRefresh = loginRes?.tokens?.refreshToken;
  assert.ok(initialRefresh, 'Login must yield a valid refreshToken');

  const refreshed = await refreshTokensViaBackend(initialRefresh);
  assert.ok(refreshed.accessToken, 'Backend must return new accessToken');
  assert.ok(refreshed.refreshToken, 'Backend must return new refreshToken');
  assert.notEqual(
    refreshed.accessToken,
    loginRes.tokens.accessToken,
    'Refreshed access token must differ from old token'
  );
});

test('Layer 1 (Backend Endpoint): /api/v1/auth/refresh rejects invalid or forged refresh tokens', async () => {
  await assert.rejects(
    async () => {
      await refreshTokensViaBackend('invalid.forged.refresh-token');
    },
    (err) => {
      assert.match(err.message, /HTTP 401/);
      return true;
    }
  );
});

// Helper to generate a genuinely expired, HMAC-SHA512 signed JWT using backend's secret key
const BACKEND_JWT_SECRET = '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

function createGenuinelyExpiredSignedToken(userId = '1eadb7cd-88cc-4e96-ab36-228013736f35', username = 'charlie', displayName = 'Charlie Davis') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    jti: crypto.randomUUID(),
    sub: userId,
    username,
    displayName,
    iat: nowSec - 7200, // issued 2 hours ago
    exp: nowSec - 3600, // expired 1 hour ago
  })).toString('base64url');
  const sig = crypto.createHmac('sha512', Buffer.from(BACKEND_JWT_SECRET, 'utf8'))
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// ============================================================================
// LAYER 2: LIVE BACKEND INTEGRATION EVIDENCE (REAL WEBSOCKET & TOMCAT)
// ============================================================================

test('Layer 2 (Live Integration): Backend directly rejects malformed/invalid token with close code 1008 (Policy Violation)', async () => {
  // Verifies live Tomcat/Spring Boot handler rejects malformed token with code 1008
  const closeEvent = await new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8080/ws?token=invalid.malformed.jwt.token');
    ws.onclose = (e) => resolve(e);
    ws.onerror = (e) => reject(e);
    setTimeout(() => reject(new Error('Live WebSocket timeout')), 5000);
  });

  assert.equal(closeEvent.code, 1008, 'Backend must emit WebSocket close code 1008 on malformed token');
});

test('Layer 2 (Live Integration): Backend directly rejects genuinely expired signed token with close code 1008 (Policy Violation)', async () => {
  // Proves genuine expired-token rejection: valid HMAC-SHA512 signature, but exp is in the past
  const expiredSignedToken = createGenuinelyExpiredSignedToken();
  const closeEvent = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${expiredSignedToken}`);
    ws.onclose = (e) => resolve(e);
    ws.onerror = (e) => reject(e);
    setTimeout(() => reject(new Error('Live WebSocket timeout')), 5000);
  });

  assert.equal(closeEvent.code, 1008, 'Backend must emit WebSocket close code 1008 on genuinely expired signed token');
});

test('Layer 2 (Live Integration): Production WebSocketClient invalid-token rejection and automatic recovery', async () => {
  const loginRes = await loginUser('charlie', 'Password123!');
  const genuineRefreshToken = loginRes?.tokens?.refreshToken;
  assert.ok(genuineRefreshToken, 'Must have valid refresh token from backend');

  const liveStorage = new MockStorage({
    [STORAGE_KEYS.ACCESS_TOKEN]: 'invalid.malformed.token.for.recovery.test',
    [STORAGE_KEYS.REFRESH_TOKEN]: genuineRefreshToken,
  });

  const liveClient = new WebSocketClient({
    storage: liveStorage,
    api: { refreshTokens: refreshTokensViaBackend },
    getApiBaseUrl: async () => 'http://localhost:8080',
    getDeviceId: async () => 'test-device-uuid-001',
    WebSocketClass: WebSocket,
  });

  let reconnectedWithFreshTokenResolve;
  const reconnectedWithFreshToken = new Promise((resolve) => {
    reconnectedWithFreshTokenResolve = resolve;
  });

  let tokenRefreshed = false;
  const originalSetItem = liveStorage.setItem.bind(liveStorage);
  liveStorage.setItem = async (key, val) => {
    await originalSetItem(key, val);
    if (key === STORAGE_KEYS.ACCESS_TOKEN && val !== 'invalid.malformed.token.for.recovery.test') {
      tokenRefreshed = true;
    }
  };

  liveClient.onConnectionStatus((isConnected) => {
    if (isConnected && tokenRefreshed) {
      reconnectedWithFreshTokenResolve(true);
    }
  });

  // Start with invalid/malformed token
  await liveClient.connect('invalid.malformed.token.for.recovery.test');

  // Await full recovery cycle: connect(invalid) -> backend emits 1008 -> client refreshes -> connect(new)
  const connected = await Promise.race([
    reconnectedWithFreshToken,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Live recovery timeout')), 10000)),
  ]);

  assert.equal(connected, true, 'Live client must successfully recover and connect to backend after invalid token');
  assert.notEqual(
    liveStorage.store.get(STORAGE_KEYS.ACCESS_TOKEN),
    'invalid.malformed.token.for.recovery.test',
    'Storage must contain the new access token refreshed from backend'
  );

  liveClient.disconnect();
});

test('Layer 2 (Live Integration): Production WebSocketClient genuinely expired token rejection and automatic recovery', async () => {
  const loginRes = await loginUser('charlie', 'Password123!');
  const genuineRefreshToken = loginRes?.tokens?.refreshToken;
  assert.ok(genuineRefreshToken, 'Must have valid refresh token from backend');

  const genuinelyExpiredToken = createGenuinelyExpiredSignedToken();

  const liveStorage = new MockStorage({
    [STORAGE_KEYS.ACCESS_TOKEN]: genuinelyExpiredToken,
    [STORAGE_KEYS.REFRESH_TOKEN]: genuineRefreshToken,
  });

  const liveClient = new WebSocketClient({
    storage: liveStorage,
    api: { refreshTokens: refreshTokensViaBackend },
    getApiBaseUrl: async () => 'http://localhost:8080',
    getDeviceId: async () => 'test-device-uuid-002',
    WebSocketClass: WebSocket,
  });

  let reconnectedWithFreshTokenResolve;
  const reconnectedWithFreshToken = new Promise((resolve) => {
    reconnectedWithFreshTokenResolve = resolve;
  });

  let tokenRefreshed = false;
  const originalSetItem = liveStorage.setItem.bind(liveStorage);
  liveStorage.setItem = async (key, val) => {
    await originalSetItem(key, val);
    if (key === STORAGE_KEYS.ACCESS_TOKEN && val !== genuinelyExpiredToken) {
      tokenRefreshed = true;
    }
  };

  liveClient.onConnectionStatus((isConnected) => {
    if (isConnected && tokenRefreshed) {
      reconnectedWithFreshTokenResolve(true);
    }
  });

  // Start with genuinely expired signed token
  await liveClient.connect(genuinelyExpiredToken);

  // Await recovery cycle: connect(expired) -> backend throws ExpiredJwtException & closes 1008 -> client refreshes -> connect(new)
  const connected = await Promise.race([
    reconnectedWithFreshToken,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Live recovery timeout')), 10000)),
  ]);

  assert.equal(connected, true, 'Live client must successfully recover and connect to backend after genuinely expired token');
  assert.notEqual(
    liveStorage.store.get(STORAGE_KEYS.ACCESS_TOKEN),
    genuinelyExpiredToken,
    'Storage must contain the fresh access token rotated via /api/v1/auth/refresh'
  );

  liveClient.disconnect();
});

// ============================================================================
// LAYER 3: PRODUCTION WEBSOCKET CLIENT TESTS (INJECTED MOCKS, NO DUPLICATION)
// ============================================================================

test('Layer 3 (Production Client): 1. Authentication rejection triggers refresh, stores returned tokens, and reconnects', async () => {
  MockWebSocket.instances = [];
  const mockStorage = new MockStorage({
    [STORAGE_KEYS.ACCESS_TOKEN]: 'expired.alpha',
    [STORAGE_KEYS.REFRESH_TOKEN]: 'valid.refresh.token',
  });
  const mockApi = new MockApi();
  let sessionExpiredCalled = false;

  const client = new WebSocketClient({
    storage: mockStorage,
    api: mockApi,
    notifySessionExpired: () => { sessionExpiredCalled = true; },
    getApiBaseUrl: async () => 'http://localhost:8080',
    getDeviceId: async () => 'device-test-1',
    WebSocketClass: MockWebSocket,
  });

  await client.connect('expired.alpha');
  assert.equal(MockWebSocket.instances.length, 1, 'First socket instance created');
  const socket1 = MockWebSocket.instances[0];
  assert.ok(socket1.url.includes('token=expired.alpha'));

  // Simulate authentication rejection from server (code 1008)
  socket1.simulateClose(1008, 'Policy Violation');

  // Let asynchronous handleUnauthorizedClose execute
  await new Promise((r) => setImmediate(r));

  assert.equal(mockApi.refreshCalls.length, 1, 'api.refreshTokens must be invoked once');
  assert.equal(mockApi.refreshCalls[0], 'valid.refresh.token');

  assert.equal(
    mockStorage.store.get(STORAGE_KEYS.ACCESS_TOKEN),
    'refreshed-access-for-valid.refresh.token',
    'Storage must store new access token'
  );
  assert.equal(
    mockStorage.store.get(STORAGE_KEYS.REFRESH_TOKEN),
    'refreshed-refresh-for-valid.refresh.token',
    'Storage must store new refresh token'
  );

  assert.equal(MockWebSocket.instances.length, 2, 'Second socket instance must be created for reconnection');
  const socket2 = MockWebSocket.instances[1];
  assert.ok(
    socket2.url.includes('token=refreshed-access-for-valid.refresh.token'),
    'Second socket must connect with the refreshed access token'
  );
  assert.equal(client.getReconnectAttempts(), 0, 'Reconnect attempts must reset to 0');
  assert.equal(sessionExpiredCalled, false, 'notifySessionExpired must not be called');
});

test('Layer 3 (Production Client): 2. Invalid/revoked refresh credentials terminate the session and notify application', async () => {
  MockWebSocket.instances = [];
  const mockStorage = new MockStorage({
    [STORAGE_KEYS.ACCESS_TOKEN]: 'expired.token',
    [STORAGE_KEYS.REFRESH_TOKEN]: 'revoked.refresh.token',
  });
  const mockApi = new MockApi();
  mockApi.refreshHandler = async () => {
    throw new Error('HTTP 401: Refresh token revoked');
  };

  let sessionExpiredReason = null;
  const client = new WebSocketClient({
    storage: mockStorage,
    api: mockApi,
    notifySessionExpired: (reason) => { sessionExpiredReason = reason; },
    getApiBaseUrl: async () => 'http://localhost:8080',
    getDeviceId: async () => 'device-test-2',
    WebSocketClass: MockWebSocket,
  });

  await client.connect('expired.token');
  const socket1 = MockWebSocket.instances[0];

  // Server rejects handshake
  socket1.simulateClose(1008, 'Policy Violation');
  await new Promise((r) => setImmediate(r));

  assert.equal(client.isClosed(), true, 'Client must mark itself closed');
  assert.equal(
    sessionExpiredReason,
    'Session expired. Please log in again.',
    'Application must be notified of session expiration'
  );
  assert.equal(client.hasScheduledReconnect(), false, 'No reconnect must be scheduled on revoked token');
  assert.equal(MockWebSocket.instances.length, 1, 'No second socket should be created');
});

test('Layer 3 (Production Client): 3. Actual reconnect scheduling stops at configured limit', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  MockWebSocket.instances = [];

  const mockStorage = new MockStorage();
  const mockApi = new MockApi();

  const client = new WebSocketClient({
    storage: mockStorage,
    api: mockApi,
    getApiBaseUrl: async () => 'http://localhost:8080',
    getDeviceId: async () => 'device-test-3',
    WebSocketClass: MockWebSocket,
  });

  await client.connect('steady.valid.token');
  assert.equal(client.getMaxReconnectAttempts(), 5);

  // Consecutive network drops: attempts 1 to 5
  for (let attempt = 1; attempt <= 5; attempt++) {
    const currentSocket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    currentSocket.simulateClose(1006, 'Abnormal Closure');

    assert.equal(client.getReconnectAttempts(), attempt, `Attempt should increment to ${attempt}`);
    assert.equal(client.hasScheduledReconnect(), true, 'Reconnect timeout must be scheduled');

    // Advance fake timer to trigger the reconnect callback
    t.mock.timers.tick(10000);
    await new Promise((r) => setImmediate(r));
  }

  // Attempt 6: Should exceed MAX_RECONNECT_ATTEMPTS (5) and stop
  const lastSocket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  lastSocket.simulateClose(1006, 'Abnormal Closure');

  assert.equal(client.getReconnectAttempts(), 5, 'Reconnect attempts must remain capped at 5');
  assert.equal(client.hasScheduledReconnect(), false, 'Reconnect timer must NOT be scheduled beyond max attempts');

  // Advance time significantly — no further sockets should be created
  t.mock.timers.tick(60000);
  await new Promise((r) => setImmediate(r));

  assert.equal(
    MockWebSocket.instances.length,
    6, // 1 initial + 5 reconnects = 6 total
    'No additional socket connections should be created after reaching limit'
  );

  t.mock.timers.reset();
});

test('Layer 3 (Production Client): 4. Logout during in-flight refresh prevents token writes and socket resurrection', async () => {
  MockWebSocket.instances = [];
  const mockStorage = new MockStorage({
    [STORAGE_KEYS.ACCESS_TOKEN]: 'expired.old.token',
    [STORAGE_KEYS.REFRESH_TOKEN]: 'valid.refresh.token',
  });

  let resolveRefresh;
  const refreshPromise = new Promise((res) => { resolveRefresh = res; });
  const mockApi = new MockApi();
  mockApi.refreshHandler = () => refreshPromise;

  let sessionExpiredCalled = false;
  const client = new WebSocketClient({
    storage: mockStorage,
    api: mockApi,
    notifySessionExpired: () => { sessionExpiredCalled = true; },
    getApiBaseUrl: async () => 'http://localhost:8080',
    getDeviceId: async () => 'device-test-4',
    WebSocketClass: MockWebSocket,
  });

  await client.connect('expired.old.token');
  const socket1 = MockWebSocket.instances[0];

  // Handshake rejected, starting in-flight refresh
  socket1.simulateClose(1008, 'Policy Violation');
  await new Promise((r) => setImmediate(r));
  assert.equal(mockApi.refreshCalls.length, 1, 'Refresh is in-flight');

  // User intentionally logs out while refresh request is in flight
  client.disconnect();
  assert.equal(client.isClosed(), true, 'Client marked closed');

  // The in-flight refresh resolves post-logout
  resolveRefresh({
    accessToken: 'unwanted.resurrected.access.token',
    refreshToken: 'unwanted.resurrected.refresh.token',
  });
  await new Promise((r) => setImmediate(r));

  // Assertions: storage must NOT be overwritten, and no new socket resurrected
  assert.equal(
    mockStorage.store.get(STORAGE_KEYS.ACCESS_TOKEN),
    'expired.old.token',
    'Access token must NOT be overwritten after intentional logout'
  );
  assert.equal(
    mockStorage.store.get(STORAGE_KEYS.REFRESH_TOKEN),
    'valid.refresh.token',
    'Refresh token must NOT be overwritten after intentional logout'
  );
  assert.equal(
    MockWebSocket.instances.length,
    1,
    'No second socket should be created/resurrected after logout'
  );
  assert.equal(
    sessionExpiredCalled,
    false,
    'notifySessionExpired must NOT be called on intentional logout'
  );
});

test('Layer 3 (Production Client): 5. Late events from an old socket cannot disrupt a newer connection', async () => {
  MockWebSocket.instances = [];
  const mockStorage = new MockStorage();
  const mockApi = new MockApi();

  const client = new WebSocketClient({
    storage: mockStorage,
    api: mockApi,
    getApiBaseUrl: async () => 'http://localhost:8080',
    getDeviceId: async () => 'device-test-5',
    WebSocketClass: MockWebSocket,
  });

  // Connect socket 1
  await client.connect('token.generation.1');
  const socket1 = MockWebSocket.instances[0];
  socket1.simulateOpen();

  // Reconnect with new socket 2
  await client.connect('token.generation.2');
  const socket2 = MockWebSocket.instances[1];
  socket2.simulateOpen();

  const statusChanges = [];
  client.onConnectionStatus((connected) => statusChanges.push(connected));

  const receivedMessages = [];
  client.onMessageCreated((msg) => receivedMessages.push(msg));

  // Late events arrive on discarded socket 1
  socket1.simulateMessage({
    type: 'message.created',
    payload: { id: 'stale-msg-from-socket-1', content: 'Ghost message' },
  });
  socket1.simulateError(new Error('Late network glitch on socket 1'));
  socket1.simulateClose(1006, 'Socket 1 terminated');

  // Assert that late events from socket 1 were completely ignored
  assert.equal(receivedMessages.length, 0, 'Late messages from old socket must be ignored');
  assert.equal(
    statusChanges.filter((s) => s === false).length,
    0,
    'Late close/error on old socket must NOT drop connection status for active socket'
  );
  assert.equal(client.isConnected(), true, 'Active socket 2 must remain connected');
  assert.equal(client.hasScheduledReconnect(), false, 'Old socket close must NOT trigger reconnect for socket 2');

  // Verify socket 2 is fully operational
  socket2.simulateMessage({
    type: 'message.created',
    payload: { id: 'live-msg-from-socket-2', content: 'Live message' },
  });
  assert.equal(receivedMessages.length, 1, 'Active socket messages must be received');
  assert.equal(receivedMessages[0].id, 'live-msg-from-socket-2');
});
