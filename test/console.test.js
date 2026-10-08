const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { log, testLogger, cleanupTmp, captureOutput } = require('./helpers');

after(cleanupTmp);

describe('console output', () => {
  beforeEach(() => log.setLevel('debug'));
  afterEach(() => log.close());

  it('colors only the level tag, not timestamp or message', () => {
    const inst = log.createLogger();
    let out = '';
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => { out += String(chunk); return true; };
    try {
      inst.info('plain-message');
    } finally {
      process.stdout.write = orig;
    }
    inst.close();
    const tagSeq = '\x1b[32m[info]\x1b[0m';
    assert.ok(out.includes(tagSeq), 'level tag should be green');
    const idx = out.indexOf(tagSeq);
    assert.ok(!out.slice(0, idx).includes('\x1b'), 'timestamp must not be colored');
    const afterReset = out.slice(idx + tagSeq.length);
    assert.ok(afterReset.includes('plain-message'));
    assert.ok(!afterReset.includes('\x1b'), 'message must not be colored');
  });

  it('applies custom level colors and rejects unknown ones', () => {
    const inst = log.createLogger({ console: { colors: { info: 'blue', error: false } } });
    const out = captureOutput(() => {
      inst.info('custom-blue');
      inst.error('plain-error');
    });
    inst.close();
    assert.ok(out.includes('\x1b[34m[info]\x1b[0m'), 'info tag should be blue');
    assert.ok(out.includes('[error]: plain-error'));
    assert.ok(!out.includes('[31m[error]'), 'error tag must not be red');
    assert.throws(() => log.createLogger({ console: { colors: { info: 'blurple' } } }), /Unknown color/);
    assert.throws(() => log.createLogger({ console: { colors: ['red'] } }), /must be an object/);
  });

  it('applies a distinct color per level', () => {
    const inst = log.createLogger({
      level: 'silly',
      console: { colors: { error: 'magenta', warn: 'cyan', info: 'blue', debug: 'gray', silly: 208 } },
    });
    const out = captureOutput(() => {
      inst.error('e');
      inst.warn('w');
      inst.info('i');
      inst.debug('d');
      inst.silly('s');
    });
    inst.close();
    assert.ok(out.includes('\x1b[35m[error]\x1b[0m'));
    assert.ok(out.includes('\x1b[36m[warn]\x1b[0m'));
    assert.ok(out.includes('\x1b[34m[info]\x1b[0m'));
    assert.ok(out.includes('\x1b[90m[debug]\x1b[0m'));
    assert.ok(out.includes('\x1b[208m[silly]\x1b[0m'));
  });

  it('filters messages below the global level', () => {
    const inst = log.createLogger({ level: 'error' });
    const out = captureOutput(() => {
      inst.debug('hidden-debug');
      inst.info('hidden-info');
      inst.error('shown-error');
    });
    inst.close();
    assert.ok(!out.includes('hidden-debug'));
    assert.ok(!out.includes('hidden-info'));
    assert.ok(out.includes('shown-error'));
  });

  it('per-transport level overrides the global level', () => {
    const inst = log.createLogger({ level: 'debug', console: { level: 'error' } });
    const out = captureOutput(() => {
      inst.info('hidden-info');
      inst.error('shown-error');
    });
    inst.close();
    assert.ok(!out.includes('hidden-info'));
    assert.ok(out.includes('shown-error'));
  });

  it('supports printf-style splat formatting', () => {
    const inst = log.createLogger();
    const out = captureOutput(() => {
      inst.info('hello %s, you have %d messages', 'bob', 3);
    });
    inst.close();
    assert.ok(out.includes('hello bob, you have 3 messages'));
  });

  it('console renders without timestamp and color when disabled', () => {
    const inst = log.createLogger({ console: { enableTimestamp: false, colorize: false } });
    const out = captureOutput(() => {
      inst.info('bare-message');
    });
    inst.close();
    assert.ok(out.includes('[info]: bare-message'));
    assert.ok(!out.includes('\x1b'), 'no ANSI codes expected');
  });

  it('console can be disabled entirely', () => {
    const silent = log.createLogger({ console: false });
    assert.equal(silent._winston.transports[0].constructor.name, 'NullTransport');
    const out = captureOutput(() => {
      silent.info('nothing visible');
    });
    silent.close();
    assert.equal(out, '');
    const off = log.createLogger({ console: { enabled: false } });
    const out2 = captureOutput(() => {
      off.info('nothing visible either');
    });
    off.close();
    assert.equal(out2, '');
  });

  it('console can be re-enabled after being disabled', () => {
    const inst = testLogger();
    inst.settings({ console: { enabled: true } });
    const out = captureOutput(() => {
      inst.info('back-again');
    });
    inst.close();
    assert.ok(out.includes('back-again'));
  });

  it('sanitize can be disabled to pass messages through untouched', () => {
    const raw = '\x1b[31mred\x1b[0m\r\nkeep-me';
    const strict = log.createLogger({ console: { colorize: false } });
    const outStrict = captureOutput(() => {
      strict.info(raw);
    });
    strict.close();
    assert.ok(!outStrict.includes('\x1b'), 'no escape bytes when sanitizing');
    assert.ok(!outStrict.includes('\r'), 'no carriage returns when sanitizing');
    assert.ok(outStrict.includes('red') && outStrict.includes('keep-me'));
    const loose = log.createLogger({ sanitize: false, console: { colorize: false } });
    const outLoose = captureOutput(() => {
      loose.info(raw);
    });
    assert.ok(outLoose.includes(raw));
    loose.close();
    assert.ok(outLoose.includes(raw));
    loose.settings({ sanitize: true });
    const outBack = captureOutput(() => {
      loose.info(raw);
    });
    assert.ok(!outBack.includes('\x1b['));
    assert.throws(() => loose.settings({ sanitize: 'yes' }), /must be a boolean/);
  });

  it('evaluates function messages lazily only when level enabled', () => {
    const inst = testLogger({ level: 'error' });
    let called = 0;
    inst.debug(() => { called++; return 'expensive'; });
    assert.equal(called, 0);
    inst.setLevel('debug');
    inst.debug(() => { called++; return 'expensive'; });
    assert.equal(called, 1);
    inst.close();
  });

  it('child logger shares level and logs with meta', () => {
    const inst = testLogger();
    const c = inst.child({ service: 'api' });
    c.info('child-msg');
    inst.close();
  });

  it('child context appears in output', () => {
    const inst = log.createLogger();
    const out = captureOutput(() => {
      inst.child({ service: 'payments' }).info('charge');
    });
    inst.close();
    assert.ok(out.includes('charge'));
    assert.ok(out.includes('payments'));
  });

  it('error with extra meta keeps stack and fields', () => {
    const inst = log.createLogger();
    const out = captureOutput(() => {
      inst.error(new Error('boom-meta'), { requestId: 'abc' });
    });
    inst.close();
    assert.ok(out.includes('boom-meta'));
    assert.ok(out.includes('requestId'));
  });
});
