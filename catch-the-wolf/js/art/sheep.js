// Procedural top-down sheep, drawn as separate layers so the renderer can
// animate them (head turns, blinks, ear flicks, trotting legs) and so a wolf
// "tell" is just one layer drawn differently.
//
// Units: the sheep faces up (-y). Body centre is (0, 6); the neck pivot is at
// NECK. Head-layer painters draw in neck-local space (origin = neck).
//
// A `look` is plain data — see js/game/looks.js for the full field list.

import { INK, INK_W, cloud, circle, ellipse, inked, shadeInside, groundShadow } from './draw.js';
import { WOOL, FACE, HORN, HOOF, WOLF, EYE } from './palette.js';

export const NECK = { x: 0, y: -27 };
export const HEAD_SCALE = 1.22;
export const BOX = { x: -52, y: -66, w: 104, h: 132 }; // generous sprite bounds

const woolOf = (look) => WOOL[look.wool] || WOOL.cream;
const faceOf = (look) => FACE[look.face] || FACE.cream;
const wolfFur = (look) => WOLF[look.wolfFur] || WOLF.grey;

// --- shadow ----------------------------------------------------------------
export function paintShadow(ctx) {
  groundShadow(ctx, 3, 12, 37, 42, 0.26);
}

// --- legs --------------------------------------------------------------------
// `step` in [-1, 1] swings diagonal pairs for a trot.
export function paintLegs(ctx, look, step = 0) {
  const legs = [
    { x: -15, y: -16, s: step }, { x: 15, y: -16, s: -step },
    { x: -14, y: 34, s: -step }, { x: 14, y: 34, s: step },
  ];
  const paws = look.tells?.paws;
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    const rear = i >= 2;
    const y = l.y + l.s * 5 + (rear ? 6 : -6);
    if (rear && paws) paintPaw(ctx, l.x, y + 2, wolfFur(look), l.x < 0 ? -1 : 1);
    else paintHoof(ctx, l.x, y);
  }
}

function paintHoof(ctx, x, y) {
  const p = new Path2D();
  ellipse(p, x, y, 5.2, 6.4);
  inked(ctx, p, HOOF.base, INK_W * 0.8);
  shadeInside(ctx, p, { x, y, rx: 5.2, ry: 6.4 }, HOOF.shade, HOOF.light, 0.3);
  // the cleft
  ctx.strokeStyle = HOOF.shade; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 1.5); ctx.lineTo(x, y + 6); ctx.stroke();
}

function paintPaw(ctx, x, y, fur, side) {
  const p = new Path2D();
  ellipse(p, x, y, 6.6, 7.4);
  inked(ctx, p, fur.base, INK_W * 0.8);
  shadeInside(ctx, p, { x, y, rx: 6.6, ry: 7.4 }, fur.shade, fur.light, 0.3);
  // three claws poking out the back
  ctx.fillStyle = '#f4f0e6';
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
  for (let k = -1; k <= 1; k++) {
    const cx = x + k * 3, cy = y + 7;
    ctx.beginPath();
    ctx.moveTo(cx - 1.4, cy - 1); ctx.lineTo(cx + side * 0.4, cy + 4.2); ctx.lineTo(cx + 1.4, cy - 1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

// --- tail ----------------------------------------------------------------------
export function paintTail(ctx, look, wag = 0) {
  ctx.save();
  ctx.translate(0, 40);
  ctx.rotate(wag * 0.35);
  if (look.tells?.tail) paintWolfTail(ctx, wolfFur(look));
  else cloud(ctx, { x: 0, y: 6, rx: 8.5, ry: 8.5, lobes: 6, lobeR: 4.2, seed: 11 }, woolOf(look), INK_W * 0.9);
  ctx.restore();
}

function paintWolfTail(ctx, fur) {
  // Bushy and long — trails out from under the fleece, curving to one side.
  const p = new Path2D();
  p.moveTo(-6, -2);
  p.bezierCurveTo(-12, 10, -10, 22, -2, 30);
  p.bezierCurveTo(4, 35, 14, 33, 16, 25);
  p.bezierCurveTo(12, 27, 8, 22, 9, 14);
  p.bezierCurveTo(10, 6, 8, 0, 6, -2);
  p.closePath();
  inked(ctx, p, fur.base);
  shadeInside(ctx, p, { x: 2, y: 14, rx: 14, ry: 18 }, fur.shade, fur.light, 0.3);
  // pale tip
  ctx.save(); ctx.clip(p);
  const tip = new Path2D(); ellipse(tip, 6, 31, 11, 7, -0.4);
  ctx.fillStyle = fur.pale; ctx.fill(tip);
  ctx.restore();
  // fur flicks
  ctx.strokeStyle = fur.shade; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  for (const [x1, y1, x2, y2] of [[-5, 8, -2, 12], [-4, 16, -1, 20], [3, 12, 5, 17]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
}

// --- body --------------------------------------------------------------------
export function paintBody(ctx, look) {
  const pal = woolOf(look);
  const { path } = cloud(ctx, {
    x: 0, y: 6, rx: 31, ry: 37, lobes: 15, lobeR: 10.5, jitter: 0.2,
    seed: look.woolSeed || 7, curls: 7, curlR: 7.4,
  }, pal);
  if (look.tells?.patch) paintFurPatch(ctx, path, look.tells.patch, wolfFur(look));
  if (look.tells?.tint) {
    // A costume that's ever so slightly off-colour.
    ctx.save(); ctx.clip(path);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = look.tells.tint;
    ctx.fillRect(-60, -60, 120, 130);
    ctx.restore();
  }
}

// A rip in the fleece with grey wolf fur showing through.
function paintFurPatch(ctx, bodyPath, where, fur) {
  const spots = { left: [-15, 10], right: [15, 16], rump: [2, 28], back: [-4, -6] };
  const [x, y] = spots[where] || spots.left;
  ctx.save();
  ctx.clip(bodyPath);
  // The hole: an irregular oval of grey fur, shaded darker at the top where
  // the wool overhangs it.
  const hole = new Path2D();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + (i % 3 === 0 ? 0.18 : i % 2 ? -0.08 : 0.06);
    const px = x + Math.cos(a) * 9.5 * r, py = y + Math.sin(a) * 7.5 * r;
    i ? hole.lineTo(px, py) : hole.moveTo(px, py);
  }
  hole.closePath();
  inked(ctx, hole, fur.base, INK_W * 0.75);
  ctx.save(); ctx.clip(hole);
  ctx.fillStyle = fur.shade;
  ctx.beginPath(); ctx.ellipse(x - 1, y - 6.5, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Fur strands.
  ctx.strokeStyle = fur.dark; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  for (const [dx, dy] of [[-5, 0], [-1, 2], [3, -1], [5, 3], [0, 5]]) {
    ctx.beginPath(); ctx.moveTo(x + dx, y + dy - 1.5); ctx.quadraticCurveTo(x + dx + 1.5, y + dy, x + dx + 0.8, y + dy + 2.2); ctx.stroke();
  }
  ctx.restore();
}

// --- head (neck-local) ----------------------------------------------------------
// Everything above the shoulders except the eyes, which blink independently.
export function paintHead(ctx, look) {
  const face = faceOf(look);
  const t = look.tells || {};

  // Ears go under the head.
  paintEar(ctx, look, -1, t.earL || t.ears);
  paintEar(ctx, look, 1, t.earR || t.ears);
  if (look.horns === 'curl') { paintHorn(ctx, -1); paintHorn(ctx, 1); }

  // Skull + muzzle as one silhouette.
  const wolfSnout = t.muzzle === 'wolf';
  const head = new Path2D();
  ellipse(head, 0, -11, 11.5, 14.5);
  if (wolfSnout) {
    head.moveTo(-7, -18);
    head.bezierCurveTo(-6.5, -30, -3.5, -35, 0, -35.5);
    head.bezierCurveTo(3.5, -35, 6.5, -30, 7, -18);
    head.closePath();
  } else {
    ellipse(head, 0, -21, 9, 8);
  }
  inked(ctx, head, face.base);
  shadeInside(ctx, head, { x: 0, y: -15, rx: 11.5, ry: 18 }, face.shade, face.light, 0.22);

  if (wolfSnout) {
    const fur = wolfFur(look);
    ctx.save(); ctx.clip(head);
    const s = new Path2D(); ellipse(s, 0, -29, 8, 9);
    ctx.fillStyle = fur.base; ctx.fill(s);
    ctx.restore();
    const nose = new Path2D(); ellipse(nose, 0, -33.4, 3.6, 2.6);
    inked(ctx, nose, '#1c1f2b', 0.8);
  } else {
    // Soft pink muzzle and nostrils.
    ctx.save(); ctx.clip(head);
    const m = new Path2D(); ellipse(m, 0, -24, 7.4, 5.4);
    ctx.fillStyle = face.muzzle; ctx.fill(m);
    ctx.restore();
    if (t.nose === 'black') {
      const nose = new Path2D(); ellipse(nose, 0, -26.2, 3.8, 2.6);
      inked(ctx, nose, '#1c1f2b', 0.8);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(-1.2, -27, 0.9, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(s * 2.8, -26, 1.1, 1.7, s * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  if (t.fang) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      const fx = side * (wolfSnout ? 6.4 : 8.6), fy = wolfSnout ? -26 : -23;
      ctx.beginPath(); ctx.moveTo(fx - side * 2.2, fy - 1.5); ctx.lineTo(fx + side * 2.2, fy - 1.5); ctx.lineTo(fx + side * 3.6, fy + 5); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }

  // Woolly fringe on the crown.
  if (look.tuft !== false) {
    cloud(ctx, { x: 0, y: -3, rx: 10.5, ry: 7.5, lobes: 7, lobeR: 4.4, seed: 23 }, woolOf(look), INK_W * 0.85);
  }
}

function paintEar(ctx, look, side, kind) {
  const face = faceOf(look);
  ctx.save();
  ctx.translate(side * 8.5, -9);
  if (kind === 'wolf') {
    // Tall, pointed and upright — not a sheep ear at all.
    const fur = wolfFur(look);
    ctx.rotate(side * 0.55);
    const p = new Path2D();
    p.moveTo(-5.5, 3); p.quadraticCurveTo(-4, -8, 0, -15); p.quadraticCurveTo(4, -8, 5.5, 3); p.closePath();
    inked(ctx, p, fur.base);
    const inner = new Path2D();
    inner.moveTo(-2.6, 1.5); inner.quadraticCurveTo(-1.8, -5, 0, -10); inner.quadraticCurveTo(1.8, -5, 2.6, 1.5); inner.closePath();
    ctx.fillStyle = fur.dark; ctx.fill(inner);
  } else {
    const droop = kind === 'droop' || look.ears === 'droop';
    ctx.rotate(side * (droop ? 2.2 : 1.45));
    const p = new Path2D();
    p.moveTo(0, 2);
    p.bezierCurveTo(-7, -2, -6.5, -15, 0, -19);
    p.bezierCurveTo(6.5, -15, 7, -2, 0, 2);
    inked(ctx, p, face.base);
    const inner = new Path2D();
    inner.moveTo(0, -1); inner.bezierCurveTo(-3.6, -3, -3.4, -12, 0, -15);
    inner.bezierCurveTo(3.4, -12, 3.6, -3, 0, -1);
    ctx.fillStyle = face.inner; ctx.fill(inner);
  }
  ctx.restore();
}

function paintHorn(ctx, side) {
  // A thick curl sweeping back and round, like the reference ram.
  ctx.save();
  ctx.translate(side * 10, -8);
  ctx.scale(side, 1);
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = -2.2 + t * 4.9;
    const r = 11.5 * (1 - t * 0.62);
    pts.push([4 + Math.cos(a) * r + t * 3, 7 + Math.sin(a) * r]);
  }
  const stroke = (w, col) => {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };
  stroke(9.5 + INK_W * 2, INK);
  stroke(9.5, HORN.base);
  ctx.save(); ctx.translate(-0.8, -0.8); stroke(3.4, HORN.light); ctx.restore();
  // ridges
  ctx.strokeStyle = HORN.shade; ctx.lineWidth = 1.2;
  for (let i = 4; i < 36; i += 5) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const dx = nx - x, dy = ny - y, len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 4, oy = (dx / len) * 4;
    ctx.beginPath(); ctx.moveTo(x - ox, y - oy); ctx.lineTo(x + ox, y + oy); ctx.stroke();
  }
  ctx.restore();
}

// --- eyes (neck-local) -------------------------------------------------------------
// state: 'open' | 'half' | 'closed'. look.eyes picks the resting style.
export function paintEyes(ctx, look, state = 'open', gaze = 0) {
  const t = look.tells || {};
  const style = look.eyes || 'open';
  const lid = state === 'closed' ? 1 : state === 'half' || style === 'sleepy' ? 0.5 : 0;
  for (const side of [-1, 1]) {
    const x = side * 7.6, y = -13.5;
    const wolfEye = t.eyes === 'wolf';
    const rx = 3.9, ry = 4.6;
    if (lid >= 1) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y - 1, 3.4, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
      continue;
    }
    const e = new Path2D(); ellipse(e, x, y, rx, ry);
    inked(ctx, e, wolfEye ? EYE.wolf : EYE.white, 1.3);
    ctx.save(); ctx.clip(e);
    if (wolfEye) {
      ctx.fillStyle = EYE.wolfRim;
      ctx.beginPath(); ctx.ellipse(x + 1, y + 1.4, rx, ry, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = EYE.pupil;
      ctx.beginPath(); ctx.ellipse(x + gaze * 1.2, y - 0.6, 1.05, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = EYE.pupil;
      ctx.beginPath(); ctx.arc(x + side * 0.6 + gaze * 1.3, y - 1.2, 2.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + side * 0.6 + gaze * 1.3 - 0.9, y - 2.2, 0.9, 0, Math.PI * 2); ctx.fill();
    }
    if (lid > 0) {
      const lidCol = faceOf(look).base;
      ctx.fillStyle = lidCol;
      ctx.fillRect(x - rx - 1, y + ry - ry * 2 * (1 - lid) - ry * 2, rx * 2 + 2, ry * 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - rx, y + ry - ry * 2 * (1 - lid)); ctx.lineTo(x + rx, y + ry - ry * 2 * (1 - lid)); ctx.stroke();
    }
    ctx.restore();
    if (t.brows) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + side * 5, y - 8.5); ctx.lineTo(x - side * 3.2, y - 4.4); ctx.stroke();
    }
  }
}

// Convenience: the whole sheep in one go (gallery, thumbnails, shop icons).
export function paintSheep(ctx, look, pose = {}) {
  const { step = 0, headAngle = 0, eyes = 'open', wag = 0 } = pose;
  paintShadow(ctx);
  paintLegs(ctx, look, step);
  paintTail(ctx, look, wag);
  paintBody(ctx, look);
  ctx.save();
  ctx.translate(NECK.x, NECK.y);
  ctx.rotate(headAngle);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);
  paintHead(ctx, look);
  paintEyes(ctx, look, eyes);
  ctx.restore();
}

export { circle };
