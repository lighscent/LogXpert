'use strict';

/**
 * Scenario: simple text message.
 * Every logger supports this; output format stays each logger's default.
 */

module.exports = {
  id: 'text',
  title: 'Simple text message',
  description: 'Logs a short static string. Baseline cost of a log call.',
  iterations: { quick: 10000, standard: 100000 },
  payload() {
    return 'Hello, benchmark';
  },
  emit(handle, message) {
    handle.info(message);
  },
};
