// The Maze — run state, the debug panel, hard refresh
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── state ───────────────────────────────────────────────────────
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let player, cam, steps = 0, t0 = 0, solved = false, debugMap = false, started = false;
let marks = new Map();   // 'x,y' → glyph: 'x' | '?' | 'up' | 'right' | 'down' | 'left'
let chalk = 0, chalkUsed = 0, chalkFound = 0, deadEndsEntered = 0;
let charcoal = 0, charcoalLeft = 0, charcoalUsed = 0, charcoalFound = 0, charcoalOn = false;   // charcoalLeft: tiles of mapping remaining on the active piece
let visited = new Set();   // every tile you've stood on this run
let mapped = new Map();   // 'x,y' → 'floor' | 'wall' | 'tunnel' — everything the map knows
let pointerUntil = 0, pathUntil = 0, pointerUses = 0, pathUses = 0;
let hasKey = false, hasLamp = false, lampOn = false;
let dir = null, held = null;
let facing = -Math.PI/2, facingShown = -Math.PI/2;
let lastTileKey = '';
let sliding = null;   // {sl, from:[x,y], to:[x,y], t0}
let pushHeldSince = 0;
let pendingTurn = null;   // {dx,dy,until}: a perpendicular push that wasn't possible yet   // how long you've leaned into a slider's edge
let idleSince = 0, firstPushDone = false, crawlSaid = false, hopIdx = 0, hopSaid = false, tttSaid = false, secretSaid = false;
let secretOn = false, secretLitAt = 0;   // the switch has been stood on, and when
let liftBand = -1, liftBandAmt = 1;   // which band of him is going pale on this waking, and how far
let zoomS = 150, intro = null, introWalk = null;   // intro: {t0} while zooming out; introWalk: scripted first step
let darkAmt = 0;   // 0 lit … 1 fully in the dark; eased per frame
let inSqueeze = false, camBump = 0;   // camBump: a small vertical kick, decays
let viewS = CONFIG.tilePx, viewOx = 0, viewOy = 0;
let dbgView = null;   // the Full map debug view once you pan or zoom it: {cx, cy, S}. null = fitted to the screen
let narrNext = 0, narrHideAt = 0, narrQueue = [], journalsRead = 0, pagesThisRun = [], leftRoom = false, shelfSaid = false, shelfStandKey = '', shelfStandAt = 0, shelfShown = '';
const $ = id => document.getElementById(id);
const chalkEl = $('chalk'), charcoalEl = $('charcoal'), fxEl = $('fx'), keyEl = $('key'), narrEl = $('narr');
$('verDbg').textContent = 'v' + VERSION; $('verTitle').textContent = 'v' + VERSION;

function pulse(el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
function keyGlyph(shape, color) { const c = color || '#e0c98a'; return shape === 'circle' ? `<circle cx="11" cy="11" r="6" fill="none" stroke="${c}" stroke-width="2.4"/>` : shape === 'triangle' ? `<path d="M11 4l7 13H4z" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/>` : `<rect x="5" y="5" width="12" height="12" fill="none" stroke="${c}" stroke-width="2.4"/>`; }
function renderKeys() { $('keys').innerHTML = [...heldKeys].map(sh => `<svg viewBox="0 0 22 22">${keyGlyph(sh)}</svg>`).join(''); }
function updateChalk() { $('chalkN').textContent = chalk; chalkEl.classList.toggle('empty', chalk === 0); }
// one thin bar per page this maze holds, filling in as you find them: how many there are to get,
// and how many you have, without a number to read
function updateBooks() {
  const got = pagesThisRun.length, total = journals.size + got;
  const el = $('books');
  if (el.childElementCount !== total) { el.innerHTML = ''; for (let i = 0; i < total; i++) el.appendChild(document.createElement('i')); }
  [...el.children].forEach((b, i) => b.classList.toggle('got', i < got));
}
function updateCharcoal() {
  charcoalEl.style.display = phase().f.charcoal ? '' : 'none';
  $('mapBtn').style.display = (phase().f.charcoal || phase().f.scraps) && !poolMode ? '' : 'none';
  // while a piece is in hand the stick itself drains; otherwise show how many whole pieces you carry
  charcoalEl.querySelector('i').style.setProperty('--fill', (charcoalLeft > 0 ? charcoalLeft / B.charcoal() * 100 : 100) + '%');
  $('charcoalN').textContent = charcoalLeft > 0 ? (charcoal > 0 ? '+' + charcoal : '') : String(charcoal);
  charcoalEl.classList.toggle('active', charcoalOn && charcoalLeft > 0);
  charcoalEl.classList.toggle('paused', !charcoalOn && charcoalLeft > 0);
  charcoalEl.classList.toggle('empty', charcoalLeft <= 0 && charcoal === 0);
}
function useCharcoal() {
  if (solved || !started || sliding || paused) return;
  if (charcoalLeft > 0) { charcoalOn = !charcoalOn; if (charcoalOn) { charcoalLeft = Math.max(0, charcoalLeft - mapHere()); AUDIO.charcoalStart(); } else AUDIO.charcoalEnd(); }   // pause / resume the piece in hand
  else if (charcoal > 0) { charcoal--; charcoalUsed++; charcoalLeft = B.charcoal(); charcoalOn = true; charcoalLeft = Math.max(0, charcoalLeft - mapHere()); AUDIO.charcoalStart(); }
  else { AUDIO.chalkEmpty(); charcoalEl.classList.remove('shake'); void charcoalEl.offsetWidth; charcoalEl.classList.add('shake'); }
  updateCharcoal();
}
// record the tile you're on and what's adjacent: floors you could step to, walls you can see
// a scrap of map: BFS out from a tile until a share of the floor is charted (walls around it too)
function revealAround(cx, cy) {
  let openN = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x]) openN++;
  // a scrap is a torn piece of paper, not a fraction of the maze: the same share of a medium map
  // is half an X-Large one. Divide by the area multiplier so a big maze gets a patch, not a quarter.
  const area = (CONFIG.cols * CONFIG.rows) / (14 * 20);
  const share = Math.max(CONFIG.mapScrapMinShare, Math.min(CONFIG.mapScrapShare, CONFIG.mapScrapShare / area));
  const target = Math.floor(openN * share), seen = new Set([cx+','+cy]), q = [[cx, cy]];
  const tag = (x, y) => mapped.set(x+','+y, !isOpen(x, y) ? 'wall' : tunnelTiles.has(x+','+y) ? 'tunnel' : 'floor');
  while (q.length && seen.size < target) { const [x, y] = q.shift(); tag(x, y);
    for (const [dx, dy] of DIRS) { const nx = x+dx, ny = y+dy, k = nx+','+ny; if (isOpen(nx, ny)) { if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); } } else tag(nx, ny); }
    for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) if (!isOpen(x+dx, y+dy)) tag(x+dx, y+dy); }
}
function mapHere() {   // returns how many floor tiles were new to the map
  const cx = Math.floor(player.x), cy = Math.floor(player.y); let added = 0;
  const tag = (x, y) => { const k = x+','+y, v = !isOpen(x, y) ? 'wall' : tunnelTiles.has(k) ? 'tunnel' : 'floor'; if (v !== 'wall' && (!mapped.has(k) || mapped.get(k) === 'wall')) added++; mapped.set(k, v); };
  tag(cx, cy);
  for (const [dx, dy] of DIRS) { tag(cx+dx, cy+dy); if (isOpen(cx+dx, cy+dy)) for (const [ex, ey] of DIRS) if (!isOpen(cx+dx+ex, cy+dy+ey)) tag(cx+dx+ex, cy+dy+ey); }
  for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) if (!isOpen(cx+dx, cy+dy)) tag(cx+dx, cy+dy);
  return added;
}
function useChalk(glyph) {
  if (solved || !started || sliding || paused) return;
  const key = Math.floor(player.x) + ',' + Math.floor(player.y);
  if (marks.has(key)) return;   // already marked
  if (chalk <= 0) { AUDIO.chalkEmpty(); chalkEl.classList.remove('shake'); void chalkEl.offsetWidth; chalkEl.classList.add('shake'); return; }
  if (!glyph) { if (!phase().f.signs) glyph = 'x'; else { $('glyphs').classList.toggle('show'); return; } }   // early on, chalk only makes an X
  marks.set(key, glyph); chalk--; chalkUsed++; AUDIO.chalkDown(); $('glyphs').classList.remove('show'); saveRun(true);
  updateChalk();
}
function reset(seed) {
  SEED = seed; generate(SEED); started = false; dbgView = null; AUDIO.setMusic(poolMode ? 'pool' : character.name); zoomS = CONFIG.titleTilePx; intro = null; introWalk = null;
  // a burden came off at the last pool: you wake in the light you had before, not the one you have now
  liftBand = (SAVE.lifted != null) ? SAVE.lifted : -1; liftBandAmt = liftBand >= 0 ? 0 : 1; liftGlow = liftBand >= 0 ? CONFIG.liftGlowFrom : 1; document.body.classList.add('pre'); $('title').classList.remove('hide', 'leaving'); $('howPanel').classList.remove('open'); $('howBtn').classList.remove('open');
  player = { ...start }; cam = { ...start };
  steps = 0; t0 = gameNow(); solved = false; dir = null; held = null; sliding = null; recenter = null; darkAmt = 0; idleSince = gameNow(); firstPushDone = false; facing = facingShown = -Math.PI/2;
  marks = new Map(); lastTileKey = ''; chalk = CONFIG.chalkStart; chalkUsed = chalkFound = deadEndsEntered = 0;
  pointerUntil = pathUntil = 0; pointerUses = pathUses = 0; leftRoom = false; shelfSaid = false; pagesThisRun = []; heldKeys = new Set(); renderKeys(); crawlSaid = false; hopIdx = 0; hopSaid = false; tttSaid = false; secretSaid = false; secretOn = false; secretLitAt = 0; figureLinesSaid = 0; hasKey = false; $('stone').classList.remove('show'); hasLamp = false; lampOn = false; $('lamp').classList.remove('show', 'on'); journalsRead = 0;
  charcoal = CONFIG.charcoalStart; charcoalLeft = 0; charcoalOn = false; charcoalUsed = charcoalFound = 0; mapped = new Map(); visited = new Set(); updateCharcoal();
  if (startRoom) { const { x0, y0, x1, y1 } = startRoom; for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) mapped.set(x+','+y, isOpen(x, y) ? 'floor' : 'wall'); }   // home is always on the map keyEl.classList.remove('show');
  { const mine = SELF_LINES[character.name] || SELF_LINES['You'];
    let fresh = mine.filter(l => !SAVE.narrPlayed.includes(l));
    if (fresh.length < 2) { SAVE.narrPlayed = SAVE.narrPlayed.filter(l => !mine.includes(l)); fresh = mine.slice(); }
    narrQueue = fresh.sort(() => Math.random() - 0.5); }
  narrNext = gameNow() + CONFIG.narratorFirstSec * 1000; narrEl.classList.remove('show');
  updateChalk(); updateBooks();
  $('seedLbl').textContent = 'seed ' + SEED; $('stepLbl').textContent = '';
  $('msg').classList.remove('show');
}

