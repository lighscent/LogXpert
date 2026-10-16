'use strict';

/**
 * Scenario: nested objects (~2KB payload).
 * Built once per rep; measures deep serialization cost.
 */

function buildNested() {
  const item = (i) => ({
    id: i,
    name: `item-${i}`,
    tags: ['alpha', 'beta', 'gamma'],
    attrs: { width: 10 + i, height: 20 + i, nested: { a: 1, b: [true, false, null] } },
  });
  const items = [];
  for (let i = 0; i < 12; i += 1) items.push(item(i));
  return {
    requestId: 'req-9f3a',
    user: { id: 7, name: 'ada', roles: ['admin', 'ops'] },
    items,
    flags: { cached: false, retried: 2 },
  };
}

module.exports = {
  id: 'nested',
  title: 'Nested object payload',
  description: 'Logs a ~2KB nested object with a message.',
  iterations: { quick: 5000, standard: 30000 },
  payload() {
    return ['nested payload', buildNested()];
  },
  emit(handle, payload) {
    handle.info(payload[0], payload[1]);
  },
};
