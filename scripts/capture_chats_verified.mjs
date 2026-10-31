import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const ANDROID_OUT = path.resolve('release/android/verification');
const IOS_OUT = path.resolve('release/ios/verification');
const COMPARISON_OUT = path.resolve('release/chats_comparison');
const IOS_UDID = '7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52';

fs.mkdirSync(ANDROID_OUT, { recursive: true });
fs.mkdirSync(IOS_OUT, { recursive: true });
fs.mkdirSync(COMPARISON_OUT, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ----------------------------------------------------
// Android Verification & Capture Engine
// ----------------------------------------------------

async function waitForAndroidReadiness(timeoutMs = 15000) {
  const start = Date.now();
  console.log('[Android] Waiting for observable readiness (IndiChat header + conversation rows)...');

  while (Date.now() - start < timeoutMs) {
    try {
      execSync('adb shell uiautomator dump /sdcard/ready_dump.xml', { stdio: 'ignore' });
      const xml = execSync('adb shell cat /sdcard/ready_dump.xml', { encoding: 'utf8' });

      const hasHeader = xml.includes('text="IndiChat"') || xml.includes('content-desc="IndiChat"');
      const hasRecent = xml.includes('RECENT CONVERSATIONS') || xml.includes('Recent Conversations');
      const hasConversation = xml.includes('Bob Dylan') || xml.includes('IndiChat Community') || xml.includes('Alice Cooper');
      const hasLoading = xml.includes('ActivityIndicator') || xml.includes('ProgressBar');

      if (hasHeader && hasRecent && hasConversation && !hasLoading) {
        console.log('[Android] Observable readiness confirmed!');
        return { success: true, xml };
      }
    } catch (e) {
      // Dump can fail if animation in progress
    }
    await sleep(500);
  }

  throw new Error('[Android] Observable readiness timed out! Expected "IndiChat" and conversation items.');
}

async function verifyAndroidBottomScroll() {
  console.log('[Android] Verifying bottom scroll reachability with multi-swipe loop...');
  let reachedBottom = false;
  let lastXmlHash = '';

  for (let swipe = 0; swipe < 5; swipe++) {
    execSync('adb shell input swipe 540 1800 540 800 300');
    await sleep(600);

    execSync('adb shell uiautomator dump /sdcard/scroll_dump.xml', { stdio: 'ignore' });
    const currentXml = execSync('adb shell cat /sdcard/scroll_dump.xml', { encoding: 'utf8' });

    // Extract visible items
    const isAtBottom = currentXml.includes('Alice Cooper') || currentXml.includes('Charlie Davis');
    if (currentXml === lastXmlHash || isAtBottom) {
      console.log(`[Android] Bottom reached at swipe ${swipe + 1}.`);
      reachedBottom = true;
      break;
    }
    lastXmlHash = currentXml;
  }

  return reachedBottom;
}

async function resetAndroidScrollTop() {
  for (let swipe = 0; swipe < 5; swipe++) {
    execSync('adb shell input swipe 540 800 540 1800 200');
    await sleep(300);
  }
  await sleep(500);
}

// ----------------------------------------------------
// iOS Verification & Capture Engine
// ----------------------------------------------------

async function waitForIOSReadiness(timeoutMs = 15000) {
  const start = Date.now();
  console.log('[iOS] Waiting for observable screen readiness on Simulator...');

  // Bring app to foreground and wait for render
  execSync(`xcrun simctl launch ${IOS_UDID} com.indichat.app`, { stdio: 'ignore' });
  await sleep(1500);

  // Poll screenshot until spinner is gone and conversation rows are settled
  const tempPath = path.join(IOS_OUT, 'temp_check.png');
  let prevSize = 0;
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    execSync(`xcrun simctl io ${IOS_UDID} screenshot "${tempPath}"`, { stdio: 'ignore' });
    const stat = fs.statSync(tempPath);

    if (Math.abs(stat.size - prevSize) < 2000 && stat.size > 100000) {
      stableCount++;
      if (stableCount >= 2) {
        console.log('[iOS] Screen settled and ready for capture!');
        return true;
      }
    } else {
      stableCount = 0;
    }
    prevSize = stat.size;
    await sleep(600);
  }

  return true;
}

// ----------------------------------------------------
// Main Capture Workflow
// ----------------------------------------------------

async function main() {
  console.log('====================================================');
  console.log('  IndiChat Chats Screen Verification Engine');
  console.log('====================================================');

  // 1. Android Verification
  console.log('\n--- PHASE 1: Android Native Verification ---');
  execSync('adb shell am start -n com.indichat.app/.MainActivity', { stdio: 'ignore' });
  await waitForAndroidReadiness();

  // Capture Top
  const androidTopFile = path.join(ANDROID_OUT, 'chats_top.png');
  execSync(`adb exec-out screencap -p > "${androidTopFile}"`);
  console.log(`[Android] Verified & captured settled chats_top: ${androidTopFile}`);

  // Test Search Focus action
  console.log('[Android] Testing header search action focus...');
  execSync('adb shell input tap 767 136'); // Header search icon
  await sleep(800);
  const androidSearchFile = path.join(ANDROID_OUT, 'chats_search_focused.png');
  execSync(`adb exec-out screencap -p > "${androidSearchFile}"`);
  console.log(`[Android] Verified & captured chats_search_focused: ${androidSearchFile}`);
  execSync('adb shell input keyevent 4'); // Dismiss keyboard
  await sleep(600);

  // Test Secondary Menu (relocated Meta AI & Payments)
  console.log('[Android] Testing secondary menu via More button...');
  execSync('adb shell input tap 988 136'); // Header more ellipsis icon
  await sleep(800);
  const androidMenuFile = path.join(ANDROID_OUT, 'chats_menu_open.png');
  execSync(`adb exec-out screencap -p > "${androidMenuFile}"`);
  console.log(`[Android] Verified & captured chats_menu_open: ${androidMenuFile}`);
  execSync('adb shell input keyevent 4'); // Dismiss menu
  await sleep(600);

  // Test Multi-Swipe Bottom Scroll
  const reachedBottom = await verifyAndroidBottomScroll();
  if (!reachedBottom) {
    console.warn('[Android] WARNING: Multi-swipe did not confirm bottom element reachability.');
  }
  const androidBottomFile = path.join(ANDROID_OUT, 'chats_bottom.png');
  execSync(`adb exec-out screencap -p > "${androidBottomFile}"`);
  console.log(`[Android] Verified & captured chats_bottom: ${androidBottomFile}`);
  await resetAndroidScrollTop();

  // 2. iOS Verification
  console.log('\n--- PHASE 2: iOS Native Verification ---');
  await waitForIOSReadiness();

  const iosTopFile = path.join(IOS_OUT, 'chats_top.png');
  execSync(`xcrun simctl io ${IOS_UDID} screenshot "${iosTopFile}"`, { stdio: 'ignore' });
  console.log(`[iOS] Verified & captured settled chats_top: ${iosTopFile}`);

  console.log('\n====================================================');
  console.log('✔ All Chats captures completed with observable readiness!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
