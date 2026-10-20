// A living sheep: position, heading and an animation pose, plus two brains —
// `idle` (stands in the line-up, with optional fidgets that rise with
// difficulty) and `farm` (wanders, grazes, naps, has zoomies).
//
// Fidgets never change the look, only the pose, so a tell is always visible
// apart from a blink. That's what keeps hard tiers fair.

import { drawSheep, sheepHitScore } from '../art/render.js';
import { rand, pick, clamp, ease, angleDiff } from '../engine/util.js';

let uidSeq = 1;
const DRAG_MOTION = new Set(['blink']);
const FARM_MOTION = new Set(['blink', 'look']);

export class Sheep {
  constructor(look, x, y, scale = 1) {
    this.id = uidSeq++;
    this.look = look;
    this.x = x; this.y = y;
    this.homeX = x; this.homeY = y;
    this.scale = scale;
    this.heading = 0;
    this.pose = { step: 0, headAngle: 0, headPush: 0, eyes: 'open', wag: 0, lie: 0, squash: 1 };
    this.appear = 0;          // 0..1 pop-in
    this.appearDelay = 0;
    this.hop = 0;             // vertical bounce, px
    this.alpha = 1;
    this.gone = false;
    this.t = rand(0, 10);
    // fidget clocks
    this.blinkIn = rand(1, 5);
    this.blinkT = 0;
    this.lookTarget = 0;
    this.lookIn = rand(1, 4);
    this.chewIn = rand(2, 6);
    this.chewT = 0;
    // farm brain
    this.state = 'idle';
    this.stateT = rand(0.5, 2.5);
    this.tx = x; this.ty = y;
    this.speed = 0;
    this.stepPhase = rand(0, 6);
    this.zT = 0;
    this.dragging = false;
  }

  // Tap score: <= 1 is a hit, lower is closer to centre (used to pick the
  // nearest sheep when hit areas overlap).
  hitScore(px, py) {
    if (this.gone || this.appear <= 0.5) return Infinity;
    return sheepHitScore(this.look, this.x, this.y - this.hop, this.scale, this.heading, px, py);
  }

  hit(px, py) { return this.hitScore(px, py) <= 1; }

  // Shared clocks: blink, glance, chew.
  fidget(dt, motion) {
    const p = this.pose;
    if (motion.has('blink')) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) { this.blinkT = 0.16; this.blinkIn = rand(2, 6); }
    }
    if (this.blinkT > 0) { this.blinkT -= dt; p.eyes = this.blinkT > 0.05 && this.blinkT < 0.11 ? 'closed' : 'half'; }
    else if (this.state !== 'sleep') p.eyes = 'open';

    if (motion.has('look')) {
      this.lookIn -= dt;
      if (this.lookIn <= 0) { this.lookTarget = Math.random() < 0.4 ? 0 : rand(-0.32, 0.32); this.lookIn = rand(1.5, 4); }
    }
    p.headAngle += (this.lookTarget - p.headAngle) * clamp(dt * 6, 0, 1);

    if (motion.has('chew')) {
      this.chewIn -= dt;
      if (this.chewIn <= 0) { this.chewT = rand(1.2, 2.4); this.chewIn = rand(3, 8); }
    }
    if (this.chewT > 0) {
      this.chewT -= dt;
      p.headPush += (1 - p.headPush) * clamp(dt * 5, 0, 1);
      p.headAngle += Math.sin(this.t * 14) * 0.012;
    } else if (this.state !== 'graze') {
      p.headPush += (0 - p.headPush) * clamp(dt * 5, 0, 1);
    }
    p.wag = Math.sin(this.t * 3.1 + this.id) * 0.25;
  }

  // Line-up behaviour for the find-the-wolf field.
  updateIdle(dt, motion) {
    this.t += dt;
    this.tickAppear(dt);
    this.fidget(dt, motion);
    // Breathing.
    this.pose.squash = 1 + Math.sin(this.t * 2.2 + this.id) * 0.012;
    if (motion.has('shuffle')) {
      // Drift a little around home and turn slightly, then settle back.
      const dx = this.homeX + Math.sin(this.t * 0.5 + this.id) * 6 * this.scale - this.x;
      this.x += dx * clamp(dt * 2, 0, 1);
      this.heading = Math.sin(this.t * 0.4 + this.id * 1.7) * 0.18;
      this.pose.step = Math.abs(dx) > 0.2 ? Math.sin(this.t * 10) : 0;
    }
    this.hop = Math.max(0, this.hop - dt * 120);
  }

  tickAppear(dt) {
    if (this.appearDelay > 0) { this.appearDelay -= dt; return; }
    this.appear = Math.min(1, this.appear + dt * 3.2);
  }

  // --- farm brain ------------------------------------------------------------
  // world: { w, h, top, bottom, avoid: [{x,y,r}], others: [Sheep] }
  updateFarm(dt, world) {
    this.t += dt;
    this.tickAppear(dt);
    const p = this.pose;
    if (this.dragging) {
      p.step = Math.sin(this.t * 22);  // legs paddle in the air
      p.lie = 0;
      this.fidget(dt, DRAG_MOTION);
      return;
    }
    this.stateT -= dt;
    const motion = FARM_MOTION;

    switch (this.state) {
      case 'idle':
        this.speed = 0;
        if (this.stateT <= 0) this.choose(world);
        break;
      case 'graze':
        this.speed = 0;
        p.headPush += (1 - p.headPush) * clamp(dt * 4, 0, 1);
        p.headAngle = Math.sin(this.t * 1.3) * 0.2 + Math.sin(this.t * 13) * 0.02;
        if (this.stateT <= 0) this.choose(world);
        break;
      case 'walk':
      case 'run': {
        const dx = this.tx - this.x, dy = this.ty - this.y;
        const d = Math.hypot(dx, dy);
        const want = Math.atan2(dx, -dy);
        this.heading += angleDiff(this.heading, want) * clamp(dt * 5, 0, 1);
        const target = (this.state === 'run' ? 150 : 46) * this.scale;
        this.speed += (target - this.speed) * clamp(dt * 3, 0, 1);
        if (d < 6 || this.stateT <= 0) { this.state = 'idle'; this.stateT = rand(0.6, 2); break; }
        // Move along the heading (turning arcs look nicer than sliding).
        this.x += Math.sin(this.heading) * this.speed * dt;
        this.y -= Math.cos(this.heading) * this.speed * dt;
        break;
      }
      case 'lie':
      case 'sleep':
        this.speed = 0;
        p.lie += (1 - p.lie) * clamp(dt * 3, 0, 1);
        if (this.state === 'sleep') {
          p.eyes = 'closed';
          this.zT -= dt;
          if (this.zT <= 0) { this.zT = 1.2; world.fx?.zzz(this.x + 14 * this.scale, this.y - 40 * this.scale, this.scale); }
        }
        if (this.stateT <= 0) {
          if (this.state === 'lie' && Math.random() < 0.5) { this.state = 'sleep'; this.stateT = rand(6, 12); }
          else { this.state = 'getup'; this.stateT = 0.6; }
        }
        break;
      case 'getup':
        p.lie += (0 - p.lie) * clamp(dt * 5, 0, 1);
        if (this.stateT <= 0) { p.lie = 0; this.choose(world); }
        break;
    }
    if (this.state !== 'graze' && this.chewT <= 0) p.headPush += (0 - p.headPush) * clamp(dt * 4, 0, 1);
    if (this.state !== 'sleep') this.fidget(dt, motion);

    // Trot cycle scales with speed.
    this.stepPhase += dt * (this.speed / Math.max(1, this.scale)) * 0.22;
    p.step = this.speed > 4 ? Math.sin(this.stepPhase) : p.step * 0.8;
    this.hop = this.state === 'run' ? Math.abs(Math.sin(this.stepPhase)) * 4 * this.scale : Math.max(0, this.hop - dt * 90);
    p.squash = 1 + Math.sin(this.t * 2.2 + this.id) * 0.012;

    this.separate(world);
  }

  choose(world) {
    const r = Math.random();
    if (r < 0.32) { this.state = 'graze'; this.stateT = rand(2.5, 6); }
    else if (r < 0.72) { this.goTo(world, 'walk', rand(60, 180) * this.scale); }
    else if (r < 0.77) { this.goTo(world, 'run', rand(160, 320) * this.scale); }
    else if (r < 0.88) { this.state = 'lie'; this.stateT = rand(3, 7); }
    else { this.state = 'idle'; this.stateT = rand(1, 3); }
  }

  goTo(world, mode, dist) {
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const tx = this.x + Math.cos(a) * dist, ty = this.y + Math.sin(a) * dist;
      if (!world.inside(tx, ty, 40 * this.scale)) continue;
      if (world.avoid.some((o) => Math.hypot(o.x - tx, o.y - ty) < o.r + 30 * this.scale)) continue;
      this.tx = tx; this.ty = ty; this.state = mode; this.stateT = mode === 'run' ? 3 : 6;
      return;
    }
    this.state = 'idle'; this.stateT = 1;
  }

  separate(world) {
    // Soft push away from other sheep and obstacles; clamp to the paddock.
    const r = 36 * this.scale;
    for (const o of world.others) {
      if (o === this || o.dragging) continue;
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < r * 1.9) { const k = (r * 1.9 - d) * 0.08; this.x += (dx / d) * k; this.y += (dy / d) * k; }
    }
    for (const o of world.avoid) {
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy), min = o.r + r * 0.8;
      if (d > 0 && d < min) { this.x += (dx / d) * (min - d) * 0.35; this.y += (dy / d) * (min - d) * 0.35; }
    }
    if (this.leavingFarm) return; // heading out through the gate
    if (this.entering) {
      // Walking in through the gate: don't snap to the fence until inside.
      if (world.inside(this.x, this.y, 40 * this.scale)) this.entering = false;
      return;
    }
    const c = world.clamp(this.x, this.y, 38 * this.scale);
    this.x = c.x; this.y = c.y;
  }

  pet(fx) {
    // Happy hop + hearts; wakes a sleeper.
    this.hop = 16 * this.scale;
    this.pose.lie = 0;
    this.state = 'idle'; this.stateT = rand(1, 2);
    this.lookTarget = 0;
    fx?.hearts(this.x, this.y - 50 * this.scale, this.scale);
  }

  draw(ctx) {
    if (this.gone || this.appear <= 0) return;
    const a = ease.outBack(this.appear);
    ctx.save();
    if (this.alpha < 1) ctx.globalAlpha = this.alpha;
    const lift = this.dragging ? 14 * this.scale : 0;
    drawSheep(ctx, this.look, this.x, this.y - this.hop - lift, this.scale * a * (this.dragging ? 1.08 : 1), this.heading, this.pose, this.scale);
    ctx.restore();
  }
}

export function sortByDepth(list) { return list.sort((a, b) => a.y - b.y); }
export { pick };
