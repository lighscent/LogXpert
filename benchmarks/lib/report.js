/**
 * Terminal reporting + regression comparison.
 *
 * - printSummary(): per-scenario table, ops/s + delta vs a baseline logger.
 * - compare(): base-vs-head verdicts per (logger, scenario, sink) with a
 *   noise band — differences inside the band are "same", never regressions.
 */
const { formatOps } = require('./stats');

function groupByScenario(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = `${e.scenario} :: ${e.sink}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return groups;
}

function printSummary(result, { baseline = 'logxpert' } = {}) {
  const groups = groupByScenario(result.entries);
  for (const [title, rows] of groups) {
    const ok = rows.filter((r) => r.status === 'ok');
    const other = rows.filter((r) => r.status !== 'ok');
    console.log(`\n== ${title} ==`);
    const base = ok.find((r) => r.logger === baseline);
    const baseOps = base ? base.opsPerSec : null;
    for (const r of ok) {
      const delta =
        baseOps && r.logger !== baseline
          ? ` (${r.opsPerSec >= baseOps ? '+' : ''}${(((r.opsPerSec - baseOps) / baseOps) * 100).toFixed(1)}%)`
          : '';
      console.log(`  ${r.logger}: ${formatOps(r.opsPerSec)}${delta}`);
    }
    for (const r of other) {
      console.log(`  ${r.logger}: ${r.status}${r.reason ? ` — ${r.reason}` : ''}`);
    }
  }
}

function verdict(deltaPct, noisePct) {
  const band = Math.abs(noisePct);
  if (Math.abs(deltaPct) <= band) return 'same';
  return deltaPct > 0 ? 'faster' : 'slower';
}

function compare(base, head, { noisePct = 5 } = {}) {
  const key = (e) => `${e.logger} :: ${e.scenario} :: ${e.sink}`;
  const baseMap = new Map(base.entries.map((e) => [key(e), e]));
  const rows = [];
  for (const h of head.entries) {
    const b = baseMap.get(key(h));
    if (!b || b.status !== 'ok' || h.status !== 'ok') {
      rows.push({
        logger: h.logger,
        scenario: h.scenario,
        sink: h.sink,
        verdict: 'n/a',
        reason: 'missing or failed on one side',
      });
      continue;
    }
    const deltaPct = ((h.opsPerSec - b.opsPerSec) / b.opsPerSec) * 100;
    rows.push({
      logger: h.logger,
      scenario: h.scenario,
      sink: h.sink,
      baseOps: b.opsPerSec,
      headOps: h.opsPerSec,
      deltaPct: Number(deltaPct.toFixed(2)),
      verdict: verdict(deltaPct, noisePct),
    });
  }
  return { noisePct, rows };
}

function printComparison(comp) {
  console.log(`\nComparison (noise band ±${comp.noisePct}%):`);
  for (const r of comp.rows) {
    if (r.verdict === 'n/a') {
      console.log(`  ${r.logger} :: ${r.scenario} :: ${r.sink}: n/a — ${r.reason}`);
    } else {
      const sign = r.deltaPct >= 0 ? '+' : '';
      console.log(`  ${r.logger} :: ${r.scenario} :: ${r.sink}: ${r.verdict} (${sign}${r.deltaPct}%)`);
    }
  }
  const slower = comp.rows.filter((r) => r.verdict === 'slower');
  if (slower.length > 0) {
    console.log(`\n${slower.length} slower-than-noise result(s) — investigate, do not treat as automatic failure.`);
  } else {
    console.log('\nNo slower-than-noise results.');
  }
}

module.exports = { printSummary, compare, printComparison, verdict };
