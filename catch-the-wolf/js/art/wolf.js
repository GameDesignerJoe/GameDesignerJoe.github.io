// The wolf, unmasked. Top-down, facing up, same units as the sheep (body
// centre near the origin). `pose.run` in [-1, 1] swings the legs for a gallop;
// `pose.look` = 'up' turns the face toward the player (the guilty look).

import { INK, INK_W, ellipse, inked, shadeInside } from './draw.js';
import { WOLF, EYE } from './palette.js';

export function paintWolf(ctx, furName = 'grey', pose = {}) {
  const fur = WOLF[furName] || WOLF.grey;
  const { run = 0, tailWag = 0, look = 'ahead' } = pose;

  // shadow
  ctx.fillStyle = 'rgba(22,40,30,0.26)';
  ctx.beginPath(); ctx.ellipse(3, 10, 24, 50, 0, 0, Math.PI * 2); ctx.fill();

  // Tail first, sweeping out the back.
  ctx.save();
  ctx.translate(0, 34);
  ctx.rotate(tailWag * 0.4);
  const tail = new Path2D();
  tail.moveTo(-7, -4);
  tail.bezierCurveTo(-13, 12, -11, 30, -1, 44);
  tail.bezierCurveTo(3, 49, 9, 46, 9, 40);
  tail.bezierCurveTo(12, 28, 10, 10, 7, -4);
  tail.closePath();
  inked(ctx, tail, fur.base);
  shadeInside(ctx, tail, { x: 0, y: 20, rx: 11, ry: 26 }, fur.shade, fur.light, 0.3);
  ctx.save(); ctx.clip(tail);
  ctx.fillStyle = fur.dark;
  ctx.beginPath(); ctx.ellipse(3, 46, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();

  // Legs: front pair reaches forward, back pair trails — diagonals swap on `run`.
  const legs = [
    { x: -13, y: -24, s: run, front: true }, { x: 13, y: -24, s: -run, front: true },
    { x: -13, y: 28, s: -run }, { x: 13, y: 28, s: run },
  ];
  for (const l of legs) {
    const reach = l.s * 9;
    const px = l.x * 1.15, py = l.y + (l.front ? -6 : 6) + reach;
    const leg = new Path2D();
    leg.moveTo(l.x - 4.5, l.y); leg.lineTo(px - 4, py); leg.lineTo(px + 4, py); leg.lineTo(l.x + 4.5, l.y); leg.closePath();
    inked(ctx, leg, fur.shade, INK_W * 0.85);
    const paw = new Path2D(); ellipse(paw, px, py, 5.6, 6.2);
    inked(ctx, paw, fur.base, INK_W * 0.85);
    ctx.strokeStyle = fur.dark; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (const k of [-1.8, 1.8]) {
      ctx.beginPath(); ctx.moveTo(px + k, py + (l.front ? -5 : 2)); ctx.lineTo(px + k, py + (l.front ? -2 : 5)); ctx.stroke();
    }
  }

  // Body — longer and leaner than a sheep, with a ruff at the shoulders.
  const body = new Path2D();
  ellipse(body, 0, 4, 17, 32);
  ellipse(body, 0, -18, 19, 15);
  inked(ctx, body, fur.base);
  shadeInside(ctx, body, { x: 0, y: -2, rx: 19, ry: 34 }, fur.shade, fur.light, 0.28);
  // dark saddle down the spine
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = fur.mid;
  ctx.beginPath(); ctx.ellipse(0, 6, 8, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // ruff tufts
  ctx.strokeStyle = fur.shade; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (const [x, y] of [[-12, -16], [-8, -9], [10, -14], [6, -8], [-3, 14], [4, 22]]) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 2, y + 2, x + 1, y + 5); ctx.stroke();
  }

  // Head.
  ctx.save();
  ctx.translate(0, -34);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 8, -4);
    ctx.rotate(side * 0.35);
    const ear = new Path2D();
    ear.moveTo(-5.5, 4); ear.quadraticCurveTo(-4, -8, 0, -16); ear.quadraticCurveTo(4, -8, 5.5, 4); ear.closePath();
    inked(ctx, ear, fur.base);
    const inner = new Path2D();
    inner.moveTo(-2.5, 2); inner.quadraticCurveTo(-1.6, -5, 0, -10.5); inner.quadraticCurveTo(1.6, -5, 2.5, 2); inner.closePath();
    ctx.fillStyle = fur.dark; ctx.fill(inner);
    ctx.restore();
  }
  const head = new Path2D();
  ellipse(head, 0, -2, 13, 12);
  head.moveTo(-7.5, -8);
  head.bezierCurveTo(-7, -20, -4, -26, 0, -26.5);
  head.bezierCurveTo(4, -26, 7, -20, 7.5, -8);
  head.closePath();
  inked(ctx, head, fur.base);
  shadeInside(ctx, head, { x: 0, y: -8, rx: 13, ry: 18 }, fur.shade, fur.light, 0.22);
  // pale mask around the muzzle
  ctx.save(); ctx.clip(head);
  ctx.fillStyle = fur.pale;
  ctx.beginPath(); ctx.ellipse(0, -18, 6.5, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const nose = new Path2D(); ellipse(nose, 0, -24.5, 3.8, 2.8);
  inked(ctx, nose, '#1c1f2b', 0.8);
  // eyes — yellow, narrowed (sly) unless caught looking up
  for (const side of [-1, 1]) {
    const x = side * 6.2, y = -6;
    const e = new Path2D();
    if (look === 'up') ellipse(e, x, y, 3.6, 4); else ellipse(e, x, y, 3.8, 2.6, side * 0.35);
    inked(ctx, e, EYE.wolf, 1.2);
    ctx.fillStyle = EYE.pupil;
    ctx.beginPath(); ctx.ellipse(x, y + (look === 'up' ? -0.6 : 0), 1, look === 'up' ? 2.8 : 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
