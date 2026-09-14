#!/usr/bin/env node
// The Maze — build the writer's page.
//
// Joe writes in this, not in data/text.js: "I don't see myself being able to do this on my phone…
// I don't want to try and edit a GitHub file through the git editor, that doesn't sound enjoyable."
// So the page carries every line with the context a writer needs — who speaks it, when it fires,
// how often, how much room it has — and saves what he writes to its own store, which I read back
// and apply to data/text.js.
//
// The lines are baked in at build time from tools/text-index.mjs, so this is regenerated whenever
// the text changes:  node maze/tools/writer-page.mjs > /tmp/writer.html
//
// Everything the page knows about a line is derived, never hand-kept. A second copy of the text
// would be wrong within a week and the annotation with it.

import { lines as allLines } from './text-index.mjs';

const lines = allLines.filter((l) => l.kind === 'prose');

// How much room a line has where it appears. Reading room, not a rule — a narrator line holds for
// six seconds; a card waits to be dismissed.
const ROOM = { narrator: 100, card: 280, page: 400, pool: 200, shrine: 90, map: 80, unknown: 200 };

// Play order: the chapters as the game runs them, the pool after each, then everything that can
// happen in any of them.
const order = (c) => {
  if (!c) return 900;
  const m = c.match(/Chapter (I|II|III|IV|V|VI|VII|VIII)/);
  const n = m ? ['I','II','III','IV','V','VI','VII','VIII'].indexOf(m[1]) : 99;
  return n * 2 + (c.startsWith('After') ? 1 : 0);
};
const chapters = [...new Set(lines.map((l) => l.chapter))]
  .sort((a, b) => order(a) - order(b))
  .map((c) => ({ name: c || 'Any chapter', lines: lines.filter((l) => l.chapter === c) }));

const DATA = JSON.stringify({ chapters, room: ROOM, built: new Date().toISOString(), total: lines.length })
  .replace(/</g, '\\u003c');

process.stdout.write(`<title>The Maze Script</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&family=Spectral:ital,wght@0,300;0,400;1,300;1,400&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
:root {
  --ground:#f2f0ea; --surface:#e7e4dc; --edge:#cdc8bc; --stone:#6e6a62; --quiet:#8a857b;
  --ink:#23211d; --line-ink:#33302b; --gold:#9a7328; --rust:#a0553f; --focus:#3f6b7a;
}
:root:not([data-theme="light"]) { }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --ground:#0f1113; --surface:#191d1f; --edge:#2b3134; --stone:#6e6a62; --quiet:#7d786d;
  --ink:#ece7da; --line-ink:#e4ded0; --gold:#d8b36a; --rust:#b07a6a; --focus:#7fb3c4;
} }
:root[data-theme="dark"] {
  --ground:#0f1113; --surface:#191d1f; --edge:#2b3134; --stone:#6e6a62; --quiet:#7d786d;
  --ink:#ece7da; --line-ink:#e4ded0; --gold:#d8b36a; --rust:#b07a6a; --focus:#7fb3c4;
}
* { box-sizing:border-box; }
body { background:var(--ground); color:var(--ink); margin:0;
  font-family:Jost,"Avenir Next","Gill Sans",system-ui,sans-serif; font-weight:300;
  -webkit-text-size-adjust:100%; }
.wrap { max-width:820px; margin:0 auto; padding-inline:20px; padding-block:28px 80px; }

header { display:flex; flex-direction:column; gap:6px; margin-bottom:6px; }
h1 { font-size:27px; font-weight:400; letter-spacing:.14em; text-transform:uppercase; margin:0;
  text-wrap:balance; }
.sub { color:var(--quiet); font-size:14px; line-height:1.5; max-width:60ch; }
.mono { font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace; font-variant-numeric:tabular-nums; }

.bar { position:sticky; top:0; z-index:5; background:var(--ground); border-bottom:1px solid var(--edge);
  padding-block:12px; margin-block:18px 0; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.bar input[type=search] { flex:1 1 190px; min-width:0; background:var(--surface); color:var(--ink);
  border:1px solid var(--edge); border-radius:3px; padding:7px 10px; font:inherit; font-size:14px; }
.chip { background:none; color:var(--quiet); border:1px solid var(--edge); border-radius:3px;
  padding:6px 11px; font:inherit; font-size:12.5px; letter-spacing:.06em; text-transform:uppercase;
  cursor:pointer; }
.chip[aria-pressed="true"] { color:var(--ground); background:var(--ink); border-color:var(--ink); }
.chip:focus-visible, textarea:focus-visible, input:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.saved { margin-left:auto; font-size:12px; color:var(--quiet); letter-spacing:.06em; }

h2 { font-size:13px; font-weight:400; letter-spacing:.2em; text-transform:uppercase; color:var(--stone);
  margin:34px 0 0; padding-bottom:7px; border-bottom:1px solid var(--edge); }
.count { color:var(--quiet); letter-spacing:normal; text-transform:none; font-size:12px; }

.group { display:flex; flex-wrap:wrap; gap:4px 11px; align-items:baseline; margin:20px 0 2px;
  font-size:12px; color:var(--quiet); letter-spacing:.04em; }
.group .id { color:var(--stone); }
.group .chip.add { padding:3px 9px; font-size:11px; margin-left:auto; }
.row { border-bottom:1px solid var(--edge); padding:15px 0 13px 13px; border-left:2px solid transparent; }
.row.edited { border-left-color:var(--gold); }
.row.dead { opacity:.72; }
.row textarea { width:100%; background:none; color:var(--line-ink); border:none; padding:0; resize:none;
  font-family:Spectral,"Iowan Old Style",Palatino,Georgia,serif; font-style:italic; font-weight:300;
  font-size:18px; line-height:1.5; overflow:hidden; }
.row.card textarea, .row.page textarea { font-style:normal; }
.meta { display:flex; flex-wrap:wrap; gap:5px 12px; align-items:baseline; margin-top:9px;
  font-size:11.5px; color:var(--quiet); letter-spacing:.04em; }
.meta .id { color:var(--stone); }
.tag { text-transform:uppercase; letter-spacing:.1em; font-size:10.5px; }
.tag.voice { color:var(--ink); }
.tag.warn { color:var(--gold); }
.tag.dead { color:var(--rust); }
.act { margin-left:auto; display:flex; gap:10px; }
.act button { background:none; border:none; color:var(--quiet); font:inherit; font-size:11.5px;
  letter-spacing:.06em; text-transform:uppercase; cursor:pointer; padding:2px; }
.act button:hover { color:var(--ink); }
.act button.del:hover { color:var(--rust); }
.row.gone textarea { text-decoration:line-through; opacity:.45; }
.addline { margin:12px 0 0 13px; }
.empty { color:var(--quiet); font-size:14px; padding:26px 0; }
.note { display:none; width:100%; margin-top:8px; background:var(--surface); color:var(--ink);
  border:1px solid var(--edge); border-radius:3px; padding:7px 9px; font:inherit; font-size:13px; }
.note.show { display:block; }
@media (max-width:560px) { h1 { font-size:22px; } .row textarea { font-size:17px; } }
@media (prefers-reduced-motion:reduce) { * { transition:none !important; animation:none !important; } }
</style>

<div class="wrap">
  <header>
    <h1>The Maze Script</h1>
    <p class="sub">Every line the player can read, in the order they meet it. Edit in place — it saves
    as you type. <span class="mono" id="stat"></span></p>
  </header>

  <div class="bar">
    <input type="search" id="find" placeholder="Find a line…" aria-label="Find a line">
    <button class="chip" id="fEdited" aria-pressed="false">Edited</button>
    <button class="chip" id="fDead" aria-pressed="false">Never fires</button>
    <button class="chip" id="fLong" aria-pressed="false">Long</button>
    <span class="saved" id="saved"></span>
  </div>

  <main id="script"></main>
</div>

<script>
const DATA = ${DATA};
const $ = (id) => document.getElementById(id);
let edits = {};            // id -> {text, note, deleted}
let added = [];            // {id, block, chapter, after, text}
let db = null, saveTimer = null, dirty = false;

const roomFor = (s) => DATA.room[s] || DATA.room.unknown;
const liveText = (l) => (edits[l.id] && typeof edits[l.id].text === 'string') ? edits[l.id].text : l.text;
const isEdited = (l) => { const e = edits[l.id]; return !!e && (e.deleted || (typeof e.text === 'string' && e.text !== l.text)); };

function setSaved(msg) { $('saved').textContent = msg; }

function queueSave() {
  dirty = true; setSaved('saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!db) { setSaved('offline — copy your work out before closing'); return; }
    try {
      await db.doc('writer/edits').set({ edits, added, updatedAt: new Date().toISOString() });
      dirty = false;
      setSaved('saved ' + new Date().toLocaleTimeString());
    } catch (e) { setSaved('could not save — ' + (e && e.code ? e.code : 'try again')); }
  }, 700);
}

function grow(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

// The event a line belongs to: the list it is picked from, or — for a line that stands alone —
// whatever holds it (the chalk card, one moment, one page).
function groupKey(l) { return l.pool || l.id.replace(/[.\[][^.\[]*$/, ''); }

function groupHead(l, key) {
  const g = document.createElement('p'); g.className = 'group';
  const add = (cls, txt) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = txt; g.appendChild(s); return s; };
  add('', l.when);
  add('tag', l.fires);
  add('id mono', key);
  if (l.dead) add('tag dead', 'nothing fires this');

  if (l.pool && l.canAdd) {
    const b = document.createElement('button'); b.className = 'chip add';
    b.textContent = '+ line';
    b.title = l.poolNote || '';
    b.addEventListener('click', () => {
      added.push({ id: 'added.' + key + '.' + (added.length + 1), pool: l.pool, block: l.block,
                   chapter: l.chapter || 'Any chapter', text: '', why: l.poolNote });
      queueSave(); render();
    });
    g.appendChild(b);
  } else if (l.pool) {
    add('tag dead', 'cannot take another line');
    if (l.poolNote) add('', l.poolNote);
  }
  return g;
}

function rowFor(l) {
  const row = document.createElement('div');
  const e = edits[l.id] || {};
  row.className = 'row ' + l.surface + (isEdited(l) ? ' edited' : '') + (l.dead ? ' dead' : '') + (e.deleted ? ' gone' : '');
  row.dataset.id = l.id;

  const ta = document.createElement('textarea');
  ta.value = liveText(l); ta.spellcheck = true; ta.rows = 1;
  ta.id = 'ta-' + btoa(unescape(encodeURIComponent(l.id))).replace(/=/g, '');
  ta.setAttribute('aria-label', 'Line ' + l.id);
  ta.addEventListener('input', () => {
    grow(ta);
    edits[l.id] = Object.assign({}, edits[l.id], { text: ta.value });
    row.classList.toggle('edited', isEdited(l));
    chars.textContent = ta.value.length + '/' + roomFor(l.surface);
    chars.className = 'tag' + (ta.value.length > roomFor(l.surface) ? ' warn' : '');
    queueSave();
  });
  row.appendChild(ta);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const bit = (cls, txt, title) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; if (title) s.title = title; meta.appendChild(s); return s; };
  if (l.voice !== 'everyone' && !l.chapter) bit('tag voice', l.voice);
  const chars = bit('tag' + (liveText(l).length > roomFor(l.surface) ? ' warn' : ''), liveText(l).length + '/' + roomFor(l.surface), 'characters, and the room this surface gives');
  bit('id mono', l.id.replace(/^[A-Z_]+/, ''));

  const act = document.createElement('div'); act.className = 'act';
  const noteBtn = document.createElement('button'); noteBtn.textContent = e.note ? 'Note •' : 'Note';
  const note = document.createElement('textarea'); note.className = 'note' + (e.note ? ' show' : '');
  note.placeholder = 'A note to me about this line'; note.value = e.note || ''; note.rows = 2;
  note.addEventListener('input', () => { edits[l.id] = Object.assign({}, edits[l.id], { note: note.value }); noteBtn.textContent = note.value ? 'Note •' : 'Note'; queueSave(); });
  noteBtn.addEventListener('click', () => { note.classList.toggle('show'); if (note.classList.contains('show')) note.focus(); });
  act.appendChild(noteBtn);

  if (l.text !== liveText(l)) {
    const undo = document.createElement('button'); undo.textContent = 'Revert';
    undo.addEventListener('click', () => { delete edits[l.id]; queueSave(); render(); });
    act.appendChild(undo);
  }
  const del = document.createElement('button'); del.className = 'del';
  del.textContent = e.deleted ? 'Keep' : 'Cut';
  del.title = 'Mark this line to be removed from the game';
  del.addEventListener('click', () => {
    edits[l.id] = Object.assign({}, edits[l.id], { deleted: !e.deleted });
    queueSave(); render();
  });
  act.appendChild(del);
  meta.appendChild(act);
  row.appendChild(meta);
  row.appendChild(note);
  requestAnimationFrame(() => grow(ta));
  return row;
}

function render() {
  const q = $('find').value.trim().toLowerCase();
  const onlyEdited = $('fEdited').getAttribute('aria-pressed') === 'true';
  const onlyDead = $('fDead').getAttribute('aria-pressed') === 'true';
  const onlyLong = $('fLong').getAttribute('aria-pressed') === 'true';
  const host = $('script'); host.textContent = '';
  let shown = 0;

  for (const ch of DATA.chapters) {
    const mine = ch.lines.filter((l) => {
      if (q && !(liveText(l).toLowerCase().includes(q) || l.id.toLowerCase().includes(q))) return false;
      if (onlyEdited && !isEdited(l)) return false;
      if (onlyDead && !l.dead) return false;
      if (onlyLong && liveText(l).length <= roomFor(l.surface)) return false;
      return true;
    });
    const mineAdded = added.filter((a) => a.chapter === ch.name);
    if (!mine.length && !mineAdded.length) continue;
    const h = document.createElement('h2');
    h.textContent = ch.name;
    const c = document.createElement('span'); c.className = 'count mono';
    c.textContent = '  ' + mine.length + ' line' + (mine.length === 1 ? '' : 's');
    h.appendChild(c);
    host.appendChild(h);
    // One context line per group, not per row. Repeating "Standing at the shelves…" down eight
    // consecutive rows buries the words the writer came to read.
    // Grouped by the event, not by the block: the basin and the shelf are both ROOM_LINES but they
    // are two different moments, and Joe wants to add a line to each of them on its own.
    let lastKey = null;
    for (const l of mine) {
      const key = groupKey(l);
      if (key !== lastKey) { lastKey = key; host.appendChild(groupHead(l, key)); }
      host.appendChild(rowFor(l)); shown++;
    }

    for (const a of mineAdded) {
      const row = document.createElement('div'); row.className = 'row edited';
      const ta = document.createElement('textarea'); ta.value = a.text; ta.spellcheck = true; ta.rows = 1;
      ta.setAttribute('aria-label', 'New line in ' + a.block);
      ta.addEventListener('input', () => { a.text = ta.value; grow(ta); queueSave(); });
      row.appendChild(ta);
      const meta = document.createElement('div'); meta.className = 'meta';
      const n = document.createElement('span'); n.className = 'tag warn'; n.textContent = 'new — I will wire this in';
      const b = document.createElement('span'); b.className = 'id mono'; b.textContent = a.block;
      meta.appendChild(n); meta.appendChild(b);
      const act = document.createElement('div'); act.className = 'act';
      const del = document.createElement('button'); del.className = 'del'; del.textContent = 'Remove';
      del.addEventListener('click', () => { added = added.filter((x) => x !== a); queueSave(); render(); });
      act.appendChild(del); meta.appendChild(act);
      row.appendChild(meta); host.appendChild(row); shown++;
      requestAnimationFrame(() => grow(ta));
    }

  }
  if (!shown) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'No lines match that.'; host.appendChild(p); }
  const n = Object.values(edits).filter((e) => e && (e.text !== undefined || e.deleted)).length;
  $('stat').textContent = DATA.total + ' lines · ' + n + ' changed · ' + added.length + ' new';
}

for (const id of ['fEdited', 'fDead', 'fLong']) {
  $(id).addEventListener('click', () => {
    $(id).setAttribute('aria-pressed', $(id).getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    render();
  });
}
$('find').addEventListener('input', render);
render();
setSaved('connecting…');

(async () => {
  db = await (window.claude && window.claude.use ? window.claude.use('db') : Promise.resolve(null));
  if (!db) { setSaved('not saving here — open the published page'); return; }
  try {
    const doc = await db.doc('writer/edits').get();
    if (doc && doc.edits) { edits = doc.edits; added = doc.added || []; render(); }
    setSaved(doc && doc.updatedAt ? 'last saved ' + new Date(doc.updatedAt).toLocaleString() : 'ready');
  } catch (e) { setSaved('ready'); }
})();

addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
</script>
`);
