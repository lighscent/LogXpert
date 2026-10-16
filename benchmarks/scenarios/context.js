'use strict';

/**
 * Scenario: logger with bound context / metadata.
 * The child is created once in setup (outside the timed loop);
 * only the per-call cost of pre-bound metadata is measured.
 * Loggers without a native child/context API report unsupported.
 */

module.exports = {
  id: 'context',
  title: 'Bound context',
  description: 'Logs through a child logger with pre-bound metadata.',
  iterations: { quick: 10000, standard: 100000 },
  payload() {
    return { bindings: { service: 'api', env: 'bench' }, message: 'request completed' };
  },
  setup(handle, payload) {
    return handle.child(payload.bindings);
  },
  emit(child, payload) {
    child.info(payload.message);
  },
};
