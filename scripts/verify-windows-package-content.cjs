const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const PE = require('pe-library');
const ResEdit = require('resedit');
const asar = require('@electron/asar');
const projectRoot = path.resolve(__dirname, '..');
const appDir = path.resolve(projectRoot, process.argv[2]);
const releaseDir = path.resolve(projectRoot, process.argv[3]);
const manifest = JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json')));
for (const artifact of manifest.artifacts) {
  const artifactPath = path.resolve(projectRoot, artifact.file);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex'), artifact.sha256);
  const signature = fs.readFileSync(artifactPath).subarray(0, 2).toString();
  assert.equal(signature, 'MZ');
}
assert.equal(new Set(manifest.artifacts.map(a => path.basename(a.file))).size, 2);
const executable = PE.NtExecutable.from(fs.readFileSync(path.join(appDir, 'indichat.exe')), { ignoreCert: true });
const resources = PE.NtExecutableResource.from(executable);
const version = ResEdit.Resource.VersionInfo.fromEntries(resources.entries)[0].getStringValues({ lang: 1033, codepage: 1200 });
assert.equal(version.ProductName, 'IndiChat');
assert.equal(version.FileVersion, '1.0.0.0');
assert.equal(resources.entries.filter(e => e.type === 14).length, 1);
const integrity = JSON.parse(Buffer.from(resources.entries.find(e => e.type === 'INTEGRITY').bin).toString());
for (const entry of integrity) {
  assert.equal(entry.alg, 'SHA256');
  const header = asar.getRawHeader(path.join(appDir, entry.file)).headerString;
  assert.equal(crypto.createHash('sha256').update(header).digest('hex'), entry.value);
}
const archive = path.join(appDir, 'resources', 'app.asar');
const files = asar.listPackage(archive);
assert.ok(files.includes('/dist-web/index.html'));
const main = asar.extractFile(archive, 'src/main.cjs').toString();
assert.ok(main.includes('sandbox: true'));
assert.ok(main.includes('contextIsolation: true'));
assert.ok(main.includes('nodeIntegration: false'));
const result = {
  kind: 'static Windows package verification; not native execution',
  artifactHashesMatch: true, distinctMZWrappers: true, brandingAndVersion: true,
  oneApplicationIconGroup: true, asarIntegrityHashMatches: true,
  bundledWebAssetsPresent: true, productionSandboxConfigurationPreserved: true,
  nativeRuntimeVerified: false, signed: false
};
fs.writeFileSync(path.join(releaseDir, 'package-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
