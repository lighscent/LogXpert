const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { log, testLogger, cleanupTmp } = require('./helpers');

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

  it('instances can spawn sub-loggers via createLogger', () => {
    const inst = testLogger();
    const sub = inst.createLogger({ level: 'error' });
    assert.equal(sub.getLevel(), 'error');
    assert.equal(inst.getLevel(), 'debug');
    sub.close();
    inst.close();
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

  it('every level method delivers to transports', () => {
    const inst = testLogger({ level: 'silly' });
    const seen = [];
    const spy = { write: (e) => seen.push(e.level) };
    inst._winston.add(spy);
    try {
      for (const m of ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']) inst[m](`${m}-marker`);
      inst.log('info', 'log-marker');
    } finally {
      inst._winston.remove(spy);
    }
    for (const m of ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']) {
      assert.ok(seen.includes(m), `${m} should be delivered`);
    }
    inst.close();
  });

  it('honors the LOG_LEVEL environment variable', () => {
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'error';
    try {
      const inst = testLogger();
      assert.equal(inst.getLevel(), 'error');
      inst.close();
    } finally {
      if (prev === undefined) delete process.env.LOG_LEVEL;
      else process.env.LOG_LEVEL = prev;
    }
  });

  it('child.log validates its level', () => {
    const inst = testLogger();
    assert.throws(() => inst.child({}).log('nope', 'x'), /Invalid log level/);
    inst.close();
  });

  it('settings rejects invalid console options', () => {
    const inst = testLogger();
    assert.throws(() => inst.settings({ console: { level: 'nope' } }), /Invalid log level/);
    inst.close();
  });
});
