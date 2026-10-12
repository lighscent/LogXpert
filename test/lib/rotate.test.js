/** Unit tests for lib/rotate.js (direct require, no facade). */
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { cleanupTmp, makeTmpDir } = require('../helpers');

const { FileTransport, parseSize, parseDays } = require('../../lib/rotate');
const { createLogEvent } = require('../../lib/event');

after(cleanupTmp);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeFileTransport(dir, overrides = {}) {
  return new FileTransport({
    folder: dir,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY_MM_DD',
    render: (e) => String(e.message),
    ...overrides,
  });
}

describe('rotate', () => {
  it('parses sizes and retentions', () => {
    assert.equal(parseSize('20m', 0), 20 * 1024 * 1024);
    assert.equal(parseSize('1k', 0), 1024);
    assert.equal(parseSize('2g', 0), 2 * 1024 * 1024 * 1024);
    assert.equal(parseSize('512', 0), 512);
    assert.equal(parseSize('1.5k', 0), 1536);
    assert.equal(parseSize('20M', 0), 20 * 1024 * 1024);
    assert.equal(parseSize('10 m', 0), 10 * 1024 * 1024);
    assert.equal(parseSize('nope', 42), 42);
    assert.equal(parseSize(null, 7), 7);
    assert.equal(parseDays('14d'), 14);
    assert.equal(parseDays('14D'), 14);
    assert.equal(parseDays(' 3d '), 3);
    assert.equal(parseDays('20m'), null);
    assert.equal(parseDays('7'), null);
    assert.equal(parseDays(null), null);
  });

  it('fileNameFor() stamps dates and size suffixes', () => {
    const t = makeFileTransport(makeTmpDir());
    assert.equal(t.fileNameFor('2026_10_01'), 'app-2026_10_01.log');
    assert.equal(t.fileNameFor('2026_10_01', 2), 'app-2026_10_01-2.log');
    t.close();
  });

  it('stemFor() maps date files to their stem', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir);
    assert.equal(t.stemFor('app-2026_10_01.log'), 'app-2026_10_01');
    assert.equal(t.stemFor('other-2026_10_01.log'), null);
    assert.equal(t.stemFor('x'), null);
    const plain = makeFileTransport(dir, { filename: 'plain.log' });
    assert.equal(plain.stemFor('plain.log'), null);
    const noTail = makeFileTransport(dir, { filename: 'app-%DATE%' });
    assert.equal(noTail.stemFor('app-2026'), 'app-2026');
    t.close();
    plain.close();
    noTail.close();
  });

  it('archiveDay() ignores non-archivable inputs', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { zippedArchive: true });
    assert.doesNotThrow(() => {
      t.archiveDay(null);
      t.archiveDay(42);
      t.archiveDay(path.join(dir, 'already.log.gz'));
      t.archiveDay(path.join(dir, 'notes.txt'));
      t.archiveDay(path.join(dir, 'missing-2026_10_01.log'));
    });
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.gz')), []);
    const kept = path.join(dir, 'keep-2026_10_01.log');
    fs.writeFileSync(kept, 'data');
    const plain = makeFileTransport(dir);
    plain.archiveDay(kept);
    assert.ok(fs.existsSync(kept), 'no archive without zippedArchive');
    assert.ok(!fs.existsSync(path.join(dir, 'keep-2026_10_01.log.gz')));
    t.close();
    plain.close();
  });

  it('open() resumes past pre-existing full files', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'app-2026_10_01.log'), 'x'.repeat(50));
    const t = makeFileTransport(dir, { maxSize: '10' });
    t.open('2026_10_01');
    assert.ok(t.currentFile.endsWith('app-2026_10_01-1.log'), `got ${t.currentFile}`);
    assert.equal(t.currentKey, '2026_10_01#1');
    t.close();
  });

  it('captures stream errors instead of crashing', async () => {
    const dir = makeTmpDir();
    const blocker = path.join(dir, 'blocker');
    fs.writeFileSync(blocker, 'not a dir');
    const t = makeFileTransport(dir, { folder: blocker });
    t.write(createLogEvent('info', 'hello'));
    const start = Date.now();
    while (!t.streamErr && Date.now() - start < 3000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(t.streamErr, 'stream error should be captured');
    t.close();
  });

  it('rotates to a suffixed file past maxSize', async () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { filename: 'big-%DATE%.log', maxSize: '10' });
    t.write(createLogEvent('info', 'x'.repeat(50)));
    t.write(createLogEvent('info', 'y'.repeat(50)));
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
  });

  it('exposes dirname, filename template and options', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { datePattern: 'YYYY-MM-DD' });
    assert.equal(t.dirname, dir);
    assert.equal(t.filename, 'app-%DATE%.log');
    assert.equal(t.options.datePattern, 'YYYY-MM-DD');
    t.close();
  });

  it('merges the previous file into a single daily archive on date change', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { zippedArchive: true });
    const prev = path.join(dir, 'app-2026_10_01.log');
    fs.writeFileSync(prev, 'old-content');
    t.archiveDay(prev);
    const archive = path.join(dir, 'app-2026_10_01.log.gz');
    assert.ok(!fs.existsSync(prev), 'original should be removed');
    assert.ok(fs.existsSync(archive), 'single daily archive should exist');
    assert.equal(zlib.gunzipSync(fs.readFileSync(archive)).toString(), 'old-content');
    t.close();
  });

  it('leaves the previous file alone without zippedArchive', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir);
    const prev = path.join(dir, 'app-2026_10_01.log');
    fs.writeFileSync(prev, 'old-content');
    t.archiveDay(prev);
    assert.ok(fs.existsSync(prev), 'original should be kept');
    assert.ok(!fs.existsSync(path.join(dir, 'app-2026_10_01.log.gz')));
    t.close();
  });

  it('archiveDay() survives a vanished folder', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { zippedArchive: true });
    fs.rmSync(dir, { recursive: true, force: true });
    assert.doesNotThrow(() => t.archiveDay(path.join(dir, 'app-2026_10_01.log')));
    t.close();
  });

  it('cleanupOld deletes only old log files', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { maxFiles: '7d' });
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
  });

  it('cleanupOld() survives a vanished folder', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { maxFiles: '7d' });
    fs.rmSync(dir, { recursive: true, force: true });
    assert.doesNotThrow(() => t.cleanupOld());
    t.close();
  });

  it('reopens a new file when the date changes', async () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir);
    t.write(createLogEvent('info', 'first-day'));
    t.rotateIfNeeded('2000_01_01', 10);
    assert.ok(String(t.currentFile).includes('2000_01_01'), 'stream should point at the new date file');
    t.write(createLogEvent('info', 'second-day'));
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
  });

  it('date change merges all same-date siblings into one archive', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { zippedArchive: true });
    const base = path.join(dir, 'app-2026_10_01.log');
    const s1 = path.join(dir, 'app-2026_10_01-1.log');
    const s2 = path.join(dir, 'app-2026_10_01-2.log');
    const otherDate = path.join(dir, 'app-2026_10_02.log');
    const runCounter = path.join(dir, '.app.run');
    fs.writeFileSync(base, 'base-content');
    fs.writeFileSync(s1, 'sibling-one');
    fs.writeFileSync(s2, 'sibling-two');
    fs.writeFileSync(otherDate, 'other-date');
    fs.writeFileSync(runCounter, '3');
    const now = Date.now();
    fs.utimesSync(base, new Date(now - 3000), new Date(now - 3000));
    fs.utimesSync(s1, new Date(now - 2000), new Date(now - 2000));
    fs.utimesSync(s2, new Date(now - 1000), new Date(now - 1000));
    t.archiveDay(base);
    const archive = path.join(dir, 'app-2026_10_01.log.gz');
    for (const f of [base, s1, s2]) {
      assert.ok(!fs.existsSync(f), `original should be removed: ${f}`);
    }
    assert.deepEqual(
      fs.readdirSync(dir).filter((f) => f.endsWith('.gz')),
      ['app-2026_10_01.log.gz'],
      'exactly one archive expected',
    );
    assert.equal(zlib.gunzipSync(fs.readFileSync(archive)).toString(), 'base-contentsibling-onesibling-two');
    assert.ok(fs.existsSync(otherDate), 'other-date file must be untouched');
    assert.ok(!fs.existsSync(otherDate + '.gz'), 'other-date file must not be gzipped');
    assert.equal(fs.readFileSync(runCounter, 'utf8'), '3', '.run counter must be untouched');
    assert.ok(!fs.existsSync(runCounter + '.gz'), '.run counter must never be gzipped');
    t.close();
  });

  it('date change merges siblings for runNumber-baked filename', () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { filename: 'bot-%DATE%-1.log', zippedArchive: true });
    const r1 = path.join(dir, 'bot-2026_10_01-1.log');
    const r2 = path.join(dir, 'bot-2026_10_01-2.log');
    const plain = path.join(dir, 'bot-2026_10_01.log');
    fs.writeFileSync(r1, 'run-one');
    fs.writeFileSync(r2, 'run-two');
    fs.writeFileSync(plain, 'plain-base');
    const now = Date.now();
    fs.utimesSync(r1, new Date(now - 3000), new Date(now - 3000));
    fs.utimesSync(r2, new Date(now - 2000), new Date(now - 2000));
    fs.utimesSync(plain, new Date(now - 1000), new Date(now - 1000));
    t.archiveDay(r1);
    const archive = path.join(dir, 'bot-2026_10_01.log.gz');
    for (const f of [r1, r2, plain]) {
      assert.ok(!fs.existsSync(f), `original should be removed: ${f}`);
    }
    assert.deepEqual(
      fs.readdirSync(dir).filter((f) => f.endsWith('.gz')),
      ['bot-2026_10_01.log.gz'],
      'exactly one archive expected',
    );
    assert.equal(zlib.gunzipSync(fs.readFileSync(archive)).toString(), 'run-onerun-twoplain-base');
    t.close();
  });

  it('maxSize rotation keeps split files plain until date change merges them', async () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { maxSize: '10', zippedArchive: true });
    t.open('2026_10_01');
    const oldFile = t.currentFile;
    fs.writeFileSync(oldFile, 'old-content-payload');
    t.streamSize = fs.statSync(oldFile).size;
    t.rotateIfNeeded('2026_10_01', 100);
    assert.ok(fs.existsSync(oldFile), 'rotated-out .log stays plain during the day');
    assert.ok(!fs.existsSync(oldFile + '.gz'), 'no per-file gzip anymore');
    assert.ok(String(t.currentFile).endsWith('-1.log'), `new file should be suffixed, got ${t.currentFile}`);
    t.rotateIfNeeded('2000_01_01', 1);
    const archive = path.join(dir, 'app-2026_10_01.log.gz');
    const start = Date.now();
    while (!fs.existsSync(archive) && Date.now() - start < 3000) {
      await sleep(50);
    }
    await sleep(300);
    assert.deepEqual(
      fs.readdirSync(dir).filter((f) => f.endsWith('.gz')),
      ['app-2026_10_01.log.gz'],
      'exactly one archive expected',
    );
    assert.equal(zlib.gunzipSync(fs.readFileSync(archive)).toString(), 'old-content-payload');
    assert.ok(!fs.existsSync(oldFile), 'rotated-out .log should be removed');
    assert.ok(String(t.currentFile).includes('2000_01_01'), `stream should point at the new date file, got ${t.currentFile}`);
    t.close();
  });

  it('maxSize splits merge into one archive on date change (async-open race)', async () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { filename: 'race-%DATE%.log', maxSize: '10', zippedArchive: true });
    t.write(createLogEvent('info', 'x'.repeat(50)));
    t.write(createLogEvent('info', 'y'.repeat(50)));
    await sleep(300);
    t.rotateIfNeeded('2000_01_01', 1);
    const start = Date.now();
    let gz = [];
    while (Date.now() - start < 3000) {
      gz = fs.readdirSync(dir).filter((f) => f.endsWith('.log.gz'));
      if (gz.length > 0) break;
      await sleep(50);
    }
    await sleep(300);
    t.close();
    const final = fs.readdirSync(dir).filter((f) => f.endsWith('.log.gz'));
    assert.equal(final.length, 1, `expected a single archive, got ${fs.readdirSync(dir)}`);
    assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(dir, final[0]))).toString(), 'x'.repeat(50) + '\n' + 'y'.repeat(50) + '\n');
  });

  it('date change archives the live file after stream close', async () => {
    const dir = makeTmpDir();
    const t = makeFileTransport(dir, { filename: 'live-%DATE%.log', zippedArchive: true });
    t.write(createLogEvent('info', 'day-one-content'));
    await sleep(300);
    const oldFile = t.currentFile;
    t.rotateIfNeeded('2000_01_01', 1);
    const start = Date.now();
    let gz = [];
    while (Date.now() - start < 3000) {
      gz = fs.readdirSync(dir).filter((f) => f.endsWith('.log.gz'));
      if (gz.length > 0) break;
      await sleep(50);
    }
    await sleep(300);
    assert.ok(!fs.existsSync(oldFile), 'previous live .log should be removed');
    const final = fs.readdirSync(dir).filter((f) => f.endsWith('.log.gz'));
    assert.equal(final.length, 1, `expected a single archive, got ${fs.readdirSync(dir)}`);
    assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(dir, final[0]))).toString(), 'day-one-content\n');
    assert.ok(String(t.currentFile).includes('2000_01_01'), `stream should point at the new date file, got ${t.currentFile}`);
    t.close();
  });

  it('maxSize rotation keeps originals without zippedArchive', () => {
    for (const opts of [{}, { zippedArchive: false }]) {
      const dir = makeTmpDir();
      const t = makeFileTransport(dir, { maxSize: '10', ...opts });
      t.open('2026_10_01');
      const oldFile = t.currentFile;
      fs.writeFileSync(oldFile, 'kept-payload');
      t.streamSize = fs.statSync(oldFile).size;
      t.rotateIfNeeded('2026_10_01', 100);
      assert.ok(fs.existsSync(oldFile), `original should be kept (opts ${JSON.stringify(opts)})`);
      assert.ok(!fs.existsSync(oldFile + '.gz'), `no gzip expected (opts ${JSON.stringify(opts)})`);
      t.close();
    }
  });
});
