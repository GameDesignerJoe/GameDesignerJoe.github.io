#!/usr/bin/env node
// The Maze — three players, and how long a maze takes them.
//
// Joe asked: what is the minimum time to finish a maze at walking speed making
// every right choice, what is the longest it could take on the same seed, and
// what is the time we should assume in between. This answers all three by
// running three bots over the real generated maze:
//
//   floor    an oracle. Knows the whole maze, walks the shortest legal route —
//            key-aware, so if the exit is locked the route goes by the key.
//   explore  a person. Knows nothing, walks corridors, prefers a way it has not
//            been, backs out of dead ends, stops when it reaches the exit.
//            Run many times per maze with different guesses; the median is the
//            number to quote.
//   sweep    the worst honest case. Explores every reachable tile before it
//            leaves, which is what "never guesses right" actually costs.
//
// Time, not tiles. Every step is priced from the game's own constants — walking
// speed, the crawl slowdown, the lean-and-slide of a push block, the wait for a
// gauntlet swing to bring the floor back — so the seconds mean something.
//
//   node maze/tools/bots.mjs                      # every size, the Child's maze
//   node maze/tools/bots.mjs --phase 3 --seeds 30
//   node maze/tools/bots.mjs --size lg --trials 400
//   node maze/tools/bots.mjs --validate           # walk one for real and compare
//
// Needs a static server on --port (default 8765), e.g.
//   python3 -m http.server 8765     (from the repo root)

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : (argv[i + 1] ?? true); };
const flag = (n) => argv.includes('--' + n);

const SEEDS = Number(arg('seeds', 20));
const TRIALS = Number(arg('trials', 200));
const PORT = Number(arg('port', 8765));
const ONE_SIZE = arg('size', null);
const PHASE = Number(arg('phase', 0));
const VALIDATE = flag('validate');
const URL = `http://127.0.0.1:${PORT}/maze/maze-topdown.html`;
const PROTO = arg('proto', null);                       // measure a prototype instead of a maze
const SIZES = PROTO ? [PROTO] : ONE_SIZE ? [ONE_SIZE] : ['sm', 'md', 'lg', 'xl'];

// ── the cost of a step, in seconds ───────────────────────────────
// Read from the page so this cannot drift away from the game.
function costs(C) {
  const step = 1 / C.speed;
  const swingCycle = 2 * (C.swingSeconds + C.sliderSeconds * 0.5);
  const open = C.swingSeconds;                       // the part of the cycle the floor is there
  return {
    step,
    squeeze: step / C.squeezeSlow,                   // a crawl gap, at squeezeSlow of walking
    push: C.pushHoldMs / 1000 + C.sliderSeconds,     // lean on a block, ride it one tile
    swingBest: 0,                                    // arrive as the floor comes back
    swingMean: ((swingCycle - open) / swingCycle) * ((swingCycle - open) / 2),
    swingWorst: swingCycle - open,
    intro: C.introSeconds,                           // the waking, before you can move at all
  };
}

// ── the maze as a graph, priced ──────────────────────────────────
const K = (x, y) => x + ',' + y;
function model(s, c, swingWait) {
  const open = (x, y) => s.tiles[y]?.[x] === '1';
  const squeeze = new Set([...s.crawlGaps, ...s.crawlCells].filter((k) => { const [x, y] = k.split(',').map(Number); return open(x, y); }));
  const doorAt = new Map(s.doors.map((d) => [K(d.x, d.y), d.shape]));
  const keyAt = new Map(s.innerKeys);
  if (s.gated && s.keySpot) keyAt.set(s.keySpot, '*exit*');
  // A push block: its own tile is floor, and the sealed gap beyond it opens when you shove it —
  // you ride it across. Both ways: the tile it leaves becomes a hole, so coming back out of the
  // pocket means shoving it back, which costs the same again. Every one of these guards a dead
  // end, so riding in and riding out is the whole of what anyone does with them.
  // The block sits at `home`; `gap` is the sealed wall tile beyond it. Shove it and it slides into
  // the gap with you on it, so the gap becomes floor and the pocket behind it opens. The tile it
  // left is a hole now, so getting back out means shoving it back — the same cost again. Both of
  // those are rides; everything on the far side of the gap is an ordinary step.
  const pushTo = new Map(), openedByPush = new Set();
  for (const sl of s.sliders) {
    if (sl.auto) continue;
    const home = K(sl.x, sl.y), gap = K(sl.x + sl.dx, sl.y + sl.dy);
    pushTo.set(home + '>' + gap, c.push);
    pushTo.set(gap + '>' + home, c.push);
    openedByPush.add(gap);
  }
  const gauntlet = new Set(s.sliders.filter((sl) => sl.gauntlet).map((sl) => K(sl.x, sl.y)));
  const stepCost = (ax, ay, bx, by) => {
    const a = K(ax, ay), b = K(bx, by);
    const p = pushTo.get(a + '>' + b);
    if (p != null) return p;
    let t = (squeeze.has(a) || squeeze.has(b)) ? c.squeeze : c.step;
    if (gauntlet.has(b)) t += swingWait;              // the floor has to come back before you cross
    return t;
  };
  const passable = (x, y, keys) => {
    if (!open(x, y) && !openedByPush.has(K(x, y))) return false;
    const d = doorAt.get(K(x, y));
    if (d && !keys.has(d)) return false;
    if (s.gated && x === s.exit.x && y === s.exit.y && !keys.has('*exit*')) return false;
    return true;
  };
  const pushable = (ax, ay, bx, by) => pushTo.has(K(ax, ay) + '>' + K(bx, by));
  return { open, squeeze, keyAt, stepCost, passable, pushable, doorAt };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ── floor: the oracle's route, key-aware ─────────────────────────
function floorRoute(s, c) {
  const m = model(s, c, c.swingBest);
  const shapes = [...new Set([...m.keyAt.values()])];
  const bit = new Map(shapes.map((sh, i) => [sh, 1 << i]));
  const keysOf = (mask) => new Set(shapes.filter((sh) => mask & bit.get(sh)));
  const startMask = 0;
  const best = new Map();                            // 'x,y,mask' → seconds
  const id = (x, y, mask) => x + ',' + y + ',' + mask;
  const q = [{ x: s.start.x, y: s.start.y, mask: startMask, t: 0 }];
  best.set(id(s.start.x, s.start.y, startMask), 0);
  const from = new Map();
  let answer = Infinity, endId = null;
  while (q.length) {
    q.sort((a, b) => a.t - b.t);                     // small graphs; a heap is not worth the code
    const cur = q.shift();
    if (cur.t > (best.get(id(cur.x, cur.y, cur.mask)) ?? Infinity)) continue;
    if (cur.x === s.exit.x && cur.y === s.exit.y) { answer = cur.t; endId = id(cur.x, cur.y, cur.mask); break; }
    const keys = keysOf(cur.mask);
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const canPush = m.pushable(cur.x, cur.y, nx, ny);
      if (!canPush && !m.passable(nx, ny, keys)) continue;
      let mask = cur.mask;
      const got = m.keyAt.get(K(nx, ny));
      if (got) mask |= bit.get(got);
      const t = cur.t + m.stepCost(cur.x, cur.y, nx, ny);
      const nid = id(nx, ny, mask);
      if (t < (best.get(nid) ?? Infinity)) { best.set(nid, t); from.set(nid, id(cur.x, cur.y, cur.mask)); q.push({ x: nx, y: ny, mask, t }); }
    }
  }
  const path = [];
  for (let k = endId; k; k = from.get(k)) { const [x, y] = k.split(',').map(Number); path.push([x, y]); }
  path.reverse();
  return { t: answer, path };
}
const floorTime = (s, c) => floorRoute(s, c).t;

// ── how far the exit could have been ─────────────────────────────
// The shortest route is nearly the same length whatever size the maze is, because the exit sits
// in the opposite corner and the route is roughly the diagonal: the side of the maze grows like
// the square root of its area. This measures the other thing — the farthest tile from the start,
// which is the longest the floor could be made without changing anything but where the exit goes.
function farthest(s, c) {
  const m = model(s, c, c.swingBest);
  const keys = new Set([...m.keyAt.values()]);
  const dist = new Map([[K(s.start.x, s.start.y), 0]]);
  const q = [[s.start.x, s.start.y]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h], d = dist.get(K(x, y));
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = K(nx, ny);
      if (dist.has(k)) continue;
      if (!m.pushable(x, y, nx, ny) && !m.passable(nx, ny, keys)) continue;
      dist.set(k, d + m.stepCost(x, y, nx, ny)); q.push([nx, ny]);
    }
  }
  let best = 0;
  for (const v of dist.values()) best = Math.max(best, v);
  return best;
}

// ── explore: someone who does not know the maze ──────────────────
// Corridor by corridor, preferring a way it has not been, backing out of dead
// ends. This is what a person does, and the spread over many tries is the
// spread over how lucky they are.
function exploreTime(s, c, rnd) {
  const m = model(s, c, c.swingMean);
  const keys = new Set();
  let x = s.start.x, y = s.start.y, t = 0;
  const seen = new Set([K(x, y)]);
  const stack = [];
  let guard = 0, lastKeys = 0;
  while (guard++ < 200000) {
    if (x === s.exit.x && y === s.exit.y) return t;
    const got = m.keyAt.get(K(x, y));
    if (got && !keys.has(got)) { keys.add(got); }
    const ways = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      const canPush = m.pushable(x, y, nx, ny);
      if (!canPush && !m.passable(nx, ny, keys)) continue;
      if (seen.has(K(nx, ny))) continue;
      ways.push([nx, ny]);
    }
    if (ways.length) {
      const [nx, ny] = ways[(rnd() * ways.length) | 0];
      t += m.stepCost(x, y, nx, ny);
      stack.push([x, y]); seen.add(K(nx, ny));
      x = nx; y = ny;
    } else if (stack.length) {
      const [px, py] = stack.pop();
      t += m.stepCost(x, y, px, py);
      x = px; y = py;
    } else if (keys.size > lastKeys) {
      lastKeys = keys.size; seen.clear(); seen.add(K(x, y));   // new key, worth another look
    } else return NaN;                                          // nowhere left and no way out
  }
  return NaN;
}

// ── sweep: every reachable tile, then out ────────────────────────
function sweepTime(s, c) {
  const m = model(s, c, c.swingWorst);
  const keys = new Set([...m.keyAt.values()]);        // the worst case still ends up holding them
  let x = s.start.x, y = s.start.y, t = 0;
  const seen = new Set([K(x, y)]);
  const stack = [];
  let guard = 0;
  while (guard++ < 400000) {
    const ways = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!m.pushable(x, y, nx, ny) && !m.passable(nx, ny, keys)) continue;
      if (seen.has(K(nx, ny))) continue;
      ways.push([nx, ny]);
    }
    if (ways.length) {
      const [nx, ny] = ways[0];
      t += m.stepCost(x, y, nx, ny); stack.push([x, y]); seen.add(K(nx, ny)); x = nx; y = ny;
    } else if (stack.length) {
      const [px, py] = stack.pop(); t += m.stepCost(x, y, px, py); x = px; y = py;
    } else break;
  }
  return { t, covered: seen.size };
}

// ── a small deterministic rng, so a run is repeatable ────────────
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const fmt = (t) => { if (!isFinite(t)) return '—';
  const m2 = Math.floor(t / 60), s2 = t % 60;
  return m2 ? `${m2}m ${String(Math.floor(s2)).padStart(2, '0')}s` : `${s2.toFixed(1)}s`; };
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

// ── drive the real game to snapshot mazes ────────────────────────
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, hasTouch: true });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
await page.goto(URL + '?seed=1', { waitUntil: 'load' });
await page.waitForTimeout(900);

const C = await page.evaluate(() => ({
  speed: CONFIG.speed, squeezeSlow: CONFIG.squeezeSlow, pushHoldMs: CONFIG.pushHoldMs,
  sliderSeconds: CONFIG.sliderSeconds, swingSeconds: CONFIG.swingSeconds, introSeconds: CONFIG.introSeconds,
}));
const c = costs(C);

const snap = async (size, ph, seed) => page.evaluate(([size, ph, seed, PROTO]) => {
  SAVE.phase = ph; SAVE.stones = ph; SAVE.poolPending = false;
  SAVE.ui = PROTO ? { proto: PROTO } : { size };
  delete SAVE.run;
  generate(seed);
  return {
    W, H, size, seed, who: phase().who,
    tiles: tiles.map((row) => Array.from(row, (v) => (v ? '1' : '0')).join('')),
    start: { x: Math.floor(start.x), y: Math.floor(start.y) },
    exit: { x: Math.floor(exit.x), y: Math.floor(exit.y) },
    solutionPath: solutionPath.map((p) => [p[0], p[1]]),
    doors: doors.map((d) => ({ x: d.x, y: d.y, shape: d.shape })),
    innerKeys: [...innerKeys.entries()], keySpot, gated,
    crawlGaps: [...crawlGaps], crawlCells: [...crawlCells],
    sliders: sliders.map((sl) => ({ x: sl.x, y: sl.y, dx: sl.dx, dy: sl.dy, auto: !!sl.auto, gauntlet: !!sl.gauntlet, atStart: !!sl.atStart })),
  };
}, [size, ph, seed, PROTO]);

// ── why: one maze, and what each bot made of it ─────────────────
if (flag('why')) {
  const s = await snap(ONE_SIZE || 'md', PHASE, Number(arg('seed', 4242)));
  const m = model(s, c, c.swingBest);
  const reach = (keys) => { const seen = new Set([K(s.start.x, s.start.y)]), q2 = [[s.start.x, s.start.y]];
    while (q2.length) { const [x, y] = q2.pop();
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = K(nx, ny);
        if (seen.has(k)) continue;
        if (!m.pushable(x, y, nx, ny) && !m.passable(nx, ny, keys)) continue;
        seen.add(k); q2.push([nx, ny]); } }
    return seen; };
  const all = new Set([...m.keyAt.values()]);
  const r0 = reach(new Set()), rAll = reach(all);
  const { t, path } = floorRoute(s, c);
  console.log(`  ${s.size} ${s.W}x${s.H} seed ${s.seed} · start ${K(s.start.x, s.start.y)} exit ${K(s.exit.x, s.exit.y)}`);
  console.log(`  doors ${s.doors.length} (${s.doors.map((d) => d.shape).join(', ') || 'none'}) · keys ${[...m.keyAt.entries()].map(([k, v]) => v + '@' + k).join(', ') || 'none'} · gated ${s.gated}`);
  console.log(`  reachable with no keys ${r0.size} tiles, exit in it: ${r0.has(K(s.exit.x, s.exit.y))}`);
  console.log(`  reachable with every key ${rAll.size} tiles, exit in it: ${rAll.has(K(s.exit.x, s.exit.y))}`);
  for (const [k, sh] of m.keyAt) {
    const others = new Set([...all].filter((v) => v !== sh));
    console.log(`  key ${sh} at ${k}: reachable with nothing ${r0.has(k)}, with every other key ${reach(others).has(k)}`);
  }
  for (const sh of all) {
    const one = new Set([sh]);
    const rr = reach(one);
    console.log(`  holding only ${sh}: ${rr.size} tiles; exit ${rr.has(K(s.exit.x, s.exit.y))}; ` +
      [...m.keyAt.entries()].map(([k, v]) => v + ' ' + rr.has(k)).join(', '));
  }
  console.log(`  floor ${fmt(t)} over ${path.length} tiles`);
  let jumps = 0;
  for (let i2 = 1; i2 < path.length; i2++) {
    const d = Math.abs(path[i2][0] - path[i2-1][0]) + Math.abs(path[i2][1] - path[i2-1][1]);
    if (d !== 1) { jumps++; if (jumps < 5) console.log(`  JUMP at ${i2}: ${path[i2-1]} -> ${path[i2]} (d=${d})`); }
  }
  console.log(`  ${jumps} non-adjacent hops in the route`);
  await browser.close(); process.exit(0);
}

// ── validate: put a real player on the oracle's route and time it ──
// The model is only worth anything if the game agrees with it. This walks the
// route in the real game, at real speed, through the real input path, and
// prints what the clock said next to what the model predicted.
if (VALIDATE) {
  console.log('The Maze — walking the oracle\'s route for real\n');
  console.log('  size   seed     predicted   actual     difference');
  console.log('  ' + '─'.repeat(56));
  for (const size of SIZES) {
    const seed = 4242;
    const s = await snap(size, PHASE, seed);
    const { t: predicted, path } = floorRoute(s, c);
    if (!isFinite(predicted)) { console.log(`  ${size}: no route`); continue; }
    const actual = await page.evaluate(async ([path, size, ph, seed, PROTO]) => {
      SAVE.phase = ph; SAVE.stones = ph; SAVE.poolPending = false; SAVE.ui = PROTO ? { proto: PROTO } : { size };
      // tutorial cards pause the game until they are tapped, and a bot never taps. A person loses
      // a couple of seconds to each one the first time; that is not what we are measuring here.
      CONFIG.tutorials = false;
      delete SAVE.run; delete SAVE.pushLearned; reset(seed);
      document.body.classList.remove('pre'); $('title').classList.add('hide');
      started = true; intro = null; introWalk = null;
      player.x = path[0][0] + 0.5; player.y = path[0][1] + 0.5; cam.x = player.x; cam.y = player.y;
      t0 = gameNow(); solved = false;
      let i = 1, guard = 0;
      await new Promise((done) => {
        const step = () => {
          if (guard++ > 60 * 60 * 12) { held = null; return done(); }        // twelve minutes is a hang
          const cx = Math.floor(player.x), cy = Math.floor(player.y);
          while (i < path.length && path[i][0] === cx && path[i][1] === cy) i++;
          if (i >= path.length) { held = null; return done(); }
          const dx = Math.sign(path[i][0] - cx), dy = Math.sign(path[i][1] - cy);
          held = (dx || dy) ? (dx ? { dx, dy: 0 } : { dx: 0, dy }) : null;
          requestAnimationFrame(step);
        };
        step();
      });
      const ms = gameNow() - t0;
      held = null; $('msg').classList.remove('show'); solved = false;
      return { ms, at: [Math.floor(player.x), Math.floor(player.y)], exit: [exit.x, exit.y], steps: i };
    }, [path, size, PHASE, seed, PROTO]);
    const got = actual.ms / 1000;
    const arrived = actual.at[0] === actual.exit[0] && actual.at[1] === actual.exit[1];
    const diff = ((got - predicted) / predicted) * 100;
    console.log(`  ${size.padEnd(6)} ${String(seed).padEnd(8)} ${fmt(predicted).padEnd(11)} ${(arrived ? fmt(got) : 'lost at ' + actual.at).padEnd(10)} `
      + (arrived ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%` : ''));
  }
  if (errs.length) console.log('\n  page errors: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(0);
}

console.log('The Maze — three players');
console.log(`  walking speed ${C.speed} tiles/s · crawl ${C.squeezeSlow}x · push ${(C.pushHoldMs / 1000 + C.sliderSeconds).toFixed(2)}s · `
  + `gauntlet wait best 0s / mean ${c.swingMean.toFixed(2)}s / worst ${c.swingWorst.toFixed(2)}s`);
console.log(`  phase ${PHASE} · ${SEEDS} seeds per size · ${TRIALS} explorer runs per maze\n`);
console.log('  size   tiles    floor       farthest    explore (median)   p10 – p90              sweep        floor tiles  detour');
console.log('  ' + '─'.repeat(104));

const table = [];
for (const size of SIZES) {
  const rows = [];
  for (let i = 0; i < SEEDS; i++) {
    const s = await snap(size, PHASE, 4242 + i * 137);
    const f = floorTime(s, c);
    // what the locked doors are actually worth: the same route with every door standing open
    const fOpen = floorTime(Object.assign({}, s, { doors: [], innerKeys: [], gated: false, keySpot: null }), c);
    const r = rng(1000 + i);
    const runs = [];
    for (let t = 0; t < TRIALS; t++) { const v = exploreTime(s, c, r); if (isFinite(v)) runs.push(v); }
    const sw = sweepTime(s, c);
    // geometry only: every door open, so this is how long the longest route could be made, not
    // how long a key detour happens to be on this seed
    const far = farthest(Object.assign({}, s, { doors: [], innerKeys: [], gated: false, keySpot: null }), c);
    const floorTiles = s.tiles.join('').split('').filter((ch) => ch === '1').length;
    rows.push({ f, fOpen, far, runs, sw: sw.t, covered: sw.covered, floorTiles, route: s.solutionPath.length - 1, W: s.W, H: s.H });
  }
  const good = rows.filter((r) => isFinite(r.f) && r.runs.length);
  const lost = rows.length - good.length;
  const avg = (f) => good.reduce((a, r) => a + f(r), 0) / good.length;
  const rec = {
    size, W: rows[0].W, H: rows[0].H, lost,
    floor: avg((r) => r.f),
    median: avg((r) => pct(r.runs, 0.5)),
    p10: avg((r) => pct(r.runs, 0.1)),
    p90: avg((r) => pct(r.runs, 0.9)),
    sweep: avg((r) => r.sw),
    far: avg((r) => r.far),
    detour: avg((r) => r.f - r.fOpen),
    tiles: avg((r) => r.floorTiles),
    route: avg((r) => r.route),
  };
  table.push(rec);
  console.log(`  ${size.padEnd(6)} ${(rec.W + 'x' + rec.H).padEnd(8)} ${fmt(rec.floor).padEnd(11)} ${fmt(rec.far).padEnd(11)} ${fmt(rec.median).padEnd(18)} `
    + `${(fmt(rec.p10) + ' – ' + fmt(rec.p90)).padEnd(22)} ${fmt(rec.sweep).padEnd(12)} ${String(Math.round(rec.tiles)).padEnd(12)} ${rec.detour > 0.5 ? fmt(rec.detour) : '—'}`
    + (lost ? `   (${lost} maze(s) the model could not solve)` : ''));
}

console.log('\n  floor   = every right choice, nothing wasted. The fastest a maze can be walked.');
console.log('  explore = corridor by corridor, preferring a way you have not been, backing out of dead ends.');
console.log('  sweep   = every reachable tile walked before you leave. The worst an honest player can do.');
console.log('  farthest= the floor if the exit were moved to the tile furthest from the mat. The longest a');
console.log('            perfect run could be made without changing anything but where the way out is.');
console.log('  Add the waking (' + C.introSeconds + 's) to all three: nothing moves until it finishes.');
console.log('  Checked against the real game (--validate): it walks the oracle\'s route 4-15% faster than');
console.log('  the model says, because a real player cuts corners. Read these as a slightly slow clock.');
if (errs.length) console.log('\n  page errors: ' + errs.slice(0, 3).join(' | '));

await browser.close();
