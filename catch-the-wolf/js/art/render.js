// Composes cached sprite layers into an animated sheep or wolf each frame.
// The painters in sheep.js/wolf.js run only when a layer is first needed at a
// given scale; after that every frame is a handful of drawImage calls.

import { sprite, blit } from '../engine/sprites.js';
import { paintLegs, paintTail, paintBody, paintHead, paintEyes, NECK, HEAD_SCALE, BOX } from './sheep.js';
import { paintWolf } from './wolf.js';
import { groundShadow } from './draw.js';

const HEAD_BOX = { x: -46, y: -52, w: 92, h: 76 };
const TAIL_BOX = { x: -22, y: -10, w: 48, h: 62 };
const WOLF_BOX = { x: -40, y: -80, w: 80, h: 168 };

// Stable id fragments for each layer, built only from the fields that layer draws.
const tellsKey = (t, keys) => keys.map((k) => (t[k] ? `${k}=${t[k]}` : '')).filter(Boolean).join(',');

function ids(look) {
  if (look._ids) return look._ids;
  const t = look.tells || {};
  const fur = look.wolfFur || 'grey';
  const head = [look.face, look.wool, look.ears || 'out', look.horns || 'none', look.tuft === false ? 'bald' : 'tuft',
    tellsKey(t, ['ears', 'earL', 'earR', 'muzzle', 'nose', 'fang']), t.ears || t.earL || t.earR || t.muzzle ? fur : ''].join('/');
  look._ids = {
    body: `sheep/body/${look.wool}/${look.woolSeed || 7}` + (t.patch ? `/patch-${t.patch}-${fur}` : '') + (t.tint ? `/tint-${t.tint}` : ''),
    tail: t.tail ? `sheep/tail/wolf-${fur}` : `sheep/tail/${look.wool}`,
    legs: t.paws ? `sheep/legs/paws-${fur}` : 'sheep/legs/hooves',
    head: `sheep/head/${head}`,
    eyes: `sheep/eyes/${look.face}/${look.eyes || 'open'}` + (t.eyes ? '/wolf' : '') + (t.brows ? '/brows' : ''),
  };
  return look._ids;
}

// pose: { step, headAngle, headPush, eyes, wag, lie, squash }
export function drawSheep(ctx, look, x, y, scale, heading = 0, pose = {}) {
  const id = ids(look);
  const s = scale * (look.size || 1);
  const { step = 0, headAngle = 0, headPush = 0, eyes = 'open', wag = 0, lie = 0, squash = 1 } = pose;

  // Shadow stays world-aligned (light from up-left) regardless of heading.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  groundShadow(ctx, 4, 8 - lie * 3, 37 + lie * 3, 42 - lie * 4, 0.26);
  ctx.rotate(heading);
  ctx.scale(1 + (1 - squash) * 0.6 + lie * 0.04, squash - lie * 0.06);

  if (lie < 0.5) {
    const stepQ = Math.round(step * 2) / 2;
    blit(ctx, sprite(`${id.legs}/${stepQ}`, BOX, s, (c) => paintLegs(c, look, stepQ)));
  }
  ctx.save();
  ctx.translate(0, 40);
  ctx.rotate(wag * 0.35);
  blit(ctx, sprite(id.tail, TAIL_BOX, s, (c) => { c.translate(0, -40); paintTail(c, look, 0); }));
  ctx.restore();

  blit(ctx, sprite(id.body, BOX, s, (c) => paintBody(c, look)));

  ctx.save();
  ctx.translate(NECK.x, NECK.y - headPush * 6 + lie * 4);
  ctx.rotate(headAngle);
  const hs = 1 - headPush * 0.06;
  ctx.scale(hs, hs);
  blit(ctx, sprite(id.head, HEAD_BOX, s, (c) => { c.scale(HEAD_SCALE, HEAD_SCALE); paintHead(c, look); }));
  blit(ctx, sprite(`${id.eyes}/${eyes}`, HEAD_BOX, s, (c) => { c.scale(HEAD_SCALE, HEAD_SCALE); paintEyes(c, look, eyes); }));
  ctx.restore();
  ctx.restore();
}

export function drawWolf(ctx, fur, x, y, scale, heading = 0, pose = {}) {
  const run = Math.round((pose.run || 0) * 2) / 2;
  const look = pose.look || 'ahead';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(scale, scale);
  blit(ctx, sprite(`wolf/${fur}/${look}/${run}`, WOLF_BOX, scale, (c) => paintWolf(c, fur, { run, look })));
  ctx.restore();
}

// Hit test in the sheep's own frame (an ellipse around the fleece + head).
export function sheepHit(look, sx, sy, scale, heading, px, py) {
  const s = scale * (look.size || 1);
  const dx = px - sx, dy = py - sy;
  const c = Math.cos(-heading), n = Math.sin(-heading);
  const lx = (dx * c - dy * n) / s, ly = (dx * n + dy * c) / s;
  return (lx * lx) / (40 * 40) + ((ly + 6) * (ly + 6)) / (58 * 58) <= 1;
}
