// A living sheep: position, heading, an animation pose and a brain.
//
// One brain, tuned by a profile:
//   farm  — wanders, grazes, naps, has zoomies, eats food, chases toys
//   field — the find-the-wolf level: stands, grazes, ambles. Never lies down
//           or sleeps, because that would hide paws or eyes (tells).
// Fidgets and wandering only change the pose and position, never the look,
// so a tell is always visible apart from a blink.
//
// Collision: each sheep is two circles that turn with it (fleece + head), and
// overlaps are pushed apart fully every frame so sheep never stack.

import { drawSheep, sheepHitScore } from '../art/render.js';
import { rand, pick, clamp, ease, angleDiff } from '../engine/util.js';

let uidSeq = 1;
const DRAG_MOTION = new Set(['blink']);
const FARM_MOTION = new Set(['blink', 'look']);

export const PROFILES = {
  farm: { walk: 0.4, run: 0.05, lie: 0.11, graze: 0.32, walkSpeed: 46, walkDist: [60, 180], idle: [1, 3], turn: 5 },
  // activity 0..1 comes from the tier: calm early, restless late.
  field: (activity = 0.5) => ({
    walk: 0.25 + activity * 0.45, run: 0, lie: 0, graze: 0.3, walkSpeed: 26 + activity * 18,
    walkDist: [30, 70 + activity * 80], idle: [1.4 - activity * 0.8, 3.2 - activity * 1.6],
    turn: 1.6 + activity * 3, // calm early tiers turn slowly so new players can track them
  }),
};

export class Sheep {
  constructor(look, x, y, scale = 1) {
    this.id = uidSeq++;
    this.look = look;
    this.x = x; this.y = y;
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
    // brain
    this.state = 'idle';
    this.stateT = rand(0.5, 2.5);
    this.tx = x; this.ty = y;
    this.speed = 0;
    this.stepPhase = rand(0, 6);
    this.zT = 0;
    this.dragging = false;
    this.food = null;
    this.toy = null;
  }

  get size() { return this.scale * (this.look.size || 1); }

  // Tap score: <= 1 is a hit, lower is closer to centre (used to pick the
  // nearest sheep when hit areas overlap).
  hitScore(px, py) {
    if (this.gone || this.appear <= 0.5) return Infinity;
    return sheepHitScore(this.look, this.x, this.y - this.hop, this.scale, this.heading, px, py);
  }

  hit(px, py) { return this.hitScore(px, py) <= 1; }

  // Collision shape: fleece circle + head circle, rotated with the heading.
  circles() {
    const s = this.size, sn = Math.sin(this.heading), cs = Math.cos(this.heading);
    const at = (lx, ly) => ({ x: this.x + lx * cs - ly * sn, y: this.y + lx * sn + ly * cs });
    // Fleece, head (+ears/horns) and rump (+tail), with a small gap built in
    // so neighbours never touch.
    const body = at(0, 4), head = at(0, -40), rump = at(0, 40);
    body.r = 35 * s; head.r = (this.look.horns ? 30 : 24) * s; rump.r = 22 * s;
    return [body, head, rump];
  }

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
    } else if (this.state !== 'graze' && this.state !== 'eat') {
      p.headPush += (0 - p.headPush) * clamp(dt * 5, 0, 1);
    }
    p.wag = Math.sin(this.t * 3.1 + this.id) * 0.25;
  }

  tickAppear(dt) {
    if (this.appearDelay > 0) { this.appearDelay -= dt; return; }
    this.appear = Math.min(1, this.appear + dt * 3.2);
  }

  // Back-compat wrapper used by the farm and title screens.
  updateFarm(dt, world) { this.update(dt, world, PROFILES.farm, FARM_MOTION); }

  // world: { inside(x,y,pad), clamp(x,y,pad), avoid:[{x,y,r}], others:[Sheep],
  //          foods?:[Food], toys?:[Toy], fx? }
  update(dt, world, profile, motion) {
    this.t += dt;
    this.tickAppear(dt);
    const p = this.pose;
    if (this.dragging) {
      p.step = Math.sin(this.t * 22);  // legs paddle in the air
      p.lie = 0;
      this.fidget(dt, DRAG_MOTION);
      return;
    }
    if (this.appear < 1) { this.fidget(dt, motion); return; }
    this.stateT -= dt;

    switch (this.state) {
      case 'idle':
        this.speed = 0;
        if (this.stateT <= 0) this.choose(world, profile);
        break;
      case 'graze':
        this.speed = 0;
        p.headPush += (1 - p.headPush) * clamp(dt * 4, 0, 1);
        p.headAngle = Math.sin(this.t * 1.3) * 0.2 + Math.sin(this.t * 13) * 0.02;
        if (this.stateT <= 0) this.choose(world, profile);
        break;
      case 'eat': {
        const f = this.food;
        if (!f || f.remaining <= 0) { this.leaveFood(); this.hop = 10 * this.scale; this.state = 'idle'; this.stateT = rand(0.5, 1.5); break; }
        this.speed = 0;
        this.faceToward(f.x, f.y, dt);
        p.headPush += (1 - p.headPush) * clamp(dt * 5, 0, 1);
        p.headAngle = Math.sin(this.t * 13) * 0.03;
        f.remaining -= dt;
        if (this.stateT <= 0) { this.leaveFood(); this.choose(world, profile); }
        break;
      }
      case 'seek':
      case 'chase':
      case 'walk':
      case 'run': {
        if (this.state === 'seek' && (!this.food || this.food.remaining <= 0)) { this.leaveFood(); this.state = 'idle'; this.stateT = 0.5; break; }
        if (this.state === 'chase') {
          const toy = this.toy;
          if (!toy || toy.gone) { this.toy = null; this.state = 'idle'; this.stateT = 1; break; }
          // Aim slightly behind the ball so the bump sends it onward.
          this.tx = toy.x; this.ty = toy.y;
          if (Math.hypot(toy.x - this.x, toy.y - this.y) < toy.r + 36 * this.size) {
            const k = this.speed * 1.9 + 120 * this.scale;
            toy.vx += Math.sin(this.heading) * k;
            toy.vy -= Math.cos(this.heading) * k;
            toy.chaser = null; this.toy = null;
            this.hop = 12 * this.scale;
            world.fx?.sparkle(toy.x, toy.y, this.scale * 0.6, 5);
            this.state = 'idle'; this.stateT = rand(0.8, 1.6);
            break;
          }
        }
        const dx = this.tx - this.x, dy = this.ty - this.y;
        const d = Math.hypot(dx, dy);
        this.faceToward(this.tx, this.ty, dt, profile.turn);
        const fast = this.state === 'run' || this.state === 'chase' || (this.state === 'seek' && d > 160 * this.scale);
        const target = (fast ? 150 : profile.walkSpeed) * this.scale;
        this.speed += (target - this.speed) * clamp(dt * 3, 0, 1);
        if (d < 6 * this.scale + 2 || this.stateT <= 0) {
          if (this.state === 'seek') { this.state = 'eat'; this.stateT = rand(5, 9); }
          else if (this.state === 'chase') { if (this.toy) this.toy.chaser = null; this.toy = null; this.state = 'idle'; this.stateT = 1; }
          else { this.state = 'idle'; this.stateT = rand(...profile.idle); }
          break;
        }
        // Slow down when another sheep is right in front, rather than shoving.
        const blocked = this.state === 'walk' && this.blockedAhead(world);
        const sp = blocked ? this.speed * 0.25 : this.speed;
        this.x += Math.sin(this.heading) * sp * dt;
        this.y -= Math.cos(this.heading) * sp * dt;
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
        if (this.stateT <= 0) { p.lie = 0; this.choose(world, profile); }
        break;
    }
    if (this.state !== 'graze' && this.state !== 'eat' && this.chewT <= 0) p.headPush += (0 - p.headPush) * clamp(dt * 4, 0, 1);
    if (this.state !== 'sleep') this.fidget(dt, motion);

    // Trot cycle scales with speed.
    this.stepPhase += dt * (this.speed / Math.max(0.01, this.scale)) * 0.22;
    p.step = this.speed > 4 ? Math.sin(this.stepPhase) : p.step * 0.8;
    const bouncy = this.state === 'run' || this.state === 'chase' || (this.state === 'seek' && this.speed > 90 * this.scale);
    this.hop = bouncy ? Math.abs(Math.sin(this.stepPhase)) * 4 * this.scale : Math.max(0, this.hop - dt * 90);
    p.squash = 1 + Math.sin(this.t * 2.2 + this.id) * 0.012;

    this.separate(world);
  }

  faceToward(x, y, dt, rate = 5) {
    const want = Math.atan2(x - this.x, -(y - this.y));
    this.heading += angleDiff(this.heading, want) * clamp(dt * rate, 0, 1);
  }

  blockedAhead(world) {
    const ax = this.x + Math.sin(this.heading) * 50 * this.size, ay = this.y - Math.cos(this.heading) * 50 * this.size;
    return world.others.some((o) => o !== this && !o.gone && Math.hypot(o.x - ax, o.y - ay) < 34 * o.size);
  }

  choose(world, profile = PROFILES.farm) {
    // Toys: now and then one sheep goes for a free toy (even at dinner time).
    const toy = (world.toys || []).find((t) => !t.chaser && !t.gone);
    if (toy && Math.random() < 0.18) { toy.chaser = this; this.toy = toy; this.state = 'chase'; this.stateT = 5; return; }
    // Food: hungry sheep head for anything in reach with a free seat.
    const food = (world.foods || []).find((f) => f.remaining > 0 && f.eaters.size < f.seats && Math.hypot(f.x - this.x, f.y - this.y) < f.attract);
    if (food && Math.random() < 0.8 && this.seek(food)) return;

    const r = Math.random();
    const { walk, run, lie, graze } = profile;
    if (r < graze) { this.state = 'graze'; this.stateT = rand(2.5, 6); }
    else if (r < graze + walk) this.goTo(world, 'walk', rand(...profile.walkDist) * this.scale);
    else if (r < graze + walk + run) this.goTo(world, 'run', rand(160, 320) * this.scale);
    else if (r < graze + walk + run + lie) { this.state = 'lie'; this.stateT = rand(3, 7); }
    else { this.state = 'idle'; this.stateT = rand(...profile.idle); }
  }

  // Go eat: pick a seat around the food's rim.
  seek(food) {
    if (food.eaters.size >= food.seats) return false; // plate's full
    this.leaveFood();
    this.food = food;
    food.eaters.add(this);
    const a = Math.atan2(this.y - food.y, this.x - food.x) + rand(-0.5, 0.5);
    const rr = food.r + 58 * this.size; // head reaches in; the food stays visible
    this.tx = food.x + Math.cos(a) * rr; this.ty = food.y + Math.sin(a) * rr;
    this.state = 'seek'; this.stateT = 8;
    this.pose.lie = 0;
    return true;
  }

  leaveFood() {
    if (this.food) this.food.eaters.delete(this);
    this.food = null;
  }

  goTo(world, mode, dist) {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2;
      const tx = this.x + Math.cos(a) * dist, ty = this.y + Math.sin(a) * dist;
      if (!world.inside(tx, ty, 44 * this.size)) continue;
      if (world.avoid.some((o) => Math.hypot(o.x - tx, o.y - ty) < o.r + 34 * this.size)) continue;
      // Don't pick a spot another sheep is standing on or heading to.
      if (world.others.some((o) => o !== this && (Math.hypot(o.x - tx, o.y - ty) < 70 * this.size || Math.hypot(o.tx - tx, o.ty - ty) < 70 * this.size))) continue;
      this.tx = tx; this.ty = ty; this.state = mode; this.stateT = mode === 'run' ? 3 : 7;
      return;
    }
    this.state = 'idle'; this.stateT = 1;
  }

  separate(world) {
    // Hard separation between rotated two-circle shapes. Each sheep moves
    // itself half the overlap; the other does the same on its own update.
    const mine = this.circles();
    for (const o of world.others) {
      if (o === this || o.dragging || o.gone || o.appear < 0.5) continue;
      if (Math.abs(o.x - this.x) > 120 * this.size || Math.abs(o.y - this.y) > 140 * this.size) continue;
      const theirs = o.circles();
      for (const a of mine) for (const b of theirs) {
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
        if (d < min) {
          const push = (min - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          this.x += nx * push; this.y += ny * push;
          for (const c of mine) { c.x += nx * push; c.y += ny * push; }
        }
      }
    }
    const r = 32 * this.size;
    for (const o of world.avoid) {
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy), min = o.r + r * 0.9;
      if (d > 0 && d < min) { this.x += (dx / d) * (min - d) * 0.5; this.y += (dy / d) * (min - d) * 0.5; }
    }
    if (this.leavingFarm) return; // heading out through the gate
    if (this.entering) {
      // Walking in through the gate: don't snap to the fence until inside.
      if (world.inside(this.x, this.y, 40 * this.scale)) this.entering = false;
      return;
    }
    const c = world.clamp(this.x, this.y, 38 * this.size);
    this.x = c.x; this.y = c.y;
    // Keep the head and rump inside too, not just the centre.
    if (world.area) {
      const a = world.area;
      for (const k of this.circles()) {
        if (k.x - k.r < a.x) this.x += a.x - (k.x - k.r);
        if (k.x + k.r > a.x + a.w) this.x -= k.x + k.r - (a.x + a.w);
        if (k.y - k.r < a.y) this.y += a.y - (k.y - k.r);
        if (k.y + k.r > a.y + a.h) this.y -= k.y + k.r - (a.y + a.h);
      }
    }
  }

  pet(fx) {
    // Happy hop + hearts; wakes a sleeper.
    this.hop = 16 * this.scale;
    this.pose.lie = 0;
    this.leaveFood();
    if (this.toy) { this.toy.chaser = null; this.toy = null; }
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
