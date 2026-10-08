const util = require('util');

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

function mergeMeta(meta) {
  const out = {};
  for (const m of meta) {
    if (m && typeof m === 'object') Object.assign(out, m);
  }
  return out;
}

function renderBody(message, meta) {
  if (typeof message === 'string' && meta.length && /%[sdifoO%]/.test(message)) {
    return util.format(message, ...meta);
  }
  const msg = typeof message === 'string' ? message : message == null ? '' : JSON.stringify(message);
  const extra = formatExtra(mergeMeta(meta));
  return [msg, extra].filter(Boolean).join(' ');
}

function buildLine(timestamp, level, message, meta, tag) {
  const body = renderBody(message, meta);
  const label = tag ?? `[${level}]`;
  return timestamp ? `${timestamp} ${label}: ${body}` : `${label}: ${body}`;
}

module.exports = { formatExtra, mergeMeta, renderBody, buildLine };
