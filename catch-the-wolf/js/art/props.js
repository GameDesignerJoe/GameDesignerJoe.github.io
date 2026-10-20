// Farm goodies: food that sheep flock to and toys they bump around. Same ink
// style as everything else. Painters take `left` (0..1 of the food remaining)
// or `roll` (radians the ball has turned) so they can animate.

import { INK, ellipse, inked, cloud, rng } from './draw.js';

// A patch of clover. Fewer leaves remain as it's eaten.
export function paintClover(ctx, left = 1) {
  const r = rng(5);
  ctx.fillStyle = 'rgba(22,40,30,0.22)';
  ctx.beginPath(); ctx.ellipse(3, 4, 24, 16, 0, 0, Math.PI * 2); ctx.fill();
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 16;
    spots.push([Math.cos(a) * d, Math.sin(a) * d * 0.7, 0.8 + r() * 0.4, r() * 6]);
  }
  const n = Math.max(1, Math.ceil(spots.length * left));
  spots.slice(0, n).sort((a, b) => a[1] - b[1]).forEach(([x, y, s, rot]) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    const leaf = new Path2D();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      ellipse(leaf, Math.cos(a) * 4.2, Math.sin(a) * 4.2, 4.4, 4.4);
    }
    inked(ctx, leaf, '#58b23a', 1.6);
    ctx.fillStyle = '#86d65c';
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 4.2 - 0.8, Math.sin(a) * 4.2 - 1, 1.8, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
  // a couple of pink clover flowers
  if (left > 0.4) {
    for (const [x, y] of [[-6, -6], [9, 2]]) {
      const f = new Path2D(); ellipse(f, x, y, 3.6, 3.6);
      inked(ctx, f, '#f29bc4', 1.3);
      ctx.fillStyle = '#ffd1e6'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// A loose heap of hay: a jagged straw mound built from layered strands, so it
// can't be mistaken for fleece. It shrinks as it's eaten.
export function paintHayPile(ctx, left = 1) {
  const s = 0.45 + 0.55 * left;
  const r = rng(8);
  ctx.save(); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(22,40,30,0.25)';
  ctx.beginPath(); ctx.ellipse(4, 7, 33, 20, 0, 0, Math.PI * 2); ctx.fill();
  // Spiky silhouette: straws sticking out all round the mound.
  const mound = new Path2D();
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 2 ? 1 : 1.18 + r() * 0.16;
    const x = Math.cos(a) * 29 * rr, y = Math.sin(a) * 18 * rr - 2;
    i ? mound.lineTo(x, y) : mound.moveTo(x, y);
  }
  mound.closePath();
  inked(ctx, mound, '#d9ac3c', 2.6);
  ctx.save(); ctx.clip(mound);
  // Lit top, shaded base.
  ctx.fillStyle = '#efcb5c';
  ctx.beginPath(); ctx.ellipse(-3, -6, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f9e290';
  ctx.beginPath(); ctx.ellipse(-8, -10, 13, 6, -0.2, 0, Math.PI * 2); ctx.fill();
  // Criss-crossed strands in three tones.
  ctx.lineCap = 'round';
  for (const [col, w, count] of [['#b8892a', 1.3, 26], ['#e4bb4a', 1.4, 22], ['#fff0b0', 1.1, 12]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * 54, y = (r() - 0.5) * 32 - 2, a = (r() - 0.5) * 1.6 + (r() < 0.5 ? 0 : Math.PI);
      const len = 6 + r() * 9;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.6); ctx.stroke();
    }
  }
  ctx.restore();
  // Stray straws on the grass.
  ctx.strokeStyle = '#d9b445'; ctx.lineWidth = 1.5;
  for (const [x1, y1, x2, y2] of [[-38, 10, -30, 6], [32, 12, 40, 8], [-12, 24, -5, 27], [16, 22, 24, 25], [-30, -14, -36, -18]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}

// Red rubber ball with a white star that turns as it rolls.
export function paintBall(ctx, roll = 0, r = 12) {
  ctx.fillStyle = 'rgba(22,40,30,0.28)';
  ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.45, r * 1.05, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  const b = new Path2D(); ellipse(b, 0, 0, r, r);
  inked(ctx, b, '#e8483b', 2.6);
  ctx.save(); ctx.clip(b);
  ctx.fillStyle = '#b8302a';
  ctx.beginPath(); ctx.ellipse(r * 0.35, r * 0.4, r * 1.0, r * 0.95, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
  ctx.rotate(roll);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.22 : r * 0.5;
    i ? ctx.lineTo(Math.cos(a) * rr + r * 0.15, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr + r * 0.15, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
}

// Striped beach ball: six coloured wedges around a white cap.
export function paintBeachBall(ctx, roll = 0, r = 18) {
  ctx.fillStyle = 'rgba(22,40,30,0.28)';
  ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.45, r * 1.05, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  const b = new Path2D(); ellipse(b, 0, 0, r, r);
  inked(ctx, b, '#ffffff', 2.8);
  ctx.save(); ctx.clip(b);
  const cols = ['#ee5b3f', '#ffffff', '#f7c548', '#ffffff', '#69b7e6', '#ffffff'];
  for (let i = 0; i < 6; i++) {
    const a0 = roll + (i / 6) * Math.PI * 2, a1 = roll + ((i + 1) / 6) * Math.PI * 2;
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r + 2, a0, a1); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(30,40,70,0.12)';
  ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.5, r, r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const cap = new Path2D(); ellipse(cap, 0, 0, r * 0.22, r * 0.22);
  inked(ctx, cap, '#ffffff', 1.4);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke(b);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.48, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2); ctx.fill();
}

export const ITEM_PAINTERS = {
  clover: (ctx, s) => paintClover(ctx, s.left ?? 1),
  hay: (ctx, s) => paintHayPile(ctx, s.left ?? 1),
  ball: (ctx, s) => paintBall(ctx, s.roll ?? 0, s.r ?? 12),
  beachball: (ctx, s) => paintBeachBall(ctx, s.roll ?? 0, s.r ?? 18),
};
