// The Maze — the stick, chalk, charcoal, lamp, gear
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── input ───────────────────────────────────────────────────────
const stickEl = $('stick'), knob = $('knob');
const KNOB_MAX = 54; let stickId = null;
function stickCenter() { const b = stickEl.getBoundingClientRect(); return { x: b.left + b.width/2, y: b.top + b.height/2 }; }
function setStick(clientX, clientY) {
  const c = stickCenter(); const dx = clientX - c.x, dy = clientY - c.y;
  const len = Math.hypot(dx, dy) || 1, k = Math.min(len, KNOB_MAX);
  knob.style.transform = `translate(${dx/len*k}px, ${dy/len*k}px)`;
  if (len / KNOB_MAX < CONFIG.stickDeadzone) { held = null; stickAim = null; return; }
  held = Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) };
  // the raw direction as well as the squared-off one: corridors want the axis, a room wants the
  // way you are actually pointing
  stickAim = { x: dx / len, y: dy / len };
}
function clearStick() { held = null; stickAim = null; stickId = null; stickEl.classList.remove('on'); knob.style.transform = ''; }
stickEl.addEventListener('pointerdown', e => { if ($('dbg').classList.contains('show')) return; stickId = e.pointerId; stickEl.classList.add('on'); stickEl.setPointerCapture(e.pointerId); setStick(e.clientX, e.clientY); e.preventDefault(); });
stickEl.addEventListener('pointermove', e => { if (e.pointerId === stickId) setStick(e.clientX, e.clientY); });
stickEl.addEventListener('pointerup', clearStick); stickEl.addEventListener('pointercancel', clearStick);

chalkEl.addEventListener('pointerdown', e => { e.stopPropagation(); useChalk(); });
$('glyphs').addEventListener('pointerdown', e => { e.stopPropagation(); const g = e.target.closest('[data-g]'); if (g) useChalk(g.dataset.g); });
cv.addEventListener('pointerdown', () => $('glyphs').classList.remove('show'));
charcoalEl.addEventListener('pointerdown', e => { e.stopPropagation(); useCharcoal(); });
$('lamp').addEventListener('pointerdown', e => { e.stopPropagation(); if (!hasLamp || paused || solved) return; lampOn = !lampOn; $('lamp').classList.toggle('on', lampOn); lampOn ? AUDIO.lampOn() : AUDIO.lampOff(); });

const dbg = $('dbg'), opt = { arrow: $('optArrow'), path: $('optPath'), map: $('optMap') };
let dbgClosedAt = 0;   // when a tap outside the panel dismissed it. That same tap must not also teleport you
$('gear').addEventListener('pointerdown', e => { e.stopPropagation(); dbg.classList.toggle('show'); if (dbg.classList.contains('show')) syncLevel(); });
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveRun(true); });
addEventListener('pagehide', () => saveRun(true));
setInterval(() => saveRun(true), 6000);
document.addEventListener('pointerdown', e => { if (dbg.classList.contains('show') && !dbg.contains(e.target) && !$('gear').contains(e.target)) { dbg.classList.remove('show'); dbgClosedAt = performance.now(); } }, true);
dbg.addEventListener('pointerdown', e => e.stopPropagation());
opt.map.addEventListener('change', () => setDebugMap(opt.map.checked));   // always opens fitted, so untick and tick to get the fit back
$('optSize').value = SAVE.ui.size || 'auto'; $('optBranch').value = SAVE.ui.branch || 'auto'; $('optBraid').value = SAVE.ui.braid || 'auto'; $('optTurns').value = SAVE.ui.turns || 'auto'; $('optClusters').value = SAVE.ui.clusters || 'auto'; $('optTexture').value = SAVE.ui.texture || 'off'; $('optFloor').value = SAVE.ui.floor || 'wornlights'; $('optProto').value = SAVE.ui.proto || 'off';
$('optTurns').addEventListener('change', () => { SAVE.ui.turns = $('optTurns').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optClusters').addEventListener('change', () => { SAVE.ui.clusters = $('optClusters').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optBranch').addEventListener('change', () => { SAVE.ui.branch = $('optBranch').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optBraid').addEventListener('change', () => { SAVE.ui.braid = $('optBraid').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optSize').addEventListener('change', () => { SAVE.ui.size = $('optSize').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
// One Level menu: the eight characters with the pool that comes after each of them, in the order
// you meet them. There used to be a Phase menu and a separate Pool room menu, and between them a
// level could be selected while poolPending was still set from somewhere else — you asked for a
// character and got the water. Every pick here sets all of it: phase, stones, pool or not, and
// Prototype off, so nothing can be left over from the last one.
//
// A character level is entered with the stones you would have put down by then; a pool with the
// next one still in your arms. Both are the phase index, which is what makes the interleave work.
const LEVELS = [];
PHASES.forEach((p, i) => {
  LEVELS.push({ label: i + ' · ' + p.who, phase: i, stones: i, pool: false });
  if (i < STONES.length) LEVELS.push({ label: '↳ pool · ' + STONES[i], phase: i, stones: i, pool: true });
});
LEVELS.forEach((L, i) => { const o = document.createElement('option'); o.value = i; o.textContent = L.label; $('optLevel').appendChild(o); });
for (let i = 0; i <= STONES.length; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i + ' put down'; $('optStones').appendChild(o); }
// the menu says where you actually are, every time it is opened: the game moves on by itself
// after a pool, and a menu showing the wrong level would make the next pick a silent no-op
function syncLevel() {
  const ph = Math.min(PHASES.length - 1, SAVE.phase || 0);
  let i = LEVELS.findIndex(L => L.phase === ph && L.pool === !!SAVE.poolPending);
  if (i < 0) i = LEVELS.findIndex(L => L.phase === ph && !L.pool);
  $('optLevel').value = i; $('optStones').value = Math.min(STONES.length, SAVE.stones || 0);
}
syncLevel();
$('optLevel').addEventListener('change', () => {
  const L = LEVELS[+$('optLevel').value]; if (!L) return;
  SAVE.phase = L.phase; SAVE.stones = L.stones; SAVE.poolPending = L.pool;
  SAVE.ui.proto = 'off'; $('optProto').value = 'off'; $('optStones').value = L.stones;
  delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze();
});
$('optStones').addEventListener('change', () => { SAVE.stones = +$('optStones').value; persist(); });
// Zoom is pure view: no reset, no new maze, so you can drag it while you walk and watch it move.
// All the way in is the three tiles around you; all the way out is twice the ground you normally see.
function applyZoom(save) {
  const v = zoomMul();
  $('optZoom').value = v; $('zoomLbl').textContent = v.toFixed(2).replace(/0$/, '') + 'x';
  SAVE.ui.zoom = v; if (save) persist();
}
$('optZoom').addEventListener('input', () => { SAVE.ui.zoom = +$('optZoom').value; applyZoom(false); });
$('optZoom').addEventListener('change', () => { SAVE.ui.zoom = +$('optZoom').value; applyZoom(true); });
applyZoom(false);

function applyStick() { document.body.classList.toggle('stick-left', (SAVE.ui.stick || 'right') === 'left'); $('optStick').value = SAVE.ui.stick || 'right'; }
$('optStick').addEventListener('change', () => { SAVE.ui.stick = $('optStick').value; persist(); applyStick(); }); applyStick();
// texture is pure paint — no reset, no new maze, so you can flick between them and look
$('optTexture').addEventListener('change', () => { SAVE.ui.texture = $('optTexture').value; persist(); });
// a prototype replaces the maze entirely, so it needs a fresh one
$('optProto').addEventListener('change', () => { SAVE.ui.proto = $('optProto').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optFloor').addEventListener('change', () => { SAVE.ui.floor = $('optFloor').value; persist(); });
// the run log: what you have finished, how long each took, and a CSV of the lot to take away
$('statsBtn').addEventListener('click', () => { dbg.classList.remove('show'); showStats(); });
$('statsClose').addEventListener('click', () => $('stats').classList.remove('show'));
$('statsCopy').addEventListener('click', async () => {
  const csv = statsCsv(); const b = $('statsCopy');
  try { await navigator.clipboard.writeText(csv); b.textContent = 'Copied'; }
  catch (e) { b.textContent = 'Could not copy'; }
  setTimeout(() => { b.textContent = 'Copy CSV'; }, 1400);
});
$('statsClear').addEventListener('click', () => {
  const b = $('statsClear');
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Clear every run? Tap again'; setTimeout(() => { b.dataset.sure = '0'; b.textContent = 'Clear the log'; }, 3200); return; }
  clearLog(); b.dataset.sure = '0'; b.textContent = 'Clear the log'; showStats();
});
$('optSound').checked = CONFIG.sound;
$('optSound').addEventListener('change', () => AUDIO.setEnabled($('optSound').checked));
$('resetSave').addEventListener('click', () => {
  const b = $('resetSave');
  if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to erase'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Reset save'; }, 3000); return; }
  SAVE = { collected: {}, charCycle: [], narrPlayed: [], shelfPlayed: [], tutorials: [], ui: SAVE.ui, phase: 0, stones: 0, poolPending: false, finished: false }; delete SAVE.run; try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  b.dataset.armed = ''; b.textContent = 'Save erased';
  setTimeout(() => b.textContent = 'Reset save', 1500);
});
function hardRefresh(btn) {
  btn.textContent = 'Updating…';
  // Come back on the mat, asleep, rather than where you were standing. An
  // update that drops you mid-corridor never gives you the title tap, and the
  // tap is what starts the sound. Everything done is kept; only the position
  // and the "already awake" go.
  parkRunAtHome();
  // ask the network for a fresh copy (bounded), then reload with a cache-busting stamp that we strip again on load
  const timeout = new Promise(r => setTimeout(r, 2500));
  Promise.race([fetch(location.pathname, { cache: 'reload' }).catch(() => {}), timeout])
    .then(() => location.replace(location.pathname + '?u=' + Date.now()));
}
// Reroll the maze without touching what you have done. Same phase, same stones, same pages
// found — a new seed. Every dropdown here already rerolls; this is the one that changes
// nothing else. `?seed=1234` in the URL replays a particular maze.
$('newMaze').addEventListener('click', () => { delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('update').addEventListener('click', () => hardRefresh($('update')));
// A resumed run skips the title and its tap, so nothing has unlocked the audio
// context or started the drone — every reload used to come back silent. Take
// the first gesture, whatever it is. begin() is idempotent, so on a fresh run
// where wake() already did it this is a no-op.
addEventListener('pointerdown', () => AUDIO.begin(), { once: true });


