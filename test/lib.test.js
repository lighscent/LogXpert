const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const { LEVELS, MiniLogger, ConsoleTransport } = require('../lib/mini');
const { FileTransport, parseSize, parseDays } = require('../lib/rotate');

function fileTransportEntry(level, message, meta = []) {
  return { level, message, meta };
}

describe('mini logger core', () => {
  it('orders levels from error to silly', () => {
    const order = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
    order.forEach((level, i) => assert.equal(LEVELS[level], i));
  });

  it('enabled() respects global and transport levels', () => {
    const logger = new MiniLogger({ level: 'warn' });
    assert.equal(logger.enabled('error'), true);
    assert.equal(logger.enabled('warn'), true);
    assert.equal(logger.enabled('info'), false);
    assert.equal(logger.enabled('info', 'debug'), true);
    assert.equal(logger.enabled('debug', 'error'), false);
    assert.equal(logger.enabled('nope'), false);
  });

  it('routes only enabled entries to each transport', () => {
    const seen = [];
    const logger = new MiniLogger({ level: 'info' });
    logger.add({ level: 'error', write: (e) => seen.push(['err-t', e.message]) });
    logger.add({ write: (e) => seen.push(['all-t', e.message]) });
    logger.log('debug', 'dropped');
    logger.log('error', 'kept');
    assert.deepEqual(seen, [['err-t', 'kept'], ['all-t', 'kept']]);
  });

  it('resolveLevelColors merges overrides over defaults', () => {
    const { resolveLevelColors } = require('../lib/mini');
    const map = resolveLevelColors({ info: 'blue', warn: 208, error: false });
    assert.equal(map.info, 34);
    assert.equal(map.warn, 208);
    assert.ok(!('error' in map));
    assert.equal(map.debug, 34);
    assert.throws(() => resolveLevelColors({ info: 'blurple' }), /Unknown color/);
    assert.throws(() => resolveLevelColors('red'), /must be an object/);
  });

  it('remove() detaches and closes the transport', () => {
    let closed = 0;
    const t = { write: () => {}, close: () => { closed++; } };
    const logger = new MiniLogger({});
    logger.add(t);
    logger.remove(t);
    assert.equal(logger.transports.length, 0);
    logger.remove(t);
    assert.equal(closed, 2, 'close is invoked on every remove (idempotent transports)');
  });

  it('child() prepends context meta', () => {
    const seen = [];
    const logger = new MiniLogger({ level: 'debug' });
    logger.add({ write: (e) => seen.push(e) });
    const child = logger.child({ service: 'api' });
    child.info('msg', { extra: 1 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].message, 'msg');
    assert.deepEqual(seen[0].meta, [{ service: 'api' }, { extra: 1 }]);
  });

  it('console transport sends error/warn to stderr', () => {
    const lines = { out: [], err: [] };
    const origOut = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (c) => { lines.out.push(String(c)); return true; };
    process.stderr.write = (c) => { lines.err.push(String(c)); return true; };
    try {
      const t = new ConsoleTransport({ render: (e) => e.message });
      t.write(fileTransportEntry('info', 'hello'));
      t.write(fileTransportEntry('error', 'oops'));
      t.write(fileTransportEntry('warn', 'careful'));
    } finally {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
    }
    assert.deepEqual(lines.out, ['hello\n']);
    assert.deepEqual(lines.err, ['oops\n', 'careful\n']);
  });
});

describe('file rotation', () => {
  it('parses sizes and retentions', () => {
    assert.equal(parseSize('20m', 0), 20 * 1024 * 1024);
    assert.equal(parseSize('1k', 0), 1024);
    assert.equal(parseSize('2g', 0), 2 * 1024 * 1024 * 1024);
    assert.equal(parseSize('512', 0), 512);
    assert.equal(parseSize('nope', 42), 42);
    assert.equal(parseSize(null, 7), 7);
    assert.equal(parseDays('14d'), 14);
    assert.equal(parseDays('20m'), null);
    assert.equal(parseDays(null), null);
  });

  it('rotates to a suffixed file past maxSize', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const t = new FileTransport({
      folder: dir,
      filename: 'big-%DATE%.log',
      datePattern: 'YYYY_MM_DD',
      maxSize: '10',
      render: (e) => String(e.message),
    });
    t.write(fileTransportEntry('info', 'x'.repeat(50)));
    t.write(fileTransportEntry('info', 'y'.repeat(50)));
    t.close();
    const start = Date.now();
    let files = [];
    while (Date.now() - start < 3000) {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
      if (files.length >= 2) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(files.length >= 2, `expected rotated files, got ${files}`);
    assert.ok(files.some((f) => /-1\.log$/.test(f)));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exposes dirname, filename template and options', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const t = new FileTransport({
      folder: dir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      render: (e) => String(e.message),
    });
    assert.equal(t.dirname, dir);
    assert.equal(t.filename, 'app-%DATE%.log');
    assert.equal(t.options.datePattern, 'YYYY-MM-DD');
    t.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('gzips the previous file on date change when enabled', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const t = new FileTransport({
      folder: dir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY_MM_DD',
      zippedArchive: true,
      render: (e) => String(e.message),
    });
    const prev = path.join(dir, 'app-2026_10_01.log');
    fs.writeFileSync(prev, 'old-content');
    t.onDateChanged(prev);
    assert.ok(!fs.existsSync(prev), 'original should be removed');
    assert.ok(fs.existsSync(prev + '.gz'), 'gzip should exist');
    assert.equal(zlib.gunzipSync(fs.readFileSync(prev + '.gz')).toString(), 'old-content');
    t.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('leaves the previous file alone without zippedArchive', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const t = new FileTransport({
      folder: dir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY_MM_DD',
      render: (e) => String(e.message),
    });
    const prev = path.join(dir, 'app-2026_10_01.log');
    fs.writeFileSync(prev, 'old-content');
    t.onDateChanged(prev);
    assert.ok(fs.existsSync(prev), 'original should be kept');
    assert.ok(!fs.existsSync(prev + '.gz'));
    t.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cleanupOld deletes only old log files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const t = new FileTransport({
      folder: dir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY_MM_DD',
      maxFiles: '7d',
      render: (e) => String(e.message),
    });
    const oldLog = path.join(dir, 'app-2026_10_01.log');
    const recentLog = path.join(dir, 'app-2026_10_08.log');
    const oldTxt = path.join(dir, 'notes.txt');
    fs.writeFileSync(oldLog, 'x');
    fs.writeFileSync(recentLog, 'x');
    fs.writeFileSync(oldTxt, 'x');
    const past = Date.now() / 1000 - 10 * 86400;
    fs.utimesSync(oldLog, past, past);
    fs.utimesSync(oldTxt, past, past);
    t.cleanupOld();
    assert.ok(!fs.existsSync(oldLog), 'old log deleted');
    assert.ok(fs.existsSync(recentLog), 'recent log kept');
    assert.ok(fs.existsSync(oldTxt), 'non-log files untouched');
    t.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reopens a new file when the date changes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
    const t = new FileTransport({
      folder: dir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY_MM_DD',
      render: (e) => String(e.message),
    });
    t.write(fileTransportEntry('info', 'first-day'));
    t.rotateIfNeeded('2000_01_01', 10);
    assert.ok(String(t.currentFile).includes('2000_01_01'), 'stream should point at the new date file');
    t.write(fileTransportEntry('info', 'second-day'));
    t.close();
    const start = Date.now();
    let files = [];
    while (Date.now() - start < 3000) {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
      if (files.length >= 2) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(files.length >= 2, `expected two date files, got ${files}`);
    assert.ok(files.some((f) => f.includes('2000_01_01')));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
