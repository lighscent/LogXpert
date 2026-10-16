/**
 * Adapter registry: pino, winston, bunyan, console + logxpert itself.
 *
 * Sink support lives here (not in adapters): file sink means "writes go to
 * a real file". The runner skips unsupported sink/logger pairs with a
 * documented reason instead.
 */
const SINKS = {
  logxpert: ['null', 'file', 'stdout'],
  pino: ['null', 'file', 'stdout'],
  winston: ['null', 'file', 'stdout'],
  bunyan: ['null', 'file', 'stdout'],
  console: ['null', 'file', 'stdout'],
};

const ORDER = ['logxpert', 'pino', 'winston', 'bunyan', 'console'];

function load(name) {
  if (!ORDER.includes(name)) return { ok: false, reason: `unknown adapter "${name}"` };
  let adapter;
  try {
    adapter = require(`./${name}`);
  } catch (err) {
    return { ok: false, reason: `require failed: ${(err && err.message) || err}` };
  }
  if (typeof adapter.available === 'function') {
    const gate = adapter.available();
    if (!gate.ok) return { ok: false, reason: gate.reason };
  }
  return { ok: true, adapter, sinks: SINKS[name] };
}

function sinkSupported(name, sink) {
  return (SINKS[name] || []).includes(sink);
}

module.exports = { ORDER, SINKS, load, sinkSupported };
