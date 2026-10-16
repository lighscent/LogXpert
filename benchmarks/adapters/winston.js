/**
 * Winston adapter (v3.x, verified by smoke probe — no assumed APIs).
 *
 * - Text format: printf rendering `level: message` (+ JSON of extra keys).
 * - JSON scenario: format.json() with errors({ stack: true }).
 * - Error scenario: format.errors({ stack: true }) so native Errors print.
 * - Null sink: Stream transport to an in-memory devnull writable.
 * - File sink: Stream transport to our own fs stream (we own drain on close).
 * - Stdout sink: native Console transport.
 */
const fs = require('node:fs');
const path = require('node:path');
const winston = require('winston');
const { createDevNull } = require('../lib/sink');

function packageVersion() {
  try {
    let dir = path.dirname(require.resolve('winston'));
    for (let i = 0; i < 5; i += 1) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (pkg.name === 'winston') return pkg.version || 'unknown';
      } catch {}
      dir = path.dirname(dir);
    }
  } catch {}
  return 'unknown';
}

function textPrintf() {
  return winston.format.printf((info) => {
    const { level, message, stack, ...rest } = info;
    if (stack) return `${level}: ${message}\n${stack}`;
    const keys = Object.keys(rest).filter((k) => k !== 'timestamp');
    if (keys.length > 0) {
      const extra = {};
      for (const k of keys) extra[k] = rest[k];
      return `${level}: ${message} ${JSON.stringify(extra)}`;
    }
    return `${level}: ${message}`;
  });
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
  id: 'winston',
  version: packageVersion(),

  supports(scenario) {
    return { ok: true, scenario };
  },

  create({ sink, filePath, scenario }) {
    const level = scenario === 'disabled' ? 'error' : 'debug';
    const withErrors = winston.format.errors({ stack: true });
    const format =
      scenario === 'json'
        ? winston.format.combine(withErrors, winston.format.json())
        : winston.format.combine(withErrors, textPrintf());

    let ownedStream = null;
    let transport;
    if (sink === 'null') {
      ownedStream = createDevNull();
      transport = new winston.transports.Stream({ stream: ownedStream });
    } else if (sink === 'stdout') {
      transport = new winston.transports.Console();
    } else if (sink === 'file') {
      ownedStream = fs.createWriteStream(filePath);
      transport = new winston.transports.Stream({ stream: ownedStream });
    } else {
      throw new Error(`winston adapter: unknown sink "${sink}"`);
    }

    const logger = winston.createLogger({ level, format, transports: [transport] });

    const wrap = (target, extra) =>
      Object.assign(
        {
          info: (msg, meta) => (meta === undefined ? target.info(msg) : target.info(msg, meta)),
          error: (input) => target.error(input),
          debug: (msg) => target.debug(msg),
          child: (bindings) => wrap(target.child(bindings), extra),
        },
        extra,
      );

    const extra = {
      async close() {
        try {
          logger.close();
        } finally {
          await endStream(ownedStream);
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
