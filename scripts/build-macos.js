#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'apps', 'desktop');
const webDir = path.join(rootDir, 'apps', 'web');
const webDistDir = path.join(webDir, 'dist');
const desktopDistWebDir = path.join(desktopDir, 'dist-web');
const desktopDistBinDir = path.join(desktopDir, 'dist-bin');
const releaseDir = path.join(rootDir, 'release');
const releaseMacDir = path.join(releaseDir, 'macos');

// Ensure directories exist
if (!fs.existsSync(releaseMacDir)) {
  fs.mkdirSync(releaseMacDir, { recursive: true });
}

const args = process.argv.slice(2);
const cleanBeforeBuild = args.includes('--clean');
const buildDmgOnly = args.includes('--dmg');
const buildZipOnly = args.includes('--zip');
const buildDirOnly = args.includes('--dir');

let targets = [];
if (buildDirOnly) {
  targets = ['--dir'];
} else if (buildDmgOnly) {
  targets = ['dmg'];
} else if (buildZipOnly) {
  targets = ['zip'];
} else {
  targets = ['dmg', 'zip'];
}

console.log('====================================================');
console.log('  IndiChat macOS Desktop Build Automation');
console.log('====================================================');
console.log(`Root Directory:       ${rootDir}`);
console.log(`Desktop Directory:    ${desktopDir}`);
console.log(`Release Output:       ${releaseMacDir}`);
console.log(`Targets:              ${targets.join(', ')}`);
console.log(`Clean First:          ${cleanBeforeBuild ? 'YES' : 'NO'}`);
console.log('====================================================\n');

function runStep(cmd, cmdArgs, cwd, description) {
  console.log(`>>> ${description}...`);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: 'inherit',
    env,
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

// 4. Run electron-builder for selected targets
const builderArgs = ['electron-builder', '--mac', ...targets];
runStep('npx', builderArgs, desktopDir, `Packaging macOS application (${targets.join(', ')})`);

// 5. Collect release artifacts into release/macos/
console.log('\n>>> Collecting release artifacts into release/macos/...');
if (fs.existsSync(desktopDistBinDir)) {
  const files = fs.readdirSync(desktopDistBinDir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const isReleaseBinary = ext === '.dmg' || ext === '.zip';

    if (isReleaseBinary) {
      const srcPath = path.join(desktopDistBinDir, file);
      const destPath = path.join(releaseMacDir, file);
      fs.copyFileSync(srcPath, destPath);

      const stats = fs.statSync(destPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(` ✔ Created: ${file} (${sizeMB} MB) -> ${destPath}`);
    }
  }
}

const iconSrc = path.join(desktopDir, 'assets', 'icon.png');
const iconDest = path.join(releaseMacDir, 'icon.png');
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDest);
}

console.log('\n====================================================');
console.log('  macOS Desktop Build Completed Successfully!');
console.log('====================================================\n');

