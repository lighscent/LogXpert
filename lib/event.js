/**
 * Normalized internal log event model.
 *
 * Every log call produces exactly one LogEvent via `createLogEvent()`.
 * All transports receive the same object shape, whether entries come from
 * `MiniLogger.log()` or are crafted manually (tests, custom transports).
 *
 * Shape:
 *   {
 *     level: string,  // level name as passed ('info', 'error', ...)
 *     message: any,   // payload as passed (string, object, ...), post-sanitize
 *     meta: Array,    // trailing args, always an array (splat-compatible)
 *     time: Date,     // captured once at creation — single source of truth
 *   }
 *
 * Notes:
 * - `meta` stays an array on purpose: `renderBody()` applies `util.format()`
 *   positionally when `message` holds `%` placeholders; merging early would
 *   break splat semantics. Use `mergeMeta(meta)` from `lib/format.js` to get
 *   the merged object.
 * - Transports should derive their timestamps from `entry.time` instead of
 *   sampling their own clock, so every output agrees on one timestamp.
 */

function createLogEvent(level, message, meta) {
  return {
    level,
    message,
    meta: Array.isArray(meta) ? meta : meta === undefined ? [] : [meta],
    time: new Date(),
  };
}

function isLogEvent(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.level === 'string' &&
    'message' in value &&
    Array.isArray(value.meta) &&
    value.time instanceof Date
  );
}

module.exports = { createLogEvent, isLogEvent };
