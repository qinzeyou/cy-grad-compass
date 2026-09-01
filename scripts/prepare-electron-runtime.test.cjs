const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const runtimeNames = [
  'msvcp140.dll',
  'msvcp140_1.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll',
];

test('prepares the VC++ runtime beside electron.exe', { skip: process.platform !== 'win32' }, () => {
  execFileSync(process.execPath, [path.join(__dirname, 'prepare-electron-runtime.cjs')]);

  for (const name of runtimeNames) {
    const source = fs.readFileSync(path.join(projectRoot, 'resources', 'runtime', 'win32', name));
    const target = fs.readFileSync(path.join(projectRoot, 'node_modules', 'electron', 'dist', name));
    assert.deepEqual(target, source, `${name} should match the bundled runtime`);
  }
});
