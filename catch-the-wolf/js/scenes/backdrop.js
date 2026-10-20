// Static scenery for each screen, painted once per resize into an offscreen
// canvas. Returns { canvas, avoid } where `avoid` lists solid props (circles)
// for the farm sheep to steer around.

import { paintMeadow, paintDirt, paintTree, paintBush, paintRock, paintHay, paintPond, paintFence, paintTrough, setSeason } from '../art/ground.js';
import { rng } from '../art/draw.js';

function surface(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { c, ctx };
}

// A fenced pen: rails around rect r, with a gap at the bottom-centre.
function pen(ctx, r, s, gate = true) {
  const g = gate ? 34 * s : 0;
  const midX = r.x + r.w / 2;
  paintFence(ctx, r.x, r.y, r.x + r.w, r.y, s);
  paintFence(ctx, r.x, r.y, r.x, r.y + r.h, s);
  paintFence(ctx, r.x + r.w, r.y, r.x + r.w, r.y + r.h, s);
  paintFence(ctx, r.x, r.y + r.h, midX - g, r.y + r.h, s);
  paintFence(ctx, midX + g, r.y + r.h, r.x + r.w, r.y + r.h, s);
}

// Find-the-wolf field: grass inside a fenced pen, scenery in the margins.
export function playBackdrop(w, h, dpr, field, season = 'spring') {
  setSeason(season);
  const { c, ctx } = surface(w, h, dpr);
  paintMeadow(ctx, w, h, 11, 0.9);
  const r = rng(5);
  // Decorate outside the pen only.
  const outside = (x, y, pad) => x < field.x - pad || x > field.x + field.w + pad || y < field.y - pad || y > field.y + field.h + pad;
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h;
    if (!outside(x, y, 40)) continue;
    const k = r();
    if (k < 0.35) paintBush(ctx, x, y, 0.8 + r() * 0.5, 1 + i, r() < 0.3);
    else if (k < 0.5) paintRock(ctx, x, y, 0.8 + r() * 0.6);
    else if (k < 0.62) paintTree(ctx, x, y, 0.8 + r() * 0.4, 3 + i);
  }
  const s = Math.max(0.8, Math.min(1.2, w / 500));
  pen(ctx, { x: field.x - 8, y: field.y - 8, w: field.w + 16, h: field.h + 16 }, s, false);
  return { canvas: c, avoid: [] };
}

// The player's farm: a big paddock with a pond, trees, hay and a trough.
export function farmBackdrop(w, h, dpr, area) {
  setSeason('spring');
  const { c, ctx } = surface(w, h, dpr);
  paintMeadow(ctx, w, h, 21, 1);
  const s = Math.max(0.75, Math.min(1.3, Math.min(w, h) / 560));
  const avoid = [];
  // Dirt yard by the gate, like the reference tiles.
  const yardW = Math.min(area.w * 0.5, 260 * s), yardH = 90 * s;
  paintDirt(ctx, area.x + area.w / 2 - yardW / 2, area.y + area.h - yardH - 10 * s, yardW, yardH, 28 * s, 8);

  // Every solid prop keeps a sheep-wide corridor to the fence and to its
  // neighbours, so the flock can always walk all the way round it.
  const lane = 95 * s;
  const pondR = Math.min(area.w, area.h) * 0.13;
  const pondRx = pondR * 1.15 + 8, pondRy = pondR * 0.8 + 8; // incl. the sandy bank
  const pond = { x: area.x + area.w - pondRx - lane, y: area.y + pondRy + lane };
  paintPond(ctx, pond.x, pond.y, pondR * 1.15, pondR * 0.8, 6);
  avoid.push({ x: pond.x, y: pond.y, r: pondRx });

  const hay = { x: area.x + lane + 26 * s, y: area.y + area.h * 0.28 };
  paintHay(ctx, hay.x, hay.y, 1.2 * s);
  paintHay(ctx, hay.x + 6 * s, hay.y + 34 * s, 1.2 * s);
  avoid.push({ x: hay.x + 3 * s, y: hay.y + 17 * s, r: 46 * s });

  const trough = { x: area.x + lane + 34 * s, y: area.y + area.h * 0.7 };
  paintTrough(ctx, trough.x, trough.y, 1.25 * s);
  avoid.push({ x: trough.x, y: trough.y, r: 34 * s });

  // Scatter of flowers/rocks inside, trees outside the fence.
  const r = rng(9);
  for (let i = 0; i < 6; i++) paintRock(ctx, area.x + r() * area.w, area.y + r() * area.h, 0.6 + r() * 0.4);
  pen(ctx, area, s, true);
  for (let i = 0; i < 60; i++) {
    const x = r() * w, y = r() * h;
    if (x > area.x - 50 && x < area.x + area.w + 50 && y > area.y - 50 && y < area.y + area.h + 50) continue;
    const k = r();
    if (k < 0.4) paintTree(ctx, x, y, (0.7 + r() * 0.5) * s, 30 + i);
    else if (k < 0.75) paintBush(ctx, x, y, (0.8 + r() * 0.5) * s, 50 + i, r() < 0.3);
  }
  // A tree inside the paddock for shade.
  const tree = { x: area.x + area.w * 0.55, y: area.y + area.h * 0.47 };
  paintTree(ctx, tree.x, tree.y, 0.9 * s, 77);
  avoid.push({ x: tree.x, y: tree.y, r: 50 * s });
  return { canvas: c, avoid, scale: s };
}

// Title: open meadow with a dirt path and a few trees.
export function titleBackdrop(w, h, dpr, season = 'spring') {
  setSeason(season);
  const { c, ctx } = surface(w, h, dpr);
  paintMeadow(ctx, w, h, 31, 1);
  const r = rng(13);
  for (let i = 0; i < 14; i++) {
    const x = r() * w, y = r() * h;
    if (y > h * 0.27 && y < h * 0.74) continue; // keep the sheep's meadow clear
    if (r() < 0.5) paintTree(ctx, x, y, 0.8 + r() * 0.5, 90 + i);
    else paintBush(ctx, x, y, 1 + r() * 0.4, 70 + i, r() < 0.4);
  }
  return { canvas: c, avoid: [] };
}
