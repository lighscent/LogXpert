#!/usr/bin/env node
'use strict';

/**
 * Per-result report generator.
 *
 * For every benchmark result directory (benchmarks/results/<stamp>/)
 * containing a `<name>.json` file, writes:
 *   - chart.svg : ops/s bars, one section per scenario (bars are scaled
 *     to the scenario max — do NOT compare bar lengths across scenarios)
 *   - REPORT.md : env/params metadata, per-scenario tables, skipped entries
 *     with reasons, and the chart embedded via a relative link.
 *
 * Usage:
 *   node benchmarks/scripts/report.js [--dir <stamp>] [--all] [--loggers pino,winston]
 * No args = most recent result directory. --all = regenerate every result.
 * The SVG chart only keeps --loggers (default: logxpert,pino,winston,bunyan,console);
 * REPORT.md tables always list every entry.
 * Native Node.js only, no dependencies.
 */

const fs = require('node:fs');
const path = require('node:path');

const RESULTS_ROOT = path.join(__dirname, '..', 'results');

const LOGGER_COLORS = {
  logxpert: '#4e9af1',
  pino: '#ffb020',
  winston: '#9e7bea',
  bunyan: '#3fb950',
  console: '#d2a8ff',
};
const FALLBACK_COLORS = ['#4e9af1', '#ffb020', '#9e7bea', '#3fb950', '#f778ba', '#79c0ff'];

function colorFor(logger, index) {
  return LOGGER_COLORS[logger] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function escXml(s) {
  return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
}

function escMd(s) {
  return String(s).split('|').join('\\|');
}

function fmtOps(v) {
  if (v === undefined || v === null) return 'n/a';
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(Math.round(v));
}

function fmtNs(v) {
  if (v === undefined || v === null) return 'n/a';
  return v >= 100 ? `${Math.round(v)}` : `${v.toFixed(1)}`;
}

function fmtBytes(v) {
  if (v === undefined || v === null) return 'n/a';
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1048576) return `${sign}${(a / 1048576).toFixed(2)} MB`;
  if (a >= 1024) return `${sign}${(a / 1024).toFixed(1)} KB`;
  return `${v} B`;
}

function trunc(s, n) {
  const t = String(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function fmtDate(iso) {  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function findResultJson(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return null;
  files.sort();
  return path.join(dir, files[0]);
}

function groupByScenario(entries) {
  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.scenario)) groups.set(e.scenario, []);
    groups.get(e.scenario).push(e);
  }
  return [...groups.entries()];
}

function score(e) {
  return e.status === 'ok' && typeof e.opsPerSec === 'number' ? e.opsPerSec : Number.NEGATIVE_INFINITY;
}

function buildSvg(result, keep) {
  const W = 880;
  const PAD = 16;
  const LABEL_W = 170;
  const BAR_MAX = W - PAD * 2 - LABEL_W - 190;
  const ROW_H = 24;
  const SECTION_HEAD = 40;
  const SECTION_GAP = 36;

  const groups = groupByScenario(result.entries)
    .map(([scenario, list]) => [scenario, list.filter((e) => keep.has(e.logger))])
    .filter(([, list]) => list.length > 0);
  if (groups.length === 0) return null;
  const parts = [];
  let y = PAD + 40;
  const seen = new Map();
  const colorIdx = (logger) => {
    if (!seen.has(logger)) seen.set(logger, seen.size);
    return colorFor(logger, seen.get(logger));
  };

  let first = true;
  for (const [scenario, list] of groups) {
    if (!first) {
      parts.push(`<line x1="${PAD}" y1="${y - 8}" x2="${W - PAD}" y2="${y - 8}" stroke="#21262d" stroke-width="1"/>`);
    }
    first = false;
    const ok = list.filter((e) => e.status === 'ok' && typeof e.opsPerSec === 'number');
    const max = ok.length ? Math.max(...ok.map((e) => e.opsPerSec)) : 1;
    const rankOf = new Map([...ok].sort((a, b) => b.opsPerSec - a.opsPerSec).map((e, i) => [e.logger, i + 1]));
    parts.push(`<text x="${PAD}" y="${y}" font-size="13" font-weight="bold" fill="#9aa4b2">${escXml(scenario)} <tspan font-weight="normal" font-size="11">(bar = share of scenario best)</tspan></text>`);
    y += 8;
    for (const frac of [0.25, 0.5, 0.75]) {
      const gx = PAD + LABEL_W + Math.round(frac * BAR_MAX);
      parts.push(`<line x1="${gx}" y1="${y}" x2="${gx}" y2="${y + list.length * ROW_H + 4}" stroke="#161b22" stroke-width="1"/>`);
    }
    const rows = [...list].sort((a, b) => score(b) - score(a));
    for (const e of rows) {
      y += ROW_H;
      const rank = rankOf.get(e.logger);
      const label = `${rank ? `#${rank} ` : ''}${e.loggerVersion ? `${e.logger} ${e.loggerVersion}` : e.logger}`;
      const isRef = e.logger === 'logxpert';
      parts.push(`<text x="${PAD}" y="${y - 7}" font-size="12" fill="${isRef ? '#ffd700' : '#e6edf3'}"${isRef ? ' font-weight="bold"' : ''}>${escXml(label)}${isRef ? ' ★ ' : ''}</text>`);
      if (e.status === 'ok' && typeof e.opsPerSec === 'number') {
        const w = Math.max(2, Math.round((e.opsPerSec / max) * BAR_MAX));
        parts.push(`<rect x="${PAD + LABEL_W}" y="${y - 20}" width="${w}" height="15" rx="3" fill="${colorIdx(e.logger)}"/>`);
        parts.push(`<text x="${PAD + LABEL_W + w + 8}" y="${y - 7}" font-size="12" fill="#9aa4b2">${escXml(fmtOps(e.opsPerSec))} ops/s · ${escXml(fmtNs(e.meanNsPerOp))} ns/op</text>`);
      } else {
        parts.push(`<text x="${PAD + LABEL_W}" y="${y - 7}" font-size="12" fill="#6e7681">${escXml(e.status)}${e.reason ? ` — ${escXml(trunc(e.reason, 55))}` : ''}</text>`);
      }
    }
    y += SECTION_GAP;
  }
  const H = y + 26;
  const head = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="ui-monospace,monospace">`,
    `<rect width="${W}" height="${H}" rx="8" fill="#0d1117"/>`,
    `<text x="${PAD}" y="${PAD + 4}" font-size="15" font-weight="bold" fill="#e6edf3">${escXml(result.name)} — ops/s (higher is better)</text>`,
    `<text x="${PAD}" y="${PAD + 22}" font-size="11" fill="#6e7681">chart filtered to: ${escXml([...keep].join(', '))}</text>`,
    ...parts,
    `<text x="${PAD}" y="${H - 12}" font-size="11" fill="#6e7681">null/file/stdout sinks and scenarios are not comparable with each other — compare loggers within one scenario.</text>`,
    '</svg>',
  ];
  return head.join('\n');
}

function globalRanking(entries) {
  const byLogger = new Map();
  const byScenarioBest = new Map();
  for (const e of entries) {
    if (e.status !== 'ok' || typeof e.opsPerSec !== 'number') continue;
    const best = byScenarioBest.get(e.scenario) || 0;
    if (e.opsPerSec > best) byScenarioBest.set(e.scenario, e.opsPerSec);
  }
  for (const e of entries) {
    if (e.status !== 'ok' || typeof e.opsPerSec !== 'number') continue;
    const best = byScenarioBest.get(e.scenario) || 1;
    if (!byLogger.has(e.logger)) byLogger.set(e.logger, { version: e.loggerVersion, scores: [] });
    byLogger.get(e.logger).scores.push(e.opsPerSec / best);
  }
  return [...byLogger.entries()]
    .map(([logger, v], i) => ({
      logger,
      version: v.version,
      n: v.scores.length,
      score: v.scores.reduce((a, b) => a + b, 0) / v.scores.length,
      color: colorFor(logger, i),
    }))
    .sort((a, b) => b.score - a.score);
}

function buildRankingSvg(result, ranking) {
  const W = 880;
  const PAD = 16;
  const LABEL_W = 220;
  const BAR_MAX = W - PAD * 2 - LABEL_W - 165;
  const ROW_H = 28;
  const parts = [];
  let y = PAD + 44;
  ranking.forEach((r, i) => {
    y += ROW_H;
    const w = Math.max(2, Math.round(r.score * BAR_MAX));
    const label = `#${i + 1} ${r.logger}${r.version ? ` ${r.version}` : ''}${r.logger === 'logxpert' ? ' ★' : ''}`;
    parts.push(`<text x="${PAD}" y="${y - 8}" font-size="12" fill="${r.logger === 'logxpert' ? '#ffd700' : '#e6edf3'}"${r.logger === 'logxpert' ? ' font-weight="bold"' : ''}>${escXml(label)}</text>`);
    parts.push(`<rect x="${PAD + LABEL_W}" y="${y - 22}" width="${w}" height="16" rx="3" fill="${r.color}"/>`);
    parts.push(`<text x="${PAD + LABEL_W + w + 8}" y="${y - 8}" font-size="12" fill="#9aa4b2">${(r.score * 100).toFixed(1)} % · ${r.n} scénario${r.n > 1 ? 's' : ''}</text>`);
  });
  const H = y + 26;
  const head = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="ui-monospace,monospace">`,
    `<rect width="${W}" height="${H}" rx="8" fill="#0d1117"/>`,
    `<text x="${PAD}" y="${PAD + 4}" font-size="15" font-weight="bold" fill="#e6edf3">${escXml(result.name)} — classement global (score moyen)</text>`,
    `<text x="${PAD}" y="${PAD + 22}" font-size="11" fill="#6e7681">score = moyenne, sur chaque scénario, de ops/s ÷ meilleur du scénario (runs ok uniquement)</text>`,
    ...parts,
    `<text x="${PAD}" y="${H - 12}" font-size="11" fill="#6e7681">Chaque scénario pèse autant ; les runs skipped/error sont exclus. Ne pas comparer entre sinks.</text>`,
    '</svg>',
  ];
  return head.join('\n');
}

function scenarioTable(list) {
  const lines = [];
  const ref = list.find((e) => e.logger === 'logxpert' && e.status === 'ok' && typeof e.opsPerSec === 'number');
  const refOps = ref ? ref.opsPerSec : null;
  lines.push('| logger | version | status | ops/s | vs logxpert | mean ns/op | iterations | heap Δ |');
  lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const e of [...list].sort((a, b) => (b.opsPerSec || 0) - (a.opsPerSec || 0))) {
    let delta = 'n/a';
    if (e.logger === 'logxpert') {
      delta = 'référence';
    } else if (refOps && e.status === 'ok' && typeof e.opsPerSec === 'number') {
      const pct = ((e.opsPerSec - refOps) / refOps) * 100;
      delta = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %`;
    }
    lines.push(`| ${escMd(e.logger)} | ${escMd(e.loggerVersion || 'n/a')} | ${escMd(e.status)} | ${fmtOps(e.opsPerSec)} | ${delta} | ${fmtNs(e.meanNsPerOp)} | ${e.iterations !== undefined ? e.iterations : 'n/a'} | ${fmtBytes(e.heapDeltaBytes)} |`);
  }
  return lines.join('\n');
}

function buildMarkdown(result) {
  const env = result.env || {};
  const params = result.params || {};
  const lines = [];
  lines.push(`# Benchmark report — ${result.name}`);
  lines.push('');
  lines.push(`Run: ${fmtDate(result.date || env.date)} · commit \`${env.gitCommit || 'n/a'}\``);
  lines.push('');
  lines.push('## Environment');
  lines.push('');
  lines.push(`| key | value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| node | ${escMd(env.node || 'n/a')} |`);
  lines.push(`| platform/arch | ${escMd(env.platform || 'n/a')} / ${escMd(env.arch || 'n/a')} |`);
  lines.push(`| CPU | ${escMd(env.cpuModel || 'n/a')} x${env.cpuCount !== undefined ? env.cpuCount : 'n/a'} |`);
  lines.push(`| suite | ${escMd(params.suite || 'n/a')} (reps ${params.reps !== undefined ? params.reps : 'n/a'}, warmup ${params.warmup !== undefined ? params.warmup : 'n/a'}) |`);
  lines.push(`| sink | ${escMd(params.sink || 'n/a')} · isolate ${params.isolate ? 'yes' : 'no'} · order ${escMd(params.order || 'n/a')} |`);
  const versions = env.versions || {};
  lines.push(`| versions | ${escMd(Object.keys(versions).sort().map((k) => `${k}@${versions[k]}`).join(', ') || 'n/a')} |`);
  lines.push('');
  lines.push('## Classement global');
  lines.push('');
  lines.push('![global ranking](ranking.svg)');
  lines.push('');
  const ranking = globalRanking(result.entries);
  lines.push('| rang | logger | version | score moyen | scénarios |');
  lines.push('| ---: | --- | --- | ---: | ---: |');
  ranking.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${escMd(r.logger)}${r.logger === 'logxpert' ? ' ★' : ''} | ${escMd(r.version || 'n/a')} | ${(r.score * 100).toFixed(1)} % | ${r.n} |`);
  });
  lines.push('');
  lines.push('_Méthode : pour chaque scénario, score = ops/s ÷ meilleur du scénario (runs `ok` uniquement), puis moyenne à poids égal. Les `skipped`/`error` sont exclus._');
  lines.push('');
  lines.push('## Results');
  lines.push('');
  lines.push('![ops/s chart](chart.svg)');
  lines.push('');
  for (const [scenario, list] of groupByScenario(result.entries)) {
    lines.push(`### ${scenario}`);
    lines.push('');
    lines.push(scenarioTable(list));
    lines.push('');
  }
  const notOk = result.entries.filter((e) => e.status !== 'ok');
  if (notOk.length > 0) {
    lines.push('## Skips');
    lines.push('');
    for (const e of notOk) {
      lines.push(`- ${escMd(e.logger)} :: ${escMd(e.scenario)} :: ${escMd(e.sink)} — ${escMd(e.status)}${e.reason ? `: ${e.reason}` : ''}`);
    }
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  lines.push('- Bars are scaled to the best logger **within each scenario**; bar lengths are not comparable across scenarios.');
  lines.push('- Scenario tables show the status only; skip/error reasons are listed under Skips above.');
  lines.push('- Numbers are medians over reps; see the sibling `.json` file for per-rep detail.');
  lines.push('');
  return lines.join('\n');
}

function renderDir(dir, keep) {
  const jsonFile = findResultJson(dir);
  if (!jsonFile) {
    console.log(`skip ${dir}: no result JSON`);
    return false;
  }
  const result = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const svg = buildSvg(result, keep);
  if (!svg) {
    console.log(`skip ${dir}: no entries match filter (${[...keep].join(', ')})`);
    return false;
  }
  fs.writeFileSync(path.join(dir, 'chart.svg'), svg);
  fs.writeFileSync(path.join(dir, 'ranking.svg'), buildRankingSvg(result, globalRanking(result.entries)));
  fs.writeFileSync(path.join(dir, 'REPORT.md'), buildMarkdown(result));
  console.log(`wrote ${path.join(dir, 'chart.svg')}`);
  console.log(`wrote ${path.join(dir, 'REPORT.md')}`);
  return true;
}

function latestDir() {
  const dirs = fs.readdirSync(RESULTS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.length ? path.join(RESULTS_ROOT, dirs[dirs.length - 1]) : null;
}

function main() {
  const argv = process.argv.slice(2);
  const dirFlag = argv.indexOf('--dir');
  const all = argv.includes('--all');
  const loggersFlag = argv.indexOf('--loggers');
  const keep = new Set(
    (loggersFlag >= 0 && argv[loggersFlag + 1]
      ? argv[loggersFlag + 1]
      : 'logxpert,pino,winston,bunyan,console'
    ).split(',').map((s) => s.trim()).filter(Boolean)
  );
  if (all) {
    let n = 0;
    for (const d of fs.readdirSync(RESULTS_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
      if (renderDir(path.join(RESULTS_ROOT, d), keep)) n += 1;
    }
    console.log(`${n} report(s) written`);
    return;
  }
  const dir = dirFlag >= 0 && argv[dirFlag + 1] ? path.resolve(argv[dirFlag + 1]) : latestDir();
  if (!dir) {
    console.error('report.js: no result directory found');
    process.exit(2);
  }
  if (!renderDir(dir, keep)) process.exit(2);
}

main();
