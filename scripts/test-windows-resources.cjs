const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const PE = require('pe-library');
const ResEdit = require('resedit');
const { editExecutable } = require('./edit-windows-resources.cjs');
test('unsigned resource editing sets branding and preserves integrity resources', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'indichat-pe-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'indichat.exe');
  const exe = PE.NtExecutable.createEmpty(false, false);
  const resources = PE.NtExecutableResource.from(exe);
  const seedIcons = ResEdit.Data.IconFile.from(fs.readFileSync(path.resolve('apps/desktop/assets/icon.ico')));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 1, 1033, seedIcons.icons.map(i => i.data));
  resources.entries.push({ type: 'INTEGRITY', id: 'ELECTRONASAR', lang: 1033, codepage: 0, bin: Buffer.from('preserve-exactly') });
  resources.outputResource(exe);
  fs.writeFileSync(filename, Buffer.from(exe.generate()));
  editExecutable(filename, path.resolve('apps/desktop/assets/icon.ico'), {
    version: '1.0.0', productName: 'IndiChat', description: 'IndiChat Desktop', companyName: 'IndiChat', copyright: '2026'
  });
  const updated = PE.NtExecutableResource.from(PE.NtExecutable.from(fs.readFileSync(filename)));
  const version = ResEdit.Resource.VersionInfo.fromEntries(updated.entries)[0];
  assert.equal(version.getStringValues({ lang: 1033, codepage: 1200 }).ProductName, 'IndiChat');
  assert.equal(version.getStringValues({ lang: 1033, codepage: 1200 }).FileVersion, '1.0.0.0');
  assert.equal(Buffer.from(updated.entries.find(e => e.type === 'INTEGRITY').bin).toString(), 'preserve-exactly');
  assert.equal(updated.entries.filter(e => e.type === 14).length, 1);
  assert.equal(updated.entries.find(e => e.type === 14).id, 1);
});
test('afterPack locates the configured executable and writes unsigned metadata', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'indichat-hook-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'indichat.exe');
  fs.writeFileSync(filename, Buffer.from(PE.NtExecutable.createEmpty(false, false).generate()));
  await require('./edit-windows-resources.cjs')({
    electronPlatformName: 'win32', appOutDir: directory,
    packager: {
      config: { executableName: 'indichat' },
      appInfo: { version: '1.0.0', productName: 'IndiChat', description: 'Chat', companyName: 'IndiChat', copyright: '2026' },
      getIconPath: async () => path.resolve('apps/desktop/assets/icon.ico')
    }
  });
  const resources = PE.NtExecutableResource.from(PE.NtExecutable.from(fs.readFileSync(filename)));
  assert.ok(resources.entries.some(e => e.type === 16));
});
test('Windows hook rejects non-Windows packaging contexts', async () => {
  await assert.rejects(require('./edit-windows-resources.cjs')({ electronPlatformName: 'linux' }), /non-Windows/);
});
