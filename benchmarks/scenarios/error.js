'use strict';

/**
 * Scenario: simple error with stack trace.
 * One Error instance is built per rep (outside the timed loop);
 * adapters map it to their native error path (serializers, formats).
 */

module.exports = {
  id: 'error',
  title: 'Error with stack',
  description: 'Logs an Error instance, stack trace included.',
  iterations: { quick: 5000, standard: 30000 },
  payload() {
    return new Error('boom');
  },
  emit(handle, err) {
    handle.error(err);
  },
};
