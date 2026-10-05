// NODE_PATH=$(npm root -g) node stealth/tools/ai-check.mjs
// Drives the real game headless: a guard sees you, chases, loses you, searches with its "?",
// gives up and goes back to its round; a guard that reaches you catches you; the stairs climb.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { cpRespawns } from './checkpoint-case.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${srv.address().port}/stealth/index.html`);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(800);
let fails = 0; const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails++; };

for (const fl of [2, 5, 9]) {
  // pick a patrolling guard with open floor in front of it; a few runs' floors have none, so try another run
  let gi = -1;
  for (let tries = 0; tries < 6 && gi < 0; tries++) {
    await page.evaluate(([n, t]) => { localStorage.clear(); if (t) GAME.save.runSeed = (Math.random() * 1e9) >>> 0; GAME.startFloor(n); }, [fl, tries]); await wait(300);
    await page.evaluate(() => GAME.skipIntro()); await wait(200);
    gi = await page.evaluate(() => {
      const f = GAME.L.field;
      return GAME.guards.findIndex(g => g.kind !== 'sentry' && f.ray(g.x, g.y, Math.cos(g.ang), Math.sin(g.ang), 120) > 110);
    });
  }
  if (gi < 0) { console.log('floor', fl, 'no open guard, skipped'); continue; }
  const seen = new Set();
  await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + Math.cos(g.ang) * 105, g.y + Math.sin(g.ang) * 105); window.__watch = i; window.__states = []; }, gi);
  // the meter fills over seconds on low floors (about 2.4s at 105 units on floor 2), so allow up to ~6s
  for (let t = 0; t < 110; t++) {
    const s = await page.evaluate(() => { const g = GAME.guards[__watch]; return g.state; });
    seen.add(s);
    if (s === 'chase') break;
    // stand still in front of them
    await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + Math.cos(g.ang) * 105, g.y + Math.sin(g.ang) * 105); }, gi);
    await wait(50);
  }
  check(seen.has('sus') && seen.has('chase'), `floor ${fl}: seen -> suspicious -> chase (${[...seen].join(',')}, aw ${await page.evaluate(() => GAME.guards[__watch].aw.toFixed(2))})`);
  // vanish: far away, at the entrance
  await page.evaluate(() => { const e = GAME.L.entrance; GAME.teleport(e.x, e.y); GAME.P.alive = true; });
  const after = new Set(); let qa = [];
  for (let t = 0; t < 140; t++) {
    const r = await page.evaluate(() => { const g = GAME.guards[__watch]; return [g.state, g.bubble ? g.bubble.k + g.bubble.a.toFixed(2) : '-']; });
    after.add(r[0]); if (r[0] === 'search') qa.push(r[1]);
    if (r[0] === 'patrol' && after.has('return')) break;
    await wait(100);
  }
  check(after.has('search'), `floor ${fl}: lost you -> search`);
  check(qa.some(b => b.startsWith('?1')) && qa.some(b => /^\?0\.[0-6]/.test(b)), `floor ${fl}: "?" shown then fades (${qa[0]} .. ${qa[qa.length - 1]})`);
  check(after.has('return') && after.has('patrol'), `floor ${fl}: returns to patrol (${[...after].join(',')})`);
  // caught
  await page.evaluate((i) => { const g = GAME.guards[i]; GAME.teleport(g.x + 4, g.y + 4); }, gi); await wait(300);
  check(await page.evaluate(() => GAME.mode) === 'caught', `floor ${fl}: touching a guard catches you`);
  await wait(2600);
  check(await page.evaluate(() => GAME.mode === 'intro' || GAME.mode === 'play'), `floor ${fl}: the floor restarts`);
  await page.evaluate(() => GAME.skipIntro());
  await page.evaluate(() => { const e = GAME.L.exit; GAME.teleport(e.x, e.y); }); await wait(4000);
  check(await page.evaluate(() => GAME.floor) === fl + 1, `floor ${fl}: the stairs lead to floor ${fl + 1}`);
}
// hide mid-chase. 'cover': break its line of sight, then slip into a shade and hold still: the guard
// searches the rim and gives up. 'watched': walk into the shade in plain view: the guard walks in after you.
for (const [seed, fl, how] of [[22, 5, 'cover'], [44, 9, 'cover'], [9, 7, 'cover'], [5, 12, 'cover'], [22, 5, 'watched'], [44, 9, 'watched'], [9, 7, 'watched']]) {
  await page.evaluate(([s, n]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); }, [seed, fl]); await wait(300);
  await page.evaluate(() => GAME.skipIntro()); await wait(200);
  const ok = await page.evaluate(() => {
    const f = GAME.L.field;
    for (const sh of GAME.L.shades) for (const g of GAME.guards) {
      const d = Math.hypot(g.x - sh.x, g.y - sh.y);
      if (d > 130 && d < 220 && f.ray(sh.x, sh.y, (g.x - sh.x) / d, (g.y - sh.y) / d, d) >= d - 4) { window.__sh = sh; window.__g = g; return true; }
    }
    return false;
  });
  if (!ok) { console.log('floor', fl, 'no shade in sight of a guard, skipped'); continue; }
  let st = '';
  for (let t = 0; t < 60 && st !== 'chase'; t++) {
    st = await page.evaluate(() => { const sh = __sh, g = __g, d = Math.hypot(g.x - sh.x, g.y - sh.y);
      GAME.teleport(sh.x + (g.x - sh.x) / d * 55, sh.y + (g.y - sh.y) / d * 55); g.ang = Math.atan2(GAME.P.y - g.y, GAME.P.x - g.x); return g.state; });
    if (st !== 'chase') await wait(50);
  }
  // out of its sight a moment (as if round a corner), and straight into the pool
  if (st !== 'chase') { console.log('floor', fl, how, 'no chase started, skipped'); continue; }
  const shR = await page.evaluate(() => __sh.r);
  if (how === 'cover') await page.evaluate(() => GAME.teleport(__sh.x, __sh.y));
  const seen = new Set([st]); let hid = false, mode = 'play', closest = 1e9;
  for (let t = 0; t < 160; t++) {
    const r = await page.evaluate(() => { const sh = __sh, P = GAME.P, dx = sh.x - P.x, dy = sh.y - P.y, d = Math.hypot(dx, dy);
      if (d > 3) { GAME.stick.on = true; GAME.stick.x = dx / d * 0.7; GAME.stick.y = dy / d * 0.7; } else { GAME.stick.on = false; GAME.stick.x = GAME.stick.y = 0; }
      return [__g.state, P.hidden, GAME.mode, Math.hypot(__g.x - sh.x, __g.y - sh.y)]; });
    seen.add(r[0]); hid = hid || r[1]; mode = r[2]; if (hid) closest = Math.min(closest, r[3]);
    if (how === 'watched' && (mode === 'caught' || closest < shR)) break;
    if (mode === 'caught' || (hid && r[0] === 'patrol' && seen.has('return'))) break;
    await wait(100);
  }
  await page.evaluate(() => { GAME.stick.on = false; GAME.stick.x = GAME.stick.y = 0; });
  const by = mode === 'caught' ? await page.evaluate(() => { const c = GAME.guards.find(g => Math.hypot(g.x - GAME.P.x, g.y - GAME.P.y) < 20); return c === __g ? 'by it' : c ? 'by another guard' : 'by ?'; }) : '';
  if (how === 'cover') check(seen.has('chase') && hid && seen.has('search') && seen.has('return') && mode !== 'caught', `floor ${fl}: chased, broke sight, hid in a shade -> search, return, not caught (${[...seen].join(',')}, ${mode} ${by})`);
  else check(hid && (mode === 'caught' || closest < shR), `floor ${fl}: dived into a shade in plain view -> the guard walks in (${mode}, closest ${closest.toFixed(0)})`);
  if (mode === 'caught') await wait(2600);
}
// being spotted is a beat, not a capture: the '!' guard stands a moment before it runs, the shout only
// brings guards close by, and they come at a walk; a dive into a shade in plain view is called out
// as seen, not 'Hidden'; a glimpse is investigated, at an amble
{
  let tried = 0, still = 0, recruitsHurry = 0, recruits = 0, warned = 0, dives = 0, glimpse = 0, glimpseN = 0, amble = 0;
  for (const [seed, fl] of [[22, 5], [44, 9], [9, 7], [5, 12], [11, 6], [33, 8]]) {
    await page.evaluate(([s, n]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); GAME.skipIntro(); GAME.stick.on = false; }, [seed, fl]); await wait(250);
    const gi = await page.evaluate(() => { const f = GAME.L.field; return GAME.guards.findIndex(g => g.kind !== 'sentry' && f.ray(g.x, g.y, Math.cos(g.ang), Math.sin(g.ang), 120) > 110); });
    if (gi < 0) continue;
    // a glimpse: about half the meter, then gone round a corner (far away); the guard walks over to look
    await page.evaluate((i) => { window.__g = GAME.guards[i]; }, gi);
    let aw = 0;
    for (let t = 0; t < 80 && aw < 0.4; t++) {
      aw = await page.evaluate(() => { const g = __g; GAME.teleport(g.x + Math.cos(g.ang) * 100, g.y + Math.sin(g.ang) * 100); return g.aw; });
      await wait(30);
    }
    if (aw >= 0.4 && aw < 0.56) {
      glimpseN++;
      await page.evaluate(() => { const e = GAME.L.entrance; GAME.teleport(e.x, e.y); });
      let st = '';
      for (let t = 0; t < 40 && st !== 'search' && st !== 'return'; t++) { st = await page.evaluate(() => __g.state); await wait(100); }
      if (st === 'search') { glimpse++; if (await page.evaluate(() => !__g.hurry)) amble++; }
    }
    // spotted: the startle, then the shout
    await page.evaluate(([s, n]) => { GAME.save.runSeed = s; GAME.startFloor(n); GAME.skipIntro(); }, [seed, fl]); await wait(200);
    await page.evaluate((i) => { window.__g = GAME.guards[i]; }, gi);
    let r = null;
    for (let t = 0; t < 400 && !r; t++) {
      r = await page.evaluate(() => { const g = __g; if (g.state === 'chase') return { x: g.x, y: g.y }; GAME.teleport(g.x + Math.cos(g.ang) * 60, g.y + Math.sin(g.ang) * 60); return null; });
      if (!r) await wait(16);
    }
    if (!r) continue;
    tried++;
    await wait(200);
    const m = await page.evaluate((r) => ({ d: Math.hypot(__g.x - r.x, __g.y - r.y), rec: GAME.guards.filter(o => o !== __g && o.state === 'search').map(o => o.hurry) }), r);
    if (m.d < 3) still++;
    recruits += m.rec.length; recruitsHurry += m.rec.filter(h => h).length;
    // into a shade in plain view: a red ring and the warning, not the 'hide' puff
    const ok = await page.evaluate(() => { const sh = GAME.L.shades.find(s => Math.hypot(s.x - __g.x, s.y - __g.y) < 400); if (!sh) return false; __g.lost = 0; __g.state = 'chase'; GAME.P.hidden = false; GAME.teleport(sh.x, sh.y); return true; });
    if (ok) { dives++; await wait(120); if (await page.evaluate(() => GAME.P.exposedT > 0 && /saw you go in/.test(document.getElementById('toast').textContent))) warned++; }
    if (await page.evaluate(() => GAME.mode) === 'caught') await wait(2600);
  }
  check(tried >= 3 && still === tried, `spotted: ${still}/${tried} guards hold still for their startle before running`);
  check(recruitsHurry === 0, `spotted: the shout brings ${recruits} guards, ${recruitsHurry} of them at a run`);
  check(dives >= 3 && warned === dives, `dive in plain view: ${warned}/${dives} warned they saw you go in`);
  check(glimpseN >= 2 && glimpse === glimpseN && amble === glimpse, `glimpse: ${glimpse}/${glimpseN} half-filled meters come over to look (${amble} at a walk)`);
}
// cameras see out from their walls: the ray along each camera's facing reaches into the room
{
  let n = 0, blind = 0;
  for (const [seed, fl] of [[1, 8], [2, 6], [4, 10], [7, 5], [11, 9], [22, 12]]) {
    await page.evaluate(([s, f]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(f); }, [seed, fl]); await wait(200);
    const r = await page.evaluate(() => GAME.cams.map(c => GAME.L.field.ray(c.x + Math.cos(c.base) * 6, c.y + Math.sin(c.base) * 6, Math.cos(c.base), Math.sin(c.base), 200)));
    n += r.length; blind += r.filter(t => t <= 60).length;
  }
  check(n > 0 && blind === 0, `cameras: ${n} checked, ${blind} blind (ray along their facing under 60)`);
}
// fairness: no sentry posted by a doorway, and no beat through the first door out of the stairs room
{
  let bad = 0, n = 0;
  for (let s = 1; s <= 12; s++) for (const fl of [4, 7, 8, 10]) {
    await page.evaluate(([a, f]) => { localStorage.clear(); GAME.save.runSeed = a; GAME.startFloor(f); }, [s, fl]);
    bad += await page.evaluate(() => { const L = GAME.L, first = L.rooms.find(r => r.idx === 0 && !r.side).outConn.mouth;
      let b = 0;
      for (const g of L.guards) {
        if (g.kind === 'sentry' && L.conns.some(c => Math.hypot(c.mouth.x - g.x, c.mouth.y - g.y) < 80)) b++;
        if (g.path && g.path.some(q => Math.hypot(q.x - first.x, q.y - first.y) < 90)) b++;
      }
      return b; });
    n++;
  }
  check(bad === 0, `fairness: ${n} floors, ${bad} guards plugging a doorway`);
}
// checkpoint: take a key, open its door, get caught: you start again through that door, key kept
{
  await page.evaluate(() => { localStorage.clear(); GAME.save.runSeed = 3; GAME.startFloor(5); }); await wait(300);
  await page.evaluate(() => GAME.skipIntro()); await wait(200);
  await page.evaluate(() => { GAME.guards.forEach(g => { g.x = g.home.x = 1e5; g.y = g.home.y = 1e5; g.path = null; g.kind = 'sentry'; }); const k = GAME.L.keys[0]; GAME.teleport(k.x, k.y); }); await wait(300);
  const door = await page.evaluate(() => { const d = GAME.L.keys[0].door, m = d.conn.mouth, n = d.conn.dirFrom(d.conn.a); GAME.teleport(m.x - n.x * 22, m.y - n.y * 22); return { x: m.x, y: m.y }; }); await wait(400);
  const opened = await page.evaluate(() => GAME.L.keys[0].door.open);
  await page.evaluate(() => { const g = GAME.guards[0]; g.x = GAME.P.x + 3; g.y = GAME.P.y + 3; }); await wait(300);
  const caught = await page.evaluate(() => GAME.mode); await wait(2800);
  const r = await page.evaluate(() => ({ x: GAME.P.x, y: GAME.P.y, key: GAME.P.keys.length, open: GAME.L.keys[0].door.open }));
  const d = Math.hypot(r.x - door.x, r.y - door.y);
  check(opened && caught === 'caught' && d < 70 && r.key === 1 && r.open, `checkpoint: caught after opening a door -> back at that door (${d.toFixed(0)} from it), key kept ${r.key}, door open ${r.open}`);
}
// checkpoint respawns are fair: at every door's checkpoint (5 runs x floors 2-12), stand still: nobody looks for 4s
{
  const r = await cpRespawns(browser, `http://localhost:${srv.address().port}/stealth/index.html`, [11, 22, 33, 44, 55], [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const bad = r.filter(x => x.bad);
  check(r.length > 50 && !bad.length, `checkpoint respawns: ${r.length} doors, ${bad.length} noticed within 4s standing still${bad.length ? ' (' + bad.slice(0, 4).map(x => `run ${x.seed} floor ${x.fl} door ${x.i}: ${x.bad}`).join('; ') + ')' : ''}`);
}
check(errors.length === 0, 'no page errors ' + errors.join(' | '));
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
