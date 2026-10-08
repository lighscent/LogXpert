const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const log = require('../main.js');

function testLogger(opts = {}) {
  const { console: consoleOpts, ...rest } = opts;
  return log.createLogger({ ...rest, console: { ...(consoleOpts || {}), enabled: false } });
}

const tmpDirs = [];

async function cleanupTmp() {
  await new Promise((r) => setTimeout(r, 250));
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
}

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logxpert-'));
  tmpDirs.push(dir);
  return dir;
}

function fileTransport(inst) {
  const t = inst._winston.transports.find((x) => typeof x.filename === 'string' && x.filename.includes('%DATE%'));
  assert.ok(t, 'expected a DailyRotateFile transport');
  return t;
}

function captureOutput(fn) {
  let out = '';
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (c) => { out += String(c); return true; };
  process.stderr.write = (c) => { out += String(c); return true; };
  try {
    fn();
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return out;
}

async function waitForLog(dir, expected, timeout = 3000, interval = 10) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(dir, f), 'utf8');
        if (content.includes(expected)) return f;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`timeout waiting for "${expected}" in ${dir}`);
}

module.exports = { log, testLogger, tmpDirs, cleanupTmp, makeTmpDir, fileTransport, captureOutput, waitForLog };
