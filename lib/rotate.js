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
      this.closeStream(this.zippedArchive ? () => this.archiveFile(previous) : undefined);
      this.onDateChanged(previous, false);
      this.currentKey = null;
    }
    if (this.stream === null) {
      this.open(dateStr);
    } else if (this.streamSize + incoming > this.maxBytes) {
      const cur = parseInt(String(this.currentKey || '#0').split('#')[1] || '0', 10);
      const rotatedOut = this.currentFile;
      this.closeStream(this.zippedArchive ? () => this.archiveFile(rotatedOut) : undefined);
      this.open(dateStr, cur + 1);
    }
  }

  archiveFile(file) {
    if (!file || typeof file !== 'string') return;
    if (file.endsWith('.gz')) return;
    if (!file.endsWith('.log')) return;
    try {
      if (this.zippedArchive && fs.existsSync(file)) {
        const gz = file + '.gz';
        const data = fs.readFileSync(file);
        fs.writeFileSync(gz, zlib.gzipSync(data));
        fs.rmSync(file, { force: true });
      }
    } catch {}
  }

  stemFor(base) {
    const marker = '%DATE%';
    const idx = this.filename.indexOf(marker);
    if (idx === -1) return null;
    const head = this.filename.slice(0, idx);
    const tail = this.filename.slice(idx + marker.length);
    if (base.length < head.length + tail.length) return null;
    if (!base.startsWith(head) || !base.endsWith(tail)) return null;
    const dateStr = tail.length === 0 ? base.slice(head.length) : base.slice(head.length, base.length - tail.length);
    const stem = head + dateStr;
    if (!stem || stem[0] === '.') return null;
    return stem;
  }

  onDateChanged(previousFile, archiveSelf = true) {
    if (!previousFile) return;
    try {
      const base = path.basename(previousFile);
      if (archiveSelf) this.archiveFile(previousFile);
      const stem = this.stemFor(base);
      if (stem) {
        let entries = null;
        try {
          entries = fs.readdirSync(this.dirname);
        } catch {
          entries = null;
        }
        if (entries) {
          for (const entry of entries) {
            if (!entry || entry[0] === '.') continue;
            if (entry === base) continue;
            if (!entry.startsWith(stem)) continue;
            if (!entry.endsWith('.log')) continue;
            if (entry.endsWith('.gz')) continue;
            this.archiveFile(path.join(this.dirname, entry));
          }
        }
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

  closeStream(afterClose) {
    const s = this.stream;
    this.stream = null;
    if (!s) return null;
    try {
      if (typeof afterClose === 'function') {
        const run = () => { try { afterClose(); } catch {} };
        if (s.destroyed === true) run();
        else s.once('close', run);
      }
      s.end();
    } catch {}
    return s;
  }

  close() {
    this.closeStream();
    this.currentKey = null;
  }
}

module.exports = { FileTransport, parseSize, parseDays };
