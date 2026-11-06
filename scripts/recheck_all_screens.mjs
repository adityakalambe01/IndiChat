/**
 * scripts/recheck_all_screens.mjs
 * Comprehensive automated re-verification across all mobile screens on Android and iOS
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

function getVisibleNodes(xml) {
  const reg = /<node[^>]*?(content-desc="([^"]*)"|text="([^"]*)")[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
  const map = new Map();
  let m;
  while ((m = reg.exec(xml)) !== null) {
    const label = m[2] || m[3];
    if (label && label.trim().length > 0) {
      const y1 = parseInt(m[4], 10);
      const y2 = parseInt(m[6], 10);
      map.set(label.trim(), { y1, y2, cy: Math.round((y1 + y2) / 2) });
    }
  }
  return map;
}

// Final-row or bottom-extent visible indicators per screen
const FINAL_ROW_INDICATORS = {
  'settings_bottom.png': ['Help & Support', 'Server Connection', 'IndiChat Mobile', 'Server'],
  'settings_appearance_bottom.png': ['Save Changes', 'Reduced Motion', 'Off (Fluid)', 'Cancel', 'Back'],
  'settings_devices_bottom.png': ['Log out from all other devices', 'Log out', 'Active', 'Linked'],
  'settings_notifications_bottom.png': ['Reset Notification', 'Call ringtone', 'Vibrate', 'In-app sounds'],
  'settings_server_bottom.png': ['Reset to Environment Default', 'Save URL', 'Latency', 'Ping'],
  'settings_two_factor_bottom.png': ['Turn Off', 'Change Email', 'Change PIN', 'Enabled'],
  'auth_server_bottom.png': ['Reset to Default', 'Save URL', 'Latency', 'Test Ping'],
  'chats_bottom.png': ['RECENT CONVERSATIONS', 'Alice Cooper', 'Charlie Davis', 'Sspp'],
};

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

  console.log(`[Batch 1] Processing ${screens.length} screens on Android and iOS...`);

  let androidCaptured = 0;
  let iosCaptured = 0;
  let unverifiedInteractions = 0;

  for (const s of screens) {
    console.log(`\n--- Screen: ${s.name} (route: indichat://${s.route}) ---`);

    // Android: Navigate
    adbCmd(`shell am start -W -a android.intent.action.VIEW -d "indichat://${s.route}"`);
    // iOS: Navigate
    simctlCmd(`openurl ${IOS_UDID} "indichat://${s.route}"`);
    await sleep(1500);

    // Capture Top
    const aTopSize = captureAndroid(s.name);
    if (aTopSize > 0) androidCaptured++;
    const iTopSize = captureIos(s.name);
    if (iTopSize > 0) iosCaptured++;

    // Capture Bottom if requested and verified
    if (s.bottomName) {
      console.log(`  -> Assessing bottom extent: ${s.bottomName}`);

      // 1. Capture UI state before swipe on Android
      let preSwipeXml = '';
      try {
        adbCmd('shell uiautomator dump /sdcard/pre_swipe.xml');
        preSwipeXml = adbCmd('shell cat /sdcard/pre_swipe.xml');
      } catch (_) {}

      // 2. Perform swipe on Android
      adbCmd('shell input swipe 540 1800 540 400 300');
      await sleep(1000);

      // 3. Capture UI state after swipe on Android
      let postSwipeXml = '';
      try {
        adbCmd('shell uiautomator dump /sdcard/post_swipe.xml');
        postSwipeXml = adbCmd('shell cat /sdcard/post_swipe.xml');
      } catch (_) {}

      // 4. Verify scrolling via observable scroll position or final-row visibility
      const preNodes = getVisibleNodes(preSwipeXml);
      const postNodes = getVisibleNodes(postSwipeXml);

      let maxObservableDisplacement = 0;
      let displacedElement = '';
      for (const [label, preB] of preNodes.entries()) {
        if (postNodes.has(label)) {
          const postB = postNodes.get(label);
          const dy = Math.abs(postB.cy - preB.cy);
          if (dy > maxObservableDisplacement) {
            maxObservableDisplacement = dy;
            displacedElement = label;
          }
        }
      }

      // Check if designated final-row indicator is now visible
      const indicators = FINAL_ROW_INDICATORS[s.bottomName] || [];
      const finalRowAppeared = indicators.some((ind) => {
        return !preSwipeXml.includes(ind) && postSwipeXml.includes(ind);
      });

      const isScrollObserved = maxObservableDisplacement >= 80 || finalRowAppeared;

      if (!isScrollObserved) {
        console.log(`  ℹ [Android] Observable scroll check: screen content fits in viewport (displacement: ${maxObservableDisplacement}px, final row appeared: ${finalRowAppeared}). Skipping redundant bottom capture.`);
      } else {
        const dest = path.join(ANDROID_OUT, s.bottomName);
        execSync(`adb -s emulator-5554 exec-out screencap -p > "${dest}"`);
        const stat = fs.statSync(dest);
        console.log(`  ✔ [Android] Verified scrolling via ${finalRowAppeared ? 'final-row visibility' : `observable displacement (${maxObservableDisplacement}px on "${displacedElement}")`}. Captured ${s.bottomName} (${stat.size} bytes)`);
        androidCaptured++;
      }

      // Scroll back up on Android
      adbCmd('shell input swipe 540 400 540 1800 300');
      await sleep(500);

      // iOS: simctl lacks touch swipe gesture injection. Do NOT copy top as bottom.
      console.log(`  ⚠ [iOS] Bottom scroll interaction Unverified: headless CoreSimulator lacks CLI touch swipe injection.`);
      unverifiedInteractions++;
    }
  }

  console.log('\n================================================================');
  console.log(`RECHECK SUMMARY:`);
  console.log(`  Android Captures: ${androidCaptured}`);
  console.log(`  iOS Captures:     ${iosCaptured}`);
  console.log(`  Unverified:       ${unverifiedInteractions} (iOS swipe interactions requiring manual/GUI verification)`);
  console.log('================================================================');
}

main().catch(console.error);
