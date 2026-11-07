#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PLATFORMS = ['windows', 'macos', 'linux', 'ios', 'android'];

function parseArgs(args) {
  const options = { platforms: [...PLATFORMS], dryRun: false, simulatorOnly: false, help: false };
  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--ios-simulator-only') options.simulatorOnly = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--platforms=')) {
      const requested = arg.slice('--platforms='.length).split(',');
      for (const platform of requested) if (!PLATFORMS.includes(platform)) throw new Error(`Unknown platform: ${platform || '(empty)'}`);
      options.platforms = [...new Set(requested)];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}
function createPlan(host, options) {
  const plan = {
    windows: { kind: host === 'win32' ? 'node' : 'bash', script: host === 'win32' ? 'scripts/build-windows.js' : 'scripts/build-windows-container.sh', args: [], required: [/IndiChat-Setup-.*\.exe$/i, /IndiChat-Portable-.*\.exe$/i] },
    macos: { kind: 'node', script: 'scripts/build-macos.js', args: [], required: [/\.dmg$/i, /\.zip$/i], ...(host !== 'darwin' ? { unavailable: 'macOS and Xcode are required' } : {}) },
    linux: { kind: host === 'linux' ? 'node' : 'bash', script: host === 'linux' ? 'scripts/build-linux.js' : 'scripts/build-linux-container.sh', args: host === 'linux' ? ['--appimage', '--deb'] : [], required: [/\.AppImage$/i, /\.deb$/i] },
    ios: { kind: 'node', script: 'scripts/build-ios.js', args: options.simulatorOnly ? ['--sim'] : ['--sim', '--archive'], required: options.simulatorOnly ? [/\.app$/i] : [/\.app$/i, /\.xcarchive$/i], ...(host !== 'darwin' ? { unavailable: 'macOS, Xcode and CocoaPods are required' } : {}) },
    android: { kind: 'node', script: 'scripts/build-android.js', args: [], required: [/\.apk$/i, /\.aab$/i] }
  };
  return options.platforms.map(platform => ({ platform, output: `release/${platform === 'macos' ? 'macos' : platform}`, ...plan[platform] }));
}
function snapshotArtifacts(directory) {
  const artifacts = new Map();
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const filename = path.join(dir, name); const stat = fs.lstatSync(filename);
      if (stat.isSymbolicLink()) continue;
      if (/\.(exe|dmg|zip|AppImage|deb|apk|aab|app|xcarchive)$/i.test(name)) {
        artifacts.set(filename, `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`);
      } else if (stat.isDirectory()) visit(filename);
    }
  }
  visit(directory);
  return artifacts;
}
function runPlan(plan, { rootDir = PROJECT_ROOT, run = spawnSync, log = console.log } = {}) {
  const results = [];
  for (const step of plan) {
    const command = `${step.kind} ./${step.script} ${step.args.join(' ')}`.trim();
    if (step.unavailable) {
      log(`[${step.platform}] UNAVAILABLE: ${step.unavailable}`);
      results.push({ platform: step.platform, command, status: 'unavailable', message: step.unavailable, artifacts: [] });
      continue;
    }
    log(`\n[${step.platform}] ${command}`);
    const output = path.join(rootDir, step.output);
    const before = snapshotArtifacts(output);
    let child;
    const started = Date.now();
    try {
      child = run(step.kind === 'node' ? process.execPath : 'bash', [path.join(rootDir, step.script), ...step.args], {
        cwd: rootDir, stdio: 'inherit', shell: false, env: { ...process.env }
      });
    } catch (error) { child = { error, status: null }; }
    const after = snapshotArtifacts(output);
    const fresh = [...after].filter(([file, fingerprint]) => before.get(file) !== fingerprint).map(([file]) => file);
    const missing = step.required.filter(pattern => !fresh.some(file => pattern.test(path.basename(file))));
    const passed = !child.error && child.status === 0 && missing.length === 0;
    const message = child.error ? child.error.message : child.status !== 0
      ? `Build exited with ${child.signal || child.status}`
      : missing.length ? `No fresh artifacts for required formats: ${missing.map(String).join(', ')}` : 'Fresh artifacts created';
    results.push({ platform: step.platform, command, status: passed ? 'passed' : 'failed',
      exitCode: child.status, durationSeconds: Number(((Date.now() - started) / 1000).toFixed(1)), message,
      artifacts: fresh.map(file => `./${path.relative(rootDir, file).split(path.sep).join('/')}`) });
    log(`[${step.platform}] ${passed ? 'PASSED' : 'FAILED'}: ${message}`);
  }
  return results;
}
function main(args = process.argv.slice(2), {
  rootDir = PROJECT_ROOT, host = process.platform, run = spawnSync,
  log = console.log, table = console.table
} = {}) {
  const options = parseArgs(args);
  if (options.help) {
    log('Usage: npm run release:all -- [--dry-run] [--platforms=windows,macos,linux,ios,android] [--ios-simulator-only]');
    log('Builds local packages only. Apple builds require macOS; desktop cross-builds require Docker/bash.');
    log('Default iOS output includes a signed device archive; --ios-simulator-only omits it. No IPA export or publishing is performed.');
    return 0;
  }
  const plan = createPlan(host, options);
  if (options.dryRun) {
    for (const step of plan) log(`[${step.platform}] ${step.kind} ./${step.script} ${step.args.join(' ')} -> ./${step.output}/${step.unavailable ? ` [UNAVAILABLE: ${step.unavailable}]` : ''}`);
    return 0;
  }
  log('Building local releases sequentially. Platform toolchains and signing setup must already be available.');
  const results = runPlan(plan, { rootDir, run, log });
  const passed = results.every(result => result.status === 'passed');
  const directory = path.join(rootDir, 'release', 'build-all', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  fs.mkdirSync(directory, { recursive: true });
  const summaryPath = path.join(directory, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ pathBase: 'project-root', host, passed,
    scope: 'local package creation; does not establish native runtime verification or distribution approval', results }, null, 2) + '\n');
  table(results.map(({ platform, status, message }) => ({ platform, status, message })));
  log(`Build summary: ./${path.relative(rootDir, summaryPath).split(path.sep).join('/')}`);
  return passed ? 0 : 1;
}
if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { parseArgs, createPlan, runPlan, snapshotArtifacts, main };
