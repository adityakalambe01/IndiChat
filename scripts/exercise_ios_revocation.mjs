import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:8080/api/v1';
const IOS_UDID = '7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52';
const MANIFEST_PATH = '/Users/innodaredevil/Library/Developer/CoreSimulator/Devices/7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52/data/Containers/Data/Application/46333CDE-899A-4F31-B129-F77A6A7D320A/Library/Application Support/com.indichat.app/RCTAsyncLocalStorage_V1/manifest.json';
const IOS_ALERT_PATH = path.resolve('release/ios/verification/revocation_alert.png');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('1. Authenticating Alice via REST API...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernameOrEmail: 'alice',
      password: 'Password123!',
      twoFactorPin: '112233'
    })
  }).then(r => r.json());

  if (!loginRes.tokens?.accessToken) {
    throw new Error('Failed to login Alice: ' + JSON.stringify(loginRes));
  }

  const { accessToken, refreshToken } = loginRes.tokens;
  const user = loginRes.user;
  console.log(`Alice authenticated. User ID: ${user.id}`);

  console.log('2. Updating iOS simulator AsyncStorage manifest with fresh token...');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const deviceId = manifest.chat_device_id || 'ab08f426-c644-4268-8eb1-8e5cd9801214';
  manifest.chat_access_token = accessToken;
  manifest.chat_refresh_token = refreshToken;
  manifest.chat_current_user = JSON.stringify(user);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest), 'utf8');

  console.log(`Configured device ID: ${deviceId}`);

  console.log('3. Registering device session in backend user_linked_devices...');
  // Call GET /api/v1/devices to ensure this device is recognized in user_linked_devices
  await fetch(`${API_URL}/devices`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Device-Id': deviceId,
      'X-Device-Name': 'Apple iOS (IndiChat Mobile)',
      'X-Device-Platform': 'ios',
      'X-Device-Browser': 'IndiChat Mobile App'
    }
  });

  console.log('4. Restarting iOS app to connect WebSocket...');
  execSync(`xcrun simctl terminate ${IOS_UDID} com.indichat.app`, { stdio: 'ignore' });
  await sleep(1000);
  execSync(`xcrun simctl launch ${IOS_UDID} com.indichat.app`, { stdio: 'ignore' });
  await sleep(3000);

  // Navigate to chats screen
  execSync(`xcrun simctl openurl ${IOS_UDID} "indichat://chats"`, { stdio: 'ignore' });
  await sleep(2500);

  console.log('5. Triggering DELETE /api/v1/devices/' + deviceId);
  const delRes = await fetch(`${API_URL}/devices/${deviceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Device-Id': deviceId
    }
  }).then(r => r.json());
  console.log('Delete response:', delRes);

  await sleep(2000);

  console.log('6. Capturing real iOS revocation alert...');
  if (fs.existsSync(IOS_ALERT_PATH)) {
    fs.unlinkSync(IOS_ALERT_PATH);
  }
  execSync(`xcrun simctl io ${IOS_UDID} screenshot "${IOS_ALERT_PATH}"`);
  const stat = fs.statSync(IOS_ALERT_PATH);
  console.log(`✔ [iOS] Captured revocation alert: ${IOS_ALERT_PATH} (${stat.size} bytes)`);
}

main().catch(console.error);
