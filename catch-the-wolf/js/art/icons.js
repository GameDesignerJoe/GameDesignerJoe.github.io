// Small UI art: the pelt (currency), hearts, sparkles. Exposed both as canvas
// painters and as cached data-URL images so the DOM HUD can use the same art.

import { INK, ellipse, inked } from './draw.js';
import { WOLF } from './palette.js';
import { paintSheep } from './sheep.js';

// A wolf-skin rug, top-down: round head with pointy ears and a sleepy face,
// four rounded leg flaps, a bushy tail. Units: about 64 across.
export function paintPelt(ctx) {
  const f = WOLF.grey;
  // Tail first (under the hide).
  const tail = new Path2D();
  tail.moveTo(-4, 16); tail.quadraticCurveTo(-9, 26, -2, 33); tail.quadraticCurveTo(6, 34, 6, 26); tail.quadraticCurveTo(5, 20, 4, 16); tail.closePath();
  inked(ctx, tail, f.base, 2.6);
  ctx.save(); ctx.clip(tail); ctx.fillStyle = f.dark; ctx.beginPath(); ctx.ellipse(1, 33, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // Hide with four leg flaps.
  const hide = new Path2D();
  ellipse(hide, 0, 4, 15, 16);
  for (const [x, y, a] of [[-17, -6, -0.5], [17, -6, 0.5], [-16, 15, 0.6], [16, 15, -0.6]]) ellipse(hide, x, y, 8.5, 5.5, a);
  inked(ctx, hide, f.base, 2.8);
  ctx.save(); ctx.clip(hide);
  ctx.fillStyle = f.shade; ctx.beginPath(); ctx.ellipse(6, 12, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = f.base; ctx.beginPath(); ctx.ellipse(-2, 2, 20, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = f.pale; ctx.beginPath(); ctx.ellipse(0, 6, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Head with ears.
  for (const s of [-1, 1]) {
    const ear = new Path2D();
    ear.moveTo(s * 4, -20); ear.lineTo(s * 12, -31); ear.lineTo(s * 12.5, -17); ear.closePath();
    inked(ctx, ear, f.base, 2.4);
    ctx.fillStyle = f.dark; ctx.beginPath(); ctx.moveTo(s * 7, -21); ctx.lineTo(s * 11, -27); ctx.lineTo(s * 11, -20); ctx.fill();
  }
  const head = new Path2D(); ellipse(head, 0, -16, 11, 10);
  inked(ctx, head, f.base, 2.6);
  ctx.save(); ctx.clip(head);
  ctx.fillStyle = f.pale; ctx.beginPath(); ctx.ellipse(0, -10, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 5, -18, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  const nose = new Path2D(); ellipse(nose, 0, -9.5, 2.6, 1.9);
  inked(ctx, nose, '#1c1f2b', 0.6);
}

export function paintHeart(ctx, col = '#ff6b8b') {
  const p = new Path2D();
  p.moveTo(0, 8);
  p.bezierCurveTo(-12, 0, -10, -10, -4, -10);
  p.bezierCurveTo(-1.5, -10, 0, -8, 0, -6);
  p.bezierCurveTo(0, -8, 1.5, -10, 4, -10);
  p.bezierCurveTo(10, -10, 12, 0, 0, 8);
  inked(ctx, p, col, 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-4.5, -5.5, 2, 1.3, -0.6, 0, Math.PI * 2); ctx.fill();
}

const urlCache = new Map();
// Render a painter to a PNG data URL (for <img> in the DOM HUD/shop).
export function iconURL(key, w, h, paint, scale = 3) {
  const k = `${key}@${w}x${h}`;
  if (urlCache.has(k)) return urlCache.get(k);
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  paint(ctx, w, h);
  const url = c.toDataURL();
  c.width = 0; c.height = 0; // free now; WebKit counts unreleased canvases against a hard cap
  urlCache.set(k, url);
  return url;
}

export const peltURL = () => iconURL('pelt', 64, 66, (c) => { c.translate(32, 33); paintPelt(c); });
export const sheepURL = (id, look, px = 96) => iconURL(`sheep-${id}`, px, px * 1.15, (c, w) => {
  c.translate(w / 2, w * 0.6);
  c.scale(w / 128, w / 128);
  paintSheep(c, look);
});

export { INK, ellipse };
