#!/usr/bin/env node
/**
 * scripts/build-ios.js
 * 
 * Automated cross-platform iOS build engine for IndiChat:
 *  - Verifies Xcode, xcodebuild, and CocoaPods toolchains
 *  - Automatically generates native iOS project via `expo prebuild --platform ios` if missing
 *  - Synchronizes official IndiChat multi-resolution AppIcon assets
 *  - Builds native iOS Simulator .app bundle (no signing required) or Device .xcarchive
 *  - Packages build artifacts into `release/ios/`
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const mobileDir = path.join(rootDir, 'apps', 'mobile');
const iosDir = path.join(mobileDir, 'ios');
const releaseDir = path.join(rootDir, 'release');
const releaseIosDir = path.join(releaseDir, 'ios');
const logoDir = path.join(rootDir, 'logo', 'ios');

// Ensure standard release directory structure exists
fs.mkdirSync(releaseIosDir, { recursive: true });

// Parse CLI flags
const args = process.argv.slice(2);
const buildArchive = args.includes('--archive') || args.includes('-archive') || args.includes('--device');
const buildSim = !buildArchive || args.includes('--sim') || args.includes('--simulator');
const cleanFirst = args.includes('--clean') || args.includes('-clean');
const forcePrebuild = args.includes('--prebuild');

console.log('====================================================');
console.log('  IndiChat iOS Build Automation');
console.log('====================================================');
console.log(`Root Directory:       ${rootDir}`);
console.log(`iOS Project:          ${iosDir}`);
console.log(`Release Output:       ${releaseIosDir}`);
console.log(`Build Simulator App:  ${buildSim ? 'YES' : 'NO'}`);
console.log(`Build Device Archive: ${buildArchive ? 'YES' : 'NO'}`);
console.log(`Clean First:          ${cleanFirst ? 'YES' : 'NO'}`);

// 1. Verify Platform
if (process.platform !== 'darwin') {
  console.error('\n❌ Error: Building iOS applications requires macOS with Xcode installed.');
  process.exit(1);
}

// 2. Verify Xcode toolchain
const xcodeCheck = spawnSync('xcode-select', ['-p'], { encoding: 'utf8' });
if (xcodeCheck.status !== 0) {
  console.error('\n❌ Error: Xcode Developer tools not found. Please install Xcode.');
  process.exit(1);
}

const xcodeVer = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
if (xcodeVer.status === 0) {
  const firstLine = xcodeVer.stdout.split('\n')[0].trim();
  console.log(`Xcode Version:        ${firstLine}`);
}
console.log('====================================================\n');

// 3. Ensure CocoaPods is in PATH
const brewBin = '/opt/homebrew/bin';
if (fs.existsSync(brewBin) && !process.env.PATH.includes(brewBin)) {
  process.env.PATH = `${brewBin}:${process.env.PATH}`;
}

// Ensure NODE_PATH for monorepo resolution
const mobileNodeModules = path.join(mobileDir, 'node_modules');
const rootNodeModules = path.join(rootDir, 'node_modules');
const nodePaths = [mobileNodeModules, rootNodeModules];
if (process.env.NODE_PATH) {
  nodePaths.push(process.env.NODE_PATH);
}
process.env.NODE_PATH = nodePaths.join(path.delimiter);

// 4. Prebuild iOS project if not yet prebuilt or explicitly requested
const projectExists = fs.existsSync(path.join(iosDir, 'IndiChat.xcworkspace')) || fs.existsSync(path.join(iosDir, 'IndiChat.xcodeproj'));
if (!projectExists || forcePrebuild) {
  console.log('⚙️  Step 1: Prebuilding native iOS project via Expo...');
  const prebuildRes = spawnSync('npx', ['expo', 'prebuild', '--platform', 'ios', '--no-install'], {
    cwd: mobileDir,
    stdio: 'inherit',
    env: process.env,
    shell: true
  });
  if (prebuildRes.status !== 0) {
    console.error('\n❌ Error: Expo iOS prebuild failed.');
    process.exit(prebuildRes.status || 1);
  }

  // Run pod install in ios directory
  console.log('\n📦 Step 2: Installing CocoaPods dependencies...');
  const podRes = spawnSync('pod', ['install'], {
    cwd: iosDir,
    stdio: 'inherit',
    env: process.env,
    shell: true
  });
  if (podRes.status !== 0) {
    console.error('\n❌ Error: CocoaPods install failed.');
    process.exit(podRes.status || 1);
  }
}

// 5. Synchronize AppIcon assets
console.log('\n🎨 Step 3: Synchronizing iOS AppIcon branding assets...');
const xcassetsIconDir = path.join(iosDir, 'IndiChat', 'Images.xcassets', 'AppIcon.appiconset');
const sourceIconDir = path.join(logoDir, 'AppIcon.appiconset');
if (fs.existsSync(sourceIconDir) && fs.existsSync(xcassetsIconDir)) {
  const files = fs.readdirSync(sourceIconDir);
  for (const file of files) {
    fs.copyFileSync(path.join(sourceIconDir, file), path.join(xcassetsIconDir, file));
  }
  console.log('  ✔ Synced AppIcon.appiconset with IndiChat branded resolutions');
}

// Copy icon to release/ios
const icon1024 = path.join(logoDir, 'icon-1024x1024.png');
if (fs.existsSync(icon1024)) {
  fs.copyFileSync(icon1024, path.join(releaseIosDir, 'icon.png'));
}

// 6. Clean if requested
const buildOutputDir = path.join(iosDir, 'build');
if (cleanFirst && fs.existsSync(buildOutputDir)) {
  console.log('\n🧹 Cleaning previous iOS build output...');
  fs.rmSync(buildOutputDir, { recursive: true, force: true });
}

// 7. Execute Build
const workspacePath = path.join(iosDir, 'IndiChat.xcworkspace');
const projectPath = path.join(iosDir, 'IndiChat.xcodeproj');
const isWorkspace = fs.existsSync(workspacePath);
const projectArg = isWorkspace ? ['-workspace', 'IndiChat.xcworkspace'] : ['-project', 'IndiChat.xcodeproj'];

if (buildSim) {
  console.log('\n🚀 Step 4: Compiling iOS Simulator Release Build (:IndiChat)...');
  const simArgs = [
    ...projectArg,
    '-scheme', 'IndiChat',
    '-configuration', 'Release',
    '-sdk', 'iphonesimulator',
    '-destination', 'generic/platform=iOS Simulator',
    '-derivedDataPath', 'build',
    'CODE_SIGNING_ALLOWED=NO',
    'COMPILER_INDEX_STORE_ENABLE=NO'
  ];

  console.log(`>>> xcodebuild ${simArgs.join(' ')}\n`);
  const buildResult = spawnSync('xcodebuild', simArgs, {
    cwd: iosDir,
    stdio: 'inherit',
    env: process.env
  });

  if (buildResult.status !== 0) {
    console.error(`\n❌ Error: xcodebuild failed with exit code ${buildResult.status}.`);
    process.exit(buildResult.status || 1);
  }

  // Find generated .app bundle
  const appSource = path.join(iosDir, 'build', 'Build', 'Products', 'Release-iphonesimulator', 'IndiChat.app');
  if (fs.existsSync(appSource)) {
    const appDest = path.join(releaseIosDir, 'IndiChat.app');
    if (fs.existsSync(appDest)) {
      fs.rmSync(appDest, { recursive: true, force: true });
    }
    // Copy .app bundle recursively
    spawnSync('cp', ['-R', appSource, appDest]);

    // Create a convenient zip for distribution
    const zipDest = path.join(releaseIosDir, 'IndiChat-Simulator.zip');
    spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appDest, zipDest]);

    console.log('\n✔ iOS Simulator Build Complete:');
    console.log(`   - App Bundle:   ${appDest}`);
    console.log(`   - Zipped App:   ${zipDest}`);
  }
}

if (buildArchive) {
  console.log('\n📱 Compiling iOS Device Archive (:IndiChat)...');
  const archivePath = path.join(releaseIosDir, 'IndiChat.xcarchive');
  const archiveArgs = [
    ...projectArg,
    '-scheme', 'IndiChat',
    '-configuration', 'Release',
    '-sdk', 'iphoneos',
    '-archivePath', archivePath,
    'archive'
  ];

  const archiveResult = spawnSync('xcodebuild', archiveArgs, {
    cwd: iosDir,
    stdio: 'inherit',
    env: process.env
  });

  if (archiveResult.status !== 0) {
    console.warn(`\n⚠️  Note: Archive compilation requires code signing configured in Xcode.`);
  } else {
    console.log(`✔ iOS Archive Complete: ${archivePath}`);
  }
}

console.log('\n====================================================');
console.log('  iOS Build Summary & Usage Instructions');
console.log('====================================================');
console.log(`All artifacts are stored in: ${releaseIosDir}\n`);
console.log('📱 To launch IndiChat on an iOS Simulator:');
console.log('   xcrun simctl boot "iPhone 16" (or launch Simulator.app)');
console.log(`   xcrun simctl install booted "${path.join(releaseIosDir, 'IndiChat.app')}"`);
console.log('   xcrun simctl launch booted com.indichat.app');
console.log('\n🛠️  To open and configure Signing in Xcode:');
console.log(`   open "${workspacePath}"`);
console.log('====================================================\n');
