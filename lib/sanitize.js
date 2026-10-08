const path = require('path');

const VALID_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

function assertLevel(level) {
  if (!VALID_LEVELS.includes(level)) throw new Error(`Invalid log level "${level}". Use one of: ${VALID_LEVELS.join(', ')}`);
}

function stripAnsi(str) {
  let out = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] !== '\x1b' && str[i] !== '\x9b' && str[i] !== '\x9d') {
      out += str[i];
      i++;
      continue;
    }
    if (str[i] === '\x9d' || str[i + 1] === ']') {
      let j = i + 2;
      while (j < str.length) {
        if (str[j] === '\x07' || str[j] === '\x9c') { j++; break; }
        if (str[j] === '\x1b' && str[j + 1] === '\\') { j += 2; break; }
        j++;
      }
      i = j;
    } else if (str[i] === '\x9b' || str[i + 1] === '[') {
      let j = i + 2;
      while (j < str.length && str[j] >= ' ' && str[j] <= '?') j++;
      if (j < str.length) j++;
      i = j;
    } else if (str[i + 1] === '(' || str[i + 1] === ')') {
      i += 3;
    } else {
      i += str[i + 1] === undefined ? 1 : 2;
    }
  }
  return out;
}
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0d\x0e-\x1f\x7f]/g;

function sanitizeMessage(msg) {
  if (typeof msg !== 'string') return msg;
  return stripAnsi(msg).replace(CONTROL_RE, '');
}

function assertFilenameSafe(filename) {
  if (typeof filename !== 'string' || !filename.trim() || filename.includes('\0')) {
    throw new Error('files.filename must be a non-empty string');
  }
  if (path.isAbsolute(filename) || filename.split(/[\\/]/).includes('..')) {
    throw new Error('files.filename must not escape the log folder (.. and absolute paths are rejected)');
  }
}

function isSafeChar(c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '.' || c === '_' || c === '-';
}

function isPadChar(c) {
  return c === '-' || c === '_' || c === '.';
}

function sanitizeAppName(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const base = name.trim().slice(0, 200).split('/').pop();
  let out = '';
  for (let i = 0; i < base.length; i++) {
    out += isSafeChar(base[i]) ? base[i] : '-';
  }
  let start = 0;
  while (start < out.length && isPadChar(out[start])) start++;
  let end = out.length;
  while (end > start && isPadChar(out[end - 1])) end--;
  const safe = out.slice(start, end);
  return safe || null;
}

module.exports = {
  VALID_LEVELS,
  assertLevel,
  stripAnsi,
  CONTROL_RE,
  sanitizeMessage,
  assertFilenameSafe,
  isSafeChar,
  isPadChar,
  sanitizeAppName,
};
