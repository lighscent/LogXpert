const fs = require('fs');
const path = require('path');
const { sanitizeAppName, isPadChar, assertFilenameSafe } = require('./sanitize');

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
  const datePattern = files.datePattern ?? files.dateFormat ?? files.filesName ?? 'YYYY_MM_DD';
  if (typeof datePattern !== 'string' || !datePattern.trim()) {
    throw new Error('files.datePattern must be a non-empty string');
  }
  const explicitPattern = files.filePattern ?? files.pattern ?? files.filename;
  const explicitPrefix = files.prefix ?? files.appName;
  if (explicitPattern !== undefined && explicitPrefix !== undefined) {
    throw new Error('Do not combine "prefix" with "filePattern", pick one: prefix builds "<prefix>-%DATE%.log" for you, filePattern takes full control');
  }
  let filename = explicitPattern ?? `${sanitizeAppName(explicitPrefix) ?? getDefaultAppName()}-%DATE%.log`;
  filename = filename.split('%datePattern%').join('%DATE%');
  assertFilenameSafe(filename);
  if (!filename.includes('%DATE%')) {
    const ext = path.extname(filename) || '.log';
    const base = path.basename(filename, ext);
    filename = `${base}-%DATE%${ext}`;
  }
  assertFilenameSafe(filename);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const rawPrefix = path.basename(filename).split('%DATE%')[0];
  let prefixEnd = rawPrefix.length;
  while (prefixEnd > 0 && isPadChar(rawPrefix[prefixEnd - 1])) prefixEnd--;
  const prefix = rawPrefix.slice(0, prefixEnd) || 'application';
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

module.exports = { getDefaultAppName, resolveRunNumber, normalizeFilesOptions };
