/** Unit tests for lib/sanitize.js (direct require, no facade). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  VALID_LEVELS, assertLevel, stripAnsi, sanitizeMessage,
  assertFilenameSafe, isSafeChar, isPadChar, sanitizeAppName,
} = require('../../lib/sanitize');

describe('sanitize', () => {
  it('assertLevel accepts the seven levels and rejects the rest', () => {
    for (const level of VALID_LEVELS) assert.doesNotThrow(() => assertLevel(level));
    assert.deepEqual(VALID_LEVELS, ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']);
    assert.throws(() => assertLevel('nope'), /Invalid log level/);
    assert.throws(() => assertLevel('INFO'), /Invalid log level/);
  });

  it('stripAnsi removes CSI color sequences', () => {
    assert.equal(stripAnsi('a\x1b[31mb\x1b[0mc'), 'abc');
    assert.equal(stripAnsi('\x9b2Kdone'), 'done');
    assert.equal(stripAnsi('plain'), 'plain');
  });

  it('stripAnsi removes OSC sequences terminated by BEL, ST or 9C', () => {
    assert.equal(stripAnsi('\x1b]0;title\x07end'), 'end');
    assert.equal(stripAnsi('\x1b]0;title\x1b\\end'), 'end');
    assert.equal(stripAnsi('\x9dosc\x9c!'), '!');
  });

  it('stripAnsi removes charset selections and lone escapes', () => {
    assert.equal(stripAnsi('\x1b(Bhi'), 'hi');
    assert.equal(stripAnsi('\x1b)0zz'), 'zz');
    assert.equal(stripAnsi('a\x1b'), 'a');
    assert.equal(stripAnsi('a\x1bxb'), 'ab');
  });

  it('sanitizeMessage passes non-strings through and strips controls', () => {
    assert.equal(sanitizeMessage(42), 42);
    assert.equal(sanitizeMessage(null), null);
    const obj = { a: 1 };
    assert.equal(sanitizeMessage(obj), obj);
    assert.equal(sanitizeMessage('a\x00\x07b'), 'ab');
    assert.equal(sanitizeMessage('a\tb\nc'), 'a\tb\nc');
  });

  it('assertFilenameSafe accepts contained names', () => {
    assert.doesNotThrow(() => assertFilenameSafe('app-%DATE%.log'));
    assert.doesNotThrow(() => assertFilenameSafe('a..b-%DATE%.log'));
  });

  it('assertFilenameSafe rejects empty and null-byte names', () => {
    assert.throws(() => assertFilenameSafe(''), /non-empty/);
    assert.throws(() => assertFilenameSafe('   '), /non-empty/);
    assert.throws(() => assertFilenameSafe(null), /non-empty/);
    assert.throws(() => assertFilenameSafe(42), /non-empty/);
    assert.throws(() => assertFilenameSafe('a\0b-%DATE%.log'), /non-empty/);
  });

  it('assertFilenameSafe rejects escapes and absolute paths', () => {
    assert.throws(() => assertFilenameSafe('../evil-%DATE%.log'), /escape/);
    assert.throws(() => assertFilenameSafe('..\\evil-%DATE%.log'), /escape/);
    assert.throws(() => assertFilenameSafe('/abs-%DATE%.log'), /escape/);
  });

  it('classifies filename characters', () => {
    assert.equal(isSafeChar('a'), true);
    assert.equal(isSafeChar('Z'), true);
    assert.equal(isSafeChar('5'), true);
    assert.equal(isSafeChar('.'), true);
    assert.equal(isSafeChar('/'), false);
    assert.equal(isSafeChar(' '), false);
    assert.equal(isPadChar('-'), true);
    assert.equal(isPadChar('_'), true);
    assert.equal(isPadChar('.'), true);
    assert.equal(isPadChar('a'), false);
  });

  it('sanitizeAppName scopes and cleans package names', () => {
    assert.equal(sanitizeAppName('@myorg/my-app!'), 'my-app');
    assert.equal(sanitizeAppName('My App!'), 'My-App');
    assert.equal(sanitizeAppName('---app---'), 'app');
    assert.equal(sanitizeAppName(''), null);
    assert.equal(sanitizeAppName('   '), null);
    assert.equal(sanitizeAppName(null), null);
    assert.equal(sanitizeAppName(42), null);
    assert.equal(sanitizeAppName('a'.repeat(300)).length, 200);
  });
});
