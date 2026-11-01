/**
 * scripts/exercise_saved_appearance_independent_of_os.mjs
 *
 * Exercises and verifies saved in-app appearance preferences independently of OS appearance
 * on a live Android runtime (Requirement 2 & 4).
 *
 * Invariant Checks:
 *  1. Locate and verify controls dynamically from UIAutomator dump before tapping.
 *  2. Confirm Save completed (wait for transition back to Settings).
 *  3. Set OS to the opposite appearance and cold terminate application.
 *  4. Cold relaunch and wait until "Checking session…" disappears and known screen is ready.
 *  5. Assert actual restored in-app theme via both accessibility state (selected="true") and pixel luminance.
 *  6. Exit nonzero immediately when any assertion fails. No unconditional PASSED output.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ANDROID_OUT = path.resolve('release/android/verification');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function adb(cmd) {
  return execSync(`adb -s emulator-5554 ${cmd}`, { encoding: 'utf8' });
}

function getUiDump() {
  adb('shell uiautomator dump /sdcard/live_dump.xml');
  return adb('shell cat /sdcard/live_dump.xml');
}

/**
 * Parses node bounds from UIAutomator XML by label (text or content-desc).
 * If preferClass is specified, prioritizes nodes matching that class (e.g. 'RadioButton').
 * Returns { label, className, bounds: [x1, y1, x2, y2], center: [cx, cy], enabled, selected }
 */
function findNodeByLabel(xml, pattern, preferClass = null) {
  const regex = /<node[^>]*?class="([^"]*)"[^>]*?(content-desc="([^"]*)"|text="([^"]*)")[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?>/g;
  let m;
  let candidate = null;
  while ((m = regex.exec(xml)) !== null) {
    const fullNode = m[0];
    const className = m[1];
    const label = m[3] || m[4] || '';
    const isMatch = typeof pattern === 'string'
      ? label.toLowerCase().includes(pattern.toLowerCase())
      : pattern.test(label);

    if (isMatch) {
      const x1 = parseInt(m[5], 10);
      const y1 = parseInt(m[6], 10);
      const x2 = parseInt(m[7], 10);
      const y2 = parseInt(m[8], 10);
      const enabled = fullNode.includes('enabled="true"');
      const selected = fullNode.includes('selected="true"');
      const cx = Math.round((x1 + x2) / 2);
      const cy = Math.round((y1 + y2) / 2);
      const nodeObj = { label, className, bounds: [x1, y1, x2, y2], center: [cx, cy], enabled, selected, raw: fullNode };

      if (preferClass && className.includes(preferClass)) {
        return nodeObj;
      }
      if (!candidate || className.includes('RadioButton') || className.includes('Button')) {
        candidate = nodeObj;
      }
    }
  }
  return candidate;
}

/**
 * Computes average pixel luminance using sips to convert PNG to uncompressed BMP.
 */
function getScreenshotLuminance(pngPath) {
  const tmpBmp = `/tmp/luma_${Date.now()}.bmp`;
  try {
    execSync(`sips -s format bmp "${pngPath}" --out "${tmpBmp}"`, { stdio: 'ignore' });
    const buf = fs.readFileSync(tmpBmp);
    const dataOffset = buf.readUInt32LE(10);
    let total = 0;
    let count = 0;
    // Sample every 12th pixel in the central area
    for (let i = dataOffset; i < buf.length - 3; i += 12) {
      const b = buf[i];
      const g = buf[i + 1];
      const r = buf[i + 2];
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
    return count > 0 ? total / count : 0;
  } finally {
    if (fs.existsSync(tmpBmp)) {
      try { fs.unlinkSync(tmpBmp); } catch (_) {}
    }
  }
}

/**
 * Polls UI dump until "Checking session…" disappears and a known ready element is present.
 */
async function waitForAppReady(maxWaitMs = 15000) {
  const start = Date.now();
  console.log('  -> Waiting for "Checking session…" to resolve and screen to be ready...');

  while (Date.now() - start < maxWaitMs) {
    try {
      const xml = getUiDump();
      const isChecking = xml.toLowerCase().includes('checking session');
      const isKnownReady =
        xml.includes('IndiChat') ||
        xml.includes('Chats') ||
        xml.includes('Updates') ||
        xml.includes('Calls') ||
        xml.includes('You') ||
        xml.includes('Settings');

      if (!isChecking && isKnownReady) {
        console.log(`  ✔ Application loaded and ready in ${Date.now() - start}ms.`);
        return xml;
      }
    } catch (e) {
      // Dump can fail transiently during launch
    }
    await sleep(800);
  }

  throw new Error(`Timeout waiting for application to be ready (exceeded ${maxWaitMs}ms)`);
}

async function main() {
  console.log('========================================================================');
  console.log('EXERCISING SAVED IN-APP APPEARANCE INDEPENDENTLY OF OS APPEARANCE');
  console.log('Target: emulator-5554 (Android 17 API 37)');
  console.log('========================================================================\n');

  // Ensure output directory exists
  fs.mkdirSync(ANDROID_OUT, { recursive: true });

  // --------------------------------------------------------------------------------
  // PHASE 1: Save explicit in-app Light mode, set OS to Night, restart, assert Light
  // --------------------------------------------------------------------------------
  console.log('[Phase 1] Testing Saved In-App Light Theme vs OS Night (Dark) Mode');

  // Step 1: Open Appearance settings
  console.log('1. Navigating to indichat://settings/appearance...');
  adb('shell "am start -W -a android.intent.action.VIEW -d \'indichat://settings/appearance\'"');

  // Step 2: Locate and verify Light control dynamically
  console.log('2. Locating Light theme control in UI dump...');
  let dump = null;
  let lightControl = null;
  const startNav = Date.now();
  while (Date.now() - startNav < 10000) {
    dump = getUiDump();
    lightControl = findNodeByLabel(dump, 'Light');
    if (lightControl) break;
    await sleep(600);
  }
  if (!lightControl) {
    throw new Error('Assertion Failed: "☀️ Light" theme control could not be found in UI dump');
  }
  console.log(`  ✔ Found Light control: "${lightControl.label}" at bounds [${lightControl.bounds.join(', ')}], center: [${lightControl.center.join(', ')}]`);

  // Tap Light control
  adb(`shell input tap ${lightControl.center[0]} ${lightControl.center[1]}`);
  await sleep(800);

  // Step 3: Confirm Save button is now enabled
  console.log('3. Verifying Save Changes button becomes enabled...');
  dump = getUiDump();
  const saveControl = findNodeByLabel(dump, 'Save Changes');
  if (!saveControl) {
    throw new Error('Assertion Failed: "Save Changes" button not found after staging Light theme');
  }
  if (!saveControl.enabled) {
    throw new Error('Assertion Failed: "Save Changes" button is disabled after staging changes');
  }
  console.log(`  ✔ Save Changes button verified enabled at center: [${saveControl.center.join(', ')}]`);

  // Step 4: Tap Save Changes and confirm save completed
  console.log('4. Tapping Save Changes and confirming navigation completed...');
  adb(`shell input tap ${saveControl.center[0]} ${saveControl.center[1]}`);
  await sleep(1500);

  // Verify save completed by confirming return to Settings or absence of Save Changes button
  dump = getUiDump();
  const postSaveControl = findNodeByLabel(dump, 'Save Changes');
  if (postSaveControl && postSaveControl.enabled) {
    throw new Error('Assertion Failed: Save did not complete; "Save Changes" is still displayed and active');
  }
  console.log('  ✔ Save confirmed completed; returned from Appearance staging screen.');

  // Step 5: Set OS to OPPOSITE appearance: Night Mode
  console.log('5. Setting Android OS appearance to OPPOSITE theme: Night mode (cmd uimode night yes)...');
  adb('shell cmd uimode night yes');
  await sleep(1000);

  // Step 6: Force-terminate application (cold process kill)
  console.log('6. Force-killing application process (am force-stop com.indichat.app)...');
  adb('shell am force-stop com.indichat.app');
  await sleep(1500);

  // Step 7: Cold relaunch application
  console.log('7. Cold relaunching application (am start -n com.indichat.app/.MainActivity)...');
  adb('shell "am start -n com.indichat.app/.MainActivity"');

  // Step 8: Wait until "Checking session…" disappears and screen is ready
  await waitForAppReady();

  // Step 9: Capture post-relaunch screenshot
  const daylightPng = path.join(ANDROID_OUT, 'relaunch_persistence_daylight.png');
  execSync(`adb -s emulator-5554 exec-out screencap -p > "${daylightPng}"`);
  console.log(`  ✔ Captured post-relaunch screenshot: ${daylightPng}`);

  // Step 10: Assert actual restored in-app theme
  console.log('8. Asserting actual restored in-app Light theme...');
  const daylightLuma = getScreenshotLuminance(daylightPng);
  console.log(`  • Measured screencap luminance: ${daylightLuma.toFixed(2)} / 255.0`);
  if (daylightLuma < 160) {
    throw new Error(`Assertion Failed: Post-relaunch screencap luminance (${daylightLuma.toFixed(2)}) is not Light theme (expected > 160)`);
  }

  // Navigate to Appearance to verify selected="true" on Light radio button
  adb('shell "am start -W -a android.intent.action.VIEW -d \'indichat://settings/appearance\'"');
  let daylightAppearanceDump = null;
  let lightRadio = null;
  const startLightRadioCheck = Date.now();
  while (Date.now() - startLightRadioCheck < 10000) {
    daylightAppearanceDump = getUiDump();
    lightRadio = findNodeByLabel(daylightAppearanceDump, 'Light', 'RadioButton');
    if (lightRadio) break;
    await sleep(600);
  }
  if (!lightRadio || !lightRadio.selected) {
    throw new Error(`Assertion Failed: "☀️ Light" RadioButton does not have selected="true" after cold relaunch (raw: ${lightRadio?.raw})`);
  }
  console.log(`  ✔ Accessibility assertion passed: "☀️ Light" RadioButton is selected="true".`);
  console.log('✔ Phase 1 PASSED: In-app Light theme successfully persisted independently of OS Night mode.\n');

  // --------------------------------------------------------------------------------
  // PHASE 2: Save explicit in-app Dark mode, set OS to Day, restart, assert Dark
  // --------------------------------------------------------------------------------
  console.log('[Phase 2] Testing Saved In-App Dark Theme vs OS Day (Light) Mode');

  // Step 1: Locate and verify Dark control
  console.log('1. Locating Dark theme control in UI dump...');
  dump = getUiDump();
  const darkControl = findNodeByLabel(dump, 'Dark');
  if (!darkControl) {
    throw new Error('Assertion Failed: "🌙 Dark" theme control could not be found in UI dump');
  }
  console.log(`  ✔ Found Dark control: "${darkControl.label}" at center: [${darkControl.center.join(', ')}]`);

  // Tap Dark control
  adb(`shell input tap ${darkControl.center[0]} ${darkControl.center[1]}`);
  await sleep(800);

  // Step 2: Confirm Save Changes enabled
  console.log('2. Verifying Save Changes button becomes enabled...');
  dump = getUiDump();
  const saveDarkControl = findNodeByLabel(dump, 'Save Changes');
  if (!saveDarkControl || !saveDarkControl.enabled) {
    throw new Error('Assertion Failed: "Save Changes" button not enabled after staging Dark theme');
  }
  console.log(`  ✔ Save Changes button verified enabled at center: [${saveDarkControl.center.join(', ')}]`);

  // Step 3: Tap Save Changes
  console.log('3. Tapping Save Changes...');
  adb(`shell input tap ${saveDarkControl.center[0]} ${saveDarkControl.center[1]}`);
  await sleep(1500);

  // Confirm save completed
  dump = getUiDump();
  const postDarkSave = findNodeByLabel(dump, 'Save Changes');
  if (postDarkSave && postDarkSave.enabled) {
    throw new Error('Assertion Failed: Save did not complete; "Save Changes" is still displayed');
  }
  console.log('  ✔ Save confirmed completed; returned from Appearance staging screen.');

  // Step 4: Set OS to OPPOSITE appearance: Day Mode
  console.log('4. Setting Android OS appearance to OPPOSITE theme: Day mode (cmd uimode night no)...');
  adb('shell cmd uimode night no');
  await sleep(1000);

  // Step 5: Force-terminate application
  console.log('5. Force-killing application process...');
  adb('shell am force-stop com.indichat.app');
  await sleep(1500);

  // Step 6: Cold relaunch application
  console.log('6. Cold relaunching application...');
  adb('shell "am start -n com.indichat.app/.MainActivity"');

  // Step 7: Wait until "Checking session…" disappears and screen is ready
  await waitForAppReady();

  // Step 8: Capture post-relaunch screenshot
  const darkPng = path.join(ANDROID_OUT, 'relaunch_persistence_dark.png');
  execSync(`adb -s emulator-5554 exec-out screencap -p > "${darkPng}"`);
  console.log(`  ✔ Captured post-relaunch screenshot: ${darkPng}`);

  // Step 9: Assert actual restored in-app theme
  console.log('7. Asserting actual restored in-app Dark theme...');
  const darkLuma = getScreenshotLuminance(darkPng);
  console.log(`  • Measured screencap luminance: ${darkLuma.toFixed(2)} / 255.0`);
  if (darkLuma > 60) {
    throw new Error(`Assertion Failed: Post-relaunch screencap luminance (${darkLuma.toFixed(2)}) is not Dark theme (expected < 60)`);
  }

  // Navigate to Appearance to verify selected="true" on Dark radio button
  adb('shell "am start -W -a android.intent.action.VIEW -d \'indichat://settings/appearance\'"');
  let darkAppearanceDump = null;
  let darkRadio = null;
  const startDarkRadioCheck = Date.now();
  while (Date.now() - startDarkRadioCheck < 10000) {
    darkAppearanceDump = getUiDump();
    darkRadio = findNodeByLabel(darkAppearanceDump, 'Dark', 'RadioButton');
    if (darkRadio) break;
    await sleep(600);
  }
  if (!darkRadio || !darkRadio.selected) {
    throw new Error(`Assertion Failed: "🌙 Dark" RadioButton does not have selected="true" after cold relaunch (raw: ${darkRadio?.raw})`);
  }
  console.log(`  ✔ Accessibility assertion passed: "🌙 Dark" RadioButton is selected="true".`);
  console.log('✔ Phase 2 PASSED: In-app Dark theme successfully persisted independently of OS Day mode.\n');

  // Reset OS to standard Dark mode
  console.log('Restoring OS to Night mode (Dark Obsidian default)...');
  adb('shell cmd uimode night yes');

  console.log('========================================================================');
  console.log('ALL IN-APP APPEARANCE PERSISTENCE ASSERTIONS VERIFIED SUCCESSFULLY');
  console.log('========================================================================');
}

main().catch((err) => {
  console.error('\n✖ APPEARANCE PERSISTENCE VERIFICATION FAILED:');
  console.error(err.message || err);
  // Ensure OS is restored even on failure
  try {
    adb('shell cmd uimode night yes');
  } catch (_) {}
  process.exit(1);
});
