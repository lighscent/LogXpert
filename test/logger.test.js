const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { log, testLogger } = require('./helpers');
const { cleanupTmp } = require('./helpers');

after(cleanupTmp);

describe('logger api', () => {
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
    assert.throws(() => log.settings({ files: { folder: 'x', datePattern: '' } }), /datePattern/);
  });

  it('logs strings, objects and Errors without throwing', () => {
    const inst = testLogger();
    inst('hello');
    inst.info('hello', { user: 1 });
    inst.info({ hello: 'world' });
    inst.error(new Error('boom'));
    inst.close();
  });

  it('createLogger returns isolated instance', () => {
    const a = testLogger({ level: 'error' });
    const b = testLogger({ level: 'debug' });
    assert.equal(a.getLevel(), 'error');
    assert.equal(b.getLevel(), 'debug');
    a.close();
    b.close();
  });

  it('close is idempotent and settings accepts empty options', () => {
    const inst = testLogger();
    inst.close();
    inst.close();
    inst.settings({});
    inst.settings({ level: 'info' });
    assert.equal(inst.getLevel(), 'info');
    inst.close();
  });

  it('log() validates its level argument', () => {
    const inst = testLogger();
    assert.throws(() => inst.log('nope', 'msg'), /Invalid log level/);
    inst.close();
  });

  it('rejects filenames escaping the log folder', () => {
    assert.throws(() => log.settings({ files: { folder: 'x', filename: '../evil-%DATE%.log' } }), /escape/);
    assert.throws(() => log.settings({ files: { folder: 'x', filename: '..\\evil-%DATE%.log' } }), /escape/);
    assert.throws(() => log.settings({ files: { folder: 'x', filename: '/abs-%DATE%.log' } }), /escape/);
  });
});
