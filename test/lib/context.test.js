/** Unit tests for lib/context.js (direct require, no facade). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { withContext, DEFAULT_LEVELS } = require('../../lib/context');

describe('context', () => {
  it('exposes the default level list', () => {
    assert.deepEqual(DEFAULT_LEVELS, ['error', 'warn', 'info', 'debug']);
  });

  it('withContext() builds a child over any emit function', () => {
    const calls = [];
    const child = withContext((level, m, ...a) => calls.push([level, m, ...a]), { req: 1 }, ['info', 'http']);
    child.info('a', { x: 1 });
    child.http('b');
    child.log('info', 'c');
    assert.deepEqual(calls, [
      ['info', 'a', { req: 1 }, { x: 1 }],
      ['http', 'b', { req: 1 }],
      ['info', 'c', { req: 1 }],
    ]);
  });

  it('withContext() defaults to the core levels and an empty context', () => {
    const calls = [];
    const child = withContext((level, m, ...a) => calls.push([level, m, ...a]));
    child.info('a');
    child.log('debug', 'b');
    assert.equal(typeof child.http, 'undefined');
    assert.deepEqual(calls, [['info', 'a', {}], ['debug', 'b', {}]]);
  });
});
