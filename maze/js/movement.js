// The Maze — the Pac-Man glide, turns, sliders, pickups. Do not reintroduce snapping
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── movement ────────────────────────────────────────────────────
// the exit tile counts as a wall until you hold the key
const doorAt = (x, y) => doors.find(d => d.x === x && d.y === y && !d.open);
const passable = (x, y) => isOpen(x, y) && !(gated && !hasKey && x === exit.x && y === exit.y) && !(poolDoor && !hasKey && x === poolDoor.x && y === poolDoor.y) && !(doorAt(x, y) && !heldKeys.has(doorAt(x, y).shape));
function canGo(d) { return passable(Math.floor(player.x) + d.dx, Math.floor(player.y) + d.dy); }
function offCenter(d) { const cx = Math.floor(player.x) + 0.5, cy = Math.floor(player.y) + 0.5; return d.dx ? Math.abs(player.y - cy) : Math.abs(player.x - cx); }
let recenter = null;   // after a turn, the perpendicular offset is eased out instead of snapped
function snapPerp(d) { recenter = d.dx ? 'y' : 'x'; }

function narrate(text) { AUDIO.narrator(); narrEl.className = 'show'; narrEl.textContent = text; narrHideAt = gameNow() + (CONFIG.narratorHoldSec + text.length / 40) * 1000; }
function showJournal(pg) {
  const text = character.pages[pg];
  const arr = SAVE.collected[character.name] || (SAVE.collected[character.name] = []); arr[pg] = true; persist();
  pagesThisRun.push(pg);
  AUDIO.journal(); narrEl.className = 'show journal'; narrEl.textContent = text;
  const who = document.createElement('small'); who.textContent = character.name; narrEl.appendChild(who);
  narrHideAt = gameNow() + (CONFIG.journalHoldSec + text.length / 30) * 1000;
  narrNext = Math.max(narrNext, narrHideAt + 20000);   // give the narrator a breather after a page
}

let last = performance.now();
function update(wall) {
  const dt = Math.min(0.05, (wall - last) / 1000); last = wall;
  const now = gameNow();
  const kd = (keys.ArrowLeft||keys.a) ? {dx:-1,dy:0} : (keys.ArrowRight||keys.d) ? {dx:1,dy:0}
           : (keys.ArrowUp||keys.w) ? {dx:0,dy:-1} : (keys.ArrowDown||keys.s) ? {dx:0,dy:1} : null;
  if (intro) { const k = Math.min(1, (performance.now() - intro.t0) / (CONFIG.introSeconds * 1000)); const e = 1 - Math.pow(1 - k, 3); zoomS = intro.from + (CONFIG.tilePx - intro.from) * e; if (k >= 1) intro = null; }
  else zoomS = started ? CONFIG.tilePx : CONFIG.titleTilePx;
  const want = (solved || !started || mapOpen || paused) ? null : (introWalk || held || kd);

  // swings move on their own; you ride if you're standing on one
  if (!sliding && started && !paused) for (const sl of sliders) {
    if (!sl.auto) continue;
    if (!sl.nextAt) sl.nextAt = now + CONFIG.swingSeconds * 1000 * (0.5 + Math.random());
    if (now < sl.nextAt) continue;
    const cx = sl.shifted ? sl.x + sl.dx : sl.x, cy = sl.shifted ? sl.y + sl.dy : sl.y;
    const d = sl.shifted ? { dx: -sl.dx, dy: -sl.dy } : { dx: sl.dx, dy: sl.dy }, to = [cx + d.dx, cy + d.dy];
    const carry = Math.floor(player.x) === cx && Math.floor(player.y) === cy;
    if (!carry && Math.floor(player.x) === to[0] && Math.floor(player.y) === to[1]) { sl.nextAt = now + 800; continue; }   // never slide into you
    tiles[cy][cx] = 0; tiles[to[1]][to[0]] = 0;
    sliding = { sl, from: [cx, cy], to, t0: now, carry, dur: CONFIG.sliderSeconds * 500 }; if (carry) { dir = null; clearStick(); }
    AUDIO.swing(); sl.nextAt = now + CONFIG.sliderSeconds * 500 + CONFIG.swingSeconds * 1000;
    break;
  }
  if (sliding) {
    const k = Math.min(1, (now - sliding.t0) / sliding.dur);
    const e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2;
    if (sliding.carry !== false) { player.x = sliding.from[0] + 0.5 + (sliding.to[0] - sliding.from[0]) * e; player.y = sliding.from[1] + 0.5 + (sliding.to[1] - sliding.from[1]) * e; }
    if (k >= 1) {
      const [tx, ty] = sliding.to; tiles[ty][tx] = 1; sliding.sl.shifted = !sliding.sl.shifted;
      const fromKey = sliding.from.join(','), toKey = sliding.to.join(',');
      if (marks.has(fromKey)) { const g = marks.get(fromKey); marks.delete(fromKey); marks.set(toKey, g); }
      if (sliding.carry !== false) lastTileKey = toKey; const wasAuto = sliding.sl.auto; sliding = null; if (!wasAuto) AUDIO.slideEnd();
    }
  }
  if (want && !(sliding && sliding.carry !== false)) {
    if (!dir) {
      const cx = Math.floor(player.x), cy = Math.floor(player.y);
      const sl = sliders.find(s => !s.auto && (s.shifted ? s.x + s.dx : s.x) === cx && (s.shifted ? s.y + s.dy : s.y) === cy);
      const pushDir = sl && (sl.shifted ? { dx: -sl.dx, dy: -sl.dy } : { dx: sl.dx, dy: sl.dy });
      if (sl && want.dx === pushDir.dx && want.dy === pushDir.dy && !canGo(want)) {
        if (!pushHeldSince) pushHeldSince = now;
        if (now - pushHeldSince < CONFIG.pushHoldMs) { /* leaning… */ }
        else {
        const to = [cx + want.dx, cy + want.dy];
        tiles[cy][cx] = 0; tiles[to[1]][to[0]] = 0;
        sliding = { sl, from: [cx, cy], to, t0: now, dur: CONFIG.sliderSeconds * 1000 }; facing = Math.atan2(want.dy, want.dx); AUDIO.slideStart(); if (sl.atStart) firstPushDone = true; pushHeldSince = 0; recenter = null;
        }
      }
      else if (canGo(want)) dir = want;
      else if (doorAt(Math.floor(player.x) + want.dx, Math.floor(player.y) + want.dy)) { const d = doorAt(Math.floor(player.x) + want.dx, Math.floor(player.y) + want.dy); if (now > narrHideAt) { narrate(`Locked. The lock is a ${d.shape}.`); AUDIO.locked(); } }
      else if (poolDoor && !hasKey && Math.floor(player.x) + want.dx === poolDoor.x && Math.floor(player.y) + want.dy === poolDoor.y) { if (now > narrHideAt) { narrate("It won't move. Not without a stone."); AUDIO.locked(); } }
      else if (gated && !hasKey && isOpen(Math.floor(player.x)+want.dx, Math.floor(player.y)+want.dy) && now > narrHideAt) { narrate("Locked. It wants a key."); AUDIO.locked(); } }
    else if ((want.dx !== 0) === (dir.dx !== 0)) dir = want;
    else if (canGo(want) && offCenter(want) <= CONFIG.turnForgiveness) { snapPerp(want); dir = want; }
  }
  if (dir) facing = Math.atan2(dir.dy, dir.dx);
  { let d = facing - facingShown; d = Math.atan2(Math.sin(d), Math.cos(d)); facingShown += d * Math.min(1, dt * 18); }
  // the axis you're not travelling along always eases to the corridor's centerline (rounded corners, no pop)
  { const ax = dir ? (dir.dx ? 'y' : 'x') : recenter;
    if (ax) { const c = Math.floor(player[ax]) + 0.5, diff = c - player[ax]; if (Math.abs(diff) < 0.004) { player[ax] = c; if (!dir) recenter = null; } else { const mv = Math.min(Math.abs(diff), Math.max(0.02, B.speed() * 1.6 * dt)); player[ax] += Math.sign(diff) * mv; } } }
  { const sqz = started && phase().f.crawl && [...crawlGaps, ...crawlCells].some(k => { const [gx, gy] = k.split(',').map(Number); return Math.abs(player.x - gx - 0.5) + Math.abs(player.y - gy - 0.5) < CONFIG.squeezeReach; });
    if (sqz !== inSqueeze) { inSqueeze = sqz; camBump = sqz ? -0.18 : 0.18; AUDIO.squeeze(sqz); } }
  if (dir) {
    const step = B.speed() * (inSqueeze ? CONFIG.squeezeSlow : introWalk ? 0.35 : 1) * dt;
    const cx = Math.floor(player.x) + 0.5, cy = Math.floor(player.y) + 0.5;
    const axis = dir.dx ? 'x' : 'y', sgn = dir.dx || dir.dy, c = axis === 'x' ? cx : cy;
    const p = player[axis], n = p + sgn * step;
    const blocked = !passable(Math.floor(cx) + dir.dx, Math.floor(cy) + dir.dy);
    const crossesCenter = (p - c) * sgn <= 0 && (n - c) * sgn >= 0;
    // stopping only settles the axis you were travelling on; the other keeps easing in, so no pop
    if (crossesCenter && (blocked || !want)) { player[axis] = c; recenter = axis === 'x' ? 'y' : 'x'; dir = null; if (blocked && want) AUDIO.bump(); }
    else if (blocked && (p - c) * sgn >= 0) { player[axis] = c; recenter = axis === 'x' ? 'y' : 'x'; dir = null; }
    else player[axis] = n;
  }

  const prevKey = lastTileKey;
  if (!want || dir) pushHeldSince = 0;
  if (dir || sliding || want) idleSince = now;
  // standing on a shelf for a second brings up whose it is
  if (startRoom && !dir && !sliding) {
    const cx = Math.floor(player.x), cy = Math.floor(player.y), { x0, y0, y1 } = startRoom;
    const spots = SHELF_SPOTS(x0, y0, y1).map(([x,y]) => [x,y]);
    const idx = spots.findIndex(([x,y]) => x===cx && y===cy);
    const onBasin = cx === startRoom.x0 + 3 && cy === startRoom.y0 + 3;
    const k = idx >= 0 ? idx + '' : onBasin ? 'basin' : '';
    if (k !== shelfStandKey) { shelfStandKey = k; shelfStandAt = now; }
    else if (k && k !== 'basin' && now - shelfStandAt > 1000 && shelfShown !== k) { shelfShown = k;
      const c = CAST.filter(c => c.pages.length)[idx];
      if (c && !collectedCount(c.name)) narrate(EMPTY_SHELF[Math.random() * EMPTY_SHELF.length | 0]);
      else if (c) { const L = (ROOM_LINES[character.name] || ROOM_LINES['You']).shelf, t = collectedCount(character.name) / Math.max(1, character.pages.length); narrate(L[t >= 0.8 ? 2 : t >= 0.4 ? 1 : 0]); } }
    // the basin: first visit after putting a stone down says so; otherwise the self speaks of the stones
    if (onBasin && now - shelfStandAt > 700 && shelfShown !== 'basin') { shelfShown = 'basin';
      if ((SAVE.basinSeen || 0) < (SAVE.stones || 0)) { SAVE.basinSeen = SAVE.stones; persist(); narrate(LIGHTER[Math.min(LIGHTER.length - 1, (SAVE.stones || 0) - 1)]); }
      else if (poolMode) narrate("One stone. I'll carry it as far as the water.");
      else { const L = (ROOM_LINES[character.name] || ROOM_LINES['You']).basin, t = collectedCount(character.name) / Math.max(1, character.pages.length); narrate(L[t >= 0.8 ? 2 : t >= 0.4 ? 1 : 0]); } }
  } else shelfStandKey = '';
  const key = Math.floor(player.x) + ',' + Math.floor(player.y);
  visited.add(key);
  if (introWalk && key !== lastTileKey) introWalk = null;
  if (key !== lastTileKey) { if (lastTileKey) { steps++; AUDIO.step(tunnelTiles.has(key)); } lastTileKey = key; saveRun(false); $('stepLbl').textContent = steps + ' tiles'; }
  if (key !== prevKey) {
    const [tx, ty] = key.split(',').map(Number);
    if (startRoom) {
      const inRoom = tx >= startRoom.x0 && tx <= startRoom.x1 && ty >= startRoom.y0 && ty <= startRoom.y1;
      if (!inRoom && !leftRoom) { leftRoom = true; narrNext = poolMode ? now + 1200 : now + CONFIG.narratorFirstSec * 1000; if (poolMode) narrQueue = POOLS[Math.min(SAVE.stones || 0, POOLS.length - 1)].approach.slice(); if (!(SAVE.wakeSaid || []).includes(character.name) && character.wake && !poolMode) { if (character.leave) { narrate(character.leave); narrNext = now + CONFIG.narratorEverySec * 1000; } else narrQueue.unshift(character.wake); (SAVE.wakeSaid = SAVE.wakeSaid || []).push(character.name); persist(); } }
      // stepping up to the shelves, once per maze
      const shelfSpots = SHELF_SPOTS(startRoom.x0, startRoom.y0, startRoom.y1);
      if (false && !shelfSaid && inRoom && CAST.some(c => collectedCount(c.name)) && shelfSpots.some(([x,y]) => x===tx && y===ty)) {
        shelfSaid = true;
        let fresh = SHELF_LINES.filter(l => !SAVE.shelfPlayed.includes(l)); if (!fresh.length) { SAVE.shelfPlayed = []; fresh = SHELF_LINES.slice(); }
        const line = fresh[Math.random() * fresh.length | 0]; SAVE.shelfPlayed.push(line); persist(); narrate(line);
      }
    }
    if (ticTacToe && !tttSaid && tx === ticTacToe.x && ty === ticTacToe.y) { tttSaid = true; narrate(character.name === 'The Child' ? "its my turn. he never took his." : "Someone left a game half-played."); }
    if (!phase().f.crawl && !crawlSaid && DIRS.some(([dx,dy]) => crawlGaps.has((tx+dx)+','+(ty+dy)))) { crawlSaid = true; narrate("I used to fit through here."); }
    // hopscotch: in order, one square at a time
    if (hopscotch.length && !hopSaid) {
      const hi = hopscotch.indexOf(key);
      if (hi === hopIdx) { hopIdx++; AUDIO.hop(hopIdx); if (hopIdx === hopscotch.length) { hopSaid = true; narrate(character.name === 'The Child' ? "…ready or not." : "I remember this game."); } }
      else if (hi === -1 && hopIdx > 0 && !hopscotch.includes(prevKey)) hopIdx = 0;
      else if (hi >= 0 && hi !== hopIdx && hi !== hopIdx - 1) hopIdx = hi === 0 ? 1 : 0;
    }
    if (charcoalOn && charcoalLeft > 0) { const added = mapHere(); if (added) { charcoalLeft = Math.max(0, charcoalLeft - added); updateCharcoal(); if (charcoalLeft === 0) { charcoalOn = false; AUDIO.charcoalEnd(); } } }
    if (charcoalSpots.has(key)) { charcoalSpots.delete(key); charcoal++; charcoalFound++; updateCharcoal(); pulse(charcoalEl); AUDIO.pickupChalk(); tutorial('charcoal'); }
    if (DIRS.filter(([dx,dy]) => isOpen(tx+dx, ty+dy)).length === 1 && key !== exit.x+','+exit.y) deadEndsEntered++;
    if (chalkSpots.has(key)) { chalkSpots.delete(key); chalk += CONFIG.chalkPerPickup; chalkFound++; updateChalk(); pulse(chalkEl); AUDIO.pickupChalk(); tutorial('chalk'); }
    if (pickups.has(key)) {
      const kind = pickups.get(key); pickups.delete(key);
      if (kind === 'pointer') { pointerUntil = now + B.pointerSec() * 1000; pointerUses++; }
      else { pathUntil = now + B.pathSec() * 1000; pathUses++; }
      AUDIO.pickup(); pulse(fxEl); tutorial(kind);
    }
    if (scrapSpots.has(key)) { scrapSpots.delete(key); revealAround(tx, ty); pulse($('mapBtn')); AUDIO.pickup(); tutorial('scrap'); }
    if (lampSpot === key) { lampSpot = null; hasLamp = true; lampOn = true; $('lamp').classList.add('show', 'on'); pulse($('lamp')); AUDIO.lampOn(); tutorial('lamp'); }
    { const d = doors.find(d => d.x === tx && d.y === ty && !d.open); if (d) { d.open = true; AUDIO.gate(); saveRun(true); } }
    if (innerKeys.has(key)) { const shape = innerKeys.get(key); innerKeys.delete(key); heldKeys.add(shape); renderKeys(); AUDIO.key(); narrate(`A key. Its head is a ${shape}.`); tutorial('door'); saveRun(true); }
    if (keySpot === key) { keySpot = null; hasKey = true; if (poolMode) { $('stone').classList.add('show'); pulse($('stone')); AUDIO.stone(); if (poolDoor) { poolDoor.openAt = now; AUDIO.doorSlide(); } } else { keyEl.classList.add('show'); pulse(keyEl); AUDIO.key(); tutorial('key'); } }
    if (journals.has(key) && character) { const pg = journals.get(key); journals.delete(key); journalsRead++; showJournal(pg);
      if (collectedCount(character.name) >= character.pages.length && (SAVE.phase || 0) < PHASES.length - 1 && !SAVE.poolPending) { SAVE.poolPending = true; persist(); } }
  }

  const fx = [];
  if (pointerUntil > now) fx.push(`<span class="ptr">pointer ${Math.ceil((pointerUntil-now)/1000)}s</span>`);
  const fxHtml = fx.join(''); if (fxEl.innerHTML !== fxHtml) fxEl.innerHTML = fxHtml;

  // narrator
  if (started && !solved) {
    if (now >= narrNext) {
      if (!narrQueue.length && !poolMode) { const mine = SELF_LINES[character.name] || SELF_LINES['You']; SAVE.narrPlayed = SAVE.narrPlayed.filter(l => !mine.includes(l)); narrQueue = mine.slice().sort(() => Math.random() - 0.5); }
      if (!narrQueue.length) narrNext = Infinity;
      else { const line = narrQueue.shift(); if (!poolMode) { SAVE.narrPlayed.push(line); persist(); } narrate(line); narrNext = now + (poolMode ? 7000 : CONFIG.narratorEverySec * 1000); }
    }
    if (narrHideAt && now > narrHideAt) { narrEl.classList.remove('show'); narrHideAt = 0; }
  }

  { const k = Math.floor(player.x) + ',' + Math.floor(player.y);
    const target = darkTiles.has(k) ? 1 : darkFringe.get(k) === 2 ? 0.72 * B.fringe() : darkFringe.get(k) === 1 ? 0.42 * B.fringe() : 0;
    darkAmt += (target - darkAmt) * Math.min(1, dt * 3.2); }
  if (started && !poolMode && figures.length) updateFigures(now, dt);
  camBump *= Math.pow(0.02, dt);   // the bump settles fast
  cam.x += (player.x - cam.x) * (1 - Math.pow(CONFIG.cameraLag, dt * 10));
  cam.y += (player.y - cam.y) * (1 - Math.pow(CONFIG.cameraLag, dt * 10));
  if (!solved && started && (player.x|0) === exit.x && (player.y|0) === exit.y) {
    solved = true; clearRun(); clearStick(); dir = null; narrEl.classList.remove('show'); if (gated) { AUDIO.gate(); setTimeout(() => AUDIO.exit(), 350); } else AUDIO.exit();
    const secs = ((gameNow() - t0) / 1000).toFixed(1);
    const optimal = solutionPath.length - 1, ratio = (steps / optimal).toFixed(2);
    const rows = [
      ['Tiles walked', steps], ['Shortest route', optimal + ' tiles'], ['Wandering', ratio + '× the shortest route'],
      ['Time', secs + 's'], ['Dead ends entered', deadEndsEntered],
      ['Chalk used', chalkUsed], ['Chalk found', chalkFound],
      ['Charcoal used', charcoalUsed], ['Charcoal found', charcoalFound], ['Tiles mapped', [...mapped.values()].filter(v => v !== 'wall').length],
      ['Pointers used', pointerUses], ['Paths used', pathUses], ['Pages found', journalsRead + ' of ' + (journalsRead + journals.size)],
    ];
    if (poolMode) { setTimeout(startPool, 900); return; }
    if (phase().who === 'You' && !SAVE.finished) { $('msgStats').innerHTML = `<li><span>You walked out into the color.</span></li>`; $('msgSeed').textContent = ''; $('again').textContent = 'Begin again'; SAVE.finished = true; persist(); $('msg').classList.add('show'); return; }
    const total = character ? character.pages.length : 0, held = character ? collectedCount(character.name) : 0;
    const pagesHtml = pagesThisRun.length
      ? pagesThisRun.map(pg => `<p class="page">${character.pages[pg]}</p>`).join('')
      : `<p class="page none">I found nothing of theirs this time. Their pages are still out there.</p>`;
    const whose = character ? `<div class="whose">${character.name} · ${held} of ${total} pages</div>` : '';
    $('msgStats').innerHTML = `<li class="pages">${whose}${pagesHtml}</li><li class="stat">${steps} tiles · ${secs}s · ${ratio}× the shortest way</li>`;
    $('msgSeed').textContent = 'seed ' + SEED;
    $('msg').classList.add('show');
  }
}

