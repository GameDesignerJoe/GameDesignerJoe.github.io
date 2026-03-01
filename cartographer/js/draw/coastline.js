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

// Stable decorative line — wobble is deterministic (seededRandom) so it doesn't
// jitter between frames. Use for tree trunks, rock cracks, landmark details.
// seed: a 0-1 float derived from tile/landmark coordinates (e.g. seededRandom()).
export function stableLine(x1, y1, x2, y2, seed, wobble = 1.5) {
  const base = Math.round(seed * 99991);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const steps = Math.max(3, Math.floor(dist / 8));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ctx.lineTo(
      x1 + (x2 - x1) * t + (seededRandom(base + i * 7, base + i * 11) - 0.5) * wobble,
      y1 + (y2 - y1) * t + (seededRandom(base + i * 13, base + i * 3) - 0.5) * wobble,
    );
  }
  ctx.stroke();
}

// Stable coastline — wobble is deterministic (seededRandom) so it doesn't
// jitter between frames. Use for all coastline and map edge drawing.
// seed: canonical tile-edge seed (seededRandom result). When provided the
// wobble is world-coordinate-stable (no camera wiggle). Falls back to
// screen-coordinate seeding only if seed is omitted.
export function coastLine(x1, y1, x2, y2, wobble = 1.5, seed = null) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const steps = Math.max(4, Math.floor(dist / 6));
  const base = seed !== null ? Math.round(seed * 99991) : null;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    let s1, s2;
    if (base !== null) {
      s1 = seededRandom(base + i * 7,  base + i * 11);
      s2 = seededRandom(base + i * 13, base + i * 3);
    } else {
      s1 = seededRandom(Math.round(x1 + i * 7.1),  Math.round(y1 + i * 13.3));
      s2 = seededRandom(Math.round(x1 + i * 11.7), Math.round(y1 + i * 5.9));
    }
    ctx.lineTo(
      x1 + (x2 - x1) * t + (s1 - 0.5) * wobble,
      y1 + (y2 - y1) * t + (s2 - 0.5) * wobble,
    );
  }
  ctx.stroke();
  ctx.restore();
}
