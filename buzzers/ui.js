// Buzzers — phone views, sounds, clue generation. Shared by index.html (real phones) and sim.html.
// renderPhone(S, me, ctx) turns one phone's copy of the state into HTML; wirePhone hooks up its buttons.
// Phone-local view state (clue held down, answer revealed, early lockout, mute) lives in ctx, not in S.

import { CONFIG } from './game.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const dot = (color, size = 10) => `<span style="background:${esc(color)};width:${size}px;height:${size}px;display:inline-block;border-radius:50%;flex:none"></span>`;

// ============================ CLUES ============================
// Canned fallback when /api/generate isn't there (GitHub Pages, a local file server) or fails.
export const BANK = {
  'Superheroes': [
    { clue: 'This billionaire funds his night job with Wayne Enterprises.', answer: 'Batman', alts: ['Bruce Wayne', 'the Dark Knight'] },
    { clue: 'Peter Parker shoots webs as this hero.', answer: 'Spider-Man', alts: ['Spidey'] },
    { clue: 'This Asgardian\'s hammer is named Mjölnir.', answer: 'Thor', alts: [] },
    { clue: 'Diana Prince is the alter ego of this Amazon.', answer: 'Wonder Woman', alts: [] },
    { clue: 'T\'Challa rules this hidden nation.', answer: 'Wakanda', alts: [] },
  ],
  '90s Movies': [
    { clue: 'Rose let go of Jack in this 1997 blockbuster.', answer: 'Titanic', alts: [] },
    { clue: 'Life is like a box of chocolates, says this title character.', answer: 'Forrest Gump', alts: [] },
    { clue: 'Vincent and Jules discuss royales with cheese in this Tarantino film.', answer: 'Pulp Fiction', alts: [] },
    { clue: 'Neo takes the red pill in this 1999 film.', answer: 'The Matrix', alts: [] },
    { clue: 'Kevin Spacey keeps a rose-petal fantasy in this 1999 Best Picture.', answer: 'American Beauty', alts: [] },
  ],
  'Dogs': [
    { clue: 'This breed is nicknamed the "wiener dog".', answer: 'Dachshund', alts: [] },
    { clue: 'Lassie was this long-haired herding breed.', answer: 'Collie', alts: ['Rough Collie'] },
    { clue: 'Famously sled-pulling, this breed has a wolf-like look and blue eyes.', answer: 'Siberian Husky', alts: ['Husky'] },
    { clue: 'The world\'s tallest breed, often called a gentle giant.', answer: 'Great Dane', alts: [] },
    { clue: 'This Hungarian breed has a corded "mop" coat.', answer: 'Komondor', alts: ['Puli'] },
  ],
  'Space': [
    { clue: 'The red planet.', answer: 'Mars', alts: [] },
    { clue: 'This planet has the most visible ring system.', answer: 'Saturn', alts: [] },
    { clue: 'Our galaxy.', answer: 'The Milky Way', alts: ['Milky Way'] },
    { clue: 'The first human in space, in 1961.', answer: 'Yuri Gagarin', alts: ['Gagarin'] },
    { clue: 'This telescope launched in 2021 to replace Hubble\'s role in infrared.', answer: 'James Webb Space Telescope', alts: ['JWST', 'Webb'] },
  ],
  'Fast Food': [
    { clue: 'Home of the Whopper.', answer: 'Burger King', alts: ['BK'] },
    { clue: 'Its mascot is a red-headed girl in pigtails.', answer: 'Wendy\'s', alts: [] },
    { clue: 'This chain is closed on Sundays.', answer: 'Chick-fil-A', alts: [] },
    { clue: 'Its secret menu includes "Animal Style".', answer: 'In-N-Out', alts: ['In-N-Out Burger'] },
    { clue: 'Colonel Sanders founded it.', answer: 'KFC', alts: ['Kentucky Fried Chicken'] },
  ],
};

// Ask /api/generate (Vercel → Groq). If any answer was already used by this group, ask again with
// a longer avoid list (up to 2 retries) and say so in the note. Falls back to canned clues.
export async function generateClues(category, avoid) {
  const used = new Set(avoid.map(a => a.toLowerCase()));
  let avoidNow = [...avoid], note = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, avoid: avoidNow }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.clues) throw new Error(data.error || `HTTP ${r.status}`);
      const repeats = data.clues.filter(q => used.has(String(q.answer).toLowerCase()));
      if (!repeats.length) return { clues: data.clues, source: data.model, note };
      note = `regenerated after repeat: ${repeats.map(q => q.answer).join(', ')}`;
      if (attempt === 2) return { clues: data.clues, source: data.model, note: `still repeats after 3 tries: ${repeats.map(q => q.answer).join(', ')}` };
      avoidNow = [...new Set([...avoidNow, ...repeats.map(q => q.answer)])];
    } catch (e) {
      const key = Object.keys(BANK).find(k => k.toLowerCase() === category.toLowerCase());
      const clues = key ? BANK[key] : CONFIG.values.map((v, i) => ({ clue: `A ${['easy', 'gentle', 'medium', 'tough', 'brutal'][i]} placeholder clue about ${category}.`, answer: `${category} answer ${i + 1}`, alts: [] }));
      return { clues, source: 'canned', note: `live generation failed (${e.message})` };
    }
  }
}

// ============================ SOUND ============================
// Synthesised in WebAudio so there are no files to load. iOS needs unlock() inside a tap.
let actx = null;
let muted = false;
try { muted = localStorage.getItem('bz.muted') === '1'; } catch {}
export const sound = {
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('bz.muted', muted ? '1' : '0'); } catch {} return muted; },
  unlock() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource(); s.buffer = b; s.connect(actx.destination); s.start(0);
    } catch {}
  },
  play(kind) {
    if (muted || !actx) return;
    const T = actx.currentTime;
    const tone = (type, f0, f1, start, dur, vol = 0.28) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, T + start); if (f1) o.frequency.exponentialRampToValueAtTime(f1, T + start + dur);
      g.gain.setValueAtTime(0.001, T + start); g.gain.exponentialRampToValueAtTime(vol, T + start + 0.015); g.gain.exponentialRampToValueAtTime(0.001, T + start + dur);
      o.connect(g).connect(actx.destination); o.start(T + start); o.stop(T + start + dur + 0.02);
    };
    try {
      if (kind === 'ding') { tone('sine', 880, 0, 0, 0.12); tone('sine', 1320, 0, 0.08, 0.35); }
      if (kind === 'buzz') tone('square', 196, 0, 0, 0.18, 0.18);
      if (kind === 'right') { tone('triangle', 660, 0, 0, 0.14); tone('triangle', 990, 0, 0.11, 0.3); }
      if (kind === 'wrong') tone('sawtooth', 220, 110, 0, 0.4, 0.16);
      if (kind === 'nobody') { tone('sine', 440, 0, 0, 0.18, 0.2); tone('sine', 330, 0, 0.16, 0.3, 0.2); }
      if (kind === 'timeout') { tone('square', 520, 0, 0, 0.08, 0.14); tone('square', 520, 0, 0.14, 0.08, 0.14); }
    } catch {}
  },
};

// ============================ VIEWS ============================
const P = (S, id) => S.players.find(p => p.id === id);
const nameOf = (S, id) => P(S, id)?.name ?? '?';
const curCat = S => S.categories.find(c => c.id === S.current?.catId);
const curQ = S => curCat(S)?.clues[S.current.idx];

// ctx: { now (synced ms), hold (judge's finger is down), revealed (judge tapped Reveal answer this round),
//        lockUntil (my early-buzz lockout, synced ms), room, conn ('live'|'reconnecting'), muted, showLeave }
export function renderPhone(S, meId, ctx) {
  const me = P(S, meId);
  if (!me) return `<div class="grow center"><div class="eyebrow">Joining…</div></div>`;
  const status = `<div class="status">
    <span class="pill">${dot(me.color, 8)} ${esc(me.name)}</span>
    <span class="right">
      ${ctx.conn && ctx.conn !== 'live' ? `<span class="conn">${esc(ctx.conn)}</span>` : ''}
      ${ctx.room ? `<span>Room ${esc(ctx.room)}</span>` : ''}
      <button class="iconbtn ${ctx.muted ? '' : 'on'}" id="mute" aria-label="${ctx.muted ? 'Unmute' : 'Mute'}">${ctx.muted ? 'Muted' : 'Sound'}</button>
      ${ctx.showLeave ? `<button class="iconbtn" id="leave">Leave</button>` : ''}
    </span></div>`;
  return status + (VIEW[S.phase] || (() => ''))(S, me, ctx);
}

function scores(S, me) {
  return `<div class="scores">${S.players.map(p => `<div class="score ${p.id === me.id ? 'me' : ''} ${p.connected ? '' : 'away'}"><div class="n">${dot(p.color, 8)} ${esc(p.name)}</div><div class="v ${p.score < 0 ? 'neg' : ''}">${p.score}</div></div>`).join('')}</div>`;
}

function buzzerBtn(mode, ctx) {
  const locked = (ctx.lockUntil || 0) > ctx.now;
  const cls = mode === 'armed' ? 'armed' : locked ? 'locked' : '';
  const label = mode === 'out' ? 'Sit tight' : locked ? 'Too early' : mode === 'armed' ? 'Buzz' : 'Wait for it';
  return `<button class="buzzer ${cls}" id="buzzer" ${mode === 'out' ? 'disabled' : ''}>${label}</button>`;
}

export function timerText(S, ctx) {
  const secs = Math.ceil((S.answerDeadline - ctx.now) / 1000);
  return secs > 0 ? { text: String(secs), cls: secs <= 2 ? 'low' : '' } : { text: 'Out of time', cls: 'out' };
}
function timer(S, ctx) { const t = timerText(S, ctx); return `<div class="timer ${t.cls}" id="timer">${t.text}</div>`; }

// The answer hides behind "Reveal answer" until the judge taps it. Correct/Incorrect live inside.
function judgePanel(S, ctx, canRule) {
  const q = curQ(S);
  if (!ctx.revealed) return `<button class="btn gold revealbtn" id="revealAns">Reveal answer</button>`;
  return `<div class="judgebox">
    <div class="eyebrow">Accept</div><div class="answer">${esc(q.answer)}</div>${q.alts?.length ? `<div class="alts">also: ${esc(q.alts.join(' · '))}</div>` : ''}
    <div class="row2"><button class="btn ok" data-rule="1" ${canRule ? '' : 'disabled'}>Correct</button><button class="btn bad" data-rule="0" ${canRule ? '' : 'disabled'}>Incorrect</button></div>
    ${canRule ? '' : '<div class="alts">Waiting for someone to buzz in.</div>'}
  </div>`;
}

const VIEW = {
  lobby(S, me) {
    const live = S.players.filter(p => p.connected).length;
    const ready = S.categories.some(c => c.status === 'ready');
    const onBoard = n => S.categories.some(c => c.name.toLowerCase() === n.toLowerCase());
    const past = S.memory.cats.filter(n => !onBoard(n)).slice(0, 8);
    const ideas = Object.keys(BANK).filter(n => !onBoard(n) && !past.some(p => p.toLowerCase() === n.toLowerCase())).slice(0, Math.max(0, 6 - past.length));
    const why = !ready ? 'Start opens when a category is ready.' : live < CONFIG.minPlayers ? `Need ${CONFIG.minPlayers}+ players.` : '';
    const full = S.categories.length >= CONFIG.maxCategories;
    return `
      <div class="eyebrow">${live} in the room</div>
      <div class="roster">${S.players.map(p => `<span class="pill ${p.connected ? '' : 'away'}">${dot(p.color, 8)} ${esc(p.name)}${p.connected ? '' : `<button class="x" data-kick="${esc(p.id)}" aria-label="Clear ${esc(p.name)}'s seat">×</button>`}</span>`).join('')}</div>
      <div class="eyebrow">Add a category</div>
      <form class="field" id="catform"><input id="catname" placeholder="${full ? 'board is full' : 'anything, the sillier the better'}" maxlength="${CONFIG.maxCategoryLen}" autocomplete="off" ${full ? 'disabled' : ''}><button class="btn gold" type="submit" ${full ? 'disabled' : ''}>Add</button></form>
      ${!full && past.length ? `<div class="eyebrow">Played before</div><div class="chips">${past.map(n => `<button class="chip" data-addcat="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      ${!full && ideas.length ? `<div class="eyebrow">Ideas</div><div class="chips">${ideas.map(n => `<button class="chip" data-addcat="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="catlist">${S.categories.map(c => `<div class="catrow"><span class="who" style="background:${esc(P(S, c.by)?.color || '#888')}"></span><span class="name">${esc(c.name)}</span><span class="state ${c.status}">${c.status === 'ready' ? (c.source === 'canned' ? 'canned clues' : '5 clues ready') : 'searching…'}</span><button class="x" data-remove="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">×</button></div>`).join('') || '<div class="alts">The board fills in as people add categories.</div>'}</div>
      <div class="grow"></div>
      ${why ? `<div class="alts center">${why}</div>` : ''}
      <button class="btn gold wide" id="start" ${why ? 'disabled' : ''}>Start game</button>`;
  },
  board(S, me) {
    const pickerAway = !P(S, S.picker)?.connected;
    const picking = S.picker === me.id || pickerAway;
    const cols = S.categories.length;
    return `
      <div class="eyebrow">${S.picker === me.id ? 'Your pick' : pickerAway ? `${esc(nameOf(S, S.picker))} is away · anyone can pick` : `${esc(nameOf(S, S.picker))} is picking`}</div>
      <div class="board ${picking ? '' : 'passive'}" style="grid-template-columns:repeat(${cols},1fr)">
        ${S.categories.map(c => `<div class="cat">${esc(c.name)}</div>`).join('')}
        ${CONFIG.values.map((v, i) => S.categories.map(c => `<button class="val ${c.clues[i].used ? 'used' : ''}" data-cat="${esc(c.id)}" data-idx="${i}" ${picking && !c.clues[i].used ? '' : 'disabled'}>${v}</button>`).join('')).join('')}
      </div>
      ${scores(S, me)}
      <button class="btn ghost small" id="end" style="align-self:center">End game</button>`;
  },
  reading(S, me, ctx) {
    const c = curCat(S); const q = curQ(S);
    if (me.id === S.judge) return `
      <div class="eyebrow">You read this one · ${esc(c.name)} for ${q.value}</div>
      <div class="alts">Hold the button, read the clue out loud, let go on the last word. Letting go opens the buzzers.</div>
      <button class="buzzer hold ${ctx.hold ? 'armed' : ''}" id="hold">${ctx.hold ? `<span class="clue">${esc(q.clue)}</span>` : 'Hold to reveal'}</button>`;
    return `<div class="grow center"><div class="eyebrow">${esc(c.name)} for ${q.value}</div><div class="big" style="font-size:34px">${esc(nameOf(S, S.judge))} is reading</div><div class="alts">Listen. The ding means go.</div></div>${buzzerBtn('wait', ctx)}`;
  },
  buzz(S, me, ctx) {
    const q = curQ(S);
    const steal = S.buzz.guessed.length > 0;
    const isOpen = ctx.now >= S.buzz.openAt;
    if (me.id === S.judge) {
      const canReread = CONFIG.rereadBeforeFirstBuzz && !steal && !Object.keys(S.buzz.presses).length;
      return `<div class="grow center"><div class="eyebrow">${steal ? 'Steal' : 'Buzzers open'} · you're judging</div><div class="clue">${esc(q.clue)}</div>
        ${canReread ? `<button class="btn ghost small" id="reread">Re-read (closes buzzers)</button>` : ''}</div>${judgePanel(S, ctx, false)}`;
    }
    const out = S.buzz.guessed.includes(me.id);
    return `<div class="grow center"><div class="eyebrow">${steal ? 'Steal' : 'Buzz'}</div><div class="clue">${esc(q.clue)}</div>${out ? `<div class="alts">You already guessed.</div>` : ''}</div>${buzzerBtn(out ? 'out' : isOpen ? 'armed' : 'wait', ctx)}`;
  },
  answering(S, me, ctx) {
    const w = P(S, S.buzz.winner); const q = curQ(S);
    if (me.id === S.judge) return `
      <div class="eyebrow">You're the judge · ${esc(w.name)} is answering</div>
      <div class="clue">${esc(q.clue)}</div>
      ${timer(S, ctx)}
      ${judgePanel(S, ctx, true)}`;
    if (me.id === w.id) return `<div class="grow center"><div class="eyebrow">You're up</div><div class="big" style="font-size:40px">Say it out loud</div>${timer(S, ctx)}<div class="alts">${esc(nameOf(S, S.judge))} is judging</div></div>`;
    return `<div class="grow center"><div class="eyebrow">${esc(w.name)} buzzed in</div><div class="clue">${esc(q.clue)}</div>${timer(S, ctx)}<div class="alts">${esc(nameOf(S, S.judge))} is judging</div></div>`;
  },
  reveal(S, me) {
    const q = curQ(S); const r = S.lastResult || {};
    return `<div class="grow center"><div class="eyebrow">${r.who ? `${esc(nameOf(S, r.who))} ${r.right ? 'got it' : 'missed it'}` : 'No one got it'}</div><div class="clue">${esc(q.clue)}</div><div class="answer">${esc(q.answer)}</div></div>${scores(S, me)}`;
  },
  over(S, me) {
    const sorted = S.players.slice().sort((a, b) => b.score - a.score);
    const top = sorted[0]; const tie = sorted.filter(p => p.score === top.score);
    let place = 0, prev = null;
    const rows = sorted.map((p, i) => { if (p.score !== prev) { place = i + 1; prev = p.score; } return `<div class="row"><span class="place">${place}</span><span class="nm">${dot(p.color, 10)} ${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</span><span class="pts">${p.score}</span></div>`; }).join('');
    return `<div class="grow center"><div class="eyebrow">Final</div><div class="big" style="font-size:44px;color:var(--gold)">${tie.length > 1 ? `${tie.map(p => esc(p.name)).join(' & ')} tie` : `${esc(top.name)} wins`}</div><div class="standings">${rows}</div></div>
      <button class="btn gold wide" id="again">Play again</button>
      <div class="alts center">Same room, same players. Clues you've seen won't come back.</div>`;
  },
};

// h: { send(action), addCategory(name), press(), hold(down), reveal(), mute(), leave() }
export function wirePhone(root, S, meId, h) {
  const $ = s => root.querySelector(s);
  const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach(el => el[ev] = fn);
  const form = $('#catform');
  if (form) form.onsubmit = e => { e.preventDefault(); const i = $('#catname'); if (i.value.trim()) { h.addCategory(i.value); i.value = ''; } };
  on('[data-addcat]', 'onclick', e => h.addCategory(e.currentTarget.dataset.addcat));
  on('[data-remove]', 'onclick', e => h.send({ type: 'removeCategory', catId: e.currentTarget.dataset.remove }));
  on('[data-kick]', 'onclick', e => h.send({ type: 'kick', target: e.currentTarget.dataset.kick }));
  on('#start', 'onclick', () => h.send({ type: 'start' }));
  on('.board .val', 'onclick', e => h.send({ type: 'pickClue', catId: e.currentTarget.dataset.cat, idx: +e.currentTarget.dataset.idx }));
  const bz = $('#buzzer'); if (bz) bz.onpointerdown = e => { e.preventDefault(); h.press(); };
  const hold = $('#hold');
  if (hold) {
    // Release is caught on window: a state update can repaint the button mid-hold.
    const end = () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); h.hold(false); };
    hold.onpointerdown = e => { e.preventDefault(); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); h.hold(true); };
    hold.oncontextmenu = e => e.preventDefault();
  }
  on('#revealAns', 'onclick', () => h.reveal());
  on('[data-rule]', 'onclick', e => h.send({ type: 'rule', right: e.currentTarget.dataset.rule === '1' }));
  on('#reread', 'onclick', () => h.send({ type: 'reread' }));
  const end = $('#end');
  if (end) end.onclick = () => { if (end.dataset.armed) h.send({ type: 'end' }); else { end.dataset.armed = '1'; end.textContent = 'Tap again to end the game'; setTimeout(() => { if (end.isConnected) { delete end.dataset.armed; end.textContent = 'End game'; } }, 3000); } };
  on('#again', 'onclick', () => h.send({ type: 'again' }));
  on('#mute', 'onclick', () => h.mute());
  on('#leave', 'onclick', () => h.leave?.());
}

// Re-render without eating what someone is typing in the category box.
export function paint(root, html) {
  if (root._html === html) return false;
  root._html = html;
  const i = root.querySelector('#catname');
  const keep = i && { v: i.value, f: document.activeElement === i, s: i.selectionStart };
  root.innerHTML = html;
  const j = root.querySelector('#catname');
  if (keep && j && !j.disabled) { j.value = keep.v; if (keep.f) { j.focus(); try { j.setSelectionRange(keep.s, keep.s); } catch {} } }
  return true;
}

// A cheap signature of the time-driven parts of a view, so a 100 ms tick only repaints when they change.
export function tickSig(S, meId, ctx) {
  if (!S) return '';
  if (S.phase === 'answering') return 'a' + timerText(S, ctx).text;
  if (S.phase === 'buzz' || S.phase === 'reading') return S.phase + (ctx.now >= (S.buzz.openAt ?? Infinity)) + ((ctx.lockUntil || 0) > ctx.now);
  return S.phase;
}
