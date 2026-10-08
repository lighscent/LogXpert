const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { log, testLogger, cleanupTmp, makeTmpDir, fileTransport, waitForLog } = require('./helpers');

after(cleanupTmp);

describe('file logging', () => {
  beforeEach(() => log.setLevel('debug'));
  afterEach(() => log.close());

  it('defaults filename prefix to package.json name', () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir } });
    const t = fileTransport(inst);
    assert.ok(t.filename.startsWith('logxpert-'), `expected logxpert- prefix, got ${t.filename}`);
    assert.equal(path.normalize(t.dirname), path.normalize(dir));
    inst.close();
  });

  it('files.appName overrides the filename prefix', () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: '@myorg/my-app!' } });
    assert.ok(fileTransport(inst).filename.startsWith('my-app-'));
    inst.close();
  });

  it('runNumber is disabled by default', () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'myapp' } });
    assert.equal(fileTransport(inst).filename, 'myapp-%DATE%.log');
    inst.close();
  });

  it('runNumber increments across restarts', () => {
    const dir = makeTmpDir();
    const a = testLogger();
    a.settings({ files: { folder: dir, appName: 'myapp', runNumber: true } });
    assert.ok(fileTransport(a).filename.endsWith('-1.log'));
    a.close();
    const b = testLogger();
    b.settings({ files: { folder: dir, appName: 'myapp', runNumber: true } });
    assert.ok(fileTransport(b).filename.endsWith('-2.log'));
    assert.equal(fs.readFileSync(path.join(dir, '.myapp.run'), 'utf8'), '2');
    b.close();
  });

  it('runNumber format is customizable', () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'myapp', runNumber: { separator: '_', padding: 3 } } });
    assert.ok(fileTransport(inst).filename.endsWith('_001.log'));
    inst.close();
  });

  it('supports new option names with legacy aliases', () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, prefix: 'svc', dateFormat: 'YYYY-MM-DD' } });
    assert.equal(fileTransport(inst).filename, 'svc-%DATE%.log');
    inst.close();
    const inst2 = testLogger();
    inst2.settings({ files: { folder: dir, filePattern: 'custom-%DATE%.log' } });
    assert.equal(fileTransport(inst2).filename, 'custom-%DATE%.log');
    inst2.close();
  });

  it('accepts %datePattern% placeholder and converts it for winston', () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, filePattern: 'app-%datePattern%.log' } });
    assert.equal(fileTransport(inst).filename, 'app-%DATE%.log');
    inst.close();
  });

  it('rejects combining prefix with filePattern', () => {
    assert.throws(() => log.settings({ files: { folder: 'x', prefix: 'a', filePattern: 'b-%DATE%.log' } }), /pick one/);
    assert.throws(() => log.settings({ files: { folder: 'x', appName: 'a', filename: 'b-%DATE%.log' } }), /pick one/);
  });

  it('runNumber rejects invalid options', () => {
    assert.throws(() => log.settings({ files: { folder: 'x', runNumber: 'yes' } }), /runNumber/);
    assert.throws(() => log.settings({ files: { folder: 'x', runNumber: { separator: '' } } }), /separator/);
  });

  it('runNumber honors startAt, explicit off and corrupt counters', () => {
    const dir = makeTmpDir();
    const a = testLogger();
    a.settings({ files: { folder: dir, appName: 'cnt', runNumber: { startAt: 5 } } });
    assert.ok(fileTransport(a).filename.endsWith('-5.log'));
    a.close();
    const b = testLogger();
    b.settings({ files: { folder: dir, appName: 'cnt', runNumber: { enabled: false } } });
    assert.ok(!/-\d+\.log$/.test(fileTransport(b).filename), 'no suffix when disabled');
    b.close();
    fs.writeFileSync(path.join(dir, '.cnt.run'), 'garbage');
    const c = testLogger();
    c.settings({ files: { folder: dir, appName: 'cnt', runNumber: true } });
    assert.ok(fileTransport(c).filename.endsWith('-1.log'), 'corrupt counter resets');
    c.close();
  });

  it('writes rotated file with custom filename', () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, filename: 'app-%DATE%.log', datePattern: 'YYYY-MM-DD', maxSize: '20m', maxFile: '14d' } });
    const t = fileTransport(inst);
    assert.equal(t.filename, 'app-%DATE%.log');
    assert.equal(t.options.datePattern, 'YYYY-MM-DD');
    inst.close();
  });

  it('strips ANSI escapes and control chars from messages', async () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'sec' } });
    inst.info('\x1b[31mhello\x1b[0m\x07world\x0d\x00!');
    const file = await waitForLog(dir, 'helloworld!');
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(!content.includes('\x1b'), 'no ESC byte should remain');
    assert.ok(!content.includes('\x00'), 'no NUL byte should remain');
    inst.close();
  });

  it('strips spinner and cursor sequences from messages', async () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'spin' } });
    inst.info('⠙\x1b[1G\x1b[0Kloading\x9b2Kdone\x1b]0;title\x07end\x9dosc\x9c!');
    const file = await waitForLog(dir, 'loading');
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(content.includes('⠙loadingdoneend!'), `spinner junk should be gone, got: ${content}`);
    assert.ok(!content.includes('\x1b') && !content.includes('\x9b') && !content.includes('\x9d'));
    inst.close();
  });

  it('file lines carry ISO timestamps', async () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'iso' } });
    inst.info('iso-test-message');
    const file = await waitForLog(dir, 'iso-test-message');
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.match(content, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    inst.close();
  });

  it('rotates files across a real date boundary', async () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'rot', datePattern: 'YYYY_MM_DD-HH_mm_ss' } });
    inst.info('before-boundary');
    await new Promise((r) => setTimeout(r, 1200));
    inst.info('after-boundary');
    const start = Date.now();
    let files = [];
    while (Date.now() - start < 5000) {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
      if (files.length >= 2) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(files.length >= 2, `expected rotation, got ${files}`);
    const contents = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    assert.ok(contents.includes('before-boundary'));
    assert.ok(contents.includes('after-boundary'));
    inst.close();
  });

  it('maxSize rotation works end to end', async () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'big', maxSize: '100' } });
    inst.info('x'.repeat(200));
    inst.info('y'.repeat(200));
    const start = Date.now();
    let files = [];
    while (Date.now() - start < 3000) {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
      if (files.length >= 2) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(files.length >= 2, `expected rotated files, got ${files}`);
    inst.close();
  });

  it('does not lose rapid successive writes', async () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'burst' } });
    for (let i = 0; i < 100; i++) inst.info(`burst-${i}`);
    const start = Date.now();
    let count = 0;
    while (Date.now() - start < 3000) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
      count = 0;
      for (const f of files) {
        try {
          const content = fs.readFileSync(path.join(dir, f), 'utf8');
          count += content.split('\n').filter((l) => l.includes('burst-')).length;
        } catch {}
      }
      if (count >= 100) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(count, 100);
    inst.close();
  });

  it('close flushes pending writes', async () => {
    const dir = makeTmpDir();
    const inst = testLogger();
    inst.settings({ files: { folder: dir, appName: 'flush' } });
    inst.info('flush-me');
    inst.close();
    await waitForLog(dir, 'flush-me');
  });
});
