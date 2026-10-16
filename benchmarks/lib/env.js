'use strict';

/**
 * Environment fingerprint for benchmark runs.
 * Native Node.js APIs only (node:os, node:child_process).
 */

const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function readPackageVersion(pkgName) {
  try {
    const pkgPath = require.resolve(`${pkgName}/package.json`, { paths: [process.cwd()] });
    return require(pkgPath).version || null;
  } catch {
    return null;
  }
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim() || null;
  } catch {
    return null;
  }
}

function collectEnv(extraVersions = {}) {
  const cpus = os.cpus();
  return {
    date: new Date().toISOString(),
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    osRelease: os.release(),
    cpuModel: cpus.length ? cpus[0].model.trim() : 'unknown',
    cpuCount: cpus.length,
    totalMemBytes: os.totalmem(),
    gitCommit: gitCommit(),
    ci: Boolean(process.env.CI),
    versions: { ...extraVersions },
  };
}

function resultsDir(rootDir = path.join(__dirname, '..', 'results'), stamp = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const name = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-` +
    `${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`;
  return path.join(rootDir, name);
}

module.exports = { readPackageVersion, gitCommit, collectEnv, resultsDir };
