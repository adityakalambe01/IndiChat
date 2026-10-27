#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Define paths relative to root directory
const rootDir = path.resolve(__dirname, '..');
const mobileDir = path.join(rootDir, 'apps', 'mobile');
const androidDir = path.join(mobileDir, 'android');
const releaseDir = path.join(rootDir, 'release');
const releaseAndroidDir = path.join(releaseDir, 'android');

// Ensure standard release directory structure exists
const releaseFolders = ['android', 'ios', 'windows', 'linux'];
for (const folder of releaseFolders) {
  const dirPath = path.join(releaseDir, folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Synchronize store and distribution graphics
const androidIconSrc = path.join(rootDir, 'logo', 'android', 'icon-1024x1024.png');
const playstoreSrc = path.join(rootDir, 'logo', 'android', 'playstore-512.png');
if (fs.existsSync(androidIconSrc)) {
  fs.copyFileSync(androidIconSrc, path.join(releaseAndroidDir, 'icon.png'));
}
if (fs.existsSync(playstoreSrc)) {
  fs.copyFileSync(playstoreSrc, path.join(releaseAndroidDir, 'playstore-512.png'));
}

// Ensure Android SDK environment variables are set
if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  const localPropsPath = path.join(androidDir, 'local.properties');
  if (fs.existsSync(localPropsPath)) {
    const content = fs.readFileSync(localPropsPath, 'utf8');
    const match = content.match(/sdk\.dir\s*=\s*(.+)/);
    if (match && match[1]) {
      const sdkDir = match[1].trim().replace(/\\\\/g, '/').replace(/\\/g, '/');
      process.env.ANDROID_HOME = sdkDir;
      process.env.ANDROID_SDK_ROOT = sdkDir;
    }
  }
}

// Fallback to default user SDK path if still not defined
if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  const defaultSdk = path.join(process.env.HOME || '', 'Android', 'Sdk');
  if (fs.existsSync(defaultSdk)) {
    process.env.ANDROID_HOME = defaultSdk;
    process.env.ANDROID_SDK_ROOT = defaultSdk;
  }
}

// Ensure Java environment is configured (Java 17/21 compatibility for Gradle)
if (!process.env.JAVA_HOME) {
  const candidateJavaHomes = [
    path.join(process.env.HOME || '', '.jdks', 'temurin-21'),
    path.join(process.env.HOME || '', '.jdks', 'corretto-21'),
    path.join(process.env.HOME || '', '.jdks', 'temurin-17'),
    '/usr/lib/jvm/java-21-openjdk-amd64',
    '/usr/lib/jvm/java-17-openjdk-amd64'
  ];
  for (const jhome of candidateJavaHomes) {
    if (fs.existsSync(jhome)) {
      process.env.JAVA_HOME = jhome;
      process.env.PATH = `${path.join(jhome, 'bin')}:${process.env.PATH}`;
      break;
    }
  }

  if (!process.env.JAVA_HOME && process.platform === 'darwin') {
    try {
      const jh = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' });
      if (jh.status === 0 && jh.stdout.trim()) {
        process.env.JAVA_HOME = jh.stdout.trim();
      }
    } catch (e) {
      // Ignore error if java_home binary is unavailable
    }
  }
}

// Parse CLI flags
const args = process.argv.slice(2);
const buildApk = args.includes('--apk') || args.includes('-apk') || (!args.includes('--bundle') && !args.includes('-bundle') && !args.includes('--aab'));
const buildBundle = args.includes('--bundle') || args.includes('-bundle') || args.includes('--aab') || (!args.includes('--apk') && !args.includes('-apk'));
const cleanBeforeBuild = args.includes('--clean');

console.log('====================================================');
console.log('  IndiChat Android Build Automation');
console.log('====================================================');
console.log(`Root Directory:       ${rootDir}`);
console.log(`Android Project:      ${androidDir}`);
console.log(`Release Output:       ${releaseAndroidDir}`);
console.log(`Build APK:            ${buildApk ? 'YES' : 'NO'}`);
console.log(`Build Bundle (.aab):  ${buildBundle ? 'YES' : 'NO'}`);
console.log(`Clean First:          ${cleanBeforeBuild ? 'YES' : 'NO'}`);
if (process.env.ANDROID_HOME) {
  console.log(`ANDROID_HOME:         ${process.env.ANDROID_HOME}`);
}
if (process.env.JAVA_HOME) {
  console.log(`JAVA_HOME:            ${process.env.JAVA_HOME}`);
}
console.log('====================================================\n');

// Ensure gradlew has executable permissions on unix-like systems
const gradlewPath = path.join(androidDir, 'gradlew');
if (process.platform !== 'win32' && fs.existsSync(gradlewPath)) {
  try {
    fs.chmodSync(gradlewPath, '755');
  } catch (err) {
    // Ignore error if permission setting fails
  }
}

const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

function runGradleTask(taskName, description) {
  console.log(`>>> Running task: ${description} (${taskName})...`);
  const result = spawnSync(gradleCommand, [taskName, '--no-daemon'], {
    cwd: androidDir,
    stdio: 'inherit',
    env: process.env,
    shell: true
  });

  if (result.status !== 0) {
    console.error(`\n❌ Error: Gradle task '${taskName}' failed with exit code ${result.status}.`);
    process.exit(result.status || 1);
  }
}

if (cleanBeforeBuild) {
  runGradleTask('clean', 'Cleaning Android build caches');
}

// 1. Build APK if requested
if (buildApk) {
  runGradleTask(':app:assembleRelease', 'Building Release APK');

  const defaultApkSource = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (fs.existsSync(defaultApkSource)) {
    const destApk = path.join(releaseAndroidDir, 'IndiChat.apk');
    const destApkRelease = path.join(releaseAndroidDir, 'app-release.apk');
    
    fs.copyFileSync(defaultApkSource, destApk);
    fs.copyFileSync(defaultApkSource, destApkRelease);

    const stats = fs.statSync(destApk);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n✔ APK Build Complete:');
    console.log(`   - Destination: ${destApk}`);
    console.log(`   - Alternate:   ${destApkRelease}`);
    console.log(`   - File size:   ${sizeInMB} MB`);
  } else {
    console.warn(`\n⚠ Warning: Expected APK output at ${defaultApkSource} was not found.`);
  }
}

// 2. Build Bundle (.aab) if requested
if (buildBundle) {
  runGradleTask(':app:bundleRelease', 'Building Google Play App Bundle (.aab)');

  const defaultBundleSource = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  if (fs.existsSync(defaultBundleSource)) {
    const destBundle = path.join(releaseAndroidDir, 'IndiChat.aab');
    const destBundleRelease = path.join(releaseAndroidDir, 'app-release.aab');

    fs.copyFileSync(defaultBundleSource, destBundle);
    fs.copyFileSync(defaultBundleSource, destBundleRelease);

    const stats = fs.statSync(destBundle);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n✔ App Bundle (.aab) Build Complete:');
    console.log(`   - Destination: ${destBundle}`);
    console.log(`   - Alternate:   ${destBundleRelease}`);
    console.log(`   - File size:   ${sizeInMB} MB`);
  } else {
    console.warn(`\n⚠ Warning: Expected Bundle output at ${defaultBundleSource} was not found.`);
  }
}

console.log('\n====================================================');
console.log('  Build Summary & Usage Instructions');
console.log('====================================================');
console.log(`All artifacts are stored in: ${releaseAndroidDir}`);
console.log('\n📱 To install APK directly to your connected Android phone or emulator:');
console.log('   adb install -r release/android/IndiChat.apk');
console.log('   (or transfer release/android/IndiChat.apk to your phone and open it)');
console.log('\n🚀 To publish to Google Play Store Console:');
console.log('   Upload: release/android/IndiChat.aab');
console.log('====================================================\n');
