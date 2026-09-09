// The Maze — a run in progress, restored exactly where you left it
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── run persistence: the maze in progress, restored exactly where you left it ──
// The maze itself is rebuilt from its seed; everything that changed during the run is stored here.
function serializeRun() {
  if (!started || solved || !player) return null;
  return {
    seed: SEED, phase: SAVE.phase || 0, stones: SAVE.stones || 0, pool: poolMode, size: SAVE.ui.size || 'auto', branch: SAVE.ui.branch || 'auto', braid: SAVE.ui.braid || 'auto', v: VERSION,
    px: player.x, py: player.y, facing, t: gameNow() - t0, steps, deadEndsEntered, leftRoom, pagesThisRun,
    marks: [...marks.entries()], mapped: [...mapped.entries()], visited: [...visited],
    chalk, chalkUsed, chalkFound, charcoal, charcoalLeft, charcoalOn, charcoalUsed, charcoalFound,
    hasKey, keySpot, hasLamp, lampOn, lampSpot, gated, doorOpen: !!(poolDoor && poolDoor.openAt),
    chalkSpots: [...chalkSpots], charcoalSpots: [...charcoalSpots], scrapSpots: [...scrapSpots], pickups: [...pickups.entries()], journals: [...journals.entries()],
    pointerLeft: Math.max(0, pointerUntil - gameNow()), pathLeft: Math.max(0, pathUntil - gameNow()), pointerUses, pathUses, journalsRead,
    sliders: sliders.map(sl => sl.shifted), figures: figures.map(f => f.gone), doorsOpen: doors.map(d => d.open), innerKeys: [...innerKeys.entries()], heldKeys: [...heldKeys],
    hopIdx, hopSaid, tttSaid, crawlSaid, narrQueue, narrLeft: Math.max(0, narrNext - gameNow()), wakeDone: true,
  };
}
let lastRunSave = 0;
function saveRun(force) {
  const now = performance.now(); if (!force && now - lastRunSave < 2500) return; lastRunSave = now;
  const run = serializeRun(); if (run) { SAVE.run = run; persist(); }
}
function clearRun() { if (SAVE.run) { delete SAVE.run; persist(); } }
function restoreRun(run) {
  reset(run.seed);   // same seed, same phase and stones → same maze
  player.x = run.px; player.y = run.py; cam.x = run.px; cam.y = run.py; facing = facingShown = run.facing;
  steps = run.steps; deadEndsEntered = run.deadEndsEntered; leftRoom = run.leftRoom; pagesThisRun = run.pagesThisRun || [];
  marks = new Map(run.marks); mapped = new Map(run.mapped); visited = new Set(run.visited);
  chalk = run.chalk; chalkUsed = run.chalkUsed; chalkFound = run.chalkFound; charcoal = run.charcoal; charcoalLeft = run.charcoalLeft; charcoalOn = run.charcoalOn; charcoalUsed = run.charcoalUsed; charcoalFound = run.charcoalFound;
  hasKey = run.hasKey; keySpot = run.keySpot; hasLamp = run.hasLamp; lampOn = run.lampOn; lampSpot = run.lampSpot; gated = run.gated;
  if (poolDoor && run.doorOpen) poolDoor.openAt = 1;
  chalkSpots = new Set(run.chalkSpots); charcoalSpots = new Set(run.charcoalSpots); scrapSpots = new Set(run.scrapSpots); pickups = new Map(run.pickups); journals = new Map(run.journals);
  pointerUses = run.pointerUses; pathUses = run.pathUses; journalsRead = run.journalsRead;
  run.sliders.forEach((sh, i) => { const sl = sliders[i]; if (!sl || sl.shifted === sh) return; const fx = sl.x, fy = sl.y, tx = sl.x + sl.dx, ty = sl.y + sl.dy; tiles[fy][fx] = sh ? 0 : 1; tiles[ty][tx] = sh ? 1 : 0; sl.shifted = sh; });
  run.figures.forEach((g, i) => { if (figures[i] && g) { figures[i].gone = true; figures[i].alpha = 0; } });
  (run.doorsOpen || []).forEach((o, i) => { if (doors[i]) doors[i].open = o; }); if (run.innerKeys) innerKeys = new Map(run.innerKeys); heldKeys = new Set(run.heldKeys || []); renderKeys();
  hopIdx = run.hopIdx; hopSaid = run.hopSaid; tttSaid = run.tttSaid; crawlSaid = run.crawlSaid; narrQueue = run.narrQueue || narrQueue;
  lastTileKey = Math.floor(player.x) + ',' + Math.floor(player.y);
  updateChalk(); updateCharcoal();
  if (hasKey) (poolMode ? $('stone') : keyEl).classList.add('show'); if (hasLamp) { $('lamp').classList.add('show'); $('lamp').classList.toggle('on', lampOn); }
  // straight into the maze, no title: the fade lifts on you where you stood
  document.body.classList.remove('pre'); $('title').classList.add('hide'); zoomS = CONFIG.tilePx; started = true;
  const g0 = gameNow(); t0 = g0 - run.t; pointerUntil = run.pointerLeft ? g0 + run.pointerLeft : 0; pathUntil = run.pathLeft ? g0 + run.pathLeft : 0; narrNext = leftRoom ? g0 + Math.max(4000, run.narrLeft) : Infinity;
  $('stepLbl').textContent = steps + ' tiles';
  setTimeout(() => narrate(poolMode ? "…the water. I was going to the water." : "…where was I."), 2200);
}

