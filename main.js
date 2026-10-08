const fs = require('fs');
const path = require('path');
const { MiniLogger, ConsoleTransport, NullTransport, colorizeLevel, resolveLevelColors } = require('./lib/mini');
const { FileTransport } = require('./lib/rotate');
const { DEFAULT_CONSOLE_FORMAT, compileTimestampFormatter } = require('./lib/time');
const { buildLine } = require('./lib/format');
const { assertLevel, sanitizeMessage } = require('./lib/sanitize');
const { normalizeFilesOptions } = require('./lib/files');

function normalizeConsoleOpts(input) {
  if (input === false) return { enabled: false };
  return input || {};
}

function buildConsoleTransport({ enabled = true, enableTimestamp = true, timestampFormat = DEFAULT_CONSOLE_FORMAT, timestampPrefix = '', timestampSuffix = '', colorize = true, colors, level } = {}) {
  if (!enabled) return new NullTransport();
  const stamp = enableTimestamp ? compileTimestampFormatter(timestampFormat) : null;
  const palette = resolveLevelColors(colors);
  const render = ({ level, message, meta }) => {
    const timestamp = stamp ? `${timestampPrefix}${stamp()}${timestampSuffix}` : '';
    const tag = colorize ? colorizeLevel(level, `[${level}]`, palette) : `[${level}]`;
    return buildLine(timestamp, level, message, meta, tag);
  };
  return new ConsoleTransport({ level, render });
}

function buildFileTransport({ folder, datePattern, filename, maxFiles, maxSize, zippedArchive, level }) {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return new FileTransport({
    folder: path.normalize(folder),
    filename,
    datePattern,
    zippedArchive,
    maxSize,
    maxFiles,
    level,
    render: ({ level, message, meta }) => buildLine(new Date().toISOString(), level, message, meta),
  });
}

function createLoggerInstance(initial = {}) {
  const globalLevel = process.env.LOG_LEVEL || initial.level || 'debug';
  assertLevel(globalLevel);

  const logger = new MiniLogger({ level: globalLevel });

  let consoleTransport = buildConsoleTransport(normalizeConsoleOpts(initial.console));
  consoleTransport.level = normalizeConsoleOpts(initial.console).level;
  logger.add(consoleTransport);

  let fileTransport = null;
  let consoleOpts = { ...normalizeConsoleOpts(initial.console) };
  let filesOpts = null;

  function applySettings(options = {}) {
    if (options.level !== undefined) {
      assertLevel(options.level);
      logger.level = options.level;
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
    if (message instanceof Error) {
      logger.log(level, sanitizeMessage(message.message), { stack: message.stack, ...meta[0] });
      return;
    }
    logger.log(level, sanitizeMessage(message), ...meta);
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
  callable.child = (meta = {}) => {
    const child = logger.child(meta);
    return {
      error: (m, ...a) => child.error(m, ...a),
      warn: (m, ...a) => child.warn(m, ...a),
      info: (m, ...a) => child.info(m, ...a),
      debug: (m, ...a) => child.debug(m, ...a),
      log: child.log.bind(child),
    };
  };
  callable.close = () => {
    if (fileTransport) { logger.remove(fileTransport); try { fileTransport.close?.(); } catch {} fileTransport = null; }
  };
  callable.createLogger = (opts = {}) => createLoggerInstance(opts);
  callable._winston = logger;

  if (initial.files) applySettings({ files: initial.files });
  if (initial.console || initial.level) applySettings({ console: initial.console, level: initial.level });

  return callable;
}

module.exports = createLoggerInstance();
module.exports.createLogger = createLoggerInstance;
