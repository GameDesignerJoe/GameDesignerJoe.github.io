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
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;
  class Probed extends Native {
    constructor(...a) {
      super(...a);
      const osc = this.createOscillator.bind(this);
      this.createOscillator = (...b) => { window.__osc++; return osc(...b); };
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
  generate(99);
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
  const lit = B.viewRadius() * 2 + CONFIG.fogSoftness;
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
