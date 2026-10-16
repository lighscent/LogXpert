'use strict';

/**
 * Scenario: message with arguments and a structured object.
 * Adapters map (message, meta) to their native call shape
 * (e.g. pino/bunyan take the object first).
 */

module.exports = {
  id: 'structured',
  title: 'Structured arguments',
  description: 'Logs a message plus a flat metadata object.',
  iterations: { quick: 10000, standard: 100000 },
  payload() {
    return ['user login', { userId: 12345, action: 'login', ok: true }];
  },
  emit(handle, payload) {
    handle.info(payload[0], payload[1]);
  },
};
