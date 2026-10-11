// Regenerates assets/npm-downloads.svg from the npm downloads API.
// Usage: node scripts/downloads-graph.js [daily-json [versions-json]]
// (optional JSON args use the same shapes as the npm API for offline runs)
const fs = require('fs');
const path = require('path');

const DAYS = 7;
const TOP_N = 5;
const OUT = path.join(__dirname, '..', 'assets', 'npm-downloads.svg');

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npm API ${res.status} for ${url}`);
  return res.json();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function render(days, top) {
  const W = 880, H = 240;
  const PAD_L = 46, PAD_R = 14, PAD_T = 44, PAD_B = 30;
  const DIV_X = 640;
  const plotW = DIV_X - PAD_L - 16, plotH = H - PAD_T - PAD_B;
  const max = Math.max(...days.map((d) => d.total), 1);
  const grand = days.reduce((s, d) => s + d.total, 0);
  const slot = plotW / days.length;
  const barW = Math.round(slot * 0.52);
  const yFor = (v) => PAD_T + plotH - Math.round((v / max) * plotH);

  let bars = '';
  days.forEach((d, i) => {
    const h = Math.round((d.total / max) * plotH);
    const x = Math.round(PAD_L + i * slot + (slot - barW) / 2);
    const y = PAD_T + plotH - h;
    const peak = d.total === max && max > 0;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, d.total > 0 ? 3 : 0)}" rx="4" fill="${peak ? 'url(#peak)' : 'url(#bar)'}">` +
      `<title>${esc(d.label)}: ${d.total} downloads</title></rect>`;
    if (d.total > 0) {
      bars += `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="${peak ? 'bold' : 'normal'}" fill="#e6edf3" font-family="sans-serif">${d.total}</text>`;
    }
    bars += `<text x="${x + barW / 2}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#8b949e" font-family="sans-serif">${esc(d.label)}</text>`;
  });

  let grid = '';
  for (const v of [0, Math.round(max / 2), max]) {
    const y = yFor(v);
    grid += `<line x1="${PAD_L}" y1="${y}" x2="${DIV_X - 16}" y2="${y}" stroke="#30363d" stroke-width="1"/>` +
      `<text x="${PAD_L - 7}" y="${y + 4}" text-anchor="end" font-size="10" fill="#8b949e" font-family="sans-serif">${v}</text>`;
  }

  let panel = `<line x1="${DIV_X}" y1="${PAD_T}" x2="${DIV_X}" y2="${H - PAD_B}" stroke="#30363d" stroke-width="1"/>` +
    `<text x="${DIV_X + 16}" y="${PAD_T + 12}" font-size="11" fill="#e6edf3" font-family="sans-serif" font-weight="bold">top versions · ${DAYS}d</text>`;
  const topMax = Math.max(...top.map((t) => t.count), 1);
  const rowH = plotH / Math.max(top.length, 1);
  const barMaxW = W - PAD_R - (DIV_X + 16) - 72;
  top.forEach((t, i) => {
    const cy = PAD_T + 24 + i * rowH + rowH / 2;
    const bw = Math.round((t.count / topMax) * barMaxW);
    panel += `<text x="${DIV_X + 16}" y="${cy - 2}" font-size="11" fill="#e6edf3" font-family="monospace">v${esc(t.version)}</text>` +
      `<rect x="${DIV_X + 16}" y="${cy + 3}" width="${Math.max(bw, t.count > 0 ? 3 : 0)}" height="7" rx="3.5" fill="url(#bar)"/>` +
      `<text x="${W - PAD_R}" y="${cy + 10}" text-anchor="end" font-size="11" fill="#8b949e" font-family="sans-serif">${t.count}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">` +
    `<title>Daily npm downloads for logxpert, last ${DAYS} complete days</title>` +
    `<defs>` +
    `<linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#059669"/></linearGradient>` +
    `<linearGradient id="peak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#16a34a"/></linearGradient>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" rx="8" fill="#0d1117"/>` +
    `<text x="${PAD_L}" y="20" font-size="13" fill="#e6edf3" font-family="sans-serif" font-weight="bold">npm downloads / day — last ${DAYS} days, excl. today · total ${grand}</text>` +
    `<text x="${PAD_L}" y="34" font-size="10" fill="#8b949e" font-family="sans-serif">updated ${isoDaysAgo(0)}</text>` +
    grid + bars + panel + `</svg>`;
}

async function main() {
  const end = isoDaysAgo(1);
  const start = isoDaysAgo(DAYS);
  const daily = process.argv[2]
    ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
    : await fetchJson(`https://api.npmjs.org/downloads/range/${start}:${end}/logxpert`);
  let versions = {};
  if (process.argv[3]) {
    versions = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).downloads || {};
  } else {
    try {
      // No explicit ranges here (404): last-week matches the window in practice (npm has no today data yet).
      versions = (await fetchJson('https://api.npmjs.org/versions/logxpert/last-week')).downloads || {};
    } catch (err) {
      console.error(`versions API failed, panel skipped: ${err.message || err}`);
    }
  }
  const byDay = new Map((daily.downloads || []).map((d) => [d.day, d.downloads]));
  const days = [];
  for (let d = DAYS; d >= 1; d--) {
    const day = isoDaysAgo(d);
    days.push({ label: day.slice(5), total: byDay.get(day) || 0 });
  }
  const top = Object.entries(versions)
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => b.count - a.count || (a.version < b.version ? -1 : 1))
    .slice(0, TOP_N);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(days, top));
  console.log(`wrote ${OUT} (total ${days.reduce((s, d) => s + d.total, 0)}, versions ${top.length})`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
