/**
 * Context enrichment (child loggers).
 *
 * `withContext()` binds a context object to an emit function: every call
 * made through the returned child prepends the bound context to the meta
 * args, so transports see it as the first meta element. The context object
 * itself is passed through by reference, exactly as `MiniLogger.child()`
 * historically did.
 *
 * Both `MiniLogger.child()` (`lib/mini.js`) and the public `log.child()`
 * (`main.js`) delegate here — neither owns enrichment mechanics anymore.
 */

const DEFAULT_LEVELS = ['error', 'warn', 'info', 'debug'];

function withContext(emit, context = {}, levels = DEFAULT_LEVELS) {
  const child = {
    log: (level, message, ...args) => emit(level, message, context, ...args),
  };
  for (const level of levels) {
    child[level] = (message, ...args) => emit(level, message, context, ...args);
  }
  return child;
}

module.exports = { withContext, DEFAULT_LEVELS };
