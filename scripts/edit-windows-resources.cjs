const fs = require('node:fs');
const path = require('node:path');
const PE = require('pe-library');
const ResEdit = require('resedit');

// Explicit unsigned local-build path. ResEdit preserves unrelated resources,
// including Electron's ASAR integrity entry, and drops invalid original signatures.
function editExecutable(filename, iconPath, metadata) {
  const exe = PE.NtExecutable.from(fs.readFileSync(filename), { ignoreCert: true });
  const resources = PE.NtExecutableResource.from(exe);
  const icons = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  const groups = resources.entries.filter(e => e.type === 14).map(e => ({ id: e.id, lang: e.lang }));
  if (!groups.length) groups.push({ id: 1, lang: 1033 });
  for (const group of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, icons.icons.map(i => i.data));
  }
  const version = ResEdit.Resource.VersionInfo.fromEntries(resources.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  version.setFileVersion(metadata.version, 1033);
  version.setProductVersion(metadata.version, 1033);
  version.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: metadata.description, ProductName: metadata.productName,
    CompanyName: metadata.companyName, LegalCopyright: metadata.copyright,
    InternalName: path.basename(filename, '.exe'), OriginalFilename: path.basename(filename)
  });
  version.outputToResourceEntries(resources.entries);
  resources.outputResource(exe);
  fs.writeFileSync(filename, Buffer.from(exe.generate()));
}
async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') throw new Error('Windows resource hook used for a non-Windows package');
  const info = context.packager.appInfo;
  const executableName = context.packager.config.executableName || info.productFilename;
  editExecutable(path.join(context.appOutDir, `${executableName}.exe`), await context.packager.getIconPath(), {
    version: info.version, productName: info.productName, description: info.description || info.productName,
    companyName: info.companyName || '', copyright: info.copyright || ''
  });
}
module.exports = afterPack;
module.exports.editExecutable = editExecutable;
