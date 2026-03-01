// ============================================================
// THE CARTOGRAPHER - draw/coastline.js
// Line drawing helpers: wobblyLine (decorative, Math.random) and
// coastLine (deterministic, seeded — stable frame-to-frame).
// ============================================================

import { ctx } from '../canvas.js';
import { seededRandom } from '../terrain.js';

// Decorative wobbly line using Math.random() — intentional per-frame jitter.
// Use ONLY for decorative elements (water waves, tree outlines, etc.).
export function wobblyLine(x1, y1, x2, y2, wobble = 2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const steps = Math.max(3, Math.floor(dist / 8));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ctx.lineTo(
      x1 + (x2 - x1) * t + (Math.random() - 0.5) * wobble,
      y1 + (y2 - y1) * t + (Math.random() - 0.5) * wobble,
    );
  }
  ctx.stroke();
}

// Stable coastline — wobble is deterministic (seededRandom) so it doesn't
// jitter between frames. Use for all coastline and map edge drawing.
export function coastLine(x1, y1, x2, y2, wobble = 1.5) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const steps = Math.max(4, Math.floor(dist / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const seed1 = seededRandom(Math.round(x1 + i * 7.1),  Math.round(y1 + i * 13.3));
    const seed2 = seededRandom(Math.round(x1 + i * 11.7), Math.round(y1 + i * 5.9));
    ctx.lineTo(
      x1 + (x2 - x1) * t + (seed1 - 0.5) * wobble,
      y1 + (y2 - y1) * t + (seed2 - 0.5) * wobble,
    );
  }
  ctx.stroke();
  ctx.restore();
}
