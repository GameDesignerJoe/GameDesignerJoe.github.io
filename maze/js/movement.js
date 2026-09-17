// The Maze — the Pac-Man glide, turns, sliders, pickups. Do not reintroduce snapping
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── movement ────────────────────────────────────────────────────
// the exit tile counts as a wall until you hold the key
// Where a block is now, and which way it can be shoved from there. A plain slider has one home
// and one place to go. A prototype block has `ways`: from home it can take any of them, and from
// wherever it has gone it can only come back — three places in all, in a line or round an elbow.
const blockAt = (s) => s.ways
  ? (s.at ? [s.x + s.ways[s.at - 1][0], s.y + s.ways[s.at - 1][1]] : [s.x, s.y])
  : [s.shifted ? s.x + s.dx : s.x, s.shifted ? s.y + s.dy : s.y];
const blockWays = (s) => s.ways
  ? (s.at ? [[-s.ways[s.at - 1][0], -s.ways[s.at - 1][1]]] : s.ways)
  : [[s.shifted ? -s.dx : s.dx, s.shifted ? -s.dy : s.dy]];
const doorAt = (x, y) => doors.find(d => d.x === x && d.y === y && !d.open);
// the shortest walk from a tile to the nearest page still lying in the maze, as a list of tiles;
// empty when there is none left. Walks what is open now, doors included — a thread is a hint, not a promise
function pathToNearestPage(x0, y0) {
  if (!journals.size) return [];
  const prev = new Map([[x0 + ',' + y0, null]]); const q = [[x0, y0]];
  for (let h = 0; h < q.length; h++) { const [x, y] = q[h]; const k = x + ',' + y;
    if (journals.has(k)) { const path = []; let cur = k; while (cur) { path.push(cur.split(',').map(Number)); cur = prev.get(cur); } return path.reverse(); }
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, kk = nx + ',' + ny; if (isOpen(nx, ny) && !prev.has(kk)) { prev.set(kk, k); q.push([nx, ny]); } } }
  return [];
}
// The pool room's gate: shut until it has been shoved with the stone and has finished grinding.
// A restored run stores openAt as 1, which is long enough ago to count as open.
// Shut until the leaves have swung far enough to get past, not until the slide has finished: they
// are most of the way open well before that, and standing at an open door that will not let you
// through is the complaint this answers.
const poolDoorShut = () => {
  if (!poolDoor) return false;
  if (!poolDoor.openAt) return true;
  const open = Math.min(1, (gameNow() - poolDoor.openAt) / (CONFIG.poolDoorSeconds * 1000));
  return gateEase(open) < CONFIG.poolDoorPassAt;
};
const passable = (x, y) => isOpen(x, y) && !(gated && !hasKey && x === exit.x && y === exit.y) && !(poolDoorShut() && x === poolDoor.x && y === poolDoor.y) && !(doorAt(x, y) && !heldKeys.has(doorAt(x, y).shape));
function canGo(d) { return passable(Math.floor(player.x) + d.dx, Math.floor(player.y) + d.dy); }
function offCenter(d) { const cx = Math.floor(player.x) + 0.5, cy = Math.floor(player.y) + 0.5; return d.dx ? Math.abs(player.y - cy) : Math.abs(player.x - cx); }
let recenter = null;   // after a turn, the perpendicular offset is eased out instead of snapped
let moveVel = 0;       // tiles a second he is actually going, eased toward what the stick asks for
let squeezeAxis = null;// which way the squeeze he is in holds him, 'x' or 'y'
// the auto swings, the one waiting longest first. Cached on the array so a maze's worth of swings is
// sorted once rather than every frame
function autoSliders(list) {
  if (list._autos !== undefined && list._autoLen === list.length) { list._autos.sort((a, b) => (a.nextAt || 0) - (b.nextAt || 0)); return list._autos; }
  list._autos = list.filter((s) => s.auto); list._autoLen = list.length;
  return list._autos;
}
function snapPerp(d) { recenter = d.dx ? 'y' : 'x'; }
// Somewhere with actual room in it: a tile in any 2x2 block of floor. A corridor is one tile wide,
// so this is only ever true in a room, a court, or an open landmark floor.
function openFloor(x, y) {
  for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]])
    if (isOpen(x + ox, y + oy) && isOpen(x + ox + 1, y + oy) && isOpen(x + ox, y + oy + 1) && isOpen(x + ox + 1, y + oy + 1)) return true;
  return false;
}

function narrate(text) { AUDIO.narrator(); narrEl.className = 'show'; narrEl.textContent = text; tagId(narrEl, text); narrHideAt = gameNow() + (CONFIG.narratorHoldSec + text.length / 40) * 1000; }
function showJournal(pg) {
  const text = character.pages[pg];
  const arr = SAVE.collected[character.name] || (SAVE.collected[character.name] = []); arr[pg] = true; persist();
  pagesThisRun.push(pg);
  AUDIO.journal(); narrEl.className = 'show journal'; narrEl.textContent = text;
  const who = document.createElement('small'); who.textContent = character.name; narrEl.appendChild(who); tagId(narrEl, text);
  narrHideAt = gameNow() + (CONFIG.journalHoldSec + text.length / 30) * 1000;
  narrNext = Math.max(narrNext, narrHideAt + 20000);   // give the narrator a breather after a page
}

let last = performance.now();
function update(wall) {
  const dt = Math.min(0.05, (wall - last) / 1000); last = wall;
  const now = gameNow();
  const kd = (keys.ArrowLeft||keys.a) ? {dx:-1,dy:0} : (keys.ArrowRight||keys.d) ? {dx:1,dy:0}
           : (keys.ArrowUp||keys.w) ? {dx:0,dy:-1} : (keys.ArrowDown||keys.s) ? {dx:0,dy:1} : null;
  if (intro && intro.lift) {
    // two beats. First he lets go of one of them, and nothing else moves. Then the dark is cut
    // back to the size it is now, fast, and the camera goes with it.
    const t = (performance.now() - intro.t0) / 1000;
    if (t < CONFIG.liftBandSec) { liftBandAmt = Math.min(1, t / CONFIG.liftBandSec); zoomS = intro.from; liftGlow = CONFIG.liftGlowFrom; }
    else {
      liftBandAmt = 1;
      const k = Math.min(1, (t - CONFIG.liftBandSec) / CONFIG.liftBurstSec), e = 1 - Math.pow(1 - k, 4);
      zoomS = intro.from + (CONFIG.tilePx * zoomMul() - intro.from) * e;
      liftGlow = CONFIG.liftGlowFrom + (1 - CONFIG.liftGlowFrom) * e;
      if (k >= 1) { intro = null; liftGlow = 1; liftBand = -1; }
    }
  }
  else if (intro) { const k = Math.min(1, (performance.now() - intro.t0) / (CONFIG.introSeconds * 1000)); const e = 1 - Math.pow(1 - k, 3);
    zoomS = intro.from + (CONFIG.tilePx * zoomMul() - intro.from) * e;
    if (k >= 1) intro = null; }
  else zoomS = started ? CONFIG.tilePx * zoomMul() : CONFIG.titleTilePx;
  // The scripted first step off the mat. If there is nothing to step into, it has to give up:
  // `want` prefers it over anything you do, and it only clears when you change tile — which you
  // cannot do — so the stick stays dead for the rest of the run. A prototype that starts you on
  // an island with no bridges did exactly that.
  if (introWalk && !sliding && !canGo(introWalk)) introWalk = null;
  const want = (solved || !started || mapOpen || paused) ? null : (introWalk || held || kd);

  // Swings move on their own; you ride if you're standing on one. Only one thing slides at a time,
  // and this used to take the first eligible slider in the array every frame — so on a maze with
  // four swings the ones later in the list never moved at all. The gauntlet swing was last on one
  // seed and simply never budged in four seconds. Most overdue first, so they take turns.
  if (!sliding && started && !paused) for (const sl of autoSliders(sliders)) {
    if (!sl.auto) continue;
    if (!sl.nextAt) sl.nextAt = now + CONFIG.swingSeconds * 1000 * (0.5 + Math.random());
    if (now < sl.nextAt) continue;
    const cx = sl.shifted ? sl.x + sl.dx : sl.x, cy = sl.shifted ? sl.y + sl.dy : sl.y;
    const d = sl.shifted ? { dx: -sl.dx, dy: -sl.dy } : { dx: sl.dx, dy: sl.dy }, to = [cx + d.dx, cy + d.dy];
    const carry = Math.floor(player.x) === cx && Math.floor(player.y) === cy;
    if (!carry && Math.floor(player.x) === to[0] && Math.floor(player.y) === to[1]) { sl.nextAt = now + 800; continue; }   // never slide into you
    tiles[cy][cx] = 0; tiles[to[1]][to[0]] = 0;
    sliding = { sl, from: [cx, cy], to, ox: player.x - (cx + 0.5), oy: player.y - (cy + 0.5), t0: now, carry, dur: CONFIG.sliderSeconds * 500 }; if (carry) { dir = null; clearStick(); }
    AUDIO.swing(cx, cy); sl.nextAt = now + CONFIG.sliderSeconds * 500 + CONFIG.swingSeconds * 1000;
    break;
  }
  if (sliding) {
    const [fx, fy, k] = slidePos(sliding, now);
    // He rides the tile rather than being lerped at it. Two complaints, one line: starting the ride
    // at from+0.5 teleported anyone who walked up off-centre onto the centreline ("a definite snap
    // and pop"), and lerping him straight at the destination instead made the *tile* follow him, so
    // it set off at whatever angle he happened to be standing at. So: the tile goes where the tile
    // goes, and he keeps the offset he pushed from and is eased out of it — square and on the line
    // by slideAlign of the way across, well before it lands.
    if (sliding.carry !== false) {
      const drift = 1 - Math.min(1, k / CONFIG.slideAlign);
      player.x = fx + sliding.ox * drift;
      player.y = fy + sliding.oy * drift;
    }
    if (k >= 1) {
      const [tx, ty] = sliding.to;
      // A slide can outlive the world it started in — a debug generate(), a new Size mid-flight —
      // and then its destination is off the end of the new grid. Drop it rather than throw: a
      // throw inside update() never re-queues the frame loop, and the game simply stops.
      if (!tiles[ty] || tiles[ty][tx] === undefined) { sliding = null; }
      else {
        tiles[ty][tx] = 1;
        if (sliding.sl.ways) sliding.sl.at = sliding.toAt; else sliding.sl.shifted = !sliding.sl.shifted;
        const fromKey = sliding.from.join(','), toKey = sliding.to.join(',');
        if (marks.has(fromKey)) { const g = marks.get(fromKey); marks.delete(fromKey); marks.set(toKey, g); }
        if (sliding.carry !== false) lastTileKey = toKey; const wasAuto = sliding.sl.auto; sliding = null; if (!wasAuto) AUDIO.slideEnd();
      }
    }
  }
  if (want && !(sliding && sliding.carry !== false)) {
    if (!dir) {
      const cx = Math.floor(player.x), cy = Math.floor(player.y);
      const sl = sliders.find(s => { const [bx, by] = blockAt(s); return !s.auto && bx === cx && by === cy; });
      const pushDir = sl && blockWays(sl).find(([dx, dy]) => want.dx === dx && want.dy === dy);
      if (sl && pushDir && !canGo(want)) {
        if (!pushHeldSince) pushHeldSince = now;
        if (now - pushHeldSince < CONFIG.pushHoldMs) { /* leaning… */ }
        else {
        const to = [cx + want.dx, cy + want.dy];
        tiles[cy][cx] = 0; tiles[to[1]][to[0]] = 0;
        sliding = { sl, from: [cx, cy], to, ox: player.x - (cx + 0.5), oy: player.y - (cy + 0.5), t0: now, dur: CONFIG.sliderSeconds * 1000, toAt: sl.ways ? (sl.at ? 0 : 1 + sl.ways.findIndex(([dx, dy]) => dx === want.dx && dy === want.dy)) : undefined }; facing = Math.atan2(want.dy, want.dx); AUDIO.slideStart(); if (sl.atStart) { firstPushDone = true; startArrow = null; if (!SAVE.pushLearned && !protoMode) { SAVE.pushLearned = true; persist(); } } pushHeldSince = 0; recenter = null;
        }
      }
      else if (canGo(want)) dir = want;
      else if (doorAt(Math.floor(player.x) + want.dx, Math.floor(player.y) + want.dy)) { const d = doorAt(Math.floor(player.x) + want.dx, Math.floor(player.y) + want.dy); if (now > narrHideAt) { narrate(moment('doorLocked', { shape: d.shape })); AUDIO.locked(); } }
      else if (poolDoor && poolDoorShut() && Math.floor(player.x) + want.dx === poolDoor.x && Math.floor(player.y) + want.dy === poolDoor.y) {
        // the gate does not open because you are holding the stone; it opens because you shove it
        // with the stone. Lean on it as long as you would lean on a block, and it starts to give.
        if (!hasKey) { if (now > narrHideAt) { narrate(moment('poolDoorNoStone')); AUDIO.locked(); } }
        else if (!poolDoor.openAt) {
          if (!pushHeldSince) pushHeldSince = now;
          else if (now - pushHeldSince >= CONFIG.pushHoldMs) { poolDoor.openAt = now; AUDIO.doorSlide(); pushHeldSince = 0; saveRun(true); if (now > narrHideAt) narrate(moment('poolDoorGives')); }
        }
      }
      else if (gated && !hasKey && isOpen(Math.floor(player.x)+want.dx, Math.floor(player.y)+want.dy) && now > narrHideAt) { narrate(moment('exitLocked')); AUDIO.locked(); } }
    else if ((want.dx !== 0) === (dir.dx !== 0)) dir = want;
    else if (canGo(want) && offCenter(want) <= CONFIG.turnForgiveness) { snapPerp(want); dir = want; }
  }
  if (dir) facing = Math.atan2(dir.dy, dir.dx);
  const faceFromX = player.x, faceFromY = player.y;   // where he starts the frame, to see where he went
  // Keep the gap itself, not just the fact of it: under free movement there is no `dir` to say which
  // way the channel runs, so the squeeze has to answer that from its own geometry.
  { const gap = started && phase().f.crawl && [...crawlGaps, ...crawlCells].find(k => { const [gx, gy] = k.split(',').map(Number); return Math.abs(player.x - gx - 0.5) + Math.abs(player.y - gy - 0.5) < CONFIG.squeezeReach; });
    if (gap) { const [gx, gy] = gap.split(',').map(Number);
      // Which way the channel runs. A gap between two cells has arms on one axis only, and he is
      // held on the other. But a gap or crawl cell can end up open on both axes — a room carved
      // beside it later, an L of two gaps — and Joe found what that did: "anytime there's a 'plus'
      // shape for a squeeze it doesn't let you cross through one of the sides. This one won't let
      // me go up or down. Only left to right." The clamp held him on y because left and right were
      // open, so every step up was pulled straight back. Where both axes have an arm, the channel
      // is whichever way he is walking; with the stick idle it keeps the last answer.
      const armX = isOpen(gx - 1, gy) || isOpen(gx + 1, gy), armY = isOpen(gx, gy - 1) || isOpen(gx, gy + 1);
      const mv = dir || want;
      squeezeAxis = (armX && armY) ? (mv ? (mv.dx ? 'y' : 'x') : squeezeAxis) : (armX ? 'y' : 'x'); }
    else squeezeAxis = null;
    // no camera kick going in or out, and the sound is the same knock as a shoulder on a wall
    if (!!gap !== inSqueeze) { inSqueeze = !!gap; AUDIO.bump(); } }

  // He walks where the stick points, everywhere. Joe asked three times: "it is still fighting, trying
  // to be in the middle of the cells as opposed to just free-roaming movement. If this means we need
  // to make all of it free roaming we could talk about that." So this is the talk, in the hands: the
  // rails are still here behind the debug Movement toggle, and they are what `freeRoam` is off.
  // A corridor is one tile wide and he is most of one, so the walls hold him to the line without
  // any rail doing it — and releasing the stick now stops him, which is the other half of Joe's
  // "movement is a little slide-y in general. Feels more like I'm in a go cart than a person."
  // Three models, because Joe wants a different one in each kind of space: "in corridors I prefer the
  // corridor movement over the free movement. But in rooms I'm more interested in the free
  // movement." That is 'rooms', and it is the default — the rails where a corridor is one tile wide,
  // the stick's own direction where there is floor to walk about on. 'rails' and 'free' are the two
  // ends, kept on the debug menu so all three can be felt against each other.
  const moveModel = SAVE.ui.move || 'rooms';
  const freeRoam = moveModel === 'free';
  // Only where he is standing, never the tile ahead. I added the look-ahead in v0.70 to stop him
  // snapping onto the rails on the last tile of a room — but it hands free movement the *corridor*
  // tile outside a room's mouth, which is one tile wide, so he wanders off the line and catches the
  // jamb. Joe: "the tile right before rooms lets your character move freely and it ends up getting
  // stuck on things and moves oddly. We should not do that. The character should stay on rails until
  // they're in the room." He is right, and the mouth funnel below is what the look-ahead was for.
  const freeHere = want && openFloor(Math.floor(player.x), Math.floor(player.y));
  const aim = want && !sliding && !introWalk && (freeRoam || (moveModel === 'rooms' && freeHere))
    ? (stickAim && (want === held) ? stickAim : { x: want.dx, y: want.dy }) : null;
  // Nothing coasts on after you let go — except the scripted first step off the mat, which is the
  // one thing in the game that walks him without a stick and steers itself along `dir`. Clearing it
  // here left introWalk unable to change tile, and it only ends when he does: the stick stayed dead
  // for the whole run, which is the failure its own comment above warns about.
  if (freeRoam && !aim && !introWalk) { dir = null; recenter = null; }

  // One speed budget for the frame, shared by walking forward and easing back onto the corridor's
  // centreline. The ease used to be its own movement at 1.6x walking on top of the step, so going
  // round a corner you crabbed diagonally at nearly twice walking speed — Joe: "they have this
  // almost like race car cornering thing to them". Taking it out of the same budget means a hard
  // correction just costs you ground forward while it lasts, and your speed never changes.
  // It leans into the walk and leans out of it over CONFIG.moveEase rather than switching on and
  // off at full tilt, which is the rest of the go-kart: a kart has no legs to get going.
  { const target = !(aim || dir) ? 0
      // the walk off the mat is scripted, so it is pinned to the configured speed rather than
      // B.speed() — the debug slider was dragging this beat along with the player's own pace
      : introWalk ? CONFIG.speed * CONFIG.introWalkSpeed
      : B.speed() * (inSqueeze ? CONFIG.squeezeSlow : 1);
    moveVel += (target - moveVel) * Math.min(1, dt / CONFIG.moveEase); }
  const budget = moveVel * dt;
  if (aim) {
    // He has width, so he cannot cut a corner of wall — and it is passable(), not isOpen(): a shut
    // gate and a locked door are open floor underneath, and walking free is not walking through them.
    const rr = CONFIG.playerSize * 0.5;
    const clear = (nx, ny) => passable(Math.floor(nx - rr), Math.floor(ny - rr)) && passable(Math.floor(nx + rr), Math.floor(ny - rr))
      && passable(Math.floor(nx + rr), Math.floor(ny + rr)) && passable(Math.floor(nx - rr), Math.floor(ny + rr));
    const nx = player.x + aim.x * budget, ny = player.y + aim.y * budget;
    const wentX = clear(nx, player.y), wentY = clear(player.x, ny);
    if (wentX) player.x = nx;
    if (wentY) player.y = ny;
    // A corridor mouth is one tile wide and he has width, so coming at it off-centre from a room he
    // catches the jamb and stops dead. Joe: "when I try and push into the cell the movement fights
    // me, and stops the character from moving. I have to like jiggle it to get him to move in." So
    // when the way he is leaning is shut but the tile past the jamb is open, walk him onto its line.
    const domX = Math.abs(aim.x) >= Math.abs(aim.y);
    if (domX ? !wentX : !wentY) {
      const sgn = Math.sign(domX ? aim.x : aim.y);
      const gx = Math.floor(player.x) + (domX ? sgn : 0), gy = Math.floor(player.y) + (domX ? 0 : sgn);
      if (passable(gx, gy)) {
        const ax = domX ? 'y' : 'x', c = (domX ? gy : gx) + 0.5, diff = c - player[ax];
        if (Math.abs(diff) > 0.002) player[ax] += Math.sign(diff) * Math.min(Math.abs(diff), budget);
      }
    }
    facing = Math.atan2(aim.y, aim.x);
    dir = null; recenter = null;
  }

  // In a squeeze there is nowhere to drift to, whichever way he is being moved — on the rails that
  // used to live inside the corner ease, but free movement has no ease to hang it off.
  if (inSqueeze && squeezeAxis) {
    const c2 = Math.floor(player[squeezeAxis]) + 0.5, off = player[squeezeAxis] - c2, lim = CONFIG.squeezeChannel / 2;
    if (Math.abs(off) > lim) player[squeezeAxis] = c2 + Math.sign(off) * lim;
  }

  let perpUsed = 0;
  if (!aim) { const ax = dir ? (dir.dx ? 'y' : 'x') : recenter;
    if (ax) { const c = Math.floor(player[ax]) + 0.5, diff = c - player[ax];
      if (Math.abs(diff) < 0.004) { player[ax] = c; if (!dir) recenter = null; }
      else { const mv = Math.min(Math.abs(diff), (dir && !inSqueeze ? CONFIG.cornerEase : 1) * budget);
        player[ax] += Math.sign(diff) * mv; perpUsed = mv; }
      // the channel clamp above has already held him; the ease only has to not fight it
      if (inSqueeze) { const c2 = Math.floor(player[ax]) + 0.5, off = player[ax] - c2, lim = CONFIG.squeezeChannel / 2;
        if (Math.abs(off) > lim) player[ax] = c2 + Math.sign(off) * lim; } } }
  if (dir && !aim) {
    const step = Math.sqrt(Math.max(0, budget * budget - perpUsed * perpUsed));
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

  // Which way he points. Joe: "can you make a toggle that makes it so whichever direction the
  // character is moving it is pointed that way? ...right now he points mostly in that direction, but
  // when he's moving he only points up, down, left, right." The four directions come of taking it
  // from `dir` and from the stick, both of which are squared off. The ground he actually covered is
  // not: it carries the wall slides, the corner ease and the mouth funnel, so it points at 360
  // degrees for free. Below a crawl it keeps the last angle rather than spinning on rounding noise.
  if (SAVE.ui.face !== false) {
    const mx = player.x - faceFromX, my = player.y - faceFromY;
    if (Math.hypot(mx, my) > CONFIG.faceMinStep * dt) facing = Math.atan2(my, mx);
  }
  // and it turns to that rather than snapping, which is the other half of what he asked for
  { let d = facing - facingShown; d = Math.atan2(Math.sin(d), Math.cos(d));
    facingShown += d * Math.min(1, dt * CONFIG.faceTurnRate); }

  // "I used to fit through here." Joe: "we should only give this pop-up text about not being able
  // to get into the squeeze through when the character's directly hitting or pointing towards the
  // squeeze through." It used to fire on walking into any tile with a crawl gap anywhere beside it,
  // so you got it in passing, facing the other way. Now it wants him aimed at the gap — pressing
  // into it, or turned to within crawlSayArc of it — and it is asked every frame rather than only
  // on a tile change, because turning to face one is not a tile change.
  if (!phase().f.crawl && !crawlSaid && started && crawlGaps.size) {
    const tx = Math.floor(player.x), ty = Math.floor(player.y), aim = held || dir;
    const at = DIRS.find(([dx, dy]) => {
      if (!crawlGaps.has((tx + dx) + ',' + (ty + dy))) return false;
      if (aim && aim.dx === dx && aim.dy === dy) return true;          // pressing into it
      let d = facing - Math.atan2(dy, dx); d = Math.atan2(Math.sin(d), Math.cos(d));
      return Math.abs(d) <= CONFIG.crawlSayArc;                        // or turned to it
    });
    if (at) { crawlSaid = true; narrate(moment('crawlTooBig')); }
  }

  const prevKey = lastTileKey;
  if (!want || dir) pushHeldSince = 0;
  if (dir || sliding || want) idleSince = now;
  // standing on a shelf for a second brings up whose it is. "Standing" means you are not walking
  // and not being carried — `carry !== false` is the same test the stick uses. It used to be any
  // `sliding` at all, so a swing on the far side of the maze reset the dwell every time it moved,
  // and once the Child got five of them the shelves and the basin went quiet almost every time.
  if (startRoom && !dir && !(sliding && sliding.carry !== false)) {
    const cx = Math.floor(player.x), cy = Math.floor(player.y), { x0, y0, y1 } = startRoom;
    const spots = SHELF_SPOTS(x0, y0, y1).map(([x,y]) => [x,y]);
    const idx = spots.findIndex(([x,y]) => x===cx && y===cy);
    const onBasin = cx === startRoom.x0 + 3 && cy === startRoom.y0 + 3;
    const k = idx >= 0 ? idx + '' : onBasin ? 'basin' : '';
    // shelfShown is the latch that keeps a line from repeating every frame while you stand there.
    // It belongs to *this* stand, so stepping off clears it: held past that it went quiet for the
    // rest of the page load, and since a debug level change is a reset() and not a reload, every
    // maze after the first was silent on the shelves and the basin.
    if (k !== shelfStandKey) { shelfStandKey = k; shelfStandAt = now; shelfShown = ''; }
    else if (k && k !== 'basin' && now - shelfStandAt > 1000 && shelfShown !== k) { shelfShown = k;
      const c = CAST.filter(c => c.pages.length)[idx];
      if (c && !collectedCount(c.name)) narrate(EMPTY_SHELF[Math.random() * EMPTY_SHELF.length | 0]);
      // The shelf and basin lines spread across however many there are, rather than the three this
      // used to hard-wire with t >= 0.8 / 0.4. Joe, on the writer's page: "I might want to write a
      // new line for the basin, or for when he is walking through the maze, or standing at a
      // bookshelf." A fourth line here used to be unreachable; now it makes the run through the
      // chapter finer instead. `t` is how much of this self's pages you are carrying.
      else if (c) { const L = (ROOM_LINES[character.name] || ROOM_LINES['You']).shelf, t = collectedCount(character.name) / Math.max(1, character.pages.length); narrate(L[Math.min(L.length - 1, Math.floor(t * L.length))]); } }
    // the basin: first visit after putting a stone down says so; otherwise the self speaks of the stones
    if (onBasin && now - shelfStandAt > 700 && shelfShown !== 'basin') { shelfShown = 'basin';
      if ((SAVE.basinSeen || 0) < (SAVE.stones || 0)) { SAVE.basinSeen = SAVE.stones; persist(); narrate(LIGHTER[Math.min(LIGHTER.length - 1, (SAVE.stones || 0) - 1)]); }
      else if (poolMode) narrate(moment('stoneTaken'));
      else { const L = (ROOM_LINES[character.name] || ROOM_LINES['You']).basin, t = collectedCount(character.name) / Math.max(1, character.pages.length); narrate(L[Math.min(L.length - 1, Math.floor(t * L.length))]); } }
  } else { shelfStandKey = ''; shelfShown = ''; }
  const key = Math.floor(player.x) + ',' + Math.floor(player.y);
  visited.add(key);
  if (introWalk && key !== lastTileKey) introWalk = null;
  if (key !== lastTileKey) { if (lastTileKey) { steps++; AUDIO.step(tunnelTiles.has(key)); } lastTileKey = key; saveRun(false); }
  if (key !== prevKey) {
    const [tx, ty] = key.split(',').map(Number);
    // the secret room: nobody tells you it is there, so the only line is the one you think on the way in
    if (!secretSaid && secretTiles.has(key)) {
      secretSaid = true; narrate(SECRET_LINES[Math.random() * SECRET_LINES.length | 0]);
    }
    // the switch on its floor: stand on it and the lights stutter on over everything somebody drew
    if (!secretOn && secretSwitch === key) { secretOn = true; secretLitAt = now; AUDIO.secretLights(); saveRun(true); }
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
    if (ticTacToe && !tttSaid && tx === ticTacToe.x && ty === ticTacToe.y) { tttSaid = true; narrate(moment('ticTacToe')); }
    // hopscotch: in order, one square at a time
    if (hopscotch.length && !hopSaid) {
      const hi = hopscotch.indexOf(key);
      if (hi === hopIdx) { hopIdx++; AUDIO.hop(hopIdx); if (hopIdx === hopscotch.length) { hopSaid = true; narrate(moment('hopscotchDone')); } }
      else if (hi === -1 && hopIdx > 0 && !hopscotch.includes(prevKey)) hopIdx = 0;
      else if (hi >= 0 && hi !== hopIdx && hi !== hopIdx - 1) hopIdx = hi === 0 ? 1 : 0;
    }
    // a tile goes onto the map: one heartbeat of the icon, so you can see it working without
    // opening the map. When the piece runs out it pulses hard instead — and if you held the icon
    // down at some point, the next piece picks up where this one stopped, no tap needed.
    if (charcoalOn && charcoalLeft > 0) { const added = mapHere(); if (added) { if (!SAVE.ui.charcoalInf) charcoalLeft = Math.max(0, charcoalLeft - added); updateCharcoal();   // the debug tap: it never wears down
      // Joe, on v0.100.0's beat: "slow down the pulsing of the charcoal icon. It's too crazy. Make it
      // pulse like half as much." So every charcoalBeatEvery-th tile logged, not every one
      if (++charcoalTiles % CONFIG.charcoalBeatEvery === 0) beat(charcoalEl);
      if (charcoalLeft === 0) { charcoalOn = false; AUDIO.charcoalEnd(); spentPulse(charcoalEl);
        if (charcoalLock && charcoal > 0) { charcoal--; charcoalUsed++; charcoalLeft = B.charcoal(); charcoalOn = true; charcoalLeft = Math.max(0, charcoalLeft - mapHere()); AUDIO.charcoalStart(); }
        updateCharcoal(); } } }
    if (charcoalSpots.has(key)) { charcoalSpots.delete(key); charcoal++; charcoalFound++; updateCharcoal(); pulse(charcoalEl); AUDIO.pickupChalk(); tutorial('charcoal'); }
    if (DIRS.filter(([dx,dy]) => isOpen(tx+dx, ty+dy)).length === 1 && key !== exit.x+','+exit.y) deadEndsEntered++;
    if (chalkSpots.has(key)) { chalkSpots.delete(key); chalk += CONFIG.chalkPerPickup; chalkFound++; updateChalk(); pulse(chalkEl); AUDIO.pickupChalk(); tutorial('chalk'); }
    if (pickups.has(key)) {
      const kind = pickups.get(key); pickups.delete(key);
      if (kind === 'pointer') { pointerUntil = now + B.pointerSec() * 1000; pointerUses++; }
      // Joe: "it stays up bright and strong until you find it, then it gives a pulse and starts a
      // 15 second timer." Picking it up only arms it — the clock starts when he is standing on it.
      else { pathArmed = true; pathUntil = 0; pathFoundAt = 0; pathUses++; }
      // No flash on the HUD any more: there is no longer a chip up there to flash. What tells you
      // it worked is the thing itself — the compass appears beside him, the thread lights the whole
      // way out — plus the sound.
      AUDIO.pickup(); tutorial(kind);
    }
    // and this is finding it: the thread is the way out drawn on the floor, so you have found it
    // when you are standing on it. "Just leave it visible until the player walks on a tile that
    // has the thread." Only then does it flare and begin to go.
    if (pathArmed && solutionKeys.has(key)) { pathArmed = false; pathFoundAt = now; pathUntil = now + B.pathSec() * 1000; AUDIO.pickup(); }
    // a carved stone, one at a time. Joe: the point is to "backtrack around the maze" — so the
    // second one you find is not picked up, it is remembered.
    if (offerings.has(key)) {
      if (carried === null) { carried = offerings.get(key); offerings.delete(key); renderCarried(); AUDIO.stone(); narrate(SHRINE_LINES.pickup); tutorial('offering'); saveRun(true); }
      else if (!carryFullSaid) { carryFullSaid = true; narrate(SHRINE_LINES.full); }
    }
    // the step before a statue: the right stone settles into the bowl, and the statue points its
    // thread at the nearest page you have not found — the one thing you are still looking for
    { const sh = shrines.find(s => !s.done && s.sx === tx && s.sy === ty);
      if (sh) {
        if (carried === sh.who) { sh.done = true; sh.doneAt = now; carried = null; renderCarried(); AUDIO.stone();
          shrinePath = pathToNearestPage(tx, ty); shrineUntil = shrinePath.length ? now + CONFIG.shrineThreadSec * 1000 : 0;
          saveRun(true); showExchange(sh); }
        else if (carried !== null && !shrineWrongSaid) { shrineWrongSaid = true; narrate(SHRINE_LINES.wrong); }
        // Joe: "When you don't have a stone but you collide with the statue, it should say
        // something." Once per visit, like the finished statue below, not every frame you stand there.
        else if (carried === null && prevKey !== key) narrate(SHRINE_LINES.noStone); }
      // and a statue you have already satisfied, stepped up to again: its finished line if it is
      // spent, otherwise the note that it has said its piece — once per visit, not every frame
      else { const dn = shrines.find(s => s.done && s.sx === tx && s.sy === ty); if (dn && prevKey !== key) narrate(exchangeStep(dn.who) ? SHRINE_LINES.again : (EXCHANGES[dn.who]?.done || SHRINE_LINES.again)); } }
    if (scrapSpots.has(key)) { scrapSpots.delete(key); revealAround(tx, ty); pulse($('mapBtn')); AUDIO.pickup(); tutorial('scrap'); }
    if (lampSpot === key) { lampSpot = null; hasLamp = true; lampOn = true; $('lamp').classList.add('show', 'on'); pulse($('lamp')); AUDIO.lampOn(); tutorial('lamp'); }
    // a key is one use: it turns in its lock and stays there. Joe: "I'd expect these keys to be one
    // use so they should disappear once you've used them." Each maze deals one key per door and no
    // two doors share a shape, so spending it can never lock you out of the next one.
    { const d = doors.find(d => d.x === tx && d.y === ty && !d.open); if (d) { d.open = true; d.openAt = now; AUDIO.gate();
      if (heldKeys.delete(d.shape)) { renderKeys(); if (now > narrHideAt) narrate(moment('doorUnlocked')); }
      saveRun(true); } }
    if (innerKeys.has(key)) { const shape = innerKeys.get(key); innerKeys.delete(key); heldKeys.add(shape); renderKeys(); AUDIO.key(); narrate(moment('keyFound', { shape })); tutorial('door'); saveRun(true); }
    if (keySpot === key) { keySpot = null; hasKey = true; exitGateAt = now; if (poolMode) { $('stone').classList.add('show'); pulse($('stone')); AUDIO.stone(); if (poolDoor) narrate(moment('stoneForGate')); } else { keyEl.classList.add('show'); pulse(keyEl); AUDIO.key(); tutorial('key'); } }
    if (journals.has(key) && character) { const pg = journals.get(key); journals.delete(key); journalsRead++; showJournal(pg); updateBooks();
      if (collectedCount(character.name) >= character.pages.length && (SAVE.phase || 0) < PHASES.length - 1 && !SAVE.poolPending) { SAVE.poolPending = true; persist(); } }
  }

  // Joe: "the compass pointer shouldn't have a number. It should just do a fade like the thread."
  // So nothing is written here any more — the compass itself says how long it has left, by going
  // out. The clear is kept rather than dropped because a run saved by an older build can still
  // restore with the old chip's markup sitting in the element.
  if (fxEl.innerHTML) fxEl.innerHTML = '';

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
    const secs = fmtTime(gameNow() - t0);
    const optimal = solutionPath.length - 1, ratio = (steps / optimal).toFixed(2);
    logRun();   // every maze you walk out of goes in the log, pool levels included
    const rows = [
      ['Tiles walked', steps], ['Shortest route', optimal + ' tiles'], ['Wandering', ratio + '× the shortest route'],
      ['Time', secs], ['Dead ends entered', deadEndsEntered],
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
    $('msgStats').innerHTML = `<li class="pages">${whose}${pagesHtml}</li><li class="stat">${steps} tiles · ${secs} · ${ratio}× the shortest way</li>`;
    $('msgSeed').textContent = 'seed ' + SEED;
    $('msg').classList.add('show');
  }
}

