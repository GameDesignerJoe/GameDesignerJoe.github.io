// Backgrounds and scenery: meadow grass, dirt paddocks with a spiky grass
// fringe (after the reference tileset), fences, trees, bushes, pond, hay.
// All painted once into an offscreen canvas per screen size, never per frame.

import { rng, ellipse, inked, cloud, mix } from './draw.js';

export const GRASS = { base: '#7cc242', dark: '#5fa630', deep: '#3f7d22', light: '#a3dc5c', blade: '#4d9128' };
export const DIRT = { base: '#7a5737', dark: '#5f4129', light: '#936c47', edge: '#3e2a1a' };

export function paintMeadow(ctx, w, h, seed = 1, density = 1) {
  const r = rng(seed);
  ctx.fillStyle = GRASS.base;
  ctx.fillRect(0, 0, w, h);
  // Big soft mottling so the field isn't flat.
  for (let i = 0; i < (w * h) / 9000; i++) {
    const x = r() * w, y = r() * h, rad = 30 + r() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < 0.5 ? '163,220,92' : '79,150,40';
    g.addColorStop(0, `rgba(${c},0.22)`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Grass tufts.
  const tufts = Math.round(((w * h) / 2600) * density);
  for (let i = 0; i < tufts; i++) grassTuft(ctx, r() * w, r() * h, 0.7 + r() * 0.7, r);
  // A sprinkle of tiny flowers.
  for (let i = 0; i < ((w * h) / 22000) * density; i++) {
    const x = r() * w, y = r() * h;
    const col = ['#ffffff', '#ffe066', '#ffd1e3'][Math.floor(r() * 3)];
    for (let k = 0; k < 3; k++) flower(ctx, x + (r() - 0.5) * 18, y + (r() - 0.5) * 12, 2 + r(), col);
  }
}

export function grassTuft(ctx, x, y, s, r = Math.random) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const blades = 3 + Math.floor(r() * 3);
  ctx.fillStyle = GRASS.blade;
  for (let i = 0; i < blades; i++) {
    const bx = (i - blades / 2) * 2.4, lean = (r() - 0.5) * 4, hgt = 5 + r() * 4;
    ctx.beginPath(); ctx.moveTo(bx - 1.4, 0); ctx.lineTo(bx + lean, -hgt); ctx.lineTo(bx + 1.4, 0); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = GRASS.light;
  ctx.beginPath(); ctx.moveTo(-0.6, 0); ctx.lineTo(0.5, -4.5); ctx.lineTo(1.2, 0); ctx.fill();
  ctx.restore();
}

function flower(ctx, x, y, s, col) {
  ctx.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8, s * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f2a23a';
  ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, Math.PI * 2); ctx.fill();
}

// Rounded dirt patch with plank-like grain and a spiky grass fringe.
export function paintDirt(ctx, x, y, w, h, radius = 26, seed = 3) {
  const r = rng(seed);
  const shape = new Path2D();
  shape.roundRect(x, y, w, h, radius);
  ctx.save();
  ctx.fillStyle = DIRT.base;
  ctx.fill(shape);
  ctx.clip(shape);
  // Grain in vertical bands, like the reference.
  const band = 26;
  for (let bx = x; bx < x + w; bx += band) {
    ctx.fillStyle = r() < 0.5 ? DIRT.light : DIRT.dark;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(bx, y, band * (0.4 + r() * 0.4), h);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = DIRT.dark;
    ctx.fillRect(bx + band - 1.5, y, 1.5, h);
  }
  // Faint diagonal cross-grain over the bands.
  ctx.strokeStyle = DIRT.dark; ctx.lineWidth = 1; ctx.globalAlpha = 0.18;
  for (let d = -h; d < w; d += 22) {
    ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d + h * 0.6, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + d + h * 0.6, y); ctx.lineTo(x + d, y + h); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Pebbles and scuffs.
  for (let i = 0; i < (w * h) / 900; i++) {
    ctx.fillStyle = r() < 0.5 ? DIRT.dark : DIRT.light;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(x + r() * w, y + r() * h, 1 + r() * 2.2, 0.8 + r() * 1.5, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Inner shadow under the grass lip (top and left edges read as raised turf).
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(40,24,12,0.35)';
  ctx.save(); ctx.translate(2, 3); ctx.stroke(shape); ctx.restore();
  ctx.restore();
  fringe(ctx, x, y, w, h, radius, r);
}

function fringe(ctx, x, y, w, h, radius, r) {
  // Walk the rounded-rect perimeter, dropping little grass spikes that point
  // inward over the dirt edge.
  const pts = [];
  const step = 4;
  const straight = [
    [x + radius, y, x + w - radius, y, 0, 1],
    [x + w, y + radius, x + w, y + h - radius, -1, 0],
    [x + w - radius, y + h, x + radius, y + h, 0, -1],
    [x, y + h - radius, x, y + radius, 1, 0],
  ];
  for (const [x1, y1, x2, y2, nx, ny] of straight) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += step) {
      const t = d / len;
      pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, nx, ny]);
    }
  }
  const corners = [
    [x + radius, y + radius, Math.PI, 1.5 * Math.PI],
    [x + w - radius, y + radius, 1.5 * Math.PI, 2 * Math.PI],
    [x + w - radius, y + h - radius, 0, 0.5 * Math.PI],
    [x + radius, y + h - radius, 0.5 * Math.PI, Math.PI],
  ];
  for (const [cx, cy, a1, a2] of corners) {
    const n = Math.ceil(((a2 - a1) * radius) / step);
    for (let i = 0; i < n; i++) {
      const a = a1 + ((a2 - a1) * i) / n;
      pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, -Math.cos(a), -Math.sin(a)]);
    }
  }
  // Group the perimeter into clumps of 2-4 blades with gaps between, so the
  // edge reads as tufts (like the reference tiles) rather than a sawtooth.
  const blades = [];
  for (let i = 0; i < pts.length;) {
    const n = 2 + Math.floor(r() * 3);
    const base = 4 + r() * 6;
    for (let k = 0; k < n && i < pts.length; k++, i++) {
      blades.push({ p: pts[i], len: base * (0.6 + r() * 0.8) + (k === 1 ? 3 : 0), lean: (r() - 0.5) * 4 });
    }
    i += r() < 0.5 ? 1 : 0;
  }
  // Earth lip just inside the dirt edge.
  ctx.strokeStyle = DIRT.edge; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.55;
  ctx.beginPath();
  pts.forEach(([px, py, nx, ny], i) => { const x = px + nx * 6, y = py + ny * 6; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = 1;
  // Dark outline pass, then bright grass pass, then lime highlights.
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass ? GRASS.base : GRASS.deep;
    const grow = pass ? 0 : 1.6;
    for (const { p: [px, py, nx, ny], len, lean } of blades) {
      const tx = -ny, ty = nx;
      const w = 3.4 + grow * 0.6;
      ctx.beginPath();
      ctx.moveTo(px - tx * w - nx * 3, py - ty * w - ny * 3);
      ctx.lineTo(px + nx * (len + grow) + tx * lean, py + ny * (len + grow) + ty * lean);
      ctx.lineTo(px + tx * w - nx * 3, py + ty * w - ny * 3);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = GRASS.light;
  for (const { p: [px, py, nx, ny], len, lean } of blades) {
    if (len < 7) continue;
    const tx = -ny, ty = nx;
    ctx.beginPath();
    ctx.moveTo(px - tx * 1.2, py - ty * 1.2);
    ctx.lineTo(px + nx * len * 0.7 + tx * lean * 0.7, py + ny * len * 0.7 + ty * lean * 0.7);
    ctx.lineTo(px + tx * 0.6, py + ty * 0.6);
    ctx.fill();
  }
}

// --- scenery -----------------------------------------------------------------
// Each takes a scale `s` where 1 ≈ one sheep-width tall prop.

export function paintTree(ctx, x, y, s = 1, seed = 5) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(22,40,30,0.32)';
  ctx.beginPath(); ctx.ellipse(16, 20, 50, 42, 0, 0, Math.PI * 2); ctx.fill();
  // trunk peeking out below the canopy
  const trunk = new Path2D(); trunk.roundRect(-7, 18, 14, 32, 5);
  inked(ctx, trunk, '#8a5a34', 3);
  ctx.fillStyle = '#6b4325'; ctx.fillRect(1, 20, 5, 28);
  const { path } = cloud(ctx, { x: 0, y: 0, rx: 46, ry: 42, lobes: 11, lobeR: 15, seed, curls: 6, curlR: 11 },
    { base: '#5fb33a', mid: '#4f9e2f', shade: '#357320', light: '#9be066' }, 3.4);
  // darker under-canopy ring and big top highlights
  ctx.save(); ctx.clip(path);
  ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(30,70,20,0.35)';
  ctx.beginPath(); ctx.ellipse(6, 8, 46, 42, 0, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(190,240,140,0.55)';
  ctx.beginPath(); ctx.ellipse(-16, -18, 14, 8, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, -26, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function paintBush(ctx, x, y, s = 1, seed = 9, berries = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(22,40,30,0.28)';
  ctx.beginPath(); ctx.ellipse(4, 6, 24, 18, 0, 0, Math.PI * 2); ctx.fill();
  cloud(ctx, { x: 0, y: 0, rx: 22, ry: 17, lobes: 8, lobeR: 8, seed, curls: 3, curlR: 6 },
    { base: '#4fa634', mid: '#43922b', shade: '#317321', light: '#7ccc55' }, 3);
  if (berries) {
    const r = rng(seed);
    for (let i = 0; i < 5; i++) {
      const p = new Path2D(); ellipse(p, (r() - 0.5) * 26, (r() - 0.5) * 18, 2.4, 2.4);
      inked(ctx, p, '#e2475b', 0.9);
    }
  }
  ctx.restore();
}

export function paintRock(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(22,40,30,0.28)';
  ctx.beginPath(); ctx.ellipse(3, 4, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
  const p = new Path2D();
  p.moveTo(-14, 3); p.quadraticCurveTo(-15, -8, -4, -10); p.quadraticCurveTo(10, -12, 14, -2);
  p.quadraticCurveTo(15, 7, 2, 8); p.quadraticCurveTo(-12, 9, -14, 3);
  inked(ctx, p, '#a9adb8', 2.6);
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = '#878c99'; ctx.beginPath(); ctx.ellipse(4, 6, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d3d6de'; ctx.beginPath(); ctx.ellipse(-5, -6, 6, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function paintHay(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(22,40,30,0.28)';
  ctx.fillRect(-18, -8, 42, 28);
  const p = new Path2D(); p.roundRect(-22, -14, 44, 28, 6);
  inked(ctx, p, '#e9c85a', 2.8);
  ctx.save(); ctx.clip(p);
  ctx.strokeStyle = '#c9a33a'; ctx.lineWidth = 1.2;
  for (let i = -20; i < 22; i += 4) { ctx.beginPath(); ctx.moveTo(i, -14); ctx.lineTo(i + 3, 14); ctx.stroke(); }
  ctx.fillStyle = '#f7e08f'; ctx.fillRect(-22, -14, 44, 5);
  ctx.restore();
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.4;
  for (const bx of [-9, 9]) { ctx.beginPath(); ctx.moveTo(bx, -14); ctx.lineTo(bx, 14); ctx.stroke(); }
  // loose straw poking out of the ends
  ctx.strokeStyle = '#d9b445'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  for (const [x1, y1, x2, y2] of [[-22, -8, -27, -10], [-22, 2, -28, 3], [-22, 9, -26, 13], [22, -6, 27, -9], [22, 4, 28, 6], [22, 10, 25, 14]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}

export function paintPond(ctx, x, y, rx, ry, seed = 4) {
  const r = rng(seed);
  // Smooth blob: curve through the midpoints of a jittered ring.
  const n = 10, ring = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 0.88 + r() * 0.2;
    ring.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  const mid = (i) => { const a = ring[i % n], b = ring[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const p = new Path2D();
  p.moveTo(...mid(0));
  for (let i = 1; i <= n; i++) p.quadraticCurveTo(ring[i % n][0], ring[i % n][1], ...mid(i));
  p.closePath();
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16; ctx.strokeStyle = '#d2bc84'; ctx.stroke(p); // sandy bank
  ctx.lineWidth = 7; ctx.strokeStyle = '#b39a62'; ctx.stroke(p);
  inked(ctx, p, '#4fa3d9', 3);
  ctx.clip(p);
  ctx.fillStyle = '#3a86bd';
  ctx.beginPath(); ctx.ellipse(x + rx * 0.15, y + ry * 0.2, rx * 0.95, ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4fa3d9';
  ctx.beginPath(); ctx.ellipse(x - rx * 0.05, y - ry * 0.05, rx * 0.85, ry * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const wx = x + (r() - 0.5) * rx, wy = y + (r() - 0.5) * ry;
    ctx.beginPath(); ctx.moveTo(wx - 8, wy); ctx.quadraticCurveTo(wx, wy - 3, wx + 8, wy); ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const lx = x + (r() - 0.3) * rx * 1.1, ly = y + (r() - 0.5) * ry * 0.9;
    const pad = new Path2D();
    pad.moveTo(lx, ly); pad.arc(lx, ly, 7, 0.3, Math.PI * 2 - 0.3); pad.closePath();
    inked(ctx, pad, '#69b843', 1.6);
  }
}

// A run of rail fence between two points, posts every ~40 units.
export function paintFence(ctx, x1, y1, x2, y2, s = 1) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.translate(x1, y1); ctx.rotate(ang);
  // shadow
  ctx.fillStyle = 'rgba(22,40,30,0.25)';
  ctx.fillRect(0, 4 * s, len, 7 * s);
  const wood = '#b07a45', woodDark = '#86562c', woodLight = '#cf9a62';
  const rail = new Path2D(); rail.roundRect(0, -3 * s, len, 6 * s, 2 * s);
  inked(ctx, rail, wood, 2.2 * s);
  ctx.fillStyle = woodLight; ctx.fillRect(2, -2.5 * s, len - 4, 1.6 * s);
  const posts = Math.max(1, Math.round(len / (42 * s)));
  for (let i = 0; i <= posts; i++) {
    const px = (len * i) / posts;
    const post = new Path2D(); post.roundRect(px - 5.5 * s, -5.5 * s, 11 * s, 11 * s, 2.5 * s);
    inked(ctx, post, woodDark, 2.2 * s);
    ctx.fillStyle = mix(woodDark, '#ffffff', 0.2);
    ctx.beginPath(); ctx.arc(px, 0, 2.6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = woodDark; ctx.lineWidth = 0.8 * s;
    ctx.beginPath(); ctx.arc(px, 0, 4 * s, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Water trough.
export function paintTrough(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(22,40,30,0.28)'; ctx.fillRect(-24, -6, 52, 22);
  const p = new Path2D(); p.roundRect(-26, -11, 52, 22, 4);
  inked(ctx, p, '#9a6a3c', 2.6);
  ctx.strokeStyle = '#7a5130'; ctx.lineWidth = 1;
  for (const px of [-13, 0, 13]) { ctx.beginPath(); ctx.moveTo(px, -11); ctx.lineTo(px, -7); ctx.moveTo(px, 7); ctx.lineTo(px, 11); ctx.stroke(); }
  const w = new Path2D(); w.roundRect(-21, -6.5, 42, 13, 3);
  ctx.fillStyle = '#4fa3d9'; ctx.fill(w);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-17, -4.5, 14, 2);
  ctx.restore();
}
