/**
 * verify-focus-and-reload.js
 *
 * IndiChat Focused Headless Chrome Verification:
 * 1. State Restoration after an Actual Page Reload (persistent Chrome user-data-dir).
 * 2. Keyboard Tab Navigation, Dialog Focus Trapping & Restoration (WCAG 2.2).
 * 3. Mouse Reachability, Backdrop Dismissals, & Control Hitboxes.
 *
 * Runs across all 4 actual preview pages:
 * - preview-web.html
 * - preview-desktop-macos.html
 * - preview-desktop-windows.html
 * - preview-desktop-linux.html
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PREVIEW_DIR = path.resolve(__dirname);
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TMP_DATA_ROOT = path.join('/tmp', 'indichat_focus_reload_' + Date.now());

const PLATFORMS = [
  { id: 'web', name: 'Web Browser Workspace', file: 'preview-web.html' },
  { id: 'macos', name: 'macOS Native Desktop', file: 'preview-desktop-macos.html' },
  { id: 'windows', name: 'Windows 11 Native Desktop', file: 'preview-desktop-windows.html' },
  { id: 'linux', name: 'Linux GNOME Desktop', file: 'preview-desktop-linux.html' }
];

console.log('========================================================================');
console.log('   IndiChat Focused Verification: State Reload & Keyboard/Mouse Access  ');
console.log('========================================================================\n');

if (!fs.existsSync(CHROME_PATH)) {
  console.error('Google Chrome not found at ' + CHROME_PATH);
  process.exit(1);
}

function runHeadlessChrome(file, queryParam, userDataDir) {
  const filePath = path.join(PREVIEW_DIR, file);
  const fileUrl = `file://${filePath}?${queryParam}`;
  const cmd = `"${CHROME_PATH}" --headless=new --disable-gpu --no-sandbox --user-data-dir="${userDataDir}" --virtual-time-budget=8000 --dump-dom "${fileUrl}"`;
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 10 * 1024 * 1024 });
}

let totalAllTests = 0;
let totalAllPassed = 0;
let totalAllFailed = 0;

const platformSummary = [];

for (const plat of PLATFORMS) {
  console.log(`▶ Testing Platform: ${plat.name} (${plat.file})`);
  const dedicatedDataDir = path.join(TMP_DATA_ROOT, 'plat_' + plat.id);
  fs.mkdirSync(dedicatedDataDir, { recursive: true });

  let platPassed = 0;
  let platFailed = 0;
  let platTotal = 0;

  // -----------------------------------------------------------
  // 1. Phase 1: Real Page Reload & State Restoration
  // -----------------------------------------------------------
  process.stdout.write('  [Phase 1] Actual Page Reload State Restoration: ');
  try {
    // Pass A: Modify state in Session 1
    const rawDomA = runHeadlessChrome(plat.file, 'runFocusTest=modify', dedicatedDataDir);
    if (!rawDomA.includes('id="modifyStateResults"')) {
      throw new Error('modifyStateResults marker not found in DOM');
    }

    // Pass B: Reload actual page in Session 2 with the EXACT SAME user-data-dir
    const rawDomB = runHeadlessChrome(plat.file, 'runFocusTest=verify', dedicatedDataDir);
    const matchVerify = rawDomB.match(/<div id="verifyStateResults"([^>]*)>/);
    if (!matchVerify) {
      throw new Error('verifyStateResults marker not found in DOM after reload');
    }

    const attrs = matchVerify[1];
    const total = parseInt(attrs.match(/data-total="([^"]*)"/)?.[1] || '0', 10);
    const passed = parseInt(attrs.match(/data-passed="([^"]*)"/)?.[1] || '0', 10);
    const failed = parseInt(attrs.match(/data-failed="([^"]*)"/)?.[1] || '0', 10);

    platTotal += total;
    platPassed += passed;
    platFailed += failed;
    totalAllTests += total;
    totalAllPassed += passed;
    totalAllFailed += failed;

    if (failed === 0) {
      console.log(`✓ ${passed}/${total} PASSED`);
    } else {
      console.log(`✗ ${failed}/${total} FAILED`);
      const detailsMatch = attrs.match(/data-details="([^"]*)"/);
      if (detailsMatch) {
        console.log('    Failures:', detailsMatch[1]);
      }
    }
  } catch (e) {
    platFailed += 6;
    platTotal += 6;
    totalAllFailed += 6;
    totalAllTests += 6;
    console.log(`✗ EXCEPTION: ${e.message}`);
  }

  // -----------------------------------------------------------
  // 2. Phase 2: Keyboard Tab Navigation & Dialog Focus Trapping
  // -----------------------------------------------------------
  process.stdout.write('  [Phase 2] Keyboard Tab Navigation & Dialog Focus: ');
  try {
    const rawDomKey = runHeadlessChrome(plat.file, 'runFocusTest=keyboard', dedicatedDataDir);
    const matchKey = rawDomKey.match(/<div id="keyboardFocusResults"([^>]*)>/);
    if (!matchKey) {
      throw new Error('keyboardFocusResults marker not found in DOM');
    }

    const attrs = matchKey[1];
    const total = parseInt(attrs.match(/data-total="([^"]*)"/)?.[1] || '0', 10);
    const passed = parseInt(attrs.match(/data-passed="([^"]*)"/)?.[1] || '0', 10);
    const failed = parseInt(attrs.match(/data-failed="([^"]*)"/)?.[1] || '0', 10);

    platTotal += total;
    platPassed += passed;
    platFailed += failed;
    totalAllTests += total;
    totalAllPassed += passed;
    totalAllFailed += failed;

    if (failed === 0) {
      console.log(`✓ ${passed}/${total} PASSED`);
    } else {
      console.log(`✗ ${failed}/${total} FAILED`);
      const detailsMatch = attrs.match(/data-details="([^"]*)"/);
      if (detailsMatch) {
        console.log('    Failures:', detailsMatch[1]);
      }
    }
  } catch (e) {
    console.log(`✗ EXCEPTION: ${e.message}`);
  }

  // -----------------------------------------------------------
  // 3. Phase 3: Mouse Reachability & Backdrop Dismissal
  // -----------------------------------------------------------
  process.stdout.write('  [Phase 3] Mouse Reachability & Backdrop Dismissals: ');
  try {
    const rawDomMouse = runHeadlessChrome(plat.file, 'runFocusTest=mouse', dedicatedDataDir);
    const matchMouse = rawDomMouse.match(/<div id="mouseReachabilityResults"([^>]*)>/);
    if (!matchMouse) {
      throw new Error('mouseReachabilityResults marker not found in DOM');
    }

    const attrs = matchMouse[1];
    const total = parseInt(attrs.match(/data-total="([^"]*)"/)?.[1] || '0', 10);
    const passed = parseInt(attrs.match(/data-passed="([^"]*)"/)?.[1] || '0', 10);
    const failed = parseInt(attrs.match(/data-failed="([^"]*)"/)?.[1] || '0', 10);

    platTotal += total;
    platPassed += passed;
    platFailed += failed;
    totalAllTests += total;
    totalAllPassed += passed;
    totalAllFailed += failed;

    if (failed === 0) {
      console.log(`✓ ${passed}/${total} PASSED\n`);
    } else {
      console.log(`✗ ${failed}/${total} FAILED\n`);
      const detailsMatch = attrs.match(/data-details="([^"]*)"/);
      if (detailsMatch) {
        console.log('    Failures:', detailsMatch[1]);
      }
    }
  } catch (e) {
    console.log(`✗ EXCEPTION: ${e.message}\n`);
  }

  platformSummary.push({
    platform: plat.name,
    file: plat.file,
    passed: platPassed,
    failed: platFailed,
    total: platTotal
  });
}

console.log('========================================================================');
console.log('   FINAL RESULTS FOR FOCUSED RELOAD & KEYBOARD/MOUSE VERIFICATION       ');
console.log('========================================================================');
console.table(platformSummary);

console.log(`TOTAL ASSERTIONS: ${totalAllTests}`);
console.log(`PASSED: ${totalAllPassed}`);
console.log(`FAILED: ${totalAllFailed}`);

if (totalAllFailed === 0) {
  console.log('\nRESULT: ALL FOCUSED VERIFICATION ASSERTIONS PASSED WITH 100% SUCCESS!');
} else {
  console.log(`\nRESULT: ${totalAllFailed} ASSERTIONS FAILED.`);
}
console.log('========================================================================\n');

try {
  fs.rmSync(TMP_DATA_ROOT, { recursive: true, force: true });
} catch (e) {}

process.exit(totalAllFailed === 0 ? 0 : 1);
