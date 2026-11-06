/**
 * scripts/capture_genuine_call_overlay.mjs
 *
 * Exercises a live WebRTC incoming call on Android from Bob Dylan to Charlie Davis,
 * confirms caller identity ("Bob Dylan") and Accept/Decline controls via UIAutomator dump,
 * and captures release/android/verification/call_overlay.png.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:8080/api/v1';
const ANDROID_OUT = path.resolve('release/android/verification');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function adb(cmd) {
  return execSync(`adb -s emulator-5554 ${cmd}`, { encoding: 'utf8' });
}

async function main() {
  console.log('--- Exercising Genuine Android Incoming Call Overlay ---');

  // 1. Authenticate Bob
  console.log('1. Authenticating Bob Dylan on backend...');
  const bobRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'bob', password: 'Password123!' }),
  }).then((r) => r.json());

  if (!bobRes.tokens?.accessToken) {
    throw new Error('Failed to login Bob: ' + JSON.stringify(bobRes));
  }
  const bobToken = bobRes.tokens.accessToken;
  console.log(`Bob logged in: ID = ${bobRes.user.id}`);

  // 2. Authenticate Charlie to get his exact current user ID
  console.log('2. Querying Charlie Davis user ID on backend...');
  const charlieRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'charlie', password: 'Password123!' }),
  }).then((r) => r.json());

  const charlieId = charlieRes.user.id;
  console.log(`Charlie ID = ${charlieId}`);

  // 3. Ensure Android is on Chats screen
  console.log('3. Navigating Android app to Chats screen...');
  adb('shell am start -W -a android.intent.action.VIEW -d "indichat://chats"');
  await sleep(2500);

  // 4. Connect Bob to backend WebSocket
  console.log('4. Connecting Bob to WebSocket...');
  const bobWs = new WebSocket(`ws://localhost:8080/ws?token=${bobToken}`);
  await new Promise((resolve, reject) => {
    bobWs.onopen = resolve;
    bobWs.onerror = reject;
    setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
  });
  console.log('✔ Bob connected to WebSocket');

  // 5. Send incoming call signal offer to Charlie
  console.log(`5. Sending call.signal (offer) to Charlie (${charlieId})...`);
  bobWs.send(
    JSON.stringify({
      type: 'call.signal',
      payload: {
        targetUserId: charlieId,
        signalType: 'offer',
        data: {
          callerName: 'Bob Dylan',
          isVideo: false,
        },
      },
    })
  );

  await sleep(2000);

  // 6. Verify with UIAutomator dump that caller identity and Accept/Decline controls are visible
  console.log('6. Inspecting UIAutomator hierarchy on Android...');
  adb('shell uiautomator dump /sdcard/window_dump.xml');
  const xmlDump = adb('shell cat /sdcard/window_dump.xml');

  const hasCaller = xmlDump.includes('Bob Dylan');
  const hasAccept = xmlDump.includes('Accept');
  const hasDecline = xmlDump.includes('Decline');

  console.log(`  - Caller Identity ('Bob Dylan') found: ${hasCaller}`);
  console.log(`  - Accept Control found:               ${hasAccept}`);
  console.log(`  - Decline Control found:              ${hasDecline}`);

  if (!hasCaller || !hasAccept || !hasDecline) {
    console.error('UI hierarchy dump snippet:');
    console.error(xmlDump.slice(0, 500));
    // Hang up before failing
    bobWs.send(
      JSON.stringify({
        type: 'call.signal',
        payload: { targetUserId: charlieId, signalType: 'hangup', data: {} },
      })
    );
    bobWs.close();
    throw new Error(`Incoming call overlay verification FAILED: caller=${hasCaller}, accept=${hasAccept}, decline=${hasDecline}`);
  }

  // 7. Capture the genuine incoming call screenshot
  const outPath = path.join(ANDROID_OUT, 'call_overlay.png');
  execSync(`adb -s emulator-5554 exec-out screencap -p > "${outPath}"`);
  const stat = fs.statSync(outPath);
  console.log(`✔ [Android] Successfully captured genuine call_overlay.png (${stat.size} bytes)`);

  // 8. Hangup call
  console.log('8. Hanging up call...');
  bobWs.send(
    JSON.stringify({
      type: 'call.signal',
      payload: {
        targetUserId: charlieId,
        signalType: 'hangup',
        data: {},
      },
    })
  );
  await sleep(1000);
  bobWs.close();

  console.log('✔ Genuine incoming-call verification complete and evidence accepted.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

