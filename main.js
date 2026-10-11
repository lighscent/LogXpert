const fs = require('fs');
const path = require('path');
const { MiniLogger, ConsoleTransport, NullTransport, colorizeLevel, resolveLevelColors } = require('./lib/mini');
const { FileTransport } = require('./lib/rotate');
const { DEFAULT_CONSOLE_FORMAT, compileTimestampFormatter } = require('./lib/time');
const { buildLine, buildJsonLine } = require('./lib/format');
const { assertLevel } = require('./lib/sanitize');
const { normalizeFilesOptions } = require('./lib/files');
const { normalizeInput } = require('./lib/event');
const { withContext } = require('./lib/context');

function normalizeConsoleOpts(input) {
  if (input === false) return { enabled: false };
  return input || {};
}

function autoRender(textRender, jsonRender) {
  return (entry) => (typeof entry.message === 'object' ? jsonRender(entry) : textRender(entry));
}

function buildConsoleTransport({ enabled = true, enableTimestamp = true, timestampFormat = DEFAULT_CONSOLE_FORMAT, timestampPrefix = '', timestampSuffix = '', colorize = true, colors, level } = {}) {
  if (!enabled) return new NullTransport();
  const stamp = enableTimestamp ? compileTimestampFormatter(timestampFormat) : null;
  const timeOf = (entry) => (entry.time instanceof Date ? entry.time : new Date());
  const jsonRender = (entry) => buildJsonLine({
    timestamp: stamp ? `${timestampPrefix}${stamp(timeOf(entry))}${timestampSuffix}` : '',
    level: entry.level,
    message: entry.message,
    meta: entry.meta,
  });
  const palette = resolveLevelColors(colors);
  const textRender = (entry) => {
    const { level, message, meta } = entry;
    const timestamp = stamp ? `${timestampPrefix}${stamp(timeOf(entry))}${timestampSuffix}` : '';
    const tag = colorize ? colorizeLevel(level, `[${level}]`, palette) : `[${level}]`;
    return buildLine(timestamp, level, message, meta, tag);
  };
  return new ConsoleTransport({ level, render: autoRender(textRender, jsonRender) });
}

function buildFileTransport({ folder, datePattern, filename, maxFiles, maxSize, zippedArchive, level }) {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const isoTime = (entry) => (entry.time instanceof Date ? entry.time : new Date()).toISOString();
  const textRender = (entry) => buildLine(isoTime(entry), entry.level, entry.message, entry.meta);
  const jsonRender = (entry) => buildJsonLine({
    timestamp: isoTime(entry),
    level: entry.level,
    message: entry.message,
    meta: entry.meta,
  });
  const render = autoRender(textRender, jsonRender);
  return new FileTransport({
    folder: path.normalize(folder),
    filename,
    datePattern,
    zippedArchive,
    maxSize,
    maxFiles,
    level,
    render,
  });
}

function createLoggerInstance(initial = {}) {
  const globalLevel = process.env.LOG_LEVEL || initial.level || 'debug';
  assertLevel(globalLevel);

  const logger = new MiniLogger({ level: globalLevel, onError: initial.onError });

  let consoleTransport = buildConsoleTransport(normalizeConsoleOpts(initial.console));
  consoleTransport.level = normalizeConsoleOpts(initial.console).level;
  logger.add(consoleTransport);

  let fileTransport = null;
  let consoleOpts = { ...normalizeConsoleOpts(initial.console) };
  let filesOpts = null;
  let sanitizeEnabled = initial.sanitize ?? true;

  function applySettings(options = {}) {
    if (options.level !== undefined) {
      assertLevel(options.level);
      logger.level = options.level;
    }
    if (options.sanitize !== undefined) {
      if (typeof options.sanitize !== 'boolean') throw new Error('log.settings sanitize must be a boolean');
      sanitizeEnabled = options.sanitize;
    }
    if (options.console !== undefined) {
      const next = normalizeConsoleOpts(options.console);
      if (next.level !== undefined && next.level !== null) assertLevel(next.level);
      consoleOpts = { ...consoleOpts, ...next };
      logger.remove(consoleTransport);
      consoleTransport = buildConsoleTransport(consoleOpts);
      consoleTransport.level = consoleOpts.level;
      logger.add(consoleTransport);
    }
    if (options.files) {
      const normalized = normalizeFilesOptions(options.files);
      if (normalized.level !== undefined && normalized.level !== null) assertLevel(normalized.level);
      filesOpts = normalized;
      if (fileTransport) logger.remove(fileTransport);
      fileTransport = buildFileTransport(normalized);
      logger.add(fileTransport);
    }
  }

  function isEnabled(level) {
    const want = logger.levels[level];
    const current = logger.levels[logger.level];
    return want !== undefined && current !== undefined && want <= current;
  }

  function write(level, message, ...meta) {
    if (typeof message === 'function') {
      if (!isEnabled(level)) return;
      message = message();
    }
    const [text, args] = normalizeInput(message, meta, { sanitize: sanitizeEnabled });
    logger.log(level, text, ...args);
  }

  function callable(message, ...meta) {
    write('info', message, ...meta);
  }

  callable.error = (m, ...a) => write('error', m, ...a);
  callable.warn = (m, ...a) => write('warn', m, ...a);
  callable.info = (m, ...a) => write('info', m, ...a);
  callable.debug = (m, ...a) => write('debug', m, ...a);
  callable.http = (m, ...a) => write('http', m, ...a);
  callable.verbose = (m, ...a) => write('verbose', m, ...a);
  callable.silly = (m, ...a) => write('silly', m, ...a);
  callable.log = (level, m, ...a) => { assertLevel(level); write(level, m, ...a); };

  callable.settings = applySettings;
  callable.setLevel = (level) => { assertLevel(level); logger.level = level; };
  callable.getLevel = () => logger.level;
  callable.child = (meta = {}) => withContext(
    (level, message, ...args) => { assertLevel(level); write(level, message, ...args); },
    meta,
    ['error', 'warn', 'info', 'debug', 'http', 'verbose', 'silly'],
  );
  callable.close = () => {
    if (fileTransport) { logger.remove(fileTransport); try { fileTransport.close?.(); } catch {} fileTransport = null; }
  };
  callable.createLogger = (opts = {}) => createLoggerInstance(opts);
  callable._winston = logger;

  if (initial.files) applySettings({ files: initial.files });
  if (initial.console || initial.level || initial.sanitize !== undefined) {
    applySettings({ console: initial.console, level: initial.level, sanitize: initial.sanitize });
  }

  return callable;
}

module.exports = createLoggerInstance();
module.exports.createLogger = createLoggerInstance;
