// The wolf, unmasked. Top-down, facing up, same units as the sheep. Built from
// fur-edged outlines (draw.js fur()) so every silhouette has the jagged tufts
// of the reference wolves. `pose.run` in [-1, 1] swings the legs for a gallop;
// `pose.look` = 'up' turns the face to the player (the guilty look).
//
// paintWolfTail / paintWolfEar are shared with the sheep "tells", so a
// disguise's slip uses exactly the same art as the real wolf.

import { INK_W, ellipse, inked, smoothClosed, fur } from './draw.js';
import { WOLF, EYE } from './palette.js';

// Shade a fur shape: darker lower-right band, lighter upper-left band.
function furShade(ctx, path, f, box) {
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = f.shade;
  ctx.beginPath(); ctx.ellipse(box.x + box.rx * 0.45, box.y + box.ry * 0.3, box.rx * 0.9, box.ry * 1.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = f.base;
  ctx.beginPath(); ctx.ellipse(box.x - box.rx * 0.12, box.y - box.ry * 0.08, box.rx * 0.95, box.ry * 1.0, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Short fur strokes (little V tufts) inside a shape.
function tufts(ctx, list, col, w = 1.3) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [x, y, s = 1, a = 0] of list) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-2.4, -2.2); ctx.lineTo(0, 1.6); ctx.lineTo(2.4, -2.2); ctx.stroke();
    ctx.restore();
  }
}

// Bushy plume, base at (0,0), trailing down +y about 50 units.
export function paintWolfTail(ctx, f, len = 1) {
  const L = 50 * len;
  const pts = smoothClosed([
    [-5, 0, 0], [-8.5, L * 0.22, 2.6], [-11, L * 0.5, 3.4], [-9.5, L * 0.78, 3], [-3, L * 0.98, 2.4],
    [3, L * 0.98, 2.4], [9.5, L * 0.78, 3], [11, L * 0.5, 3.4], [8.5, L * 0.22, 2.6], [5, 0, 0],
  ], 3);
  const p = fur(pts, 41, 1.3);
  inked(ctx, p, f.base);
  furShade(ctx, p, f, { x: 0, y: L * 0.5, rx: 11, ry: L * 0.5 });
  // dark tip + spine streak
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = f.dark;
  ctx.beginPath(); ctx.ellipse(0, L * 0.98, 9, L * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = f.mid;
  ctx.beginPath(); ctx.ellipse(-1, L * 0.45, 3.2, L * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  tufts(ctx, [[-5, L * 0.3, 0.9], [4, L * 0.42, 0.9], [-4, L * 0.6, 0.9], [3, L * 0.7, 0.8]], f.shade);
}

// Tall pointed ear, base centred at (0,0), tip at about (0,-17).
export function paintWolfEar(ctx, f) {
  const p = new Path2D();
  p.moveTo(-7, 3); p.quadraticCurveTo(-6, -8, 0, -17.5); p.quadraticCurveTo(6, -8, 7, 3); p.closePath();
  inked(ctx, p, f.base);
  const inner = new Path2D();
  inner.moveTo(-3.6, 1.5); inner.quadraticCurveTo(-3, -5.5, 0, -12); inner.quadraticCurveTo(3, -5.5, 3.6, 1.5); inner.closePath();
  ctx.fillStyle = f.pale; ctx.fill(inner);
  ctx.strokeStyle = f.shade; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(-0.5, -6); ctx.moveTo(1.5, 0); ctx.lineTo(0.5, -6); ctx.stroke();
}

function paintLeg(ctx, f, hip, paw, front) {
  // Tapered leg from hip to paw, then a paw with three toe beans.
  const dx = paw[0] - hip[0], dy = paw[1] - hip[1], len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const leg = new Path2D();
  leg.moveTo(hip[0] + nx * 5.5, hip[1] + ny * 5.5);
  leg.lineTo(paw[0] + nx * 3.6, paw[1] + ny * 3.6);
  leg.lineTo(paw[0] - nx * 3.6, paw[1] - ny * 3.6);
  leg.lineTo(hip[0] - nx * 5.5, hip[1] - ny * 5.5);
  leg.closePath();
  inked(ctx, leg, f.shade, INK_W * 0.85);
  const pw = new Path2D(); ellipse(pw, paw[0], paw[1], 5.6, 6);
  inked(ctx, pw, f.base, INK_W * 0.85);
  const dir = front ? -1 : 1; // toes point away from the body
  ctx.fillStyle = f.dark;
  for (const k of [-2.6, 0, 2.6]) {
    ctx.beginPath(); ctx.ellipse(paw[0] + k, paw[1] + dir * (k === 0 ? 3.6 : 2.8), 1.25, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export function paintWolf(ctx, furName = 'grey', pose = {}) {
  const f = WOLF[furName] || WOLF.grey;
  const { run = 0, tailWag = 0, look = 'ahead' } = pose;

  // shadow
  ctx.fillStyle = 'rgba(22,40,30,0.26)';
  ctx.beginPath(); ctx.ellipse(4, 6, 22, 52, 0, 0, Math.PI * 2); ctx.fill();

  // Tail.
  ctx.save();
  ctx.translate(0, 30);
  ctx.rotate(tailWag * 0.4 + run * 0.12);
  paintWolfTail(ctx, f, 1);
  ctx.restore();

  // Legs: front paws reach forward beside the head, hind paws trail by the tail.
  const r = run * 10;
  paintLeg(ctx, f, [-13, -18], [-21, -40 - r], true);
  paintLeg(ctx, f, [13, -18], [21, -40 + r], true);
  paintLeg(ctx, f, [-11, 20], [-18, 40 + r], false);
  paintLeg(ctx, f, [11, 20], [18, 40 - r], false);

  // Body: broad ruffed shoulders, narrow waist, rounder haunches.
  const bodyPts = smoothClosed([
    [0, -36, 2], [12, -33, 3.4], [20, -22, 4], [19, -10, 3.2], [12.5, 2, 2.2], [14.5, 16, 2.6], [12, 28, 2.4], [0, 34, 2],
    [-12, 28, 2.4], [-14.5, 16, 2.6], [-12.5, 2, 2.2], [-19, -10, 3.2], [-20, -22, 4], [-12, -33, 3.4],
  ], 3);
  const body = fur(bodyPts, 7, 1.35);
  inked(ctx, body, f.base);
  furShade(ctx, body, f, { x: 0, y: 0, rx: 20, ry: 36 });
  ctx.save(); ctx.clip(body);
  // dark saddle down the spine, with a furry edge
  ctx.fillStyle = f.mid;
  ctx.fill(fur(smoothClosed([[0, -24, 1.6], [7, -12, 2], [6, 6, 2], [7, 20, 2], [0, 30, 1.6], [-7, 20, 2], [-6, 6, 2], [-7, -12, 2]], 4), 12));
  // pale ruff at the throat
  ctx.fillStyle = f.pale;
  ctx.fill(fur(smoothClosed([[0, -38, 2], [12, -33, 2.4], [14, -26, 2], [0, -24, 2], [-14, -26, 2], [-12, -33, 2.4]], 4), 13));
  ctx.restore();
  tufts(ctx, [[-13, -18, 1.1, 0.4], [13, -18, 1.1, -0.4], [-9, 8, 1, 0.3], [9, 10, 1, -0.3], [-8, 22, 0.9], [8, 23, 0.9], [0, -6, 0.9]], f.shade, 1.4);

  // Head.
  ctx.save();
  ctx.translate(0, -36);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 9.5, -2);
    ctx.rotate(side * 0.42);
    ctx.scale(1.1, 1.1);
    paintWolfEar(ctx, f);
    ctx.restore();
  }
  // Wide furry cheeks tapering to a long muzzle.
  const headPts = smoothClosed([
    [0, 6, 1.6], [10, 4, 2.4], [15.5, -3, 3.4], [12, -11, 1.6], [6, -20, 0.4], [3.4, -27, 0], [0, -29, 0],
    [-3.4, -27, 0], [-6, -20, 0.4], [-12, -11, 1.6], [-15.5, -3, 3.4], [-10, 4, 2.4],
  ], 3);
  const head = fur(headPts, 21, 1.3);
  inked(ctx, head, f.base);
  furShade(ctx, head, f, { x: 0, y: -8, rx: 15, ry: 18 });
  ctx.save(); ctx.clip(head);
  // white blaze from the muzzle up between the eyes
  ctx.fillStyle = f.pale;
  const blaze = new Path2D();
  blaze.moveTo(0, -2); blaze.quadraticCurveTo(-3.6, -8, -5.5, -18); blaze.quadraticCurveTo(-5, -30, 0, -30);
  blaze.quadraticCurveTo(5, -30, 5.5, -18); blaze.quadraticCurveTo(3.6, -8, 0, -2); blaze.closePath();
  ctx.fill(blaze);
  // cheek fur
  ctx.fillStyle = f.pale;
  for (const side of [-1, 1]) ctx.fill(fur(smoothClosed([[side * 8, -6, 1.6], [side * 15, -3, 2.4], [side * 11, 3, 1.6]], 4), 30 + side));
  ctx.restore();
  // nose + whisker dots
  const nose = new Path2D(); ellipse(nose, 0, -27.2, 3.8, 2.8);
  inked(ctx, nose, '#1c1f2b', 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.arc(-1.2, -28, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = f.dark;
  for (const side of [-1, 1]) for (const [dx, dy] of [[3.6, -21], [4.4, -18.5], [3.2, -16.5]]) {
    ctx.beginPath(); ctx.arc(side * dx, dy, 0.55, 0, Math.PI * 2); ctx.fill();
  }
  // Eyes: narrow almonds normally, round and guilty when caught looking up.
  for (const side of [-1, 1]) {
    const x = side * 7, y = -10.5;
    const e = new Path2D();
    if (look === 'up') ellipse(e, x, y, 3.4, 3.8);
    else {
      e.moveTo(x - side * 4.2, y + 0.8);
      e.quadraticCurveTo(x, y - 3.4, x + side * 4, y - 1.2);
      e.quadraticCurveTo(x, y + 2.4, x - side * 4.2, y + 0.8);
      e.closePath();
    }
    inked(ctx, e, EYE.wolf, 1.2);
    ctx.fillStyle = EYE.pupil;
    ctx.beginPath(); ctx.ellipse(x + (look === 'up' ? 0 : side * 0.4), y - (look === 'up' ? 0.8 : 0.3), 1, look === 'up' ? 2.6 : 1.7, 0, 0, Math.PI * 2); ctx.fill();
    if (look === 'up') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 0.9, y - 1.8, 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
