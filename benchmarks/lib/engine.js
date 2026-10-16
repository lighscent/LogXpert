'use strict';

/**
 * Measurement engine.
 *
 * Runs one (adapter, scenario, sink) job: N reps of
 * create -> setup -> warmup -> timed loop -> close, with per-rep
 * validation. The timed loop only covers the emit calls; creation,
 * warmup and close (drain) are measured separately and reported.
 *
 * In-process timeouts are soft by nature (a synchronous loop cannot be
 * pre-empted): async phases (create/close) are hard-bounded via
 * withTimeout(), while a timed loop that exceeds `timeoutMs` is still
 * recorded but flagged `slow`. Subprocess runs (scripts/child.js) get a
 * hard kill from the parent instead.
 */

const { performance } = require('node:perf_hooks');
const { summarize } = require('./stats');
const { uniqueFile } = require('./sink');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return Promise.resolve(promise);
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([Promise.resolve(promise), guard]).finally(() => clearTimeout(timer));
}

function memSnapshot() {
  const m = process.memoryUsage();
  return { heapUsed: m.heapUsed, rss: m.rss, external: m.external };
}

function validateRep({ iterations, durationMs, opsPerSec }) {
  if (!Number.isFinite(opsPerSec) || opsPerSec <= 0) return 'invalid: non-positive throughput';
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 'invalid: non-positive duration';
  if (!Number.isInteger(iterations) || iterations <= 0) return 'invalid: bad iteration count';
  return null;
}

async function runRep({ adapter, scenario, sink, iterations, warmup, timeoutMs, workDir, rep }) {
  const memBefore = memSnapshot();
  const filePath = sink === 'file' ? uniqueFile(workDir, `${adapter.id}-${scenario.id}`, '.log') : null;

  let handle;
  const tCreate0 = performance.now();
  try {
    handle = await withTimeout(
      adapter.create({ sink, filePath, scenario: scenario.id, workDir, rep }),
      timeoutMs,
      `${adapter.id}/${scenario.id} create`
    );
  } catch (err) {
    return { rep, status: 'error', error: `create failed: ${(err && err.message) || err}` };
  }
  const createMs = performance.now() - tCreate0;

  let emitting = handle;
  try {
    const payload = scenario.payload(rep);
    if (typeof scenario.setup === 'function') {
      emitting = await scenario.setup(handle, payload, rep);
    }
    const emit = scenario.emit;
    for (let w = 0; w < warmup; w += 1) emit(emitting, payload, w);

    const t0 = performance.now();
    for (let i = 0; i < iterations; i += 1) emit(emitting, payload, i);
    const t1 = performance.now();

    const durationMs = t1 - t0;
    const opsPerSec = iterations / (durationMs / 1000);
    const invalid = validateRep({ iterations, durationMs, opsPerSec });

    const tClose0 = performance.now();
    let closeError = null;
    try {
      await withTimeout(handle.close(), timeoutMs, `${adapter.id}/${scenario.id} close`);
    } catch (err) {
      closeError = (err && err.message) || String(err);
    }
    const closeMs = performance.now() - tClose0;
    const memAfter = memSnapshot();

    let validationError = null;
    if (typeof handle.validate === 'function') {
      try {
        const verdict = await handle.validate();
        if (verdict !== true) validationError = typeof verdict === 'string' ? verdict : 'adapter validation failed';
      } catch (err) {
        validationError = (err && err.message) || String(err);
      }
    }

    if (invalid) {
      return { rep, status: 'invalid', error: invalid, durationMs, opsPerSec, createMs, closeMs };
    }
    let status = 'ok';
    if (durationMs > timeoutMs) status = 'slow';
    if (closeError) status = status === 'ok' ? 'close-error' : status;
    if (validationError) status = 'invalid';
    return {
      rep,
      status,
      iterations,
      warmup,
      durationMs,
      opsPerSec,
      meanNsPerOp: 1e9 / opsPerSec,
      createMs,
      closeMs,
      closeError,
      validationError,
      heapDeltaBytes: memAfter.heapUsed - memBefore.heapUsed,
      rssDeltaBytes: memAfter.rss - memBefore.rss,
    };
  } catch (err) {
    try {
      await withTimeout(handle.close(), Math.min(timeoutMs, 5000), `${adapter.id}/${scenario.id} cleanup-close`);
    } catch {}
    return { rep, status: 'error', error: (err && err.message) || String(err) };
  }
}

async function runMeasurement(job) {
  const { adapter, scenario, sink, iterations, warmup, reps, timeoutMs, workDir } = job;
  const repResults = [];
  for (let rep = 0; rep < reps; rep += 1) {
    // eslint-disable-next-line no-await-in-loop
    repResults.push(await runRep({ adapter, scenario, sink, iterations, warmup, timeoutMs, workDir, rep }));
    if (rep < reps - 1) await sleep(25);
  }
  const okReps = repResults.filter((r) => r.status === 'ok' || r.status === 'slow');
  const ops = okReps.map((r) => r.opsPerSec);
  const agg = ops.length
    ? {
        opsPerSec: summarize(ops),
        meanNsPerOpMedian: 1e9 / summarize(ops).median,
        closeMsMedian: summarize(okReps.map((r) => r.closeMs)).median,
        heapDeltaMedian: summarize(okReps.map((r) => r.heapDeltaBytes)).median,
        durationMsTotal: okReps.reduce((a, r) => a + r.durationMs, 0),
      }
    : null;
  const statuses = repResults.map((r) => r.status);
  const status = statuses.every((s) => s === 'ok')
    ? 'ok'
    : ops.length
      ? 'partial'
      : 'error';
  return {
    logger: adapter.id,
    scenario: scenario.id,
    sink,
    iterations,
    warmup,
    reps,
    status,
    statuses,
    agg,
    reps: repResults,
  };
}

module.exports = { runMeasurement, runRep, withTimeout, sleep, validateRep };
