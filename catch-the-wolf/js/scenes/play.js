// Find the wolf. One round = one flock with one disguised wolf.
// Phases: 'hunt' (tap away) → 'reveal' (caught it) or 'missed' (tapped a
// sheep) → next round. Rules live in game/rules.js; this file is staging.

import { makeRound, catchWolf, mistake, canHint, spendHint, db, tierFor } from '../game/rules.js';
import { Sheep, sortByDepth } from '../game/critter.js';
import { drawWolf } from '../art/render.js';
import { Particles } from '../engine/particles.js';
import { Timers, rand, clamp, ease, shuffle } from '../engine/util.js';
import { peltURL, sheepURL } from '../art/icons.js';
import { playBackdrop } from './backdrop.js';
import { el, banner, hudPelts, bumpPelts, flyPelt } from './ui.js';

const MAX_FIELD_W = 640;

export const playScene = {
  enter(app) {
    this.app = app;
    this.fx = new Particles();
    this.timers = new Timers();
    this.sheep = [];
    this.wolf = null;
    this.phase = 'idle';
    this.buildUI();
    this.layoutReady = false;
    this.pendingRound = true;
  },

  exit() { this.timers.clear(); },

  buildUI() {
    const { app } = this;
    const s = app.save.data;
    this.ui = el(`
      <div class="passthrough">
        <div class="hud">
          ${hudPelts(s.pelts)}
          <div class="spacer"></div>
          <div class="chip streak" data-streak><span><span class="label" data-tier></span><span data-streakn></span></span></div>
          <div class="spacer"></div>
          <button class="btn icon" data-act="settings" aria-label="Settings">⚙</button>
        </div>
        <div class="bottombar">
          <button class="btn small" data-act="menu">◀ Menu</button>
          <div class="spacer"></div>
          <button class="btn small sky" data-act="hint" title="Sniff out half the flock">👃 Sniff <img src="${peltURL()}" alt="">${db.game.hint.cost}</button>
          <div class="spacer"></div>
          <button class="btn small gold" data-act="shop">Shop</button>
        </div>
      </div>`);
    app.ui.append(this.ui);
    this.ui.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      app.sfx.tap();
      if (act === 'menu') app.go('title');
      if (act === 'shop') app.go('shop');
      if (act === 'settings') app.openSettings();
      if (act === 'hint') this.useHint();
    });
    this.refreshHud();
  },

  refreshHud() {
    const s = this.app.save.data;
    const tier = tierFor(s.streak);
    this.ui.querySelector('[data-streakn]').textContent = `Streak ${s.streak}`;
    this.ui.querySelector('[data-tier]').textContent = tier.name;
    this.ui.querySelector('[data-pelts]').textContent = s.pelts;
    const hint = this.ui.querySelector('[data-act="hint"]');
    const innocents = this.sheep.filter((x) => !x.isWolf && !x.leaving).length;
    hint.disabled = this.phase !== 'hunt' || this.hinted || !canHint(s) || innocents < 2;
    const cheapest = Math.min(...db.breeds.filter((b) => b.price != null).map((b) => b.price));
    this.ui.querySelector('[data-act="shop"]').classList.toggle('pulse', s.pelts >= cheapest);
  },

  resize(w, h) {
    const top = 78, bottom = 86;
    const fw = Math.min(w - 36, MAX_FIELD_W);
    this.field = { x: (w - fw) / 2, y: top + 8, w: fw, h: Math.max(200, h - top - bottom - 16) };
    this.bg = playBackdrop(w, h, this.app.dpr, this.field);
    if (this.pendingRound) { this.pendingRound = false; this.startRound(true); }
    else this.placeSheep(false);
  },

  // ---- rounds ----------------------------------------------------------------
  startRound(first = false) {
    const s = this.app.save.data;
    this.round = makeRound(s.streak);
    this.hinted = false;
    this.sheep = this.round.sheep.map((d) => {
      const c = new Sheep(d.look, 0, 0, 1);
      c.isWolf = d.isWolf;
      return c;
    });
    this.motion = new Set(this.round.tier.motion);
    this.placeSheep(true);
    this.phase = 'hunt';
    this.refreshHud();
    if (first && !s.seenHowTo) this.showHowTo();
  },

  // Fit the flock into the field: pick the column count that gives the biggest
  // sheep, scatter them over random cells with a little jitter.
  placeSheep(fresh) {
    const f = this.field, n = this.sheep.length;
    if (!n) return;
    let best = null;
    for (let cols = 1; cols <= 7; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = f.w / cols, ch = f.h / rows;
      const scale = Math.min(cw / 96, ch / 132);
      if (!best || scale > best.scale) best = { cols, rows, cw, ch, scale };
    }
    const { cols, rows, cw, ch } = best;
    const scale = Math.min(best.scale, 1.2);
    // Spare cells let the flock look scattered rather than gridded.
    const cells = shuffle([...Array(cols * rows).keys()]).slice(0, n).sort((a, b) => a - b);
    this.sheep.forEach((sh, i) => {
      const cell = cells[i];
      const cx = f.x + (cell % cols + 0.5) * cw, cy = f.y + (Math.floor(cell / cols) + 0.5) * ch;
      const slackX = Math.max(0, cw - 96 * scale) / 2, slackY = Math.max(0, ch - 132 * scale) / 2;
      if (fresh || sh.jx === undefined) { sh.jx = rand(-1, 1); sh.jy = rand(-1, 1); }
      sh.x = sh.homeX = cx + sh.jx * slackX;
      sh.y = sh.homeY = cy + sh.jy * slackY + 8 * scale;
      sh.scale = scale;
      if (fresh) { sh.appear = 0; sh.appearDelay = 0.05 + i * 0.035; }
    });
    sortByDepth(this.sheep);
    if (fresh) this.timers.after(0.15, () => this.app.sfx.pop());
  },

  // ---- input -------------------------------------------------------------------
  pointer(e) {
    if (e.type !== 'down' || this.phase !== 'hunt') return;
    for (let i = this.sheep.length - 1; i >= 0; i--) {
      const sh = this.sheep[i];
      if (sh.leaving || !sh.hit(e.x, e.y)) continue;
      if (sh.isWolf) this.caught(sh); else this.missed(sh);
      return;
    }
  },

  caught(sh) {
    const { app } = this;
    this.phase = 'reveal';
    const result = catchWolf(app.save.data);
    app.save.write();
    app.haptic(30);
    this.unmask(sh, true);
    banner(app.ui, 'Gotcha!', this.round.tell.label, 'good');
    // The flock cheers.
    this.sheep.forEach((o, i) => { if (o !== sh) this.timers.after(0.25 + i * 0.04, () => { o.hop = 14 * o.scale; }); });
    this.timers.after(0.35, () => app.sfx.baa(1.15));
    this.timers.after(0.55, () => {
      flyPelt(app.ui, sh.x, sh.y - 30 * sh.scale, this.ui.querySelector('[data-pelts]').closest('.chip'), () => {
        app.sfx.coin();
        bumpPelts(this.ui, app.save.data.pelts);
      });
    });
    this.timers.after(1.9, () => {
      if (result.tierUp) banner(app.ui, result.tierUp.name, 'Bigger flock, sneakier wolves', 'good');
      if (result.promptShop) this.showShopPrompt();
      else this.nextRound(result.tierUp ? 0.9 : 0);
    });
  },

  missed(sh) {
    const { app } = this;
    this.phase = 'missed';
    const wolfSheep = this.sheep.find((x) => x.isWolf);
    const result = mistake(app.save.data);
    app.save.write();
    app.haptic(80);
    app.sfx.wrong();
    this.timers.after(0.15, () => app.sfx.baa(0.85));
    // The innocent sheep shakes its head indignantly.
    sh.indignant = 0.9;
    banner(app.ui, "That's a sheep!", 'Watch the wolf…', 'bad');
    this.timers.after(1.1, () => this.unmask(wolfSheep, false));
    this.timers.after(2.6, () => this.showMissed(result));
    this.refreshHud();
  },

  // Pop the costume: wool flies, the wolf looks up guiltily, then bolts.
  unmask(sh, caught) {
    const { app } = this;
    app.sfx.poof();
    this.fx.burstWool(sh.x, sh.y - 6 * sh.scale, sh.look.wool, sh.scale, 16);
    this.fx.sparkle(sh.x, sh.y - 20 * sh.scale, sh.scale, caught ? 12 : 4);
    sh.gone = true;
    this.wolf = { fur: sh.look.wolfFur || 'grey', x: sh.x, y: sh.y - 4 * sh.scale, scale: sh.scale, t: 0, heading: 0, run: false, caught };
    this.timers.after(caught ? 0.9 : 0.7, () => {
      app.sfx.howl();
      const w = this.wolf;
      // Bolt for the nearest side edge.
      w.run = true;
      w.dir = w.x < this.app.w / 2 ? -1 : 1;
    });
  },

  nextRound(delay = 0) {
    this.timers.after(delay, () => {
      // Old flock pops out, new one pops in.
      this.sheep.forEach((o, i) => { o.leaving = true; o.leaveDelay = i * 0.02; });
      this.timers.after(0.45, () => { this.wolf = null; this.startRound(); });
    });
  },

  useHint() {
    const s = this.app.save.data;
    if (this.phase !== 'hunt' || this.hinted || !spendHint(s)) return;
    this.app.save.write();
    this.hinted = true;
    const innocents = shuffle(this.sheep.filter((x) => !x.isWolf));
    innocents.slice(0, Math.floor(innocents.length / 2)).forEach((o, i) => {
      o.leaving = true; o.leaveDelay = i * 0.05; o.sniffed = true;
    });
    this.app.sfx.baa(1.05);
    bumpPelts(this.ui, s.pelts);
    this.refreshHud();
  },

  // ---- dialogs -------------------------------------------------------------------
  showHowTo() {
    const { app } = this;
    this.phase = 'paused';
    const tellLook = { wool: 'cream', face: 'cream' };
    const row = [1, 2, 3].map((i) => `<img src="${sheepURL('howto', tellLook, 64)}" width="64" alt="sheep">`).join('')
      + `<span style="position:relative;display:inline-block"><img src="${sheepURL('howto-wolf', { ...tellLook, wolfFur: 'grey', tells: { ears: 'wolf' } }, 64)}" width="64" alt="the wolf">`
      + `<span style="position:absolute;inset:-4px;border:4px solid var(--red);border-radius:50%"></span></span>`;
    const panel = el(`
      <div class="scrim"><div class="panel">
        <h2>Find the wolf!</h2>
        <div style="display:flex;justify-content:center;gap:4px;margin:8px 0">${row}</div>
        <p>One sheep in every flock is a <b>wolf in disguise</b>. Look for the one detail that doesn't belong: pointy ears, a bushy tail, yellow eyes…</p>
        <p>Tap the wolf to catch it and win its pelt. Tap a real sheep and your streak resets.</p>
        <button class="btn red big" data-ok>Let's hunt!</button>
      </div></div>`);
    app.ui.append(panel);
    panel.querySelector('[data-ok]').onclick = () => {
      app.sfx.tap();
      app.save.data.seenHowTo = true;
      app.save.write();
      panel.remove();
      this.phase = 'hunt';
      this.refreshHud();
    };
  },

  showShopPrompt() {
    const { app } = this;
    const panel = el(`
      <div class="scrim"><div class="panel">
        <img class="art" src="${sheepURL('prompt', { wool: 'cream', face: 'cream' }, 96)}" width="96" alt="">
        <h2>Congratulations!</h2>
        <p>You've collected <b>${app.save.data.pelts} pelts</b>, enough to buy your first sheep. Visit the shop now?</p>
        <div class="row">
          <button class="btn gold" data-shop>Go to Shop</button>
          <button class="btn" data-go>Keep hunting</button>
        </div>
      </div></div>`);
    app.ui.append(panel);
    panel.querySelector('[data-shop]').onclick = () => { app.sfx.tap(); app.go('shop'); };
    panel.querySelector('[data-go]').onclick = () => { app.sfx.tap(); panel.remove(); this.nextRound(); };
  },

  showMissed({ lostPelts, lostStreak }) {
    const { app } = this;
    const lines = [];
    if (lostStreak > 0) lines.push(`Your streak of <b>${lostStreak}</b> is over.`);
    if (lostPelts > 0) lines.push(`The wolf ran off with <b>${lostPelts} pelt${lostPelts === 1 ? '' : 's'}</b>!`);
    const panel = el(`
      <div class="scrim"><div class="panel">
        <h2>Baa-d luck!</h2>
        <p>The wolf gave itself away with <b>${this.round.tell.label.replace(/!$/, '').toLowerCase()}</b>.</p>
        ${lines.length ? `<p>${lines.join(' ')}</p>` : '<p>Look for the one that doesn\'t fit.</p>'}
        <div class="row">
          <button class="btn red big" data-again>Hunt again</button>
        </div>
      </div></div>`);
    app.ui.append(panel);
    panel.querySelector('[data-again]').onclick = () => { app.sfx.tap(); panel.remove(); this.nextRound(); };
  },

  // ---- frame -------------------------------------------------------------------
  update(dt) {
    this.timers.update(dt);
    this.fx.update(dt);
    for (const sh of this.sheep) {
      if (sh.leaving) {
        sh.leaveDelay -= dt;
        if (sh.leaveDelay <= 0) {
          if (sh.sniffed) {
            // Sniffed-out sheep trot off the field, fading.
            sh.alpha = Math.max(0, sh.alpha - dt * 1.6);
            sh.y += 90 * sh.scale * dt; sh.pose.step = Math.sin(sh.t * 14);
            sh.t += dt;
          } else {
            sh.appear = Math.max(0, sh.appear - dt * 4);
          }
        }
        continue;
      }
      sh.updateIdle(dt, this.motion);
      if (sh.indignant > 0) {
        sh.indignant -= dt;
        sh.pose.headAngle = Math.sin(sh.indignant * 26) * 0.35 * Math.min(1, sh.indignant * 2);
        sh.pose.eyes = 'half';
      }
    }
    const w = this.wolf;
    if (w) {
      w.t += dt;
      if (w.run) {
        w.heading += (w.dir * Math.PI / 2 - w.heading) * clamp(dt * 8, 0, 1);
        w.x += w.dir * 520 * w.scale * dt * Math.min(1, w.t);
      }
    }
  },

  draw(ctx) {
    const { app } = this;
    if (this.bg) ctx.drawImage(this.bg.canvas, 0, 0, app.w, app.h);
    for (const sh of this.sheep) sh.draw(ctx);
    const w = this.wolf;
    if (w) {
      const pop = ease.outBack(Math.min(1, w.t * 3));
      drawWolf(ctx, w.fur, w.x, w.y - (w.run ? Math.abs(Math.sin(w.t * 18)) * 5 : 0), w.scale * 1.05 * pop, w.heading,
        { run: w.run ? Math.sin(w.t * 18) : 0, look: w.run ? 'ahead' : 'up' });
    }
    this.fx.draw(ctx);
  },
};
