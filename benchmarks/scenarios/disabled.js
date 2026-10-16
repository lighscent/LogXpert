'use strict';

/**
 * Scenario: disabled log level.
 * The adapter configures a restrictive level (errors only) and the
 * hot loop calls a level below it. Measures the level-gate fast path.
 * Loggers without level filtering report unsupported.
 */

module.exports = {
  id: 'disabled',
  title: 'Disabled level',
  description: 'Calls a filtered-out level; measures the level-gate cost.',
  iterations: { quick: 20000, standard: 200000 },
  payload() {
    return 'this line is filtered out';
  },
  emit(handle, message) {
    handle.debug(message);
  },
};
