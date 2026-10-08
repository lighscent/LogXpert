const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

const VALID_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
const DEFAULT_CONSOLE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

function formatCustomTimestamp(fmt) {
  if (typeof fmt !== 'string' || !fmt) return dayjs().format(DEFAULT_CONSOLE_FORMAT);
  if (fmt.includes('[') && fmt.includes(']')) {
    return fmt.split(/(\[[^\]]*\])/).map((part) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        const inner = part.slice(1, -1);
        return '[' + (inner ? dayjs().format(inner) : '') + ']';
      }
      return part;
    }).join('');
  }
  return dayjs().format(fmt);
}

function formatExtra(meta) {
  const keys = Object.keys(meta).filter((k) => k !== 'splat' && k !== 'ms');
  if (!keys.length) return '';
  try {
    const picked = {};
    for (const k of keys) picked[k] = meta[k];
    return JSON.stringify(picked);
  } catch {
    return '';
  }
}

const prettyFormat = format.printf(({ timestamp, level, message, ...meta }) => {
  const msg = typeof message === 'string' ? message : message == null ? '' : JSON.stringify(message);
  const extra = formatExtra(meta);
  const body = [msg, extra].filter(Boolean).join(' ');
  return timestamp ? `${timestamp} [${level}]: ${body}` : `[${level}]: ${body}`;
});

function assertLevel(level) {
  if (!VALID_LEVELS.includes(level)) throw new Error(`Invalid log level "${level}". Use one of: ${VALID_LEVELS.join(', ')}`);
}

function sanitizeAppName(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const base = name.trim().split('/').pop();
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-_.]+|[-_.]+$/g, '');
  return safe || null;
}

let cachedAppName = null;
function getDefaultAppName() {
  if (cachedAppName) return cachedAppName;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    cachedAppName = sanitizeAppName(JSON.parse(raw)?.name) ?? 'application';
  } catch {
    cachedAppName = 'application';
  }
  return cachedAppName;
}

function resolveRunNumber(folder, prefix, opt) {
  let enabled = false;
  let separator = '-';
  let padding = 0;
  let startAt = 1;
  if (opt === true) {
    enabled = true;
  } else if (opt && typeof opt === 'object') {
    enabled = opt.enabled ?? true;
    if (opt.separator !== undefined) {
      if (typeof opt.separator !== 'string' || !opt.separator) throw new Error('files.runNumber.separator must be a non-empty string');
      separator = opt.separator;
    }
    if (opt.padding !== undefined) {
      if (!Number.isInteger(opt.padding) || opt.padding < 0) throw new Error('files.runNumber.padding must be a non-negative integer');
      padding = opt.padding;
    }
    if (opt.startAt !== undefined) {
      if (!Number.isInteger(opt.startAt) || opt.startAt < 0) throw new Error('files.runNumber.startAt must be a non-negative integer');
      startAt = opt.startAt;
    }
  } else if (opt !== undefined && opt !== false) {
    throw new Error('files.runNumber must be a boolean or an object');
  }
  if (!enabled) return null;
  const counterFile = path.join(folder, `.${prefix}.run`);
  let next = startAt;
  try {
    const raw = fs.readFileSync(counterFile, 'utf8').trim();
    const prev = parseInt(raw, 10);
    next = Number.isInteger(prev) ? prev + 1 : startAt;
  } catch {}
  try {
    fs.writeFileSync(counterFile, String(next), 'utf8');
  } catch {}
  return separator + String(next).padStart(padding, '0');
}

function normalizeFilesOptions(files = {}) {
  const rawFolder = files.folder ?? 'logs';
  if (typeof rawFolder !== 'string' || !rawFolder.trim() || rawFolder.includes('\0')) {
    throw new Error('files.folder must be a non-empty string');
  }
  const folder = path.normalize(rawFolder);
  const datePattern = files.filesName ?? files.datePattern ?? 'YYYY_MM_DD';
  if (typeof datePattern !== 'string' || !datePattern.trim()) {
    throw new Error('files.filesName/datePattern must be a non-empty string');
  }
  let filename = files.filename ?? `${sanitizeAppName(files.appName) ?? getDefaultAppName()}-%DATE%.log`;
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('files.filename must be a non-empty string');
  }
  if (!filename.includes('%DATE%')) {
    const ext = path.extname(filename) || '.log';
    const base = path.basename(filename, ext);
    filename = `${base}-%DATE%${ext}`;
  }
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const prefix = path.basename(filename).split('%DATE%')[0].replace(/[-_.]+$/, '') || 'application';
  const runSuffix = resolveRunNumber(folder, sanitizeAppName(prefix) ?? 'application', files.runNumber ?? false);
  if (runSuffix) {
    const ext = path.extname(filename) || '.log';
    const base = filename.slice(0, -ext.length);
    filename = `${base}${runSuffix}${ext}`;
  }
  return {
    folder,
    datePattern,
    filename,
    maxFiles: files.maxFile ?? files.maxFiles ?? '14d',
    maxSize: files.maxSize ?? '20m',
    zippedArchive: files.zippedArchive ?? false,
    level: files.level,
  };
}

function buildConsoleTransport({ enableTimestamp = true, timestampFormat = DEFAULT_CONSOLE_FORMAT, timestampPrefix = '', timestampSuffix = '', colorize = true, level } = {}) {
  const parts = [];
  if (colorize) parts.push(format.colorize());
  if (enableTimestamp) {
    parts.push(format.timestamp({ format: () => `${timestampPrefix}${formatCustomTimestamp(timestampFormat)}${timestampSuffix}` }));
  } else {
    parts.push(format((info) => { delete info.timestamp; return info; })());
  }
  parts.push(format.errors({ stack: true }), format.splat(), prettyFormat);
  return new transports.Console({ format: format.combine(...parts), level });
}

function buildFileTransport({ folder, datePattern, filename, maxFiles, maxSize, zippedArchive, level }) {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return new transports.DailyRotateFile({
    filename: path.join(folder, filename),
    datePattern,
    zippedArchive,
    maxSize,
    maxFiles,
    level,
    format: format.combine(format.errors({ stack: true }), format.splat(), format.timestamp(), prettyFormat),
  });
}

function createLoggerInstance(initial = {}) {
  const globalLevel = process.env.LOG_LEVEL || initial.level || 'debug';
  assertLevel(globalLevel);

  const logger = createLogger({
    level: globalLevel,
    format: format.combine(format.errors({ stack: true }), format.splat()),
  });

  let consoleTransport = buildConsoleTransport(initial.console);
  consoleTransport.level = initial.console?.level;
  logger.add(consoleTransport);

  let fileTransport = null;
  let consoleOpts = { ...(initial.console || {}) };
  let filesOpts = null;

  function applySettings(options = {}) {
    if (options.level !== undefined) {
      assertLevel(options.level);
      logger.level = options.level;
    }
    if (options.console) {
      if (options.console.level !== undefined && options.console.level !== null) assertLevel(options.console.level);
      consoleOpts = { ...consoleOpts, ...options.console };
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

  function write(level, message, ...meta) {
    if (message instanceof Error) {
      logger.log(level, message.message, { stack: message.stack, ...meta[0] });
      return;
    }
    logger.log(level, message, ...meta);
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
