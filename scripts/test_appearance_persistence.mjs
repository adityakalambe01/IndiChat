/**
 * scripts/test_appearance_persistence.mjs
 *
 * Automated regression test verifying that saved in-app appearance preferences
 * persist across process termination and cold reload independently of OS appearance (Requirement 1 & 4).
 *
 * Exercises ACTUAL application logic directly:
 *  - apps/mobile/services/settings.ts (SettingsService)
 *  - apps/mobile/theme/resolveTheme.ts (resolveEffectiveTheme)
 *
 * Mocks EXTERNAL storage and API boundaries only (simulating AsyncStorage and backend endpoints).
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Register loader for extensionless TS imports and external boundaries
register(pathToFileURL(path.resolve('scripts/test-resolver.mjs')));

import test from 'node:test';
import assert from 'node:assert/strict';

// Dynamically import actual application logic after registering the module loader
const { SettingsService } = await import('../apps/mobile/services/settings.ts');
const { resolveEffectiveTheme } = await import('../apps/mobile/theme/resolveTheme.ts');

// Mock External Storage Boundary (simulates device persistent storage like AsyncStorage)
class MockStorageBoundary {
  constructor(initialStore = new Map()) {
    this.store = new Map(initialStore);
  }

  async getItem(key) {
    return this.store.get(key) || null;
  }

  async setItem(key, value) {
    this.store.set(key, String(value));
  }

  async removeItem(key) {
    this.store.delete(key);
  }

  async getJson(key) {
    const raw = this.store.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async setJson(key, value) {
    this.store.set(key, JSON.stringify(value));
  }
}

// Mock External API Boundary (simulates remote backend REST endpoints)
const mockApiBoundary = {
  getUserSettings: async () => ({}),
  updateUserSettings: async () => ({}),
  getLinkedDevices: async () => [],
};

test('Theme Persistence: Save explicit in-app light theme, set OS to dark, terminate and relaunch -> asserts light theme', async () => {
  // Shared persistent disk boundary simulating device flash storage
  const persistentStorage = new MockStorageBoundary();

  // Session 1: User opens app, navigates to Appearance Settings, selects and saves Light mode
  const session1Service = new SettingsService(persistentStorage, mockApiBoundary);
  await session1Service.init();

  // Save explicit in-app 'light' theme
  session1Service.updateLocal({ appearanceMode: 'light' });
  assert.equal(session1Service.getSettings().appearanceMode, 'light', 'Session 1 must have in-app appearanceMode = light');

  // Verify stored on persistent storage boundary
  const persistedRaw = await persistentStorage.getJson('chat_app_settings');
  assert.equal(persistedRaw.appearanceMode, 'light', 'Persistent storage boundary must contain saved appearanceMode = light');

  // SIMULATE COLD APP PROCESS TERMINATION & RESTART
  // Operating system is explicitly set to DARK scheme ('dark')
  const osColorScheme = 'dark';

  // Session 2: Cold launch initiates fresh application service instance from disk
  const session2Service = new SettingsService(persistentStorage, mockApiBoundary);
  await session2Service.init();

  const restoredSettings = session2Service.getSettings();
  assert.equal(restoredSettings.appearanceMode, 'light', 'Restored settings must persist appearanceMode = light');

  // Execute actual application theme resolution logic
  const resolved = resolveEffectiveTheme(restoredSettings, null, osColorScheme);

  // Assert: Explicit in-app preference takes precedence over OS appearance
  assert.equal(resolved.effectiveMode, 'light', 'Effective mode must be light');
  assert.equal(resolved.isDark, false, 'isDark must be false even though OS color scheme is dark');
  assert.equal(resolved.themeName, 'Daylight Light', 'Theme name must be Daylight Light');
  assert.equal(resolved.palette.bg, '#f2f5f3', 'Palette background must be light Daylight (#f2f5f3)');
});

test('Theme Persistence: Save explicit in-app dark theme, set OS to light, terminate and relaunch -> asserts dark theme', async () => {
  const persistentStorage = new MockStorageBoundary();

  // Session 1: User saves explicit Dark Obsidian in-app theme
  const session1Service = new SettingsService(persistentStorage, mockApiBoundary);
  await session1Service.init();

  session1Service.updateLocal({ appearanceMode: 'dark', blurRadius: 35 });
  assert.equal(session1Service.getSettings().appearanceMode, 'dark');
  assert.equal(session1Service.getSettings().blurRadius, 35);

  // SIMULATE COLD PROCESS TERMINATION
  // Operating system is explicitly set to LIGHT scheme ('light')
  const osColorScheme = 'light';

  // Session 2: Cold launch
  const session2Service = new SettingsService(persistentStorage, mockApiBoundary);
  await session2Service.init();

  const restoredSettings = session2Service.getSettings();
  assert.equal(restoredSettings.appearanceMode, 'dark');
  assert.equal(restoredSettings.blurRadius, 35);

  // Execute actual application theme resolution logic
  const resolved = resolveEffectiveTheme(restoredSettings, null, osColorScheme);

  // Assert: Explicit in-app preference takes precedence over OS appearance
  assert.equal(resolved.effectiveMode, 'dark', 'Effective mode must be dark');
  assert.equal(resolved.isDark, true, 'isDark must be true even though OS color scheme is light');
  assert.equal(resolved.themeName, 'Dark Obsidian', 'Theme name must be Dark Obsidian');
  assert.equal(resolved.palette.bg, '#070b0e', 'Palette background must be Dark Obsidian (#070b0e)');
  assert.equal(resolved.blurIntensity, 88, 'Blur intensity must map 35/40 to 88%');
});

test('Theme Persistence: In-app system mode dynamically follows OS appearance', async () => {
  const persistentStorage = new MockStorageBoundary();
  const service = new SettingsService(persistentStorage, mockApiBoundary);
  await service.init();

  // Set system mode
  service.updateLocal({ appearanceMode: 'system' });
  const settings = service.getSettings();

  // When OS is dark
  const darkResolved = resolveEffectiveTheme(settings, null, 'dark');
  assert.equal(darkResolved.effectiveMode, 'system');
  assert.equal(darkResolved.isDark, true);
  assert.equal(darkResolved.themeName, 'Dark Obsidian');

  // When OS is light
  const lightResolved = resolveEffectiveTheme(settings, null, 'light');
  assert.equal(lightResolved.effectiveMode, 'system');
  assert.equal(lightResolved.isDark, false);
  assert.equal(lightResolved.themeName, 'Daylight Light');
});

test('Theme Lifecycle: Discard staged changes reverts to previously saved theme on cold relaunch', async () => {
  const persistentStorage = new MockStorageBoundary();

  // Session 1: Initial state is Dark Obsidian
  const session1Service = new SettingsService(persistentStorage, mockApiBoundary);
  await session1Service.init();
  session1Service.updateLocal({ appearanceMode: 'dark', blurRadius: 20 });

  // User stages Daylight mode in Appearance preview
  const stagedPreview = { appearanceMode: 'light', blurRadius: 40 };

  // While staged, effective preview renders Daylight
  const previewResolved = resolveEffectiveTheme(session1Service.getSettings(), stagedPreview, 'dark');
  assert.equal(previewResolved.effectiveMode, 'light', 'Preview should reflect staged light mode');
  assert.equal(previewResolved.isDark, false, 'Preview should be light');

  // User DISCARDS staged changes (does not call updateLocal with stagedPreview)
  // App process is killed
  const session2Service = new SettingsService(persistentStorage, mockApiBoundary);
  await session2Service.init();

  const restoredSettings = session2Service.getSettings();

  // Execute actual resolution with restored settings (stagedPreview is cleared on discard)
  const finalResolved = resolveEffectiveTheme(restoredSettings, null, 'dark');
  assert.equal(finalResolved.effectiveMode, 'dark', 'Must revert to previously saved dark mode');
  assert.equal(finalResolved.isDark, true, 'Must remain dark');
  assert.equal(finalResolved.blurIntensity, 50, 'Blur intensity must revert to 20/40 = 50%');
});

test('Reduced Motion navigation updates subscribers immediately and persists across reload', async () => {
  const { navigationAnimation } = await import('../apps/mobile/theme/navigation.ts');
  const disk = new MockStorageBoundary();
  const service = new SettingsService(disk, mockApiBoundary);
  await service.init();
  let currentAnimation;
  const unsubscribe = service.subscribe(settings => {
    currentAnimation = navigationAnimation(resolveEffectiveTheme(settings, null, 'dark', false, false).isReducedMotion);
  });
  service.updateLocal({ reducedMotion: 'on' });
  assert.equal(currentAnimation, 'none');
  await service.flush();
  const restored = new SettingsService(disk, mockApiBoundary);
  await restored.init();
  assert.equal(navigationAnimation(resolveEffectiveTheme(restored.getSettings(), null, 'dark', false, false).isReducedMotion), 'none');
  service.updateLocal({ reducedMotion: 'off' });
  assert.equal(currentAnimation, 'slide_from_right');
  unsubscribe();
});
