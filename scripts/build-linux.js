#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Define paths
const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'apps', 'desktop');
const webDir = path.join(rootDir, 'apps', 'web');
const webDistDir = path.join(webDir, 'dist');
const desktopDistWebDir = path.join(desktopDir, 'dist-web');
const desktopDistBinDir = path.join(desktopDir, 'dist-bin');
const releaseDir = path.join(rootDir, 'release');
const releaseLinuxDir = path.join(releaseDir, 'linux');

// Ensure standard release directory structure exists
const releaseFolders = ['android', 'ios', 'windows', 'linux'];
for (const folder of releaseFolders) {
  const dirPath = path.join(releaseDir, folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Parse CLI flags
const args = process.argv.slice(2);
const cleanBeforeBuild = args.includes('--clean');
const buildAppImageOnly = args.includes('--appimage') || args.includes('-appimage');
const buildDebOnly = args.includes('--deb') || args.includes('-deb');
const buildSnapOnly = args.includes('--snap') || args.includes('-snap');
const buildTarOnly = args.includes('--tar') || args.includes('-tar');
const buildAll = args.includes('--all') || (!buildAppImageOnly && !buildDebOnly && !buildSnapOnly && !buildTarOnly);

let targets = [];
if (buildAll) {
  targets = ['AppImage', 'deb', 'tar.gz'];
} else {
  if (buildAppImageOnly) targets.push('AppImage');
  if (buildDebOnly) targets.push('deb');
  if (buildSnapOnly) targets.push('snap');
  if (buildTarOnly) targets.push('tar.gz');
}

console.log('====================================================');
console.log('  IndiChat Linux Desktop Build Automation');
console.log('====================================================');
console.log(`Root Directory:       ${rootDir}`);
console.log(`Desktop Directory:    ${desktopDir}`);
console.log(`Release Output:       ${releaseLinuxDir}`);
console.log(`Targets:              ${targets.join(', ')}`);
console.log(`Clean First:          ${cleanBeforeBuild ? 'YES' : 'NO'}`);
console.log('====================================================\n');

// Helper to run commands
function runStep(cmd, cmdArgs, cwd, description) {
  console.log(`>>> ${description}...`);
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: true
  });

  if (result.status !== 0) {
    console.error(`\n❌ Error: Step failed with exit code ${result.status}.`);
    process.exit(result.status || 1);
  }
}

// 1. Clean if requested
if (cleanBeforeBuild) {
  console.log('>>> Cleaning previous build artifacts...');
  if (fs.existsSync(desktopDistWebDir)) fs.rmSync(desktopDistWebDir, { recursive: true, force: true });
  if (fs.existsSync(desktopDistBinDir)) fs.rmSync(desktopDistBinDir, { recursive: true, force: true });
}

// 2. Build Web Frontend (React + Vite)
runStep('npm', ['run', 'build'], webDir, 'Compiling Web client assets (React + Vite)');

// 3. Copy Web Dist to Desktop Dist-Web
console.log('>>> Packaging web assets for Electron runtime...');
if (fs.existsSync(desktopDistWebDir)) {
  fs.rmSync(desktopDistWebDir, { recursive: true, force: true });
}
fs.cpSync(webDistDir, desktopDistWebDir, { recursive: true });

// 4. Copy store and metadata assets to release/linux/
console.log('>>> Synchronizing Linux Store & AppStream metadata...');
const assetsToCopy = [
  { src: path.join(desktopDir, 'assets', 'indichat.desktop'), dest: path.join(releaseLinuxDir, 'indichat.desktop') },
  { src: path.join(desktopDir, 'assets', 'org.indichat.IndiChat.metainfo.xml'), dest: path.join(releaseLinuxDir, 'org.indichat.IndiChat.metainfo.xml') },
  { src: path.join(desktopDir, 'assets', 'org.indichat.IndiChat.yml'), dest: path.join(releaseLinuxDir, 'org.indichat.IndiChat.yml') },
  { src: path.join(desktopDir, 'assets', 'snapcraft.yaml'), dest: path.join(releaseLinuxDir, 'snapcraft.yaml') },
  { src: path.join(desktopDir, 'assets', 'icon.png'), dest: path.join(releaseLinuxDir, 'icon.png') }
];

for (const item of assetsToCopy) {
  if (fs.existsSync(item.src)) {
    fs.copyFileSync(item.src, item.dest);
  }
}

const hicolorSrc = path.join(desktopDir, 'assets', 'hicolor');
const hicolorDest = path.join(releaseLinuxDir, 'hicolor');
if (fs.existsSync(hicolorSrc)) {
  fs.cpSync(hicolorSrc, hicolorDest, { recursive: true });
}

// 5. Run electron-builder for selected targets
for (const target of targets) {
  runStep('npx', ['electron-builder', '--linux', target], desktopDir, `Building Linux ${target} package`);
}

// 6. Collect output binaries from desktop/dist-bin to release/linux
console.log('\n>>> Collecting release artifacts into release/linux/...');
if (fs.existsSync(desktopDistBinDir)) {
  const files = fs.readdirSync(desktopDistBinDir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const isReleaseBinary = ext === '.appimage' || ext === '.deb' || ext === '.snap' || file.endsWith('.tar.gz');

    if (isReleaseBinary) {
      const srcPath = path.join(desktopDistBinDir, file);
      const destPath = path.join(releaseLinuxDir, file);
      fs.copyFileSync(srcPath, destPath);

      // Ensure AppImage is executable
      if (ext === '.appimage') {
        try {
          fs.chmodSync(destPath, '755');
        } catch (e) {}
      }

      const stats = fs.statSync(destPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(` ✔ Created: ${file} (${sizeMB} MB) -> ${destPath}`);
    }
  }
}

console.log('\n====================================================');
console.log('  Linux Desktop Build Summary & Usage Instructions');
console.log('====================================================');
console.log(`All Linux artifacts are available in: ${releaseLinuxDir}\n`);

console.log('🖥️  1. HOW TO RUN DIRECTLY ON LINUX:');
console.log('   ./release/linux/IndiChat-1.0.0.AppImage');
console.log('   (or double click the .AppImage file in your file manager)\n');

console.log('📦 2. HOW TO INSTALL VIA DEBIAN / UBUNTU PACKAGE (.deb):');
console.log('   sudo dpkg -i release/linux/indichat_1.0.0_amd64.deb');
console.log('   sudo apt-get install -f   # (if any missing dependencies)\n');

console.log('🏪 3. HOW TO UPLOAD TO CANONICAL SNAP STORE (UBUNTU APP CENTER):');
console.log('   snapcraft login');
console.log('   snapcraft register indichat');
console.log('   snapcraft upload release/linux/indichat_1.0.0_amd64.snap\n');

console.log('🌐 4. HOW TO PUBLISH TO FLATHUB (FLATPAK):');
console.log('   Use the preconfigured manifest: release/linux/org.indichat.IndiChat.yml');
console.log('   and AppStream metadata:         release/linux/org.indichat.IndiChat.metainfo.xml\n');

console.log('🚀 5. HOW TO PUBLISH TO APPIMAGEHUB / GITHUB RELEASES:');
console.log('   Attach release/linux/IndiChat-1.0.0.AppImage to your GitHub release tag.');
console.log('====================================================\n');
