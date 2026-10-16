/**
 * LogXpert adapter (the library under test).
 *
 * - Null sink: std-stub (ConsoleTransport writes process.stdout/stderr
 *   directly, no injection point).
 * - File sink: real file transport. LogXpert builds "<prefix>-%DATE%.log"
 *   itself, so the folder/prefix derive from filePath and validation sums
 *   every matching .log in the folder.
 * - Disabled: level 'error', then .debug() is a no-op.
 * - Errors: native mapping (message + stack meta). Objects auto-render JSON.
 */
const fs = require('node:fs');
const path = require('node:path');
const main = require('../../main');
const { installStdStub } = require('../lib/sink');

const adapter = {
  id: 'logxpert',
  version: require('../../package.json').version,

  supports(scenario) {
    return { ok: true, scenario };
  },

  create({ sink, filePath, scenario }) {
    const level = scenario === 'disabled' ? 'error' : 'debug';
    let stub = null;
    let folder = null;
    let prefix = null;
    let inst;

    if (sink === 'null') {
      stub = installStdStub();
      inst = main.createLogger({ level });
    } else if (sink === 'stdout') {
      inst = main.createLogger({ level });
    } else if (sink === 'file') {
      folder = path.dirname(filePath);
      prefix = path.basename(filePath, path.extname(filePath));
      inst = main.createLogger({ level, console: false, files: { folder, prefix } });
    } else {
      throw new Error(`logxpert adapter: unknown sink "${sink}"`);
    }

    const handle = {
      info: (msg, meta) => (meta === undefined ? inst.info(msg) : inst.info(msg, meta)),
      error: (input) => inst.error(input),
      debug: (msg) => inst.debug(msg),
      child: (bindings) => {
        const c = inst.child(bindings);
        return {
          info: (msg, meta) => (meta === undefined ? c.info(msg) : c.info(msg, meta)),
          error: (input) => c.error(input),
          debug: (msg) => c.debug(msg),
        };
      },
      async close() {
        // FileTransport.close() ends the stream without waiting for the
        // flush, so drain every owned stream here before reporting.
        // (access path documented for tests: instance._winston.transports)
        try {
          const transports = (inst._winston && inst._winston.transports) || [];
          const pending = [];
          for (const t of transports) {
            let s = null;
            try {
              s = typeof t.closeStream === 'function' ? t.closeStream() : null;
            } catch {}
            if (s && typeof s.once === 'function') {
              pending.push(
                new Promise((resolve) => {
                  if (s.destroyed === true || s.closed === true) resolve();
                  else {
                    s.once('close', resolve);
                    s.once('error', resolve);
                  }
                }),
              );
            }
          }
          await Promise.all(pending);
        } finally {
          try {
            inst.close();
          } finally {
            if (stub) stub.restore();
          }
        }
      },
    };

    if (sink === 'null' && scenario !== 'disabled') {
      handle.validate = async () =>
        stub.calls.out + stub.calls.err > 0 ? true : 'no stubbed stdout/stderr writes';
    }

    if (sink === 'file') {
      handle.validate = async () => {
        let names;
        try {
          names = fs.readdirSync(folder);
        } catch {
          return `missing folder: ${folder}`;
        }
        let total = 0;
        for (const n of names) {
          if (n.startsWith(prefix) && n.endsWith('.log')) {
            try {
              total += fs.statSync(path.join(folder, n)).size;
            } catch {}
          }
        }
        return total > 0 ? true : `empty file output in ${folder} (prefix ${prefix})`;
      };
    }

    return handle;
  },
};

module.exports = adapter;
