// The player's farm: every sheep bought in the shop lives here, wandering,
// grazing and napping. Tap to pet (shows its name), drag to move, drop at the
// gate to let one go to a neighbour's farm (part refund) — so a full farm is
// never a dead end.
//
// Goodies: food from the pantry tray is put down with a tap and sheep flock to
// eat it; toys roll around when a sheep runs into them (or you flick them).
// Fixtures: sheep drink at the pond and trough and nibble the hay bales. At
// night they huddle up to sleep by the tree, and a toy rolling into a sleeper
// starts a ten-second grudge (critter.js wakeAngry).

import { Sheep } from '../game/critter.js';
import { breedById, itemById, db, release, releaseRefund, placeFood } from '../game/rules.js';
import { Particles } from '../engine/particles.js';
import { sprite, blit, freeCanvas } from '../engine/sprites.js';
import { clamp, rand } from '../engine/util.js';
import { paddockWorld } from '../game/world.js';
import { ITEM_PAINTERS } from '../art/props.js';
import { iconURL } from '../art/icons.js';
import { farmBackdrop } from './backdrop.js';
import { Atmosphere } from '../engine/atmosphere.js';
import { farmLight } from '../game/daycycle.js';
import { el, hudPelts, bumpPelts, banner } from './ui.js';

const FOOD_BOX = { x: -42, y: -32, w: 84, h: 64 };
// Farm props sheep can visit, by backdrop kind: how many at once.
const SPOT_SEATS = { pond: 4, trough: 2, hay: 3 };
const WAKE_SPEED = 70;   // a toy rolling faster than this (units/s) wakes a sleeper
const GRUDGE = 10;       // seconds an angry sheep stays angry

export const farmScene = {
  enter(app) {
    this.app = app;
    this.fx = new Particles();
    this.sheep = [];
    this.foods = [];
    this.toys = [];
    this.drag = null;
    this.tag = null;
    this.placing = null;
    this.atmo = new Atmosphere();
    this.fireflies = [];
    const s = app.save.data;
    this.ui = el(`
      <div class="passthrough">
        <div class="hud">
          ${hudPelts(s.pelts)}
          <div class="spacer"></div>
          <div class="chip streak"><span><span class="label" data-time>My farm</span><span data-count></span></span></div>
          <div class="spacer"></div>
          <button class="btn icon" data-act="settings" aria-label="Settings">⚙</button>
        </div>
        <div class="tray" data-tray></div>
        <div class="bottombar">
          <button class="btn small" data-act="title">◀ Menu</button>
          <div class="spacer"></div>
          <button class="btn small gold" data-act="shop">Shop</button>
          <button class="btn small red" data-act="play">Hunt wolves</button>
        </div>
      </div>`);
    app.ui.append(this.ui);
    this.ui.addEventListener('click', (e) => {
      const food = e.target.closest('[data-food]')?.dataset.food;
      if (food) { app.sfx.tap(); this.arm(food); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      app.sfx.tap();
      if (act === 'settings') app.openSettings();
      else app.go(act);
    });
    if (!s.farm.length) {
      this.ui.append(el(`<div class="panel empty-farm"><h2>An empty field</h2>
        <p>Catch wolves to earn pelts, then trade them for sheep in the shop. They'll live here.</p>
        <button class="btn red" data-act="play">Go hunting</button></div>`));
    }
    this.refresh();
  },

  exit() { this.savePositions(); freeCanvas(this.bg?.canvas); this.bg = null; this.tag = null; this.drag = null; this.placing = null; },

  refresh() {
    const s = this.app.save.data;
    this.ui.querySelector('[data-count]').textContent = `${s.farm.length} / ${db.game.farmCap} sheep`;
    this.refreshTray();
  },

  // Pantry tray: one button per food you own.
  refreshTray() {
    const s = this.app.save.data;
    const tray = this.ui.querySelector('[data-tray]');
    tray.innerHTML = db.items.filter((it) => it.kind === 'food' && s.pantry[it.id] > 0).map((it) => {
      const icon = iconURL(`item2-${it.id}`, 96, 96, (c) => { c.translate(48, 50); c.scale(1.05, 1.05); ITEM_PAINTERS[it.paint](c, {}); });
      return `<button class="btn small ${this.placing === it.id ? 'armed' : ''}" data-food="${it.id}" aria-label="Put out ${it.name}">
        <img src="${icon}" alt="">${it.name} ×${s.pantry[it.id]}</button>`;
    }).join('');
  },

  arm(id) {
    this.placing = this.placing === id ? null : id;
    if (this.placing) banner(this.app.ui, 'Tap the field', `to put down the ${itemById(id).name.toLowerCase()}`);
    this.refreshTray();
  },

  resize(w, h) {
    const top = 76, bottom = 84;
    const area = { x: 22, y: top + 14, w: w - 44, h: Math.max(220, h - top - bottom - 28) };
    const save = this.app.save.data;
    this.area = area;
    freeCanvas(this.bg?.canvas);
    this.bg = farmBackdrop(w, h, this.app.dpr, area);
    this.world = paddockWorld(area, this.bg.avoid, this.fx);
    this.gate = { x: area.x + area.w / 2, y: area.y + area.h - 10, r: 56 * this.bg.scale };
    const scale = clamp(Math.sqrt((area.w * area.h) / Math.max(10, save.farm.length + 6)) / 150, 0.55, 1.05);
    this.sc = scale;
    if (!this.sheep.length) {
      for (const a of save.farm) {
        const b = breedById(a.breed);
        if (!b) continue;
        const sh = new Sheep({ ...b.look }, area.x + a.x * area.w, area.y + a.y * area.h, scale);
        sh.data = a;
        sh.heading = Math.random() * Math.PI * 2;
        sh.appearDelay = Math.random() * 0.4;
        // Newly bought sheep arrive at the gate and trot in.
        if (a.isNew) {
          sh.x = area.x + area.w / 2; sh.y = area.y + area.h + 40;
          sh.tx = area.x + area.w * (0.3 + Math.random() * 0.4); sh.ty = area.y + area.h * 0.6;
          sh.state = 'walk'; sh.stateT = 6; sh.heading = 0; sh.entering = true;
          delete a.isNew;
        }
        this.sheep.push(sh);
      }
      this.foods = save.foods.map((d) => this.makeFood(d)).filter(Boolean);
      this.toys = save.toys.map((d) => this.makeToy(d)).filter(Boolean);
    } else {
      // Re-derive pixel positions from saved 0..1 coords after a resize.
      this.savePositions();
      for (const f of this.foods) { f.x = area.x + f.data.x * area.w; f.y = area.y + f.data.y * area.h; }
      for (const t of this.toys) { t.x = area.x + t.data.x * area.w; t.y = area.y + t.data.y * area.h; }
    }
    for (const sh of this.sheep) sh.scale = scale;
    for (const f of this.foods) this.sizeFood(f);
    for (const t of this.toys) t.r = itemById(t.data.item).r * scale;
    this.world.others = this.sheep;
    this.world.foods = this.foods;
    this.world.toys = this.toys;
    this.world.sfx = this.app.sfx;
    // Fixtures act like food that never runs out.
    this.world.spots = this.bg.avoid.filter((o) => SPOT_SEATS[o.kind]).map((o) => ({ ...o, seats: SPOT_SEATS[o.kind], eaters: new Set(), remaining: Infinity, fixture: true }));
    for (const sh of this.sheep) if (sh.food?.fixture) { sh.leaveFood(); sh.state = 'idle'; sh.stateT = 0.5; } // old spots are gone
    // Bed: the lee of the shade tree, where the first sleeper settles.
    const tree = this.bg.avoid.find((o) => o.kind === 'tree');
    this.world.bed = tree ? this.world.clamp(tree.x, tree.y + tree.r + 50 * scale, 60 * scale) : { x: area.x + area.w / 2, y: area.y + area.h / 2 };
    this.atmo.resize(w, h);
    // Fireflies for the night.
    this.fireflies = Array.from({ length: 14 }, () => ({ x: area.x + Math.random() * area.w, y: area.y + Math.random() * area.h, ph: Math.random() * 6, sp: 0.4 + Math.random() * 0.6 }));
  },

  makeFood(d) {
    const it = itemById(d.item);
    if (!it) return null;
    const f = { data: d, item: it, x: this.area.x + d.x * this.area.w, y: this.area.y + d.y * this.area.h, eaters: new Set(), seats: it.seats };
    // `remaining` lives on the save entry so eating persists.
    Object.defineProperty(f, 'remaining', { get: () => d.remaining, set: (v) => { d.remaining = v; } });
    this.sizeFood(f);
    return f;
  },

  sizeFood(f) {
    f.r = f.item.r * this.sc;
    f.attract = f.item.attract ? f.item.attract * this.sc : Infinity;
  },

  makeToy(d) {
    const it = itemById(d.item);
    if (!it) return null;
    const t = { data: d, item: it, x: this.area.x + d.x * this.area.w, y: this.area.y + d.y * this.area.h, vx: 0, vy: 0, roll: 0, r: it.r * (this.sc || 1), chaser: null };
    if (d.isNew) {
      // New toys roll in through the gate.
      t.y = this.area.y + this.area.h - 4; t.vy = -260 * (this.sc || 1); t.vx = rand(-60, 60);
      delete d.isNew;
    }
    return t;
  },

  savePositions() {
    const { area } = this;
    if (!area || !(area.w > 0 && area.h > 0)) return;
    for (const sh of this.sheep) {
      if (!sh.data || sh.entering) continue;
      sh.data.x = clamp((sh.x - area.x) / area.w, 0.05, 0.95);
      sh.data.y = clamp((sh.y - area.y) / area.h, 0.05, 0.95);
    }
    for (const t of this.toys) {
      t.data.x = clamp((t.x - area.x) / area.w, 0.03, 0.97);
      t.data.y = clamp((t.y - area.y) / area.h, 0.03, 0.97);
    }
    this.app.save.write();
  },

  // ---- input -------------------------------------------------------------------
  pointer(e) {
    // One drag at a time, owned by the finger that started it.
    if (this.drag && e.id !== this.drag.id) return;
    if (e.type === 'down') {
      if (this.drag) return;
      if (this.placing) { this.putFood(e.x, e.y); return; }
      // Toys are small: check them first, with a forgiving radius.
      const toy = this.toys.find((t) => Math.hypot(t.x - e.x, t.y - e.y) < t.r + 14);
      if (toy) { this.drag = { id: e.id, toy, ox: toy.x - e.x, oy: toy.y - e.y, sx: e.x, sy: e.y, moved: false, lx: e.x, ly: e.y, vx: 0, vy: 0 }; return; }
      let best = null, bestScore = 1;
      for (const sh of this.sheep) {
        if (sh.leavingFarm) continue;
        const sc = sh.hitScore(e.x, e.y);
        if (sc <= bestScore) { best = sh; bestScore = sc; }
      }
      if (best) this.drag = { id: e.id, sh: best, ox: best.x - e.x, oy: best.y - e.y, sx: e.x, sy: e.y, moved: false };
    } else if (e.type === 'move' && this.drag) {
      const d = this.drag;
      if (!d.moved && Math.hypot(e.x - d.sx, e.y - d.sy) > 8) {
        d.moved = true;
        if (d.sh) { d.sh.dragging = true; this.app.sfx.baa(1.3); }
      }
      if (d.moved && d.sh) { d.sh.x = e.x + d.ox; d.sh.y = e.y + d.oy; }
      if (d.moved && d.toy) {
        // Track finger velocity so letting go throws the toy.
        const now = performance.now(), dt = Math.max(0.008, (now - (d.lt || now - 16)) / 1000);
        d.vx = (e.x - d.lx) / dt; d.vy = (e.y - d.ly) / dt; d.lx = e.x; d.ly = e.y; d.lt = now;
        const c = this.world.clamp(e.x + d.ox, e.y + d.oy, d.toy.r);
        d.toy.x = c.x; d.toy.y = c.y; d.toy.vx = 0; d.toy.vy = 0;
      }
    } else if (e.type === 'up' && this.drag) {
      const d = this.drag;
      this.drag = null;
      if (d.toy) {
        if (!d.moved) {
          // Tap: flick it in a random direction.
          d.toy.kicker = null; // your doing: a sheep it wakes has no one to blame
          const a = Math.random() * Math.PI * 2, k = 320 * this.sc;
          d.toy.vx += Math.cos(a) * k; d.toy.vy += Math.sin(a) * k;
          this.app.sfx.pop();
        } else {
          d.toy.kicker = null;
          const cap = 900 * this.sc, sp = Math.hypot(d.vx, d.vy), f = sp > cap ? cap / sp : 1;
          d.toy.vx = d.vx * f * 0.6; d.toy.vy = d.vy * f * 0.6;
        }
        return;
      }
      const { sh, moved } = d;
      sh.dragging = false;
      if (!moved) {
        sh.pet(this.fx);
        this.app.sfx.baa(0.95 + Math.random() * 0.3);
        this.app.haptic(10);
        this.showName(sh);
      } else {
        const atGate = Math.hypot(sh.x - this.gate.x, sh.y - this.gate.y) < this.gate.r;
        const c = this.world.clamp(sh.x, sh.y, 30 * sh.scale);
        sh.x = c.x; sh.y = c.y;
        sh.state = 'idle'; sh.stateT = 1;
        this.savePositions();
        if (atGate && sh.data) this.confirmRelease(sh);
      }
    }
  },

  putFood(x, y) {
    const { app, area } = this;
    const id = this.placing;
    if (!this.world.inside(x, y, 24 * this.sc) || this.world.avoid.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 20 * this.sc)) {
      banner(app.ui, 'Not there!', 'Pick an open patch of grass', 'bad');
      return;
    }
    const d = placeFood(app.save.data, id, (x - area.x) / area.w, (y - area.y) / area.h);
    if (!d) { banner(app.ui, 'Plenty out already!', `Up to ${db.itemRules.maxFoodOut} at a time`, 'bad'); this.placing = null; this.refreshTray(); return; }
    app.save.write();
    const f = this.makeFood(d);
    this.foods.push(f);
    app.sfx.pop();
    this.fx.sparkle(f.x, f.y, this.sc, 8, '#d8ff9a');
    // Everyone in reach drops what they're doing and comes to eat.
    const hungry = this.sheep.filter((sh) => !sh.leavingFarm && !sh.dragging && !sh.food && Math.hypot(sh.x - f.x, sh.y - f.y) < f.attract)
      .sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))
      .slice(0, f.seats);
    hungry.forEach((sh, i) => setTimeout(() => { if (!sh.food) { sh.seek(f); if (i < 2) app.sfx.baa(1 + Math.random() * 0.3); } }, i * 120));
    if (!(app.save.data.pantry[id] > 0)) this.placing = null;
    this.refreshTray();
  },

  confirmRelease(sh) {
    const { app } = this;
    const refund = releaseRefund(sh.data);
    const panel = el(`
      <div class="scrim"><div class="panel" role="dialog" aria-modal="true" aria-label="Let a sheep go">
        <h2>Say goodbye?</h2>
        <p><b>${sh.data.name}</b> will trot off to a neighbour's farm.${refund ? ` You'll get <b>${refund} pelt${refund === 1 ? '' : 's'}</b> back.` : ''}</p>
        <div class="row">
          <button class="btn red" data-yes>Let ${sh.data.name} go</button>
          <button class="btn" data-close>Keep</button>
        </div>
      </div></div>`);
    app.ui.append(panel);
    panel.querySelector('[data-close]').onclick = () => { app.sfx.tap(); panel.remove(); };
    panel.querySelector('[data-yes]').onclick = () => {
      panel.remove();
      release(app.save.data, sh.data.uid);
      app.save.write();
      app.sfx.baa(1.2);
      if (refund) { app.sfx.coin(); bumpPelts(this.ui, app.save.data.pelts); }
      // Trot out through the gate, then vanish.
      sh.data = null;
      sh.leaveFood();
      sh.leavingFarm = true;
      sh.entering = true;
      sh.tx = this.gate.x; sh.ty = this.area.y + this.area.h + 120;
      sh.state = 'walk'; sh.stateT = 5;
      this.refresh();
    };
  },

  showName(sh) {
    this.ui.querySelectorAll('.nameplate').forEach((n) => n.remove());
    const b = breedById(sh.data?.breed);
    const tag = el(`<div class="nameplate">${sh.data?.name || 'Sheep'}<small style="display:block;font:800 11px var(--body);opacity:.6;margin-top:2px">${b?.name || ''}</small></div>`);
    this.ui.append(tag);
    this.tag = { node: tag, sh, t: 2.2 };
  },

  // ---- frame -------------------------------------------------------------------
  update(dt) {
    // Day/night: light from the farm clock; sheep head to bed when it's dark.
    const L = farmLight();
    this.atmo.light = L.light.color === '#ffffff' && !L.light.vignette ? null : L.light;
    this.night = L.night;
    if (this.world) this.world.night = L.isNight;
    const label = `My farm · ${L.icon} ${L.name}`;
    if (label !== this.lastLabel) { this.lastLabel = label; this.ui.querySelector('[data-time]').textContent = label; }
    for (const f of this.fireflies) {
      f.ph += dt * f.sp;
      f.x += Math.cos(f.ph * 1.3) * 14 * dt; f.y += Math.sin(f.ph) * 10 * dt;
    }
    for (const sh of this.sheep) {
      if (sh.leavingFarm) {
        sh.state = 'walk'; sh.stateT = 5;
        sh.alpha = Math.max(0, sh.alpha - dt * (sh.y > this.area.y + this.area.h ? 1.5 : 0));
        if (sh.alpha <= 0) sh.gone = true;
      }
      sh.updateFarm(dt, this.world);
    }
    this.sheep = this.sheep.filter((sh) => !sh.gone);
    this.world.others = this.sheep;
    this.stepToys(dt);
    this.stepFoods();
    this.fx.update(dt);
    if (this.tag) {
      this.tag.t -= dt;
      const { sh, node } = this.tag;
      node.style.left = sh.x + 'px';
      node.style.top = sh.y - 70 * sh.scale - sh.hop + 'px';
      if (this.tag.t <= 0) { node.remove(); this.tag = null; }
    }
  },

  wake(sh, toy) {
    const culprit = toy.kicker && !toy.kicker.gone && !toy.kicker.leavingFarm ? toy.kicker : null;
    sh.wakeAngry(culprit, toy, GRUDGE);
    this.fx.anger(sh.x + 18 * sh.scale, sh.y - 52 * sh.scale, sh.scale * 1.3);
    this.app.sfx.baa(0.7);
    this.app.haptic(25);
    // Name the grudge, so it's clear what's going on.
    const name = (s) => s?.data?.name || 'A sheep';
    banner(this.app.ui, `${name(sh)} is cross!`, culprit ? `${name(culprit)} woke it up. Run, ${name(culprit)}!` : 'Who threw that?', 'bad low');
  },

  // Eaten-up food disappears (and leaves the save).
  stepFoods() {
    const gone = this.foods.filter((f) => f.remaining <= 0);
    if (!gone.length) return;
    for (const f of gone) {
      for (const sh of f.eaters) { sh.food = null; sh.hop = 10 * sh.scale; }
      this.fx.hearts(f.x, f.y - 10 * this.sc, this.sc, 2);
    }
    this.foods = this.foods.filter((f) => f.remaining > 0);
    this.world.foods = this.foods;
    const save = this.app.save.data;
    save.foods = save.foods.filter((d) => d.remaining > 0);
    this.app.save.write();
  },

  // Rolling, bouncing toys: friction, fence and prop bounces, nudges from sheep.
  stepToys(dt) {
    const { area } = this;
    for (const t of this.toys) {
      if (this.drag?.toy === t) continue;
      const { bounce, friction } = t.item;
      // Sheep bump into toys they walk through. A toy that rolls into a
      // sleeping sheep wakes it up, cross, and it goes after whoever kicked it.
      const rolling = Math.hypot(t.vx, t.vy) > WAKE_SPEED * this.sc;
      for (const sh of this.sheep) {
        if (sh.dragging || sh.gone) continue;
        for (const c of sh.circles()) {
          const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy) || 0.01, min = c.r + t.r;
          if (d < min) {
            if (rolling && sh.asleep && sh.appear >= 1 && !sh.leavingFarm && t.kicker !== sh) this.wake(sh, t);
            else if (sh.speed > 20 * this.sc && sh.state !== 'angry') t.kicker = sh;
            t.x += (dx / d) * (min - d); t.y += (dy / d) * (min - d);
            const push = Math.max(40 * this.sc, sh.speed * 1.2);
            t.vx += (dx / d) * push * dt * 8; t.vy += (dy / d) * push * dt * 8;
          }
        }
      }
      t.x += t.vx * dt; t.y += t.vy * dt;
      const k = Math.exp(-friction * dt);
      t.vx *= k; t.vy *= k;
      const sp = Math.hypot(t.vx, t.vy);
      if (sp < 2) { t.vx = 0; t.vy = 0; }
      t.roll += (sp / Math.max(4, t.r)) * dt * Math.sign(t.vx || 1);
      // Fence.
      const pad = t.r + 4;
      if (t.x < area.x + pad) { t.x = area.x + pad; t.vx = Math.abs(t.vx) * bounce; }
      if (t.x > area.x + area.w - pad) { t.x = area.x + area.w - pad; t.vx = -Math.abs(t.vx) * bounce; }
      if (t.y < area.y + pad) { t.y = area.y + pad; t.vy = Math.abs(t.vy) * bounce; }
      const floor = area.y + area.h - pad - (this.app.save.data.pantry && Object.values(this.app.save.data.pantry).some((n) => n > 0) ? 52 : 0);
      if (t.y > floor) { t.y = floor; t.vy = -Math.abs(t.vy) * bounce; }
      // Pond, trees, hay: reflect off the circle.
      for (const o of this.world.avoid) {
        const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = o.r + t.r;
        if (d < min) {
          const nx = dx / d, ny = dy / d;
          t.x = o.x + nx * min; t.y = o.y + ny * min;
          const vn = t.vx * nx + t.vy * ny;
          if (vn < 0) { t.vx -= (1 + bounce) * vn * nx; t.vy -= (1 + bounce) * vn * ny; }
        }
      }
      // Toys knock into each other.
      for (const o of this.toys) {
        if (o === t) continue;
        const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = o.r + t.r;
        if (d < min) {
          const nx = dx / d, ny = dy / d, push = (min - d) / 2;
          t.x += nx * push; t.y += ny * push; o.x -= nx * push; o.y -= ny * push;
          const rel = (t.vx - o.vx) * nx + (t.vy - o.vy) * ny;
          if (rel < 0) { t.vx -= rel * nx; t.vy -= rel * ny; o.vx += rel * nx; o.vy += rel * ny; }
        }
      }
    }
  },

  draw(ctx) {
    if (this.bg) ctx.drawImage(this.bg.canvas, 0, 0, this.app.w, this.app.h);
    // While dragging a sheep, show the gate as a drop target.
    const d = this.drag;
    if (d?.moved && d.sh && this.gate) {
      const g = this.gate, near = Math.hypot(d.sh.x - g.x, d.sh.y - g.y) < g.r;
      ctx.save();
      ctx.fillStyle = near ? 'rgba(238,91,63,0.35)' : 'rgba(255,255,255,0.22)';
      ctx.strokeStyle = near ? '#ee5b3f' : '#fff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '400 17px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#262a3b'; ctx.fillStyle = '#fff';
      ctx.strokeText('Let go here', g.x, g.y - g.r - 8); ctx.fillText('Let go here', g.x, g.y - g.r - 8);
      ctx.restore();
    }
    // Food lies on the ground layer, under every sheep.
    for (const f of this.foods) {
      const left = Math.round(clamp(f.remaining / f.item.amount, 0, 1) * 10) / 10;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(this.sc, this.sc);
      blit(ctx, sprite(`item/${f.item.paint}/${left}`, FOOD_BOX, this.sc, (c) => ITEM_PAINTERS[f.item.paint](c, { left })));
      ctx.restore();
    }
    // Sheep and toys share one depth order.
    const list = [
      ...this.sheep.map((s) => ({ y: s.y, s })),
      ...this.toys.map((t) => ({ y: t.y + t.r * 0.5, t })),
    ].sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e.s) { e.s.draw(ctx); continue; }
      const t = e.t, base = t.item.r;
      const rollQ = Math.round((((t.roll % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 16)) % 32;
      const box = { x: -base * 1.6, y: -base * 1.4, w: base * 3.2, h: base * 3 };
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(this.sc, this.sc);
      blit(ctx, sprite(`item/${t.item.paint}/${rollQ}`, box, this.sc, (c) => ITEM_PAINTERS[t.item.paint](c, { roll: rollQ * Math.PI / 16, r: base })));
      ctx.restore();
    }
    this.fx.draw(ctx);
    this.atmo.draw(ctx);
    // Fireflies glow over the dark.
    if (this.night > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.fireflies) {
        const a = (this.night - 0.3) * (0.5 + Math.sin(f.ph * 3) * 0.5);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
        g.addColorStop(0, `rgba(255,245,150,${a})`); g.addColorStop(1, 'rgba(255,245,150,0)');
        ctx.fillStyle = g; ctx.fillRect(f.x - 9, f.y - 9, 18, 18);
      }
      ctx.restore();
    }
  },
};
