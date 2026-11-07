const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const patterns = {
  nsis: /^IndiChat-Setup-.*\.exe$/i,
  portable: /^IndiChat-Portable-.*\.exe$/i,
  AppImage: /\.AppImage$/i,
  deb: /\.deb$/i,
  snap: /\.snap$/i,
  'tar.gz': /\.tar\.gz$/i
};
function collectArtifacts(output, release, targets, projectRoot = path.resolve(__dirname, '..')) {
  const relativeRelease = path.relative(projectRoot, path.resolve(release));
  if (relativeRelease === '..' || relativeRelease.startsWith(`..${path.sep}`) || path.isAbsolute(relativeRelease)) {
    throw new Error('Release output is outside the project root');
  }
  const names = fs.readdirSync(output).filter(name => fs.statSync(path.join(output, name)).isFile());
  const selected = new Set();
  for (const target of targets) {
    if (!patterns[target]) throw new Error(`Unsupported target: ${target}`);
    const matches = names.filter(name => patterns[target].test(name));
    if (!matches.length) throw new Error(`No artifact generated for requested target: ${target}`);
    for (const name of matches) selected.add(name);
  }
  // Validate the entire set before copying anything.
  for (const name of selected) {
    if (fs.existsSync(path.join(release, name))) throw new Error(`Artifact already exists: ${path.join(release, name)}`);
  }
  fs.mkdirSync(release, { recursive: true });
  return [...selected].map(name => {
    const source = path.join(output, name); const destination = path.join(release, name);
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    if (/\.AppImage$/i.test(name)) fs.chmodSync(destination, 0o755);
    return { file: `./${path.relative(projectRoot, destination).split(path.sep).join('/')}`, bytes: fs.statSync(destination).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex') };
  });
}
function verifyArchive(archive, expectedSha256) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 || '')) throw new Error('Missing trusted SHA-256 checksum');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  if (actual !== expectedSha256.toLowerCase()) throw new Error(`Runtime checksum mismatch: ${archive}`);
  return archive;
}
function verifyElectronDist(directory, platform, arch = 'x64') {
  const version = require('electron/package.json').version;
  const name = `electron-v${version}-${platform}-${arch}.zip`;
  const checksums = require('electron/checksums.json');
  verifyArchive(path.join(directory, name), checksums[name]);
  return path.resolve(directory);
}
module.exports = { collectArtifacts, verifyArchive, verifyElectronDist };
