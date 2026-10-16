'use strict';

/**
 * Scenario: native JSON serialization.
 * The message itself is an object; adapters must produce their native
 * JSON line for it. Loggers without native JSON output report
 * unsupported (user-side JSON.stringify is a different cost and is
 * not substituted here).
 */

module.exports = {
  id: 'json',
  title: 'JSON serialization',
  description: 'Logs an object as a native JSON line (serialization cost included).',
  iterations: { quick: 10000, standard: 100000 },
  payload() {
    return { event: 'request', userId: 12345, ok: true, ms: 12.4 };
  },
  emit(handle, payload) {
    handle.info(payload);
  },
};
