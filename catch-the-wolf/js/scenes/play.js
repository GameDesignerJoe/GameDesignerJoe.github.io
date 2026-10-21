// Find the wolf. One round = one flock with one disguised wolf.
// Phases: 'hunt' (tap away) → 'reveal' (caught it) or 'missed' (tapped a
// sheep) → next round. Rules live in game/rules.js; this file is staging.

import { makeRound, catchWolf, mistake, canHint, spendHint, hintCost, db, storeRound, restoreRound, clearRound, calendarFor, isHungryRound } from '../game/rules.js';
import { checkAchievements } from '../game/achievements.js';
import { Atmosphere } from '../engine/atmosphere.js';
import { tellCardURL } from '../art/tellcard.js';
import { Sheep, sortByDepth, PROFILES } from '../game/critter.js';
import { paddockWorld } from '../game/world.js';
import { drawWolf } from '../art/render.js';
import { Particles } from '../engine/particles.js';
import { freeCanvas } from '../engine/sprites.js';
import { Timers, rand, clamp, ease, shuffle } from '../engine/util.js';
import { peltURL, sheepURL } from '../art/icons.js';
import { playBackdrop } from './backdrop.js';
import { el, banner, hudPelts, bumpPelts, flyPelt, celebrate } from './ui.js';

const MAX_FIELD_W = 640;
const cheapestSheep = () => Math.min(...db.breeds.filter((b) => b.price != null).map((b) => b.price));

export const playScene = {
  enter(app) {
    this.app = app;
    this.fx = new Particles();
    this.timers = new Timers();
    this.sheep = [];
    this.wolf = null;
    this.ring = null;
    this.focus = null;
    this.phase = 'idle';
    this.buildUI();
    this.layoutReady = false;
    this.pendingRound = true;
  },

  exit() {
    // Bank the hidden clock so leaving can't reset the speed bonus.
    const r = this.app.save.data.round;
    if (r && this.phase === 'hunt') { r.elapsed = this.huntT || 0; this.app.save.write(); }
    this.timers.clear(); freeCanvas(this.bg?.canvas); this.bg = null; this.bgSeason = null; this.sheep = []; this.wolf = null; this.ring = null; this.focus = null; this.hunger = null;
  },

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
          <button class="btn small sky" data-act="hint" title="Sniff out half the flock">👃 Sniff <img src="${peltURL()}" alt="pelts"><span data-hintcost></span></button>
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
    const cal = this.cal || calendarFor(s.streak);
    const W = db.world, wx = this.round?.weather;
    this.ui.querySelector('[data-streakn]').textContent = `Streak ${s.streak}`;
    this.ui.querySelector('[data-tier]').textContent = `${cal.time.icon} ${cal.season.name} ${cal.time.name}${wx && wx !== 'clear' ? ` · ${W.weatherIcons[wx]}` : ''}${this.hunger ? ' · 🍖 Hungry wolf' : ''}`;
    this.ui.querySelector('[data-pelts]').textContent = s.pelts;
    const hint = this.ui.querySelector('[data-act="hint"]');
    this.ui.querySelector('[data-hintcost]').textContent = hintCost(s);
    hint.disabled = this.phase !== 'hunt' || !canHint(s) || this.live().length <= (db.game.hint.minSheep ?? 2);
    // Press your luck: unbanked pelts are lost on a mistake.
    const chip = this.ui.querySelector('[data-pelts]').closest('.chip');
    chip.classList.toggle('at-risk', db.game.mistake.mode === 'classic' && s.pelts > 0);
    const cheapest = Math.min(...db.breeds.filter((b) => b.price != null).map((b) => b.price));
    this.ui.querySelector('[data-act="shop"]').classList.toggle('pulse', s.pelts >= cheapest);
  },

  resize(w, h) {
    const top = 78 + this.app.safe.top, bottom = 86 + this.app.safe.bottom;
    const fw = Math.min(w - 36, MAX_FIELD_W);
    this.field = { x: (w - fw) / 2, y: top + 8, w: fw, h: Math.max(200, h - top - bottom - 16) };
    this.paintBackdrop(true);
    this.world = paddockWorld(this.field, [], this.fx);
    this.atmo?.resize(w, h);
    if (this.pendingRound) { this.pendingRound = false; this.startRound(true); }
    else this.placeSheep(false);
    const wolf = this.wolf;
    if (wolf && !wolf.run && wolf.sheep) { wolf.x = wolf.sheep.x; wolf.y = wolf.sheep.y - 4 * wolf.sheep.scale; wolf.scale = wolf.sheep.scale; }
  },

  // Scenery follows the season; repaint only when it changes (or on resize).
  paintBackdrop(force = false) {
    const season = calendarFor(this.app.save.data.streak).season.id;
    if (!force && this.bgSeason === season) return;
    this.bgSeason = season;
    freeCanvas(this.bg?.canvas);
    this.bg = playBackdrop(this.app.w, this.app.h, this.app.dpr, this.field, season);
  },

  // ---- rounds ----------------------------------------------------------------
  // How many sheep fit in the field at the minimum readable scale.
  capacity() {
    const f = this.field, s = db.game.minSheepScale || 0.85;
    let best = 0;
    for (let cols = 1; cols <= 7; cols++) {
      const rows = Math.floor(f.h / (132 * s));
      if (f.w / cols >= 96 * s) best = Math.max(best, cols * rows);
    }
    return Math.max(3, best);
  },

  startRound(first = false) {
    const { app } = this;
    const s = app.save.data;
    const resumed = restoreRound(s);
    this.huntT = 0;
    if (resumed) {
      this.round = resumed.round;
      this.huntT = resumed.elapsed;
      if (!this.round.weather) this.round.weather = 'clear';
    } else {
      this.round = makeRound(s.streak, { colorSafe: s.settings.colorSafe, maxSheep: this.capacity(), runSeed: s.runSeed });
      storeRound(s, this.round, false);
      app.save.write();
    }
    this.sheep = this.round.sheep.map((d) => {
      const c = new Sheep(d.look, 0, 0, 1);
      c.isWolf = d.isWolf;
      return c;
    });
    this.motion = new Set(this.round.tier.motion);
    this.profile = PROFILES.field(this.round.tier.activity ?? 0.5);
    // Season, time of day and weather.
    const prevSeason = this.cal?.season.id;
    this.cal = calendarFor(s.streak);
    this.paintBackdrop();
    this.atmo = new Atmosphere({ light: this.cal.time.light, weather: this.round.weather, season: this.cal.season.id });
    this.atmo.resize(app.w, app.h);
    if (prevSeason && prevSeason !== this.cal.season.id) banner(app.ui, `${this.cal.season.name} arrives!`, 'A new season, new dangers', 'good');
    if (this.torchMode()) {
      this.torchTouch = this.torchTouch ?? matchMedia('(pointer: coarse)').matches;
      this.torchPos = { x: this.field.x + this.field.w / 2, y: this.field.y + this.field.h / 2 };
      this.press = null;
      if (first || this.cal.round === 0) banner(app.ui, 'Midnight!', 'Drag to shine your torch · tap to catch', 'good low');
    }
    // Once a day the wolf is hungry: it hunts the flock while you hunt it.
    this.hunger = isHungryRound(s.streak, s.runSeed) ? { rest: db.game.hungryWolf.startDelay, victim: null, bite: 0 } : null;
    if (this.hunger && !this.torchMode()) banner(app.ui, 'Hungry wolf!', 'It\'s eating the flock. Find it fast!', 'bad low');
    this.placeSheep(true);
    this.phase = 'hunt';
    this.refreshHud();
    if (first && !s.seenHowTo) this.showHowTo();
  },

  // Fit the flock into the field: pick the column count that gives the biggest
  // sheep, scatter them over random cells with a little jitter.
  live() { return this.sheep.filter((x) => !x.leaving && !x.gone); },

  placeSheep(fresh) {
    const f = this.field, n = this.sheep.length;
    if (!n) return;
    // On resize, wandering sheep keep their relative spot in the field.
    if (!fresh && this.lastField) {
      const pf = this.lastField;
      const k = Math.min(f.w / pf.w, f.h / pf.h);
      for (const sh of this.sheep) {
        sh.x = f.x + ((sh.x - pf.x) / pf.w) * f.w; sh.y = f.y + ((sh.y - pf.y) / pf.h) * f.h;
        sh.tx = sh.x; sh.ty = sh.y; sh.scale *= k;
      }
      this.lastField = { ...f };
      this.world.others = this.sheep;
      return;
    }
    this.lastField = { ...f };
    let best = null;
    for (let cols = 1; cols <= 7; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = f.w / cols, ch = f.h / rows;
      const scale = Math.min(cw / 96, ch / 132);
      if (!best || scale > best.scale) best = { cols, rows, cw, ch, scale };
    }
    const { cols, rows, cw, ch } = best;
    // A little smaller than a tight fit, so the flock has room to wander.
    const scale = Math.min(best.scale * 0.88, 1.15);
    // Spare cells let the flock look scattered rather than gridded. Cells are
    // kept across resizes unless the grid shape itself changes (rotation).
    const gridKey = `${cols}x${rows}`;
    if (fresh || this.gridKey !== gridKey) {
      const cells = shuffle([...Array(cols * rows).keys()]).slice(0, n).sort((a, b) => a - b);
      this.sheep.forEach((sh, i) => { sh.cell = cells[i]; });
      this.gridKey = gridKey;
    }
    this.sheep.forEach((sh, i) => {
      if (sh.leaving && !fresh) { sh.scale = scale; return; }
      const cell = sh.cell;
      const cx = f.x + (cell % cols + 0.5) * cw, cy = f.y + (Math.floor(cell / cols) + 0.5) * ch;
      const slackX = Math.max(0, cw - 96 * scale) / 2, slackY = Math.max(0, ch - 132 * scale) / 2;
      if (fresh || sh.jx === undefined) { sh.jx = rand(-1, 1); sh.jy = rand(-1, 1); }
      sh.x = sh.tx = cx + sh.jx * slackX;
      sh.y = sh.ty = cy + sh.jy * slackY + 8 * scale;
      sh.scale = scale;
      sh.heading = rand(-0.5, 0.5);
      sh.stateT = rand(0.5, 2.5);
      if (fresh) { sh.appear = 0; sh.appearDelay = 0.05 + i * 0.035; }
    });
    sortByDepth(this.sheep);
    this.world.others = this.sheep;
    if (fresh) this.timers.after(0.15, () => this.app.sfx.pop());
  },

  // ---- input -------------------------------------------------------------------
  pointer(e) {
    // Midnight: the pointer is a torch. Dragging (or hovering a mouse) moves
    // the light; only a quick, nearly-still tap picks a sheep, so searching
    // never catches anything by accident.
    if (this.torchMode()) {
      // On a touch screen the beam is bigger and sits above the fingertip, so
      // the finger doesn't cover what it's lighting (world.json touchRadius/touchLift).
      if (e.type === 'down' || e.type === 'move') {
        const L = this.cal.time.light, side = Math.min(this.app.w, this.app.h);
        this.torchTouch = !!e.touch;
        this.torchPos = { x: e.x, y: e.y - (e.touch ? (L.touchLift || 0) * side : 0) };
      }
      if (e.type === 'down') this.press = { x: e.x, y: e.y, t: performance.now(), id: e.id };
      if (e.type === 'up' && this.press && this.press.id === e.id) {
        const p = this.press;
        this.press = null;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 14 && performance.now() - p.t < 450) this.pickAt(e.x, e.y);
      }
      return;
    }
    if (e.type === 'down') this.pickAt(e.x, e.y);
  },

  torchMode() { return !!this.cal?.time.light?.torch; },

  pickAt(x, y) {
    if (this.phase !== 'hunt') return;
    // Overlapping hit areas: the sheep whose centre is nearest wins.
    let best = null, bestScore = 1;
    for (const sh of this.sheep) {
      if (sh.leaving) continue;
      const sc = sh.hitScore(x, y);
      if (sc <= bestScore) { best = sh; bestScore = sc; }
    }
    if (best) this.choose(best);
  },

  choose(sh) {
    this.focus = null;
    if (sh.isWolf) this.caught(sh); else this.missed(sh);
  },

  // Keyboard play: arrows move a selection ring between sheep, Enter/Space picks.
  key(e) {
    if (this.phase !== 'hunt' || this.app.ui.querySelector('.scrim')) return;
    const live = this.sheep.filter((x) => !x.leaving);
    if (!live.length) return;
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.key]) {
      e.preventDefault();
      const cur = live.includes(this.focus) ? this.focus : null;
      if (!cur) { this.focus = live[0]; return; }
      const [dx, dy] = dirs[e.key];
      let best = null, bestD = Infinity;
      for (const o of live) {
        if (o === cur) continue;
        const vx = o.x - cur.x, vy = o.y - cur.y;
        const along = vx * dx + vy * dy;
        if (along <= 4) continue;
        const d = along + Math.abs(vx * dy - vy * dx) * 2;
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) this.focus = best;
      if (this.focus) this.torchPos = { x: this.focus.x, y: this.focus.y };
    } else if ((e.key === 'Enter' || e.key === ' ') && live.includes(this.focus)) {
      e.preventDefault();
      this.choose(this.focus);
    }
  },

  caught(sh) {
    const { app } = this;
    this.phase = 'reveal';
    // Dark rounds stretch the hidden speed window (world.json quickTime).
    const result = catchWolf(app.save.data, this.huntT / (this.cal.time.quickTime || 1), this.round.tell);
    clearRound(app.save.data);
    const got = checkAchievements(app.save.data);
    app.save.write();
    this.timers.after(1.4, () => celebrate(app, got));
    app.haptic(30);
    this.refreshHud();
    this.unmask(sh, true);
    // Speed is rewarded but never timed on screen: the praise says it all.
    const cheer = result.mult === 3 ? 'Lightning fast!' : result.mult === 2 ? 'Quick catch!' : 'Gotcha!';
    banner(app.ui, `${cheer} +${result.gained}`, this.round.tell.label, this.bannerSide(sh, 'good'));
    this.pendingBonus = result.bonus;
    if (result.newRecord) this.timers.after(1.2, () => banner(app.ui, 'New record!', `Streak of ${app.save.data.streak}`, 'good'));
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
    clearRound(app.save.data);
    app.save.write();
    app.haptic(80);
    // Ring the wolf so the player sees what they missed before it unmasks.
    this.ring = { sheep: wolfSheep, t: 0 };
    app.sfx.wrong();
    this.timers.after(0.15, () => app.sfx.baa(0.85));
    // The innocent sheep shakes its head indignantly.
    sh.indignant = 0.9;
    banner(app.ui, "That's a sheep!", 'Watch the wolf…', this.bannerSide(wolfSheep, 'bad'));
    this.timers.after(1.3, () => { this.ring = null; this.unmask(wolfSheep, false); });
    this.timers.after(2.6, () => this.showMissed(result));
    // The HUD keeps showing the lost streak/pelts until the panel explains it.
  },

  // Pop the costume: wool flies, the wolf looks up guiltily, then bolts.
  unmask(sh, caught) {
    const { app } = this;
    app.sfx.poof();
    this.fx.burstWool(sh.x, sh.y - 6 * sh.scale, sh.look.wool, sh.scale, 16);
    this.fx.sparkle(sh.x, sh.y - 20 * sh.scale, sh.scale, caught ? 12 : 4);
    sh.gone = true;
    this.wolf = { sheep: sh, fur: sh.look.wolfFur || 'grey', x: sh.x, y: sh.y - 4 * sh.scale, scale: sh.scale, t: 0, heading: 0, run: false, caught };
    this.timers.after(caught ? 0.9 : 0.7, () => {
      app.sfx.howl();
      const w = this.wolf;
      // Bolt for the nearest side edge.
      w.run = true;
      w.dir = w.x < this.app.w / 2 ? -1 : 1;
    });
  },

  // Keep banners off the sheep that matters: top of the screen unless it's up there.
  bannerSide(sh, kind) {
    return `${kind}${sh.y < this.app.h * 0.45 ? ' low' : ''}`;
  },

  nextRound(delay = 0) {
    // After each day (world.json bonusEvery): the Wolf Stampede change-up.
    if (this.pendingBonus) {
      this.pendingBonus = false;
      this.timers.after(delay + 0.4, () => this.app.go('bonus'));
      return;
    }
    this.timers.after(delay, () => {
      // Old flock pops out, new one pops in.
      this.sheep.forEach((o, i) => { o.leaving = true; o.leaveDelay = i * 0.02; });
      this.timers.after(0.45, () => { this.wolf = null; this.startRound(); });
    });
  },

  // Sniff: each use sends away half the flock (never the wolf), down to
  // hint.minSheep. Then you have to pick.
  useHint() {
    const s = this.app.save.data;
    const live = this.live();
    const floor = db.game.hint.minSheep ?? 2;
    if (this.phase !== 'hunt' || live.length <= floor || !spendHint(s)) return;
    const keep = Math.max(floor, Math.ceil(live.length / 2));
    const innocents = shuffle(live.filter((x) => !x.isWolf));
    innocents.slice(0, live.length - keep).forEach((o, i) => {
      o.leaving = true; o.leaveDelay = i * 0.05; o.sniffed = true;
    });
    // Remember who's left so leaving and coming back can't undo the sniff.
    if (s.round) s.round.sheep = this.live().map((x) => ({ look: x.look, isWolf: x.isWolf }));
    this.app.save.write();
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
        <p>Tap the wolf to win its pelt. Bigger flocks pay more, but tap a real sheep and the wolf runs off with <b>every pelt you're holding</b>. Spend them in the shop to keep them safe!</p>
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
        <p>You're holding <b>${app.save.data.pelts} pelts</b>, enough for your first sheep. One wrong tap and they're gone, so bank them in the shop?</p>
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
    this.refreshHud();
    const lines = [];
    if (lostStreak > 0) lines.push(`Your streak of <b>${lostStreak}</b> is over.`);
    if (lostPelts > 0) lines.push(`The wolf ran off with <b>${lostPelts} pelt${lostPelts === 1 ? '' : 's'}</b>!`);
    const panel = el(`
      <div class="scrim"><div class="panel">
        <h2>Baa-d luck!</h2>
        <img class="tellcard" src="${tellCardURL(this.sheep.find((x) => x.isWolf)?.look || {})}" alt="A real sheep beside the wolf, with its slip circled">
        <p>The wolf gave itself away with <b>${this.round.tell.label.replace(/!$/, '').toLowerCase()}</b>.</p>
        ${lines.length ? `<p>${lines.join(' ')}</p>` : '<p>Look for the one that doesn\'t fit.</p>'}
        ${lostPelts >= cheapestSheep() ? '<p style="font-size:15px"><b>Tip:</b> spend pelts in the shop and they\'re safe forever.</p>' : ''}
        <p style="font-size:14px;opacity:.7">Best streak: ${app.save.data.bestStreak}</p>
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
    this.atmo?.update(dt);
    // Midnight: once the round is decided, lift the darkness so the reveal shows.
    if (this.atmo) this.atmo.reveal = this.phase === 'hunt' || this.phase === 'paused' ? 0 : Math.min(1, (this.atmo.reveal || 0) + dt * 2.5);
    // The hidden clock: only runs while you can actually hunt.
    const hunting = this.phase === 'hunt' && !this.app.ui.querySelector('.scrim') && document.visibilityState !== 'hidden';
    if (hunting && this.sheep.every((x) => x.appear >= 1 || x.leaving)) this.huntT += dt;
    if (hunting && this.hunger) this.updateHunger(dt);
    for (const sh of this.sheep) {
      if (sh.leaving) {
        sh.leaveDelay -= dt;
        if (sh.leaveDelay <= 0) {
          if (sh.eaten) {
            sh.alpha = Math.max(0, sh.alpha - dt * 1.2);
          } else if (sh.sniffed) {
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
      sh.update(dt, this.world, this.profile, this.motion);
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

  // Hungry wolf (one round a day, rules.isHungryRound): it stalks a sheep, and five seconds
  // of mouth-on-wool eats it. Costs a pelt each time. The nibbling is silent
  // and the victim just fades away, so nothing points at the wolf.
  updateHunger(dt) {
    const H = this.hunger, cfg = db.game.hungryWolf, { app } = this;
    const wolf = this.sheep.find((x) => x.isWolf && !x.leaving && !x.gone);
    if (!wolf) return;
    const prey = this.live().filter((x) => !x.isWolf);
    if (!H.victim || H.victim.leaving || H.victim.gone) {
      H.victim = null; H.bite = 0;
      H.rest -= dt;
      if (H.rest > 0 || !prey.length) return;
      H.victim = prey.reduce((a, b) => (Math.hypot(b.x - wolf.x, b.y - wolf.y) < Math.hypot(a.x - wolf.x, a.y - wolf.y) ? b : a));
    }
    const v = H.victim;
    // Stalk: keep walking at the victim.
    wolf.state = 'walk'; wolf.stateT = 2; wolf.tx = v.x; wolf.ty = v.y;
    const head = wolf.circles()[1];
    const touching = v.circles().some((c) => Math.hypot(c.x - head.x, c.y - head.y) < c.r + head.r + 6 * wolf.scale);
    H.bite = touching ? H.bite + dt : Math.max(0, H.bite - dt * 1.5);
    if (H.bite < cfg.biteSeconds) return;
    // Gulp.
    const s = app.save.data;
    const lost = Math.min(s.pelts, cfg.peltLoss);
    s.pelts -= lost;
    // A quiet fade (handled with the other leaving sheep), no burst.
    v.leaving = true; v.leaveDelay = 0; v.eaten = true;
    app.sfx.wrong();
    app.haptic(60);
    if (s.round) s.round.sheep = this.live().map((x) => ({ look: x.look, isWolf: x.isWolf }));
    app.save.write();
    banner(app.ui, 'A sheep was eaten!', lost ? `The wolf took ${lost} pelt${lost === 1 ? '' : 's'}` : 'Find that wolf!', 'bad');
    bumpPelts(this.ui, s.pelts);
    this.refreshHud();
    wolf.state = 'idle'; wolf.stateT = 1;
    H.victim = null; H.bite = 0; H.rest = rand(...cfg.rest);
  },

  draw(ctx) {
    const { app } = this;
    if (this.bg) ctx.drawImage(this.bg.canvas, 0, 0, app.w, app.h);
    const r = this.ring;
    if (r) {
      const sh = r.sheep, pulse = 1 + Math.sin(performance.now() / 90) * 0.06;
      ctx.save();
      ctx.lineWidth = 6; ctx.strokeStyle = '#ee5b3f';
      ctx.beginPath(); ctx.ellipse(sh.x, sh.y - 8 * sh.scale, 50 * sh.scale * pulse, 68 * sh.scale * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    }
    const f = this.focus;
    if (f && !f.leaving && this.phase === 'hunt') {
      ctx.save();
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -performance.now() / 40;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 8 * f.scale, 46 * f.scale, 64 * f.scale, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (const sh of this.sheep) sh.draw(ctx);
    const w = this.wolf;
    if (w) {
      const pop = ease.outBack(Math.min(1, w.t * 3));
      drawWolf(ctx, w.fur, w.x, w.y - (w.run ? Math.abs(Math.sin(w.t * 18)) * 5 : 0), w.scale * 1.05 * pop, w.heading,
        { run: w.run ? Math.sin(w.t * 18) : 0, look: w.run ? 'ahead' : 'up' }, w.scale * 1.05);
    }
    this.fx.draw(ctx);
    if (this.atmo) { this.atmo.torch = this.torchPos; this.atmo.torchTouch = this.torchTouch; this.atmo.draw(ctx); }
  },
};
