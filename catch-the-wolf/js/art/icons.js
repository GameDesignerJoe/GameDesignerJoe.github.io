// Small UI art: the pelt (currency), hearts, sparkles. Exposed both as canvas
// painters and as cached data-URL images so the DOM HUD can use the same art.

import { INK, ellipse, inked, shadeInside } from './draw.js';
import { WOLF } from './palette.js';
import { paintSheep } from './sheep.js';

// A stretched wolf hide, top-down: head with ears at the top, four leg flaps,
// a tail at the bottom. Units: about 64 across.
export function paintPelt(ctx) {
  const fur = WOLF.grey;
  const p = new Path2D();
  p.moveTo(0, -26);
  p.bezierCurveTo(6, -26, 9, -22, 9, -18);
  p.lineTo(13, -26); p.lineTo(15, -14);           // right ear
  p.bezierCurveTo(19, -12, 28, -14, 29, -8);      // right foreleg
  p.bezierCurveTo(24, -6, 19, -4, 17, 2);
  p.bezierCurveTo(18, 10, 26, 14, 26, 20);        // right hind leg
  p.bezierCurveTo(20, 21, 14, 18, 9, 18);
  p.bezierCurveTo(6, 22, 4, 30, 0, 32);           // tail
  p.bezierCurveTo(-4, 30, -6, 22, -9, 18);
  p.bezierCurveTo(-14, 18, -20, 21, -26, 20);
  p.bezierCurveTo(-26, 14, -18, 10, -17, 2);
  p.bezierCurveTo(-19, -4, -24, -6, -29, -8);
  p.bezierCurveTo(-28, -14, -19, -12, -15, -14);
  p.lineTo(-13, -26); p.lineTo(-9, -18);
  p.bezierCurveTo(-9, -22, -6, -26, 0, -26);
  p.closePath();
  inked(ctx, p, fur.base, 3);
  shadeInside(ctx, p, { x: 0, y: 2, rx: 26, ry: 28 }, fur.shade, fur.light, 0.22);
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = fur.pale;
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fur.mid;
  ctx.beginPath(); ctx.ellipse(0, -16, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // stitched edge
  ctx.save();
  ctx.setLineDash([2.2, 2.6]);
  ctx.strokeStyle = 'rgba(38,42,59,0.45)'; ctx.lineWidth = 1;
  ctx.translate(0, 1); ctx.scale(0.86, 0.86);
  ctx.stroke(p);
  ctx.restore();
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
