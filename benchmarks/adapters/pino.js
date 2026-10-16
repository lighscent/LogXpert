/**
 * Pino adapter (v10.x, verified by smoke probe — no assumed APIs).
 *
 * - Null sink: in-memory devnull writable (pino accepts any writable stream).
 * - File sink: pino.destination({ dest, sync: true }) + flush on close.
 * - Errors: pino convention is .error({ err }, msg) with stdSerializers.err.
 * - Disabled: level 'error', then .debug() is a no-op.
 */
const fs = require('node:fs');
const path = require('node:path');
const pino = require('pino');
const { createDevNull } = require('../lib/sink');

function packageVersion() {
  try {
    const dir = path.dirname(require.resolve('pino'));
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

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

const adapter = {
  id: 'pino',
  version: packageVersion(),

  supports(scenario) {
    return { ok: true, scenario };
  },

  create({ sink, filePath, scenario }) {
    const level = scenario === 'disabled' ? 'error' : 'debug';
    const opts = { level, serializers: { err: pino.stdSerializers.err } };
    let stream = null;
    let logger;

    if (sink === 'null') {
      stream = createDevNull();
      logger = pino(opts, stream);
    } else if (sink === 'stdout') {
      logger = pino(opts);
    } else if (sink === 'file') {
      stream = pino.destination({ dest: filePath, sync: true, append: false });
      logger = pino(opts, stream);
    } else {
      throw new Error(`pino adapter: unknown sink "${sink}"`);
    }

    const wrap = (target, extra) =>
      Object.assign(
        {
          info: (msg, meta) => (meta === undefined ? target.info(msg) : target.info(meta, msg)),
          error: (input) => {
            if (input instanceof Error) target.error({ err: input }, input.message);
            else target.error(input);
          },
          debug: (msg) => target.debug(msg),
          child: (bindings) => wrap(target.child(bindings), extra),
        },
        extra,
      );

    const extra = {
      async close() {
        try {
          if (typeof logger.flush === 'function') logger.flush();
          if (stream && typeof stream.flush === 'function') stream.flush();
        } finally {
          await endStream(stream);
        }
      },
    };

    if (sink === 'file') {
      extra.validate = async () => nonEmpty(filePath);
    }

    return wrap(logger, extra);
  },
};

module.exports = adapter;
