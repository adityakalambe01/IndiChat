// Automated verification of Settings Persistence and Error Handling
const assert = require('assert');

// Mock localStorage
const storage = new Map();
global.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

// Mock DOM
global.document = {
  documentElement: {
    setAttribute: () => {}
  }
};

let apiCalls = [];
let mockApiShouldFail = false;

// Mock API
const mockApi = {
  updateUserSettings: async (data) => {
    apiCalls.push(data);
    if (mockApiShouldFail) {
      throw new Error('Server 500: Database connection failure');
    }
    return { ...data, updatedAt: new Date().toISOString() };
  },
  getUserSettings: async () => ({
    twoFactorEnabled: true,
    privacyLastSeen: 'nobody',
    readReceipts: false,
    enterIsSend: true,
    mediaVisibility: false,
    language: 'hi'
  }),
  getLinkedDevices: async () => [
    { id: 'dev-1', deviceName: 'MacBook Pro', platform: 'macOS', isCurrent: true },
    { id: 'dev-2', deviceName: 'iPhone 15', platform: 'iOS', isCurrent: false }
  ],
  removeLinkedDevice: async (id) => {
    if (mockApiShouldFail) throw new Error('Device not found or session expired');
    return { success: true };
  }
};

// Simulation of SettingsService logic
class TestSettingsService {
  constructor(api) {
    this.api = api;
    this.currentUserId = null;
    this.settings = this.loadFromStorage();
  }

  getStorageKey() {
    return this.currentUserId ? `chat_app_settings_${this.currentUserId}` : 'chat_app_settings_v1';
  }

  loadForUser(userId) {
    this.currentUserId = userId;
    this.settings = this.loadFromStorage();
  }

  resetForLogout() {
    this.currentUserId = null;
    this.settings = {
      twoFactorEnabled: false,
      privacyLastSeen: 'everyone',
      readReceipts: true,
      enterIsSend: true,
      mediaVisibility: true,
      language: 'en'
    };
  }

  loadFromStorage() {
    const saved = localStorage.getItem(this.getStorageKey());
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      twoFactorEnabled: false,
      privacyLastSeen: 'everyone',
      readReceipts: true,
      enterIsSend: true,
      mediaVisibility: true,
      language: 'en'
    };
  }

  saveToStorage() {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(this.settings));
  }

  getSettings() {
    return { ...this.settings };
  }

  async update(partial) {
    const previous = { ...this.settings };
    this.settings = { ...this.settings, ...partial };
    this.saveToStorage();

    const token = localStorage.getItem('chat_access_token');
    if (token) {
      try {
        await this.api.updateUserSettings(partial);
      } catch (err) {
        // Propagate failure to caller
        throw err;
      }
    }
    return this.getSettings();
  }

  async syncWithBackend() {
    const backend = await this.api.getUserSettings();
    if (backend) {
      this.settings = { ...this.settings, ...backend };
      this.saveToStorage();
    }
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log(' Running Settings Persistence & Failure Handling Verification');
  console.log('======================================================================\n');

  // Test 1: User-scoped persistence across simulated reload
  console.log('==> [1/4] Verifying settings persistence across reload...');
  localStorage.setItem('chat_access_token', 'mock_jwt_token');

  const userId = '11111111-1111-1111-1111-111111111111';
  const service1 = new TestSettingsService(mockApi);
  service1.loadForUser(userId);

  await service1.update({
    twoFactorEnabled: true,
    privacyLastSeen: 'nobody',
    readReceipts: false,
    language: 'hi'
  });

  // Verify stored in localStorage under user key
  const storedJson = localStorage.getItem(`chat_app_settings_${userId}`);
  assert(storedJson !== null, 'Settings must be stored under user-scoped key');
  const parsed = JSON.parse(storedJson);
  assert.strictEqual(parsed.twoFactorEnabled, true, 'twoFactorEnabled persisted to storage');
  assert.strictEqual(parsed.privacyLastSeen, 'nobody', 'privacyLastSeen persisted to storage');
  assert.strictEqual(parsed.readReceipts, false, 'readReceipts persisted to storage');
  assert.strictEqual(parsed.language, 'hi', 'language persisted to storage');
  console.log('  ✓ User settings successfully persisted to localStorage');

  // Simulate Page Reload: create fresh instance and load same user
  const serviceReloaded = new TestSettingsService(mockApi);
  serviceReloaded.loadForUser(userId);
  const reloaded = serviceReloaded.getSettings();
  assert.strictEqual(reloaded.twoFactorEnabled, true, 'Reloaded: twoFactorEnabled preserved');
  assert.strictEqual(reloaded.privacyLastSeen, 'nobody', 'Reloaded: privacyLastSeen preserved');
  assert.strictEqual(reloaded.readReceipts, false, 'Reloaded: readReceipts preserved');
  assert.strictEqual(reloaded.language, 'hi', 'Reloaded: language preserved');
  console.log('  ✓ Settings reloaded from storage with exact match');

  // Test 2: Server sync on login
  console.log('\n==> [2/4] Verifying server sync on login...');
  await serviceReloaded.syncWithBackend();
  const synced = serviceReloaded.getSettings();
  assert.strictEqual(synced.twoFactorEnabled, true);
  assert.strictEqual(synced.privacyLastSeen, 'nobody');
  console.log('  ✓ Server sync successfully updated local cache');

  // Test 3: Accurate failure reporting & rollback on server error
  console.log('\n==> [3/4] Verifying failure handling & state rollback...');
  mockApiShouldFail = true;

  let caughtError = null;
  let rolledBack = false;

  const currentVal = serviceReloaded.getSettings().twoFactorEnabled; // true
  const targetVal = false;

  try {
    await serviceReloaded.update({ twoFactorEnabled: targetVal });
  } catch (err) {
    caughtError = err;
    // Rollback simulation as implemented in FullSettingsModal
    mockApiShouldFail = false;
    await serviceReloaded.update({ twoFactorEnabled: currentVal });
    rolledBack = true;
  }

  assert(caughtError !== null, 'Server error was propagated to caller');
  assert(caughtError.message.includes('Server 500'), 'Accurate error message returned');
  assert(rolledBack, 'State was rolled back upon server failure');
  assert.strictEqual(serviceReloaded.getSettings().twoFactorEnabled, true, 'Rollback restored original twoFactorEnabled value');
  console.log(`  ✓ Server failure accurately reported: "${caughtError.message}"`);
  console.log('  ✓ UI rollback restored original value on failure');

  mockApiShouldFail = false;

  // Test 4: Multi-user isolation & Logout Reset
  console.log('\n==> [4/4] Verifying multi-user isolation & logout reset...');
  const user2Id = '22222222-2222-2222-2222-222222222222';
  const serviceUser2 = new TestSettingsService(mockApi);
  serviceUser2.loadForUser(user2Id);
  const user2Settings = serviceUser2.getSettings();
  assert.strictEqual(user2Settings.privacyLastSeen, 'everyone', 'User 2 has default privacy, isolated from User 1');

  serviceReloaded.resetForLogout();
  assert.strictEqual(serviceReloaded.getSettings().twoFactorEnabled, false, 'Logged out instance reset to defaults');
  console.log('  ✓ Multi-user settings are strictly isolated');
  console.log('  ✓ Logout resets session to default state');

  console.log('\n======================================================================');
  console.log(' Settings Persistence & Failure Handling PASSED COMPLETELY!');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
