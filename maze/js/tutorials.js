// The Maze — the helper cards, in the player’s own voice
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── first-find tutorials ────────────────────────────────────────
const ICONS = {
  chalk:    '<svg viewBox="0 0 44 44"><rect x="14" y="19" width="22" height="7" rx="2" fill="#ece7da" transform="rotate(-35 22 22)"/></svg>',
  charcoal: '<svg viewBox="0 0 44 44"><rect x="10" y="18" width="24" height="9" rx="1.5" fill="#3a3d3f" stroke="#a89f8c" stroke-width="1.2" transform="rotate(28 22 22)"/></svg>',
  pointer:  '<svg viewBox="0 0 44 44"><path d="M22 8l6 20-6-4-6 4z" fill="#c9b98a"/></svg>',
  path:     '<svg viewBox="0 0 44 44" fill="none" stroke="#b9b4a8" stroke-width="2"><path d="M22 22m-2 0a2 2 0 1 0 4 0a4 4 0 1 0-8 0a6 6 0 1 0 12 0a8 8 0 1 0-16 0a10 10 0 1 0 20 0a12 12 0 1 0-24 0"/></svg>',
  key:      '<svg viewBox="0 0 44 44" fill="none" stroke="#e0c98a" stroke-width="3" stroke-linecap="round"><circle cx="15" cy="22" r="7"/><path d="M22 22h14M31 22v6M36 22v5"/></svg>',
  page:     '<svg viewBox="0 0 44 44"><path d="M8 13l14 5 14-5v18l-14 5-14-5z" fill="#b8b0a0"/><path d="M22 18v18" stroke="#0d0f10" stroke-width="1.6"/></svg>',
  scrap:    '<svg viewBox="0 0 44 44"><path d="M10 12l18-4 6 20-14 6-8-6z" fill="#5a5750"/><path d="M16 18h10M18 25h12" stroke="#1b1f21" stroke-width="1.4"/></svg>',
  door:     '<svg viewBox="0 0 44 44" fill="none" stroke="#e0c98a" stroke-width="3" stroke-linecap="round"><circle cx="14" cy="22" r="6"/><path d="M20 22h14M31 22v5"/></svg>',
  lamp:     '<svg viewBox="0 0 44 44"><path d="M17 6h10l4 11H13zM15 17h14v4l-3 4H18l-3-4zM19 25h6v7h-6zM19.5 32h5l1 6h-7z" fill="none" stroke="#e8d9a0" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  slider:   '<svg viewBox="0 0 44 44"><rect x="8" y="8" width="28" height="28" fill="#6e6a62"/><rect x="33" y="8" width="3" height="28" fill="#1b1f21"/><path d="M18 22h10m-4-4l4 4-4 4" fill="none" stroke="#ece7da" stroke-width="2" stroke-linecap="round"/></svg>',
};
let paused = false, pauseStart = 0, pausedTotal = 0;
function gameNow() { return (paused ? pauseStart : performance.now()) - pausedTotal; }   // stops while a helper card is open
function tutorial(kind, delayMs = 450) {
  if (!CONFIG.tutorials || SAVE.tutorials.includes(kind)) return;
  SAVE.tutorials.push(kind); persist();
  const t = TUTORIALS[kind];
  $('tutIcon').innerHTML = ICONS[kind].replace('<svg ', '<svg class="icon" '); $('tutTitle').textContent = t.title; $('tutWhy').textContent = t.why; $('tutHow').textContent = t.how;
  paused = true; pauseStart = performance.now(); clearStick(); dir = null;
  AUDIO.paper();
  setTimeout(() => { $('tut').classList.remove('fold'); $('tut').classList.add('show'); AUDIO.unfold(); }, delayMs);   // a beat of stillness, then it opens
}
$('tutClose').addEventListener('click', () => {
  const tut = $('tut'); if (tut.classList.contains('fold')) return;
  tut.classList.add('fold'); AUDIO.unfold();
  setTimeout(() => { tut.classList.remove('show', 'fold'); }, 560);
  pausedTotal += performance.now() - pauseStart; paused = false;
});


let figureLinesSaid = 0;
function walkable(x0, y0, x1, y1, maxSteps) {   // can you walk from tile (x0,y0) to (x1,y1) in maxSteps or fewer?
  const seen = new Set([x0+','+y0]), q = [[x0, y0, 0]];
  while (q.length) { const [x, y, d] = q.shift(); if (x === x1 && y === y1) return true; if (d >= maxSteps) continue;
    for (const [dx, dy] of DIRS) { const k = (x+dx)+','+(y+dy); if (isOpen(x+dx, y+dy) && !seen.has(k)) { seen.add(k); q.push([x+dx, y+dy, d+1]); } } }
  return false;
}
function updateFigures(now, dt) {
  const lit = B.viewRadius() * 2 + CONFIG.fogSoftness;
  // Only one father is ever drawn. Six are placed, but two or three in sight at once reads
  // as a crowd rather than as the one man who keeps leaving. The nearest is the one you see;
  // anyone already dissolving keeps showing so he can finish going.
  { let near = null, nd = Infinity;
    for (const f of figures) { if (f.gone) continue; const d = Math.hypot(f.x - player.x, f.y - player.y); if (d < nd) { nd = d; near = f; } }
    for (const f of figures) f.hidden = f !== near && !f.fading; }
  for (const f of figures) {
    if (f.gone) continue;
    const d = Math.hypot(f.x - player.x, f.y - player.y);
    if (!f.seen && !f.hidden && d < lit) { f.seen = true; AUDIO.farSteps(); if (character.name === 'The Child' && figureLinesSaid < 3 && Math.random() < 0.6) { figureLinesSaid++; narrate(FIGURE_LINES[Math.random() * FIGURE_LINES.length | 0]); } }
    // he only goes when you've actually come for him: near, and nothing but floor between you
    if (!f.hidden && d < 2.6 && walkable(Math.floor(player.x), Math.floor(player.y), Math.floor(f.x), Math.floor(f.y), 4)) f.fading = true;
    if (f.fading) { f.alpha -= dt * 3; if (f.alpha <= 0) { f.gone = true; f.alpha = 0; } }
  }
}

