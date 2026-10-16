'use strict';

/**
 * Output sinks for benchmarks.
 *
 * - `null`: output is fully generated then discarded (measures logger +
 *   serialization cost, no I/O).
 * - `file`: output goes to a real file (measures logger + I/O).
 * - `stdout`: output goes to the real process.stdout (measured separately,
 *   engine runs those jobs in a child process).
 *
 * Loggers that write straight to process.stdout/stderr without stream
 * injection use `installStdStub()`, which swaps the write functions for
 * no-ops during measurement and restores them afterwards. Output is still
 * rendered; only the final write syscall is discarded.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');

function createDevNull() {
  return new Writable({
    write(_chunk, _enc, cb) { cb(); },
    writev(chunks, cb) { cb(); },
  });
}

function installStdStub() {
  const origOut = process.stdout.write;
  const origErr = process.stderr.write;
  const calls = { out: 0, err: 0 };
  process.stdout.write = function stubbedOut() { calls.out += 1; return true; };
  process.stderr.write = function stubbedErr() { calls.err += 1; return true; };
  let restored = false;
  return {
    calls,
    restore() {
      if (restored) return;
      restored = true;
      process.stdout.write = origOut;
      process.stderr.write = origErr;
    },
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function uniqueFile(dir, base, ext) {
  const stamp = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return path.join(dir, `${base}-${stamp}-${rnd}${ext}`);
}

function osTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

module.exports = { createDevNull, installStdStub, ensureDir, uniqueFile, osTempDir };
