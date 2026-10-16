'use strict';

/**
 * Scenario: sustained mixed workload.
 * Cycles through a prebuilt set of (method, args) steps covering
 * info/warn/error with text and small-object payloads.
 * Only uses methods every supported logger provides.
 */

const STEPS = [
  ['info', ['request started']],
  ['info', ['user login', { userId: 42 }]],
  ['error', ['request failed']],
  ['info', ['cache hit', { key: 'abc', ms: 1 }]],
];

module.exports = {
  id: 'volume',
  title: 'Mixed high volume',
  description: 'Sustained mixed info/error workload with small payloads.',
  iterations: { quick: 10000, standard: 100000 },
  payload() {
    return STEPS;
  },
  emit(handle, steps, i) {
    const step = steps[i & (steps.length - 1)];
    handle[step[0]](...step[1]);
  },
};
