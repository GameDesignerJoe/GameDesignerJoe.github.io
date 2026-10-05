// node stealth/tools/gen-check.js [count] — generates floors 1..12 for many seeds, reports failures and timing
const U = require('../js/util.js'); const LEVEL = require('../js/level.js');
const N = +process.argv[2] || 20;
let worst = 0, total = 0, fails = 0; const stats = {};
for (let fl = 1; fl <= 12; fl++) {
  let att = 0, g = 0, c = 0, st = 0, k = 0, ms = 0;
  for (let s = 0; s < N; s++) {
    const t0 = Date.now();
    let L; try { L = LEVEL.generate(U.hash(1234, s * 31 + fl), fl); } catch (e) { fails++; console.log('FAIL', fl, s, e.message); continue; }
    const dt = Date.now() - t0; ms += dt; worst = Math.max(worst, dt); total++;
    att += L.attempts; g += L.guards.length; c += L.cams.length; st += L.stars.length; k += L.keys.length;
  }
  console.log(`floor ${fl}: attempts ${(att / N).toFixed(1)}  guards ${(g / N).toFixed(1)}  cams ${(c / N).toFixed(1)}  stars ${(st / N).toFixed(1)}  keys ${(k / N).toFixed(1)}  ms ${(ms / N).toFixed(0)}`);
}
console.log('worst ms', worst, 'fails', fails);
