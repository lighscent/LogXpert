const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const log = require('../main.js');

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

  it('writes rotated file with custom filename', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, filename: 'app-%DATE%.log', datePattern: 'YYYY-MM-DD', maxSize: '20m', maxFile: '14d' } });
    inst.info('file-test-message');
    await new Promise((r) => setTimeout(r, 800));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
    assert.ok(files.length > 0, 'expected a .log file');
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf8');
    assert.ok(content.includes('file-test-message'));
    inst.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('child logger shares level and logs with meta', () => {
    const c = log.child({ service: 'api' });
    c.info('child-msg');
  });
});
