/**
 * scripts/recapture_affected_screens.mjs
 * Recaptures screens affected by visual alignment fixes:
 *  - settings/chats (title updated to 'Chats & Wallpaper')
 *  - settings/notifications (section and row labels aligned with preview)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ANDROID_OUT = path.resolve('release/android/verification');
const IOS_OUT = path.resolve('release/ios/verification');
const IOS_UDID = '7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52';

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

async function captureAffected(targetPlatform = 'both') {
  const targets = [
    { route: 'settings/chats', name: 'settings_chats_top.png' },
    { route: 'settings/notifications', name: 'settings_notifications_top.png', bottomName: 'settings_notifications_bottom.png' }
  ];

  for (const t of targets) {
    console.log(`\nNavigating to indichat://${t.route}...`);

    if (targetPlatform === 'both' || targetPlatform === 'android') {
      adbCmd(`shell am start -W -a android.intent.action.VIEW -d "indichat://${t.route}"`);
      await sleep(1500);
      const aPath = path.join(ANDROID_OUT, t.name);
      execSync(`adb -s emulator-5554 exec-out screencap -p > "${aPath}"`);
      console.log(`  ✔ [Android] Recaptured ${t.name} (${fs.statSync(aPath).size} bytes)`);

      if (t.bottomName) {
        adbCmd('shell input swipe 540 1800 540 400 300');
        await sleep(1000);
        const bPath = path.join(ANDROID_OUT, t.bottomName);
        execSync(`adb -s emulator-5554 exec-out screencap -p > "${bPath}"`);
        console.log(`  ✔ [Android] Recaptured ${t.bottomName} (${fs.statSync(bPath).size} bytes)`);
        adbCmd('shell input swipe 540 400 540 1800 300');
      }
    }

    if (targetPlatform === 'both' || targetPlatform === 'ios') {
      simctlCmd(`openurl ${IOS_UDID} "indichat://${t.route}"`);
      await sleep(1500);
      const iPath = path.join(IOS_OUT, t.name);
      if (fs.existsSync(iPath)) fs.unlinkSync(iPath);
      execSync(`xcrun simctl io ${IOS_UDID} screenshot "${iPath}"`, { stdio: 'ignore' });
      console.log(`  ✔ [iOS] Recaptured ${t.name} (${fs.statSync(iPath).size} bytes)`);
    }
  }
}

const platformArg = process.argv[2] || 'both';
captureAffected(platformArg).catch(console.error);

