const dayjs = require('dayjs');

const DEFAULT_CONSOLE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDefaultTimestamp(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function splitBrackets(fmt) {
  const parts = [];
  let current = '';
  let i = 0;
  while (i < fmt.length) {
    if (fmt[i] === '[') {
      const close = fmt.indexOf(']', i + 1);
      if (close === -1) {
        current += fmt.slice(i);
        break;
      }
      if (current) {
        parts.push(current);
        current = '';
      }
      parts.push(fmt.slice(i, close + 1));
      i = close + 1;
    } else {
      current += fmt[i];
      i++;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function compileTimestampFormatter(fmt) {
  if (typeof fmt !== 'string' || !fmt) return formatDefaultTimestamp;
  if (fmt === DEFAULT_CONSOLE_FORMAT) return formatDefaultTimestamp;
  if (!fmt.includes('[') || !fmt.includes(']')) return () => dayjs().format(fmt);
  const parts = splitBrackets(fmt).map((part) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1);
      return inner ? () => '[' + dayjs().format(inner) + ']' : () => '[]';
    }
    return () => part;
  });
  return () => parts.map((f) => f()).join('');
}

function formatCustomTimestamp(fmt) {
  return compileTimestampFormatter(fmt)();
}

module.exports = {
  DEFAULT_CONSOLE_FORMAT,
  pad2,
  formatDefaultTimestamp,
  splitBrackets,
  compileTimestampFormatter,
  formatCustomTimestamp,
};
