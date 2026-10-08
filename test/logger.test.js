const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const log = require('../main.js');

const tmpDirs = [];
after(async () => {
  await new Promise((r) => setTimeout(r, 250));
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

function fileTransport(inst) {
  const t = inst._winston.transports.find((x) => typeof x.filename === 'string' && x.filename.includes('%DATE%'));
  assert.ok(t, 'expected a DailyRotateFile transport');
  return t;
}

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

  it('defaults filename prefix to package.json name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir } });
    const t = fileTransport(inst);
    assert.ok(t.filename.startsWith('logxpert-'), `expected logxpert- prefix, got ${t.filename}`);
    assert.equal(path.normalize(t.dirname), path.normalize(dir));
    inst.close(); tmpDirs.push(dir);
  });

  it('files.appName overrides the filename prefix', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, appName: '@myorg/my-app!' } });
    assert.ok(fileTransport(inst).filename.startsWith('my-app-'));
    inst.close(); tmpDirs.push(dir);
  });

  it('runNumber is disabled by default', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, appName: 'myapp' } });
    assert.equal(fileTransport(inst).filename, 'myapp-%DATE%.log');
    inst.close(); tmpDirs.push(dir);
  });

  it('runNumber increments across restarts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const a = log.createLogger();
    a.settings({ files: { folder: dir, appName: 'myapp', runNumber: true } });
    assert.ok(fileTransport(a).filename.endsWith('-1.log'));
    a.close();
    const b = log.createLogger();
    b.settings({ files: { folder: dir, appName: 'myapp', runNumber: true } });
    assert.ok(fileTransport(b).filename.endsWith('-2.log'));
    assert.equal(fs.readFileSync(path.join(dir, '.myapp.run'), 'utf8'), '2');
    b.close(); tmpDirs.push(dir);
  });

  it('runNumber format is customizable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, appName: 'myapp', runNumber: { separator: '_', padding: 3 } } });
    assert.ok(fileTransport(inst).filename.endsWith('_001.log'));
    inst.close(); tmpDirs.push(dir);
  });

  it('runNumber rejects invalid options', () => {
    assert.throws(() => log.settings({ files: { folder: 'x', runNumber: 'yes' } }), /runNumber/);
    assert.throws(() => log.settings({ files: { folder: 'x', runNumber: { separator: '' } } }), /separator/);
  });

  it('rejects filenames escaping the log folder', () => {
    assert.throws(() => log.settings({ files: { folder: 'x', filename: '../evil-%DATE%.log' } }), /escape/);
    assert.throws(() => log.settings({ files: { folder: 'x', filename: '..\\evil-%DATE%.log' } }), /escape/);
  });

  it('strips ANSI escapes and control chars from messages', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, appName: 'sec' } });
    inst.info('\x1b[31mhello\x1b[0m\x07world\x0d\x00!');
    const file = await waitForLog(dir, 'helloworld!');
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(!content.includes('\x1b'), 'no ESC byte should remain');
    assert.ok(!content.includes('\x00'), 'no NUL byte should remain');
    inst.close(); tmpDirs.push(dir);
  });

  it('evaluates function messages lazily only when level enabled', () => {
    const inst = log.createLogger({ level: 'error' });
    let called = 0;
    inst.debug(() => { called++; return 'expensive'; });
    assert.equal(called, 0);
    inst.setLevel('debug');
    inst.debug(() => { called++; return 'expensive'; });
    assert.equal(called, 1);
    inst.close();
  });

  it('writes rotated file with custom filename', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const inst = log.createLogger();
    inst.settings({ files: { folder: dir, filename: 'app-%DATE%.log', datePattern: 'YYYY-MM-DD', maxSize: '20m', maxFile: '14d' } });
    const t = fileTransport(inst);
    assert.equal(t.filename, 'app-%DATE%.log');
    assert.equal(t.options.datePattern, 'YYYY-MM-DD');
    inst.close(); tmpDirs.push(dir);
  });

  it('child logger shares level and logs with meta', () => {
    const c = log.child({ service: 'api' });
    c.info('child-msg');
  });
});
