// Procedural top-down sheep, drawn as separate layers so the renderer can
// animate them (head turns, blinks, trotting legs) and so a wolf "tell" is
// just one layer drawn differently.
//
// Units: the sheep faces up (-y). Body centre is (0, 6); the neck pivot is at
// NECK. Head-layer painters draw in neck-local space (origin = neck).
//
// A `look` is plain data; docs/DESIGN.md shows the fields.

import { INK, INK_W, cloud, ellipse, inked, shadeInside, groundShadow, smoothClosed, fur } from './draw.js';
import { WOOL, FACE, HORN, HOOF, WOLF, EYE } from './palette.js';
import { paintWolfTail, paintWolfEar } from './wolf.js';

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
    // Wolf paws poke well out from under the fleece so the tell is visible.
    if (rear && paws) paintPaw(ctx, l.x * 1.15, y + 7, wolfFur(look));
    else paintHoof(ctx, l.x, y);
  }
}

function paintHoof(ctx, x, y) {
  const p = new Path2D();
  ellipse(p, x, y, 5.2, 6.4);
  inked(ctx, p, HOOF.base, INK_W * 0.8);
  shadeInside(ctx, p, { x, y, rx: 5.2, ry: 6.4 }, HOOF.shade, HOOF.light, 0.3);
  ctx.strokeStyle = HOOF.shade; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 1.5); ctx.lineTo(x, y + 6); ctx.stroke();
}

function paintPaw(ctx, x, y, f) {
  const p = new Path2D();
  ellipse(p, x, y, 6.8, 7.2);
  inked(ctx, p, f.base, INK_W * 0.85);
  shadeInside(ctx, p, { x, y, rx: 6.8, ry: 7.2 }, f.shade, f.light, 0.3);
  // White claws with ink, fanned out behind the paw.
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  for (const k of [-1, 0, 1]) {
    const cx = x + k * 3.6, cy = y + 6.2;
    ctx.beginPath();
    ctx.moveTo(cx - 1.7, cy - 1); ctx.lineTo(cx + k * 1.2, cy + 5.2); ctx.lineTo(cx + 1.7, cy - 1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

// --- tail ----------------------------------------------------------------------
export function paintTail(ctx, look, wag = 0) {
  ctx.save();
  ctx.translate(0, 40);
  ctx.rotate(wag * 0.35);
  if (look.tells?.tail === 'tip') {
    // Just the dark tip poking out from under the fleece, beside a normal puff.
    ctx.save(); ctx.translate(5, -6); ctx.rotate(-0.95);
    paintWolfTail(ctx, wolfFur(look), 0.6);
    ctx.restore();
    cloud(ctx, { x: 0, y: 6, rx: 8.5, ry: 8.5, lobes: 6, lobeR: 4.2, seed: 11 }, woolOf(look), INK_W * 0.9);
  } else if (look.tells?.tail) {
    ctx.rotate(0.35);
    paintWolfTail(ctx, wolfFur(look), 0.82);
  } else {
    cloud(ctx, { x: 0, y: 6, rx: 8.5, ry: 8.5, lobes: 6, lobeR: 4.2, seed: 11 }, woolOf(look), INK_W * 0.9);
  }
  ctx.restore();
}

// --- body --------------------------------------------------------------------
export function paintBody(ctx, look) {
  const pal = woolOf(look);
  const { path } = cloud(ctx, {
    x: 0, y: 6, rx: 31, ry: 37, lobes: 15, lobeR: 10.5, jitter: 0.2,
    seed: look.woolSeed || 7, curls: 7, curlR: 7.4,
  }, pal);
  if (look.tells?.patch) paintFurPatch(ctx, path, look.tells.patch, wolfFur(look), pal);
  if (look.tells?.tint) {
    // A costume that's ever so slightly off-colour.
    ctx.save(); ctx.clip(path);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = look.tells.tint;
    ctx.fillRect(-60, -60, 120, 130);
    ctx.restore();
  }
}

// A rip in the fleece with grey wolf fur poking through: spiky fur edge, a
// shadow where the wool overhangs it, fur strokes. No sticker-like outline.
function paintFurPatch(ctx, bodyPath, where, f, wool) {
  const spots = { left: [-14, 10], right: [14, 16], rump: [2, 28], back: [-4, -6] };
  const [x, y] = spots[where] || spots.left;
  ctx.save();
  ctx.clip(bodyPath);
  // Wool rim shadow first (the torn edge sits lower than the fleece).
  const rimPts = smoothClosed([[x, y - 11.5, 0], [x + 12, y - 4, 0], [x + 10, y + 8, 0], [x - 2, y + 10.5, 0], [x - 12, y + 4, 0], [x - 11, y - 7, 0]], 4);
  ctx.fillStyle = wool.shade;
  ctx.fill(fur(rimPts, 3));
  const pts = smoothClosed([[x, y - 9, 2.6], [x + 10, y - 3, 2.8], [x + 8, y + 6.5, 2.4], [x - 2, y + 8.5, 2.6], [x - 10, y + 3, 2.8], [x - 9, y - 6, 2.4]], 4);
  const hole = fur(pts, 17);
  ctx.fillStyle = f.base; ctx.fill(hole);
  ctx.save(); ctx.clip(hole);
  ctx.fillStyle = f.dark;
  ctx.beginPath(); ctx.ellipse(x - 1, y - 9, 14, 6, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = f.light;
  ctx.beginPath(); ctx.ellipse(x - 2, y + 2, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = f.dark; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [dx, dy] of [[-5, 1], [0, 3], [5, 0], [1, -3]]) {
    ctx.beginPath(); ctx.moveTo(x + dx - 2, y + dy - 2); ctx.lineTo(x + dx, y + dy + 1.2); ctx.lineTo(x + dx + 2, y + dy - 2); ctx.stroke();
  }
  ctx.restore();
}

// --- head (neck-local) ----------------------------------------------------------
// A tapered wedge: wide at the crown, narrowing to the muzzle. `tip` is how far
// forward the muzzle reaches (a wolf snout reaches further and narrower).
function headPath(tip = -31, muzzle = 6.5) {
  const p = new Path2D();
  p.moveTo(0, -1);
  p.bezierCurveTo(-8, -1, -12, -6, -11.5, -13);
  p.bezierCurveTo(-11, -19, -muzzle - 2, tip + 6, -muzzle + 1, tip + 1.5);
  p.bezierCurveTo(-muzzle + 3, tip - 1.2, muzzle - 3, tip - 1.2, muzzle - 1, tip + 1.5);
  p.bezierCurveTo(muzzle + 2, tip + 6, 11, -19, 11.5, -13);
  p.bezierCurveTo(12, -6, 8, -1, 0, -1);
  p.closePath();
  return p;
}

// Everything above the shoulders except the eyes, which blink independently.
export function paintHead(ctx, look) {
  const face = faceOf(look);
  const t = look.tells || {};
  const wf = wolfFur(look);

  // Ears go under the head.
  paintEar(ctx, look, -1, t.earL || t.ears);
  paintEar(ctx, look, 1, t.earR || t.ears);
  if (look.horns === 'curl') { paintHorn(ctx, -1); paintHorn(ctx, 1); }

  const wolfSnout = t.muzzle === 'wolf';
  const tip = wolfSnout ? -36 : -31;
  const head = headPath(tip, wolfSnout ? 5.2 : 6.5);
  inked(ctx, head, face.base);
  shadeInside(ctx, head, { x: 0, y: -15, rx: 11.5, ry: 17 }, face.shade, face.light, 0.22);

  ctx.save(); ctx.clip(head);
  if (wolfSnout) {
    // Grey fur creeping up the muzzle, blended rather than a separate cone.
    const g = ctx.createLinearGradient(0, tip, 0, -16);
    g.addColorStop(0, wf.base); g.addColorStop(0.65, wf.base); g.addColorStop(1, wf.base + '00');
    ctx.fillStyle = g;
    ctx.fillRect(-12, tip - 2, 24, 22);
  } else {
    const m = new Path2D(); ellipse(m, 0, tip + 4.5, 6, 4.6);
    ctx.fillStyle = face.muzzle; ctx.fill(m);
  }
  ctx.restore();

  if (wolfSnout || t.nose === 'black') {
    const nose = new Path2D(); ellipse(nose, 0, tip + 2.2, 4.9, 3.2);
    inked(ctx, nose, '#1c1f2b', 0.9);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(-1.5, tip + 1.3, 1, 0, Math.PI * 2); ctx.fill();
    if (wolfSnout) {
      ctx.fillStyle = wf.dark;
      for (const side of [-1, 1]) for (const [dx, dy] of [[3.2, 7], [3.9, 9.5]]) {
        ctx.beginPath(); ctx.arc(side * dx, tip + dy, 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else {
    ctx.fillStyle = INK;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * 2.4, tip + 2.6, 1.1, 1.6, s * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (t.fang) {
    // Two big fangs jutting out from the sides of the mouth.
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
    const fy = tip + 7;
    for (const side of [-1, 1]) {
      const fx = side * (wolfSnout ? 5 : 6.2);
      ctx.beginPath();
      ctx.moveTo(fx - side * 0.6, fy - 2.8); ctx.lineTo(fx + side * 6.2, fy + 1.2); ctx.lineTo(fx - side * 0.2, fy + 2.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // Woolly cap at the back of the crown, kept clear of the eyes.
  if (look.tuft !== false) {
    cloud(ctx, { x: 0, y: -1, rx: 10, ry: 6, lobes: 7, lobeR: 3.9, seed: 23 }, woolOf(look), INK_W * 0.85);
  }
}

function paintEar(ctx, look, side, kind) {
  const face = faceOf(look);
  ctx.save();
  if (kind === 'wolf') {
    // Tall, pointed and upright: not a sheep ear at all.
    ctx.translate(side * 8.5, -9);
    ctx.rotate(side * 0.5);
    paintWolfEar(ctx, wolfFur(look));
  } else {
    ctx.translate(side * 8.5, -8);
    const droop = kind === 'droop' || look.ears === 'droop';
    ctx.rotate(side * (droop ? 2.35 : 1.75));
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
  // A ram's curl: tapered spiral sweeping back and round, filled as one shape
  // so it narrows to a point; ridges follow the curl.
  ctx.save();
  ctx.translate(side * 9.5, -8);
  ctx.scale(side, 1);
  const N = 44, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = -2.0 + t * 5.0;
    const r = 11.5 * (1 - t * 0.7);
    pts.push({ x: 5 + Math.cos(a) * r + t * 2, y: 6 + Math.sin(a) * r, w: 5.2 - t * 3.3 });
  }
  const outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i], q = pts[Math.min(N, i + 1)], o = pts[Math.max(0, i - 1)];
    const dx = q.x - o.x, dy = q.y - o.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    outer.push([p.x - nx * p.w, p.y - ny * p.w]);
    inner.push([p.x + nx * p.w, p.y + ny * p.w]);
  }
  const shape = new Path2D();
  outer.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i][0], inner[i][1]);
  shape.closePath();
  inked(ctx, shape, HORN.base);
  ctx.save(); ctx.clip(shape);
  // inner shade
  ctx.strokeStyle = HORN.shade; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); inner.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  // bright rim on the outer edge only
  ctx.strokeStyle = HORN.light; ctx.lineWidth = 2.2;
  ctx.beginPath(); outer.slice(2, 30).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  // curved ridges following the curl
  ctx.strokeStyle = HORN.shade; ctx.lineWidth = 1.1;
  for (let i = 5; i < N - 6; i += 5) {
    const a = outer[i], b = inner[i], c = pts[i + 2];
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c.x, c.y, b[0], b[1]); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

// --- eyes (neck-local) -------------------------------------------------------------
// state: 'open' | 'half' | 'closed'. look.eyes picks the resting style.
// Small and side-set like the reference, forward of the crown wool.
export function paintEyes(ctx, look, state = 'open', gaze = 0) {
  const t = look.tells || {};
  const style = look.eyes || 'open';
  const lid = state === 'closed' ? 1 : state === 'half' || style === 'sleepy' ? 0.5 : 0;
  for (const side of [-1, 1]) {
    const x = side * 7.9, y = -16;
    const wolfEye = t.eyes === 'wolf' || (t.eyes === 'wolfL' && side === -1);
    const rx = 3.2, ry = 3.7;
    if (lid >= 1) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y - 1, 2.9, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    } else {
      const e = new Path2D(); ellipse(e, x, y, rx, ry);
      inked(ctx, e, wolfEye ? EYE.wolf : EYE.white, 1.3);
      ctx.save(); ctx.clip(e);
      if (wolfEye) {
        ctx.fillStyle = EYE.wolfRim; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.ellipse(x + 1, y + 1.4, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = EYE.pupil;
        ctx.beginPath(); ctx.ellipse(x + gaze, y - 0.4, 0.95, 2.9, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = EYE.pupil;
        ctx.beginPath(); ctx.arc(x + side * 0.5 + gaze, y - 0.9, 2.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + side * 0.5 + gaze - 0.8, y - 1.8, 0.75, 0, Math.PI * 2); ctx.fill();
      }
      if (lid > 0) {
        const edge = y + ry - ry * 2 * (1 - lid);
        ctx.fillStyle = faceOf(look).base;
        ctx.fillRect(x - rx - 1, edge - ry * 2, rx * 2 + 2, ry * 2);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x - rx, edge); ctx.lineTo(x + rx, edge); ctx.stroke();
      }
      ctx.restore();
    }
    if (t.brows) {
      // Heavy scowl: inner ends dip toward the eyes.
      ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + side * 4.6, y - 7.6); ctx.lineTo(x - side * 3.6, y - 4.4); ctx.stroke();
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
