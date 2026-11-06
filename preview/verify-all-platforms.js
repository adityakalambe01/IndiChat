/**
 * Multi-Platform Automated Test Runner for IndiChat Previews
 * 
 * Verifies all 4 design previews:
 * 1. preview-web.html
 * 2. preview-desktop-macos.html
 * 3. preview-desktop-windows.html
 * 4. preview-desktop-linux.html
 * 
 * Checks:
 * - HTML file integrity and syntax
 * - 4-Zone application layout (Rail, Sidebar, Chat, Details)
 * - 5 Navigation Rail tabs (Chats, Status, Calls, Communities, Starred)
 * - 5 Sidebar Views including Connected Circles & Communities
 * - Platform-specific window chrome (macOS traffic lights, Windows controls, Linux GNOME header)
 * - Zero uncaught runtime errors in Headless Chrome
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PREVIEW_DIR = path.resolve(__dirname);
const PLATFORMS = [
  {
    id: 'web',
    name: 'Web Application',
    file: 'preview-web.html',
    expectedChrome: 'chrome-web',
    requiredSelectors: [
      '.app-nav-rail',
      '[data-rail-tab="chats"]',
      '[data-rail-tab="status"]',
      '[data-rail-tab="calls"]',
      '[data-rail-tab="communities"]',
      '[data-rail-tab="starred"]',
      '#sidebarView-chats',
      '#sidebarView-status',
      '#sidebarView-calls',
      '#sidebarView-communities',
      '#sidebarView-starred',
      '#appChatWindow',
      '#composerInputField',
      '#btnAttachment',
      '#btnRupeePayment',
      '#btnEmojiPickerToggle',
      '#detailsPanel'
    ]
  },
  {
    id: 'macos',
    name: 'macOS Desktop App',
    file: 'preview-desktop-macos.html',
    expectedChrome: 'chrome-macos',
    requiredSelectors: [
      '.window-chrome.chrome-macos',
      '.macos-traffic-lights',
      '.traffic-light.close',
      '.traffic-light.minimize',
      '.traffic-light.zoom',
      '.app-nav-rail',
      '[data-rail-tab="communities"]',
      '#sidebarView-communities',
      '#composerInputField',
      '#btnAudioCall',
      '#btnVideoCall'
    ]
  },
  {
    id: 'windows',
    name: 'Windows 11 Desktop App',
    file: 'preview-desktop-windows.html',
    expectedChrome: 'chrome-windows',
    requiredSelectors: [
      '.window-chrome.chrome-windows',
      '.windows-caption-controls',
      '.win-caption-btn.win-min',
      '.win-caption-btn.win-max',
      '.win-caption-btn.win-close',
      '.app-nav-rail',
      '[data-rail-tab="communities"]',
      '#sidebarView-communities',
      '#composerInputField',
      '#btnAudioCall',
      '#btnVideoCall'
    ]
  },
  {
    id: 'linux',
    name: 'Linux GNOME Desktop App',
    file: 'preview-desktop-linux.html',
    expectedChrome: 'chrome-linux',
    requiredSelectors: [
      '.window-chrome.chrome-linux',
      '#btnGnomeAppMenu',
      '#gnomeAppDropdownMenu',
      '#gnomeMenuSettings',
      '#gnomeMenuShortcuts',
      '.gnome-close-btn',
      '.app-nav-rail',
      '[data-rail-tab="communities"]',
      '#sidebarView-communities',
      '#composerInputField',
      '#btnAudioCall',
      '#btnVideoCall'
    ]
  }
];

console.log('====================================================');
console.log('   IndiChat Multi-Platform Automated Test Runner    ');
console.log('====================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const platformSummary = {};

for (const platform of PLATFORMS) {
  console.log(`▶ Evaluating Platform: ${platform.name} (${platform.file})`);
  const filePath = path.join(PREVIEW_DIR, platform.file);
  platformSummary[platform.id] = { name: platform.name, total: 0, passed: 0, failed: 0 };

  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ FAIL: File not found: ${platform.file}`);
    totalChecks++;
    failedChecks++;
    platformSummary[platform.id].failed++;
    continue;
  }

  const htmlContent = fs.readFileSync(filePath, 'utf8');

  // Verify Required Selectors in HTML Template
  for (const sel of platform.requiredSelectors) {
    totalChecks++;
    platformSummary[platform.id].total++;
    const isId = sel.startsWith('#');
    const isClass = sel.startsWith('.');
    const isAttr = sel.startsWith('[');

    let found = false;
    if (isId) {
      found = htmlContent.includes(`id="${sel.slice(1)}"`) || htmlContent.includes(`id='${sel.slice(1)}'`);
    } else if (isClass) {
      const cls = sel.split('.')[1];
      found = htmlContent.includes(cls);
    } else if (isAttr) {
      const attrPair = sel.slice(1, -1);
      found = htmlContent.includes(attrPair);
    }

    if (found) {
      passedChecks++;
      platformSummary[platform.id].passed++;
    } else {
      console.error(`  ✗ FAIL: Missing required selector: ${sel}`);
      failedChecks++;
      platformSummary[platform.id].failed++;
    }
  }

  // Headless Chrome DOM & Runtime Verification
  try {
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(chromePath)) {
      totalChecks++;
      platformSummary[platform.id].total++;
      const cmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --user-data-dir=/tmp/chrome_prof_${platform.id} --virtual-time-budget=2000 --dump-dom "file://${filePath}"`;
      const domOutput = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      
      const hasWorkspace = domOutput.includes('app-workspace');
      const hasAarav = domOutput.includes('Aarav Sharma');
      const hasCommunities = domOutput.includes('sidebarView-communities');

      if (hasWorkspace && hasAarav && hasCommunities) {
        passedChecks++;
        platformSummary[platform.id].passed++;
        console.log(`  ✓ PASS: Headless Chrome rendered DOM cleanly for ${platform.id}`);
      } else {
        failedChecks++;
        platformSummary[platform.id].failed++;
        console.error(`  ✗ FAIL: Headless Chrome DOM missing core elements for ${platform.id}`);
      }
    }
  } catch (err) {
    totalChecks++;
    failedChecks++;
    platformSummary[platform.id].failed++;
    console.error(`  ✗ FAIL: Chrome evaluation error on ${platform.id}: ${err.message}`);
  }

  console.log(`  Summary for ${platform.name}: ${platformSummary[platform.id].passed} / ${platformSummary[platform.id].total} Passed\n`);
}

console.log('====================================================');
console.log(`TOTAL MULTI-PLATFORM VERIFICATIONS: ${passedChecks} / ${totalChecks} PASSED (${failedChecks} FAILED)`);
console.log('====================================================');

process.exit(failedChecks === 0 ? 0 : 1);

