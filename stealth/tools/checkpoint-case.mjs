// the checkpoint-respawn fairness case for ai-check: respawn at every door's checkpoint and stand still;
// nobody may so much as wonder for 4s. Runs one page per seed, in parallel.
export async function cpRespawns(browser, url, seeds, floors) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const one = async (seed) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(url); await page.waitForFunction(() => window.GAME && GAME.L);
    const out = [];
    for (const fl of floors) {
      await page.evaluate(([s, n]) => { localStorage.clear(); GAME.save.runSeed = s; GAME.startFloor(n); GAME.skipIntro(); }, [seed, fl]);
      const nd = await page.evaluate(() => GAME.L.doors.length);
      for (let i = 0; i < nd; i++) {
        // carry its key to its door, from the side the floor's start is on
        const ok = await page.evaluate((i) => {
          const L = GAME.L, d = L.doors[i], k = L.keys.find(k => k.door === d); if (!k) return false;
          if (!k.got) { k.got = true; GAME.P.keys.push(k); }
          const c = d.conn, from = c.a.idx <= c.b.idx ? c.a : c.b, n = c.dirFrom(from), m = c.mouth;
          GAME.guards.forEach(g => { g.state = 'patrol'; g.aw = 0; });
          GAME.P.alive = true; GAME.teleport(m.x - n.x * 22, m.y - n.y * 22); return true;
        }, i);
        if (!ok) continue;
        for (let t = 0; t < 20 && !(await page.evaluate((i) => GAME.L.doors[i].open, i)); t++) await wait(30);
        const cp = await page.evaluate(() => GAME.checkpoint && { x: GAME.checkpoint.x, y: GAME.checkpoint.y });
        if (!cp) { out.push({ seed, fl, i, bad: 'no checkpoint' }); continue; }
        await page.evaluate((n) => { GAME.startFloor(n, true); GAME.skipIntro(); GAME.stick.on = false; }, fl);
        let bad = null;
        for (let t = 0; t < 200 && !bad; t++) {
          const r = await page.evaluate(() => ({ T: GAME.modeT, mode: GAME.mode, g: GAME.guards.map(g => g.state), c: GAME.cams.map(c => c.aw) }));
          if (r.mode !== 'play') bad = r.mode + ' at ' + r.T.toFixed(2);
          else if (r.g.some(s => s === 'sus' || s === 'chase')) bad = 'guard ' + r.g.find(s => s === 'sus' || s === 'chase') + ' at ' + r.T.toFixed(2) + ' ' + (await page.evaluate(() => { const g = GAME.guards.find(g => g.state === 'sus' || g.state === 'chase'); return g.kind + ' d' + Math.hypot(g.x - GAME.P.x, g.y - GAME.P.y).toFixed(0); }));
          else if (r.c.some(a => a > 0)) bad = 'camera at ' + r.T.toFixed(2);
          if (r.T >= 4) break;
          await wait(40);
        }
        out.push({ seed, fl, i, bad });
        if (bad) { await page.evaluate(() => { GAME.P.alive = true; }); }
      }
    }
    await page.close();
    return out;
  };
  return (await Promise.all(seeds.map(one))).flat();
}
