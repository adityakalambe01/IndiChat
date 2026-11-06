import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
test('iOS build installs pods even when the native project already exists', () => {
  const commands = [];
  const stop = new Error('stop before compilation');
  const filesystem = {
    existsSync: () => true, mkdirSync() {}, copyFileSync() {}, readdirSync: () => [],
  };
  try {
    vm.runInNewContext(fs.readFileSync('scripts/build-ios.js', 'utf8'), {
      __dirname: path.resolve('scripts'), console: { log() {}, error() {} },
      process: { platform: 'darwin', argv: ['node', 'build-ios.js', '--sim'], env: { PATH: '/opt/homebrew/bin' }, exit: code => { throw Error(`exit ${code}`); } },
      require: name => name === 'fs' ? filesystem : name === 'path' ? path : {
        spawnSync(command, args) {
          commands.push([command, args]);
          if (command === 'xcodebuild' && !args.includes('-version')) throw stop;
          return { status: 0, stdout: 'Xcode 27.2\n' };
        },
      },
    });
  } catch (error) { assert.equal(error, stop); }
  assert.ok(commands.some(([command, args]) => command === 'pod' && args[0] === 'install'));
});
