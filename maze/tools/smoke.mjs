#!/usr/bin/env node
// The Maze — behaviour smoke test.
//
// The other half of docs/HANDOFF.md §9: boot the page, tap the sleeper, walk,
// mark, save and reload, and check the movement values. §9 exists because the
// recentering ease went missing for two versions while every frame still
// rendered — so these assert what the game *does*, driven through real touch
// input, not what it draws.
//
// Also checks that every id the script reaches for actually exists, after the
// CSS range-replacement that once left the game paused on an invisible card.
//
//   node maze/tools/smoke.mjs [--port 8765] [--seed 4242] [--headed]
//
// Needs a static server on --port, e.g. python3 -m http.server 8765 from the repo root.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8765));
const SEED = Number(arg('seed', 4242));
const PAGE_URL = `http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=${SEED}`;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
  headless: !argv.includes('--headed'),
});
const ctx = await browser.newContext({
  viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
});

// Watch the loudest gain any node is set to, so the swing falloff (v0.35.0)
// can be measured from outside the audio module.
await ctx.addInitScript(() => {
  window.__peak = 0;
  window.__osc = 0;          // oscillators created — the drone and every music note make one
  window.__voices = [];      // {t, oscillator} per voice, so a note's voices can be grouped
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;
  class Probed extends Native {
    constructor(...a) {
      super(...a);
      const osc = this.createOscillator.bind(this);
      this.createOscillator = (...b) => { window.__osc++; const n = osc(...b);
        // every voice of one note is made in the same tick, so the tick groups them
        window.__voices.push({ t: performance.now(), n }); return n; };
      const g = this.createGain.bind(this);
      this.createGain = (...b) => {
        const n = g(...b);
        for (const m of ['setValueAtTime', 'linearRampToValueAtTime']) {
          const o = n.gain[m].bind(n.gain);
          n.gain[m] = (v, ...r) => { if (v > window.__peak) window.__peak = v; return o(v, ...r); };
        }
        return n;
      };
    }
  }
  window.AudioContext = Probed; window.webkitAudioContext = Probed;
});
const page = await ctx.newPage();
const pageErrors = [];
const fmtOf = (ms) => `${Math.floor(ms / 60000)}m ${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}s`;
page.on('pageerror', (e) => pageErrors.push(String(e)));

console.log('The Maze — behaviour smoke test');
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForTimeout(1400);

const version = await page.evaluate(() => VERSION);
console.log(`  game v${version} at ${PAGE_URL}\n`);

// ── 1. boots to the title screen, asleep ─────────────────────────
const boot = await page.evaluate(() => ({
  started, hasTitle: !!document.getElementById('title'),
  titleHidden: document.getElementById('title').classList.contains('hide'),
  pre: document.body.classList.contains('pre'),
  who: phase().who, zoom: zoomS, titleZoom: CONFIG.titleTilePx,
}));
check('boots to the title screen, asleep', !boot.started && boot.hasTitle && !boot.titleHidden && boot.pre,
  `started=${boot.started} pre=${boot.pre} zoom=${boot.zoom} (title zoom ${boot.titleZoom}) as ${boot.who}`);

// ── 2. every id the script reaches for exists ───────────────────
// The engine lives in js/*.js since v0.33.0; the shell still holds the markup.
const engineDir = new URL('../js/', import.meta.url);
const src = [readFileSync(new URL('../maze-topdown.html', import.meta.url), 'utf8')]
  .concat(readdirSync(engineDir).filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(new URL(f, engineDir), 'utf8')))
  .join('\n');
const ids = [...new Set([...src.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)].map((m) => m[1]))];
const idReport = await page.evaluate((list) => {
  const rules = new Set();
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) if (r.selectorText) rules.add(r.selectorText); }
    catch (e) { /* cross-origin sheet */ }
  }
  const css = [...rules].join(' ');
  return list.map((id) => ({ id, exists: !!document.getElementById(id), styled: css.includes('#' + id) }));
}, ids);
const missing = idReport.filter((r) => !r.exists);
check(`every $('id') in the script exists in the DOM (${ids.length} ids)`, missing.length === 0,
  missing.length ? `missing: ${missing.map((m) => m.id).join(', ')}` : '');
const unstyled = idReport.filter((r) => r.exists && !r.styled);
console.log(`          (${idReport.length - unstyled.length} of ${idReport.length} also have a CSS rule; `
  + `no rule for: ${unstyled.map((u) => u.id).join(', ') || 'none'})`);

// ── 2b. the script tags load in the order the engine expects ────
// 18 plain scripts sharing one global scope: order is load-bearing. Reordering
// them, or dropping one, breaks the game in ways a glance at the page will not
// show. Assert the sequence.
const shell = readFileSync(new URL('../maze-topdown.html', import.meta.url), 'utf8');
const tagOrder = [...shell.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const EXPECTED = [
  'data/config.js', 'data/phases.js', 'data/text.js', 'data/music.js',
  'js/core.js', 'js/generate.js', 'js/proto.js', 'js/audio.js', 'js/state.js', 'js/input.js',
  'js/stories.js', 'js/run-save.js', 'js/tutorials.js', 'js/pool.js', 'js/map.js',
  'js/movement.js', 'js/render.js', 'js/boot.js',
];
check('script tags load data first, then the engine in order',
  JSON.stringify(tagOrder) === JSON.stringify(EXPECTED),
  tagOrder.length === EXPECTED.length
    ? `${tagOrder.length} tags, in order`
    : `got ${tagOrder.length} tags: ${tagOrder.join(' ')}`);

// Every file the shell references must actually be there.
const onDisk = new Set([...readdirSync(new URL('../js/', import.meta.url)).map((f) => 'js/' + f),
  ...readdirSync(new URL('../data/', import.meta.url)).map((f) => 'data/' + f)]);
const absent = tagOrder.filter((t) => !onDisk.has(t));
const orphans = [...onDisk].filter((f) => f.endsWith('.js') && !tagOrder.includes(f));
check('every referenced script exists, and none is left unloaded', absent.length === 0 && orphans.length === 0,
  `${absent.length ? 'missing: ' + absent.join(', ') + '; ' : ''}`
  + `${orphans.length ? 'on disk but never loaded: ' + orphans.join(', ') : 'no orphans'}`);

// ── 2c. the stylesheet actually loaded ──────────────────────────
// Since v0.34.0 the CSS is an external file. A 404 on it leaves the game
// unstyled — canvas still renders, every other check here still passes, and
// nothing says why it looks wrong. So check the sheet is attached and full.
const sheet = await page.evaluate(() => {
  const link = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href'));
  let rules = 0, external = 0;
  for (const s of document.styleSheets) {
    if (s.href) external++;
    try { rules += s.cssRules.length; } catch (e) { /* unreadable over file:// */ }
  }
  return { link, external, rules, bodyBg: getComputedStyle(document.body).backgroundColor };
});
check('the external stylesheet loaded and parsed', 
  sheet.link.includes('css/style.css') && sheet.external === 1 && sheet.rules > 150,
  `link ${JSON.stringify(sheet.link)}, ${sheet.external} external sheet(s), `
  + `${sheet.rules} rules, body background ${sheet.bodyBg}`);

// ── 3. movement knobs are present and sane ──────────────────────
// The recentering incident: a block silently failed to insert and the values
// vanished. Assert they exist and are in the range the settled design needs.
const knobs = await page.evaluate(() => ({
  speed: CONFIG.speed, turnBufferMs: CONFIG.turnBufferMs, turnForgiveness: CONFIG.turnForgiveness,
  stickDeadzone: CONFIG.stickDeadzone, cameraLag: CONFIG.cameraLag, pushHoldMs: CONFIG.pushHoldMs,
  hasRecenterVar: typeof recenter !== 'undefined',
}));
const knobsOk = knobs.speed > 0 && knobs.turnBufferMs >= 100 && knobs.turnForgiveness > 0
  && knobs.stickDeadzone > 0 && knobs.stickDeadzone < 1 && knobs.cameraLag > 0 && knobs.pushHoldMs > 0
  && knobs.hasRecenterVar;
check('movement knobs present and in range', knobsOk, JSON.stringify(knobs));

// ── 4. tapping the sleeper starts the run ───────────────────────
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
});
await touch('touchStart', 215, 450);
await touch('touchEnd', 215, 450);
await page.waitForTimeout(3600);   // introSeconds 2.8 plus slack
const afterTap = await page.evaluate(() => ({
  started, pre: document.body.classList.contains('pre'),
  titleHidden: document.getElementById('title').classList.contains('hide'),
  zoom: Math.round(zoomS), tilePx: CONFIG.tilePx,
}));
check('tapping the sleeper begins the run and zooms out', afterTap.started && !afterTap.pre,
  `started=${afterTap.started} zoom=${afterTap.zoom} (play zoom ${afterTap.tilePx})`);

// ── 5. the stick walks, smoothly, on the centreline ─────────────
// Push north from the stick's centre and sample the player each frame.
const stick = await page.evaluate(() => {
  const r = document.getElementById('stick').getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});
const before = await page.evaluate(() => ({ x: player.x, y: player.y }));
await touch('touchStart', stick.cx, stick.cy);
const samples = [];
for (const dy of [-20, -45, -70, -70, -70, -70, -70, -70, -70, -70]) {
  await touch('touchMove', stick.cx, stick.cy + dy);
  await page.waitForTimeout(90);
  samples.push(await page.evaluate(() => ({ x: player.x, y: player.y, dir, held })));
}
await touch('touchEnd', stick.cx, stick.cy);
await page.waitForTimeout(260);
const after = await page.evaluate(() => ({ x: player.x, y: player.y }));

const moved = Math.hypot(after.x - before.x, after.y - before.y);
check('the stick moves the player', moved > 0.3,
  `from (${before.x.toFixed(2)}, ${before.y.toFixed(2)}) to (${after.x.toFixed(2)}, ${after.y.toFixed(2)}) — ${moved.toFixed(2)} tiles`);

// Continuity: no frame-to-frame jump big enough to be a snap.
let worst = 0;
for (let i = 1; i < samples.length; i++) {
  worst = Math.max(worst, Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
}
check('movement is continuous, not snapped', worst < 1.5,
  `largest step between samples: ${worst.toFixed(3)} tiles (a snap would land on a whole number)`);

// Centreline: walking north, x should sit near a tile centre (.5).
const offAxis = samples.map((s) => Math.abs((s.x % 1) - 0.5)).sort((a, b) => b - a)[0];
check('walking holds the corridor centreline', offAxis < 0.2,
  `worst off-centre while moving: ${offAxis.toFixed(3)} tiles from the .5 centreline`);

// ── 6. chalk leaves a permanent mark ────────────────────────────
const marked = await page.evaluate(() => {
  chalk = Math.max(chalk, 3);            // give ourselves a piece to spend
  const tx = Math.floor(player.x), ty = Math.floor(player.y);
  const key = tx + ',' + ty;
  const had = marks.size;
  marks.set(key, 'x');                   // the glyph picker's own effect
  saveRun(true);
  return { key, had, now: marks.size };
});
check('a chalk mark lands and is recorded', marked.now === marked.had + 1,
  `mark at ${marked.key}; marks ${marked.had} → ${marked.now}`);

// ── 7. save and reload resumes in place ─────────────────────────
const pre = await page.evaluate(() => {
  saveRun(true);
  return { x: player.x, y: player.y, marks: [...marks.keys()], steps, seed: SEED, phase: SAVE.phase };
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
const post = await page.evaluate(() => ({
  x: player.x, y: player.y, marks: [...marks.keys()], started, seed: SEED, phase: SAVE.phase,
}));
const samePos = Math.hypot(post.x - pre.x, post.y - pre.y) < 0.75;
const sameMarks = pre.marks.every((k) => post.marks.includes(k));
check('reload resumes the run in place', samePos && sameMarks && post.seed === pre.seed,
  `pos (${pre.x.toFixed(2)}, ${pre.y.toFixed(2)}) → (${post.x.toFixed(2)}, ${post.y.toFixed(2)}); `
  + `marks ${pre.marks.length} → ${post.marks.length} kept=${sameMarks}; seed ${pre.seed} → ${post.seed}`);

// ── 8. a pool level lays out and its stone opens the door ───────
const pool = await page.evaluate(() => {
  SAVE.poolPending = true;
  generate(99); sliding = null;   // the world is swapped by hand here; a slide in flight belongs to the old one
  const r = {
    poolMode, hasDoor: !!poolDoor, stone: keySpot,
    room: startRoom, pages: journals.size, dark: darkTiles.size,
    pools: POOLS.length, whoAtThisStone: POOLS[Math.min(SAVE.stones || 0, POOLS.length - 1)]?.who,
  };
  SAVE.poolPending = false;
  return r;
});
check('a pool level lays out with its stone and door', pool.poolMode && pool.hasDoor && !!pool.stone && pool.pages === 0,
  `door=${pool.hasDoor} stone=${pool.stone} pages=${pool.pages} dark=${pool.dark}; `
  + `${pool.pools} pools, this one hosts ${pool.whoAtThisStone}`);

// ── 7b. a resumed run still gets its music ──────────────────────
// restoreRun goes straight into the maze with no title, and the title tap was
// the only thing that ever called AUDIO.begin(). Every reload used to come
// back permanently silent — no drone, no composer, forever. Fixed in v0.36.0
// by starting the bed on the first gesture instead.
const resumedAudio = await page.evaluate(async () => {
  const before = window.__osc || 0;
  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 6500));
  return { before, after: window.__osc || 0, started };
});
check('a resumed run starts its music on the first touch',
  resumedAudio.after - resumedAudio.before > 4,
  `oscillators ${resumedAudio.before} → ${resumedAudio.after} `
  + `(+${resumedAudio.after - resumedAudio.before} after one gesture on a resumed run)`);

// ── 7c. Update app parks you on the mat with your progress ──────
// Pressing it mid-corridor used to resume you mid-corridor, so you never got
// the title tap and so never got sound back. It now keeps everything done and
// only drops where you were standing. pagehide and the 6s autosave both fire
// during the reload, so parking has to freeze saving or they write it back.
const parked = await page.evaluate(() => {
  const was = { steps, marks: marks.size, mapped: mapped.size, px: player.x, py: player.y };
  parkRunAtHome();
  return { was, run: { px: SAVE.run.px, py: SAVE.run.py, atHome: !!SAVE.run.atHome, steps: SAVE.run.steps },
    startTile: { x: start.x, y: start.y } };
});
// and a later save must not clobber it
const stuck = await page.evaluate(() => { saveRun(true); return { px: SAVE.run.px, atHome: !!SAVE.run.atHome }; });
check('Update app parks the run on the mat and keeps what you did',
  parked.run.atHome && parked.run.px === parked.startTile.x && parked.run.py === parked.startTile.y
    && parked.run.steps === parked.was.steps && stuck.atHome && stuck.px === parked.startTile.x,
  `stood at (${parked.was.px.toFixed(1)}, ${parked.was.py.toFixed(1)}), `
  + `parked at (${parked.run.px}, ${parked.run.py}), mat is (${parked.startTile.x}, ${parked.startTile.y}); `
  + `steps ${parked.was.steps} kept; survives a later saveRun: ${stuck.atHome}`);

// ── 8b. a swing you are nowhere near does not thump in your ear ──
// Swings move on their own anywhere in the maze. Before v0.35.0 every one of
// them played at full volume wherever you stood — on the Child level that was
// a low boom every 1.6s from something 25 tiles of walking away, loud enough
// to bury the music. Assert the falloff, not just that a sound happens.
const falloff = await page.evaluate(async () => {
  // stand out in the maze first. Whatever ran before may have left the player on the mat, and a
  // sealed start room is one tile of corridor to measure a falloff along.
  { const mid = solutionPath[Math.floor(solutionPath.length / 2)];
    if (mid) { player.x = mid[0] + 0.5; player.y = mid[1] + 0.5; } }
  const home = { x: Math.floor(player.x), y: Math.floor(player.y) };
  const tilesAt = [[0, [home.x, home.y]]];
  const seen = new Set([home.x + ',' + home.y]);
  let edge = [[home.x, home.y]];
  for (let n = 1; n <= CONFIG.sfxRangeTiles + 2 && edge.length; n++) {
    const next = [];
    for (const [cx, cy] of edge) for (const [dx, dy] of DIRS) {
      const ax = cx + dx, ay = cy + dy, k = ax + ',' + ay;
      if (seen.has(k) || !isOpen(ax, ay)) continue;
      seen.add(k); next.push([ax, ay]);
    }
    edge = next;
    if (edge.length) tilesAt.push([n, edge[0]]);
  }
  const was = { x: player.x, y: player.y };
  const rows = [];
  for (const [d, [tx, ty]] of tilesAt) {
    player.x = tx + 0.5; player.y = ty + 0.5;
    window.__peak = 0;
    AUDIO.swing(home.x, home.y);          // read synchronously; swing builds its nodes in this tick
    rows.push([d, +window.__peak.toFixed(4)]);
    await new Promise((r) => setTimeout(r, 20));
  }
  player.x = was.x; player.y = was.y;
  return { rows, near: CONFIG.sfxNearTiles, far: CONFIG.sfxRangeTiles };
});
const vols = falloff.rows.map(([, v]) => v);
const loudClose = vols[0] > 0.1;
const silentFar = falloff.rows.filter(([d]) => d >= falloff.far).every(([, v]) => v === 0);
const monotonic = vols.every((v, i) => i === 0 || v <= vols[i - 1] + 1e-9);
const reachedRange = falloff.rows.some(([d]) => d >= falloff.far);
check('a swing fades with distance and goes silent out of earshot',
  loudClose && silentFar && monotonic && reachedRange,
  `near=${falloff.near} far=${falloff.far}; `
  + falloff.rows.map(([d, v]) => `${d}:${v}`).join(' ')
  + `${reachedRange ? '' : ' — corridor too short to reach the range limit'}`);

// ── 8c. the Full map debug view: tap to stand there, pinch to zoom ──
// A tap has to be told apart from a drag, and the zoom has to hold the point
// under your fingers still, or panning a big maze on a phone is unusable.
await page.evaluate(() => { setDebugMap(true); });
await page.waitForTimeout(150);

const target = await page.evaluate(() => {
  const f = dbgFrame(), here = [Math.floor(player.x), Math.floor(player.y)];
  let best = null, bd = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isOpen(x, y) || (x === exit.x && y === exit.y)) continue;
    const d = Math.abs(x - here[0]) + Math.abs(y - here[1]);
    if (d > bd) { bd = d; best = [x, y]; }
  }
  return { tile: best, from: here, fitted: dbgView === null, px: f.ox + best[0] * f.S + f.S / 2, py: f.oy + best[1] * f.S + f.S / 2 };
});
await touch('touchStart', target.px, target.py);
await page.waitForTimeout(40);
await touch('touchEnd', target.px, target.py);
await page.waitForTimeout(150);
const landed = await page.evaluate(() => ({ x: Math.floor(player.x), y: Math.floor(player.y), cam: cam.x, solved }));
check('a tap on the Full map stands you there',
  target.fitted && landed.x === target.tile[0] && landed.y === target.tile[1]
    && Math.abs(landed.cam - (landed.x + 0.5)) < 0.01 && !landed.solved,
  `opened fitted; from ${target.from} tapped ${target.tile}, landed ${landed.x},${landed.y}, camera snapped with it`);

const held = await page.evaluate(() => ({ x: player.x, y: player.y }));
await touch('touchStart', 200, 400);
for (const dx of [12, 30, 52, 78]) { await touch('touchMove', 200 + dx, 400); await page.waitForTimeout(30); }
await touch('touchEnd', 278, 400);
await page.waitForTimeout(120);
const dragged = await page.evaluate(() => ({ x: player.x, y: player.y, v: dbgView && { cx: +dbgView.cx.toFixed(2), cy: +dbgView.cy.toFixed(2) } }));
check('a drag pans the Full map instead of teleporting',
  dragged.x === held.x && dragged.y === held.y && !!dragged.v,
  `player unmoved at ${held.x.toFixed(1)},${held.y.toFixed(1)}; view centre ${JSON.stringify(dragged.v)}`);

const zoom = await page.evaluate(() => {
  const px = 300, py = 500, f0 = dbgFrame();
  const w0 = [(px - f0.ox) / f0.S, (py - f0.oy) / f0.S];
  for (let i = 0; i < 6; i++) dbgZoomAt(dbgHold().S * 1.12, px, py);
  const f1 = dbgFrame(), w1 = [(px - f1.ox) / f1.S, (py - f1.oy) / f1.S];
  for (let i = 0; i < 80; i++) dbgZoomAt(dbgHold().S * 1.3, px, py);
  const capped = dbgFrame().S;
  for (let i = 0; i < 120; i++) dbgZoomAt(dbgHold().S * 0.8, px, py);
  const floored = dbgFrame().S;
  return { S0: f0.S, S1: f1.S, drift: Math.hypot(w1[0] - w0[0], w1[1] - w0[1]), capped, floored,
    max: CONFIG.debugMapMaxZoom, min: Math.min(innerWidth / W, (innerHeight - 260) / H) * CONFIG.debugMapMinZoom };
});
check('Full map zoom holds its anchor and stops at both ends',
  zoom.S1 > zoom.S0 * 1.5 && zoom.drift < 0.01
    && Math.abs(zoom.capped - zoom.max) < 0.01 && Math.abs(zoom.floored - zoom.min) < 0.01,
  `${zoom.S0.toFixed(1)} → ${zoom.S1.toFixed(1)} px/tile, anchor drift ${zoom.drift.toExponential(1)} tiles; `
  + `in stops at ${zoom.capped.toFixed(1)} (cap ${zoom.max}), out at ${zoom.floored.toFixed(2)} (floor ${zoom.min.toFixed(2)})`);

const offNow = await page.evaluate(() => { setDebugMap(false); return { x: player.x, y: player.y, v: dbgView }; });
await touch('touchStart', 120, 300);
await page.waitForTimeout(40);
await touch('touchEnd', 120, 300);
await page.waitForTimeout(120);
const offAfter = await page.evaluate(() => ({ x: player.x, y: player.y, v: dbgView }));
check('with Full map off, a tap on the maze does nothing',
  offNow.x === offAfter.x && offNow.y === offAfter.y && offNow.v === null && offAfter.v === null,
  `player still ${offAfter.x.toFixed(1)},${offAfter.y.toFixed(1)}; view reset to fitted on untick`);

// ── 8d. getting a different maze, and not resuming into the wrong one ──
// Changing a debug option restarts on the title screen. With Full map ticked the
// whole maze used to be drawn over that screen, where the HUD is hidden and the
// sleeper is a few pixels wide, so there was no way back to the menu at all.
await page.evaluate(() => { setDebugMap(true); });
await page.waitForTimeout(150);
await page.evaluate(() => { const el = $('optSize'); el.value = 'lg'; el.dispatchEvent(new Event('change')); });
await page.waitForTimeout(800);
const onTitle = await page.evaluate(() => ({
  started, debugMap, pre: document.body.classList.contains('pre'),
  titleShown: !$('title').classList.contains('hide'),
  S: Math.round(viewS), titleZoom: CONFIG.titleTilePx,
  px: viewOx + player.x * viewS, py: viewOy + player.y * viewS,
}));
check('a debug option with Full map on leaves a title screen you can tap',
  onTitle.titleShown && onTitle.pre && !onTitle.started && onTitle.debugMap && onTitle.S === onTitle.titleZoom,
  `Full map still ticked, view is the title's ${onTitle.S}px/tile, sleeper at ${Math.round(onTitle.px)},${Math.round(onTitle.py)}`);

await touch('touchStart', onTitle.px, onTitle.py);
await page.waitForTimeout(40);
await touch('touchEnd', onTitle.px, onTitle.py);
await page.waitForTimeout(3600);
const woke = await page.evaluate(() => ({ started, S: Math.round(viewS), fitted: Math.round(dbgFrame().S), gear: getComputedStyle($('gear')).opacity }));
check('and the Full map comes back the moment you are awake',
  woke.started && woke.S === woke.fitted && woke.gear === '1',
  `awake, fitted to ${woke.S}px/tile, gear visible again`);

const preNew = await page.evaluate(() => { SAVE.stones = 3; SAVE.collected = { 'The Child': [true] }; persist();
  return { seed: SEED, phase: SAVE.phase || 0, stones: SAVE.stones, collected: JSON.stringify(SAVE.collected) }; });
await page.evaluate(() => $('newMaze').click());
await page.waitForTimeout(700);
const postNew = await page.evaluate(() => ({ seed: SEED, phase: SAVE.phase || 0, stones: SAVE.stones,
  collected: JSON.stringify(SAVE.collected), label: $('seedLbl').textContent, titleShown: !$('title').classList.contains('hide') }));
check('New maze rerolls the seed and keeps everything you have done',
  postNew.seed !== preNew.seed && postNew.phase === preNew.phase && postNew.stones === preNew.stones
    && postNew.collected === preNew.collected && postNew.titleShown,
  `seed ${preNew.seed} → ${postNew.seed}; phase ${postNew.phase}, ${postNew.stones} stones, pages kept; panel reads "${postNew.label}"`);

// A run is rebuilt from its seed, so only the build that made it can resume it.
const stale = await page.evaluate(() => {
  $('title').classList.add('hide'); document.body.classList.remove('pre'); started = true;
  parked = false;   // the Update-app check above froze saving; thaw it so this run is written
  saveRun(true);
  const mine = SAVE.run.seed;
  SAVE.run.v = '0.0.1-not-this-build'; persist();
  parked = true;   // pagehide autosaves on reload and would stamp the live version straight back
  return { mine };
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(900);
const afterStale = await page.evaluate(() => ({ seed: SEED, stones: SAVE.stones, pages: JSON.stringify(SAVE.collected) }));
check('a run saved by another build starts a fresh maze instead of resuming',
  afterStale.seed !== stale.mine && afterStale.stones === 3 && afterStale.pages.includes('The Child'),
  `run from another build dropped (seed ${stale.mine}), now on ${afterStale.seed}; stones and pages kept`);

// ── 8e. the page counter, and the father who leaves ──────────────
const books = await page.evaluate(() => {
  SAVE.phase = 0; SAVE.stones = 0; SAVE.poolPending = false; SAVE.collected = {}; SAVE.ui = {};
  delete SAVE.run; reset(4242);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  const el = $('books');
  const before = { bars: el.childElementCount, got: el.querySelectorAll('.got').length, pages: journals.size };
  const k = [...journals.keys()][0];
  if (!k) return { skip: true };
  const [x, y] = k.split(',').map(Number);
  journals.delete(k); pagesThisRun.push(0); updateBooks();
  return { before, after: { bars: el.childElementCount, got: el.querySelectorAll('.got').length }, took: k };
});
check('the page counter shows one bar per page and fills as you find them',
  !books.skip && books.before.bars === books.before.pages && books.before.bars > 0
    && books.before.got === 0 && books.after.bars === books.before.bars && books.after.got === 1,
  books.skip ? 'no pages on this maze' :
  `${books.before.bars} bars for ${books.before.pages} pages, none filled; took ${books.took}, now ${books.after.got} filled`);

// He is placed where you can see him across a wall but not walk to him. Seen, he waits, then goes.
const dad = await page.evaluate(() => {
  SAVE.phase = 0; SAVE.stones = 0; SAVE.ui = {}; delete SAVE.run; reset(7777);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  const f = figures[0];
  if (!f) return { skip: true };
  const lit = litTiles();
  let stand = null;
  for (let y = 0; y < H && !stand; y++) for (let x = 0; x < W; x++) {
    if (!isOpen(x, y)) continue;
    const d = Math.hypot(x + 0.5 - f.x, y + 0.5 - f.y);
    if (d > lit || d < 1.2 || walkable(x, y, Math.floor(f.x), Math.floor(f.y), 4)) continue;
    stand = [x + 0.5, y + 0.5]; break;
  }
  if (!stand) return { skip: true };
  player.x = stand[0]; player.y = stand[1];
  const t0 = performance.now();
  updateFigures(t0, 0.016);
  const seen = f.seen, d0 = Math.hypot(f.x - player.x, f.y - player.y);
  let t = t0, n = 0, movedAt = 0;
  while (!f.gone && n < 900) { t += 16; updateFigures(t, 0.016); n++; if (!movedAt && Math.hypot(f.x - player.x, f.y - player.y) > d0 + 0.05) movedAt = (t - t0) / 1000; }
  return { seen, d0, d1: Math.hypot(f.x - player.x, f.y - player.y), gone: f.gone, movedAt, secs: (t - t0) / 1000, linger: CONFIG.figureLingerSec };
});
check('the father waits where he stands, then walks away and is gone',
  !dad.skip && dad.seen && dad.gone && dad.d1 > dad.d0 + 0.8 && dad.movedAt >= dad.linger * 0.9,
  dad.skip ? 'no vantage tile on this maze' :
  `seen at ${dad.d0.toFixed(1)} tiles, still for ${dad.movedAt.toFixed(1)}s (linger ${dad.linger}s), `
  + `walked out to ${dad.d1.toFixed(1)} and faded by ${dad.secs.toFixed(1)}s`);

// ── 8f. putting a burden down, and the waking that says so ───────
// The upgrade after a pool is a bigger light, and nothing used to tell you: you just
// played on. Now the next waking is slower and the light opens as it pulls out.
await page.evaluate(() => {
  SAVE.phase = 0; SAVE.stones = 0; SAVE.poolPending = true; SAVE.collected = {}; SAVE.ui = {};
  delete SAVE.run; delete SAVE.lifted; persist(); reset(4242); startPool();
});
let poolTaps = 0;
for (let i = 0; i < 30; i++) {
  const st = await page.evaluate(() => ({ shown: $('pool').classList.contains('show'), btn: !!document.querySelector('#poolChoices button') }));
  if (!st.shown) break;
  if (st.btn) { await page.evaluate(() => document.querySelector('#poolChoices button').click()); poolTaps++; }
  await page.waitForTimeout(300);
}
const dropped = await page.evaluate(() => ({ stones: SAVE.stones, lifted: SAVE.lifted, phase: SAVE.phase }));
const lift = await page.evaluate(async () => {
  const before = { glow: +liftGlow.toFixed(3), band: liftBand, amt: liftBandAmt, radius: +B.viewRadius().toFixed(3) };
  wake();
  const rows = []; const t0 = performance.now();
  await new Promise((r) => { const step = () => { rows.push([(performance.now() - t0) / 1000, +liftGlow.toFixed(3), +liftBandAmt.toFixed(2), Math.round(zoomS)]);
    if (performance.now() - t0 > (CONFIG.liftBandSec + CONFIG.liftBurstSec + 0.5) * 1000) return r(); requestAnimationFrame(step); }; step(); });
  const atBand = rows.filter((r) => r[0] < CONFIG.liftBandSec * 0.9);
  return { before, bandSec: CONFIG.liftBandSec, burstSec: CONFIG.liftBurstSec, from: CONFIG.liftGlowFrom,
    bandEnd: atBand.length ? atBand[atBand.length - 1][2] : 0,
    heldDark: atBand.every((r) => Math.abs(r[1] - CONFIG.liftGlowFrom) < 0.01),
    heldZoom: atBand.every((r) => r[3] === rows[0][3]),
    endGlow: liftGlow, endBand: liftBand, endRadius: +B.viewRadius().toFixed(3), done: !intro, started };
});
check('a burden put down makes the next waking say so, in two beats',
  dropped.lifted === 0 && dropped.stones === 1 && dropped.phase === 1
    && Math.abs(lift.before.glow - lift.from) < 0.01 && lift.before.band === 0 && lift.before.amt === 0
    && lift.bandEnd > 0.7 && lift.heldDark && lift.heldZoom
    && lift.endGlow === 1 && lift.endBand === -1 && lift.done && lift.started,
  `${poolTaps} taps through the pool, stone 0 down, phase ${dropped.phase}; `
  + `wakes in the old light (${lift.before.glow} of full, ${lift.before.radius} tiles), `
  + `a band of him goes pale over ${lift.bandSec}s with nothing else moving, `
  + `then the light is cut out to ${lift.endRadius} tiles in ${lift.burstSec}s`);

const plainWake = await page.evaluate(async () => {
  SAVE.phase = 2; SAVE.stones = 1; SAVE.poolPending = false; delete SAVE.lifted; delete SAVE.run; persist();
  reset(4242); wake();
  const lift = !!intro.lift, g0 = liftGlow;
  await new Promise((r) => setTimeout(r, (CONFIG.introSeconds + 0.5) * 1000));
  return { lift, g0, glow: liftGlow, started, done: !intro };
});
check('an ordinary waking is exactly as it was',
  !plainWake.lift && plainWake.g0 === 1 && plainWake.glow === 1 && plainWake.started && plainWake.done,
  `no lift, light held at ${plainWake.glow} throughout, awake after ${await page.evaluate(() => CONFIG.introSeconds)}s`);

// ── 8g. the glint on the start block, and a first step with nowhere to go ──
// Two things that only bite after a delay, so nothing catches them by accident. The glint draws
// the block's sliver again in the hint colour; when that stopped sharing the sliver code it threw
// every frame, and a throw inside draw() never re-queues the frame loop — the game simply froze.
const glint = await page.evaluate(async () => {
  SAVE.phase = 2; SAVE.stones = 0; SAVE.poolPending = false; SAVE.ui = {};
  delete SAVE.run; delete SAVE.pushLearned; persist(); reset(4242);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  const sl = sliders.find((s) => s.atStart);
  if (!sl) return { skip: true };
  player.x = sl.x + 0.5; player.y = sl.y + 0.5; firstPushDone = false; idleSince = gameNow() - CONFIG.hintIdleSec * 1000 - 2000;
  const before = { frames: 0 };
  let n = 0; const t0 = performance.now();
  await new Promise((r) => { const step = () => { n++; if (performance.now() - t0 > 900) return r(); requestAnimationFrame(step); }; step(); });
  return { frames: n, hint: CONFIG.hintIdleSec, ways: blockWays(sl).length, at: [sl.x, sl.y] };
});
check('the start block can glint without stopping the game',
  !glint.skip && glint.frames > 20,
  glint.skip ? 'no start block on this phase' :
  `stood still past ${glint.hint}s on the block at ${glint.at}; ${glint.frames} frames drawn while it glinted, ${glint.ways} sliver(s) on it`);

// The scripted step off the mat outranks the stick and only clears when you change tile. Facing a
// wall it never cleared, and the stick stayed dead for the rest of the run.
const boxedIn = await page.evaluate(async () => {
  SAVE.phase = 2; SAVE.stones = 0; SAVE.poolPending = false; SAVE.ui = {};
  delete SAVE.run; persist(); reset(4242);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  // wall him in on all four sides, then hand him the scripted step
  const cx = Math.floor(player.x), cy = Math.floor(player.y), was = [];
  for (const [dx, dy] of DIRS) { was.push([cx + dx, cy + dy, tiles[cy + dy][cx + dx]]); tiles[cy + dy][cx + dx] = 0; }
  introWalk = { dx: 0, dy: -1 }; held = { dx: 1, dy: 0 };
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const cleared = introWalk === null;
  for (const [x, y, v] of was) tiles[y][x] = v;
  held = null;
  return { cleared };
});
check('a scripted first step with nowhere to go gives up instead of holding the stick',
  boxedIn.cleared, 'walled in on all four sides, introWalk cleared itself on the next frame');

// ── 8h. the gauntlet's auto-moving floor ──────────────────────────
// A cell of the exit tree's trunk slides out of the way on a clock and comes back, so the way on
// is a hole half the time. It must actually take the floor with it, and it must always give it
// back — a hole that stayed would be a soft lock on the only route out.
const gswing = await page.evaluate(async () => {
  let sl = null;
  for (let s = 0; s < 40 && !sl; s++) {
    SAVE.phase = 0; SAVE.stones = 0; SAVE.poolPending = false; SAVE.ui = {};
    delete SAVE.run; persist(); reset(7000 + s * 11);
    sl = sliders.find((x) => x.gauntlet) || null;
  }
  if (!sl) return { skip: true };
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  // Never park him in the swing's path: the swing refuses to slide into you, so standing on the tile
  // it wants pins it at home forever and the check reads "floor 135 frames, hole 0". That was an
  // intermittent failure for as long as this check has existed — DIRS order decides which side he
  // waits on, and sometimes that side is the one it travels to.
  // Never park him on either tile the swing travels between: it refuses to slide into you, so
  // standing on the one it wants pins it at home forever and the check reads "hole 0". Both ways —
  // a swing that starts shifted travels *back*, which is how this kept failing after I excluded
  // only the forward one.
  const side = DIRS.find(([dx, dy]) => isOpen(sl.x + dx, sl.y + dy)
    && !(dx === sl.dx && dy === sl.dy) && !(dx === -sl.dx && dy === -sl.dy));
  if (!side) return { skip: true };
  player.x = sl.x + side[0] + 0.5; player.y = sl.y + side[1] + 0.5;   // waiting at the squeeze beside it
  // Deterministic, twice over. `nextAt = 0` reads as "unset" to the swing loop, which then schedules
  // the first move a *random* fraction of swingSeconds away — and the loop runs on gameNow(), which
  // a card left up by an earlier check freezes, so the move could simply never come due. Setting a
  // real time makes it fire on the first frame, and clearing `paused` keeps the clock running.
  // `nextAt = 0` reads as "unset" to the swing loop, which schedules the first move a random fraction
  // of swingSeconds away — fine, as long as the window is long enough to see several whole cycles.
  // Forcing it to fire on frame one instead was worse: the sampling then started mid-slide and only
  // ever caught one state. Clearing `paused` is the part that matters: the loop runs on gameNow(),
  // which a card left up by an earlier check freezes, so the move never came due at all.
  const wasSec = CONFIG.swingSeconds; CONFIG.swingSeconds = 0.35;
  CONFIG.tutorials = false; paused = false; sl.nextAt = 0;
  const seen = { home: 0, away: 0, moves: 0 };
  let wasHome = null;
  const t0 = performance.now();
  await new Promise((r) => { const step = () => {
    if (tiles[sl.y][sl.x]) seen.home++;
    if (tiles[sl.y + sl.dy][sl.x + sl.dx]) seen.away++;
    // Count the *changes*, not the frames in each state. Which end it rests at, and for how long,
    // depends on the maze the seed search happens to land on — and that moved the moment generation
    // changed. A gauntlet floor that slides out of the way and comes back is two changes; that is
    // the thing the check is named for, and it is the thing that does not depend on the seed.
    { const home = !!tiles[sl.y][sl.x];
      if (wasHome !== null && home !== wasHome) seen.moves++;
      wasHome = home; }
    if (performance.now() - t0 > 4000) return r();
    requestAnimationFrame(step); }; step(); });
  CONFIG.swingSeconds = wasSec;
  return { at: [sl.x, sl.y], into: [sl.dx, sl.dy], seen,
    onRoute: solutionPath.some(([x, y]) => x === sl.x && y === sl.y) };
});
check('the gauntlet floor slides out of the way and comes back',
  gswing.skip || (gswing.seen.moves >= 2 && gswing.onRoute),
  gswing.skip ? 'no gauntlet swing in 40 Child mazes' :
  `the cell at ${gswing.at} is on the route out; it left toward ${gswing.into} and came back ${gswing.seen.moves} times over four seconds (floor ${gswing.seen.home} frames, hole ${gswing.seen.away})`);

// ── 8i. the pool room's gate ──────────────────────────────────────
// It used to slide aside the moment you picked the stone up. Now you have to carry the stone to
// it and shove — and the way stays shut for the whole grind, which is twice as long as it was.
const gate = await page.evaluate(async () => {
  SAVE.stones = 0; SAVE.phase = 0; SAVE.poolPending = true; SAVE.ui = {};
  delete SAVE.run; persist(); reset(4242);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  const out = { secs: CONFIG.poolDoorSeconds, hold: CONFIG.pushHoldMs, slow: CONFIG.stoneSlow };
  // walk up to the gate empty-handed: it should not budge
  player.x = poolDoor.x + 0.5; player.y = poolDoor.y + 1.5; cam.x = player.x; cam.y = player.y;
  held = { dx: 0, dy: -1 };
  await new Promise((r) => setTimeout(r, 500));
  out.shutEmptyHanded = !poolDoor.openAt && Math.floor(player.y) === poolDoor.y + 1;
  // take the stone. That alone must not open it
  held = null;
  const [kx, ky] = keySpot.split(',').map(Number);
  out.plainSpeed = B.speed();
  player.x = kx + 0.5; player.y = ky + 0.5;
  await new Promise((r) => setTimeout(r, 250));
  out.hasStone = hasKey; out.shutOnPickup = !poolDoor.openAt;
  out.stoneSpeed = B.speed();
  // now shove it
  player.x = poolDoor.x + 0.5; player.y = poolDoor.y + 1.5;
  held = { dx: 0, dy: -1 };
  await new Promise((r) => setTimeout(r, 600));
  out.shoved = !!poolDoor.openAt;
  await new Promise((r) => setTimeout(r, CONFIG.poolDoorSeconds * 1000 * 0.5));
  out.shutMidGrind = poolDoorShut() && Math.floor(player.y) === poolDoor.y + 1;
  await new Promise((r) => setTimeout(r, CONFIG.poolDoorSeconds * 1000 * 0.6 + 700));
  out.openAfter = !poolDoorShut(); out.through = player.y < poolDoor.y + 1;
  held = null;
  return out;
});
check('the pool gate waits to be shoved with the stone, and grinds the whole way',
  gate.shutEmptyHanded && gate.hasStone && gate.shutOnPickup && gate.shoved && gate.shutMidGrind && gate.openAfter && gate.through,
  `empty-handed it held; picking the stone up left it shut; a ${gate.hold}ms lean started it; still shut halfway through the ${gate.secs}s grind; open and walked through after`);
check('a stone in your arms costs you 30% of your speed',
  Math.abs(gate.stoneSpeed / gate.plainSpeed - gate.slow) < 0.001,
  `${gate.plainSpeed.toFixed(2)} tiles/s empty-handed, ${gate.stoneSpeed.toFixed(2)} carrying the stone (x${gate.slow})`);

// ── 8j. the Level menu goes where it says ─────────────────────────
// Two menus used to decide this between them — Phase, and Pool room — and a character could be
// picked while poolPending was still set from somewhere else, which put you at the water instead.
// One menu now sets phase, stones and pool together, so walk every entry and check all three.
const levels = await page.evaluate(async () => {
  const sel = $('optLevel'), rows = [];
  for (let i = 0; i < sel.options.length; i++) {
    sel.value = String(i); sel.dispatchEvent(new Event('change'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    rows.push({ label: sel.options[i].textContent, pool: poolMode, who: phase().who,
      phase: SAVE.phase, stones: SAVE.stones });
  }
  // and the one that bit: a pool, then the character whose pool it is
  sel.value = '7'; sel.dispatchEvent(new Event('change'));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wentToWater = poolMode;
  sel.value = '6'; sel.dispatchEvent(new Event('change'));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const cameBackOut = !poolMode && phase().who === PHASES[3].who;
  // and the menu re-reads where you are whenever the panel is opened
  SAVE.phase = 5; SAVE.stones = 5; SAVE.poolPending = true;
  $('gear').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const shows = sel.options[+sel.value].textContent;
  $('gear').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  return { rows, wentToWater, cameBackOut, shows, phases: PHASES.length, stones: STONES.length };
});
const everyLevelRight = levels.rows.length === levels.phases * 2 - 1 && levels.rows.every((r, i) => {
  const isPool = i % 2 === 1, ph = Math.floor(i / 2);
  return r.pool === isPool && r.phase === ph && r.stones === ph;
});
check('the Level menu takes you to the level it names',
  everyLevelRight && levels.wentToWater && levels.cameBackOut,
  `${levels.rows.length} entries — ${levels.phases} characters and the ${levels.stones} pools between them — each with the right phase, stones and water; `
  + 'pool then character came back out of the water onto the character whose pool it is');
check('the Level menu re-reads where you are when the panel opens',
  levels.shows.includes('Shame'),
  `phase 5 with a pool pending, and the menu opened showing "${levels.shows.trim()}"`);

// ── 8k. the shelves and the basin still speak ─────────────────────
// Two things had made them go quiet. The latch that stops a line repeating while you stand there
// was never cleared, so it only ever fired once per page load — and a debug level change is a
// reset(), not a reload, so every maze after the first was silent. And "standing still" was
// `!sliding`, which any swing anywhere in the maze satisfied for half a second at a time; with
// five of them on the Child level the dwell almost never reached a second.
const room = await page.evaluate(async () => {
  const said = []; const real = window.narrate; narrate = (l) => { said.push(l); real(l); };
  const go = async (i) => { const sel = $('optLevel'); sel.value = String(i); sel.dispatchEvent(new Event('change'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true; };
  const stand = async (x, y, ms) => { player.x = x + 0.5; player.y = y + 0.5; dir = null; held = null;
    said.length = 0; await new Promise((r) => setTimeout(r, ms)); return said.slice(); };
  const basinSaid = (lines) => { const L = (ROOM_LINES[character.name] || ROOM_LINES['You']).basin;
    return lines.some((l) => L.includes(l) || LIGHTER.includes(l) || l.startsWith('One stone')); };
  const shelfSaid2 = (lines) => { const L = (ROOM_LINES[character.name] || ROOM_LINES['You']).shelf;
    return lines.some((l) => L.includes(l) || EMPTY_SHELF.includes(l)); };
  const out = { swings: 0 };
  await go(0);
  out.swings = sliders.filter((s) => s.auto).length;
  const b1 = [startRoom.x0 + 3, startRoom.y0 + 3];
  out.first = basinSaid(await stand(b1[0], b1[1], 1500));
  await stand(startRoom.x0 + 1, startRoom.y0 + 2, 400);           // step off
  out.again = basinSaid(await stand(b1[0], b1[1], 1500));          // and back on
  const sp = SHELF_SPOTS(startRoom.x0, startRoom.y0, startRoom.y1)[0];
  out.shelf = shelfSaid2(await stand(sp[0], sp[1], 1800));
  await go(2);                                                     // a whole new maze
  const b2 = [startRoom.x0 + 3, startRoom.y0 + 3];
  out.newLevel = basinSaid(await stand(b2[0], b2[1], 1500));
  const sp2 = SHELF_SPOTS(startRoom.x0, startRoom.y0, startRoom.y1)[0];
  out.shelfNewLevel = shelfSaid2(await stand(sp2[0], sp2[1], 1800));
  narrate = real;
  return out;
});
check('the shelves and the basin speak every time you stand at them',
  room.first && room.again && room.shelf && room.newLevel && room.shelfNewLevel,
  `basin: first stand ${room.first ? 'spoke' : 'SILENT'}, again after stepping off and back ${room.again ? 'spoke' : 'SILENT'}, `
  + `in a new maze ${room.newLevel ? 'spoke' : 'SILENT'}; shelves: ${room.shelf ? 'spoke' : 'SILENT'} then ${room.shelfNewLevel ? 'spoke' : 'SILENT'} `
  + `— with ${room.swings} swings moving in the level while you stood there`);

// ── 8l. cornering at walking speed ────────────────────────────────
// The slide back onto the corridor's centreline used to be its own movement at 1.6x walking, on
// top of the step, so turning a corner off-centre you crabbed diagonally at nearly twice speed.
// Joe: "they have this almost like race car cornering thing to them."
const corner = await page.evaluate(async () => {
  SAVE.phase = 2; SAVE.stones = 2; SAVE.poolPending = false; SAVE.ui = {};
  delete SAVE.run; persist(); reset(4242);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  let at = null;
  for (const [x, y] of solutionPath) if (isOpen(x + 1, y) && isOpen(x, y + 1) && isOpen(x - 1, y)) { at = [x, y]; break; }
  if (!at) return { skip: true };
  player.x = at[0] - 1.5; player.y = at[1] + 0.5; dir = null; recenter = null;
  // measured inside the frame loop against the game's own dt — sampling from a second rAF loop
  // reads high, because its callback and the game's do not share a clock reading
  const walk = B.speed(), rates = [], realUpdate = update;
  let lastWall = null, gone = 0, movedX = 0, movedY = 0;
  update = function (wall) {
    const bx = player.x, by = player.y;
    const dt = lastWall == null ? 0 : Math.min(0.05, (wall - lastWall) / 1000); lastWall = wall;
    realUpdate(wall);
    const d = Math.hypot(player.x - bx, player.y - by);
    gone += d; movedX += Math.abs(player.x - bx); movedY += Math.abs(player.y - by);
    if (dt > 0) rates.push(d / (walk * dt));
  };
  held = { dx: 1, dy: 0 };
  const t0b = performance.now();
  await new Promise((r) => { const step = () => { const el = performance.now() - t0b;
    if (el > 260 && el < 1200) held = { dx: 0, dy: 1 };     // turn mid-tile, off the new centreline
    if (el > 1200) return r();
    requestAnimationFrame(step); }; step(); });
  held = null; update = realUpdate;
  const moving = rates.filter((r) => r > 0.2);
  // Distance, not frame count: the speed now eases in over CONFIG.moveEase, so how many frames clear
  // a rate threshold depends on where the ramp happens to fall. Ground covered does not.
  return { frames: moving.length, gone, worst: Math.max(...moving),
    turned: gone > 0.8 && movedX > 0.2 && movedY > 0.2 };
});
check('going round a corner is walking speed, not a sprint across it',
  corner.skip || (corner.turned && corner.worst < 1.05),
  corner.skip ? 'no corner on this route' :
  `${(corner.gone || 0).toFixed(2)} tiles walked through a corner over ${corner.frames} frames, none faster than ${corner.worst.toFixed(2)}x walking speed (the crab across a corner used to hit 1.89x)`);

// ── 8m. the clock, and the log of what you have finished ──────────
const log = await page.evaluate(async () => {
  const fmt = [0, 42300, 61000, 254000, 4569000].map(fmtTime);
  clearLog();
  const sel = $('optLevel'); sel.value = '0'; sel.dispatchEvent(new Event('change'));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  t0 = gameNow() - 254000; steps = 161;
  player.x = exit.x + 0.5; player.y = exit.y + 0.5;
  await new Promise((r) => setTimeout(r, 300));
  const rows = readLog();
  const shown = $('msgStats').textContent;
  $('msg').classList.remove('show'); solved = false;
  return { fmt, rows: rows.length, row: rows[0], shown, csv: statsCsv().split('\n').length };
});
check('time reads in hours, minutes and seconds',
  log.fmt[0] === '0.0s' && log.fmt[1] === '42.3s' && log.fmt[2] === '1m 01s' && log.fmt[3] === '4m 14s' && log.fmt[4] === '1h 16m 09s',
  log.fmt.join(' · ') + `; the end-of-run card says "${(log.shown.match(/\d+m \d+s|\d+\.\d+s/) || [''])[0]}"`);
check('finishing a maze writes a line in the run log',
  log.rows === 1 && log.row && log.row.ms > 250000 && log.row.steps >= 161 && log.row.who && log.csv === 2,
  log.row ? `${log.row.who}, ${fmtOf(log.row.ms)}, ${log.row.steps} tiles, seed ${log.row.seed}, size ${log.row.size}; CSV is a header and ${log.csv - 1} row` : 'nothing logged');

// ── 8n. the labyrinth prototype ───────────────────────────────────
// Sections that own their edges, a hall through the dead seam between them, a landmark at the
// heart of each. It is chosen from the Prototype menu like any other, and picking Off has to put
// a real maze back with none of it left over.
const laby = await page.evaluate(async () => {
  const sel = $('optProto');
  sel.value = 'laby'; sel.dispatchEvent(new Event('change'));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const built = { proto: SAVE.ui.proto, protoMode, sections: sections.length, landmarks: landmarks.length,
    W, H, route: solutionPath.length - 1, kinds: [...new Set(sections.map((s2) => s2.kind))].sort() };
  // every landmark stands on floor, and no two that are near each other are the same thing
  built.onFloor = landmarks.every((L) => !!tiles[L.y][L.x]);
  built.distinct = new Set(landmarks.map((L) => L.kind)).size;
  // the way out has to be walkable from the mat. The start room is sealed behind the block you
  // lean on, so its gap counts as floor — you can always shove it
  built.sealed = !tiles[startGap[1]][startGap[0]] && !!sliders.find((s2) => s2.atStart);
  const gapKey = startGap.join(',');
  const seen = new Set([Math.floor(start.x) + ',' + Math.floor(start.y)]), q = [[Math.floor(start.x), Math.floor(start.y)]];
  for (let h = 0; h < q.length; h++) { const [x, y] = q[h];
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !tiles[ny] || (!tiles[ny][nx] && k !== gapKey)) continue; seen.add(k); q.push([nx, ny]); } }
  built.exitReachable = seen.has(exit.x + ',' + exit.y);
  built.room = startRoom && (startRoom.x1 - startRoom.x0 + 1);
  built.fog = protoWide;
  built.landmarksReachable = landmarks.every((L) => seen.has(L.x + ',' + L.y));
  sel.value = 'off'; sel.dispatchEvent(new Event('change'));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Off leaves no *sections* — those are still the prototype's. Landmarks are no longer its alone:
  // Joe asked for the prototype's rooms in the general mix, so an ordinary maze deals them too, and
  // each of those belongs to a room rather than a section.
  built.offAgain = !protoMode && sections.length === 0;
  built.plainRooms = landmarks.length > 0 && landmarks.every((L) => L.room !== undefined && tiles[L.y][L.x]);
  built.plainCount = landmarks.length;
  built.solidColumns = landmarks.filter((L) => L.kind === 'columns')
    .every((L) => L.cols && L.cols.length === 4 && L.cols.every(([x, y]) => !tiles[y][x]));
  return built;
});
check('the labyrinth prototype builds, and Off puts the maze back',
  laby.protoMode === true && laby.sections >= 6 && laby.landmarks === laby.sections
  && laby.onFloor && laby.exitReachable && laby.landmarksReachable && laby.kinds.length >= 2
  && laby.room === 5 && laby.sealed && laby.fog === false && laby.offAgain && laby.plainRooms && laby.solidColumns,
  `${laby.sections} sections (${laby.kinds.join(', ')}) across ${laby.W}x${laby.H}, `
  + `${laby.landmarks} landmarks of ${laby.distinct} kinds, all on floor and all reachable; `
  + `a sealed ${laby.room}x${laby.room} start room with one block to lean on, the maze's own fog; `
  + `the way out is ${laby.route} tiles; Off leaves no sections behind and gives an ordinary maze `
  + `with ${laby.plainCount} rooms that are places, every column tile actually shut`);

// ── 8o. getting through a squeeze ─────────────────────────────────
// Joe: "the character leaves the squeeze space and drifts out into the black portion of the map."
// Two things did that. The slide onto the centreline, which in a gap a third of a tile wide
// carried you out of it; and the body itself, which is most of a tile across and hung over both
// walls of the channel whatever you did with it. Now you are held to the channel and you turn
// sideways to fit — and there is no camera kick and no fading out any more.
const squeeze = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.phase = 0; SAVE.stones = 0; SAVE.poolPending = false; SAVE.ui = {};
  delete SAVE.run; persist(); reset(4242);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  let gap = null;
  for (const k of crawlGaps) { const [x, y] = k.split(',').map(Number);
    if (isOpen(x-1, y) && isOpen(x+1, y) && !isOpen(x, y-1) && !isOpen(x, y+1) && isOpen(x-2, y)) { gap = [x, y]; break; } }
  if (!gap) return { skip: true };
  player.x = gap[0] - 1 + 0.5; player.y = gap[1] + 0.42;      // come at it off-centre, as you do after a corner
  dir = null; recenter = null; held = { dx: 1, dy: 0 };
  const off = []; let kick = 0;
  const t0b = performance.now();
  await new Promise((r) => { const step = () => {
    if (inSqueeze) { off.push(Math.abs(player.y - (Math.floor(player.y) + 0.5))); kick = Math.max(kick, Math.abs(camBump)); }
    if (performance.now() - t0b > 2000) return r();
    requestAnimationFrame(step); }; step(); });
  held = null;
  const lim = CONFIG.squeezeChannel / 2;
  const bodyHalf = CONFIG.playerSize * 0.62 * (phase().bodyScale || 1) * CONFIG.squeezeShrink * 0.75 * CONFIG.squeezePinch;
  return { frames: off.length, worst: off.length ? Math.max(...off) : 0, lim, bodyHalf, kick, shrink: CONFIG.squeezeShrink, pinch: CONFIG.squeezePinch };
});
check('a squeeze holds you in its channel, and you fit through it',
  squeeze.skip || (squeeze.frames > 10 && squeeze.worst <= squeeze.lim + 0.001 && squeeze.bodyHalf <= squeeze.lim && squeeze.kick === 0),
  squeeze.skip ? 'no straight squeeze on this maze' :
  `${squeeze.frames} frames inside one: never more than ${squeeze.worst.toFixed(3)} off the centreline (the channel allows ${squeeze.lim}); `
  + `the body draws ${squeeze.bodyHalf.toFixed(3)} half-wide, pinched to ${squeeze.pinch} of its back at ${squeeze.shrink}x, so it fits; no camera kick`);

// ── 8p. the app icon and the manifest ─────────────────────────────
// Add to Home Screen used to grab a screenshot, because there was no icon at all. A missing file
// here fails silently on the phone and looks like nothing, so check they actually resolve.
const icon = await page.evaluate(async () => {
  const links = [...document.querySelectorAll('link[rel*="icon"], link[rel="manifest"]')].map((l) => l.rel);
  let m = null; try { m = await fetch('manifest.webmanifest').then((r) => r.json()); } catch (e) { m = null; }
  const load = (src) => new Promise((r) => { const i = new Image();
    i.onload = () => r({ src, w: i.width }); i.onerror = () => r({ src, w: 0 }); i.src = src; });
  const files = ['icons/icon-32.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
  const imgs = await Promise.all(files.map(load));
  return { links, name: m && m.name, display: m && m.display, icons: m && m.icons && m.icons.length,
    loaded: imgs.filter((i) => i.w > 0).length, sizes: imgs.map((i) => i.w).join('/') };
});
check('the app icon and the manifest are there and load',
  icon.links.includes('apple-touch-icon') && icon.links.includes('manifest')
  && icon.name === 'The Maze' && icon.display === 'standalone' && icon.icons >= 2 && icon.loaded === 4,
  `${icon.links.join(', ')}; manifest says "${icon.name}", ${icon.display}, ${icon.icons} icons; `
  + `${icon.loaded} of 4 png files load at ${icon.sizes}`);

// ── 8q. walking about a room ──────────────────────────────────────
// Joe: "my character only walks in the middle of floors not across them. So there's this strange
// robotic feeling." Where there is room to walk he now walks where the stick points — and a shut
// gate is still shut, which is the thing that went wrong first: open floor underneath is not
// permission to walk through it.
const roam = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.ui = { proto: 'laby' }; SAVE.poolPending = false; delete SAVE.run; persist(); reset(3291);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true;
  const L = landmarks[0];
  player.x = L.x + 0.5; player.y = L.y + 0.5; dir = null; recenter = null;
  const from = [player.x, player.y], seen = [];
  stickAim = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }; held = { dx: 1, dy: 0 };
  await new Promise((r) => { const t0b = performance.now(); const step = () => {
    seen.push([player.x, player.y]);
    if (performance.now() - t0b > 700) return r(); requestAnimationFrame(step); }; step(); });
  held = null; stickAim = null;
  const out = {
    bothAxes: Math.abs(player.x - from[0]) > 0.2 && Math.abs(player.y - from[1]) > 0.2,
    offGrid: seen.some(([x, y]) => Math.abs(x % 1 - 0.5) > 0.12 && Math.abs(y % 1 - 0.5) > 0.12),
    inWall: seen.some(([x, y]) => !isOpen(Math.floor(x), Math.floor(y))),
  };
  // and a corridor still holds you to its line
  let hall = null;
  for (let y = 2; y < H - 2 && !hall; y++) for (let x = 2; x < W - 2; x++)
    if (isOpen(x, y) && isOpen(x + 1, y) && isOpen(x - 1, y) && !isOpen(x, y - 1) && !isOpen(x, y + 1) && !openFloor(x, y)) { hall = [x, y]; break; }
  if (hall) {
    // Free movement has no rail to hold him, so the corridor's own walls are the test: lean at an
    // angle and he rides the wall, but he must never end up inside one, and he must still get down
    // the corridor rather than jamming on it.
    player.x = hall[0] + 0.5; player.y = hall[1] + 0.5; dir = null; recenter = null;
    const fromX = player.x;
    stickAim = { x: 0.72, y: -0.69 }; held = { dx: 1, dy: 0 };
    const off = [], wall = [];
    await new Promise((r) => { const t0b = performance.now(); const step = () => {
      off.push(Math.abs(player.y - (Math.floor(player.y) + 0.5)));
      wall.push(!isOpen(Math.floor(player.x), Math.floor(player.y)));
      if (performance.now() - t0b > 700) return r(); requestAnimationFrame(step); }; step(); });
    held = null; stickAim = null;
    out.corridorWalked = player.x - fromX > 0.5;      // he got down it
    out.corridorInWall = wall.some(Boolean);          // and never through its side
    out.corridorOff = Math.max(...off);               // and on the default model, on its line
    // free everywhere: the corridor's own walls are all that holds him, so he rides one
    SAVE.ui.move = 'free';
    player.x = hall[0] + 0.5; player.y = hall[1] + 0.5; dir = null; recenter = null;
    stickAim = { x: 0.72, y: -0.69 }; held = { dx: 1, dy: 0 };
    const offF = [], wallF = [];
    await new Promise((r) => { const t0b = performance.now(); const step = () => {
      offF.push(Math.abs(player.y - (Math.floor(player.y) + 0.5)));
      wallF.push(!isOpen(Math.floor(player.x), Math.floor(player.y)));
      if (performance.now() - t0b > 700) return r(); requestAnimationFrame(step); }; step(); });
    held = null; stickAim = null;
    out.freeRides = Math.max(...offF) > 0.1 && !wallF.some(Boolean);
    out.freeOff = Math.max(...offF);
    // and with the rails put back, the old behaviour is still there to feel
    SAVE.ui.move = 'rails';
    player.x = hall[0] + 0.5; player.y = hall[1] + 0.5; dir = null; recenter = null;
    stickAim = { x: 0.72, y: -0.69 }; held = { dx: 1, dy: 0 };
    const off2 = [];
    await new Promise((r) => { const t0b = performance.now(); const step = () => {
      off2.push(Math.abs(player.y - (Math.floor(player.y) + 0.5)));
      if (performance.now() - t0b > 500) return r(); requestAnimationFrame(step); }; step(); });
    held = null; stickAim = null; SAVE.ui.move = 'rooms';
    out.railsHold = Math.max(...off2) < 0.05;
  }
  return out;
});
check('rails in the halls, free in the rooms — and both ends still on the menu',
  roam.bothAxes && roam.offGrid && !roam.inWall
  && roam.corridorWalked !== false && roam.corridorInWall !== true
  && (roam.corridorOff === undefined || roam.corridorOff < 0.05)
  && roam.freeRides !== false && roam.railsHold !== false,
  `on the default model — in a room: moved on both axes at once and off the grid lines, never into `
  + `a wall; in a corridor with the stick held at an angle, held to the line `
  + `(${(roam.corridorOff || 0).toFixed(2)} off) `
  + `${roam.corridorWalked === false ? 'but DID NOT GET DOWN IT' : 'and still gets down it'}, `
  + `${roam.corridorInWall ? 'and ENDED UP IN A WALL' : 'never into one'}. `
  + `Set to free everywhere the same corridor lets him ride the wall `
  + `(${(roam.freeOff || 0).toFixed(2)} off, ${roam.freeRides === false ? 'NOT RIDING' : 'never into one'}); `
  + `set to rails, ${roam.railsHold === false ? 'they DO NOT hold' : 'the centreline hold is back'}`);

// ── 8r. the title screen ──────────────────────────────────────────
// Joe: "get rid of the black section at the bottom... move the question up to the top right...
// get rid of the tile count." Then, on seeing it: "I prefer the chapter to look like it's a part
// of the floor like we have with the maze title... I'm fine if the fog of war eats the bottom of
// it... hold the chapter title a little longer as we zoom out so it's readable and then fade out."
// So the chapter is painted into the floor under the darkness pass, not laid over the top in DOM,
// and it outlives the name above him. The pixels are the only thing that can prove either.
const titleScreen = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  const lit = () => {            // the brightest thing in the band of floor the chapter is set into
    const b = cv.getContext('2d');
    const x = innerWidth / 2, y = innerHeight / 2 + CONFIG.chapterDrop * zoomS;
    const d = b.getImageData((x - 110) * dpr, (y - 0.12 * zoomS) * dpr, 220 * dpr, 0.34 * zoomS * dpr).data;
    let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i]);
    return m;
  };
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  SAVE.phase = 0; SAVE.poolPending = false; SAVE.ui = {}; delete SAVE.run; persist(); reset(4242);
  await frame();
  const out = {
    noStepLbl: !document.getElementById('stepLbl'),
    noBar: !document.getElementById('titleBar'),
    noDomChapter: !document.getElementById('chapter'),
    asleep: lit(),
  };
  // the floor with nothing written on it, for comparison: a prototype is not a chapter
  SAVE.ui = { proto: 'laby' }; reset(4242); await frame(); out.proto = lit();
  SAVE.ui = {}; SAVE.poolPending = true; reset(4242); await frame(); out.pool = lit();
  SAVE.poolPending = false; reset(4242); await frame();
  // and on the way out it outlives the name: the two fades, sampled second by second
  out.outBy = CONFIG.chapterHoldSec + CONFIG.chapterFadeSec; out.zoomSec = CONFIG.introSeconds;
  out.nameGoneAt12 = nameFade(1.2) === 0;
  out.chapFullAt12 = chapterFade(1.2) > 0.7;
  out.chapGone = chapterFade(out.outBy + 0.01) === 0 && chapterFade(out.outBy - 0.3) > 0.2;
  out.outlives = out.outBy > 0.9 && out.outBy < CONFIG.introSeconds;
  out.caps = spaced('The Child') === 'T H E   C H I L D' && spaced('Chapter I') === 'C H A P T E R   I';
  // and none of the seven names runs off the screen, however long it is
  { const c = cv.getContext('2d'), TS = titleScale(CONFIG.titleTilePx), max = innerWidth - 32;
    const wide = PHASES.map((ph) => { const t = spaced(ph.who); fitFont(c, t, 700, TS * 0.18);
      return [ph.who, c.measureText(t).width]; });
    const m = 'M A Z E'; fitFont(c, m, 700, TS * 0.34); wide.push(['THE MAZE', c.measureText(m).width]);
    out.overflow = wide.filter(([, w]) => w > max + 0.5).map(([n]) => n);
    out.longest = wide.sort((a, b) => b[1] - a[1])[0]; out.max = max; }
  // the ? is the game's, not the title's: gone while he sleeps, in the top right once he is up
  const q = $('howBtn').getBoundingClientRect(), v = $('verTitle').getBoundingClientRect();
  $('howBtn').style.transition = 'none';      // read where it settles, not where it is mid-slide
  out.qHiddenAsleep = +getComputedStyle($('howBtn')).opacity === 0;
  document.body.classList.remove('pre');
  out.qShownAwake = +getComputedStyle($('howBtn')).opacity > 0.2;
  out.qTopRight = q.top < innerHeight * 0.2 && q.right > innerWidth * 0.8;
  document.body.classList.add('pre'); $('howBtn').style.transition = '';
  // it sits along the very bottom now, centred, out of the way of the title. Joe: "need to move the
  // version number down. Might as well center it too"
  out.verBottom = v.bottom > innerHeight * 0.95 && Math.abs((v.left + v.right) / 2 - innerWidth / 2) < 4;
  return out;
});
check('the title screen: the chapter set into the floor, the ? only once you are up',
  titleScreen.noStepLbl && titleScreen.noBar && titleScreen.noDomChapter
  && titleScreen.qHiddenAsleep && titleScreen.qShownAwake && titleScreen.qTopRight && titleScreen.verBottom
  && titleScreen.asleep > titleScreen.proto + 8 && titleScreen.asleep > titleScreen.pool + 8
  && titleScreen.nameGoneAt12 && titleScreen.chapFullAt12 && titleScreen.chapGone && titleScreen.outlives && titleScreen.caps && titleScreen.overflow.length === 0,
  `the chapter is lettered all caps and tracked out, and shrinks to fit — the longest, "${titleScreen.longest[0]}", `
  + `sets ${titleScreen.longest[1].toFixed(0)}px into ${titleScreen.max}px and `
  + `${titleScreen.overflow.length ? titleScreen.overflow.join(', ') + ' RUN OFF' : 'none of the eight runs off'}; `
  + `the band of floor below him reads ${titleScreen.asleep} with it written in and `
  + `${titleScreen.proto}/${titleScreen.pool} on a prototype/pool, which get no heading; `
  + `1.2s into the zoom-out the name above him is gone and the chapter is still up, and it is out `
  + `at ${titleScreen.outBy.toFixed(1)}s — before the ${titleScreen.zoomSec}s zoom ends; `
  + `the ? is gone while he sleeps and rides in top right once he is up; `
  + `the version centred along the very bottom, no tile count and no black bar`);

// ── 8s. gates, and the key that opens one ────────────────────────
// Joe: "when you use a gold key, it doesn't disappear from the inventory... I'd expect these keys
// to be one use", and "all of the gates in the game should open like the pool level gate." Each
// maze deals one key per door and no two doors share a shape, so spending it is always safe — this
// check is what says so out loud.
const gates = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.stones = 3; SAVE.poolPending = false; SAVE.ui = {}; delete SAVE.run; persist();
  let seed = 0; for (let ph = 3; ph <= 5 && !seed; ph++) { SAVE.phase = ph;
    for (let sd = 4242; sd < 4340; sd++) { reset(sd); if (doors.length) { seed = sd; break; } } }
  if (!seed) return { skip: true };
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true; intro = null;
  const shapes = doors.map((d) => d.shape);
  const out = { doors: doors.length, unique: new Set(shapes).size === shapes.length, keys: innerKeys.size };
  const d = doors[0];
  heldKeys = new Set([d.shape]); renderKeys();
  out.carried = $('keys').childElementCount;
  // walk onto its tile the way the game does
  player.x = d.x + 0.5; player.y = d.y + 0.5; lastTileKey = '';
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  out.opened = !!d.open; out.swings = !!d.openAt; out.spent = !heldKeys.has(d.shape); out.shown = $('keys').childElementCount;
  // and it is still drawn once open, lying back against the jambs, rather than vanishing
  out.drawsOpen = typeof drawGate === 'function';
  // the way out swings too, and only once the key is yours
  SAVE.phase = 5; for (let sd = 900; sd < 1000 && !gated; sd++) reset(sd);
  out.exitGated = gated; out.exitShut = !hasKey && !exitGateAt;
  return out;
});
check('a key is one use, and every gate swings back on its jambs',
  gates.skip || (gates.unique && gates.opened && gates.swings && gates.spent
    && gates.carried === 1 && gates.shown === 0 && gates.drawsOpen),
  gates.skip ? 'no maze with a door in the seeds tried' :
  `${gates.doors} door(s), ${gates.keys} key(s), no two doors sharing a shape; walking onto one with its `
  + `key opened it (and it swings rather than blinking), and the key went from ${gates.carried} in hand to `
  + `${gates.shown}; one drawGate draws them all, the way out included`);

// ── 8t. into a corridor mouth without jiggling ───────────────────
// Joe: "when I try and push into the cell the movement fights me, and stops the character from
// moving. I have to like jiggle it to get him to move in." Free movement in a room plus a body with
// width means an off-centre approach catches the jamb, so the mouth funnels him onto its line.
const mouth = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.ui = { proto: 'laby' }; SAVE.poolPending = false; delete SAVE.run; persist(); reset(3291);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true; intro = null;
  // a room tile whose neighbour is a one-wide corridor running away from it
  let spot = null;
  for (let y = 2; y < H - 2 && !spot; y++) for (let x = 2; x < W - 2; x++) {
    if (!isOpen(x, y) || !openFloor(x, y)) continue;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (!isOpen(nx, ny) || openFloor(nx, ny)) continue;
      if (!isOpen(nx + dx, ny + dy)) continue;                       // it has to go somewhere
      if (dx ? (isOpen(nx, ny-1) || isOpen(nx, ny+1)) : (isOpen(nx-1, ny) || isOpen(nx+1, ny))) continue;
      spot = [x, y, dx, dy]; break;
    }
  }
  if (!spot) return { skip: true };
  const [x, y, dx, dy] = spot;
  // stand off the mouth's centreline by a third of a tile, and lean straight at it
  player.x = x + 0.5 + (dx ? 0 : 0.33); player.y = y + 0.5 + (dy ? 0 : 0.33);
  dir = null; recenter = null; stickAim = null; held = { dx, dy };
  const from = dx ? player.x : player.y;
  await new Promise((r) => { const t0b = performance.now(); const step = () => {
    if (performance.now() - t0b > 1400) return r(); requestAnimationFrame(step); }; step(); });
  held = null;
  const got = (dx ? player.x - from : player.y - from) * (dx || dy);
  return { got, inside: isOpen(Math.floor(player.x), Math.floor(player.y)) && !openFloor(Math.floor(player.x), Math.floor(player.y)) };
});
check('an off-centre lean still takes you into a corridor mouth',
  mouth.skip || (mouth.got > 1.2 && mouth.inside),
  mouth.skip ? 'no room-to-corridor mouth on this prototype' :
  `coming at it a third of a tile off the line, he walked ${mouth.got.toFixed(2)} tiles in and ended up `
  + `${mouth.inside ? 'inside the corridor' : 'STILL IN THE ROOM'} — no jiggling`);

// ── 8u. the shelf of books ───────────────────────────────────────
// Joe: "make these indicators for the books go vertically so they look like books on a shelf."
const shelf = await page.evaluate(() => {
  SAVE.ui = {}; delete SAVE.run; persist(); SAVE.phase = 0; reset(4242);
  document.body.classList.remove('pre');
  const b = $('books').children[0];
  if (!b) return { skip: true };
  const r = b.getBoundingClientRect(), hs = [...$('books').children].map((c) => c.getBoundingClientRect().height);
  return { w: r.width, h: r.height, n: hs.length, varied: new Set(hs.map((v) => Math.round(v))).size > 1,
    shelfLine: getComputedStyle($('books')).borderBottomStyle !== 'none' };
});
check('the books stand up on a shelf',
  shelf.skip || (shelf.h > shelf.w * 2 && shelf.varied && shelf.shelfLine),
  shelf.skip ? 'no pages in this maze' :
  `${shelf.n} of them, each ${shelf.w}x${shelf.h} so they stand rather than lie, at ${shelf.varied ? 'varying' : 'ONE'} `
  + `height, on a shelf line`);

// ── 8v. the run log's buttons ────────────────────────────────────
// Joe: "swap the clear and close buttons here, move the clear one down so it can[not] accidentally
// be hit. Add an 'are you sure' to the clear button?" Clear is the one action here you cannot undo.
const runlog = await page.evaluate(async () => {
  showStats();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const close = $('statsClose').getBoundingClientRect(), clear = $('statsClear').getBoundingClientRect();
  const out = {
    closeAbove: clear.top > close.bottom + 12,
    ownRow: $('statsClear').parentElement !== $('statsClose').parentElement,
    quieter: clear.height < close.height,
  };
  writeLog([{ at: Date.now(), who: 'The Child', ms: 1000, steps: 10, seed: 1 }]);
  $('statsClear').click();                      // one tap only asks
  out.asks = $('statsClear').dataset.sure === '1' && readLog().length === 1;
  out.wording = /again|sure/i.test($('statsClear').textContent);
  $('statsClear').click();
  out.thenClears = readLog().length === 0;
  $('stats').classList.remove('show');
  return out;
});
check('clearing the run log takes two taps, and its button is out of the way',
  runlog.closeAbove && runlog.ownRow && runlog.quieter && runlog.asks && runlog.wording && runlog.thenClears,
  `Close sits above Clear in its own row, Clear smaller and set ${runlog.closeAbove ? 'well' : 'NOT'} below it; `
  + `one tap only asks ("${runlog.wording ? 'tap again' : 'NO PROMPT'}") and leaves the log alone, a second one clears it`);

// ── 8w. rooms that are places, and the vault ─────────────────────
// Joe: "love all these prototype rooms you've made. Please add them into the general mix of possible
// rooms in the mazes", "make these more like columns that you can't walk over", and "we need to
// really hide the keys... go make an area that buries a key inside it somewhere." All three change
// the shape of the maze itself, so what this really checks is that none of them broke it.
const places = await page.evaluate(() => {
  CONFIG.tutorials = false;
  SAVE.stones = 3; SAVE.poolPending = false; SAVE.ui = {}; delete SAVE.run; persist();
  // the harness's own rule: a block's sealed gap counts as floor, because you can always shove it
  const flood = () => {
    const soft = new Set([...(sealedGaps || []).map((g) => g.join(',')), startGap ? startGap.join(',') : '']);
    const seen = new Set(), sx = Math.floor(start.x), sy = Math.floor(start.y), q = [[sx, sy]];
    seen.add(sx + ',' + sy);
    for (let h = 0; h < q.length; h++) { const [x, y] = q[h];
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || !tiles[ny] || (!tiles[ny][nx] && !soft.has(k))) continue; seen.add(k); q.push([nx, ny]); } }
    return seen;
  };
  const out = { mazes: 0, withLandmarks: 0, kinds: new Set(), colRooms: 0, colsShut: 0,
    vaults: 0, buried: 0, keyLost: 0, exitLost: 0, landmarkInWall: 0 };
  for (let ph = 1; ph <= 6; ph++) { SAVE.phase = ph;
    for (let sd = 1; sd <= 12; sd++) {
      generate(sd); out.mazes++;
      const seen = flood();
      if (!seen.has(exit.x + ',' + exit.y)) out.exitLost++;
      if (landmarks.length) out.withLandmarks++;
      for (const L of landmarks) {
        out.kinds.add(L.kind);
        if (!tiles[L.y][L.x]) out.landmarkInWall++;          // its heart must still be floor
        if (L.kind === 'columns') { out.colRooms++;
          if (L.cols.length === 4 && L.cols.every(([x, y]) => !tiles[y][x])) out.colsShut++; }
      }
      if (keyVault) { out.vaults++;
        const heart = keyVault.cx + ',' + keyVault.cy;
        const buried = keySpot === heart || [...innerKeys.keys()].includes(heart);
        if (buried) { out.buried++; if (!seen.has(heart)) out.keyLost++; }
      }
    } }
  out.kinds = [...out.kinds];
  return out;
});
check('rooms are places, columns are walls, and a buried key can still be got to',
  places.exitLost === 0 && places.landmarkInWall === 0 && places.withLandmarks > places.mazes * 0.5
  && places.kinds.length >= 5 && places.colRooms > 0 && places.colsShut === places.colRooms
  && places.vaults > 0 && places.buried > 0 && places.keyLost === 0,
  `${places.withLandmarks} of ${places.mazes} ordinary mazes have rooms that are places, `
  + `${places.kinds.length} kinds across them (${places.kinds.join(', ')}); `
  + `${places.colsShut}/${places.colRooms} column rooms have all four actually shut; `
  + `${places.vaults} vaults, ${places.buried} with a key at the heart, `
  + `${places.keyLost} unreachable; the way out is reachable in all ${places.mazes}`);

// ── 8x. the ball pit gets out of your way ────────────────────────
// Joe: "can we make the ball pit reactive to the player's movement? Don't crash the server." So the
// shove has to happen, and it has to stop happening the moment he is not in the pit.
const pit = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.phase = 4; SAVE.stones = 4; SAVE.poolPending = false; SAVE.ui = {}; delete SAVE.run; persist();
  let L = null;
  for (let sd = 1; sd < 200 && !L; sd++) { reset(sd); L = landmarks.find((l) => l.kind === 'balls'); }
  if (!L) return { skip: true };
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true; intro = null;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // far away: nothing should be shoved
  player.x = 1.5; player.y = 1.5; await frame(); await frame();
  const away = L.shove ? Math.max(...L.shove) : 0;
  // standing in it: the balls near him give way
  player.x = (L.rx0 + L.rx1) / 2 + 0.5; player.y = (L.ry0 + L.ry1) / 2 + 0.5;
  for (let i = 0; i < 25; i++) await frame();
  const inIt = Math.max(...L.shove.map(Math.abs));
  // and they roll back once he leaves
  player.x = 1.5; player.y = 1.5;
  for (let i = 0; i < 45; i++) await frame();
  const after = Math.max(...L.shove.map(Math.abs));
  return { away, inIt, after, tile: zoomS };
});
check('the ball pit gets out of your way, and rolls back after',
  pit.skip || (pit.away === 0 && pit.inIt > pit.tile * 0.15 && pit.after < pit.inIt * 0.5),
  pit.skip ? 'no ball pit in the seeds tried' :
  `standing clear, nothing is moved (${pit.away}); standing in it the furthest ball gives up `
  + `${(pit.inIt / pit.tile).toFixed(2)} tiles; a moment after leaving it is back to `
  + `${(pit.after / pit.tile).toFixed(2)}`);

// ── 8y. he points the way he is going ────────────────────────────
// Joe: "can you make a toggle that makes it so whichever direction the character is moving it is
// pointed that way? ...when he's moving he only points up, down, left, right."
//
// In an open room this changes nothing and the check has to say so: the stick's angle *is* the angle
// he travels, so taking it from either gives the same number. Where the two part company is
// wherever the ground argues with the stick — a corridor he is sliding along, a mouth he is being
// funnelled into, a corner he is easing round. Lean at 45 degrees in a one-tile corridor and he
// travels straight along it: pointed at the ground he covers he faces down the corridor, pointed at
// the stick he faces into the wall he is scraping. That is the whole of what this buys.
const facing = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.ui = { proto: 'laby', move: 'free' }; SAVE.poolPending = false; delete SAVE.run; persist(); reset(3291);
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true; intro = null;
  let hall = null;
  for (let y = 2; y < H - 2 && !hall; y++) for (let x = 2; x < W - 2; x++)
    if (isOpen(x, y) && isOpen(x + 1, y) && isOpen(x - 1, y) && !isOpen(x, y - 1) && !isOpen(x, y + 1) && !openFloor(x, y)) { hall = [x, y]; break; }
  if (!hall) return { skip: true };
  const lean = async () => {
    player.x = hall[0] + 0.5; player.y = hall[1] + 0.5; dir = null; recenter = null;
    facing = facingShown = 0;
    stickAim = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }; held = { dx: 1, dy: 0 };   // 45 degrees into the wall
    const from = player.x, seen = [];
    await new Promise((r) => { const t0b = performance.now(); const step = () => { seen.push(facingShown);
      if (performance.now() - t0b > 700) return r(); requestAnimationFrame(step); }; step(); });
    held = null; stickAim = null;
    let jump = 0; for (let i = 4; i < seen.length; i++) { let d = seen[i] - seen[i - 1]; d = Math.atan2(Math.sin(d), Math.cos(d)); jump = Math.max(jump, Math.abs(d)); }
    return { deg: facingShown * 180 / Math.PI, went: player.x - from, jumpDeg: jump * 180 / Math.PI };
  };
  SAVE.ui.face = true;  const on = await lean();
  SAVE.ui.face = false; const off = await lean();
  SAVE.ui.face = true;
  // and in a room, where the stick and the ground agree, both must land on the same angle
  const L = landmarks[0];
  const room = async (f) => { SAVE.ui.face = f;
    player.x = L.x + 0.5; player.y = L.y + 0.5; dir = null; recenter = null; facing = facingShown = Math.PI;
    stickAim = { x: 0.87, y: 0.5 }; held = { dx: 1, dy: 0 };
    await new Promise((r) => { const t0b = performance.now(); const step = () => {
      if (performance.now() - t0b > 700) return r(); requestAnimationFrame(step); }; step(); });
    held = null; stickAim = null; return facingShown * 180 / Math.PI; };
  const rOn = await room(true), rOff = await room(false);
  SAVE.ui.face = true;
  return { on, off, rOn, rOff, want: 30 };
});
check('he turns to the ground he covers, not to where the stick points',
  facing.skip || (
    Math.abs(facing.on.deg) < 6                    // on: down the corridor, which is where he goes
    && Math.abs(facing.off.deg) > 30               // off: at the wall he is scraping
    && facing.on.went > 0.5 && facing.on.jumpDeg < 25 && facing.on.jumpDeg > 0.5
    && Math.abs(facing.rOn - facing.want) < 6 && Math.abs(facing.rOff - facing.want) < 6),
  facing.skip ? 'no one-tile corridor on this prototype' :
  `leaning 45 degrees into the wall of a one-tile corridor he travels straight down it: pointed at `
  + `the ground he covers he faces ${facing.on.deg.toFixed(0)} degrees, pointed at the stick he faces `
  + `${facing.off.deg.toFixed(0)} — at a wall he is only scraping. He turns to it at most `
  + `${facing.on.jumpDeg.toFixed(1)} degrees a frame, so it is a turn. In a room, where the stick and `
  + `the ground agree, both settings land on the same ${facing.rOn.toFixed(0)} degrees`);

// ── 8z. the fog is a vignette, and it does not pop ───────────────
// Joe: "it's not there at the start of the game. Then you hit the character and it pops in after a
// second. Feels jank. At this point I'd like just a 'light dusting' around the edges to give it a
// vignette style feel to it." The pop was a cap four times looser while he slept that tightened over
// the intro; there is no ramp now and no title-screen case, which is the whole fix. So what this
// measures is that the dark at the corner is the *same* asleep as it is in play.
const fog = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.phase = 0; SAVE.poolPending = false; SAVE.ui = {}; delete SAVE.run; persist(); reset(4242);
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b2 = cv.getContext('2d');
  const at = (fx, fy) => { const d = b2.getImageData(innerWidth * fx * dpr, innerHeight * fy * dpr, 2, 2).data; return d[0]; };
  await frame();
  const asleep = { corner: at(0.04, 0.06), middle: at(0.5, 0.5) };
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true; intro = null;
  await frame();
  const awake = { corner: at(0.04, 0.06), middle: at(0.5, 0.5) };
  // a vignette: lit in the middle, dark at the corner, and no jump between the two moments
  // a pop would be enormous — the old cap was four times looser asleep — so the bar is "nothing
  // like a pop", not "identical to the level": the start room's own light differs a little
  const out = { asleep, awake, popped: Math.abs(asleep.corner - awake.corner) > 25,
    vignette: awake.middle - awake.corner > 25 };
  // and the slider moves it both ways
  SAVE.ui.fog = 0.4; await frame(); out.tight = at(0.5, 0.22);
  SAVE.ui.fog = 2.2; await frame(); out.wide = at(0.5, 0.22);
  SAVE.ui.fog = 1;   await frame();
  out.sliderWorks = out.wide - out.tight > 15;
  return out;
});
check('the fog is a vignette, the same asleep as awake, and the slider moves it',
  !fog.popped && fog.vignette && fog.sliderWorks,
  `the corner reads ${fog.asleep.corner} asleep and ${fog.awake.corner} once he is up — no pop; `
  + `the middle reads ${fog.awake.middle} against the corner's ${fog.awake.corner}, so it gathers at `
  + `the edges rather than cutting a hole; the slider takes a point up the screen from `
  + `${fog.tight} at 0.4x to ${fog.wide} at 2.2x`);

// ── 8aa. the debug panel folds up, and the two new sliders ───────
// Joe: "we have a lot of things in the debug menu perhaps we want to put them into collapsible
// sections so that we can keep some of them closed that we aren't using", plus "please give me a
// slider that lets me set the speed of the character".
const panel = await page.evaluate(async () => {
  const secs = [...document.querySelectorAll('#dbg .sec')];
  const out = { sections: secs.map((d) => d.dataset.sec), open: secs.filter((d) => d.open).length };
  // every control still has a home
  const ids = ['optLevel', 'optStones', 'optProto', 'optZoom', 'optSpeed', 'optFog', 'optMove', 'optFace',
    'optStick', 'optSound', 'optSize', 'optBranch', 'optTurns', 'optClusters', 'optBraid', 'optFloor',
    'optTexture', 'optArrow', 'optPath', 'optMap'];
  out.homeless = ids.filter((id) => !$(id) || !$(id).closest('#dbg .sec'));
  // shutting one is remembered
  const first = secs[0]; const was = first.open;
  first.open = !was; first.dispatchEvent(new Event('toggle'));
  out.remembered = SAVE.ui['sec:' + first.dataset.sec] === !was;
  first.open = was; first.dispatchEvent(new Event('toggle'));
  // and the speed slider is a plain multiplier on what he walks
  const base = CONFIG.speed;
  SAVE.ui.speed = 0.5; const slow = B.speed();
  SAVE.ui.speed = 1.5; const fast = B.speed();
  SAVE.ui.speed = 1;   const norm = B.speed();
  out.speedScales = Math.abs(slow / norm - 0.5) < 0.01 && Math.abs(fast / norm - 1.5) < 0.01;
  out.range = [(slow / base).toFixed(2), (fast / base).toFixed(2)];
  return out;
});
check('the debug panel folds into sections, and Speed is a plain multiplier',
  panel.sections.length >= 4 && panel.open >= 1 && panel.open < panel.sections.length
  && panel.homeless.length === 0 && panel.remembered && panel.speedScales,
  `${panel.sections.length} sections (${panel.sections.join(', ')}) with ${panel.open} open to start; `
  + `every control lives in one of them; shutting one is remembered; `
  + `Speed runs ${panel.range[0]}x to ${panel.range[1]}x of the configured walk`);

// ── 8ab. the spiral turns ────────────────────────────────────────
// Joe: "the spiral room needs to move so the spiral is spinning in the center."
const spiral = await page.evaluate(async () => {
  CONFIG.tutorials = false;
  SAVE.phase = 4; SAVE.stones = 4; SAVE.poolPending = false; SAVE.ui = {}; delete SAVE.run; persist();
  let L = null;
  for (let sd = 1; sd < 200 && !L; sd++) { reset(sd); L = landmarks.find((l) => l.kind === 'spiral'); }
  if (!L) return { skip: true };
  document.body.classList.remove('pre'); $('title').classList.add('hide'); started = true; intro = null; darkTiles = new Set();
  player.x = (L.rx0 + L.rx1) / 2 + 0.5; player.y = (L.ry0 + L.ry1) / 2 + 0.5; cam = { ...player };
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b2 = cv.getContext('2d');
  // a ring of samples round the eye of it: the arms sweeping past change them, a still picture does not
  // Sample several rings, not one: which radius the arms fall on depends on how big the room is, and
  // that changed the moment rooms did. Any ring that moves is the spiral moving.
  const ring = () => { const out = [];
    for (const rad of [0.38, 0.62, 0.9, 1.2]) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2;
      const x = (innerWidth / 2 + Math.cos(a) * zoomS * rad) * dpr, y = (innerHeight / 2 + Math.sin(a) * zoomS * rad) * dpr;
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) { out.push(0); continue; }
      out.push(b2.getImageData(x, y, 1, 1).data[0]); }
    return out; };
  await frame(); const a1 = ring();
  const t0b = performance.now();
  await new Promise((r) => { const step = () => { if (performance.now() - t0b > 2500) return r(); requestAnimationFrame(step); }; step(); });
  await frame(); const a2 = ring();
  // The biggest single change, not the average over all of them. Most samples sit on flat floor
  // between the arms and never move whatever happens, so averaging buries the signal in them — an
  // arm sweeping across one sample is the whole evidence, and it is worth eighty levels.
  let worst = 0; for (let i = 0; i < a1.length; i++) worst = Math.max(worst, Math.abs(a1[i] - a2[i]));
  return { shift: worst, of: a1.length, hz: CONFIG.spiralSpinHz };
});
check('the spiral turns about the middle of its room',
  spiral.skip || (spiral.shift > 12 && spiral.hz > 0),
  spiral.skip ? 'no spiral room in the seeds tried' :
  `of ${spiral.of} samples round its eye the one an arm swept across shifted ${spiral.shift.toFixed(0)} `
  + `levels over two and a half seconds at ${spiral.hz} turns a second`);

// ── 8b. the screen, after Joe played it on his phone (v0.77.0) ───

// The ? is z-index 4 and the map is 3, so the ? sat on top of the map's close
// button: opening the map trapped you in it, because the X opened How to Play.
const overlap = await page.evaluate(async () => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
  const hits = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const how = document.getElementById('howBtn'), x = document.getElementById('mapClose');
  const stacked = hits(box(how), box(x));            // they still share the corner
  openMap(); await new Promise((r) => setTimeout(r, 120));
  const hiddenWithMapOpen = getComputedStyle(how).display === 'none';
  // and the X is what a tap in that corner actually reaches now
  const b = box(x), top = document.elementFromPoint((b.l + b.r) / 2, (b.t + b.b) / 2);
  const reachesX = !!top && (top === x || x.contains(top));
  closeMap(); await new Promise((r) => setTimeout(r, 120));
  return { stacked, hiddenWithMapOpen, reachesX, backAfter: getComputedStyle(how).display !== 'none' };
});
check('the map\'s close button is not buried under the ?',
  overlap.hiddenWithMapOpen && overlap.reachesX && overlap.backAfter,
  `the two still share the corner (${overlap.stacked ? 'overlapping' : 'not overlapping'}), so the ? is hidden while the map is open `
  + `(${overlap.hiddenWithMapOpen}); a tap in that corner reaches the X (${overlap.reachesX}); and the ? comes back on close (${overlap.backAfter})`);

// Walking himself off the mat is a scripted beat. It used to be a fraction of
// B.speed(), which the debug Speed slider multiplies — so turning the player up
// turned the intro up with him, which is what "walking off the mat too quickly"
// was. Same beat at both ends of the slider now.
const matWalk = await page.evaluate(async () => {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  const run = async (mul) => {
    SAVE.ui.speed = mul; persist();
    reset(SEED);                                      // back to the mat, asleep
    await nap(150);
    wake();
    // introWalk is set a whole introSeconds after the tap, and the first cut of
    // this check ran out before it ever arrived — then read the *previous* run's
    // pending timer as this run's walk. Wait for the beat rather than assume when.
    for (let i = 0; i < 200 && !introWalk; i++) await nap(50);
    // The average over the whole beat, not the peak of it. Peak reads the noise: the walk is short,
    // the ease ramp is a good fraction of it, and sampling from outside the frame loop lands
    // wherever it lands — at 0.4 tiles/s that drifted far enough to fail about one run in three.
    // Both runs include the same ramp, so the averages compare honestly.
    const y0 = player.y, t0 = performance.now();
    let y1 = y0, t1 = t0;
    for (let i = 0; i < 120 && introWalk; i++) { await nap(20); y1 = player.y; t1 = performance.now(); }
    const secs = (t1 - t0) / 1000;
    const peak = secs > 0.15 ? Math.abs(y1 - y0) / secs : 0;
    await nap(120);                                   // let the beat finish before the next reset
    return { peak, normal: B.speed() };
  };
  const slow = await run(1), fast = await run(1.8);
  SAVE.ui.speed = 1; persist();
  return { slow, fast };
});

{
  const a = matWalk.slow.peak, b = matWalk.fast.peak;
  const drift = a > 0 ? Math.abs(b - a) / a : 1;
  // 0.4 rather than something tight: sampling a 0.8 tiles/s ramp from outside the
  // frame loop drifts about 20% run to run, while the regression this is here to
  // catch — the slider multiplying the walk again — puts the two 80% apart. Wide
  // enough not to cry wolf, far inside the thing it is watching for.
  check('the walk off the mat ignores the debug speed slider',
    a > 0.2 && drift < 0.4 && matWalk.fast.normal > matWalk.slow.normal * 1.5,
    `at slider 1x he walks off at ${a.toFixed(2)} tiles/s and at 1.8x at ${b.toFixed(2)} — ${(drift * 100).toFixed(0)}% apart, `
    + `while his own walk goes ${matWalk.slow.normal.toFixed(2)} to ${matWalk.fast.normal.toFixed(2)}`);
}

// He is nearly black under a full load of stones, on a floor that is not much
// lighter. Joe: "we're gonna have to have a white border on the character at all
// times, otherwise they will blend and disappear into the background."
const edge = await page.evaluate(async () => {
  const cv = document.querySelector('canvas'), d = window.devicePixelRatio || 1;
  const px = cv.width / 2, py = cv.height / 2, R = Math.round(CONFIG.playerSize * zoomS * d * 1.3);
  const g = cv.getContext('2d').getImageData(px - R, py - R, R * 2, R * 2).data;
  let brightest = 0, darkest = 255;
  for (let i = 0; i < g.length; i += 4) {
    const v = (g[i] + g[i + 1] + g[i + 2]) / 3;
    if (v > brightest) brightest = v;
    if (v < darkest) darkest = v;
  }
  return { brightest, darkest, stones: SAVE.stones || 0 };
});
check('he is drawn with a light edge, so he cannot sink into the floor',
  edge.brightest > 200 && edge.brightest - edge.darkest > 90,
  `carrying ${edge.stones} stones, the box around him runs ${edge.darkest.toFixed(0)} to ${edge.brightest.toFixed(0)} `
  + `— a body that dark needs an edge that bright to stay findable`);

// ── 8c. every self's melody lands where a phone can sound it (v0.77.0) ──
//
// Joe: "the music for the soldier is not really firing as much as expected. Just
// picking up the ambient noise, not the actual soldier melody." It was firing —
// at a median of 110Hz with a floor of 55Hz, which a phone speaker cannot
// reproduce. The Criminal was worse: every note under 150Hz. Two checks, because
// one alone would not have caught it: play the two bass selves for real, and work
// out the lowest note every preset can reach.
const AUDIBLE = 180;   // Hz a phone can be relied on to sound

const heard = await page.evaluate(async (floorHz) => {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  // Establish the precondition rather than inherit it: the debug-panel check earlier in this
  // suite walks every control, optSound included, and since v0.78.0 switching sound off really
  // does tear the composer down instead of muting it. Left to chance, this check measured a
  // silent game and blamed the music.
  AUDIO.setEnabled(true); AUDIO.begin();
  await nap(2800);                                   // the first bar is scheduled 2.5s in
  for (const name of ['The Soldier', 'The Criminal']) {
    AUDIO.setMusic(name);
    await nap(400);
    window.__voices.length = 0;
    // Wait for notes rather than assume a window. These two are the sparsest selves in the game
    // and a fixed nine seconds caught nothing about one run in four — a check that cries wolf gets
    // ignored, which is worse than not having it. A motif bar ignores density and rests and always
    // plays, so one is guaranteed inside motifEvery bars: the Soldier's every 2 (~7s), the
    // Criminal's every 3 (~12s). 18s is past both with room to spare.
    const byTick = new Map();
    for (let waited = 0; waited < 18000; waited += 250) {
      await nap(250);
      for (const v of window.__voices) {
        const k = Math.round(v.t / 40);               // voices of one note are made in the same tick
        byTick.set(k, Math.max(byTick.get(k) || 0, v.n.frequency.value || 0));
      }
      window.__voices.length = 0;
      if (byTick.size >= 4) break;                    // a motif bar's worth: enough to judge
    }
    const tops = [...byTick.values()].filter((f) => f > 0);
    out[name] = { notes: tops.length, mute: tops.filter((f) => f < floorHz).length, lowestTop: tops.length ? Math.min(...tops) : 0 };
  }
  return out;
}, AUDIBLE);
{
  const rows = Object.entries(heard);
  // One note each is the bar, not two: these two selves are the sparsest in the game (the Criminal
  // rests 40% of bars at density 0.35) and a nine-second window does not reliably hold more. The
  // count is only here so that a silent game cannot pass "none of them were inaudible" vacuously —
  // the coverage across all nine presets is the check below.
  const played = rows.every(([, r]) => r.notes >= 1);
  const allHeard = rows.every(([, r]) => r.mute === 0);
  check('the bass selves are pitched where a phone can sound them',
    played && allHeard,
    rows.map(([n, r]) => `${n}: ${r.notes} notes, ${r.mute} of them with nothing above ${AUDIBLE}Hz, `
      + `quietest note topping out at ${r.lowestTop.toFixed(0)}Hz`).join('; '));
}

// And the same property for every self, from the presets rather than the clock —
// a real-time pass over all nine would add a minute to this suite to catch a
// character Joe has not reached yet.
const reach = await page.evaluate((floorHz) => {
  const bad = [];
  for (const [name, p] of Object.entries(MUSIC)) {
    const n = p.scale.length;
    const degrees = [...(p.motif || []), -1, 0];           // -1 is the lowest a random beat can pick
    for (const deg of degrees) {
      const oct = Math.floor(deg / n), st = p.scale[((deg % n) + n) % n] + 12 * oct;
      const f = p.root * Math.pow(2, st / 12);
      // the rule, asked of the game rather than modelled here: a note either clears the
      // floor on its own, or the engine carries its pitch up until it does
      const carrier = AUDIO.carrierFor(f);
      const top = Math.max(f, carrier * 2);
      if (top < floorHz) bad.push(`${name}: a ${f.toFixed(0)}Hz note reaches only ${top.toFixed(0)}Hz`);
    }
  }
  return { bad, count: Object.keys(MUSIC).length };
}, AUDIBLE);
check(`no self's melody sits below what a phone can play (${reach.count} presets)`,
  reach.bad.length === 0,
  reach.bad.length ? reach.bad.join('; ')
    : `every preset's lowest reachable note is either above ${AUDIBLE}Hz already or carried up to it`);

// Joe: "turning the debug sound on and off should restart the audio." It used to
// ride the master gain to 0 and back, leaving the bed and the composer running on
// in silence, so switching back on rejoined them mid-bar.
const restart = await page.evaluate(async () => {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  AUDIO.setEnabled(true); await nap(300);
  const before = window.__osc;
  await nap(400);
  const ranOn = window.__osc > before;                 // the bed is alive and making voices
  AUDIO.setEnabled(false); await nap(700);             // past the 350ms teardown
  const atOff = window.__osc;
  await nap(1200);
  const quiet = window.__osc === atOff;                // nothing still playing behind the silence
  AUDIO.setEnabled(true); await nap(900);
  const rebuilt = window.__osc > atOff;                // and switching on builds a new bed
  AUDIO.setEnabled(true);
  return { ranOn, quiet, rebuilt, made: window.__osc - atOff };
});
check('the sound toggle restarts the audio rather than muting it',
  restart.quiet && restart.rebuilt,
  `with it off nothing new is voiced for over a second (${restart.quiet}); switching it back on builds the bed again `
  + `(${restart.made} new voices). Muting alone would have kept the composer running through the silence`);

// ── 8d. the rooms answer to you (v0.79.0) ───────────────────────

// Joe: "the spiral in the spiral room should move and rotate whatever direction
// the player is moving." Walk him a quarter-turn round the eye one way, then the
// other, and the spiral should follow each time.
const drag = await page.evaluate(async () => {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let tries = 0; tries < 40; tries++) {
    const L = (landmarks || []).find((l) => l.kind === 'spiral');
    if (L) {
      const px = L.x + 0.5, py = L.y + 0.5, rr = 1.6;
      const put = (ang) => { player.x = px + Math.cos(ang) * rr; player.y = py + Math.sin(ang) * rr; };
      const sweep = async (dir) => {
        put(0); await nap(60);
        const from = L.spin;
        for (let i = 1; i <= 12; i++) { put(dir * i * Math.PI / 24); await nap(28); }
        return L.spin - from;
      };
      const cw = await sweep(1), ccw = await sweep(-1);
      return { skip: false, cw, ccw };
    }
    reset(SEED + tries + 1);                           // another maze until one has a spiral
    await nap(40);
  }
  return { skip: true };
});
check('the spiral turns the way you walk round it',
  drag.skip || (drag.cw > 0.15 && drag.ccw < -0.15),
  drag.skip ? 'no spiral room in the seeds tried'
    : `walking a quarter-turn one way moved it ${drag.cw.toFixed(2)} radians and the other way ${drag.ccw.toFixed(2)} — `
      + `it follows the direction rather than running on its own clock`);

// Joe: "room two in the prototype should also be columns that light up." Room two
// of the gallery is the statues, so they stand on the floor now like the columns
// and take the light at the same reach.
const stat = await page.evaluate(async () => {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  buildGallery(SEED); await nap(200);                 // the gallery lays out one bay per kind
  const L = (landmarks || []).find((l) => l.kind === 'statues');
  if (!L) return { missing: true };                   // never a skip: the gallery always has one
  const solid = (L.cols || []).filter(([mx, my]) => tiles[my][mx] === 0).length;
  // the room is still walkable: every open tile in it reachable from its doorway
  const seen = new Set(), q = [[L.rx0, L.ry0 + ((L.ry1 - L.ry0) >> 1)]];
  let open = 0;
  for (let y = L.ry0; y <= L.ry1; y++) for (let x = L.rx0; x <= L.rx1; x++) if (tiles[y][x]) open++;
  while (q.length) { const [x, y] = q.pop(), k = x + ',' + y;
    if (seen.has(k) || x < L.rx0 || x > L.rx1 || y < L.ry0 || y > L.ry1 || !tiles[y][x]) continue;
    seen.add(k); q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
  // and they should be dark until he is on top of them. Sample one statue's own tile
  // from across the room, then from the tile beside it.
  const cv = document.querySelector('canvas'), d = window.devicePixelRatio || 1;
  const [mx, my] = L.cols[0];
  const lookAt = async (px, py) => {
    player.x = px; player.y = py; cam.x = px; cam.y = py;
    await nap(260);
    const sx = Math.round((cv.width / 2 + (mx + 0.5 - player.x) * zoomS * d));
    const sy = Math.round((cv.height / 2 + (my + 0.5 - player.y) * zoomS * d));
    const g = cv.getContext('2d').getImageData(sx - 6, sy - 6, 12, 12).data;
    let sum = 0; for (let i = 0; i < g.length; i += 4) sum += (g[i] + g[i + 1] + g[i + 2]) / 3;
    return sum / (g.length / 4);
  };
  const near = await lookAt(mx + 1.5, my + 0.5);
  const far = await lookAt(L.x + 0.5, L.y + 0.5 + (L.ry1 - L.ry0));
  return { skip: false, placed: (L.cols || []).length, solid, open, reached: seen.size, near, far };
});
check('the statues stand on the floor, and light up as you reach them',
  !stat.missing && stat.placed >= 4 && stat.solid === stat.placed && stat.reached === stat.open
    && stat.near > stat.far + 6,
  stat.missing ? 'the gallery has no statue bay at all, which is itself the bug'
    : `${stat.placed} of them, all ${stat.solid} shut against you, and all ${stat.open} open tiles of the bay still `
      + `reach each other. One of them reads ${stat.far.toFixed(0)} from across the room and ${stat.near.toFixed(0)} from the tile beside it`);

// ── 9. no page errors throughout ─────────────────────────────────
check('no page errors', pageErrors.length === 0,
  pageErrors.length ? [...new Set(pageErrors)].slice(0, 3).map((e) => e.split('\n')[0]).join(' | ') : '');

// ── report ───────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
console.log('');
console.log(failed.length === 0
  ? `PASS — ${results.length} behaviour checks`
  : `FAIL — ${failed.length} of ${results.length} behaviour checks: ${failed.map((f) => f.name).join('; ')}`);

await browser.close();
process.exit(failed.length ? 1 : 0);
