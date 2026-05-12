// One-off: scale all price values in series.json from VG-FN tier to Fair/Good tier.
// Factor 0.27 ≈ mid of typical 0.25-0.30 Fair/Good vs VG-FN market ratio.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SERIES_PATH = resolve(SCRIPT_DIR, '..', 'series.json');
const FACTOR = 0.27;

function scaleText(text) {
  // Match $NN or $NN-MM or $NN–MM (em-dash). Capture each number, scale, rebuild.
  return text.replace(/\$(\d+)(?:\s*[-–]\s*(\d+))?/g, (_, lo, hi) => {
    const sLo = Math.max(1, Math.round(lo * FACTOR));
    if (hi != null) {
      const sHi = Math.max(sLo + 1, Math.round(hi * FACTOR));
      return `$${sLo}–${sHi}`;
    }
    return `$${sLo}`;
  });
}

const series = JSON.parse(readFileSync(SERIES_PATH, 'utf8'));
for (const s of series) {
  const oldRange = s.priceRange, oldMid = s.midPrice;
  s.priceRange = scaleText(s.priceRange);
  s.midPrice = Math.max(1, Math.round(s.midPrice * FACTOR));
  console.log(`${s.id.padEnd(28)} ${oldRange.padEnd(22)} → ${s.priceRange.padEnd(22)}  mid ${oldMid} → ${s.midPrice}`);
  for (const k of s.keys) {
    const oldKp = k.price;
    k.price = scaleText(k.price);
    if (oldKp !== k.price) console.log(`  key ${k.issue.padEnd(18)} ${oldKp.padEnd(20)} → ${k.price}`);
  }
}

writeFileSync(SERIES_PATH, JSON.stringify(series, null, 2) + '\n');
console.log('\nWrote scaled prices to', SERIES_PATH);
