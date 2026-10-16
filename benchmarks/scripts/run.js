#!/usr/bin/env node
'use strict';

/**
 * Benchmark orchestrator.
 *
 * Runs every (adapter x scenario) combo on one sink, in-process or isolated
 * (one fresh node process per combo via scripts/child.js), then writes
 * JSON + CSV results and prints a terminal summary.
 *
 * Exit code is 0 unless argument parsing fails: slower numbers are data,
 * never failures (CI must not fail PRs on perf — see benchmarks.yml).
 * Transport-closure and output validation failures surface as entry
 * statuses ('close-error', 'invalid'), not as process crashes.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { ORDER, load, sinkSupported } = require('../adapters');
const { SCENARIOS, getScenario } = require('../scenarios');
const { runMeasurement } = require('../lib/engine');
const { collectEnv, resultsDir } = require('../lib/env');
const { ensureDir } = require('../lib/sink');
const { buildResult, writeJson, writeCsv } = require('../lib/export');
const { printSummary } = require('../lib/report');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function csvList(value, fallback) {
  if (!value) return fallback;
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function runIsolated(job, outFile, killAfterMs) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        path.join(__dirname, 'child.js'),
        '--adapter', job.adapterId,
        '--scenario', job.scenarioId,
        '--sink', job.sink,
        '--iterations', String(job.iterations),
        '--warmup', String(job.warmup),
        '--reps', String(job.reps),
        '--timeout', String(job.timeoutMs),
        '--workDir', job.workDir,
        '--out', outFile,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { child.kill(); } catch {}
    }, killAfterMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (killed) {
        resolve({ fatal: `child killed after ${killAfterMs}ms (timeout)` });
        return;
      }
      if (code !== 0) {
        resolve({ fatal: `child exited with code ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(fs.readFileSync(outFile, 'utf8')));
      } catch (err) {
        resolve({ fatal: `unreadable child output: ${(err && err.message) || err}` });
      }
    });
  });
}

function toEntry(measurement, loggerVersion) {
  const agg = measurement.agg;
  return {
    logger: measurement.logger,
    loggerVersion,
    scenario: measurement.scenario,
    sink: measurement.sink,
    status: measurement.status,
    reason: measurement.status === 'ok' ? undefined : `reps: ${measurement.statuses.join(',')}`,
    opsPerSec: agg ? agg.opsPerSec.median : undefined,
    meanNsPerOp: agg ? agg.meanNsPerOpMedian : undefined,
    totalMs: agg ? agg.durationMsTotal : undefined,
    closeMs: agg ? agg.closeMsMedian : undefined,
    heapDeltaBytes: agg ? agg.heapDeltaMedian : undefined,
    repsTotal: measurement.reps,
    repsOk: measurement.statuses.filter((s) => s === 'ok' || s === 'slow').length,
    iterations: measurement.iterations,
  };
}

async function main() {
  const suite = arg('suite', 'standard');
  const adapters = csvList(arg('adapters'), ORDER);
  const scenarios = csvList(arg('scenarios'), SCENARIOS.map((s) => s.id));
  const sink = arg('sink', 'null');
  const isolate = hasFlag('isolate') || !hasFlag('no-isolate');
  const order = arg('order', 'round');
  const name = arg('name', `bench-${suite}-${sink}`);
  const iterationsOverride = Number(arg('iterations', '0'));
  const reps = Number(arg('reps', suite === 'quick' ? '2' : '5'));
  const warmupScale = Number(arg('warmup', suite === 'quick' ? '200' : '2000'));
  const timeoutMs = Number(arg('timeout', '120000'));

  for (const id of scenarios) getScenario(id);
  for (const id of adapters) {
    if (!ORDER.includes(id)) {
      console.error(`run.js: unknown adapter "${id}"`);
      process.exit(2);
    }
  }

  const outDir = resultsDir();
  ensureDir(outDir);
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-bench-'));
  const entries = [];
  const versions = {};

  const combos = [];
  if (order === 'logger') {
    for (const adapterId of adapters) for (const scenarioId of scenarios) combos.push([adapterId, scenarioId]);
  } else {
    for (const scenarioId of scenarios) for (const adapterId of adapters) combos.push([adapterId, scenarioId]);
  }

  let comboIndex = 0;
  for (const [adapterId, scenarioId] of combos) {
    comboIndex += 1;
    const scenario = getScenario(scenarioId);
    const iterations = iterationsOverride > 0 ? iterationsOverride : scenario.iterations[suite] || scenario.iterations.standard;
    const tag = `[${comboIndex}/${combos.length}] ${adapterId} :: ${scenarioId} :: ${sink} x${iterations}`;

    const loaded = load(adapterId);
    if (!loaded.ok) {
      console.log(`${tag} -> skipped (${loaded.reason})`);
      entries.push({ logger: adapterId, scenario: scenarioId, sink, status: 'skipped', reason: loaded.reason });
      continue;
    }
    versions[adapterId] = loaded.adapter.version || 'unknown';
    if (!sinkSupported(adapterId, sink)) {
      const reason = `${adapterId} has no ${sink}-sink support`;
      console.log(`${tag} -> skipped (${reason})`);
      entries.push({ logger: adapterId, loggerVersion: versions[adapterId], scenario: scenarioId, sink, status: 'skipped', reason });
      continue;
    }
    const gate = loaded.adapter.supports(scenarioId);
    if (!gate.ok) {
      console.log(`${tag} -> skipped (${gate.reason})`);
      entries.push({ logger: adapterId, loggerVersion: versions[adapterId], scenario: scenarioId, sink, status: 'skipped', reason: gate.reason });
      continue;
    }

    const workDir = path.join(workRoot, `${adapterId}-${scenarioId}`);
    ensureDir(workDir);
    const job = { adapterId, scenarioId, sink, iterations, warmup: warmupScale, reps, timeoutMs, workDir };

    let measurement;
    if (isolate) {
      const outFile = path.join(workDir, 'result.json');
      const killAfterMs = reps * (timeoutMs * 2 + 30000) + 60000;
      measurement = await runIsolated(job, outFile, killAfterMs);
      if (measurement && measurement.fatal) {
        console.log(`${tag} -> error (${measurement.fatal})`);
        entries.push({ logger: adapterId, loggerVersion: versions[adapterId], scenario: scenarioId, sink, status: 'error', reason: measurement.fatal });
        continue;
      }
    } else {
      measurement = await runMeasurement({ adapter: loaded.adapter, scenario, sink, iterations, warmup: warmupScale, reps, timeoutMs, workDir });
    }

    const entry = toEntry(measurement, versions[adapterId]);
    console.log(`${tag} -> ${entry.status}${entry.opsPerSec ? ` ${Math.round(entry.opsPerSec).toLocaleString('en-US')} ops/s` : ''}`);
    entries.push(entry);
  }

  const result = buildResult({
    name,
    params: { suite, sink, isolate, order, reps, warmup: warmupScale, timeoutMs, iterationsOverride },
    env: collectEnv(versions),
    entries,
  });

  const jsonFile = writeJson(outDir, name, result);
  const csvFile = writeCsv(outDir, name, result);
  printSummary(result);
  console.log(`\nWrote ${jsonFile}\nWrote ${csvFile}`);

  try {
    fs.rmSync(workRoot, { recursive: true, force: true });
  } catch {}
}

main().catch((err) => {
  console.error(`run.js fatal: ${(err && err.message) || err}`);
  process.exit(2);
});
