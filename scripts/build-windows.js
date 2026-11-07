#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { collectArtifacts, verifyElectronDist } = require('./desktop-build-artifacts.cjs');
const { configureBuildEnvironment } = require('./setup-build-packages.js');
const buildId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;

const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'apps', 'desktop');
const webDir = path.join(rootDir, 'apps', 'web');
const webDistDir = path.join(webDir, 'dist');
const desktopDistWebDir = path.join(desktopDir, 'dist-web');
const desktopDistBinDir = path.join(desktopDir, 'dist-bin-windows', buildId);
const releaseDir = path.join(rootDir, 'release');
const releaseWinDir = path.join(releaseDir, 'windows', buildId);

if (!fs.existsSync(releaseWinDir)) {
  fs.mkdirSync(releaseWinDir, { recursive: true });
}

const args = process.argv.slice(2);
const cleanBeforeBuild = args.includes('--clean');
const buildNsisOnly = args.includes('--nsis');
const buildPortableOnly = args.includes('--portable');

let targets = [];
if (buildNsisOnly) {
  targets = ['nsis'];
} else if (buildPortableOnly) {
  targets = ['portable'];
} else {
  targets = ['nsis', 'portable'];
}

console.log('====================================================');
console.log('  IndiChat Windows Desktop Build Automation');
console.log('====================================================');
console.log(`Root Directory:       ${rootDir}`);
console.log(`Desktop Directory:    ${desktopDir}`);
console.log(`Release Output:       ${releaseWinDir}`);
console.log(`Targets:              ${targets.join(', ')}`);
console.log(`Clean First:          ${cleanBeforeBuild ? 'YES' : 'NO'}`);
console.log('====================================================\n');

function runStep(cmd, cmdArgs, cwd, description) {
  console.log(`>>> ${description}...`);
  const env = configureBuildEnvironment({ ...process.env });
  delete env.ELECTRON_RUN_AS_NODE;

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

// 3.5. Ensure Windows Electron package in ./build_run_package/electron
console.log('>>> Checking project package cache for Windows Electron runtime...');
spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'setup-build-packages.js'), '--ensure=win32'], { stdio: 'inherit' });

// 4. Run electron-builder for selected Windows targets
const builderArgs = ['electron-builder', '--win', ...targets, '--x64', `--config.directories.output=${desktopDistBinDir}`];
if (process.env.INDICHAT_ELECTRON_DIST) {
  const dist = verifyElectronDist(process.env.INDICHAT_ELECTRON_DIST, 'win32');
  builderArgs.push(`--config.electronDist=${dist}`);
}
if (args.includes('--unsigned-js-resources')) {
  builderArgs.push('--config.win.signAndEditExecutable=false', `--config.afterPack=${path.join(rootDir, 'scripts', 'edit-windows-resources.cjs')}`);
}
runStep('npx', builderArgs, desktopDir, `Building Windows targets (${targets.join(', ')})`);

// 5. Collect release artifacts into release/windows/
console.log('\n>>> Collecting release artifacts into release/windows/...');
const artifacts = collectArtifacts(desktopDistBinDir, releaseWinDir, targets);
fs.writeFileSync(path.join(releaseWinDir, 'manifest.json'), JSON.stringify({ platform: 'windows', arch: 'x64', pathBase: 'project-root', nativeRuntimeVerified: false, unsignedJsResources: args.includes('--unsigned-js-resources'), artifacts }, null, 2) + '\n');
for (const artifact of artifacts) console.log(`Created: ${artifact.file} (${artifact.bytes} bytes, SHA-256 ${artifact.sha256})`);

console.log('\n====================================================');
console.log('  Windows Desktop Build Completed Successfully!');
console.log('====================================================\n');

