// NODE_PATH=$(npm root -g) node stealth/tools/ai-check.mjs [--quick]
// Takes about 7 minutes: run it with no timeout under it (a shell's 120-400s default kills it part way, and the
// browser closing under it then reads like a failure). --quick runs the checkpoint-respawn sweep on 2 runs, not 5.
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
// each line says how far in it is, so a run cut short by a timeout shows where and when it stopped
const T0 = Date.now(), el = () => ((Date.now() - T0) / 1000).toFixed(0).padStart(4) + 's ';
let fails = 0; const check = (ok, what) => { console.log(el() + (ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails++; };
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { console.log(`${el()}STOPPED by ${sig} (a timeout?) after ${fails} FAIL: not a result, ai-check needs about 7 minutes`); process.exit(2); });
const QUICK = process.argv.includes('--quick');

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
  // every frame's state, not just the 100ms polls: a guard whose search ends on its own route is in 'return' for a frame
  await page.evaluate(() => { window.__st = new Set(); if (!window.__rec) { window.__rec = true; const rec = () => { const g = GAME.guards[window.__watch]; if (g && window.__st) window.__st.add(g.state); requestAnimationFrame(rec); }; rec(); } });
  const after = new Set(); let qa = [];
  // up to 22s: a guard that peeks (floor 6 up) checks a shade after its search before it goes back
  for (let t = 0; t < 220; t++) {
    const r = await page.evaluate(() => { const g = GAME.guards[__watch]; return [g.state, g.bubble ? g.bubble.k + g.bubble.a.toFixed(2) : '-']; });
    after.add(r[0]); if (r[0] === 'search') qa.push(r[1]);
    for (const k of await page.evaluate(() => [...window.__st])) after.add(k);
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
for (const [seed, fl, how] of [[22, 5, 'cover'], [44, 9, 'cover'], [9, 7, 'cover'], [5, 12, 'cover'], [13, 8, 'cover'], [31, 10, 'cover'], [17, 6, 'cover'],
  [22, 5, 'watched'], [44, 9, 'watched'], [9, 7, 'watched'], [13, 8, 'watched'], [31, 10, 'watched'], [17, 6, 'watched']]) {
  await page.evaluate(([s, n]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); }, [seed, fl]); await wait(300);
  await page.evaluate(() => GAME.skipIntro()); await wait(200);
  const ok = await page.evaluate(() => {
    const f = GAME.L.field;
    for (const sh of GAME.L.shades) for (const g of GAME.guards) {
      const d = Math.hypot(g.x - sh.x, g.y - sh.y);
      if (d > 130 && d < 220 && f.ray(sh.x, sh.y, (g.x - sh.x) / d, (g.y - sh.y) / d, d) >= d - 4) {
        window.__sh = sh; window.__g = g;
        // one guard's scene: the others are sent off the floor, so none of them joins in and decides it instead
        GAME.guards.forEach(o => { if (o !== g) { o.x = o.home.x = 1e5; o.y = o.home.y = 1e5; o.path = null; o.kind = 'sentry'; } });
        return true;
      }
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
  // cover: the far half of the pool from the guard, where even a thorough guard's peek can't see in
  await page.evaluate((how) => { const sh = __sh, g = __g, d = Math.hypot(sh.x - g.x, sh.y - g.y) || 1, k = how === 'cover' ? sh.r * 0.55 : 0;
    window.__hide = { x: sh.x + (sh.x - g.x) / d * k, y: sh.y + (sh.y - g.y) / d * k }; if (how === 'cover') GAME.teleport(__hide.x, __hide.y); }, how);
  const seen = new Set([st]); let hid = false, mode = 'play', closest = 1e9;
  for (let t = 0; t < 160; t++) {
    const r = await page.evaluate(() => { const sh = __sh, P = GAME.P, dx = __hide.x - P.x, dy = __hide.y - P.y, d = Math.hypot(dx, dy);
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
// the shout, tested on a known case rather than whatever the floors above happen to hold: a pair on one
// loop (floor 7 up) in plain view of each other under 170 apart. The first is spotted from right in front;
// the second must be called over, and at a walk (hurry 0)
{
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed++) for (const fl of [7, 8, 9, 10, 11, 12]) {
    found = await page.evaluate(([s, n]) => {
      localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); GAME.skipIntro(); GAME.stick.on = false;
      const f = GAME.L.field, gs = GAME.guards;
      for (const a of gs) for (const b of gs) {
        if (a === b || !a.path || b.path !== a.path) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 165 || f.ray(a.x, a.y, (b.x - a.x) / d, (b.y - a.y) / d, d) < d - 4) continue;
        // the player stands just in front of a; b mustn't see them itself (it would be suspicious, not called)
        const px = a.x + Math.cos(a.ang) * 19, py = a.y + Math.sin(a.ang) * 19;
        if (f.sample(px, py) < 8) continue;
        const e = Math.atan2(py - b.y, px - b.x), pd = Math.hypot(px - b.x, py - b.y);
        if (Math.abs(((e - b.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.1 && pd < 220) continue;
        return { s, n, a: a.id, b: b.id };
      }
      return null;
    }, [seed, fl]);
    if (found) break;
  }
  if (!found) check(false, 'shout: no floor 7-12 in 60 runs has a pair on one loop in view under 165 apart');
  else {
    const r = await page.evaluate(({ a, b }) => new Promise(res => {
      const A = GAME.guards[a], B = GAME.guards[b];
      GAME.teleport(A.x + Math.cos(A.ang) * 19, A.y + Math.sin(A.ang) * 19);
      let t = 0; const iv = setInterval(() => {
        if (A.state === 'chase' || ++t > 30) { clearInterval(iv); setTimeout(() => res({ a: A.state, b: B.state, hurry: B.hurry, d: Math.hypot(A.x - B.x, A.y - B.y) }), 60); }
      }, 16);
    }), found);
    check(r.a === 'chase' && r.b === 'search' && !r.hurry, `shout: run ${found.s} floor ${found.n}, a pair ${r.d.toFixed(0)} apart: spotter ${r.a}, partner ${r.b} ${r.hurry ? 'at a run' : 'at a walk'}`);
    if (await page.evaluate(() => GAME.mode) === 'caught') await wait(2600);
  }
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
        if (g.kind === 'sentry' && L.conns.some(c => Math.hypot(c.mouth.x - g.x, c.mouth.y - g.y) < 60)) b++;
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
  const r = await cpRespawns(browser, `http://localhost:${srv.address().port}/stealth/index.html`, QUICK ? [11, 33] : [11, 22, 33, 44, 55], [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const bad = r.filter(x => x.bad);
  check(r.length > (QUICK ? 20 : 50) && !bad.length, `checkpoint respawns: ${r.length} doors, ${bad.length} noticed within 4s standing still${bad.length ? ' (' + bad.slice(0, 4).map(x => `run ${x.seed} floor ${x.fl} door ${x.i}: ${x.bad}`).join('; ') + ')' : ''}`);
}
// the knock: a guard on its rounds within earshot comes over to look, at a walk; then it's spent for 6s
{
  let n = 0, came = 0, walk = 0, spent = 0;
  for (const [seed, fl] of [[3, 4], [8, 6], [12, 9], [21, 11]]) {
    await page.evaluate(([s, f]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(f); GAME.skipIntro(); GAME.stick.on = false; }, [seed, fl]); await wait(150);
    // a wipe or retry left over from the test before can land late: wait until this floor is really in play
    for (let i = 0; i < 30; i++) {
      const ok = await page.evaluate(() => GAME.mode === 'play' && GAME.P && GAME.P.alive && !document.getElementById('pause').classList.contains('show'));
      if (ok) break;
      await page.evaluate((f) => { if (GAME.mode !== 'intro') GAME.startFloor(f); GAME.skipIntro(); GAME.setOverview(false); }, fl); await wait(100);
    }
    const r = await page.evaluate(() => {
      const f = GAME.L.field, g = GAME.guards.find(g => g.path && f.ray(g.x, g.y, -Math.cos(g.ang), -Math.sin(g.ang), 90) > 85);
      if (!g) return null;
      GAME.teleport(g.x - Math.cos(g.ang) * 80, g.y - Math.sin(g.ang) * 80);   // behind it, out of its cone
      GAME.knock(); const cd1 = GAME.knockCD; GAME.knock();
      return { st: g.state, hurry: g.hurry, cd: cd1 };
    });
    if (!r) continue;
    n++; if (r.st === 'search') came++; if (r.st === 'search' && !r.hurry) walk++; if (r.cd > 5.9) spent++;
  }
  check(n >= 3 && came === n && walk === n && spent === n, `knock: ${came}/${n} guards behind you come to look (${walk} at a walk), cooldown set ${spent}/${n}`);
}
// a floor played again from the list: its stars only go up, and the climb stays where it was
{
  await page.evaluate(() => { localStorage.clear(); const s = GAME.save; s.runSeed = 77; s.floor = 6; s.best = 6; s.stars = { 1: 1, 2: 3, 3: 0, 4: 2, 5: 1 }; GAME.replayFloor(3); }); await wait(900);
  await page.evaluate(() => GAME.skipIntro()); await wait(100);
  const sameFloor = await page.evaluate(() => { const L = GAME.L; GAME.guards.forEach(g => { g.x = g.home.x = 1e5; g.y = g.home.y = 1e5; g.path = null; g.kind = 'sentry'; }); GAME.cams.length = 0;
    L.stars.slice(0, 2).forEach(s => GAME.teleport(s.x, s.y)); return GAME.floor; });
  for (let i = 0; i < 2; i++) { await page.evaluate((i) => { const s = GAME.L.stars[i]; GAME.teleport(s.x, s.y); }, i); await wait(80); }
  await page.evaluate(() => { const e = GAME.L.exit; GAME.teleport(e.x, e.y); }); await wait(4200);
  const r = await page.evaluate(() => ({ floor: GAME.save.floor, s3: GAME.save.stars[3], mode: GAME.mode, list: document.getElementById('floors').classList.contains('show'), tiles: document.querySelectorAll('#flGrid .flTile').length }));
  check(sameFloor === 3 && r.floor === 6 && r.s3 === 2 && r.list && r.tiles === 5, `replay floor 3: stars 0 -> ${r.s3}, climb still at floor ${r.floor}, back on the list (${r.list}, ${r.tiles} floors)`);
  await page.evaluate(() => document.getElementById('flBack').click());
}
// speed: a silent sneak (stick at 0.6, no ring) outpaces a walker on every floor by 1.2x, and an ambling searcher by a hair,
// so trailing a beat or slipping past one always works. Measured in the game on an open lane, against difficulty() for floors 1-25
{
  await page.evaluate(() => { localStorage.clear(); GAME.save.runSeed = 5; GAME.startFloor(4); GAME.skipIntro(); GAME.stick.on = false; }); await wait(250);
  const r = await page.evaluate(() => new Promise(res => {
    const L = GAME.L, f = L.field;
    GAME.guards.forEach(g => { g.x = g.home.x = 1e5; g.y = g.home.y = 1e5; g.path = null; g.kind = 'sentry'; }); GAME.cams.length = 0;
    // the longest open lane from any room centre
    let best = null;
    for (const rm of L.rooms) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, p = f.nearestFree(rm.c.x, rm.c.y, 14, 40); if (!p) continue;
      const t = f.ray(p.x, p.y, Math.cos(a), Math.sin(a), 300); if (!best || t > best.t) best = { p, a, t }; }
    GAME.teleport(best.p.x, best.p.y); GAME.P.vx = GAME.P.vy = 0;
    Object.assign(GAME.stick, { on: true, x: Math.cos(best.a) * 0.6, y: Math.sin(best.a) * 0.6 });
    let x0 = 0, y0 = 0, t0 = 0, rings = 0;
    setTimeout(() => { x0 = GAME.P.x; y0 = GAME.P.y; t0 = performance.now(); }, 500);
    const iv = setInterval(() => { if (GAME.P.run) rings++; }, 30);
    setTimeout(() => { clearInterval(iv); const v = Math.hypot(GAME.P.x - x0, GAME.P.y - y0) / ((performance.now() - t0) / 1000);
      GAME.stick.on = false; GAME.stick.x = GAME.stick.y = 0; res({ v, run: rings, lane: best.t }); }, 1500);
  }));
  const D = await page.evaluate(() => { const out = []; for (let n = 1; n <= 25; n++) { const d = LEVEL.difficulty(n); out.push({ n, patrol: d.patrol, amble: Math.min(d.patrol * 1.3, 54) }); } return out; });
  const slow = D.filter(d => r.v < d.patrol * 1.2), fastAmble = D.filter(d => d.amble >= r.v);
  check(r.lane > 120 && !r.run && !slow.length && !fastAmble.length, `speed: silent sneak ${r.v.toFixed(1)} vs patrol ${D[0].patrol}-${Math.max(...D.map(d => d.patrol))} (x${(r.v / Math.max(...D.map(d => d.patrol))).toFixed(2)} at worst), amble up to ${Math.max(...D.map(d => d.amble)).toFixed(1)}${slow.length ? ', too slow on ' + slow.map(d => d.n).join(',') : ''}`);
}
// a camera alarm only sends guards with a real way to where it saw you (nearest by that way), never one through a wall or a locked door
{
  let alarms = 0, sent = 0, bad = 0;
  for (const [seed, fl] of [[903, 8], [22, 8], [308, 4], [5, 9], [14, 12], [41, 10], [60, 6], [19, 7], [100, 5], [105, 10], [106, 11], [107, 12]]) {
    await page.evaluate(([s, n]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); GAME.skipIntro(); GAME.stick.on = false; }, [seed, fl]); await wait(200);
    const r = await page.evaluate(() => new Promise(res => {
      const c = GAME.cams[0]; if (!c) return res(null);
      const f = GAME.L.field, p = f.nearestFree(c.x + Math.cos(c.base) * 80, c.y + Math.sin(c.base) * 80, 10, 30); if (!p) return res(null);
      GAME.teleport(p.x, p.y); c.ang = c.base; c.aw = 0.98;
      setTimeout(() => {
        const called = GAME.guards.filter(g => g.state === 'search' && g.hurry);
        res({ alarm: c.alarm > 0, called: called.length, bad: called.filter(g => !GAME.nav.path(g.x, g.y, GAME.P.x, GAME.P.y, 20000)).length });
      }, 250);
    }));
    if (!r || !r.alarm) continue;
    alarms++; sent += r.called; bad += r.bad;
    await page.evaluate(() => { const e = GAME.L.entrance; GAME.teleport(e.x, e.y); });
    if (await page.evaluate(() => GAME.mode) === 'caught') await wait(2600);
  }
  check(alarms >= 4 && bad === 0, `camera alarms: ${alarms} raised, ${sent} guards sent, ${bad} with no way there`);
}
// a thorough guard (floor 6 up) checks a shade: it finds you on its own half of the pool, and walks away from you on the far half
{
  let near = 0, nearN = 0, far = 0, farN = 0;
  for (const [seed, fl] of [[22, 8], [44, 9], [9, 7], [13, 10], [31, 11], [17, 12], [6, 13], [27, 14]]) {
    for (const side of ['near', 'far']) {
      await page.evaluate(([s, n]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); GAME.skipIntro(); GAME.stick.on = false; }, [seed, fl]); await wait(200);
      const ok = await page.evaluate((side) => {
        const L = GAME.L, f = L.field;
        for (const g of GAME.guards) {
          if (!g.path) continue;
          // the pool its peek will pick: the nearest one over its rim's reach, inside 220
          let sh = null, bd = 220;
          for (const s of L.shades) { const d = Math.hypot(s.x - g.x, s.y - g.y); if (d < bd && d > s.r + 30) { bd = d; sh = s; } }
          if (!sh || !GAME.nav.path(g.x, g.y, sh.x, sh.y, 20000)) continue;
          GAME.guards.forEach(o => { if (o !== g) { o.x = o.home.x = 1e5; o.y = o.home.y = 1e5; o.path = null; o.kind = 'sentry'; } }); GAME.cams.length = 0;
          const e = Math.hypot(g.x - sh.x, g.y - sh.y), ux = (g.x - sh.x) / e, uy = (g.y - sh.y) / e, k = side === 'near' ? 0.45 : -0.6;
          GAME.teleport(sh.x + ux * sh.r * k, sh.y + uy * sh.r * k);
          g.peek = true; g.peeked = false; g.state = 'search'; g.scanT = 4.3; g.scanBase = g.ang; g.aw = 0; g.peekSh = null; g.route = []; g.bubble = { k: '?', t: 0, a: 1 };
          window.__g = g; return true;
        }
        return false;
      }, side);
      if (!ok) continue;
      await wait(100);   // a frame for the pool to take you in
      let st = '', peekSh = false, mode = 'play';
      for (let t = 0; t < 140; t++) {
        const r = await page.evaluate(() => [__g.state, !!__g.peekSh, GAME.mode, GAME.P.hidden]);
        st = r[0]; peekSh = peekSh || r[1]; mode = r[2];
        if (!r[3] && mode === 'play') { st = 'not hidden'; break; }
        if (mode === 'caught' || st === 'sus' || st === 'chase' || st === 'patrol') break;
        await wait(100);
      }
      if (!peekSh) continue;
      if (side === 'near') { nearN++; if (st === 'sus' || st === 'chase' || mode === 'caught') near++; }
      else { farN++; if (st === 'patrol' && mode !== 'caught') far++; }
      if (mode === 'caught') await wait(2600);
    }
  }
  check(nearN >= 3 && near === nearN && farN >= 3 && far === farN, `shade peek: found on its half ${near}/${nearN}, missed on the far half ${far}/${farN}`);
}
// fairness at close range: a '?' is a warning, not a sentence. 55 units in front of a post, at the edge of its look,
// a sneak sideways out of the light as soon as the '?' goes up (a 0.15s reaction) gets away; it doesn't end in '!'
{
  let ok = 0, n = 0; const log = [];
  for (const [seed, fl, side] of [[15838, 4, 1], [3, 6, -1], [11, 10, 1], [5, 12, -1], [21, 14, 1], [8, 16, -1], [3, 6, 1], [21, 14, -1], [4, 20, 1], [11, 10, -1], [15838, 4, -1]]) {
    if (n >= 6) break;
    await page.evaluate(([s, f]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(f); GAME.skipIntro(); GAME.stick.on = false; }, [seed, fl]); await wait(300);
    const r = await page.evaluate((side) => new Promise(res => {
      const L = GAME.L, f = L.field, D = L.D, dist = 55;
      for (const g of GAME.guards) {
        if (g.path) continue;
        const a = g.home.ang + side * (D.fov - 0.08), px = g.x + Math.cos(a) * dist, py = g.y + Math.sin(a) * dist;
        const ox = -Math.sin(a) * side, oy = Math.cos(a) * side;   // sideways, away from the middle of its look
        if (f.ray(g.x, g.y, Math.cos(a), Math.sin(a), dist + 5) < dist + 4 || f.ray(px, py, ox, oy, 70) < 60 || f.sample(px, py) < 12) continue;
        GAME.guards.forEach(o => { if (o !== g) { o.x = o.home.x = 1e5; o.y = o.home.y = 1e5; o.path = null; o.kind = 'sentry'; } }); GAME.cams.length = 0;
        g.sweep = 0; g.ang = g.home.ang; g.aw = 0; g.state = 'patrol';
        GAME.teleport(px, py);
        const t0 = performance.now(); let susT = -1, peak = 0;
        const tick = () => {
          const t = (performance.now() - t0) / 1000; peak = Math.max(peak, g.aw);
          if (g.state === 'chase' || GAME.mode === 'caught') return res('chase@' + t.toFixed(2));
          if (susT < 0 && g.state === 'sus') susT = t;
          if (susT >= 0 && g.state !== 'sus') return res('got away (' + g.state + ', meter peaked ' + peak.toFixed(2) + ')');
          GAME.stick.on = susT >= 0 && t - susT >= 0.15 && t - susT < 1.35; GAME.stick.x = GAME.stick.on ? ox * 0.6 : 0; GAME.stick.y = GAME.stick.on ? oy * 0.6 : 0;
          if (t > 5) return res(susT < 0 ? 'unseen' : 'still sus');
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      }
      res(null);
    }), side);
    await page.evaluate(() => { GAME.stick.on = false; GAME.stick.x = GAME.stick.y = 0; });
    log.push(`f${fl} ${r}`);
    if (r && r !== 'unseen') { n++; if (!r.startsWith('chase')) ok++; }
    if (await page.evaluate(() => GAME.mode) === 'caught') await wait(2600);
  }
  check(n === 6 && ok >= 5, `close '?' sidestep: no chase ${ok}/${n} (${log.join('; ')})`);
}
// a sure search (floor 6 up) doesn't end at one corner: lost round a corner, it looks where it last saw you, then
// walks on the way you were heading and looks again. A silent sneak kept on that heading still outpaces it, so the
// searcher reaches its second spot and you're not caught
{
  let ok = 0, n = 0; const log = [];
  for (const [seed, fl] of [[3, 6], [11, 7], [5, 8], [21, 9], [8, 10], [13, 11], [17, 6], [31, 12], [44, 8], [9, 7], [22, 9], [2, 10]]) {
    if (n >= 6) break;
    await page.evaluate(([s, f]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(f); GAME.skipIntro(); GAME.stick.on = false; }, [seed, fl]); await wait(300);
    const r = await page.evaluate(() => new Promise(res => {
      const L = GAME.L, f = L.field, ray = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); return f.ray(a.x, a.y, dx / d, dy / d, d) >= d - 4; };
      // a corner: a spot C the guard can see, and a clear lane on from it (350 long) that it can't see down
      let sc = null;
      for (let k = 0; k < 30000 && !sc; k++) {
        const C = { x: L.entrance.x + (Math.random() - 0.5) * 2400, y: L.entrance.y + (Math.random() - 0.5) * 2400 };
        if (f.sample(C.x, C.y) < 16) continue;
        const a = Math.random() * Math.PI * 2, u = { x: Math.cos(a), y: Math.sin(a) };
        let lane = true; for (let t = 0; t <= 350 && lane; t += 10) { const q = { x: C.x + u.x * t, y: C.y + u.y * t }; lane = f.sample(q.x, q.y) >= 14 && !L.shades.some(s => Math.hypot(q.x - s.x, q.y - s.y) < s.r + 12); }
        if (!lane) continue;
        for (let j = 0; j < 24 && !sc; j++) {
          const b = Math.random() * Math.PI * 2, e = 80 + Math.random() * 50, G = { x: C.x + Math.cos(b) * e, y: C.y + Math.sin(b) * e };
          if (f.sample(G.x, G.y) < 14 || !ray(G, C)) continue;
          const M = { x: (G.x + C.x) / 2, y: (G.y + C.y) / 2 }, N = { x: G.x * 0.25 + C.x * 0.75, y: G.y * 0.25 + C.y * 0.75 }; let hid = true; for (let t = 50; t <= 350 && hid; t += 15) { const q = { x: C.x + u.x * t, y: C.y + u.y * t }; hid = !ray(G, q) && (t < 80 || !ray(M, q)); }
          if (hid) sc = { C, u, G };
        }
      }
      if (!sc) return res(null);
      const { C, u, G } = sc, g = GAME.guards[0];
      GAME.guards.forEach(o => { if (o !== g) { o.x = o.home.x = 1e5; o.y = o.home.y = 1e5; o.path = null; o.kind = 'sentry'; } }); GAME.cams.length = 0;
      g.x = G.x; g.y = G.y; g.ang = Math.atan2(C.y - G.y, C.x - G.x);
      // it saw you at C going along u (a sneak), then lost you round the corner, a couple of seconds back
      g.state = 'sus'; g.aw = 0.5; g.peakAw = 0.9; g.felt = false; g.elbowT = 0; g.repath = 0; g.susAt = { x: C.x, y: C.y };
      g.last = { x: C.x, y: C.y }; g.lastV = { x: u.x * 57, y: u.y * 57 }; g.lost = 1;
      GAME.teleport(C.x + u.x * 130, C.y + u.y * 130);
      const t0 = performance.now(); let leg2 = false, reached = false, tr = [], ls = '';
      const tick = () => {
        const t = (performance.now() - t0) / 1000, P = GAME.P, along = (P.x - C.x) * u.x + (P.y - C.y) * u.y;
        GAME.stick.on = along < 345; GAME.stick.x = GAME.stick.on ? u.x * 0.6 : 0; GAME.stick.y = GAME.stick.on ? u.y * 0.6 : 0;
        const k = g.state + (g.leg2 ? '2' : '') + (g.scanT >= 0 ? 's' : ''); if (k !== ls) { ls = k; tr.push(k + '@' + t.toFixed(1) + ':' + Math.round(along) + '/' + Math.round(Math.hypot(P.x - g.x, P.y - g.y))); }
        if (g.state === 'chase' || GAME.mode === 'caught') return res(tr.join(' ') + ' chase@' + t.toFixed(1) + (leg2 ? ' on leg 2' : ''));
        leg2 = leg2 || g.leg2; if (g.leg2 && g.state === 'search' && g.scanT >= 0) reached = true;
        if (reached) return res('reached the second spot @' + t.toFixed(1) + ' ' + Math.round(Math.hypot(g.x - C.x, g.y - C.y)) + ' on, you ' + Math.round(Math.hypot(P.x - g.x, P.y - g.y)) + ' off');
        if (t > 14) return res(tr.join(' ') + ' no second spot (' + g.state + (leg2 ? ', leg 2' : '') + ')');
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await page.evaluate(() => { GAME.stick.on = false; GAME.stick.x = GAME.stick.y = 0; });
    log.push(`f${fl} ${r}`);
    if (r) { n++; if (r.startsWith('reached')) ok++; }
    if (await page.evaluate(() => GAME.mode) === 'caught') await wait(2600);
  }
  check(n === 6 && ok >= 5, `sure search walks on: second spot reached, not caught ${ok}/${n} (${log.join('; ')})`);
}
check(errors.length === 0, 'no page errors ' + errors.join(' | '));
await browser.close(); srv.close();
console.log(`${el()}done, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
