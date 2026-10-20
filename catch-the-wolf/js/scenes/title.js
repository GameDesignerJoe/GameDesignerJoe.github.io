// Title screen: a few sheep mill about the meadow behind the logo.

import { Sheep, sortByDepth } from '../game/critter.js';
import { db } from '../game/rules.js';
import { Particles } from '../engine/particles.js';
import { pick } from '../engine/util.js';
import { titleBackdrop } from './backdrop.js';
import { el, hudPelts } from './ui.js';
import { paddockWorld } from './farm.js';

export const titleScene = {
  enter(app) {
    this.app = app;
    this.fx = new Particles();
    this.sheep = [];
    const s = app.save.data;
    const farmLine = s.farm.length ? `My Farm <small style="font-size:.7em;opacity:.8">(${s.farm.length})</small>` : 'My Farm';
    this.ui = el(`
      <div class="title-wrap passthrough">
        <div class="corner" style="display:flex;gap:10px;align-items:center">${hudPelts(s.pelts)}<button class="btn icon" data-act="settings" aria-label="Settings">⚙</button></div>
        <h1 class="logo">Catch<span class="the">— the —</span><span class="wolf">Wolf</span></h1>
        <div class="tagline">Can you find the wolf in sheep's clothing?</div>
        <div class="menu">
          <button class="btn red big" data-act="play">Play</button>
          <div class="pair">
            <button class="btn green" data-act="farm">${farmLine}</button>
            <button class="btn gold" data-act="shop">Shop</button>
          </div>
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
  },

  exit() {},

  resize(w, h) {
    this.bg = titleBackdrop(w, h, this.app.dpr);
    const scale = Math.max(0.7, Math.min(1.1, Math.min(w, h) / 600));
    this.world = paddockWorld({ x: 30, y: h * 0.32, w: w - 60, h: h * 0.38 }, [], this.fx);
    if (!this.sheep.length) {
      const pool = db.breeds.filter((b) => b.inRounds && b.minTier <= 1);
      for (let i = 0; i < 5; i++) {
        const b = i === 0 ? db.breeds[0] : pick(pool);
        const sh = new Sheep({ ...b.look }, 40 + Math.random() * (w - 80), h * 0.35 + Math.random() * h * 0.32, scale);
        sh.heading = Math.random() * Math.PI * 2;
        sh.appearDelay = i * 0.12;
        this.sheep.push(sh);
      }
    }
    for (const sh of this.sheep) {
      sh.scale = scale;
      const c = this.world.clamp(sh.x, sh.y, 30);
      sh.x = c.x; sh.y = c.y;
    }
    this.world.others = this.sheep;
  },

  pointer(e) {
    if (e.type !== 'down') return;
    for (let i = this.sheep.length - 1; i >= 0; i--) {
      if (this.sheep[i].hit(e.x, e.y)) { this.sheep[i].pet(this.fx); this.app.sfx.baa(1 + Math.random() * 0.2); return; }
    }
  },

  update(dt) {
    for (const sh of this.sheep) sh.updateFarm(dt, this.world);
    sortByDepth(this.sheep);
    this.fx.update(dt);
  },

  draw(ctx) {
    if (this.bg) ctx.drawImage(this.bg.canvas, 0, 0, this.app.w, this.app.h);
    for (const sh of this.sheep) sh.draw(ctx);
    this.fx.draw(ctx);
  },
};
