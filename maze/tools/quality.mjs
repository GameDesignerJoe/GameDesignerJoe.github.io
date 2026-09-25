#!/usr/bin/env node
// The Maze — is it worth walking?
//
// `harness.mjs` proves a maze is *playable*: the exit is reachable, every door
// severs the route, each key is winnable before its door, nothing is stranded.
// Twenty-odd invariants and not one of them asks whether the maze is any good.
//
// That gap is why the same five complaints keep coming back from Joe. Each one
// is a number nobody was keeping:
//
//   "I still find keys not in vaults"      → vaulted, and all-vaulted
//   "the exit is easy to stumble into"     → gauntlet, gated, depth, beyond
//   "I finish in a couple of minutes"      → bots.mjs, which already measures it
//   "I'm not seeing districts"             → shape.mjs thresholds, and districts
//   "rooms are pushed into the same space" → landmarks, and the gap between them
//
// So this is the quality half of the sweep. It reports; it never fails. A
// target is a design decision and belongs to Joe, not to a tool — the point
// here is that the numbers exist at all, and that a change which quietly
// undoes one of them has somewhere to show up.
//
//   node maze/tools/quality.mjs                  # every self, at its own size
//   node maze/tools/quality.mjs --seeds 120      # a firmer read
//   node maze/tools/quality.mjs --phase 2        # one self
//   node maze/tools/quality.mjs --size lg        # override the phase's own size
//   node maze/tools/quality.mjs --json           # the rows, unformatted
//
// Needs a static server on --port (default 8765), from the repo root:
//   python3 -m http.server 8765
//
// Read-only, and it shares nothing with the other suites, so it can run
// alongside them. See tools/README.md and docs/QUALITY.md for the baseline.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : (argv[i + 1] ?? true); };
const flag = (n) => argv.includes('--' + n);
const SEEDS = Number(arg('seeds', 30));
const PORT = Number(arg('port', 8765));
const ONE_PHASE = arg('phase', null);
const ONE_SIZE = arg('size', null);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
await page.goto(`http://127.0.0.1:${PORT}/maze/maze-topdown.html?seed=1`, { waitUntil: 'load' });
await page.waitForTimeout(900);

const rows = await page.evaluate(([SEEDS, ONE_PHASE, ONE_SIZE]) => {
  // The measurement itself is js/contract.js, which the game loads and the tuner
  // loads. This tool used to carry its own copy and the copy was wrong: it took a
  // room's distance to another room from a flood that could start at a well but
  // never finish at one, so 17% of landmarks were invisible as destinations and
  // the gap read high. One definition now, in one place.
  const phases = ONE_PHASE == null ? PHASES.map((_, i) => i) : [Number(ONE_PHASE)];
  const out = [];

  for (const ph of phases) {
    // the phase's own size unless one was named, so this table cannot drift
    // away from PHASES when Joe moves a self up a size
    const size = ONE_SIZE || PHASES[ph].size;
    const recs = [], missed = {};
    let shortfall = 0;

    for (let i = 0; i < SEEDS; i++) {
      // every SAVE field generate() reads, set explicitly: a maze measured
      // against a save another script left behind is a maze nobody played
      SAVE.phase = ph; SAVE.stones = ph; SAVE.poolPending = false;
      SAVE.collected = {}; SAVE.pushLearned = true;
      SAVE.ui = { size };
      delete SAVE.run;
      generate(4242 + i * 137);

      const m = CONTRACT.measure();
      recs.push(m);
      if (contractMiss.length) shortfall++;
      for (const c of contractMiss) missed[c.key] = (missed[c.key] || 0) + 1;
    }

    const avg = (f) => recs.reduce((a, r) => a + f(r), 0) / recs.length;
    const sum = (f) => recs.reduce((a, r) => a + f(r), 0);
    const keysTot = sum((r) => r.keys);
    // mazes that have keys at all — a phase with no doors is not failing to vault them
    const withKeys = recs.filter((r) => r.keys > 0).length;
    const gapped = recs.filter((r) => r.rooms > 1).map((r) => r.roomGap).sort((a, b) => a - b);
    out.push({
      phase: ph, who: PHASES[ph].who, size,
      floor: Math.round(avg((r) => r.floor)),
      doors: +avg((r) => r.doors).toFixed(1),
      onRoute: +avg((r) => r.doorsOnRoute).toFixed(1),
      beyondPct: Math.round(100 * avg((r) => r.beyond)),
      vaultPct: keysTot ? Math.round(100 * sum((r) => r.vaulted) / keysTot) : null,
      allVaultPct: withKeys ? Math.round(100 * recs.filter((r) => r.allVaulted).length / withKeys) : null,
      detour: withKeys ? Math.round(avg((r) => r.keyDetour)) : null,
      depth: +avg((r) => r.exitDepth).toFixed(2),
      gatedPct: Math.round(100 * avg((r) => (r.gated ? 1 : 0))),
      gauntlet: Math.round(avg((r) => r.exitGuard)),
      landmarks: +avg((r) => r.rooms).toFixed(1),
      gapMin: gapped.length ? gapped[0] : null,
      gapMed: gapped.length ? gapped[gapped.length >> 1] : null,
      thresholds: +avg((r) => r.thresholds).toFixed(2),
      loops: Math.round(avg((r) => r.loops)),
      firstFork: (() => { const g = recs.filter((r) => r.firstFork != null);
        return g.length ? Math.round(g.reduce((a, r) => a + r.firstFork, 0) / g.length) : null; })(),
      districts: +avg((r) => r.districts).toFixed(1),
      shortPct: Math.round(100 * shortfall / SEEDS),
      missed,
    });
  }
  return out;
}, [SEEDS, ONE_PHASE, ONE_SIZE]);

if (flag('json')) {
  console.log(JSON.stringify({ seeds: SEEDS, rows, errs }, null, 1));
} else {
  const pct = (v) => (v == null ? '—' : v + '%');
  console.log('\nThe Maze — is it worth walking?');
  console.log(`  ${SEEDS} seeds a self · each at its own size unless --size said otherwise\n`);
  console.log('  self                 size  floor   keys vaulted  every key  doors  on route  exit at  beyond  locked  gauntlet  rooms  gap min/med  divides  loops  1st fork  fell short');
  console.log('  ' + '─'.repeat(140));
  for (const r of rows) {
    console.log(
      '  ' + `${r.phase} ${r.who}`.padEnd(21)
      + `${r.size.padEnd(6)}`
      + `${String(r.floor).padEnd(8)}`
      + `${pct(r.vaultPct).padEnd(14)}`
      + `${pct(r.allVaultPct).padEnd(11)}`
      + `${String(r.doors).padEnd(7)}`
      + `${String(r.onRoute).padEnd(10)}`
      + `${(r.depth.toFixed(2)).padEnd(9)}`
      + `${(r.beyondPct + '%').padEnd(8)}`
      + `${(r.gatedPct + '%').padEnd(8)}`
      + `${String(r.gauntlet).padEnd(10)}`
      + `${String(r.landmarks).padEnd(7)}`
      + `${(r.gapMin == null ? '—' : r.gapMin + ' / ' + r.gapMed).padEnd(13)}`
      + `${String(r.thresholds).padEnd(9)}`
      + `${String(r.loops).padEnd(7)}`
      + `${(r.firstFork == null ? '—' : r.firstFork + 't').padEnd(10)}`
      + `${r.shortPct}%` + (Object.keys(r.missed).length
          ? '  ' + Object.entries(r.missed).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
          : ''));
  }
  console.log(`
  keys vaulted  share of all keys lying in a nest rather than a hall.
  every key     share of mazes where *no* key is loose. This is the one to read:
                the average hides a maze that vaulted one key of two.
  on route      doors that actually stand on the solution path.
  exit at       walking distance to the exit as a share of the maze's far point.
  beyond        how much of the floor lies further out than the exit does.
  gauntlet      tiles of the squeeze tree guarding the way out. 0 = nothing guards it.
  gap           walking distance between the two closest rooms, min and median over the sweep.
  divides       thresholds: places the maze splits in two. See docs/QUALITY.md.
  loops         independent cycles in the cell graph. Every loop costs a chokepoint, so this
                is the mechanism behind divides: divides is near zero BECAUSE this is not.
  1st fork      tiles walked before the maze first asks a question. Room tiles do not count.
  fell short    share of mazes generate() could not build to the chapter's MUST row, and
                which clauses it could not meet. This is the number that was missing:
                the loop always did settle for the best it could find, and never said so.

  Time to finish is bots.mjs; thresholds and districts you can feel are shape.mjs.`);
}

if (errs.length) console.log('\n  page errors: ' + errs.slice(0, 4).join(' · '));
await browser.close();
