/**
 * IndiChat Parameterized Browser Interaction Test Runner
 * 
 * Executes the parameterized interaction suite (preview-test-suite.js)
 * directly against the four actual platform preview pages:
 * 1. preview-web.html
 * 2. preview-desktop-macos.html
 * 3. preview-desktop-windows.html
 * 4. preview-desktop-linux.html
 * 
 * Separates Static Checks from Browser Interaction Tests.
 * Captures Page Errors, Console Errors, and Unhandled Rejections.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PREVIEW_DIR = path.resolve(__dirname);
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PLATFORMS = [
  { id: 'web', name: 'Web Browser Workspace', file: 'preview-web.html', expectedChrome: 'chrome-web' },
  { id: 'macos', name: 'macOS Native Desktop', file: 'preview-desktop-macos.html', expectedChrome: 'chrome-macos' },
  { id: 'windows', name: 'Windows 11 Native Desktop', file: 'preview-desktop-windows.html', expectedChrome: 'chrome-windows' },
  { id: 'linux', name: 'Linux GNOME Desktop', file: 'preview-desktop-linux.html', expectedChrome: 'chrome-linux' }
];

console.log('========================================================================');
console.log('   IndiChat Multi-Platform Parameterized Browser Interaction Runner     ');
console.log('========================================================================\n');

// Verify Browser Tooling
const chromeAvailable = fs.existsSync(CHROME_PATH);
if (!chromeAvailable) {
  console.warn('⚠️ WARNING: Google Chrome binary not found at ' + CHROME_PATH);
  console.warn('Treating browser interaction tests as SKIPPED (never marking as passed without execution).\n');
}

// -----------------------------------------------------------------------------
// PART 1: STATIC TEMPLATE CHECKS (Reported Separately)
// -----------------------------------------------------------------------------
console.log('------------------------------------------------------------------------');
console.log(' PART 1: STATIC CHECKS (Markup, Scripts & DOM Selectors)');
console.log('------------------------------------------------------------------------');

let staticPassed = 0;
let staticFailed = 0;

for (const p of PLATFORMS) {
  const filePath = path.join(PREVIEW_DIR, p.file);
  const exists = fs.existsSync(filePath);
  if (!exists) {
    console.error(`  ✗ [${p.id.toUpperCase()}] File missing: ${p.file}`);
    staticFailed++;
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf8');

  // Check required shared scripts
  const hasFixtures = html.includes('preview-fixtures.js');
  const hasCommon = html.includes('preview-common.js');
  const hasSuite = html.includes('preview-test-suite.js');
  const hasExpectedChrome = html.includes(p.expectedChrome);

  if (hasFixtures && hasCommon && hasSuite && hasExpectedChrome) {
    console.log(`  ✓ [${p.id.toUpperCase()}] Static checks PASS (${p.file} includes fixtures, engine, suite, & ${p.expectedChrome})`);
    staticPassed++;
  } else {
    console.error(`  ✗ [${p.id.toUpperCase()}] Static checks FAIL on ${p.file}`);
    staticFailed++;
  }
}

console.log(`\nStatic Checks Summary: ${staticPassed} / ${staticPassed + staticFailed} Passed (${staticFailed} Failed)\n`);

// -----------------------------------------------------------------------------
// PART 2: PARAMETERIZED BROWSER INTERACTION TESTS (Executed against actual pages)
// -----------------------------------------------------------------------------
console.log('------------------------------------------------------------------------');
console.log(' PART 2: PARAMETERIZED BROWSER INTERACTION TESTS (Actual Pages)');
console.log('------------------------------------------------------------------------\n');

if (!chromeAvailable) {
  console.log('Browser tooling missing: SKIPPING Browser Interaction Tests.\n');
  process.exit(staticFailed === 0 ? 0 : 1);
}

let totalAssertionsAllPlatforms = 0;
let totalPassedAllPlatforms = 0;
let totalFailedAllPlatforms = 0;
let totalPageErrors = 0;
let totalConsoleErrors = 0;
let totalUnhandledRejections = 0;

const platformReports = [];

for (const p of PLATFORMS) {
  console.log(`▶ Executing Interaction Suite on Actual Page: ${p.file} ...`);
  const filePath = path.join(PREVIEW_DIR, p.file);
  const fileUrl = `file://${filePath}?runTests=true`;
  const userDataDir = `/tmp/chrome_param_${p.id}_${Date.now()}`;

  // Run Headless Chrome with virtual time budget allowing full async suite execution
  const cmd = `"${CHROME_PATH}" --headless=new --disable-gpu --no-sandbox --user-data-dir="${userDataDir}" --virtual-time-budget=12000 --dump-dom "${fileUrl}"`;

  try {
    const rawDom = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 10 * 1024 * 1024 });

    // Extract attributes from #parameterizedTestResults
    const matchResults = rawDom.match(/<div id="parameterizedTestResults"([^>]*)>/);
    if (!matchResults) {
      console.error(`  ✗ FAIL: #parameterizedTestResults element not rendered for ${p.id}`);
      totalFailedAllPlatforms++;
      platformReports.push({
        id: p.id,
        name: p.name,
        file: p.file,
        passed: 0,
        failed: 1,
        total: 1,
        pageErrors: 1,
        consoleErrors: 1,
        unhandledRejections: 0,
        failures: ['Suite did not render results element']
      });
      continue;
    }

    const attrs = matchResults[1];
    const getAttr = (name) => {
      const m = attrs.match(new RegExp(`data-${name}="([^"]*)"`));
      return m ? m[1] : null;
    };

    const total = parseInt(getAttr('total') || '0', 10);
    const passed = parseInt(getAttr('passed') || '0', 10);
    const failed = parseInt(getAttr('failed') || '0', 10);
    const pageErrors = parseInt(getAttr('page-errors') || '0', 10);
    const consoleErrors = parseInt(getAttr('console-errors') || '0', 10);
    const unhandledRejections = parseInt(getAttr('unhandled-rejections') || '0', 10);
    const durationMs = parseInt(getAttr('duration-ms') || '0', 10);

    totalAssertionsAllPlatforms += total;
    totalPassedAllPlatforms += passed;
    totalFailedAllPlatforms += failed;
    totalPageErrors += pageErrors;
    totalConsoleErrors += consoleErrors;
    totalUnhandledRejections += unhandledRejections;

    // Check for any failed assertions in the DOM list
    const failureMatches = rawDom.match(/✗ #[0-9]+ [^<]+/g) || [];

    // Parse PARAM_TEST_SUMMARY_JSON if available in rawDom or console
    const jsonMatch = rawDom.match(/<script id="paramTestSummaryJson" type="application\/json">([^<]*)<\/script>/);
    let summaryJson = null;
    if (jsonMatch) {
      try {
        summaryJson = JSON.parse(jsonMatch[1]);
      } catch (e) {}
    }

    platformReports.push({
      id: p.id,
      name: p.name,
      file: p.file,
      total,
      passed,
      failed,
      pageErrors,
      consoleErrors,
      unhandledRejections,
      durationMs,
      failures: failureMatches,
      summaryJson
    });

    if (failed === 0 && pageErrors === 0 && consoleErrors === 0 && unhandledRejections === 0) {
      console.log(`  ✓ ALL ${passed}/${total} ASSERTIONS PASSED on ${p.file} (${durationMs}ms)`);
      console.log(`    Page Errors: 0 | Console Errors: 0 | Unhandled Rejections: 0\n`);
    } else {
      console.error(`  ✗ DEFECTS FOUND on ${p.file}:`);
      console.error(`    Passed: ${passed}/${total} | Failed: ${failed}`);
      console.error(`    Page Errors: ${pageErrors} | Console Errors: ${consoleErrors} | Unhandled Rejections: ${unhandledRejections}`);
      if (summaryJson && summaryJson.consoleErrors && summaryJson.consoleErrors.length > 0) {
        console.error('    Captured Console Errors:', summaryJson.consoleErrors);
      }
      if (summaryJson && summaryJson.failures) {
        summaryJson.failures.forEach(f => console.error(`    FAILED: ${f.name} -> ${f.extraInfo || ''}`));
      } else {
        failureMatches.forEach(f => console.error(`    ${f}`));
      }
      console.log('');
    }
  } catch (err) {
    console.error(`  ✗ Execution error launching Chrome for ${p.id}: ${err.message}`);
    totalFailedAllPlatforms++;
  }
}

// -----------------------------------------------------------------------------
// FINAL EXECUTIVE REPORT
// -----------------------------------------------------------------------------
console.log('========================================================================');
console.log('   FINAL BROWSER INTERACTION TEST RESULTS ACROSS ALL 4 ACTUAL PAGES     ');
console.log('========================================================================\n');

console.table(platformReports.map(r => ({
  Platform: r.name,
  File: r.file,
  Passed: r.passed,
  Failed: r.failed,
  Total: r.total,
  'Page Errors': r.pageErrors,
  'Console Errors': r.consoleErrors,
  Rejections: r.unhandledRejections,
  Duration: `${r.durationMs}ms`
})));

console.log(`\nOVERALL STATUS:`);
console.log(`Total Interaction Assertions: ${totalAssertionsAllPlatforms}`);
console.log(`Passed: ${totalPassedAllPlatforms}`);
console.log(`Failed: ${totalFailedAllPlatforms}`);
console.log(`Total Page Errors: ${totalPageErrors}`);
console.log(`Total Console Errors: ${totalConsoleErrors}`);
console.log(`Total Unhandled Rejections: ${totalUnhandledRejections}`);

const allClean = (totalFailedAllPlatforms === 0 && totalPageErrors === 0 && totalConsoleErrors === 0 && totalUnhandledRejections === 0);
console.log(`\nRESULT: ${allClean ? 'ALL TESTS PASSED CLEANLY' : 'VERIFICATION FAILED'}`);
console.log('========================================================================\n');

process.exit(allClean ? 0 : 1);
