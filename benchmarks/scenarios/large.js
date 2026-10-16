'use strict';

/**
 * Scenario: large string message (~4KB).
 */

module.exports = {
  id: 'large',
  title: 'Large message',
  description: 'Logs a ~4KB string message.',
  iterations: { quick: 5000, standard: 30000 },
  payload() {
    return `payload:${'x'.repeat(4096)}`;
  },
  emit(handle, message) {
    handle.info(message);
  },
};
