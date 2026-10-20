// Composes cached sprite layers into an animated sheep or wolf each frame.
// The painters in sheep.js/wolf.js run only when a layer is first needed at a
// given scale; after that every frame is a handful of drawImage calls.

import { sprite, blit } from '../engine/sprites.js';
import { paintLegs, paintTail, paintBody, paintHead, paintEyes, NECK, HEAD_SCALE, BOX } from './sheep.js';
import { paintWolf } from './wolf.js';
import { groundShadow } from './draw.js';

const HEAD_BOX = { x: -46, y: -52, w: 92, h: 76 };
const TAIL_BOX = { x: -34, y: -10, w: 62, h: 64 };
const WOLF_BOX = { x: -46, y: -80, w: 92, h: 172 };

// Layer ids. Base fields name the layer; any tells are appended in full to
// every layer of that sheep, so a new tell key can never share a cache entry
// with an innocent sheep (a wolf is one sheep per round, so this costs little).
function ids(look) {
  if (look._ids) return look._ids;
  const t = look.tells || {};
  const tk = Object.keys(t).sort().map((k) => `${k}=${t[k]}`).join(',');
  const sfx = tk ? `/[${tk};${look.wolfFur || 'grey'}]` : '';
  look._ids = {
    body: `sheep/body/${look.wool}/${look.woolSeed || 7}${sfx}`,
    tail: `sheep/tail/${look.wool}${sfx}`,
    legs: `sheep/legs${sfx}`,
    head: `sheep/head/${look.face}/${look.wool}/${look.ears || 'out'}/${look.horns || 'none'}/${look.tuft === false ? 'bald' : 'tuft'}${sfx}`,
    eyes: `sheep/eyes/${look.face}/${look.eyes || 'open'}${sfx}`,
  };
  return look._ids;
}

// pose: { step, headAngle, headPush, eyes, wag, lie, squash }
// `cacheScale` is the sheep's resting size: transient scaling (pop-in, drag
// lift) reuses that bitmap instead of painting a new one per frame.
export function drawSheep(ctx, look, x, y, scale, heading = 0, pose = {}, cacheScale = scale) {
  const id = ids(look);
  const s = scale * (look.size || 1);
  const cs = cacheScale * (look.size || 1);
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
    blit(ctx, sprite(`${id.legs}/${stepQ}`, BOX, cs, (c) => paintLegs(c, look, stepQ)));
  }
  ctx.save();
  ctx.translate(0, 40);
  ctx.rotate(wag * 0.35);
  blit(ctx, sprite(id.tail, TAIL_BOX, cs, (c) => { c.translate(0, -40); paintTail(c, look, 0); }));
  ctx.restore();

  blit(ctx, sprite(id.body, BOX, cs, (c) => paintBody(c, look)));

  ctx.save();
  ctx.translate(NECK.x, NECK.y - headPush * 6 + lie * 4);
  ctx.rotate(headAngle);
  const hs = 1 - headPush * 0.06;
  ctx.scale(hs, hs);
  blit(ctx, sprite(id.head, HEAD_BOX, cs, (c) => { c.scale(HEAD_SCALE, HEAD_SCALE); paintHead(c, look); }));
  blit(ctx, sprite(`${id.eyes}/${eyes}`, HEAD_BOX, cs, (c) => { c.scale(HEAD_SCALE, HEAD_SCALE); paintEyes(c, look, eyes); }));
  ctx.restore();
  ctx.restore();
}

export function drawWolf(ctx, fur, x, y, scale, heading = 0, pose = {}, cacheScale = scale) {
  const run = Math.round((pose.run || 0) * 2) / 2;
  const look = pose.look || 'ahead';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(scale, scale);
  blit(ctx, sprite(`wolf/${fur}/${look}/${run}`, WOLF_BOX, cacheScale, (c) => paintWolf(c, fur, { run, look })));
  ctx.restore();
}

// Hit test in the sheep's own frame (an ellipse around the fleece + head).
export function sheepHit(look, sx, sy, scale, heading, px, py) {
  return sheepHitScore(look, sx, sy, scale, heading, px, py) <= 1;
}

// 0 at the sheep's centre, 1 at the edge of its tappable area, >1 outside.
// Covers fleece + head, plus the wolf tail when it trails out the back.
export function sheepHitScore(look, sx, sy, scale, heading, px, py) {
  const s = scale * (look.size || 1);
  const dx = px - sx, dy = py - sy;
  const c = Math.cos(-heading), n = Math.sin(-heading);
  const lx = (dx * c - dy * n) / s, ly = (dx * n + dy * c) / s;
  let score = Math.sqrt((lx * lx) / (40 * 40) + ((ly + 8) * (ly + 8)) / (60 * 60));
  if (look.tells?.tail) {
    const tx = lx + 8, ty = ly - 62; // tail swings out to the left
    score = Math.min(score, Math.sqrt(tx * tx + ty * ty) / 18);
  }
  return score;
}
