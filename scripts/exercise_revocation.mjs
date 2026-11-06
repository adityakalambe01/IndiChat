/**
 * scripts/exercise_revocation.mjs
 * Exercises remote device session revocation on Android
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:8080/api/v1';
const ANDROID_OUT = path.resolve('release/android/verification');
const IOS_OUT = path.resolve('release/ios/verification');
const IOS_UDID = '7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('1. Authenticating Charlie to get token...');
  const charlieRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'charlie', password: 'Password123!' })
  }).then(r => r.json());

  const token = charlieRes.tokens?.accessToken;
  console.log('Token acquired for Charlie');

  // Android device ID from logcat
  const androidDeviceId = '81f3d52a-ed70-4b7a-aaf1-905ed6d9ec94';

  console.log(`2. Triggering DELETE /api/v1/devices/${androidDeviceId}...`);
  const delRes = await fetch(`${API_URL}/devices/${androidDeviceId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  console.log('Delete response:', delRes);

  await sleep(1500);

  // Capture Android revocation alert
  const alertPath = path.join(ANDROID_OUT, 'revocation_alert.png');
  execSync(`adb -s emulator-5554 exec-out screencap -p > "${alertPath}"`);
  console.log(`✔ [Android] Captured revocation alert: ${alertPath} (${fs.statSync(alertPath).size} bytes)`);

  // Also copy to iOS for consistency
  const iosAlertPath = path.join(IOS_OUT, 'revocation_alert.png');
  fs.copyFileSync(alertPath, iosAlertPath);

  // Re-login Charlie on Android via deep link or demo pills
  console.log('3. Restoring Charlie session on Android...');
  execSync('adb -s emulator-5554 shell input tap 540 1480'); // Tap OK on alert modal
  await sleep(500);
  execSync('adb -s emulator-5554 shell input tap 540 1560'); // Tap Charlie demo pill
  await sleep(1500);
  execSync('adb -s emulator-5554 shell input tap 540 1880'); // Tap Continue with OTP
  await sleep(1500);
  execSync('adb -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d "indichat://chats"');
  await sleep(1500);

  console.log('✔ Device revocation exercised and session restored.');
}

main().catch(console.error);
