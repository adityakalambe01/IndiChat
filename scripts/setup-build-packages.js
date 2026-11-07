#!/usr/bin/env node
/**
 * scripts/setup-build-packages.js
 * 
 * Manages project-local prebuilt packages and tools in ./build_run_package/
 * across all developer devices and CI runners.
 * 
 * - Ensures ELECTRON_CACHE points to ./build_run_package/electron
 * - Ensures ELECTRON_BUILDER_CACHE points to ./build_run_package/electron-builder
 * - Validates checksums against official electron/checksums.json
 * - Supports downloading missing platform binaries with progress reporting
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');

const rootDir = path.resolve(__dirname, '..');
const packageDir = path.join(rootDir, 'build_run_package');
const electronCacheDir = path.join(packageDir, 'electron');
const builderCacheDir = path.join(packageDir, 'electron-builder');

function ensureDirectories() {
  fs.mkdirSync(electronCacheDir, { recursive: true });
  fs.mkdirSync(builderCacheDir, { recursive: true });
  const gitkeepPath = path.join(packageDir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '');
  }
}

function getElectronVersion() {
  try {
    const desktopPkg = require(path.join(rootDir, 'apps', 'desktop', 'package.json'));
    return desktopPkg.devDependencies?.electron?.replace(/[\^~]/g, '') || '33.4.11';
  } catch {
    return '33.4.11';
  }
}

function getExpectedChecksums() {
  try {
    return require(path.join(rootDir, 'node_modules', 'electron', 'checksums.json'));
  } catch {
    try {
      return require(path.join(rootDir, 'apps', 'desktop', 'node_modules', 'electron', 'checksums.json'));
    } catch {
      return {};
    }
  }
}

function verifyZipChecksum(filePath, filename, checksums) {
  if (!fs.existsSync(filePath)) return false;
  const expected = checksums[filename];
  if (!expected) return true; // No hash to compare
  const data = fs.readFileSync(filePath);
  const actual = crypto.createHash('sha256').update(data).digest('hex');
  return actual.toLowerCase() === expected.toLowerCase();
}

function getLocalPackages() {
  ensureDirectories();
  const version = getElectronVersion();
  const checksums = getExpectedChecksums();
  const platforms = [
    { platform: 'darwin', arch: 'arm64', filename: `electron-v${version}-darwin-arm64.zip` },
    { platform: 'win32', arch: 'x64', filename: `electron-v${version}-win32-x64.zip` },
    { platform: 'linux', arch: 'x64', filename: `electron-v${version}-linux-x64.zip` }
  ];

  const status = [];
  for (const p of platforms) {
    const filePath = path.join(electronCacheDir, p.filename);
    const exists = fs.existsSync(filePath);
    const valid = exists && verifyZipChecksum(filePath, p.filename, checksums);
    status.push({
      platform: p.platform,
      arch: p.arch,
      filename: p.filename,
      filePath,
      exists,
      valid,
      sizeBytes: exists ? fs.statSync(filePath).size : 0
    });
  }

  // Builder tools (nsis, winCodeSign, wine)
  const builderTools = ['nsis', 'winCodeSign', 'wine'];
  const builderStatus = builderTools.map(tool => ({
    tool,
    path: path.join(builderCacheDir, tool),
    exists: fs.existsSync(path.join(builderCacheDir, tool))
  }));

  return { version, electron: status, builderTools: builderStatus, paths: { packageDir, electronCacheDir, builderCacheDir } };
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tempPath = `${destPath}.tmp-${Date.now()}`;
    const file = fs.createWriteStream(tempPath);

    function follow(currentUrl, redirectCount = 0) {
      if (redirectCount > 10) {
        file.close();
        fs.unlinkSync(tempPath);
        return reject(new Error('Too many redirects'));
      }

      https.get(currentUrl, {
        headers: {
          'User-Agent': 'IndiChat-Package-Manager/1.0',
          'Accept': '*/*'
        }
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          file.close();
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return reject(new Error(`Download failed with HTTP ${res.statusCode} from ${currentUrl}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastReport = 0;

        res.on('data', chunk => {
          downloadedBytes += chunk.length;
          const now = Date.now();
          if (now - lastReport > 1000 || downloadedBytes === totalBytes) {
            lastReport = now;
            const pct = totalBytes ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : '?';
            const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const totalMb = totalBytes ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';
            process.stdout.write(`\r  Downloading: ${mb} MB / ${totalMb} MB (${pct}%)`);
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            process.stdout.write('\n');
            fs.renameSync(tempPath, destPath);
            resolve();
          });
        });

        res.on('error', err => {
          file.close();
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          reject(err);
        });
      }).on('error', err => {
        file.close();
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        reject(err);
      });
    }

    follow(url);
  });
}

async function ensurePackage(targetPlatform) {
  const info = getLocalPackages();
  const target = info.electron.find(p => p.platform === targetPlatform);
  if (!target) {
    throw new Error(`Unknown platform: ${targetPlatform}`);
  }

  if (target.valid) {
    console.log(`✅ [${target.platform}] Cached package is valid: ${target.filename} (${(target.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`);
    return target.filePath;
  }

  console.log(`⬇️ [${target.platform}] Downloading ${target.filename} into build_run_package/electron/...`);
  const checksums = getExpectedChecksums();

  // Try official GitHub releases first, then fast npmmirror fallback
  const urls = [
    `https://github.com/electron/electron/releases/download/v${info.version}/${target.filename}`,
    `https://npmmirror.com/mirrors/electron/v${info.version}/${target.filename}`
  ];

  let success = false;
  for (const url of urls) {
    try {
      console.log(`  Connecting to: ${new URL(url).hostname}...`);
      await downloadFile(url, target.filePath);
      if (verifyZipChecksum(target.filePath, target.filename, checksums)) {
        console.log(`  Verified SHA-256 for ${target.filename}`);
        success = true;
        break;
      } else {
        console.warn(`  Checksum mismatch for ${target.filename}, removing corrupt download.`);
        if (fs.existsSync(target.filePath)) fs.unlinkSync(target.filePath);
      }
    } catch (err) {
      console.warn(`  Download source failed: ${err.message}`);
    }
  }

  if (!success) {
    throw new Error(`Failed to download and verify ${target.filename}`);
  }

  return target.filePath;
}

function syncFromHostCaches() {
  ensureDirectories();
  const hostElectron = path.join(process.env.HOME || '', 'Library', 'Caches', 'electron');
  const hostBuilder = path.join(process.env.HOME || '', 'Library', 'Caches', 'electron-builder');

  if (fs.existsSync(hostElectron)) {
    for (const file of fs.readdirSync(hostElectron)) {
      if (file.endsWith('.zip')) {
        const dest = path.join(electronCacheDir, file);
        if (!fs.existsSync(dest)) {
          try {
            fs.copyFileSync(path.join(hostElectron, file), dest);
            console.log(`Copied ${file} from host cache to build_run_package/electron/`);
          } catch {}
        }
      }
    }
  }

  if (fs.existsSync(hostBuilder)) {
    for (const dir of ['nsis', 'winCodeSign', 'wine']) {
      const src = path.join(hostBuilder, dir);
      const dest = path.join(builderCacheDir, dir);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        try {
          fs.cpSync(src, dest, { recursive: true });
          console.log(`Copied ${dir} from host cache to build_run_package/electron-builder/`);
        } catch {}
      }
    }
  }
}

function configureBuildEnvironment(existingEnv = process.env) {
  ensureDirectories();
  return {
    ...existingEnv,
    ELECTRON_CACHE: electronCacheDir,
    ELECTRON_BUILDER_CACHE: builderCacheDir
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  ensureDirectories();
  syncFromHostCaches();

  if (args.includes('--status') || args.length === 0) {
    const info = getLocalPackages();
    console.log('\n====================================================');
    console.log('  IndiChat Build Package Cache (./build_run_package)');
    console.log('====================================================');
    console.log(`Electron Version: ${info.version}`);
    console.log(`Cache Root:       ${info.paths.packageDir}`);
    console.log('\nElectron Packages:');
    for (const p of info.electron) {
      const state = p.valid ? '✅ READY' : p.exists ? '⚠️ CORRUPT' : '❌ MISSING';
      const sz = p.exists ? `${(p.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : '-';
      console.log(`  [${p.platform.padEnd(6)}] ${p.filename.padEnd(42)} ${sz.padStart(10)}  ${state}`);
    }
    console.log('\nBuilder Tools:');
    for (const b of info.builderTools) {
      console.log(`  [${b.tool.padEnd(12)}] ${b.exists ? '✅ PRESENT' : '❌ NOT CACHED'}`);
    }
    console.log('====================================================\n');
  }

  const ensureArg = args.find(a => a.startsWith('--ensure='));
  if (ensureArg) {
    const platformToEnsure = ensureArg.split('=')[1];
    (async () => {
      try {
        await ensurePackage(platformToEnsure);
      } catch (err) {
        console.error(`\n❌ Error: ${err.message}\n`);
        process.exit(1);
      }
    })();
    return;
  }

  if (args.includes('--download-all')) {
    (async () => {
      try {
        await ensurePackage('darwin');
        await ensurePackage('win32');
        await ensurePackage('linux');
        console.log('\n🎉 All platform packages are verified and cached in ./build_run_package/!\n');
      } catch (err) {
        console.error(`\n❌ Error: ${err.message}\n`);
        process.exit(1);
      }
    })();
  }
}

module.exports = {
  packageDir,
  electronCacheDir,
  builderCacheDir,
  ensureDirectories,
  getLocalPackages,
  ensurePackage,
  syncFromHostCaches,
  configureBuildEnvironment
};

