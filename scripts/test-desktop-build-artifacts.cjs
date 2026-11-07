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
  return { root, output, release };
}
test('missing requested target fails without publishing a partial result', t => {
  const { root, output, release } = fixture(t);
  fs.writeFileSync(path.join(output, 'IndiChat-Setup-1.0.0.exe'), 'installer');
  assert.throws(() => collectArtifacts(output, release, ['nsis', 'portable'], root), /portable/);
  assert.deepEqual(fs.readdirSync(release), []);
});
test('collects only requested targets and records hashes', t => {
  const { root, output, release } = fixture(t);
  fs.writeFileSync(path.join(output, 'IndiChat-Setup-1.0.0.exe'), 'installer');
  fs.writeFileSync(path.join(output, 'IndiChat-Portable-1.0.0.exe'), 'portable');
  fs.writeFileSync(path.join(output, 'stale.dmg'), 'old');
  const records = collectArtifacts(output, release, ['nsis', 'portable'], root);
  assert.equal(records.length, 2);
  assert.ok(records.every(r => /^[a-f0-9]{64}$/.test(r.sha256)));
  assert.equal(fs.existsSync(path.join(release, 'stale.dmg')), false);
});
test('refuses to overwrite an existing reviewed artifact', t => {
  const { root, output, release } = fixture(t);
  const name = 'IndiChat-Portable-1.0.0.exe';
  fs.writeFileSync(path.join(output, name), 'new');
  fs.writeFileSync(path.join(release, name), 'reviewed');
  assert.throws(() => collectArtifacts(output, release, ['portable'], root), /exists/);
  assert.equal(fs.readFileSync(path.join(release, name), 'utf8'), 'reviewed');
});
test('AppImage output is executable and Debian output is collected', t => {
  const { root, output, release } = fixture(t);
  fs.writeFileSync(path.join(output, 'IndiChat-1.0.0.AppImage'), 'appimage');
  fs.writeFileSync(path.join(output, 'indichat_1.0.0_amd64.deb'), 'debian');
  const records = collectArtifacts(output, release, ['AppImage', 'deb'], root);
  assert.equal(records.length, 2);
  assert.equal(fs.statSync(path.join(release, 'IndiChat-1.0.0.AppImage')).mode & 0o777, 0o755);
});
test('unsupported targets fail explicitly', t => {
  const { root, output, release } = fixture(t);
  assert.throws(() => collectArtifacts(output, release, ['unknown'], root), /Unsupported target/);
});
test('runtime cache rejects an archive that does not match the trusted hash', t => {
  const { output } = fixture(t);
  const archive = path.join(output, 'runtime.zip');
  fs.writeFileSync(archive, 'tampered');
  const { verifyArchive } = require('./desktop-build-artifacts.cjs');
  assert.throws(() => verifyArchive(archive, '0'.repeat(64)), /checksum/i);
});
test('runtime cache accepts only the expected SHA-256', t => {
  const { output } = fixture(t);
  const archive = path.join(output, 'runtime.zip');
  fs.writeFileSync(archive, 'verified runtime');
  const expected = require('node:crypto').createHash('sha256').update('verified runtime').digest('hex');
  const { verifyArchive } = require('./desktop-build-artifacts.cjs');
  assert.equal(verifyArchive(archive, expected), archive);
});
test('artifact records use project-root-relative paths from any working directory', t => {
  const { root, output, release } = fixture(t);
  const name = 'IndiChat-Portable-1.0.0.exe';
  fs.writeFileSync(path.join(output, name), 'portable');
  const previous = process.cwd();
  try {
    process.chdir(os.tmpdir());
    const [record] = collectArtifacts(output, release, ['portable'], root);
    assert.equal(record.file, `./release/${name}`);
    assert.equal(fs.readFileSync(path.resolve(root, record.file), 'utf8'), 'portable');
  } finally { process.chdir(previous); }
});
test('artifact collection rejects release paths outside the declared project root', t => {
  const { root, output, release } = fixture(t);
  fs.writeFileSync(path.join(output, 'IndiChat-Portable-1.0.0.exe'), 'portable');
  assert.throws(() => collectArtifacts(output, release, ['portable'], path.join(root, 'different-project')), /outside/);
  assert.deepEqual(fs.readdirSync(release), []);
});
