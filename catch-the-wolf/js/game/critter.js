// A living sheep: position, heading, an animation pose and a brain.
//
// One brain, tuned by a profile:
//   farm  — wanders, grazes, naps, has zoomies, eats food, chases toys, drinks
//           at the pond and trough, nibbles the hay. At night the flock beds
//           down in a huddle, and lambs stay up playing ball. A sleeper hit
//           by a rolling toy wakes up angry and rams whoever kicked it.
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
  farm: { walk: 0.4, run: 0.05, lie: 0.11, graze: 0.32, walkSpeed: 46, walkDist: [60, 180], idle: [1, 3], turn: 5, visit: 0.16 },
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
    // temper
    this.angryAt = null;      // the sheep (or toy) a woken sheep is after
    this.fleeFrom = null;
    this.knockX = 0; this.knockY = 0;
  }

  get size() { return this.scale * (this.look.size || 1); }
  get isLamb() { return (this.look.size || 1) < 1; }
  get asleep() { return this.state === 'sleep' || this.state === 'lie'; }

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
    // Knocked by a ram: slide, slowing fast.
    if (this.knockX || this.knockY) {
      this.x += this.knockX * dt; this.y += this.knockY * dt;
      const k = Math.exp(-6 * dt);
      this.knockX *= k; this.knockY *= k;
      if (Math.hypot(this.knockX, this.knockY) < 5) this.knockX = this.knockY = 0;
    }

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
        // Lapping at the pond or trough: little splashes at the muzzle.
        if (f.kind === 'pond' || f.kind === 'trough') {
          this.zT -= dt;
          if (this.zT <= 0) { this.zT = rand(0.6, 1.2); const h = this.circles()[1]; world.fx?.sparkle(h.x, h.y, this.scale * 0.35, 3, '#cfeeff'); }
        }
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
            toy.kicker = this; // whoever a sleeper should blame
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
        const fast = this.state === 'run' || this.state === 'chase' || (this.state === 'seek' && d > 160 * this.scale && !this.food?.fixture);
        const target = (fast ? 150 : profile.walkSpeed) * this.scale;
        this.speed += (target - this.speed) * clamp(dt * 3, 0, 1);
        // A seeker in a crowd may never reach its exact seat: once its head can
        // reach the food, that's close enough to start eating.
        const canReach = this.state === 'seek' && this.food && Math.hypot(this.food.x - this.x, this.food.y - this.y) < this.food.r + 64 * this.size;
        if (d < 6 * this.scale + 2 || this.stateT <= 0 || canReach) {
          if (this.state === 'seek') { this.state = 'eat'; this.stateT = rand(5, 9); }
          else if (this.state === 'chase') { if (this.toy) this.toy.chaser = null; this.toy = null; this.state = 'idle'; this.stateT = 1; }
          else if (this.bedtime) { this.bedtime = false; this.state = 'lie'; this.stateT = rand(2, 4); }
          else { this.state = 'idle'; this.stateT = rand(...profile.idle); }
          break;
        }
        this.steerAround(world, dt);
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
          if (this.state === 'lie' && Math.random() < (world.night ? 0.9 : 0.5)) { this.state = 'sleep'; this.stateT = world.night ? rand(20, 40) : rand(6, 12); }
          else { this.state = 'getup'; this.stateT = 0.6; }
        }
        break;
      case 'getup':
        p.lie += (0 - p.lie) * clamp(dt * 5, 0, 1);
        if (this.stateT <= 0) { p.lie = 0; this.choose(world, profile); }
        break;
      case 'angry':
        this.updateAngry(dt, world);
        break;
      case 'flee':
        this.updateFlee(dt, world);
        break;
    }
    if (this.state !== 'graze' && this.state !== 'eat' && this.chewT <= 0) p.headPush += (0 - p.headPush) * clamp(dt * 4, 0, 1);
    if (this.state !== 'sleep') this.fidget(dt, motion);
    if (this.state === 'angry') { p.eyes = 'half'; p.headPush += (0.7 - p.headPush) * clamp(dt * 6, 0, 1); } // head down, glaring

    // Trot cycle scales with speed.
    this.stepPhase += dt * (this.speed / Math.max(0.01, this.scale)) * 0.22;
    p.step = this.speed > 4 ? Math.sin(this.stepPhase) : p.step * 0.8;
    const bouncy = this.state === 'run' || this.state === 'chase' || this.state === 'angry' || this.state === 'flee' || (this.state === 'seek' && this.speed > 90 * this.scale);
    this.hop = bouncy ? Math.abs(Math.sin(this.stepPhase)) * 4 * this.scale : Math.max(0, this.hop - dt * 90);
    p.squash = 1 + Math.sin(this.t * 2.2 + this.id) * 0.012;

    this.separate(world);
  }

  faceToward(x, y, dt, rate = 5) {
    const want = Math.atan2(x - this.x, -(y - this.y));
    this.heading += angleDiff(this.heading, want) * clamp(dt * rate, 0, 1);
  }

  // Veer round solid props (pond, hay, trough, tree) that lie ahead, toward
  // whichever side is already closer, so sheep walk round rather than stick.
  steerAround(world, dt) {
    let steer = 0;
    for (const o of world.avoid) {
      const dx = o.x - this.x, dy = o.y - this.y, d = Math.hypot(dx, dy);
      const reach = o.r + 70 * this.size;
      if (d > reach) continue;
      const off = angleDiff(this.heading, Math.atan2(dx, -dy));
      if (Math.abs(off) > 1.3) continue;
      steer += (off > 0 ? -1 : 1) * (1.4 - Math.abs(off)) * (1 - (d - o.r) / (reach - o.r));
    }
    if (steer) this.heading += clamp(steer, -2, 2) * dt * 6;
  }

  blockedAhead(world) {
    const ax = this.x + Math.sin(this.heading) * 50 * this.size, ay = this.y - Math.cos(this.heading) * 50 * this.size;
    return world.others.some((o) => o !== this && !o.gone && Math.hypot(o.x - ax, o.y - ay) < 34 * o.size);
  }

  choose(world, profile = PROFILES.farm) {
    // Toys: now and then one sheep goes for a free toy (even at dinner time).
    // Lambs don't want to go to bed: at night they'd much rather play ball.
    const toy = (world.toys || []).find((t) => !t.chaser && !t.gone);
    const playful = world.night && profile.lie && this.isLamb ? 0.6 : 0.18;
    if (toy && Math.random() < playful) { toy.chaser = this; this.toy = toy; this.state = 'chase'; this.stateT = 5; return; }
    // Food: hungry sheep head for anything in reach with a free seat.
    const food = (world.foods || []).find((f) => f.remaining > 0 && f.eaters.size < f.seats && Math.hypot(f.x - this.x, f.y - this.y) < f.attract);
    if (food && Math.random() < 0.8 && this.seek(food)) return;
    // Bedtime: grown-ups huddle up with the others and go to sleep.
    if (world.night && profile.lie && !this.isLamb && Math.random() < 0.9) { this.bedDown(world); return; }
    // The farm's fixtures: a drink at the pond or trough, a nibble of hay.
    if (!world.night && profile.visit && Math.random() < profile.visit) {
      const spots = (world.spots || []).filter((sp) => sp.eaters.size < sp.seats);
      if (spots.length && this.seek(pick(spots))) return;
    }

    const r = Math.random();
    let { walk, run, lie, graze } = profile;
    if (world.night && profile.lie) { lie = 0.55; walk *= 0.5; run = 0; graze *= 0.6; } // bedtime on the farm
    if (r < graze) { this.state = 'graze'; this.stateT = rand(2.5, 6); }
    else if (r < graze + walk) this.goTo(world, 'walk', rand(...profile.walkDist) * this.scale);
    else if (r < graze + walk + run) this.goTo(world, 'run', rand(160, 320) * this.scale);
    else if (r < graze + walk + run + lie) {
      if (world.night && !this.isLamb) this.bedDown(world); // no sleeping alone at night
      else { this.state = 'lie'; this.stateT = rand(3, 7); }
    }
    else { this.state = 'idle'; this.stateT = rand(...profile.idle); }
  }

  // Go eat: pick a seat around the food's rim.
  seek(food) {
    if (food.eaters.size >= food.seats) return false; // plate's full
    this.leaveFood();
    this.food = food;
    food.eaters.add(this);
    let a = Math.atan2(this.y - food.y, this.x - food.x) + rand(-0.5, 0.5);
    // The pond is a wide oval: drink from its left or right bank, where the
    // water is closest to its collision circle.
    if (food.ry) a = (Math.cos(a) >= 0 ? 0 : Math.PI) + rand(-0.45, 0.45);
    const rr = food.r + (food.fixture ? 50 : 58) * this.size; // head reaches in; the food stays visible
    this.tx = food.x + Math.cos(a) * rr; this.ty = food.y + Math.sin(a) * rr;
    this.state = 'seek'; this.stateT = 8;
    this.pose.lie = 0;
    return true;
  }

  leaveFood() {
    if (this.food) this.food.eaters.delete(this);
    this.food = null;
  }

  // Night: join the huddle (the sleepers gathered nearest the bed spot under
  // the tree) and lie down against whichever of them is closest, so the flock
  // sleeps in one heap rather than scattered across the field.
  bedDown(world) {
    const bed = world.bed;
    const sleepers = world.others.filter((o) => o !== this && !o.gone && !o.leavingFarm && o.asleep);
    let buddy = null;
    if (sleepers.length) {
      const d = (o, p) => Math.hypot(o.x - p.x, o.y - p.y);
      const heart = bed ? sleepers.reduce((a, b) => (d(b, bed) < d(a, bed) ? b : a)) : sleepers[0];
      const huddle = sleepers.filter((o) => d(o, heart) < 220 * this.size);
      buddy = huddle.reduce((a, b) => (d(b, this) < d(a, this) ? b : a));
      if (d(buddy, this) < 100 * this.size) { this.state = 'lie'; this.stateT = rand(2, 4); return; }
    }
    const anchor = buddy || bed;
    if (!anchor) { this.state = 'lie'; this.stateT = rand(2, 4); return; }
    const a = Math.atan2(this.y - anchor.y, this.x - anchor.x) + rand(-0.6, 0.6);
    const gap = buddy ? 78 * this.size : rand(0, 30) * this.size;
    const c = world.clamp(anchor.x + Math.cos(a) * gap, anchor.y + Math.sin(a) * gap, 44 * this.size);
    this.tx = c.x; this.ty = c.y;
    this.state = 'walk'; this.stateT = 9; this.bedtime = true;
  }

  // Woken by a rolling toy. `culprit` is the sheep that last kicked it; with
  // nobody to blame (you threw it), the sheep takes it out on the toy.
  wakeAngry(culprit, toy, seconds = 10) {
    this.leaveFood();
    if (this.toy) { this.toy.chaser = null; this.toy = null; }
    this.bedtime = false;
    this.state = 'angry'; this.stateT = seconds;
    this.angryAt = culprit && culprit !== this && !culprit.gone ? culprit : toy;
    this.restT = 0.5; // a moment to scramble up and glare
    this.huffT = 0;
    this.hop = 12 * this.scale;
    if (this.angryAt instanceof Sheep) this.angryAt.flee(this, seconds);
  }

  flee(from, seconds) {
    this.leaveFood();
    if (this.toy) { this.toy.chaser = null; this.toy = null; }
    this.bedtime = false;
    this.fleeFrom = from;
    this.state = 'flee'; this.stateT = seconds;
  }

  // Charge, ram, back off, charge again, until the temper runs out.
  updateAngry(dt, world) {
    const p = this.pose, tgt = this.angryAt;
    p.lie += (0 - p.lie) * clamp(dt * 8, 0, 1);
    if (this.stateT <= 0 || !tgt || tgt.gone || tgt.leavingFarm || tgt.dragging) {
      this.angryAt = null;
      this.state = 'idle'; this.stateT = rand(1, 2); this.speed = 0;
      return;
    }
    const head = this.circles()[1];
    this.huffT -= dt;
    if (this.huffT <= 0) {
      this.huffT = 0.45;
      world.fx?.steam(head.x, head.y, this.scale, this.heading);
      if (Math.random() < 0.5) world.fx?.anger(this.x + 18 * this.scale, this.y - 52 * this.scale, this.scale);
    }
    if (this.restT > 0) {
      this.restT -= dt;
      this.speed *= Math.exp(-6 * dt);
      this.faceToward(tgt.x, tgt.y, dt, 6);
      return;
    }
    this.tx = tgt.x; this.ty = tgt.y;
    this.faceToward(this.tx, this.ty, dt, 7);
    this.speed += (175 * this.scale - this.speed) * clamp(dt * 4, 0, 1);
    this.steerAround(world, dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.y -= Math.cos(this.heading) * this.speed * dt;
    // Everyone else awake gets out of the way.
    for (const o of world.others) {
      if (o === this || o === tgt || o.gone || o.dragging || o.leavingFarm || o.asleep || o.state === 'angry' || o.state === 'flee') continue;
      if (Math.hypot(o.x - this.x, o.y - this.y) < 150 * this.size) o.flee(this, rand(1.5, 2.5));
    }
    // Ram!
    const sx = Math.sin(this.heading), sy = -Math.cos(this.heading);
    const hit = tgt instanceof Sheep
      ? tgt.circles().some((c) => Math.hypot(c.x - head.x, c.y - head.y) < c.r + head.r + 6 * this.scale)
      : Math.hypot(tgt.x - head.x, tgt.y - head.y) < tgt.r + head.r;
    if (!hit) return;
    if (tgt instanceof Sheep) {
      tgt.knockX += sx * 300 * this.scale; tgt.knockY += sy * 300 * this.scale;
      tgt.hop = 16 * this.scale;
    } else {
      tgt.vx += sx * 520 * this.scale; tgt.vy += sy * 520 * this.scale;
      tgt.kicker = this;
    }
    world.fx?.sparkle(head.x + sx * head.r, head.y + sy * head.r, this.scale * 0.7, 7);
    world.sfx?.pop();
    world.sfx?.baa(1.35);
    this.speed = 0;
    this.restT = rand(0.7, 1.1);
    this.rams = (this.rams || 0) + 1;
  }

  // Run from an angry sheep, turning along the fence rather than into it.
  updateFlee(dt, world) {
    const from = this.fleeFrom;
    this.pose.lie += (0 - this.pose.lie) * clamp(dt * 8, 0, 1);
    if (this.stateT <= 0 || !from || from.gone || from.state !== 'angry') {
      this.fleeFrom = null;
      this.state = 'idle'; this.stateT = rand(1, 2);
      return;
    }
    let ax = this.x - from.x, ay = this.y - from.y;
    const d = Math.hypot(ax, ay) || 1;
    ax /= d; ay /= d;
    const reach = 120 * this.size, pad = 44 * this.size;
    let tx = this.x + ax * reach, ty = this.y + ay * reach;
    if (!world.inside(tx, ty, pad)) {
      // Cornered: of the two ways along the fence, take the open one furthest from the bully.
      const way = [[-ay, ax], [ay, -ax]].map(([vx, vy]) => ({ x: this.x + vx * reach, y: this.y + vy * reach }))
        .filter((o) => world.inside(o.x, o.y, pad))
        .sort((a, b) => Math.hypot(b.x - from.x, b.y - from.y) - Math.hypot(a.x - from.x, a.y - from.y))[0];
      if (way) { tx = way.x; ty = way.y; }
    }
    this.tx = tx; this.ty = ty;
    this.faceToward(tx, ty, dt, 6);
    this.speed += (150 * this.scale - this.speed) * clamp(dt * 4, 0, 1);
    this.steerAround(world, dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.y -= Math.cos(this.heading) * this.speed * dt;
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
    this.angryAt = null; this.fleeFrom = null; this.bedtime = false; // a pat calms any temper
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
