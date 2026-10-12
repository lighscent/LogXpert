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
      const stem = this.stemForDate(String(this.currentKey).split('#')[0]);
      this.closeStream(this.zippedArchive ? () => this.archiveDay(previous, true, stem) : undefined);
      if (this.zippedArchive) this.archiveDay(previous, false, stem);
      this.cleanupOld();
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

  /**
   * Exact day stem for an explicit date (`head + dateStr`, no filename
   * parsing). Unlike `stemFor()`, this cannot mistake a `-N` size suffix
   * for part of the date, because the date comes from `currentKey`.
   */
  stemForDate(dateStr) {
    const marker = '%DATE%';
    const idx = this.filename.indexOf(marker);
    if (idx === -1 || !dateStr) return null;
    const stem = this.filename.slice(0, idx) + dateStr;
    if (!stem || stem[0] === '.') return null;
    return stem;
  }

  /**
   * One single `<stem>.log.gz` archive per day: concatenates the content of
   * every same-day `.log` file (oldest first) into one gzip stream, then
   * removes the originals. Gunzipping yields the whole day's log in order.
   *
   * Runs in two phases on date change: siblings are merged synchronously
   * (stable files), while `previous` — the just-closed live file — is merged
   * on stream `close`, once flushed. The second phase absorbs the archive
   * written by the first, so chronological order is preserved.
   */
  archiveDay(previousFile, includeSelf = true, stem = null) {
    if (!this.zippedArchive) return;
    if (!previousFile || typeof previousFile !== 'string') return;
    try {
      const base = path.basename(previousFile);
      const resolved = stem || this.stemFor(base);
      if (!resolved) {
        // No %DATE% in the template: single-file archive, historical behavior.
        if (includeSelf) this.mergeFilesIntoArchive([previousFile], previousFile + '.gz');
        return;
      }
      const target = path.join(this.dirname, resolved + '.log.gz');
      const files = this.collectDayFiles(previousFile, resolved, includeSelf);
      this.mergeFilesIntoArchive(files, target);
    } catch {}
  }

  collectDayFiles(previousFile, stem, includeSelf = false) {
    const out = [];
    const base = path.basename(previousFile);
    if (!stem) return out;
    let entries = null;
    try {
      entries = fs.readdirSync(this.dirname);
    } catch {
      return out;
    }
    const prevFull = path.join(this.dirname, base);
    for (const entry of entries) {
      if (!entry || entry[0] === '.') continue;
      if (!entry.startsWith(stem)) continue;
      if (entry.endsWith('.gz')) continue;
      if (!entry.endsWith('.log')) continue;
      const full = path.join(this.dirname, entry);
      if (full === prevFull) continue;
      try {
        out.push({ full, mtime: fs.statSync(full).mtimeMs, name: entry });
      } catch {}
    }
    if (includeSelf && previousFile.endsWith('.log') && !previousFile.endsWith('.gz')) {
      try {
        out.push({ full: previousFile, mtime: fs.statSync(previousFile).mtimeMs, name: base });
      } catch {}
    }
    out.sort((a, b) => (a.mtime - b.mtime) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out.map((e) => e.full);
  }

  mergeFilesIntoArchive(files, target) {
    const parts = [];
    try {
      if (fs.existsSync(target)) parts.push(zlib.gunzipSync(fs.readFileSync(target)));
    } catch {}
    for (const file of files) {
      try {
        if (!file.endsWith('.log') || file.endsWith('.gz')) continue;
        if (!fs.existsSync(file)) continue;
        parts.push(fs.readFileSync(file));
      } catch {}
    }
    if (parts.length === 0) return false;
    try {
      fs.writeFileSync(target, zlib.gzipSync(Buffer.concat(parts)));
    } catch {
      return false;
    }
    for (const file of files) {
      try {
        fs.rmSync(file, { force: true });
      } catch {}
    }
    return true;
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
