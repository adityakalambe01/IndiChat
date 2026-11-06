#!/usr/bin/env node
/**
 * scripts/sync-logos.js
 * 
 * Automatically synchronizes platform-adapted logos and icons from the `logo/` directory
 * to their respective target applications:
 *  - apps/mobile  (Expo assets, Android mipmaps, drawables, splashscreens)
 *  - apps/desktop (Linux multi-resolution icons, hicolor XDG theme, Windows icon.ico)
 *  - apps/web     (Favicons, apple-touch-icon, PWA manifest icons)
 *  - release/     (Distribution-ready icons for Android, Linux, Windows, iOS)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const logoDir = path.join(rootDir, 'logo');
const appsDir = path.join(rootDir, 'apps');
const releaseDir = path.join(rootDir, 'release');

console.log('====================================================');
console.log('  IndiChat Cross-Platform Logo & Icon Synchronizer  ');
console.log('====================================================\n');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`  ✔ [COPY] ${path.relative(rootDir, src)} -> ${path.relative(rootDir, dest)}`);
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------
// 1. SYNC TO APPS/DESKTOP
// ---------------------------------------------------------
console.log('🖥️  1. Synchronizing Desktop Icons (apps/desktop)...');
const desktopAssetsDir = path.join(appsDir, 'desktop', 'assets');
const desktopIconsDir = path.join(desktopAssetsDir, 'icons');
const desktopHicolorDir = path.join(desktopAssetsDir, 'hicolor');
ensureDir(desktopIconsDir);

// Main 1024x1024 desktop icon
copyFile(
  path.join(logoDir, 'linux', 'icon-1024x1024.png'),
  path.join(desktopAssetsDir, 'icon.png')
);

// Windows native icon for desktop
if (fs.existsSync(path.join(logoDir, 'windows', 'icon.ico'))) {
  copyFile(
    path.join(logoDir, 'windows', 'icon.ico'),
    path.join(desktopAssetsDir, 'icon.ico')
  );
}

// Multi-resolution Linux icons (16x16 to 1024x1024)
const linuxIconSizes = ['16x16', '24x24', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512', '1024x1024'];
for (const size of linuxIconSizes) {
  const src = path.join(logoDir, 'linux', `icon-${size}.png`);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(desktopIconsDir, `${size}.png`));
  }
}

// Full XDG hicolor theme
copyDirRecursive(path.join(logoDir, 'linux', 'hicolor'), desktopHicolorDir);

// ---------------------------------------------------------
// 2. SYNC TO APPS/MOBILE
// ---------------------------------------------------------
console.log('\n📱 2. Synchronizing Mobile Icons (apps/mobile)...');
const mobileAssetsDir = path.join(appsDir, 'mobile', 'assets');
const androidResDir = path.join(appsDir, 'mobile', 'android', 'app', 'src', 'main', 'res');
ensureDir(mobileAssetsDir);

// Expo Assets
copyFile(path.join(logoDir, 'android', 'icon-1024x1024.png'), path.join(mobileAssetsDir, 'icon.png'));
copyFile(path.join(logoDir, 'android', 'icon-512x512.png'), path.join(mobileAssetsDir, 'splash-icon.png'));
copyFile(path.join(logoDir, 'android', 'icon-48x48.png'), path.join(mobileAssetsDir, 'favicon.png'));

// Adaptive icon for Expo
copyFile(path.join(logoDir, 'android', 'icon-1024x1024.png'), path.join(mobileAssetsDir, 'adaptive-icon.png'));

// Native Android Mipmaps
const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const fgSizes = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432
};
const splashSizes = {
  mdpi: 288,
  hdpi: 432,
  xhdpi: 576,
  xxhdpi: 864,
  xxxhdpi: 1152
};

for (const density of densities) {
  const targetMipmapDir = path.join(androidResDir, `mipmap-${density}`);
  const srcMipmapDir = path.join(logoDir, 'android', `mipmap-${density}`);
  ensureDir(targetMipmapDir);

  // Copy standard and round launcher icons
  copyFile(path.join(srcMipmapDir, 'ic_launcher.png'), path.join(targetMipmapDir, 'ic_launcher.png'));
  copyFile(path.join(srcMipmapDir, 'ic_launcher_round.png'), path.join(targetMipmapDir, 'ic_launcher_round.png'));

  // Remove stale webp versions if present to avoid Gradle duplicate resource collisions
  const staleWebpFiles = [
    path.join(targetMipmapDir, 'ic_launcher.webp'),
    path.join(targetMipmapDir, 'ic_launcher_round.webp'),
    path.join(targetMipmapDir, 'ic_launcher_foreground.webp')
  ];
  for (const stale of staleWebpFiles) {
    if (fs.existsSync(stale)) {
      fs.unlinkSync(stale);
      console.log(`  🗑️  [CLEAN] Removed stale ${path.relative(rootDir, stale)}`);
    }
  }
}

// Generate adaptive foreground and splashscreen images using Python PIL if available
try {
  const pythonScript = `
from PIL import Image
import os

fg_src = '${path.join(logoDir, 'android', 'adaptive-foreground.png')}'
splash_src = '${path.join(logoDir, 'android', 'icon-1024x1024.png')}'
res_dir = '${androidResDir}'

if os.path.exists(fg_src):
    fg_im = Image.open(fg_src)
    for density, size in ${JSON.stringify(fgSizes)}.items():
        resized = fg_im.resize((size, size), Image.Resampling.LANCZOS)
        out_p = os.path.join(res_dir, f'mipmap-{density}', 'ic_launcher_foreground.png')
        resized.save(out_p, 'PNG')

if os.path.exists(splash_src):
    sp_im = Image.open(splash_src)
    for density, size in ${JSON.stringify(splashSizes)}.items():
        resized = sp_im.resize((size, size), Image.Resampling.LANCZOS)
        out_dir = os.path.join(res_dir, f'drawable-{density}')
        os.makedirs(out_dir, exist_ok=True)
        resized.save(os.path.join(out_dir, 'splashscreen_logo.png'), 'PNG')

print("PYTHON_RESIZING_DONE")
`;
  const result = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
  if (result.includes('PYTHON_RESIZING_DONE')) {
    console.log('  ✔ [GENERATE] Generated Android adaptive foreground & splashscreen densities');
  }
} catch (err) {
  console.warn('  ⚠️ Note: Python PIL not invoked for extra density scaling; using base resolution.');
}

// ---------------------------------------------------------
// 3. SYNC TO APPS/WEB
// ---------------------------------------------------------
console.log('\n🌐 3. Synchronizing Web Assets (apps/web)...');
const webPublicDir = path.join(appsDir, 'web', 'public');
ensureDir(webPublicDir);

// Favicon (.ico and .png)
copyFile(path.join(logoDir, 'windows', 'icon.ico'), path.join(webPublicDir, 'favicon.ico'));
copyFile(path.join(logoDir, 'original', 'icon-32x32.png'), path.join(webPublicDir, 'favicon.png'));

// Apple Touch Icon (iOS 180x180)
copyFile(
  path.join(logoDir, 'ios', 'AppIcon.appiconset', 'icon-60@3x.png'),
  path.join(webPublicDir, 'apple-touch-icon.png')
);

// PWA / App Manifest icons
const logo192Src = fs.existsSync(path.join(logoDir, 'original', 'icon-192x192.png'))
  ? path.join(logoDir, 'original', 'icon-192x192.png')
  : path.join(logoDir, 'android', 'icon-192x192.png');
copyFile(logo192Src, path.join(webPublicDir, 'logo-192.png'));
copyFile(path.join(logoDir, 'original', 'icon-512x512.png'), path.join(webPublicDir, 'logo-512.png'));

// ---------------------------------------------------------
// 4. SYNC TO RELEASE/
// ---------------------------------------------------------
console.log('\n📦 4. Synchronizing Release Distribution Folders (release/)...');

// Linux Release
copyFile(path.join(logoDir, 'linux', 'icon-1024x1024.png'), path.join(releaseDir, 'linux', 'icon.png'));
copyDirRecursive(path.join(logoDir, 'linux', 'hicolor'), path.join(releaseDir, 'linux', 'hicolor'));

// Android Release
copyFile(path.join(logoDir, 'android', 'icon-1024x1024.png'), path.join(releaseDir, 'android', 'icon.png'));
copyFile(path.join(logoDir, 'android', 'playstore-512.png'), path.join(releaseDir, 'android', 'playstore-512.png'));

// Windows Release
copyFile(path.join(logoDir, 'windows', 'icon.ico'), path.join(releaseDir, 'windows', 'icon.ico'));
copyFile(path.join(logoDir, 'windows', 'icon-1024x1024.png'), path.join(releaseDir, 'windows', 'icon.png'));
const winLogos = ['Square150x150Logo.png', 'Square310x310Logo.png', 'Square44x44Logo.png', 'Square71x71Logo.png', 'StoreLogo.png'];
for (const logo of winLogos) {
  const p = path.join(logoDir, 'windows', logo);
  if (fs.existsSync(p)) {
    copyFile(p, path.join(releaseDir, 'windows', logo));
  }
}

// iOS Release
copyDirRecursive(path.join(logoDir, 'ios', 'AppIcon.appiconset'), path.join(releaseDir, 'ios', 'AppIcon.appiconset'));
copyFile(path.join(logoDir, 'ios', 'icon-1024x1024.png'), path.join(releaseDir, 'ios', 'icon.png'));

console.log('\n====================================================');
console.log('  Logo Synchronization Successfully Completed!  ');
console.log('====================================================\n');
