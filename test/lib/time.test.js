/** Unit tests for lib/time.js (direct require, no facade). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_CONSOLE_FORMAT, pad2, formatDefaultTimestamp,
  splitBrackets, compileTimestampFormatter, formatCustomTimestamp,
} = require('../../lib/time');

describe('time', () => {
  const fixed = new Date(2026, 9, 11, 12, 34, 56);

  it('pads numbers and formats the default timestamp', () => {
    assert.equal(pad2(3), '03');
    assert.equal(pad2(12), '12');
    assert.equal(formatDefaultTimestamp(new Date(2026, 0, 5, 4, 7, 9)), '2026-01-05 04:07:09');
  });

  it('compileTimestampFormatter honors a given date', () => {
    assert.equal(compileTimestampFormatter('YYYY-MM-DD HH:mm:ss')(fixed), '2026-10-11 12:34:56');
  });

  it('falls back to the default formatter without a usable format', () => {
    for (const fmt of [undefined, null, '', 42]) {
      assert.match(compileTimestampFormatter(fmt)(fixed), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, String(fmt));
    }
    assert.equal(compileTimestampFormatter(DEFAULT_CONSOLE_FORMAT)(fixed), '2026-10-11 12:34:56');
  });

  it('formats custom patterns without brackets through dayjs', () => {
    assert.equal(compileTimestampFormatter('YYYY/MM/DD')(fixed), '2026/10/11');
  });

  it('formats bracketed sections and keeps the rest literal', () => {
    assert.equal(compileTimestampFormatter('[DD]/MM')(fixed), '[11]/MM');
  });

  it('falls back to dayjs on an unclosed bracket', () => {
    assert.equal(compileTimestampFormatter('[oops YYYY')(fixed), '[oop56 2026');
  });

  it('keeps empty brackets literal', () => {
    assert.equal(compileTimestampFormatter('[]')(fixed), '[]');
  });

  it('splitBrackets() isolates bracketed sections linearly', () => {
    assert.deepEqual(splitBrackets('a[b]c[d'), ['a', '[b]', 'c[d']);
    assert.deepEqual(splitBrackets('plain'), ['plain']);
    assert.deepEqual(splitBrackets(''), []);
  });

  it('formatCustomTimestamp() renders the current time', () => {
    assert.equal(formatCustomTimestamp('YYYY'), String(new Date().getFullYear()));
    assert.match(formatCustomTimestamp(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
