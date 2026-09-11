#!/usr/bin/env node
// The Maze — the app icon.
//
// A meander: the oldest mark for a labyrinth there is. Drawn in the game's own
// floor grey on its own wall dark, with the player's arrowhead at the mouth of
// it. Re-run this to regenerate every size from the one drawing.
//
//   node maze/tools/make-icon.mjs
//
// Writes maze/icons/icon-32|180|192|512|1024.png. iOS masks the corners itself
// and paints no background of its own, so the artwork is full-bleed and square.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'maze/icons');
const SIZES = [32, 180, 192, 512, 1024];
const C = { bg: '#0d0f10', wall: '#1b1f21', floor: '#6e6a62', player: '#ece7da', edge: '#8b867a' };

// the drawing, at any size
const DRAW = `(c, S) => {
  const A = { wall: '${C.wall}', floor: '${C.floor}', player: '${C.player}', edge: '${C.edge}' };
  c.fillStyle = A.wall; c.fillRect(0, 0, S, S);
  // iOS masks the corners into a squircle, so everything is drawn inside a margin it cannot bite
  c.translate(S * 0.055, S * 0.055); c.scale(0.89, 0.89);
  const u = S / 11;
  // one unbroken corridor, wound in on itself
  const path = [[1,1],[9,1],[9,9],[2,9],[2,3],[7,3],[7,7],[4,7],[4,5],[6,5]];
  c.strokeStyle = A.floor; c.lineWidth = u; c.lineJoin = 'miter'; c.lineCap = 'butt';
  c.beginPath();
  path.forEach(([x, y], i) => { const px = x*u + u/2, py = y*u + u/2; i ? c.lineTo(px, py) : c.moveTo(px, py); });
  c.stroke();
  // and him at the mouth of it
  const r = u * 0.42, cx = u*2.4, cy = u*1.5;   // along the mouth a little, clear of the corner
  c.save(); c.translate(cx, cy); c.rotate(-Math.PI/2);
  c.beginPath(); c.moveTo(r, 0); c.lineTo(-r*0.8, -r*0.75); c.lineTo(-r*0.45, 0); c.lineTo(-r*0.8, r*0.75); c.closePath();
  c.fillStyle = A.player; c.fill();
  c.lineWidth = r * 0.13; c.lineJoin = 'round'; c.strokeStyle = A.edge; c.stroke();
  c.restore();
}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
await page.setContent('<canvas id="c"></canvas>');
fs.mkdirSync(OUT, { recursive: true });
for (const S of SIZES) {
  const data = await page.evaluate(([S, src]) => {
    const cv = document.getElementById('c'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    // eslint-disable-next-line no-eval
    (0, eval)('(' + src + ')')(c, S);
    return cv.toDataURL('image/png');
  }, [S, DRAW]);
  const file = path.join(OUT, `icon-${S}.png`);
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log('  ' + file);
}
await browser.close();
