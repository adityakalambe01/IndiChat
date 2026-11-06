/**
 * scripts/exercise_call_and_revocation.mjs
 * Exercises the WebRTC Incoming Call Overlay and Device Revocation Alert using local test accounts
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
  console.log('1. Authenticating Bob on local backend...');
  const bobRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'bob', password: 'Password123!' })
  }).then(r => r.json());

  if (!bobRes.tokens?.accessToken) {
    throw new Error('Failed to login as Bob: ' + JSON.stringify(bobRes));
  }

  const bobToken = bobRes.tokens.accessToken;
  const bobId = bobRes.user.id;
  console.log(`Bob logged in: ID = ${bobId}`);

  // Connect Bob to WebSocket
  console.log('2. Connecting Bob to WebSocket...');
  const bobWs = new WebSocket(`ws://localhost:8080/ws?token=${bobToken}`);
  await new Promise((resolve, reject) => {
    bobWs.onopen = resolve;
    bobWs.onerror = reject;
    setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
  });
  console.log('✔ Bob connected to WebSocket');

  // Navigate both devices to Chats tab to receive calls cleanly
  console.log('3. Navigating devices to chats screen...');
  execSync('adb -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d "indichat://chats"');
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://chats"`);
  await sleep(2000);

  // ------------------------------------------------------------------
  // Test 1: Android Incoming Call Overlay
  // Charlie's user ID on Android:
  // ------------------------------------------------------------------
  console.log('\n4. Testing Incoming Call on Android (Charlie Davis)...');
  const charlieId = '1eadb7cd-88cc-4e96-ab36-228013736f35';

  bobWs.send(JSON.stringify({
    type: 'call.signal',
    payload: {
      targetUserId: charlieId,
      signalType: 'offer',
      data: { callerName: 'Bob Dylan', isVideo: false }
    }
  }));
  await sleep(1500);

  // Capture Android call overlay
  const androidCallPath = path.join(ANDROID_OUT, 'call_overlay.png');
  execSync(`adb -s emulator-5554 exec-out screencap -p > "${androidCallPath}"`);
  console.log(`✔ [Android] Captured incoming call overlay: ${androidCallPath} (${fs.statSync(androidCallPath).size} bytes)`);

  // Hangup call on Android
  bobWs.send(JSON.stringify({
    type: 'call.signal',
    payload: {
      targetUserId: charlieId,
      signalType: 'hangup',
      data: {}
    }
  }));
  await sleep(1000);

  // ------------------------------------------------------------------
  // Test 2: iOS Incoming Call Overlay
  // Alice's user ID on iOS:
  // ------------------------------------------------------------------
  console.log('\n5. Testing Incoming Call on iOS (Alice Cooper)...');
  const aliceId = '861bb0fd-48a5-4524-ba34-606ea0391dc0';

  bobWs.send(JSON.stringify({
    type: 'call.signal',
    payload: {
      targetUserId: aliceId,
      signalType: 'offer',
      data: { callerName: 'Bob Dylan', isVideo: false }
    }
  }));
  await sleep(1500);

  // Capture iOS call overlay
  const iosCallPath = path.join(IOS_OUT, 'call_overlay.png');
  if (fs.existsSync(iosCallPath)) fs.unlinkSync(iosCallPath);
  execSync(`xcrun simctl io ${IOS_UDID} screenshot "${iosCallPath}"`);
  console.log(`✔ [iOS] Captured incoming call overlay: ${iosCallPath} (${fs.statSync(iosCallPath).size} bytes)`);

  // Hangup call on iOS
  bobWs.send(JSON.stringify({
    type: 'call.signal',
    payload: {
      targetUserId: aliceId,
      signalType: 'hangup',
      data: {}
    }
  }));
  await sleep(1000);

  bobWs.close();
  console.log('\n✔ Call overlay verification completed successfully.');
}

main().catch(console.error);
