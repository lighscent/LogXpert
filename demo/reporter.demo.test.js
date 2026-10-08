const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Demo fixture for the custom reporter: NOT part of `npm test`.
// Run it with: npm run test:demo
describe('demo', () => {
  it('passes', () => {});

  it('fails', () => {
    assert.equal(1, 2);
  });

  it('skipped', { skip: true }, () => {});

  it('todo', { todo: true }, () => {});

  const ac = new AbortController();
  ac.abort();
  it('cancelled', { signal: ac.signal }, () => {});
});
