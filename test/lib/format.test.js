/** Unit tests for lib/format.js (direct require, no facade). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  formatExtra, mergeMeta, renderBody, buildLine, safeStringify, buildJsonLine,
} = require('../../lib/format');

describe('format', () => {
  it('safeStringify() survives circular refs and bigints', () => {
    const a = { x: 1 };
    a.self = a;
    const obj = JSON.parse(safeStringify({ a, n: 10n }));
    assert.equal(obj.a.self, '[Circular]');
    assert.equal(obj.n, '10');
  });

  it('buildJsonLine() emits one JSON object per line', () => {
    const line = buildJsonLine({ timestamp: '2026-10-11T00:00:00.000Z', level: 'info', message: 'm', meta: [] });
    assert.deepEqual(JSON.parse(line), { timestamp: '2026-10-11T00:00:00.000Z', level: 'info', message: 'm', meta: [] });
    assert.ok(!line.includes('\n'));
    const noStamp = JSON.parse(buildJsonLine({ timestamp: '', level: 'warn', message: 'w', meta: [{ a: 1 }] }));
    assert.ok(!('timestamp' in noStamp));
  });

  it('formatExtra() keeps user fields, drops splat bookkeeping', () => {
    assert.equal(formatExtra({}), '');
    assert.equal(formatExtra({ splat: ['x'], ms: '+1ms' }), '');
    assert.equal(formatExtra({ a: 1, b: 'x' }), '{"a":1,"b":"x"}');
  });

  it('formatExtra() returns empty on unserializable meta', () => {
    const m = { a: 1 };
    m.self = m;
    assert.equal(formatExtra(mergeMeta([m])), '');
  });

  it('mergeMeta() merges objects and skips the rest', () => {
    assert.deepEqual(mergeMeta([{ a: 1 }, 'str', null, undefined, 42, { b: 2 }]), { a: 1, b: 2 });
    assert.deepEqual(mergeMeta([]), {});
  });

  it('renderBody() applies printf-style splat formatting', () => {
    assert.equal(renderBody('hello %s, you have %d messages', ['bob', 3]), 'hello bob, you have 3 messages');
    assert.equal(renderBody('n=%d', [5]), 'n=5');
    assert.equal(renderBody('100%%', [1]), '100% 1');
  });

  it('renderBody() keeps placeholders verbatim without meta', () => {
    assert.equal(renderBody('100%%', []), '100%%');
    assert.equal(renderBody('hello %s', []), 'hello %s');
  });

  it('renderBody() stringifies non-string messages and appends meta', () => {
    assert.equal(renderBody({ x: 1 }, [{ a: 1 }]), '{"x":1} {"a":1}');
    assert.equal(renderBody('msg', [{ a: 1 }]), 'msg {"a":1}');
    assert.equal(renderBody(42, []), '42');
    assert.equal(renderBody(null, []), '');
    assert.equal(renderBody(undefined, [{ a: 1 }]), '{"a":1}');
  });

  it('buildLine() assembles timestamp, tag and body', () => {
    assert.equal(buildLine('ts', 'info', 'm', []), 'ts [info]: m');
    assert.equal(buildLine('', 'info', 'm', []), '[info]: m');
    assert.equal(buildLine('ts', 'info', 'm', [], '<tag>'), 'ts <tag>: m');
    assert.equal(buildLine('', 'warn', 'w', [{ a: 1 }]), '[warn]: w {"a":1}');
  });
});
