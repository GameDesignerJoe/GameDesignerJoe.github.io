// The Maze — the reader for pages already found
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── stories screen ──────────────────────────────────────────────
const storiesEl = $('stories'), storiesClose = $('storiesClose');
function renderStories() {
  $('storiesList').innerHTML = CAST.map((c, ci) => { if (!c.pages.length) return '';
    const got = SAVE.collected[c.name] || [];
    const boxes = c.pages.map((_, i) => `<div class="box ${got[i] ? 'got' : ''}" data-c="${ci}" data-p="${i}"></div>`).join('');
    return `<div class="who"><div class="name"><span data-c="${ci}">${c.name}</span><span>${collectedCount(c.name)} of ${c.pages.length}</span></div><div class="boxes">${boxes}</div></div>`;
  }).join('');
}
function readPage(ci, pi) {
  const c = CAST[ci];
  $('reader').innerHTML = `<div class="who">${c.name} · page ${pi+1} of ${c.pages.length}</div><p>${c.pages[pi]}</p>`;
  storiesEl.querySelectorAll('.box.sel').forEach(b => b.classList.remove('sel'));
  storiesEl.querySelector(`.box[data-c="${ci}"][data-p="${pi}"]`)?.classList.add('sel');
  storiesEl.scrollTo({ top: 0, behavior: 'smooth' });
}
function readAll(ci) {
  const c = CAST[ci], got = SAVE.collected[c.name] || [];
  if (!collectedCount(c.name)) { $('reader').innerHTML = `<div class="who">${c.name}</div><p class="missing">You haven't found any of these pages yet.</p>`; }
  else $('reader').innerHTML = `<div class="who">${c.name} · ${collectedCount(c.name)} of ${c.pages.length} pages</div>` +
    c.pages.map((t, i) => got[i] ? `<p>${t}</p>` : `<p class="missing">— page ${i+1} not yet found —</p>`).join('');
  storiesEl.querySelectorAll('.box.sel').forEach(b => b.classList.remove('sel'));
  storiesEl.scrollTo({ top: 0, behavior: 'smooth' });
}
function openStories() { renderStories(); $('reader').innerHTML = '<div class="hint">Nothing selected.</div>'; storiesEl.classList.add('show'); storiesClose.style.display = 'block'; }
function closeStories() { storiesEl.classList.remove('show'); storiesClose.style.display = 'none'; }
document.querySelectorAll('.storiesBtn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openStories(); }));
storiesClose.addEventListener('click', closeStories);
storiesEl.addEventListener('click', e => {
  const box = e.target.closest('.box.got'); if (box) return readPage(+box.dataset.c, +box.dataset.p);
  const name = e.target.closest('.name span[data-c]'); if (name) return readAll(+name.dataset.c);
});


