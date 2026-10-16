#!/usr/bin/env node
'use strict';

/**
 * Single-combo worker: runs one (adapter, scenario, sink) measurement in a
 * fresh process and writes the raw engine result as JSON to --out.
 *
 * Exit 0 when a result (even partial/error) was written; exit 2 only when
 * nothing could be written (arg errors, fatal crash before --out known).
 * Stdout-sink combos write real logs to stdout — the result travels via
 * --out file, never via stdout, so the two can never mix.
 */
const fs = require('node:fs');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

async function main() {
  const adapterId = arg('adapter');
  const scenarioId = arg('scenario');
  const sink = arg('sink', 'null');
  const iterations = Number(arg('iterations', '0'));
  const warmup = Number(arg('warmup', '0'));
  const reps = Number(arg('reps', '3'));
  const timeoutMs = Number(arg('timeout', '60000'));
  const workDir = arg('workDir', process.cwd());
  const out = arg('out');

  if (!adapterId || !scenarioId || !out) {
    console.error('child.js: --adapter, --scenario and --out are required');
    process.exit(2);
  }

  const { load } = require('../adapters');
  const { getScenario } = require('../scenarios');
  const { runMeasurement } = require('../lib/engine');

  const loaded = load(adapterId);
  if (!loaded.ok) {
    fs.writeFileSync(out, JSON.stringify({ fatal: loaded.reason }) + '\n');
    process.exit(0);
  }

  const scenario = getScenario(scenarioId);
  try {
    const result = await runMeasurement({
      adapter: loaded.adapter,
      scenario,
      sink,
      iterations,
      warmup,
      reps,
      timeoutMs,
      workDir,
    });
    fs.writeFileSync(out, JSON.stringify(result) + '\n');
    process.exit(0);
  } catch (err) {
    fs.writeFileSync(out, JSON.stringify({ fatal: (err && err.message) || String(err) }) + '\n');
    process.exit(0);
  }
}

main();
