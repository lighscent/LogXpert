'use strict';

/**
 * Small statistics helpers for benchmark aggregation.
 * Pure functions, no dependencies.
 */

function sortedCopy(values) {
  return [...values].sort((a, b) => a - b);
}

function percentileSorted(sorted, p) {
  if (sorted.length === 0) return NaN;
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

function percentile(values, p) {
  return percentileSorted(sortedCopy(values), p);
}

function mean(values) {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function median(values) {
  return percentile(values, 50);
}

function stdev(values, avg = mean(values)) {
  if (values.length < 2) return 0;
  let acc = 0;
  for (const v of values) acc += (v - avg) * (v - avg);
  return Math.sqrt(acc / (values.length - 1));
}

/** Relative standard deviation in percent. NaN-safe. */
function rsd(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  if (!Number.isFinite(avg) || avg === 0) return NaN;
  return (stdev(values, avg) / Math.abs(avg)) * 100;
}

function summarize(values) {
  const sorted = sortedCopy(values);
  const avg = mean(values);
  return {
    n: values.length,
    min: sorted.length ? sorted[0] : NaN,
    max: sorted.length ? sorted[sorted.length - 1] : NaN,
    mean: avg,
    median: percentileSorted(sorted, 50),
    p50: percentileSorted(sorted, 50),
    p95: percentileSorted(sorted, 95),
    p99: percentileSorted(sorted, 99),
    stdev: stdev(values, avg),
    rsd: rsd(values),
  };
}

function formatOps(ops) {
  if (!Number.isFinite(ops)) return 'n/a';
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M`;
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}k`;
  return ops.toFixed(0);
}

function formatNs(ns) {
  if (!Number.isFinite(ns)) return 'n/a';
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(2)} us`;
  return `${ns.toFixed(1)} ns`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  const sign = bytes < 0 ? '-' : '';
  const abs = Math.abs(bytes);
  if (abs >= 1024 ** 3) return `${sign}${(abs / 1024 ** 3).toFixed(2)} GiB`;
  if (abs >= 1024 ** 2) return `${sign}${(abs / 1024 ** 2).toFixed(2)} MiB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)} KiB`;
  return `${sign}${abs.toFixed(0)} B`;
}

module.exports = {
  sortedCopy,
  percentile,
  percentileSorted,
  mean,
  median,
  stdev,
  rsd,
  summarize,
  formatOps,
  formatNs,
  formatBytes,
};
