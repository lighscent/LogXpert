const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const COLORS = {
  error: 31,
  warn: 33,
  info: 32,
  http: 35,
  verbose: 36,
  debug: 34,
  silly: 90,
};

function colorizeLevel(level, text) {
  const code = COLORS[level] ?? 0;
  return `\x1b[${code}m${text}\x1b[0m`;
}

class ConsoleTransport {
  constructor({ level, render } = {}) {
    this.level = level;
    this.render = render;
  }

  write(entry) {
    const line = this.render(entry);
    const stream = entry.level === 'error' || entry.level === 'warn' ? process.stderr : process.stdout;
    stream.write(line + '\n');
  }

  close() {}
}

class MiniLogger {
  constructor({ level = 'debug' } = {}) {
    this.level = level;
    this.levels = LEVELS;
    this.transports = [];
  }

  add(transport) {
    this.transports.push(transport);
    return this;
  }

  remove(transport) {
    const i = this.transports.indexOf(transport);
    if (i >= 0) this.transports.splice(i, 1);
    try {
      transport.close?.();
    } catch {}
    return this;
  }

  enabled(level, transportLevel) {
    const want = LEVELS[level];
    const current = LEVELS[transportLevel ?? this.level];
    return want !== undefined && current !== undefined && want <= current;
  }

  log(level, message, ...meta) {
    for (const t of [...this.transports]) {
      if (this.enabled(level, t.level)) t.write({ level, message, meta });
    }
  }

  child(meta = {}) {
    const self = this;
    const make = (level) => (message, ...args) => self.log(level, message, meta, ...args);
    return {
      error: make('error'),
      warn: make('warn'),
      info: make('info'),
      debug: make('debug'),
      log: (level, message, ...args) => self.log(level, message, meta, ...args),
    };
  }
}

module.exports = { LEVELS, ConsoleTransport, MiniLogger, colorizeLevel };
