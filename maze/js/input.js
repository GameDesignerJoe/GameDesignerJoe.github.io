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
  if (len / KNOB_MAX < CONFIG.stickDeadzone) { held = null; return; }
  held = Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) };
}
function clearStick() { held = null; stickId = null; stickEl.classList.remove('on'); knob.style.transform = ''; }
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
$('gear').addEventListener('pointerdown', e => { e.stopPropagation(); dbg.classList.toggle('show'); });
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveRun(true); });
addEventListener('pagehide', () => saveRun(true));
setInterval(() => saveRun(true), 6000);
document.addEventListener('pointerdown', e => { if (dbg.classList.contains('show') && !dbg.contains(e.target) && !$('gear').contains(e.target)) { dbg.classList.remove('show'); dbgClosedAt = performance.now(); } }, true);
dbg.addEventListener('pointerdown', e => e.stopPropagation());
opt.map.addEventListener('change', () => setDebugMap(opt.map.checked));   // always opens fitted, so untick and tick to get the fit back
$('optSize').value = SAVE.ui.size || 'auto'; $('optBranch').value = SAVE.ui.branch || 'auto'; $('optBraid').value = SAVE.ui.braid || 'auto'; $('optTurns').value = SAVE.ui.turns || 'auto'; $('optClusters').value = SAVE.ui.clusters || 'auto';
$('optTurns').addEventListener('change', () => { SAVE.ui.turns = $('optTurns').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optClusters').addEventListener('change', () => { SAVE.ui.clusters = $('optClusters').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optBranch').addEventListener('change', () => { SAVE.ui.branch = $('optBranch').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optBraid').addEventListener('change', () => { SAVE.ui.braid = $('optBraid').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optSize').addEventListener('change', () => { SAVE.ui.size = $('optSize').value; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
PHASES.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = i + ' · ' + p.who; $('optPhase').appendChild(o); });
for (let i = 0; i <= STONES.length; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i + ' put down'; $('optStones').appendChild(o); }
$('optPhase').value = SAVE.phase || 0; $('optStones').value = SAVE.stones || 0;
$('optPhase').addEventListener('change', () => { SAVE.phase = +$('optPhase').value; SAVE.poolPending = false; delete SAVE.run; persist(); reset((Math.random()*1e9)|0); dbg.classList.remove('show'); enterMaze(); });
$('optStones').addEventListener('change', () => { SAVE.stones = +$('optStones').value; persist(); });
function applyStick() { document.body.classList.toggle('stick-left', (SAVE.ui.stick || 'right') === 'left'); $('optStick').value = SAVE.ui.stick || 'right'; }
$('optStick').addEventListener('change', () => { SAVE.ui.stick = $('optStick').value; persist(); applyStick(); }); applyStick();
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


