const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const dayjs = require('dayjs');

function parseSize(value, fallback) {
  if (value == null) return fallback;
  const m = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*([kmg])?$/i);
  if (!m) return fallback;
  const mult = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[(m[2] || '').toLowerCase()] ?? 1;
  return Math.floor(parseFloat(m[1]) * mult);
}

function parseDays(value) {
  if (value == null) return null;
  const m = String(value).trim().match(/^(\d+)\s*d$/i);
  return m ? parseInt(m[1], 10) : null;
}

class FileTransport {
  constructor({ folder, filename, datePattern, maxSize = '20m', maxFiles = '14d', zippedArchive = false, level, render }) {
    this.dirname = folder;
    this.filename = filename;
    this.options = { datePattern, maxSize, maxFiles, zippedArchive };
    this.level = level;
    this.render = render;
    this.datePattern = datePattern;
    this.maxBytes = parseSize(maxSize, Infinity);
    this.maxFiles = maxFiles;
    this.maxDays = parseDays(maxFiles);
    this.zippedArchive = zippedArchive;
    this.currentKey = null;
    this.currentFile = null;
    this.stream = null;
    this.streamSize = 0;
    this.streamErr = null;
  }

  fileNameFor(dateStr, n = 0) {
    let name = this.filename.split('%DATE%').join(dateStr);
    if (n > 0) {
      const ext = path.extname(name) || '.log';
      name = name.slice(0, -ext.length) + '-' + n + ext;
    }
    return name;
  }

  open(dateStr, startN = 0) {
    if (!fs.existsSync(this.dirname)) fs.mkdirSync(this.dirname, { recursive: true });
    let n = startN;
    let full = path.join(this.dirname, this.fileNameFor(dateStr, n));
    try {
      let size = fs.existsSync(full) ? fs.statSync(full).size : 0;
      while (size >= this.maxBytes && n < 1000) {
        n += 1;
        full = path.join(this.dirname, this.fileNameFor(dateStr, n));
        size = fs.existsSync(full) ? fs.statSync(full).size : 0;
      }
    } catch {}
    const stream = fs.createWriteStream(full, { flags: 'a' });
    stream.on('error', (err) => { this.streamErr = err; });
    this.stream = stream;
    this.streamSize = 0;
    try {
      this.streamSize = fs.existsSync(full) ? fs.statSync(full).size : 0;
    } catch {}
    this.currentKey = dateStr + '#' + n;
    this.currentFile = full;
  }

  rotateIfNeeded(dateStr, incoming) {
    if (this.currentKey !== null && !this.currentKey.startsWith(dateStr + '#')) {
      const previous = this.currentFile;
      this.closeStream();
      this.onDateChanged(previous);
      this.currentKey = null;
    }
    if (this.stream === null) {
      this.open(dateStr);
    } else if (this.streamSize + incoming > this.maxBytes) {
      const cur = parseInt(String(this.currentKey || '#0').split('#')[1] || '0', 10);
      this.closeStream();
      this.open(dateStr, cur + 1);
    }
  }

  onDateChanged(previousFile) {
    if (!previousFile) return;
    try {
      if (this.zippedArchive && fs.existsSync(previousFile)) {
        const gz = previousFile + '.gz';
        const data = fs.readFileSync(previousFile);
        fs.writeFileSync(gz, zlib.gzipSync(data));
        fs.rmSync(previousFile, { force: true });
      }
    } catch {}
    this.cleanupOld();
  }

  cleanupOld() {
    if (this.maxDays == null) return;
    let entries;
    try {
      entries = fs.readdirSync(this.dirname);
    } catch {
      return;
    }
    const cutoff = Date.now() - this.maxDays * 86400000;
    for (const entry of entries) {
      if (!entry.endsWith('.log') && !entry.endsWith('.log.gz') && !entry.endsWith('.gz')) continue;
      const full = path.join(this.dirname, entry);
      try {
        if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true });
      } catch {}
    }
  }

  write(entry) {
    const line = this.render(entry);
    const buf = Buffer.byteLength(line + '\n');
    const dateStr = dayjs().format(this.datePattern);
    this.rotateIfNeeded(dateStr, buf);
    if (this.stream) {
      this.stream.write(line + '\n');
      this.streamSize += buf;
    }
  }

  closeStream() {
    if (this.stream) {
      try {
        this.stream.end();
      } catch {}
      this.stream = null;
    }
  }

  close() {
    this.closeStream();
    this.currentKey = null;
  }
}

module.exports = { FileTransport, parseSize, parseDays };
