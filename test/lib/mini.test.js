/** Unit tests for lib/mini.js (direct require, no facade). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  LEVELS, MiniLogger, ConsoleTransport, NullTransport, colorizeLevel, resolveLevelColors,
} = require('../../lib/mini');
const { createLogEvent, isLogEvent } = require('../../lib/event');

function captureStderr() {
  const lines = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (c) => { lines.push(String(c)); return true; };
  return { lines, restore: () => { process.stderr.write = orig; } };
}

function captureStreams() {
  const out = [];
  const err = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (c) => { out.push(String(c)); return true; };
  process.stderr.write = (c) => { err.push(String(c)); return true; };
  return { out, err, restore: () => { process.stdout.write = origOut; process.stderr.write = origErr; } };
}

describe('mini', () => {
  it('orders levels from error to silly', () => {
    const order = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
    order.forEach((level, i) => assert.equal(LEVELS[level], i));
  });

  it('defaults to debug and drops unknown levels silently', () => {
    const logger = new MiniLogger();
    assert.equal(logger.level, 'debug');
    const seen = [];
    logger.add({ write: (e) => seen.push(e) });
    assert.doesNotThrow(() => logger.log('nope', 'x'));
    assert.equal(seen.length, 0);
  });

  it('enabled() respects global and transport levels', () => {
    const logger = new MiniLogger({ level: 'warn' });
    assert.equal(logger.enabled('error'), true);
    assert.equal(logger.enabled('warn'), true);
    assert.equal(logger.enabled('info'), false);
    assert.equal(logger.enabled('info', 'debug'), true);
    assert.equal(logger.enabled('debug', 'error'), false);
    assert.equal(logger.enabled('nope'), false);
    assert.equal(logger.enabled('info', 'nope'), false);
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

  it('MiniLogger delivers LogEvents carrying creation time', () => {
    const seen = [];
    const logger = new MiniLogger({ level: 'debug' });
    logger.add({ write: (e) => seen.push(e) });
    logger.log('warn', 'hello', { a: 1 });
    assert.equal(seen.length, 1);
    assert.ok(isLogEvent(seen[0]));
    assert.equal(seen[0].level, 'warn');
    assert.deepEqual(seen[0].meta, [{ a: 1 }]);
  });

  it('resolveLevelColors merges overrides over defaults', () => {
    const map = resolveLevelColors({ info: 'blue', warn: 208, error: false });
    assert.equal(map.info, 34);
    assert.equal(map.warn, 208);
    assert.ok(!('error' in map));
    assert.equal(map.debug, 34);
    assert.throws(() => resolveLevelColors({ info: 'blurple' }), /Unknown color/);
    assert.throws(() => resolveLevelColors('red'), /must be an object/);
  });

  it('resolveLevelColors accepts aliases, case and codes, rejects the rest', () => {
    const map = resolveLevelColors({ info: 'BLUE', debug: 'Gray', silly: 'grey' });
    assert.equal(map.info, 34);
    assert.equal(map.debug, 90);
    assert.equal(map.silly, 90);
    assert.ok(!('warn' in resolveLevelColors({ warn: null })));
    assert.throws(() => resolveLevelColors({ info: 256 }), /Unknown color/);
    assert.throws(() => resolveLevelColors({ info: -1 }), /Unknown color/);
    assert.throws(() => resolveLevelColors({ info: 1.5 }), /Unknown color/);
  });

  it('colorizeLevel() leaves text plain without a code', () => {
    assert.equal(colorizeLevel('nope', '[nope]'), '[nope]');
    assert.equal(colorizeLevel('info', '[info]', {}), '[info]');
    assert.equal(colorizeLevel('error', '[error]', { error: 0 }), '[error]');
    assert.equal(colorizeLevel('info', '[info]', { info: 34 }), '\x1b[34m[info]\x1b[0m');
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

  it('a failing transport neither throws nor starves the others', () => {
    const seen = [];
    const reported = [];
    const logger = new MiniLogger({ level: 'debug', onError: (e) => reported.push(e) });
    logger.add({ write: () => { throw new Error('disk full'); } });
    logger.add({ write: (e) => seen.push(e) });
    assert.doesNotThrow(() => logger.log('info', 'hi'));
    assert.equal(seen.length, 1);
    assert.equal(seen[0].message, 'hi');
    assert.equal(reported.length, 1);
    assert.match(reported[0].message, /disk full/);
  });

  it('transport errors default to a raw stderr line', () => {
    const { lines, restore } = captureStderr();
    try {
      const logger = new MiniLogger({ level: 'debug' });
      logger.add({ write: () => { throw new Error('boom'); } });
      logger.log('info', 'x');
    } finally {
      restore();
    }
    assert.ok(lines.some((l) => l.includes('logxpert: transport error') && l.includes('boom')));
  });

  it('an onError that logs cannot loop', () => {
    const { lines, restore } = captureStderr();
    let reports = 0;
    let logger;
    try {
      logger = new MiniLogger({
        level: 'debug',
        onError: () => { reports += 1; logger.log('error', 'handler failed'); },
      });
      logger.add({ write: () => { throw new Error('always'); } });
      assert.doesNotThrow(() => logger.log('info', 'x'));
    } finally {
      restore();
    }
    assert.equal(reports, 1);
    assert.ok(lines.some((l) => l.includes('always')));
  });

  it('an onError that throws still falls back to raw stderr', () => {
    const { lines, restore } = captureStderr();
    try {
      const logger = new MiniLogger({
        level: 'debug',
        onError: () => { throw new Error('handler blew up'); },
      });
      logger.add({ write: () => { throw new Error('disk full'); } });
      assert.doesNotThrow(() => logger.log('info', 'x'));
    } finally {
      restore();
    }
    assert.ok(lines.some((l) => l.includes('logxpert: transport error') && l.includes('disk full')));
  });

  it('NullTransport silently absorbs writes', () => {
    const t = new NullTransport();
    assert.equal(t.level, 'off');
    assert.doesNotThrow(() => {
      t.write(createLogEvent('info', 'x'));
      t.close();
    });
  });

  it('console transport sends error/warn to stderr', () => {
    const { out, err, restore } = captureStreams();
    try {
      const t = new ConsoleTransport({ render: (e) => e.message });
      t.write(createLogEvent('info', 'hello'));
      t.write(createLogEvent('error', 'oops'));
      t.write(createLogEvent('warn', 'careful'));
    } finally {
      restore();
    }
    assert.deepEqual(out, ['hello\n']);
    assert.deepEqual(err, ['oops\n', 'careful\n']);
  });
});
