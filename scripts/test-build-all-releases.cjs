const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseArgs, createPlan, runPlan } = require('./build-all-releases.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'IndiChat release runner '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('default macOS plan includes all five platforms and required release formats', () => {
  const plan = createPlan('darwin', parseArgs([]));
  assert.deepEqual(plan.map(p => p.platform), ['windows', 'macos', 'linux', 'ios', 'android']);
  assert.equal(plan[0].script, 'scripts/build-windows-container.sh');
  assert.equal(plan[2].script, 'scripts/build-linux-container.sh');
  assert.deepEqual(plan[3].args, ['--sim', '--archive']);
  assert.deepEqual(plan[4].args, []); // Existing Android default builds APK and AAB.
});
test('subset and simulator-only options are explicit and invalid options fail', () => {
  const plan = createPlan('darwin', parseArgs(['--platforms=ios,android', '--ios-simulator-only']));
  assert.deepEqual(plan.map(p => p.platform), ['ios', 'android']);
  assert.deepEqual(plan[0].args, ['--sim']);
  assert.throws(() => parseArgs(['--platforms=unknown']), /Unknown platform/);
  assert.throws(() => parseArgs(['--platforms=']), /platform/);
  assert.throws(() => parseArgs(['--invalid']), /Unknown option/);
});
test('non-macOS hosts report Apple targets unavailable', () => {
  const plan = createPlan('linux', parseArgs([]));
  assert.ok(plan.find(p => p.platform === 'ios').unavailable);
  assert.ok(plan.find(p => p.platform === 'macos').unavailable);
  assert.equal(createPlan('win32', parseArgs([]))[0].script, 'scripts/build-windows.js');
});
test('failure does not prevent later builds and stale artifacts never count as a release', t => {
  const rootDir = fixture(t); const release = path.join(rootDir, 'release/test');
  fs.mkdirSync(release, { recursive: true }); fs.writeFileSync(path.join(release, 'old.exe'), 'old');
  const steps = ['failed', 'stale', 'fresh', 'unsupported'].map(platform => ({
    platform, script: `${platform}.cjs`, args: [], kind: 'node', output: 'release/test', required: [/\.exe$/],
    ...(platform === 'unsupported' ? { unavailable: 'requires another OS' } : {})
  }));
  let calls = 0;
  const results = runPlan(steps, { rootDir, log() {}, run(command, args) {
    calls++;
    if (args[0].endsWith('failed.cjs')) return { status: 1 };
    if (args[0].endsWith('fresh.cjs')) fs.writeFileSync(path.join(release, 'fresh.exe'), 'new');
    return { status: 0 };
  }});
  assert.equal(calls, 3);
  assert.deepEqual(results.map(r => r.status), ['failed', 'failed', 'passed', 'unavailable']);
  assert.deepEqual(results[2].artifacts, ['./release/test/fresh.exe']);
});
test('real child runs from a relocated root with spaces without shell interpolation', t => {
  const rootDir = fixture(t);
  fs.writeFileSync(path.join(rootDir, 'build.cjs'), "require('fs').mkdirSync('release/test',{recursive:true});require('fs').writeFileSync('release/test/test.zip','new');");
  const results = runPlan([{ platform: 'fixture', kind: 'node', script: 'build.cjs', args: [], output: 'release/test', required: [/\.zip$/] }], { rootDir, log() {} });
  assert.equal(results[0].status, 'passed');
  assert.deepEqual(results[0].artifacts, ['./release/test/test.zip']);
});
test('spawn errors and partial output sets fail honestly', t => {
  const rootDir = fixture(t);
  const step = { platform: 'windows', kind: 'node', script: 'build.cjs', args: [], output: 'release/windows', required: [/Setup.*\.exe$/, /Portable.*\.exe$/] };
  assert.equal(runPlan([step], { rootDir, log() {}, run: () => ({ error: new Error('missing tool'), status: null }) })[0].status, 'failed');
  const result = runPlan([step], { rootDir, log() {}, run() {
    fs.mkdirSync(path.join(rootDir, step.output), { recursive: true });
    fs.writeFileSync(path.join(rootDir, step.output, 'Setup.exe'), 'setup');
    return { status: 0 };
  }});
  assert.equal(result[0].status, 'failed');
});
test('dry-run and help perform no builds or filesystem writes', t => {
  const rootDir = fixture(t); const logs = [];
  const main = require('./build-all-releases.cjs').main;
  const options = { rootDir, host: 'darwin', log: value => logs.push(value), run() { throw new Error('must not run'); } };
  assert.equal(main(['--dry-run'], options), 0);
  assert.equal(main(['--help'], options), 0);
  assert.deepEqual(fs.readdirSync(rootDir), []);
  assert.ok(logs.some(line => line.includes('--archive')));
});
test('main writes relative success/failure summaries and reports a missing format', t => {
  const rootDir = fixture(t); const main = require('./build-all-releases.cjs').main;
  const options = { rootDir, host: 'darwin', log() {}, table() {}, run() {
    const directory = path.join(rootDir, 'release/android');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'IndiChat.apk'), 'apk');
    fs.writeFileSync(path.join(directory, 'IndiChat.aab'), 'aab');
    return { status: 0 };
  }};
  assert.equal(main(['--platforms=android'], options), 0);
  const reportDir = path.join(rootDir, 'release/build-all');
  const report = JSON.parse(fs.readFileSync(path.join(reportDir, fs.readdirSync(reportDir)[0], 'summary.json')));
  assert.equal(report.pathBase, 'project-root');
  assert.equal(report.passed, true);
  assert.ok(report.results[0].artifacts.every(file => file.startsWith('./release/')));
  assert.equal(main(['--platforms=macos'], { ...options, host: 'linux' }), 1);
});
test('thrown subprocess failures are recorded rather than aborting the plan', t => {
  const rootDir = fixture(t);
  const [result] = runPlan([{ platform: 'fixture', kind: 'node', script: 'build.cjs', args: [], output: 'release/test', required: [/\.zip$/] }], {
    rootDir, log() {}, run() { throw new Error('spawn denied'); }
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.message, 'spawn denied');
});
