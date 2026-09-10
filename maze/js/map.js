// The Maze — the charcoal map, panning and zooming
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── map screen ──────────────────────────────────────────────────
const mapEl = $('map'), mapCv = $('mapCv'), mctx = mapCv.getContext('2d');
let mapOpen = false, mapView = { cx: 0, cy: 0, S: 22 };   // world tile at screen center, px per tile
const mapPtrs = new Map(); let mapPinch = null;
function openMap() {
  $('mapBtn').classList.remove('beckon');
  mapOpen = true; mapEl.classList.add('show'); clearStick();
  mapCv.width = innerWidth * dpr; mapCv.height = innerHeight * dpr;
  mapView.cx = player.x; mapView.cy = player.y; mapView.S = 22;
  drawMap();
}
function closeMap() { mapOpen = false; mapEl.classList.remove('show'); }
$('mapBtn').addEventListener('pointerdown', e => { e.stopPropagation(); if (started && !solved) openMap(); });
$('mapClose').addEventListener('click', closeMap);
mapEl.addEventListener('pointerdown', e => { if (e.target === $('mapClose')) return; mapPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); mapEl.setPointerCapture(e.pointerId); if (mapPtrs.size === 2) { const [a, b] = [...mapPtrs.values()]; mapPinch = { d: Math.hypot(a.x-b.x, a.y-b.y), S: mapView.S }; } });
mapEl.addEventListener('pointermove', e => {
  const prev = mapPtrs.get(e.pointerId); if (!prev) return;
  const cur = { x: e.clientX, y: e.clientY };
  if (mapPtrs.size === 1) { mapView.cx -= (cur.x - prev.x) / mapView.S; mapView.cy -= (cur.y - prev.y) / mapView.S; }
  mapPtrs.set(e.pointerId, cur);
  if (mapPtrs.size === 2 && mapPinch) { const [a, b] = [...mapPtrs.values()]; mapView.S = Math.max(8, Math.min(70, mapPinch.S * Math.hypot(a.x-b.x, a.y-b.y) / mapPinch.d)); }
  drawMap();
});
const mapUp = e => { mapPtrs.delete(e.pointerId); if (mapPtrs.size < 2) mapPinch = null; };
mapEl.addEventListener('pointerup', mapUp); mapEl.addEventListener('pointercancel', mapUp);
mapEl.addEventListener('wheel', e => { mapView.S = Math.max(8, Math.min(70, mapView.S * (e.deltaY < 0 ? 1.1 : 0.9))); drawMap(); });
function drawMap() {
  const C = CONFIG.colors, vw = innerWidth, vh = innerHeight, S = mapView.S;
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.fillStyle = C.bg; mctx.fillRect(0, 0, vw, vh);
  const ox = vw/2 - mapView.cx*S, oy = vh/2 - mapView.cy*S;
  const T = (x, y) => [ox + x*S + S/2, oy + y*S + S/2];
  if (!mapped.size && !marks.size) { mctx.fillStyle = '#6f6b62'; mctx.font = 'italic 17px "Iowan Old Style", Palatino, Georgia, serif'; mctx.textAlign = 'center'; mctx.fillText('A blank canvas, waiting for charcoal.', vw/2, vh/2 - 12); mctx.font = '14px "Iowan Old Style", Palatino, Georgia, serif'; mctx.fillText('Tap the charcoal to begin mapping as you walk.', vw/2, vh/2 + 16); return; }
  // tiles
  for (const [k, kind] of mapped) { const [x, y] = k.split(',').map(Number);
    mctx.fillStyle = kind === 'wall' ? C.mapWall : kind === 'tunnel' ? C.tunnel : darkTiles.has(k) ? '#3a3834' : C.mapFloor; mctx.fillRect(ox + x*S, oy + y*S, S+0.5, S+0.5); }
  // seams on floor
  mctx.strokeStyle = 'rgba(13,15,16,.35)'; mctx.lineWidth = 1; mctx.beginPath();
  for (const [k, kind] of mapped) { if (kind === 'wall') continue; const [x, y] = k.split(',').map(Number); mctx.rect(ox + x*S, oy + y*S, S, S); }
  mctx.stroke();
  const seen = k => mapped.has(k) && mapped.get(k) !== 'wall';
  // exit + gate, if mapped
  if (seen(exit.x+','+exit.y)) { const [ex, ey] = T(exit.x, exit.y); mctx.fillStyle = C.exit; mctx.beginPath(); mctx.arc(ex, ey, S*0.28, 0, Math.PI*2); mctx.fill(); mctx.fillStyle = C.bg; mctx.beginPath(); mctx.arc(ex, ey, S*0.12, 0, Math.PI*2); mctx.fill(); }
  // start
  if (seen(Math.floor(start.x)+','+Math.floor(start.y))) { const [px, py] = T(Math.floor(start.x), Math.floor(start.y)); mctx.fillStyle = C.start; mctx.fillRect(px - S*0.28, py - S*0.39, S*0.56, S*0.78); }
  // key, pages, chalk & charcoal pickups still lying where you saw them
  mctx.lineCap = 'round';
  if (keySpot && seen(keySpot)) { const [x, y] = keySpot.split(',').map(Number); const [px, py] = T(x, y); mctx.strokeStyle = C.key; mctx.lineWidth = Math.max(1.5, S*0.09); mctx.beginPath(); mctx.arc(px - S*0.12, py, S*0.12, 0, Math.PI*2); mctx.moveTo(px, py); mctx.lineTo(px + S*0.28, py); mctx.stroke(); }
  for (const d of doors) if (!d.open && seen(d.x+','+d.y)) { const [px, py] = T(d.x, d.y); drawShape(mctx, d.shape, px, py, S*0.22, C.gate, Math.max(1.5, S*0.08)); }
  for (const [k, shape] of innerKeys) if (seen(k)) { const [x, y] = k.split(',').map(Number); const [px, py] = T(x, y); drawShape(mctx, shape, px, py, S*0.18, C.key, Math.max(1.5, S*0.08)); }
  for (const k of journals.keys()) if (seen(k)) { const [x, y] = k.split(',').map(Number); const [px, py] = T(x, y); mctx.fillStyle = C.journal; mctx.fillRect(px - S*0.22, py - S*0.16, S*0.44, S*0.32); }
  for (const k of chalkSpots) if (seen(k)) { const [x, y] = k.split(',').map(Number); const [px, py] = T(x, y); mctx.fillStyle = C.chalk; mctx.fillRect(px - S*0.18, py - S*0.06, S*0.36, S*0.12); }
  for (const k of scrapSpots) if (seen(k)) { const [x, y] = k.split(',').map(Number); const [px, py] = T(x, y); mctx.fillStyle = C.mapFloor; mctx.strokeStyle = C.wall; mctx.lineWidth = 1; mctx.fillRect(px - S*0.18, py - S*0.14, S*0.36, S*0.28); mctx.strokeRect(px - S*0.18, py - S*0.14, S*0.36, S*0.28); }
  for (const k of charcoalSpots) if (seen(k)) { const [x, y] = k.split(',').map(Number); const [px, py] = T(x, y); mctx.fillStyle = C.charcoal; mctx.strokeStyle = C.exit; mctx.lineWidth = 1; mctx.fillRect(px - S*0.16, py - S*0.08, S*0.32, S*0.16); mctx.strokeRect(px - S*0.16, py - S*0.08, S*0.32, S*0.16); }
  for (const [k, kind] of pickups) if (seen(k)) { const [x, y] = k.split(',').map(Number); const [px, py] = T(x, y); mctx.fillStyle = kind === 'pointer' ? C.pointerPickup : C.pathPickup; mctx.beginPath(); mctx.arc(px, py, S*0.18, 0, Math.PI*2); mctx.fill(); }
  // chalk marks
  mctx.strokeStyle = C.mark;
  for (const [k, g] of marks) { const [x, y] = k.split(',').map(Number); const [px, py] = T(x, y); drawGlyph(mctx, g, px, py, S*0.22, Math.max(1.5, S*0.09)); }
  // you
  { const [px, py] = T(Math.floor(player.x), Math.floor(player.y)), r = S*0.36;
    mctx.save(); mctx.translate(px, py); mctx.rotate(facing); mctx.fillStyle = C.player; mctx.beginPath(); mctx.moveTo(r, 0); mctx.lineTo(-r*0.8, -r*0.75); mctx.lineTo(-r*0.45, 0); mctx.lineTo(-r*0.8, r*0.75); mctx.closePath(); mctx.fill();
    mctx.fillStyle = C.wall; mctx.beginPath(); mctx.moveTo(r, 0); mctx.lineTo(r*0.3, -r*0.29); mctx.lineTo(r*0.3, r*0.29); mctx.closePath(); mctx.fill(); mctx.restore(); }
}


// ── the Full map debug view: tap to stand there, pinch or scroll to zoom ─────
// Live only while the debug menu's Full map is ticked. `dbgView` stays null until
// you pan or zoom, and null means "fitted to the screen", which is what the view
// has always been. Untick and tick Full map, or start a new maze, to get the fit
// back. render.js asks dbgFrame() for the camera so both agree exactly — working
// off the last frame's numbers instead would drift during a pinch.
const dbgFit = () => Math.min(innerWidth / W, (innerHeight - 260) / H);
function dbgFrame() {
  const vw = innerWidth, vh = innerHeight;
  if (!dbgView) { const S = dbgFit(); return { S, ox: (vw - W*S)/2, oy: (vh - H*S)/2 - 80 }; }
  const S = dbgView.S; return { S, ox: vw/2 - dbgView.cx*S, oy: vh/2 - dbgView.cy*S };
}
function setDebugMap(on) { debugMap = on; opt.map.checked = on; dbgView = null; }
function dbgHold() {   // take the fitted view as the starting point the first time you touch it
  if (!dbgView) { const f = dbgFrame(); dbgView = { cx: (innerWidth/2 - f.ox) / f.S, cy: (innerHeight/2 - f.oy) / f.S, S: f.S }; }
  return dbgView;
}
function dbgPan(dx, dy) { const v = dbgHold(); v.cx -= dx / v.S; v.cy -= dy / v.S; dbgClamp(); }
function dbgClamp() { dbgView.cx = Math.max(0, Math.min(W, dbgView.cx)); dbgView.cy = Math.max(0, Math.min(H, dbgView.cy)); }
function dbgZoomAt(want, px, py) {   // the world point under your fingers stays under them
  const v = dbgHold(), f = dbgFrame();
  const wx = (px - f.ox) / f.S, wy = (py - f.oy) / f.S;
  v.S = Math.max(dbgFit() * CONFIG.debugMapMinZoom, Math.min(CONFIG.debugMapMaxZoom, want));
  v.cx = wx + (innerWidth/2 - px) / v.S; v.cy = wy + (innerHeight/2 - py) / v.S;
  dbgClamp();
}
// stand where you tapped. A wall takes the nearest floor within reach, because at the
// fitted scale a tile is a few pixels wide and a fingertip is not. Never the exit tile:
// a stray tap should not end the run. Pickups and pages fire as they would on foot,
// since arriving is arriving — the run stays a run you could have walked.
function dbgTeleport(clientX, clientY) {
  if (!started || solved || sliding) return;
  const f = dbgFrame();
  const tx = Math.floor((clientX - f.ox) / f.S), ty = Math.floor((clientY - f.oy) / f.S);
  const R2 = CONFIG.debugTapReach;
  let best = null, bd = Infinity;
  for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) {
    const x = tx + dx, y = ty + dy, d = dx*dx + dy*dy;
    if (d >= bd || !isOpen(x, y) || (x === exit.x && y === exit.y)) continue;
    bd = d; best = [x, y];
  }
  if (!best) return;
  player.x = best[0] + 0.5; player.y = best[1] + 0.5; cam.x = player.x; cam.y = player.y;
  dir = null; recenter = null; pendingTurn = null; pushHeldSince = 0; clearStick();
  AUDIO.step(tunnelTiles.has(best.join(',')));
}
const dbgPtrs = new Map(); let dbgPinch = null, dbgPress = null;
cv.addEventListener('pointerdown', e => {
  if (!debugMap || !started || dbg.classList.contains('show') || performance.now() - dbgClosedAt < 100) return;   // the panel closes on this same tap, in an earlier capture-phase listener
  dbgPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  cv.setPointerCapture(e.pointerId);
  if (dbgPtrs.size === 1) dbgPress = { id: e.pointerId, moved: 0 };
  else { dbgPress = null; const [a, b] = [...dbgPtrs.values()]; dbgPinch = { d: Math.hypot(a.x-b.x, a.y-b.y) || 1, S: dbgHold().S }; }
});
cv.addEventListener('pointermove', e => {
  const prev = dbgPtrs.get(e.pointerId); if (!prev) return;
  const cur = { x: e.clientX, y: e.clientY };
  if (dbgPtrs.size === 1) dbgPan(cur.x - prev.x, cur.y - prev.y);
  if (dbgPress && e.pointerId === dbgPress.id) dbgPress.moved += Math.hypot(cur.x - prev.x, cur.y - prev.y);
  dbgPtrs.set(e.pointerId, cur);
  if (dbgPtrs.size === 2 && dbgPinch) { const [a, b] = [...dbgPtrs.values()];
    dbgZoomAt(dbgPinch.S * Math.hypot(a.x-b.x, a.y-b.y) / dbgPinch.d, (a.x+b.x)/2, (a.y+b.y)/2); }
});
const dbgUp = e => {
  if (e.type === 'pointerup' && dbgPress && e.pointerId === dbgPress.id && dbgPtrs.size === 1 && dbgPress.moved < CONFIG.debugTapSlop) dbgTeleport(e.clientX, e.clientY);
  dbgPtrs.delete(e.pointerId); if (dbgPtrs.size < 2) dbgPinch = null; if (!dbgPtrs.size) dbgPress = null;
};
cv.addEventListener('pointerup', dbgUp); cv.addEventListener('pointercancel', dbgUp);
cv.addEventListener('wheel', e => { if (!debugMap || !started) return; dbgZoomAt(dbgHold().S * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX, e.clientY); });

const keys = {};
addEventListener('keydown', e => { keys[e.key] = true; if (e.key === '`') setDebugMap(!debugMap); });
addEventListener('keyup', e => keys[e.key] = false);

function enterMaze() {   // fade from black into the room, asleep; tapping the sleeper begins the run
  const fade = $('fade'); fade.className = 'in'; $('msg').classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => { fade.className = 'out'; }));
}
function wake() {   // the zoom-out: HUD slides in, then the figure gets up
  if (intro || started) return;
  AUDIO.begin();
  const lift = SAVE.lifted != null;   // you put a burden down at the last pool; this waking says so
  if (lift) { delete SAVE.lifted; persist(); AUDIO.lifted(); liftGlow = CONFIG.liftGlowFrom; } else AUDIO.wake();
  const secs = lift ? CONFIG.liftIntroSeconds : CONFIG.introSeconds;
  intro = { t0: performance.now(), from: zoomS, lift };
  $('title').classList.add('leaving'); $('howPanel').classList.remove('open'); $('howBtn').classList.remove('open');
  setTimeout(() => document.body.classList.remove('pre'), secs * 400);
  setTimeout(() => {
    $('title').classList.add('hide'); started = true; t0 = gameNow(); narrNext = Infinity; $('mapBtn').classList.add('beckon');
    introWalk = { dx: 0, dy: -1 };   // and stands up off the mat
    if (character.leave && !(SAVE.wakeSaid || []).includes(character.name) && !poolMode) setTimeout(() => narrate(character.wake), 900);
  }, secs * 1000);
}
cv.addEventListener('pointerdown', e => {
  if (started || intro || $('title').classList.contains('hide')) return;
  const px = viewOx + player.x * viewS, py = viewOy + player.y * viewS;
  if (Math.hypot(e.clientX - px, e.clientY - py) < viewS * 0.9) { wake(); return; }
  if ($('howPanel').classList.contains('open')) { $('howPanel').classList.remove('open'); $('howBtn').classList.remove('open'); }
});
$('howBtn').addEventListener('click', () => { const o = $('howPanel').classList.toggle('open'); $('howBtn').classList.toggle('open', o); AUDIO.paper(); });
$('refreshBtn').addEventListener('click', () => hardRefresh({ set textContent(v) {} }));
$('again').addEventListener('click', () => { if (SAVE.finished && phase().who === 'You') { SAVE.phase = 0; SAVE.stones = 0; SAVE.finished = false; SAVE.collected = {}; SAVE.wakeSaid = []; persist(); } reset((Math.random()*1e9)|0); enterMaze(); });

// shelf positions: left wall (4) and bottom wall (3) — never the top row or right column, where the slider lives
const SHELF_SPOTS = (x0, y0, y1) => [ [x0, y0+1, 'v'], [x0, y0+2, 'v'], [x0, y0+3, 'v'], [x0, y1, 'v'], [x0+1, y1, 'h'], [x0+2, y1, 'h'], [x0+3, y1, 'h'] ];
// a lock/key shape
function drawShape(c, shape, px, py, r, color, lw) { c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'round'; c.beginPath();
  if (shape === 'circle') c.arc(px, py, r, 0, Math.PI*2); else if (shape === 'triangle') { c.moveTo(px, py - r); c.lineTo(px + r*0.95, py + r*0.7); c.lineTo(px - r*0.95, py + r*0.7); c.closePath(); } else c.rect(px - r*0.85, py - r*0.85, r*1.7, r*1.7);
  c.stroke(); }
// the burden itself, drawn as an outline so it reads on a gate the way a lock shape does
function drawStone(c, px, py, r, color) {
  c.save(); c.strokeStyle = color; c.fillStyle = CONFIG.colors.bg; c.lineWidth = Math.max(1.5, r * 0.28); c.lineJoin = 'round';
  c.beginPath(); c.ellipse(px, py + r*0.12, r, r*0.72, 0.22, 0, Math.PI*2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(px - r*0.3, py - r*0.22, r*0.3, r*0.17, 0.22, 0, Math.PI*2); c.stroke();
  c.restore();
}
// somebody drew a man, from behind, mid-stride, going away. Chalk, a child's hand.
function drawChalkMan(c, px, py, a, lw) {
  c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  c.arc(px, py - a * 0.62, a * 0.26, 0, Math.PI * 2);                       // head
  c.moveTo(px, py - a * 0.36); c.lineTo(px, py + a * 0.18);                 // body
  c.moveTo(px - a * 0.34, py - a * 0.14); c.lineTo(px, py - a * 0.28);      // arms, both swung back
  c.moveTo(px + a * 0.34, py - a * 0.06); c.lineTo(px, py - a * 0.28);
  c.moveTo(px - a * 0.3, py + a * 0.78); c.lineTo(px, py + a * 0.18);       // legs, mid-stride
  c.lineTo(px + a * 0.26, py + a * 0.8);
  c.stroke();
}
// draw a chalk glyph centered at px,py with half-size a
function drawGlyph(c, g, px, py, a, lw) {
  c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  if (g === 'x') { c.moveTo(px-a, py-a); c.lineTo(px+a, py+a); c.moveTo(px+a, py-a); c.lineTo(px-a, py+a); }
  else if (g === '?') { c.arc(px, py - a*0.45, a*0.55, Math.PI*1.1, Math.PI*2.35); c.lineTo(px, py + a*0.3); c.moveTo(px, py + a*0.85); c.lineTo(px, py + a*0.9); }
  else { const d = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[g] || [0,-1]; const hx = px + d[0]*a, hy = py + d[1]*a, tx = px - d[0]*a, ty = py - d[1]*a;
    c.moveTo(tx, ty); c.lineTo(hx, hy); const w = a*0.55; c.moveTo(hx - d[0]*w - d[1]*w, hy - d[1]*w + d[0]*w); c.lineTo(hx, hy); c.lineTo(hx - d[0]*w + d[1]*w, hy - d[1]*w - d[0]*w); }
  c.stroke();
}

