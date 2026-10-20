// The "here's what you missed" picture: a real sheep beside the wolf in the
// same costume, with the slip circled on the wolf. Shown on the miss panel.

import { paintSheep } from './sheep.js';
import { INK } from './draw.js';

const PATCH_SPOTS = { left: { x: -14, y: 10 }, right: { x: 14, y: 16 }, rump: { x: 2, y: 28 }, back: { x: -4, y: -6 } };

// Where each tell sits on a sheep (sheep units, facing up) and how big a ring
// it needs. Head positions account for the neck offset and head scale.
function tellSpot(t) {
  if (t.tail === 'tip') return { x: 18, y: 50, r: 15 };
  if (t.tail) return { x: -9, y: 60, r: 22 };
  if (t.ears) return { x: 0, y: -48, r: 30 };
  if (t.earL) return { x: -13, y: -48, r: 15 };
  if (t.earR) return { x: 13, y: -48, r: 15 };
  if (t.muzzle) return { x: 0, y: -68, r: 14 };
  if (t.eyes === 'wolfL') return { x: -9.6, y: -46.5, r: 10 };
  if (t.eyes) return { x: 0, y: -46.5, r: 18 };
  if (t.paws) return { x: 0, y: 55, r: 25 };
  if (t.patch) return { ...(PATCH_SPOTS[t.patch] || PATCH_SPOTS.left), r: 16 };
  if (t.fang) return { x: 0, y: -56, r: 16 };
  if (t.brows) return { x: 0, y: -54, r: 17 };
  if (t.nose) return { x: 0, y: -62, r: 10 };
  if (t.tint) return { x: 0, y: 4, r: 46 };
  return { x: 0, y: 0, r: 50 };
}

export function tellCardURL(look) {
  const W = 360, H = 240, S = 1.25, scale = 2;
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  const { tells, ...plain } = look;
  const sheepAt = (x, l) => { ctx.save(); ctx.translate(x, 104); ctx.scale(S, S); paintSheep(ctx, l); ctx.restore(); };
  sheepAt(95, plain);
  sheepAt(265, look);
  // Ring the slip on the wolf (dashed white under solid red for contrast).
  const s = tellSpot(tells || {});
  const cx = 265 + s.x * S, cy = 104 + s.y * S, r = s.r * S + 6;
  ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = '#ee5b3f';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // Labels under each.
  ctx.font = '400 18px "Lilita One", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 5; ctx.strokeStyle = INK;
  for (const [x, text, col] of [[95, 'Sheep', '#ffffff'], [265, 'Wolf', '#ffb4a6']]) {
    ctx.strokeText(text, x, 232); ctx.fillStyle = col; ctx.fillText(text, x, 232);
  }
  const url = c.toDataURL();
  c.width = 0; c.height = 0;
  return url;
}
