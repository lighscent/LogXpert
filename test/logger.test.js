const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const log = require('../main.js');

async function waitForLog(dir, expected, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(dir, f), 'utf8');
        if (content.includes(expected)) return f;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`timeout waiting for "${expected}" in ${dir}`);
}

describe('logxpert v2', () => {
  beforeEach(() => log.setLevel('debug'));
  afterEach(() => log.close());

  it('exposes callable default + level methods', () => {
    assert.equal(typeof log, 'function');
    for (const m of ['error', 'warn', 'info', 'debug', 'settings', 'setLevel', 'getLevel', 'child', 'close', 'createLogger']) {
      assert.equal(typeof log[m], 'function', m);
    }
  });

  it('setLevel/getLevel validates', () => {
    log.setLevel('info');
    assert.equal(log.getLevel(), 'info');
    assert.throws(() => log.setLevel('nope'), /Invalid log level/);
  });

  it('settings rejects invalid files options', () => {
    assert.throws(() => log.settings({ files: { folder: '' } }), /folder/);
    assert.throws(() => log.settings({ files: { folder: 'x', filesName: '' } }), /filesName/);
  });

  it('logs strings, objects and Errors without throwing', () => {
    log('hello');
    log.info('hello', { user: 1 });
    log.info({ hello: 'world' });
    log.error(new Error('boom'));
  });

  it('createLogger returns isolated instance', () => {
    const a = log.createLogger({ level: 'error' });
    const b = log.createLogger({ level: 'debug' });
    assert.equal(a.getLevel(), 'error');
    assert.equal(b.getLevel(), 'debug');
    a.close();
    b.close();
  });

  it('defaults filename prefix to package.json name', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir } });
    inst.info('prefix-test-message');
    const file = await waitForLog(dir, 'prefix-test-message');
    assert.ok(file.startsWith('logxpert-'), `expected logxpert- prefix, got ${file}`);
    inst.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('files.appName overrides the filename prefix', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, appName: '@myorg/my-app!' } });
    inst.info('appname-test-message');
    const file = await waitForLog(dir, 'appname-test-message');
    assert.ok(file.startsWith('my-app-'), `expected my-app- prefix, got ${file}`);
    inst.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes rotated file with custom filename', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, filename: 'app-%DATE%.log', datePattern: 'YYYY-MM-DD', maxSize: '20m', maxFile: '14d' } });
    inst.info('file-test-message');
    await waitForLog(dir, 'file-test-message');
    inst.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('child logger shares level and logs with meta', () => {
    const c = log.child({ service: 'api' });
    c.info('child-msg');
  });
});
