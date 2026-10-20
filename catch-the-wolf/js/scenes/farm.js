// The player's farm: every sheep bought in the shop lives here, wandering,
// grazing and napping. Tap to pet (shows its name), drag to move.

import { Sheep, sortByDepth } from '../game/critter.js';
import { breedById, db } from '../game/rules.js';
import { Particles } from '../engine/particles.js';
import { clamp } from '../engine/util.js';
import { farmBackdrop } from './backdrop.js';
import { el, hudPelts } from './ui.js';

// A rectangular paddock the farm brain can wander in.
export function paddockWorld(area, avoid, fx) {
  return {
    area, avoid, fx, others: [],
    inside: (x, y, pad) => x > area.x + pad && x < area.x + area.w - pad && y > area.y + pad && y < area.y + area.h - pad,
    clamp: (x, y, pad) => ({ x: clamp(x, area.x + pad, area.x + area.w - pad), y: clamp(y, area.y + pad, area.y + area.h - pad) }),
  };
}

export const farmScene = {
  enter(app) {
    this.app = app;
    this.fx = new Particles();
    this.sheep = [];
    this.drag = null;
    const s = app.save.data;
    this.ui = el(`
      <div class="passthrough">
        <div class="hud">
          ${hudPelts(s.pelts)}
          <div class="spacer"></div>
          <div class="chip streak"><span><span class="label">My farm</span><span data-count></span></span></div>
          <div class="spacer"></div>
          <button class="btn icon" data-act="settings" aria-label="Settings">⚙</button>
        </div>
        <div class="bottombar">
          <button class="btn small" data-act="title">◀ Menu</button>
          <div class="spacer"></div>
          <button class="btn small gold" data-act="shop">Shop</button>
          <button class="btn small red" data-act="play">Hunt wolves</button>
        </div>
      </div>`);
    app.ui.append(this.ui);
    this.ui.addEventListener('click', (e) => {
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

  exit() { this.savePositions(); },

  refresh() {
    const s = this.app.save.data;
    this.ui.querySelector('[data-count]').textContent = `${s.farm.length} / ${db.game.farmCap} sheep`;
  },

  resize(w, h) {
    const top = 76, bottom = 84;
    const area = { x: 22, y: top + 14, w: w - 44, h: Math.max(220, h - top - bottom - 28) };
    this.area = area;
    this.bg = farmBackdrop(w, h, this.app.dpr, area);
    this.world = paddockWorld(area, this.bg.avoid, this.fx);
    const scale = clamp(Math.sqrt((area.w * area.h) / Math.max(10, this.app.save.data.farm.length + 6)) / 150, 0.55, 1.05);
    if (!this.sheep.length) {
      for (const a of this.app.save.data.farm) {
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
          sh.state = 'walk'; sh.stateT = 6; sh.heading = 0;
          delete a.isNew;
        }
        this.sheep.push(sh);
      }
    }
    for (const sh of this.sheep) sh.scale = scale;
    this.world.others = this.sheep;
  },

  savePositions() {
    const { area } = this;
    if (!area) return;
    for (const sh of this.sheep) {
      if (!sh.data) continue;
      sh.data.x = clamp((sh.x - area.x) / area.w, 0.05, 0.95);
      sh.data.y = clamp((sh.y - area.y) / area.h, 0.05, 0.95);
    }
    this.app.save.write();
  },

  pointer(e) {
    if (e.type === 'down') {
      for (let i = this.sheep.length - 1; i >= 0; i--) {
        const sh = this.sheep[i];
        if (!sh.hit(e.x, e.y)) continue;
        this.drag = { sh, ox: sh.x - e.x, oy: sh.y - e.y, sx: e.x, sy: e.y, moved: false };
        return;
      }
    } else if (e.type === 'move' && this.drag) {
      const d = this.drag;
      if (!d.moved && Math.hypot(e.x - d.sx, e.y - d.sy) > 8) {
        d.moved = true; d.sh.dragging = true;
        this.app.sfx.baa(1.3);
      }
      if (d.moved) { d.sh.x = e.x + d.ox; d.sh.y = e.y + d.oy; }
    } else if (e.type === 'up' && this.drag) {
      const { sh, moved } = this.drag;
      this.drag = null;
      sh.dragging = false;
      if (!moved) {
        sh.pet(this.fx);
        this.app.sfx.baa(0.95 + Math.random() * 0.3);
        this.app.haptic(10);
        this.showName(sh);
      } else {
        const c = this.world.clamp(sh.x, sh.y, 30 * sh.scale);
        sh.x = c.x; sh.y = c.y;
        sh.state = 'idle'; sh.stateT = 1;
        this.savePositions();
      }
    }
  },

  showName(sh) {
    this.ui.querySelectorAll('.nameplate').forEach((n) => n.remove());
    const b = breedById(sh.data?.breed);
    const tag = el(`<div class="nameplate">${sh.data?.name || 'Sheep'}<small style="display:block;font:800 11px var(--body);opacity:.6;margin-top:2px">${b?.name || ''}</small></div>`);
    this.ui.append(tag);
    this.tag = { node: tag, sh, t: 2.2 };
  },

  update(dt) {
    for (const sh of this.sheep) sh.updateFarm(dt, this.world);
    sortByDepth(this.sheep);
    this.fx.update(dt);
    if (this.tag) {
      this.tag.t -= dt;
      const { sh, node } = this.tag;
      node.style.left = sh.x + 'px';
      node.style.top = sh.y - 70 * sh.scale - sh.hop + 'px';
      if (this.tag.t <= 0) { node.remove(); this.tag = null; }
    }
  },

  draw(ctx) {
    if (this.bg) ctx.drawImage(this.bg.canvas, 0, 0, this.app.w, this.app.h);
    for (const sh of this.sheep) sh.draw(ctx);
    this.fx.draw(ctx);
  },
};

