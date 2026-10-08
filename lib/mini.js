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

const NAMED_COLORS = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  grey: 90,
};

function resolveColorCode(value, level) {
  if (value === undefined || value === null || value === false) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255) return value;
  if (typeof value === 'string' && NAMED_COLORS[value.toLowerCase()] !== undefined) return NAMED_COLORS[value.toLowerCase()];
  throw new Error(`Unknown color "${value}" for level "${level}". Use one of: ${Object.keys(NAMED_COLORS).join(', ')}, an ANSI code 0-255, or false to disable`);
}

function resolveLevelColors(custom = {}) {
  if (custom === null || typeof custom !== 'object' || Array.isArray(custom)) {
    throw new Error('console.colors must be an object mapping level names to colors');
  }
  const map = {};
  for (const level of Object.keys(COLORS)) {
    if (custom[level] !== undefined) {
      const code = resolveColorCode(custom[level], level);
      if (code !== null) map[level] = code;
    } else {
      map[level] = COLORS[level];
    }
  }
  return map;
}

function colorizeLevel(level, text, colors = COLORS) {
  const code = colors[level] ?? 0;
  if (!code) return text;
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

module.exports = { LEVELS, ConsoleTransport, MiniLogger, colorizeLevel, resolveLevelColors, NAMED_COLORS };
