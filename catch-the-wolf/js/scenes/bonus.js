// Wolf Stampede: the change-up after each day. An empty pen, unmasked wolves
// dashing about, a short countdown. Tap as many as you can; each is a pelt.
// Fast and silly on purpose. Tuning lives in data/world.json → bonus.

import { db, calendarFor } from '../game/rules.js';
import { drawWolf } from '../art/render.js';
import { Particles } from '../engine/particles.js';
import { freeCanvas } from '../engine/sprites.js';
import { rand, clamp, pick, ease } from '../engine/util.js';
import { playBackdrop } from './backdrop.js';
import { el, banner, hudPelts, bumpPelts, celebrate } from './ui.js';
import { noteStampede, checkAchievements } from '../game/achievements.js';

const FURS = ['grey', 'grey', 'black', 'white'];

export const bonusScene = {
  enter(app) {
    this.app = app;
    this.fx = new Particles();
    this.wolves = [];
    this.pops = [];
    this.caught = 0;
    this.cfg = db.world.bonus;
    this.phase = 'intro';
    this.t = 0;
    this.left = this.cfg.seconds;
    this.cal = calendarFor(app.save.data.streak);
    this.ui = el(`
      <div class="passthrough">
        <div class="hud">
          ${hudPelts(app.save.data.pelts)}
          <div class="spacer"></div>
          <div class="chip streak"><span><span class="label">Wolf stampede</span><span data-count>0 caught</span></span></div>
          <div class="spacer"></div>
        </div>
        <div class="stampede-bar"><div data-bar></div></div>
      </div>`);
    app.ui.append(this.ui);
    banner(app.ui, 'Wolf Stampede!', 'Tap every wolf you can!', 'good');
    app.sfx.howl();
  },

  exit() { freeCanvas(this.bg?.canvas); this.bg = null; },

  resize(w, h) {
    const top = 96, bottom = 30;
    const fw = Math.min(w - 36, 640);
    this.field = { x: (w - fw) / 2, y: top, w: fw, h: Math.max(240, h - top - bottom) };
    freeCanvas(this.bg?.canvas);
    this.bg = playBackdrop(w, h, this.app.dpr, this.field, this.cal.season.id);
    this.scale = clamp(fw / 430, 0.75, 1.25) * 0.85;
  },

  spawn() {
    const f = this.field, s = this.scale;
    // Burst in from a random side, heading inward.
    const side = Math.floor(Math.random() * 4);
    const x = side === 0 ? f.x + 10 : side === 1 ? f.x + f.w - 10 : rand(f.x + 40, f.x + f.w - 40);
    const y = side === 2 ? f.y + 10 : side === 3 ? f.y + f.h - 10 : rand(f.y + 60, f.y + f.h - 60);
    const toward = Math.atan2(f.x + f.w / 2 - x, -(f.y + f.h / 2 - y)) + rand(-0.6, 0.6);
    this.wolves.push({
      x, y, heading: toward, speed: rand(170, 280) * s, fur: pick(FURS), t: rand(0, 5),
      turnIn: rand(0.4, 1.4), spin: 0, appear: 0,
    });
  },

  pointer(e) {
    if (e.type !== 'down' || this.phase !== 'run') return;
    let best = null, bestD = 50 * this.scale;
    for (const w of this.wolves) {
      const d = Math.hypot(w.x - e.x, w.y - e.y);
      if (d < bestD) { best = w; bestD = d; }
    }
    if (!best) return;
    const { app } = this;
    this.wolves = this.wolves.filter((w) => w !== best);
    this.caught++;
    app.save.data.pelts += this.cfg.peltsPerWolf;
    app.save.write();
    bumpPelts(this.ui, app.save.data.pelts);
    this.ui.querySelector('[data-count]').textContent = `${this.caught} caught`;
    this.fx.sparkle(best.x, best.y, this.scale, 12);
    this.fx.burstWool(best.x, best.y, 'ash', this.scale * 0.6, 6);
    this.pops.push({ x: best.x, y: best.y, t: 0, text: `+${this.cfg.peltsPerWolf}` });
    app.sfx.coin();
    app.haptic(15);
    // Keep the pen busy.
    setTimeout(() => { if (this.phase === 'run') this.spawn(); }, 350);
  },

  update(dt) {
    this.t += dt;
    this.fx.update(dt);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.9);
    if (this.phase === 'intro') {
      if (this.t > 1.6) {
        this.phase = 'run'; this.t = 0;
        for (let i = 0; i < this.cfg.maxWolves; i++) setTimeout(() => this.spawn(), i * 180);
      }
      return;
    }
    if (this.phase === 'run') {
      this.left = Math.max(0, this.cfg.seconds - this.t);
      this.ui.querySelector('[data-bar]').style.width = `${(this.left / this.cfg.seconds) * 100}%`;
      if (this.left <= 0) this.finish();
    }
    const f = this.field, s = this.scale;
    for (const w of this.wolves) {
      w.t += dt;
      w.appear = Math.min(1, w.appear + dt * 4);
      // Silly zig-zags: sudden swerves, the odd speed burst.
      w.turnIn -= dt;
      if (w.turnIn <= 0) {
        w.heading += rand(-1.6, 1.6);
        w.speed = clamp(w.speed * rand(0.8, 1.35), 150 * s, 360 * s);
        w.turnIn = rand(0.35, 1.2);
      }
      w.x += Math.sin(w.heading) * w.speed * dt;
      w.y -= Math.cos(w.heading) * w.speed * dt;
      // Bounce off the fence.
      const pad = 30 * s;
      if (w.x < f.x + pad || w.x > f.x + f.w - pad) { w.heading = -w.heading; w.x = clamp(w.x, f.x + pad, f.x + f.w - pad); }
      if (w.y < f.y + pad || w.y > f.y + f.h - pad) { w.heading = Math.PI - w.heading; w.y = clamp(w.y, f.y + pad, f.y + f.h - pad); }
    }
  },

  finish() {
    this.phase = 'done';
    const { app } = this;
    // The rest scatter off the field.
    for (const w of this.wolves) w.speed *= 1.6;
    setTimeout(() => { this.wolves = []; }, 700);
    const n = this.caught * this.cfg.peltsPerWolf;
    const newSeason = this.cal.set === 0 && this.cal.slot === 0 && this.cal.round === 0;
    noteStampede(app.save.data, this.caught);
    const got = checkAchievements(app.save.data);
    app.save.write();
    setTimeout(() => celebrate(app, got), 500);
    const panel = el(`
      <div class="scrim"><div class="panel" role="dialog" aria-modal="true" aria-label="Stampede over">
        <h2>Stampede over!</h2>
        <p>You caught <b>${this.caught} wolf${this.caught === 1 ? '' : 'ves'}</b>${n ? ` for <b>+${n} pelt${n === 1 ? '' : 's'}</b>` : ''}.</p>
        <p style="font-size:15px">${newSeason ? `${this.cal.season.name} is here!` : `Back to ${this.cal.season.name} ${this.cal.time.name.toLowerCase()}, day ${this.cal.set + 1}.`} The hunt goes on, and so does the risk!</p>
        <div class="row"><button class="btn red big" data-go>${newSeason ? `On to ${this.cal.season.name}!` : 'Back to the hunt!'}</button></div>
      </div></div>`);
    app.ui.append(panel);
    app.sfx.baa(1.1);
    panel.querySelector('[data-go]').onclick = () => { app.sfx.tap(); app.go('play'); };
  },

  draw(ctx) {
    const { app } = this;
    if (this.bg) ctx.drawImage(this.bg.canvas, 0, 0, app.w, app.h);
    const sorted = [...this.wolves].sort((a, b) => a.y - b.y);
    for (const w of sorted) {
      const bob = Math.abs(Math.sin(w.t * 16)) * 4 * this.scale;
      drawWolf(ctx, w.fur, w.x, w.y - bob, this.scale * ease.outBack(w.appear), w.heading, { run: Math.sin(w.t * 16) }, this.scale);
    }
    this.fx.draw(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    for (const p of this.pops) {
      const a = 1 - p.t / 0.9;
      ctx.globalAlpha = a;
      ctx.font = `400 ${Math.round(26 + p.t * 10)}px "Lilita One", system-ui, sans-serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = '#262a3b'; ctx.fillStyle = '#fff4a8';
      ctx.strokeText(p.text, p.x, p.y - 30 - p.t * 50); ctx.fillText(p.text, p.x, p.y - 30 - p.t * 50);
    }
    ctx.restore();
  },
};
