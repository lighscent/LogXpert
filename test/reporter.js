const COLORS = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function colorsEnabled() {
  if ('NO_COLOR' in process.env) return false;
  const forced = process.env.FORCE_COLOR;
  if (forced !== undefined && forced !== '' && forced !== '0') return true;
  try {
    if (process.stdout.hasColors()) return true;
  } catch {}
  return !!process.stdout.isTTY;
}

function paint(enabled) {
  if (!enabled) {
    const plain = (s) => s;
    return { green: plain, red: plain, dim: plain };
  }
  return COLORS;
}

module.exports = async function* reporter(source) {
  const useColor = colorsEnabled();
  const c = paint(useColor);
  const counts = { pass: 0, fail: 0, skip: 0, cancelled: 0, suites: 0 };
  const failures = [];
  const pendingSuites = new Map();
  const started = Date.now();

  for await (const event of source) {
    const { type, data } = event;
    if (!data || typeof data.nesting !== 'number') continue;
    const kind = data.details?.type;
    const key = `${data.file ?? ''}#${data.testId ?? ''}`;

    if (type === 'test:start' && data.nesting === 0 && !String(data.name).endsWith('.js')) {
      pendingSuites.set(key, String(data.name));
      continue;
    }
    if (type === 'test:start' && data.nesting > 0) {
      const parentKey = `${data.file ?? ''}#${data.parentId ?? ''}`;
      if (pendingSuites.has(parentKey)) {
        counts.suites++;
        yield `\n${c.dim(`▶ ${pendingSuites.get(parentKey)}`)}\n`;
        pendingSuites.delete(parentKey);
      }
      continue;
    }
    if (kind !== 'test') continue;
    {
      const ms = typeof data.details?.duration_ms === 'number' ? ` (${data.details.duration_ms.toFixed(1)}ms)` : '';
      const skipped = data.skip || data.todo || data.details?.skip || data.details?.todo;
      if (type === 'test:pass' && skipped) {
        counts.skip++;
        yield `  ${c.dim(`○ ${data.name} (skipped)`)}\n`;
      } else if (type === 'test:pass') {
        counts.pass++;
        yield `  ${c.green(`✔ ${data.name}`)}${c.dim(ms)}\n`;
      } else if (type === 'test:fail') {
        const err = data.details?.error;
        if (err != null && typeof err === 'object' && Object.keys(err).length === 0) {
          counts.cancelled++;
          yield `  ${c.dim(`! ${data.name} (cancelled)`)}\n`;
        } else {
          counts.fail++;
          failures.push(data);
          yield `  ${c.red(`✖ ${data.name}`)}${c.dim(ms)}\n`;
        }
      }
    }
  }

  for (const data of failures) {
    const err = data.details?.error;
    const message = err?.message ?? err?.failureType ?? 'unknown error';
    const where = data.file ? `  ${c.dim(`${data.file}:${data.line ?? 0}`)}` : '';
    yield `\n${c.red(`✖ ${data.name}`)}\n  ${String(message).split('\n')[0]}${where ? `\n${where}` : ''}\n`;
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const parts = [`${c.green(`✔ ${counts.pass} passed`)}`];
  if (counts.fail > 0) parts.push(`${c.red(`✖ ${counts.fail} failed`)}`);
  if (counts.skip > 0) parts.push(`${c.dim(`○ ${counts.skip} skipped`)}`);
  if (counts.cancelled > 0) parts.push(`${c.dim(`! ${counts.cancelled} cancelled`)}`);
  parts.push(c.dim(`${counts.suites} suites · ${secs}s`));
  const line = parts.join(c.dim(' · '));
  const rule = c.dim('─'.repeat(48));
  yield `\n${rule}\n  ${line}\n${rule}\n`;
};
