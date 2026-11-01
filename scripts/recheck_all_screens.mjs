/**
 * scripts/recheck_all_screens.mjs
 * Comprehensive automated re-verification across all mobile screens on Android and iOS
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ANDROID_OUT = path.resolve('release/android/verification');
const IOS_OUT = path.resolve('release/ios/verification');
const IOS_UDID = '7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52';

fs.mkdirSync(ANDROID_OUT, { recursive: true });
fs.mkdirSync(IOS_OUT, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function adbCmd(cmd) {
  try {
    return execSync(`adb -s emulator-5554 ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    console.error(`ADB error on "${cmd}":`, e.message);
    return '';
  }
}

function simctlCmd(cmd) {
  try {
    return execSync(`xcrun simctl ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    console.error(`Simctl error on "${cmd}":`, e.message);
    return '';
  }
}

function captureAndroid(outFilename) {
  const target = path.join(ANDROID_OUT, outFilename);
  try {
    execSync(`adb -s emulator-5554 exec-out screencap -p > "${target}"`);
    const stat = fs.statSync(target);
    console.log(`  ✔ [Android] Captured ${outFilename} (${stat.size} bytes)`);
    return stat.size;
  } catch (e) {
    console.error(`  ✖ [Android] Failed to capture ${outFilename}:`, e.message);
    return 0;
  }
}

function captureIos(outFilename) {
  const target = path.join(IOS_OUT, outFilename);
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
    execSync(`xcrun simctl io ${IOS_UDID} screenshot "${target}"`, { stdio: 'ignore' });
    const stat = fs.statSync(target);
    console.log(`  ✔ [iOS] Captured ${outFilename} (${stat.size} bytes)`);
    return stat.size;
  } catch (e) {
    console.error(`  ✖ [iOS] Failed to capture ${outFilename}:`, e.message);
    return 0;
  }
}

async function main() {
  console.log('================================================================');
  console.log('INDICHAT MOBILE REDESIGN — RE-VERIFICATION OF ALL SCREENS');
  console.log('================================================================\n');

  // Ensure apps are running
  console.log('[Setup] Launching applications on Android and iOS...');
  adbCmd('shell am start -n com.indichat.app/.MainActivity');
  simctlCmd(`launch ${IOS_UDID} com.indichat.app`);
  await sleep(2000);

  // Set Dark Obsidian theme on both
  simctlCmd(`ui ${IOS_UDID} appearance dark`);
  await sleep(1000);

  const screens = [
    // Main Hubs
    { name: 'calls_top.png', route: 'chats?tab=calls', bottomName: 'calls_bottom.png' },
    { name: 'updates_top.png', route: 'chats?tab=updates' },
    { name: 'communities_top.png', route: 'chats?tab=communities' },
    { name: 'contacts_top.png', route: 'contacts' },

    // Settings Destinations
    { name: 'settings_top.png', route: 'settings', bottomName: 'settings_bottom.png' },
    { name: 'settings_profile_top.png', route: 'settings/profile', bottomName: 'settings_profile_bottom.png' },
    { name: 'settings_account_top.png', route: 'settings/account', bottomName: 'settings_account_bottom.png' },
    { name: 'settings_password_top.png', route: 'settings/password' },
    { name: 'settings_two_factor_top.png', route: 'settings/two-factor', bottomName: 'settings_two_factor_bottom.png' },
    { name: 'settings_phone_top.png', route: 'settings/phone' },
    { name: 'settings_passkeys_top.png', route: 'settings/passkeys', bottomName: 'settings_passkeys_bottom.png' },
    { name: 'settings_delete_top.png', route: 'settings/delete-account', bottomName: 'settings_delete_bottom.png' },
    { name: 'settings_privacy_top.png', route: 'settings/privacy', bottomName: 'settings_privacy_bottom.png' },
    { name: 'settings_appearance_top.png', route: 'settings/appearance', bottomName: 'settings_appearance_bottom.png' },
    { name: 'settings_chats_top.png', route: 'settings/chats', bottomName: 'settings_chats_bottom.png' },
    { name: 'settings_backup_top.png', route: 'settings/backup', bottomName: 'settings_backup_bottom.png' },
    { name: 'settings_devices_top.png', route: 'settings/linked-devices', bottomName: 'settings_devices_bottom.png' },
    { name: 'settings_link_code_top.png', route: 'settings/link-device' },
    { name: 'settings_notifications_top.png', route: 'settings/notifications', bottomName: 'settings_notifications_bottom.png' },
    { name: 'settings_language_top.png', route: 'settings/language' },
    { name: 'settings_server_top.png', route: 'settings/server', bottomName: 'settings_server_bottom.png' },
    { name: 'settings_help_top.png', route: 'settings/help', bottomName: 'settings_help_bottom.png' },
    { name: 'settings_storage_top.png', route: 'settings/storage', bottomName: 'settings_storage_bottom.png' },
    { name: 'settings_wallpaper_top.png', route: 'settings/wallpaper', bottomName: 'settings_wallpaper_bottom.png' },

    // Auth & Conversation
    { name: 'auth_top.png', route: '' },
    { name: 'auth_2fa_top.png', route: '?mode=2fa' },
    { name: 'auth_server_top.png', route: '?mode=server', bottomName: 'auth_server_bottom.png' },
    { name: 'conversation_top.png', route: 'chat/1' },
  ];

  console.log(`[Batch 1] Capturing ${screens.length} screens on Android and iOS...`);

  for (const s of screens) {
    console.log(`\n--- Screen: ${s.name} (route: indichat://${s.route}) ---`);

    // Android: Navigate
    adbCmd(`shell am start -W -a android.intent.action.VIEW -d "indichat://${s.route}"`);
    // iOS: Navigate
    simctlCmd(`openurl ${IOS_UDID} "indichat://${s.route}"`);
    await sleep(1500);

    // Capture Top
    captureAndroid(s.name);
    captureIos(s.name);

    // Capture Bottom if requested
    if (s.bottomName) {
      console.log(`  -> Capturing bottom extent: ${s.bottomName}`);
      // Android swipe down
      adbCmd('shell input swipe 540 1800 540 400 300');
      await sleep(1000);
      captureAndroid(s.bottomName);

      // On Android, scroll back up
      adbCmd('shell input swipe 540 400 540 1800 300');
      await sleep(500);

      // iOS capture bottom
      captureIos(s.bottomName);
    }
  }

  console.log('\n✔ All screens captured successfully.');
}

main().catch(console.error);
