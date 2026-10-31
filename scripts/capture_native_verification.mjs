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

const DESTINATIONS = [
  // Auth
  { id: 'auth', url: 'indichat://?force=true&mode=auth', isLong: false },
  { id: 'auth_2fa', url: 'indichat://?force=true&mode=2fa', isLong: false },
  { id: 'auth_server', url: 'indichat://?force=true&mode=server', isLong: true },

  // Main Tabs
  { id: 'chats', url: 'indichat://chats?tab=chats', isLong: false },
  { id: 'calls', url: 'indichat://chats?tab=calls', isLong: false },
  { id: 'updates', url: 'indichat://chats?tab=updates', isLong: false },
  { id: 'communities', url: 'indichat://chats?tab=communities', isLong: false },

  // Conversation & Contacts
  { id: 'conversation', url: 'indichat://chat/c-community?name=IndiChat%20Community&type=GROUP', isLong: false },
  { id: 'contacts', url: 'indichat://contacts', isLong: false },

  // Settings Pages (20 screens)
  { id: 'settings', url: 'indichat://settings', isLong: true },
  { id: 'settings_profile', url: 'indichat://settings/profile', isLong: true },
  { id: 'settings_account', url: 'indichat://settings/account', isLong: true },
  { id: 'settings_password', url: 'indichat://settings/password', isLong: false },
  { id: 'settings_two_factor', url: 'indichat://settings/two-factor', isLong: true },
  { id: 'settings_phone', url: 'indichat://settings/phone', isLong: false },
  { id: 'settings_passkeys', url: 'indichat://settings/passkeys', isLong: true },
  { id: 'settings_delete', url: 'indichat://settings/delete-account', isLong: true },
  { id: 'settings_privacy', url: 'indichat://settings/privacy', isLong: true },
  { id: 'settings_appearance', url: 'indichat://settings/appearance', isLong: true },
  { id: 'settings_chats', url: 'indichat://settings/chats', isLong: true },
  { id: 'settings_backup', url: 'indichat://settings/backup', isLong: true },
  { id: 'settings_devices', url: 'indichat://settings/linked-devices', isLong: true },
  { id: 'settings_link_code', url: 'indichat://settings/link-device', isLong: false },
  { id: 'settings_notifications', url: 'indichat://settings/notifications', isLong: true },
  { id: 'settings_language', url: 'indichat://settings/language', isLong: false },
  { id: 'settings_server', url: 'indichat://settings/server', isLong: true },
  { id: 'settings_help', url: 'indichat://settings/help', isLong: true },
  { id: 'settings_storage', url: 'indichat://settings/storage', isLong: true },
  { id: 'settings_wallpaper', url: 'indichat://settings/wallpaper', isLong: true },
];

async function captureAndroid(dest) {
  console.log(`[Android] Navigating to: ${dest.id} (${dest.url})...`);
  try {
    execSync(`adb shell am start -W -a android.intent.action.VIEW -d "${dest.url}" com.indichat.app`, { stdio: 'ignore' });
  } catch (e) {
    console.warn(`[Android] am start returned non-zero for ${dest.id}:`, e.message);
  }
  await sleep(1200);

  // Capture top
  const topFile = path.join(ANDROID_OUT, `${dest.id}_top.png`);
  try {
    execSync(`adb exec-out screencap -p > "${topFile}"`);
    console.log(`[Android] Captured top: ${topFile}`);
  } catch (e) {
    console.error(`[Android] Failed to capture top for ${dest.id}:`, e.message);
  }

  // If long, scroll down and capture bottom
  if (dest.isLong) {
    try {
      execSync('adb shell input swipe 540 1800 540 600 300');
      await sleep(800);
      const bottomFile = path.join(ANDROID_OUT, `${dest.id}_bottom.png`);
      execSync(`adb exec-out screencap -p > "${bottomFile}"`);
      console.log(`[Android] Captured bottom: ${bottomFile}`);
      // Scroll back up for clean state
      execSync('adb shell input swipe 540 600 540 1800 200');
    } catch (e) {
      console.warn(`[Android] Failed bottom capture for ${dest.id}:`, e.message);
    }
  }
}

async function captureIOS(dest) {
  console.log(`[iOS] Navigating to: ${dest.id} (${dest.url})...`);
  try {
    execSync(`xcrun simctl openurl ${IOS_UDID} "${dest.url}"`, { stdio: 'ignore' });
  } catch (e) {
    console.warn(`[iOS] openurl returned non-zero for ${dest.id}:`, e.message);
  }
  await sleep(1000);

  const topFile = path.join(IOS_OUT, `${dest.id}_top.png`);
  try {
    execSync(`xcrun simctl io ${IOS_UDID} screenshot "${topFile}"`, { stdio: 'ignore' });
    console.log(`[iOS] Captured top: ${topFile}`);
  } catch (e) {
    console.error(`[iOS] Failed to capture top for ${dest.id}:`, e.message);
  }
}

async function main() {
  console.log('Starting automated screen capture across Android and iOS...');
  
  for (const dest of DESTINATIONS) {
    await captureAndroid(dest);
    await captureIOS(dest);
  }

  console.log('All destinations successfully captured on both platforms!');
}

main().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
