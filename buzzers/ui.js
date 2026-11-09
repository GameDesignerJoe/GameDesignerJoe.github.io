// Buzzers — phone views, sounds, clue generation. Shared by index.html (real phones) and sim.html.
// renderPhone(S, me, ctx) turns one phone's copy of the state into HTML; wirePhone hooks up its buttons.
// Phone-local view state (clue held down, early lockout, mute) lives in ctx, not in S.

import { CONFIG, SETTINGS, actingHostOf, rowsFor } from './game.js';

// Two-way toggles for each room setting. Editable for the host (and on the join screen), read-only for everyone else.
export function settingsControls(settings, editable) {
  return `<div class="settings">${Object.entries(SETTINGS).map(([k, def]) => `
    <div class="setrow"><span class="eyebrow">${esc(def.label)}</span>
      <div class="seg" role="group" aria-label="${esc(def.label)}">${def.options.map(([v, label]) =>
        `<button type="button" class="${settings[k] === v ? 'on' : ''}" data-setting="${k}" data-val='${esc(JSON.stringify(v))}' ${editable ? '' : 'disabled'} aria-pressed="${settings[k] === v}">${esc(label)}</button>`).join('')}</div>
    </div>`).join('')}
    ${settings.pickOrder === 'winner' ? '<div class="alts">With 2 players the pick always alternates.</div>' : ''}
  </div>`;
}
// Wire the toggles: onPick(key, value)
export function wireSettings(root, onPick) {
  root.querySelectorAll('[data-setting]').forEach(b => b.onclick = () => onPick(b.dataset.setting, JSON.parse(b.dataset.val)));
}

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const dot = (color, size = 10) => `<span style="background:${esc(color)};width:${size}px;height:${size}px;display:inline-block;border-radius:50%;flex:none"></span>`;

// ============================ CLUES ============================
// Our own categories with checked answers. Offered as chips, and used when live generation fails.
// Keep at least CONFIG.targetCategories of them so a board can always be filled without Groq.
export const BANK = {
  'Superheroes': [
    { clue: 'Which hero is secretly the billionaire Bruce Wayne?', answer: 'Batman', alts: ['the Dark Knight'] },
    { clue: 'Peter Parker swings around New York as which hero?', answer: 'Spider-Man', alts: ['Spidey', 'Spiderman'] },
    { clue: 'Which Asgardian god of thunder carries the hammer Mjölnir?', answer: 'Thor', alts: [] },
    { clue: 'Diana Prince of Themyscira is better known as which hero?', answer: 'Wonder Woman', alts: [] },
    { clue: 'T\'Challa is king of which hidden African nation?', answer: 'Wakanda', alts: [] },
  ],
  '90s Movies': [
    { clue: 'In which 1997 blockbuster does Rose let go of Jack in the icy Atlantic?', answer: 'Titanic', alts: [] },
    { clue: 'Which title character says life is like a box of chocolates?', answer: 'Forrest Gump', alts: ['Forrest'] },
    { clue: 'In which Tarantino film do Vincent and Jules talk about a Royale with Cheese?', answer: 'Pulp Fiction', alts: [] },
    { clue: 'In which 1999 film does Neo take the red pill?', answer: 'The Matrix', alts: ['Matrix'] },
    { clue: 'Which 1999 Best Picture winner starred Kevin Spacey as Lester Burnham?', answer: 'American Beauty', alts: [] },
  ],
  'Dogs': [
    { clue: 'Which long, short-legged breed is nicknamed the "wiener dog"?', answer: 'Dachshund', alts: [] },
    { clue: 'What breed was the TV hero Lassie?', answer: 'Rough Collie', alts: ['Collie'] },
    { clue: 'Which blue-eyed sled dog breed was made famous by the 1925 serum run to Nome?', answer: 'Siberian Husky', alts: ['Husky'] },
    { clue: 'Which breed is usually the tallest in the world, nicknamed the gentle giant?', answer: 'Great Dane', alts: [] },
    { clue: 'Which Hungarian guard dog has a white coat that hangs in long cords like a mop?', answer: 'Komondor', alts: [] },
  ],
  'Space': [
    { clue: 'Which planet is known as the Red Planet?', answer: 'Mars', alts: [] },
    { clue: 'Which planet has the biggest, brightest rings in our solar system?', answer: 'Saturn', alts: [] },
    { clue: 'What is the name of the galaxy our solar system is in?', answer: 'The Milky Way', alts: ['Milky Way'] },
    { clue: 'Who became the first human in space in 1961?', answer: 'Yuri Gagarin', alts: ['Gagarin'] },
    { clue: 'Which infrared space telescope, launched in 2021, is named after a former NASA administrator?', answer: 'James Webb Space Telescope', alts: ['JWST', 'Webb'] },
  ],
  'Fast Food': [
    { clue: 'Which chain sells the Whopper?', answer: 'Burger King', alts: ['BK'] },
    { clue: 'Which chain founded by Colonel Sanders sells a secret recipe of 11 herbs and spices?', answer: 'KFC', alts: ['Kentucky Fried Chicken'] },
    { clue: 'Which burger chain\'s logo is a red-haired girl with pigtails?', answer: 'Wendy\'s', alts: ['Wendys'] },
    { clue: 'Which chicken chain is famously closed on Sundays?', answer: 'Chick-fil-A', alts: [] },
    { clue: 'Which West Coast burger chain has a secret menu with "Animal Style" fries?', answer: 'In-N-Out', alts: ['In-N-Out Burger', 'In and Out'] },
  ],
  'World Capitals': [
    { clue: 'Which capital city is home to the Eiffel Tower?', answer: 'Paris', alts: [] },
    { clue: 'What is the capital of Japan?', answer: 'Tokyo', alts: [] },
    { clue: 'Not Toronto, but which Ontario city is the capital of Canada?', answer: 'Ottawa', alts: [] },
    { clue: 'Not Sydney, but which purpose-built city is the capital of Australia?', answer: 'Canberra', alts: [] },
    { clue: 'Which Central Asian capital was called Nur-Sultan from 2019 to 2022?', answer: 'Astana', alts: [] },
  ],
  'Board Games': [
    { clue: 'In which game can you buy Boardwalk and Park Place?', answer: 'Monopoly', alts: [] },
    { clue: 'Which murder-mystery game features Colonel Mustard, Miss Scarlett and a candlestick?', answer: 'Clue', alts: ['Cluedo'] },
    { clue: 'In which 1995 German game do players trade sheep and brick to build settlements?', answer: 'Catan', alts: ['Settlers of Catan'] },
    { clue: 'In Scrabble, how many points is the Q tile worth?', answer: '10', alts: ['ten'] },
    { clue: 'Which ancient strategy game is played with black and white stones on a 19-by-19 grid?', answer: 'Go', alts: ['Weiqi', 'Baduk'] },
  ],
  'Disney Movies': [
    { clue: 'What is the name of the snowman in Frozen who loves warm hugs?', answer: 'Olaf', alts: [] },
    { clue: 'Who is Simba\'s father in The Lion King?', answer: 'Mufasa', alts: [] },
    { clue: 'Which crab sings "Under the Sea" in The Little Mermaid?', answer: 'Sebastian', alts: [] },
    { clue: 'What was Disney\'s first full-length animated feature, released in 1937?', answer: 'Snow White and the Seven Dwarfs', alts: ['Snow White'] },
    { clue: 'Which 1940 film set animation to classical music, with Mickey as the Sorcerer\'s Apprentice?', answer: 'Fantasia', alts: [] },
  ],
  'The Human Body': [
    { clue: 'Which organ pumps blood around the body?', answer: 'The heart', alts: ['Heart'] },
    { clue: 'What is the largest organ of the human body?', answer: 'Skin', alts: ['The skin'] },
    { clue: 'How many bones does an adult human skeleton usually have?', answer: '206', alts: [] },
    { clue: 'What is the longest bone in the body, found in the thigh?', answer: 'Femur', alts: [] },
    { clue: 'What is the smallest bone in the body, found in the middle ear?', answer: 'Stapes', alts: ['Stirrup'] },
  ],
  'Video Games': [
    { clue: 'Which plumber keeps rescuing Princess Peach?', answer: 'Mario', alts: ['Super Mario'] },
    { clue: 'Link is the hero of which Nintendo series, named after a princess?', answer: 'The Legend of Zelda', alts: ['Zelda'] },
    { clue: 'Which block-building game is the best-selling video game of all time?', answer: 'Minecraft', alts: [] },
    { clue: 'Which franchise began in Japan in 1996 with Red and Green versions on the Game Boy?', answer: 'Pokémon', alts: ['Pokemon'] },
    { clue: 'Which Hideo Kojima stealth series stars Solid Snake?', answer: 'Metal Gear', alts: ['Metal Gear Solid'] },
  ],
  'The Beatles': [
    { clue: 'Which English port city did the Beatles come from?', answer: 'Liverpool', alts: [] },
    { clue: 'Which drummer replaced Pete Best in 1962?', answer: 'Ringo Starr', alts: ['Ringo'] },
    { clue: 'What colour is the submarine "we all live in", in the 1966 song?', answer: 'Yellow', alts: [] },
    { clue: 'On which 1969 album cover does the band walk across a zebra crossing?', answer: 'Abbey Road', alts: [] },
    { clue: 'What was John Lennon\'s skiffle group called before it became the Beatles?', answer: 'The Quarrymen', alts: ['Quarrymen', 'Quarry Men'] },
  ],
  'Breakfast': [
    { clue: 'Which griddled breakfast has a grid of little square pockets?', answer: 'Waffle', alts: ['Waffles'] },
    { clue: 'Which cereal does Tony the Tiger say is "Gr-r-reat!"?', answer: 'Frosted Flakes', alts: ['Frosties'] },
    { clue: 'Which dish puts poached eggs and hollandaise sauce on an English muffin?', answer: 'Eggs Benedict', alts: [] },
    { clue: 'Which Mexican dish of fried eggs on tortillas with salsa means "ranch-style eggs"?', answer: 'Huevos rancheros', alts: [] },
    { clue: 'What does a croque madame have on top that a croque monsieur doesn\'t?', answer: 'A fried egg', alts: ['Egg', 'An egg'] },
  ],
};

// Turn a fetch failure into something a player can act on (and Joe can debug from the lobby).
function failReason(msg) {
  const m = String(msg || '');
  if (/^UNKNOWN_TOPIC/.test(m)) return "There aren't enough real, checkable facts about it to write fair questions (we won't make them up)";
  if (/^NOT_ALLOWED/.test(m)) return "That one isn't allowed in Buzzers";
  if (/HTTP (40[45]|501)/.test(m)) return "The clue writer isn't on this site";
  if (/HTTP 402/.test(m)) return 'The clue service is switched off (Vercel)';
  if (/GROQ_API_KEY/.test(m)) return 'The clue service has no Groq key';
  if (/Groq 429/.test(m)) return 'The clue writer is busy (rate limit)';
  if (/Groq/.test(m)) return `The clue writer failed (${m})`;
  if (/model returned/.test(m)) return 'The clue writer came back with too few clues';
  if (/fetch|network|Failed/i.test(m)) return "Couldn't reach the clue writer";
  return m || 'Unknown error';
}
export const bankName = name => Object.keys(BANK).find(k => k.toLowerCase() === String(name).trim().toLowerCase());

// Ask /api/generate (Vercel → Groq). If any answer was already used by this group, ask again with
// a longer avoid list (up to 2 retries) and say so in the note. If generation fails, one of our BANK
// categories falls back to its own clues; anything else comes back { failed, reason } so the lobby can
// ask for a different category. `placeholders: true` (sim, local testing) fills in dummy clues instead.
export async function generateClues(category, avoid, { placeholders = false } = {}) {
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
      const key = bankName(category);
      if (key) return { clues: BANK[key], source: 'canned', note: `live generation failed (${e.message})` };
      if (!placeholders) return { failed: true, reason: failReason(e.message), error: String(e.message || e) };
      const clues = CONFIG.values.map((v, i) => ({ clue: `A ${['easy', 'gentle', 'medium', 'tough', 'brutal'][i]} placeholder clue about ${category}.`, answer: `${category} answer ${i + 1}`, alts: [] }));
      return { clues, source: 'placeholder', note: `live generation failed (${e.message})` };
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

// ctx: { now (synced ms), hold (judge's finger is down),
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

// The judge sees the answer as soon as they let go of Hold (never while reading). Correct/Incorrect live inside.
function judgePanel(S, ctx, canRule) {
  const q = curQ(S);
  return `<div class="judgebox">
    <div class="eyebrow">Accept</div><div class="answer">${esc(q.answer)}</div>${q.alts?.length ? `<div class="alts">also: ${esc(q.alts.join(' · '))}</div>` : ''}
    <div class="row2"><button class="btn ok" data-rule="1" ${canRule ? '' : 'disabled'}>Correct</button><button class="btn bad" data-rule="0" ${canRule ? '' : 'disabled'}>Incorrect</button></div>
    ${canRule ? '' : '<div class="alts">Waiting for someone to buzz in.</div>'}
  </div>`;
}

const VIEW = {
  // Lobby: one category each → everyone taps Ready → if under targetCategories, random players
  // take turns adding one more → game starts by itself once every category's clues are ready.
  lobby(S, me, ctx = {}) {
    const live = S.players.filter(p => p.connected).length;
    const cap = S.settings.catMode === 'onePerPlayer' ? CONFIG.maxPlayers : CONFIG.maxCategories;
    const host = actingHostOf(S);
    const mine = S.categories.some(c => c.by === me.id);
    const full = S.categories.length >= cap;
    const turn = S.extra ? S.extra.queue[S.extra.i % S.extra.queue.length] : null;
    const myTurn = turn === me.id && S.categories.length < CONFIG.targetCategories;
    const canAdd = !full && (!mine || myTurn);
    const needCat = !mine && !full;
    const rows = rowsFor(S.categories.length);
    const amReady = S.ready.includes(me.id);
    const allReady = S.players.every(p => S.ready.includes(p.id));
    const onBoard = n => S.categories.some(c => c.name.toLowerCase() === n.toLowerCase());
    const past = S.memory.cats.filter(n => !onBoard(n)).slice(0, 8);
    const ideas = Object.keys(BANK).filter(n => !onBoard(n) && !past.some(p => p.toLowerCase() === n.toLowerCase())).slice(0, Math.max(0, 6 - past.length));
    const waitingOn = S.players.filter(p => !S.ready.includes(p.id));
    const generating = S.categories.filter(c => c.status !== 'ready').length;

    let banner = '';
    if (S.extra && S.categories.length < CONFIG.targetCategories) {
      banner = myTurn
        ? `<div class="judgebox"><div class="eyebrow">Your turn</div><div class="big" style="font-size:26px">Add one more category</div><div class="alts">The board needs ${CONFIG.targetCategories}. It has ${S.categories.length}.</div></div>`
        : `<div class="judgebox"><div class="eyebrow">Filling the board · ${S.categories.length} of ${CONFIG.targetCategories}</div><div class="big" style="font-size:26px">${esc(nameOf(S, turn))} is adding one more</div></div>`;
    } else if (allReady && S.players.length >= CONFIG.minPlayers && generating) {
      banner = `<div class="judgebox"><div class="eyebrow">Everyone's ready</div><div class="big" style="font-size:26px">Starting when the clues are in…</div></div>`;
    }

    let hint, btn;
    if (live < CONFIG.minPlayers) hint = `Need ${CONFIG.minPlayers}+ players.`;
    else if (needCat) hint = 'Add one category, then tap Ready.';
    else if (amReady) hint = waitingOn.length ? `Waiting for ${waitingOn.map(p => esc(p.name)).join(', ')}` : !S.categories.length ? 'Add at least one category.' : '';
    else hint = full && !mine ? `The board is full (${cap}). Tap Ready when you're set.` : 'Tap Ready when you\'re set. The game starts when everyone is.';
    if (amReady) btn = `<button class="btn ghost wide" id="ready" data-ready="0">Ready ✓ (tap to undo)</button>`;
    else btn = `<button class="btn gold wide" id="ready" data-ready="1" ${needCat ? 'disabled' : ''}>Ready</button>`;
    const chosen = Object.entries(SETTINGS).map(([k, def]) => def.options.find(([v]) => v === S.settings[k])?.[1]).filter(Boolean).join(' · ');
    const settingsBlock = `<details class="lobbyset" ${settingsOpen ? 'open' : ''}><summary>Game settings · ${host === me.id ? 'you\'re the host' : `${esc(nameOf(S, host))} is host`}<span class="setsum">${esc(chosen)}</span></summary><div style="margin-top:8px">${settingsControls(S.settings, host === me.id)}</div></details>`;

    const chips = list => list.map(n => `<button class="chip" data-addcat="${esc(n)}">${esc(n)}</button>`).join('');
    const fail = canAdd ? ctx.genFail : null;
    const ours = Object.keys(BANK).filter(n => !onBoard(n));
    const failBox = fail ? `<div class="judgebox"><div class="eyebrow">No clues for that one</div><div class="big" style="font-size:24px">We couldn't write clues for “${esc(fail.name)}”</div><div class="alts">${esc(fail.reason)}. Try a different category, or pick one of ours below. Those always work.</div></div>` : '';
    return `
      <div class="eyebrow">${live} in the room</div>
      <div class="roster">${S.players.map(p => `<span class="pill ${p.connected ? '' : 'away'}">${dot(p.color, 8)} ${esc(p.name)}${S.ready.includes(p.id) ? ' ✓' : ''}${p.connected ? '' : `<button class="x" data-kick="${esc(p.id)}" aria-label="Clear ${esc(p.name)}'s seat">×</button>`}</span>`).join('')}</div>
      <div class="eyebrow">Your color</div>
      <div class="swatches small">${CONFIG.colors.map(c => {
        const owner = S.players.find(p => p.id !== me.id && p.color === c);
        return `<button class="swatch ${me.color === c ? 'on' : ''} ${owner ? 'taken' : ''}" data-pickcolor="${c}" style="background:${c}" ${owner ? 'disabled' : ''} aria-label="${owner ? `${esc(owner.name)} has this color` : me.color === c ? 'your color' : 'pick this color'}">${owner ? esc(owner.name[0].toUpperCase()) : ''}</button>`;
      }).join('')}</div>
      ${settingsBlock}
      ${banner}
      ${failBox}
      ${canAdd ? `
        <div class="eyebrow">${myTurn ? 'Your extra category' : 'Your category'}</div>
        <form class="field" id="catform"><input id="catname" placeholder="anything, the sillier the better" maxlength="${CONFIG.maxCategoryLen}" autocomplete="off"><button class="btn gold" type="submit">Add</button></form>
        ${fail ? (ours.length ? `<div class="eyebrow">Ours · always ready</div><div class="chips">${chips(ours)}</div>` : '') : `
        ${past.length ? `<div class="eyebrow">Played before</div><div class="chips">${chips(past)}</div>` : ''}
        ${ideas.length ? `<div class="eyebrow">Ideas</div><div class="chips">${chips(ideas)}</div>` : ''}`}` : ''}
      <div class="eyebrow">The board · ${S.categories.length}${S.categories.length < CONFIG.targetCategories ? ` of ${CONFIG.targetCategories}` : ''}${rows < CONFIG.values.length ? ` · hardest ${rows} rows each (${S.categories.length * rows} questions)` : ''}</div>
      <div class="catlist">${S.categories.map(c => {
        const removable = c.by === me.id || !P(S, c.by)?.connected;
        return `<div class="catrow"><span class="who" style="background:${esc(P(S, c.by)?.color || '#888')}"></span><span class="name">${esc(c.name)}</span><span class="state ${c.status}">${c.status === 'ready' ? (c.source === 'placeholder' ? 'placeholder clues' : '5 clues ready') : 'searching…'}</span>${removable ? `<button class="x" data-remove="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">×</button>` : ''}</div>`;
      }).join('') || '<div class="alts">Everyone adds one category.</div>'}</div>
      <div class="grow"></div>
      ${hint ? `<div class="alts center">${hint}</div>` : ''}
      ${btn}`;
  },
  board(S, me) {
    const pickerAway = !P(S, S.picker)?.connected;
    const picking = S.picker === me.id || pickerAway;
    const cols = S.categories.length;
    return `
      <div class="eyebrow">${S.picker === me.id ? 'Your pick' : pickerAway ? `${esc(nameOf(S, S.picker))} is away · anyone can pick` : `${esc(nameOf(S, S.picker))} is picking`} · ${S.judge === me.id ? 'you judge this one' : `${esc(nameOf(S, S.judge))} judges`}</div>
      ${cols > 6 ? '<div class="rotate-hint">↻ Turn your phone sideways for a bigger board</div>' : ''}
      <div class="board ${picking ? '' : 'passive'} ${cols > 6 ? 'dense' : ''}" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
        ${S.categories.map(c => `<div class="cat"><span>${esc(c.name)}</span></div>`).join('')}
        ${(S.categories[0]?.clues || []).map((_, i) => S.categories.map(c => `<button class="val ${c.clues[i].used ? 'used' : ''}" data-cat="${esc(c.id)}" data-idx="${i}" ${picking && !c.clues[i].used ? '' : 'disabled'}>${c.clues[i].value}</button>`).join('')).join('')}
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

// h: { send(action), addCategory(name), press(), hold(down), mute(), leave() }
let settingsOpen = false; // lobby settings panel: closed by default, stays as the player left it across repaints
export function wirePhone(root, S, meId, h) {
  const $ = s => root.querySelector(s);
  const ls = $('details.lobbyset'); if (ls) ls.ontoggle = () => { settingsOpen = ls.open; };
  const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach(el => el[ev] = fn);
  const form = $('#catform');
  if (form) form.onsubmit = e => { e.preventDefault(); const i = $('#catname'); if (i.value.trim()) { h.addCategory(i.value); i.value = ''; } };
  on('[data-addcat]', 'onclick', e => h.addCategory(e.currentTarget.dataset.addcat));
  on('[data-remove]', 'onclick', e => h.send({ type: 'removeCategory', catId: e.currentTarget.dataset.remove }));
  on('[data-kick]', 'onclick', e => h.send({ type: 'kick', target: e.currentTarget.dataset.kick }));
  on('#ready', 'onclick', e => h.send({ type: 'ready', ready: e.currentTarget.dataset.ready === '1' }));
  wireSettings(root, (k, v) => h.send({ type: 'settings', settings: { [k]: v } }));
  on('[data-pickcolor]', 'onclick', e => h.send({ type: 'color', color: e.currentTarget.dataset.pickcolor }));
  on('.board .val', 'onclick', e => h.send({ type: 'pickClue', catId: e.currentTarget.dataset.cat, idx: +e.currentTarget.dataset.idx }));
  const bz = $('#buzzer'); if (bz) bz.onpointerdown = e => { e.preventDefault(); h.press(); };
  const hold = $('#hold');
  if (hold) {
    // Release is caught on window: a state update can repaint the button mid-hold.
    const end = () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); h.hold(false); };
    hold.onpointerdown = e => { e.preventDefault(); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); h.hold(true); };
    hold.oncontextmenu = e => e.preventDefault();
  }
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
