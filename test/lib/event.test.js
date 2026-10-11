/** Unit tests for lib/event.js (direct require, no facade). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createLogEvent, isLogEvent, normalizeInput } = require('../../lib/event');

describe('event', () => {
  it('creates a normalized event with level, message, meta array and time', () => {
    const before = Date.now();
    const e = createLogEvent('info', 'hello', [{ a: 1 }]);
    assert.equal(e.level, 'info');
    assert.equal(e.message, 'hello');
    assert.deepEqual(e.meta, [{ a: 1 }]);
    assert.ok(e.time instanceof Date);
    assert.ok(e.time.getTime() >= before && e.time.getTime() <= Date.now());
  });

  it('normalizes missing or single meta into an array', () => {
    assert.deepEqual(createLogEvent('info', 'm', undefined).meta, []);
    assert.deepEqual(createLogEvent('info', 'm').meta, []);
    assert.deepEqual(createLogEvent('info', 'm', { a: 1 }).meta, [{ a: 1 }]);
  });

  it('wraps non-array meta values as-is', () => {
    assert.deepEqual(createLogEvent('info', 'm', null).meta, [null]);
    assert.deepEqual(createLogEvent('info', 'm', 'x').meta, ['x']);
  });

  it('isLogEvent validates the shape', () => {
    assert.equal(isLogEvent(createLogEvent('error', 'x', [])), true);
    assert.equal(isLogEvent({ level: 'info', message: 'x', meta: [] }), false);
    assert.equal(isLogEvent({ level: 'info', message: 'x', meta: [], time: 'now' }), false);
    assert.equal(isLogEvent({ level: 'info', message: 'x', meta: [], time: null }), false);
    assert.equal(isLogEvent({ level: 'info', message: 'x', time: new Date() }), false);
    assert.equal(isLogEvent(null), false);
    assert.equal(isLogEvent('info'), false);
  });

  it('normalizeInput maps Error to message plus stack meta', () => {
    const err = new Error('boom');
    const [text, args] = normalizeInput(err, [{ requestId: 'abc' }], { sanitize: true });
    assert.equal(text, 'boom');
    assert.deepEqual(args, [{ stack: err.stack, requestId: 'abc' }]);
  });

  it('normalizeInput honors the sanitize opt-out', () => {
    const [text] = normalizeInput('\x1b[31mred\x1b[0m', [], { sanitize: false });
    assert.equal(text, '\x1b[31mred\x1b[0m');
    const err = new Error('\x1b[31mred\x1b[0m');
    const [errText] = normalizeInput(err, [], { sanitize: false });
    assert.equal(errText, '\x1b[31mred\x1b[0m');
  });

  it('normalizeInput passes plain messages and meta through', () => {
    const [text, args] = normalizeInput('hello', [{ a: 1 }], { sanitize: true });
    assert.equal(text, 'hello');
    assert.deepEqual(args, [{ a: 1 }]);
    const obj = { a: 1 };
    const [objText, objArgs] = normalizeInput(obj, [], { sanitize: true });
    assert.equal(objText, obj);
    assert.deepEqual(objArgs, []);
  });
});
