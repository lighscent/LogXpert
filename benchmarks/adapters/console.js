/**
 * Native console adapter (baseline).
 *
 * Honest floor reference, not a competitor: global console for the stdout
 * sink, node:console Console instances bound to devnull / file streams
 * otherwise. No levels, no child, no JSON, no close.
 */
const fs = require('node:fs');
const { Console } = require('node:console');
const { createDevNull } = require('../lib/sink');

function endStream(stream) {
  if (!stream || typeof stream.end !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    try {
      stream.end(() => resolve());
    } catch {
      resolve();
    }
  });
}

function nonEmpty(file) {
  try {
    return fs.statSync(file).size > 0 ? true : `empty file: ${file}`;
  } catch (err) {
    return `missing file: ${file} (${(err && err.message) || err})`;
  }
}

const UNSUPPORTED = {
  disabled: 'console has no levels (nothing to disable)',
  json: 'console has no JSON serialization (would be user-side JSON.stringify)',
  context: 'console has no child loggers',
};

const adapter = {
  id: 'console',
  version: process.version,

  supports(scenario) {
    if (UNSUPPORTED[scenario]) return { ok: false, reason: UNSUPPORTED[scenario] };
    return { ok: true, scenario };
  },

  create({ sink, filePath }) {
    let owned = null;
    let output;

    if (sink === 'null') {
      owned = createDevNull();
      output = new Console(owned, owned);
    } else if (sink === 'stdout') {
      output = console;
    } else if (sink === 'file') {
      owned = fs.createWriteStream(filePath);
      output = new Console(owned, owned);
    } else {
      throw new Error(`console adapter: unknown sink "${sink}"`);
    }

    const handle = {
      info: (msg, meta) => (meta === undefined ? output.log(msg) : output.log(msg, meta)),
      error: (input) => output.error(input),
      debug: (msg) => output.log(msg),
      async close() {
        await endStream(owned);
      },
    };

    if (sink === 'file') {
      handle.validate = async () => nonEmpty(filePath);
    }

    return handle;
  },
};

module.exports = adapter;
