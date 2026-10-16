/**
 * Bunyan adapter (v1.x, per research report).
 *
 * - JSON-only output natively; text scenario measures its JSON line (documented).
 * - Errors via serializers { err: stdSerializers.err } + .error({ err }, msg).
 * - No close/flush on Logger: writes are synchronous, we own stream drain.
 * - child() (non-simple) shares parent streams — parent close drains all.
 */
const fs = require('node:fs');
const bunyan = require('bunyan');
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

const adapter = {
  id: 'bunyan',
  version: bunyan.VERSION || 'unknown',

  supports(scenario) {
    return { ok: true, scenario };
  },

  create({ sink, filePath, scenario }) {
    const level = scenario === 'disabled' ? 'error' : 'debug';
    let ownedStream = null;
    let stream;

    if (sink === 'null') {
      ownedStream = createDevNull();
      stream = ownedStream;
    } else if (sink === 'stdout') {
      stream = process.stdout;
    } else if (sink === 'file') {
      ownedStream = fs.createWriteStream(filePath);
      stream = ownedStream;
    } else {
      throw new Error(`bunyan adapter: unknown sink "${sink}"`);
    }

    const logger = bunyan.createLogger({
      name: 'bench',
      level,
      serializers: { err: bunyan.stdSerializers.err },
      streams: [{ stream, level: 'trace' }],
    });

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
        await endStream(ownedStream);
      },
    };

    if (sink === 'file') {
      extra.validate = async () => nonEmpty(filePath);
    }

    return wrap(logger, extra);
  },
};

module.exports = adapter;
