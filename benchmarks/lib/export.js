/**
 * Result export: JSON (full fidelity) + CSV (flat, spreadsheet-friendly).
 *
 * Every export carries the same metadata block: what was run, on what
 * machine, with which versions, when — so a file alone stays interpretable.
 *
 * Entry shape (assembled by scripts/run.js from engine measurements):
 *   { logger, loggerVersion, scenario, sink, status, reason?,
 *     opsPerSec, meanNsPerOp, totalMs, closeMs, heapDeltaBytes,
 *     repsTotal, repsOk, iterations }
 */
const fs = require('node:fs');
const path = require('node:path');

function buildResult({ name, params, env, entries }) {
  return {
    name,
    date: new Date().toISOString(),
    params,
    env,
    entries,
  };
}

function writeJson(resultsDir, name, result) {
  const file = path.join(resultsDir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  return file;
}

const CSV_COLUMNS = [
  'logger',
  'loggerVersion',
  'scenario',
  'sink',
  'status',
  'iterations',
  'repsTotal',
  'repsOk',
  'opsPerSec',
  'meanNsPerOp',
  'totalMs',
  'closeMs',
  'heapDeltaBytes',
  'reason',
];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(result) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const e of result.entries) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(e[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

function writeCsv(resultsDir, name, result) {
  const file = path.join(resultsDir, `${name}.csv`);
  fs.writeFileSync(file, toCsv(result));
  return file;
}

module.exports = { buildResult, writeJson, writeCsv, toCsv, CSV_COLUMNS };
