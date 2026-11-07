const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectArtifacts } = require('./desktop-build-artifacts.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'indichat-artifacts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const output = path.join(root, 'output'); const release = path.join(root, 'release');
  fs.mkdirSync(output); fs.mkdirSync(release);
  return { output, release };
}
test('missing requested target fails without publishing a partial result', t => {
  const { output, release } = fixture(t);
  fs.writeFileSync(path.join(output, 'IndiChat-Setup-1.0.0.exe'), 'installer');
  assert.throws(() => collectArtifacts(output, release, ['nsis', 'portable']), /portable/);
  assert.deepEqual(fs.readdirSync(release), []);
});
test('collects only requested targets and records hashes', t => {
  const { output, release } = fixture(t);
  fs.writeFileSync(path.join(output, 'IndiChat-Setup-1.0.0.exe'), 'installer');
  fs.writeFileSync(path.join(output, 'IndiChat-Portable-1.0.0.exe'), 'portable');
  fs.writeFileSync(path.join(output, 'stale.dmg'), 'old');
  const records = collectArtifacts(output, release, ['nsis', 'portable']);
  assert.equal(records.length, 2);
  assert.ok(records.every(r => /^[a-f0-9]{64}$/.test(r.sha256)));
  assert.equal(fs.existsSync(path.join(release, 'stale.dmg')), false);
});
test('refuses to overwrite an existing reviewed artifact', t => {
  const { output, release } = fixture(t);
  const name = 'IndiChat-Portable-1.0.0.exe';
  fs.writeFileSync(path.join(output, name), 'new');
  fs.writeFileSync(path.join(release, name), 'reviewed');
  assert.throws(() => collectArtifacts(output, release, ['portable']), /exists/);
  assert.equal(fs.readFileSync(path.join(release, name), 'utf8'), 'reviewed');
});
test('AppImage output is executable and Debian output is collected', t => {
  const { output, release } = fixture(t);
  fs.writeFileSync(path.join(output, 'IndiChat-1.0.0.AppImage'), 'appimage');
  fs.writeFileSync(path.join(output, 'indichat_1.0.0_amd64.deb'), 'debian');
  const records = collectArtifacts(output, release, ['AppImage', 'deb']);
  assert.equal(records.length, 2);
  assert.equal(fs.statSync(path.join(release, 'IndiChat-1.0.0.AppImage')).mode & 0o777, 0o755);
});
test('unsupported targets fail explicitly', t => {
  const { output, release } = fixture(t);
  assert.throws(() => collectArtifacts(output, release, ['unknown']), /Unsupported target/);
});
