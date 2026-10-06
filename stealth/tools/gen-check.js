// node stealth/tools/gen-check.js [count] [top] — generates floors 1..top (default 12) for many seeds, reports failures and timing,
// then checks the building kinds a run climbs through: never the same kind twice in a row, and at least
// four kinds in any ten floors running. Reports the guard mix per floor too: walkers, posts, and the floors where
// posts outnumber walkers two to one (sentry-heavy). Also fails a camera that can't see out from its wall, a plugged
// route (forcedExposure), a leg no timing gets through (timedRoute) and two keys on one spot.
const U = require('../js/util.js'); const LEVEL = require('../js/level.js');
const N = +process.argv[2] || 20, TOP = +process.argv[3] || 12;   // top: the highest floor generated
let worst = 0, total = 0, fails = 0, timed = 0; const kinds = {};
for (let fl = 1; fl <= TOP; fl++) {
  let att = 0, g = 0, c = 0, st = 0, k = 0, sh = 0, ms = 0, blind = 0, wk = 0, heavy = 0;
  for (let s = 0; s < N; s++) {
    const t0 = Date.now(), runSeed = 1234 + s;
    let L; try { L = LEVEL.generate(U.hash(runSeed, fl), fl, LEVEL.history(runSeed, fl)); } catch (e) { fails++; console.log('FAIL', fl, s, e.message); continue; }
    const dt = Date.now() - t0; ms += dt; worst = Math.max(worst, dt); total++;
    att += L.attempts; g += L.guards.length; c += L.cams.length; st += L.stars.length; k += L.keys.length; sh += L.shades.length;
    kinds[L.plan.kind] = (kinds[L.plan.kind] || 0) + 1;
    const nw = L.guards.filter(o => o.path).length; wk += nw; if (L.guards.length - nw >= 2 * nw) heavy++;
    // every leg of the floor has a lane no post or camera watches all through its sweep, and no key sits in one
    const fx = LEVEL.forcedExposure(L, L.field);
    if (fx.cost > 0.25) { fails++; console.log('FAIL plugged route', fl, s, fx.cost.toFixed(2), fx.who && (fx.who.kind || 'cam') + ' ' + fx.who.x.toFixed(0) + ',' + fx.who.y.toFixed(0)); }
    // and every leg can be done on timing, sneaking through the sweeps and beats as they come round under half a meter
    const tr = LEVEL.timedRoute(L, L.field);
    if (!tr.ok) { fails++; timed++; console.log('FAIL no timed route', fl, s, 'leg ' + tr.leg, tr.who && (tr.who.kind || 'cam') + ' ' + tr.who.x.toFixed(0) + ',' + tr.who.y.toFixed(0)); }
    // and no two keys share a spot, so each one shows on the map
    L.keys.forEach((a, i) => { if (L.keys.some((b, j) => j > i && Math.hypot(a.x - b.x, a.y - b.y) < 50)) { fails++; console.log('FAIL stacked keys', fl, s, a.x.toFixed(0), a.y.toFixed(0)); } });
    for (const cm of L.cams) {
      const ex = cm.x + Math.cos(cm.base) * 6, ey = cm.y + Math.sin(cm.base) * 6;
      if (L.field.ray(ex, ey, Math.cos(cm.base), Math.sin(cm.base), 200) <= 60) { blind++; fails++; console.log('FAIL blind camera', fl, s, cm.x.toFixed(0), cm.y.toFixed(0)); }
    }
  }
  console.log(`floor ${fl}: attempts ${(att / N).toFixed(1)}  guards ${(g / N).toFixed(1)}  cams ${(c / N).toFixed(1)}  walkers ${(wk / N).toFixed(1)}  posts ${((g - wk) / N).toFixed(1)}  sentry-heavy ${heavy}/${N}  shades ${(sh / N).toFixed(1)}  stars ${(st / N).toFixed(1)}  keys ${(k / N).toFixed(1)}  ms ${(ms / N).toFixed(0)}`);
}
console.log('kinds', JSON.stringify(kinds));
// variety over whole runs
let runs = 0, minDistinct = 99, repeats = 0, thin = 0;
for (let r = 0; r < 300; r++) {
  const runSeed = 1234 + r, seq = LEVEL.history(runSeed, 21).reverse();   // floors 1..20
  runs++;
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) { repeats++; if (repeats < 4) console.log('FAIL repeat', runSeed, i + 1, seq.join(' ')); }
  for (let i = 0; i + 10 <= seq.length; i++) { const d = new Set(seq.slice(i, i + 10)).size; minDistinct = Math.min(minDistinct, d); if (d < 4) { thin++; if (thin < 4) console.log('FAIL thin', runSeed, i + 1, seq.join(' ')); } }
}
fails += repeats + thin;
console.log(`variety: ${runs} runs of 20 floors, ${repeats} back-to-back repeats, fewest kinds in any 10 floors ${minDistinct}`);
console.log('worst ms', worst, 'no timed route', timed + '/' + total, 'fails', fails);
process.exit(fails ? 1 : 0);
