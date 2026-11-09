// Buzzers — the rules. One reducer over one state object.
// Runs on the room server (party/server.js, a Cloudflare Durable Object) and in the browser for sim.html.
// No DOM, no network, no sound in here: phones are views, this is the game.

// ============================ CONFIG ============================
// Every timing and rule knob lives here (the server and the sim both read it).
export const CONFIG = {
  values: [200, 400, 600, 800, 1000],
  targetCategories: 5,       // fewer than this once everyone is ready → random players take turns adding one more
  maxCategories: 6,          // board cap; players after the 6th category don't add one
  maxPlayers: 10,
  minPlayers: 2,
  maxNameLen: 14,
  maxCategoryLen: 40,
  openDelayMs: 300,          // buzzers open this long after the judge lets go, so every phone hears the ding at the same synced moment
  earlyLockoutMs: 250,       // buzz before the light = frozen this long
  collectWindowMs: 200,      // after the first press arrives, wait this long for faster presses that arrived later
  buzzTimeoutMs: 6000,       // nobody buzzes → reveal, same picker
  answerSecs: 5,             // out-loud answer countdown. Hitting zero shows "Out of time"; the judge still rules.
  revealMs: 3500,            // how long the answer stays up before the board comes back
  awayGraceMs: 8000,         // a dropped picker/judge gets this long to come back before someone else takes over
  rereadBeforeFirstBuzz: true, // judge can take a clue back to "reading" if nobody has pressed yet
  memoryAnswers: 400,        // used clue ids kept for the life of the room
  memoryCats: 20,            // past categories kept for the "played before" chips
  logMax: 200,
  colors: ['#f2c14e', '#4fc984', '#5aa9ff', '#e37fd1', '#ff8a4c', '#b48cff', '#5fd8d0', '#ff6b81', '#c7d36f', '#d9d9d9'],
};

// ============================ HELPERS ============================
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const clueId = (cat, answer) => `${String(cat).toLowerCase()}|${String(answer).toLowerCase()}`;
export const newId = (p = '') => p + Math.random().toString(36).slice(2, 9);
const emptyBuzz = () => ({ openAt: null, presses: {}, lockedUntil: {}, guessed: [], winner: null });

export function freshState(keep) {
  return {
    v: 2,
    phase: 'lobby',            // lobby → board → reading → buzz → answering → reveal → board … → over
    players: [],               // { id, name, color, score, judged, connected, key, clock }
    categories: [],            // { id, name, by, status, source, clues:[{ clue, answer, alts, value, used }] }
    ready: [],                 // lobby: players who tapped Ready
    extra: null,               // lobby: { queue:[pid], i } while random players add categories up to targetCategories
    picker: null,
    round: 0,                 // bumps on every pick; phones key per-clue view state on it
    current: null,             // { catId, idx }
    judge: null,               // assigned when a picker's turn starts, so the board can show who'll judge
    holding: false,
    buzz: emptyBuzz(),
    answerDeadline: null,
    lastResult: null,          // { who, right } or { who: null }
    nextPicker: null,
    sfx: { n: 0, kind: null }, // phones play a sting when n changes
    log: keep?.log || [],
    memory: keep?.memory || { used: [], cats: [] },
  };
}

// ============================ GAME ============================
// createGame({ state?, onChange(S), now() }) → { state, dispatch(action), resume(), stop() }
// dispatch returns { error } when an action is refused for a reason the player should see.
export function createGame({ state, onChange = () => {}, now = () => Date.now() } = {}) {
  let S = state || freshState();
  let timers = [];
  let depth = 0;

  const run = fn => { depth++; let r; try { r = fn(); } finally { depth--; } if (!depth) onChange(S); return r; };
  const later = (ms, fn) => { const t = setTimeout(() => { timers = timers.filter(x => x !== t); run(fn); }, Math.max(0, ms)); timers.push(t); };
  const stop = () => { timers.forEach(clearTimeout); timers = []; };
  const err = error => ({ error });

  const P = id => S.players.find(p => p.id === id);
  const nameOf = id => P(id)?.name ?? '?';
  const connected = () => S.players.filter(p => p.connected);
  const cur = () => S.categories.find(c => c.id === S.current?.catId)?.clues[S.current.idx];
  const log = msg => { S.log.push({ t: now(), msg }); if (S.log.length > CONFIG.logMax) S.log.splice(0, S.log.length - CONFIG.logMax); };
  const sfx = kind => { S.sfx = { n: S.sfx.n + 1, kind }; };

  // Judge = reader. Never the picker: anyone else connected, fewest judge turns first, tie random.
  // Chosen when a picker's turn starts (so the board can say who judges); counted when the clue is picked.
  function chooseJudge(picker) {
    const cands = connected().filter(p => p.id !== picker).sort((x, y) => x.judged - y.judged || Math.random() - 0.5);
    return cands[0]?.id ?? null;
  }
  function setPicker(pid) { S.picker = pid; S.judge = chooseJudge(pid); }

  // ---------- lobby: one category each, everyone Ready, then top up to targetCategories ----------
  const hasCat = pid => S.categories.some(c => c.by === pid);
  const boardFull = () => S.categories.length >= CONFIG.maxCategories;
  const canReady = pid => hasCat(pid) || boardFull();
  const extraTurn = () => (S.extra ? S.extra.queue[S.extra.i % S.extra.queue.length] : null);

  // Runs after anything that could change who's ready or what's on the board. Starts the game when it can.
  function lobbyCheck() {
    if (S.phase !== 'lobby') return;
    const live = connected();
    if (live.length < CONFIG.minPlayers) return;
    // Everyone in the room, not just who's connected: a locked phone shouldn't get skipped. (Empty seats can be cleared with ×.)
    if (!S.players.every(p => S.ready.includes(p.id) && canReady(p.id))) return;
    if (S.categories.length < CONFIG.targetCategories) {
      if (!S.extra) {
        S.extra = { queue: live.map(p => p.id).sort(() => Math.random() - 0.5), i: 0 };
        log(`everyone's ready · ${CONFIG.targetCategories - S.categories.length} more categor${CONFIG.targetCategories - S.categories.length === 1 ? 'y' : 'ies'} needed`);
      }
      // skip anyone in the queue who isn't here
      for (let n = 0; n < S.extra.queue.length && !P(extraTurn())?.connected; n++) S.extra.i++;
      return;
    }
    if (S.extra) { S.extra = null; }
    if (S.categories.every(c => c.status === 'ready')) begin();
  }

  function begin() {
    S.players.forEach(p => { p.score = 0; p.judged = 0; });
    S.ready = []; S.extra = null;
    S.phase = 'board';
    setPicker(pick(connected()).id);
    log(`game start · ${nameOf(S.picker)} picks first, ${nameOf(S.judge)} judges`);
  }

  function open(at) {
    S.phase = 'buzz';
    S.buzz.openAt = at; S.buzz.presses = {}; S.buzz.winner = null;
    log(S.buzz.guessed.length ? `steal · open for ${S.players.filter(p => p.id !== S.judge && !S.buzz.guessed.includes(p.id)).map(p => p.name).join(', ')}` : 'buzzers open');
    const round = S.round;
    later(at + CONFIG.buzzTimeoutMs - now(), () => {
      if (S.phase === 'buzz' && S.round === round && S.buzz.openAt === at && !Object.keys(S.buzz.presses).length) nobody();
    });
  }

  function nobody() {
    log('nobody gets it');
    S.lastResult = { who: null };
    sfx('nobody');
    reveal(S.picker);
  }

  function reveal(nextPicker) {
    S.phase = 'reveal'; S.nextPicker = nextPicker; S.holding = false;
    const round = S.round;
    later(CONFIG.revealMs, () => { if (S.phase === 'reveal' && S.round === round) advance(); });
  }

  // Who picks next: in a two-player game it alternates every clue; otherwise the correct
  // answerer (or the same picker if nobody got it).
  function advance() {
    const live = connected();
    let next = live.length === 2 ? live.find(p => p.id !== S.picker)?.id : S.nextPicker;
    if (!P(next)?.connected) next = pick(live)?.id ?? S.nextPicker;
    const left = S.categories.some(c => c.clues.some(q => !q.used));
    S.phase = left ? 'board' : 'over';
    S.current = null; S.answerDeadline = null;
    if (left) { setPicker(next); log(`${nameOf(S.picker)} picks next · ${nameOf(S.judge)} judges`); }
    else { S.judge = null; log('board cleared · game over'); }
  }

  function resolveBuzz() {
    if (S.phase !== 'buzz' || S.buzz.winner) return;
    const entries = Object.entries(S.buzz.presses).sort((x, y) => x[1] - y[1]);
    if (!entries.length) return;
    const winner = entries[0][0];
    S.buzz.winner = winner; S.buzz.guessed.push(winner);
    S.phase = 'answering';
    S.answerDeadline = now() + CONFIG.answerSecs * 1000;
    sfx('buzz');
    log(`${nameOf(winner)} wins the buzz (${entries.map(e => `${nameOf(e[0])} +${Math.round(e[1])}ms`).join(', ')}) · ${nameOf(S.judge)} judges`);
  }

  // Someone is back: if the picker, judge or category-adder is still missing, start their grace period again.
  function rearmAway() {
    S.players.filter(q => !q.connected && (q.id === S.judge || q.id === S.picker || q.id === extraTurn())).forEach(q => later(CONFIG.awayGraceMs, () => away(q.id)));
  }

  // A picker, judge or category-adder who dropped and didn't come back within the grace period.
  // If nobody at all is connected (everyone's screen locked), do nothing: whoever comes back re-arms this.
  function away(pid) {
    const p = P(pid); if (!p || p.connected || !connected().length) return;
    if (S.phase === 'lobby' && extraTurn() === pid) { S.extra.i++; log(`${p.name} is away · skipping their extra category`); lobbyCheck(); }
    if (S.phase === 'board' && S.picker === pid) {
      setPicker(pick(connected()).id); log(`${p.name} is away · ${nameOf(S.picker)} picks instead`);
    } else if (S.phase === 'board' && S.judge === pid) {
      S.judge = chooseJudge(S.picker); log(`${p.name} is away · ${nameOf(S.judge)} judges instead`);
    }
    if (['reading', 'buzz', 'answering'].includes(S.phase) && S.judge === pid) {
      const cands = connected().filter(q => q.id !== S.buzz.winner).sort((x, y) => (x.id === S.picker) - (y.id === S.picker) || x.judged - y.judged || Math.random() - 0.5);
      if (!cands.length) { log(`${p.name} (judge) is away and nobody can cover`); return nobody(); }
      const j = cands[0]; j.judged++;
      S.judge = j.id; S.holding = false;
      delete S.buzz.presses[j.id];
      log(`${p.name} (judge) is away · ${j.name} judges now`);
    }
  }

  function reduce(a) {
    const t = now();
    switch (a.type) {
      // ---------- people ----------
      case 'join': {
        const name = clean(a.name, CONFIG.maxNameLen); if (!name) return err('Pick a name first.');
        const clash = S.players.find(q => q.id !== a.by && q.name.toLowerCase() === name.toLowerCase());
        if (clash) return err(`Someone called ${clash.name} is already in this room.`);
        const taken = S.players.filter(q => q.id !== a.by).map(q => q.color);
        const color = CONFIG.colors.includes(a.color) && !taken.includes(a.color) ? a.color : (CONFIG.colors.find(c => !taken.includes(c)) || CONFIG.colors[0]);
        const p = P(a.by);
        if (p) { const back = !p.connected; Object.assign(p, { name, color, connected: true, key: a.key ?? p.key }); if (back) { log(`${name} is back`); rearmAway(); } }
        else {
          if (S.players.length >= CONFIG.maxPlayers) return err('This room is full.');
          S.players.push({ id: a.by, name, color, score: 0, judged: 0, connected: true, key: a.key ?? null, clock: null });
          log(`${name} joined`);
        }
        return { color };
      }
      case 'presence': {
        const p = P(a.by); if (!p || p.connected === a.connected) return;
        p.connected = a.connected;
        if (!a.connected) { log(`${p.name} dropped`); later(CONFIG.awayGraceMs, () => away(a.by)); }
        else { log(`${p.name} is back`); rearmAway(); }
        return;
      }
      case 'kick': {
        if (S.phase !== 'lobby') return;
        const p = P(a.target); if (!p || p.connected) return;
        S.players = S.players.filter(q => q.id !== p.id);
        S.ready = S.ready.filter(id => id !== p.id);
        log(`${nameOf(a.by)} cleared ${p.name}'s empty seat`);
        lobbyCheck();
        return;
      }
      case 'clock': {
        const p = P(a.by); if (p) p.clock = { offset: Math.round(num(a.offset, 0)), rtt: Math.round(num(a.rtt, 0)) };
        return;
      }

      // ---------- lobby ----------
      case 'addCategory': {
        if (S.phase !== 'lobby') return;
        const name = clean(a.name, CONFIG.maxCategoryLen); if (!name) return;
        const isTurn = extraTurn() === a.by && S.categories.length < CONFIG.targetCategories;
        if (hasCat(a.by) && !isTurn) return err(S.extra ? `It's ${nameOf(extraTurn())}'s turn to add one.` : 'One category each. Tap Ready when you\'re set.');
        if (S.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return err(`"${name}" is already on the board.`);
        if (boardFull()) return err(`The board is full (${CONFIG.maxCategories} categories).`);
        const cat = { id: clean(a.id, 20) || newId('c'), name, by: a.by, status: 'generating', source: null, clues: [] };
        S.categories.push(cat);
        S.memory.cats = [name, ...S.memory.cats.filter(n => n.toLowerCase() !== name.toLowerCase())].slice(0, CONFIG.memoryCats);
        log(`${nameOf(a.by)} added "${name}"${isTurn ? ' (extra)' : ''} · searching…`);
        if (isTurn) S.extra.i++;
        lobbyCheck();
        return { catId: cat.id };
      }
      case 'generated': {
        const cat = S.categories.find(c => c.id === a.catId); if (!cat || cat.status !== 'generating') return;
        const clues = Array.isArray(a.clues) ? a.clues.slice(0, CONFIG.values.length) : [];
        if (clues.length !== CONFIG.values.length || clues.some(q => !q?.clue || !q?.answer)) return err('Clue generation came back broken.');
        cat.clues = clues.map((q, i) => ({ clue: clean(q.clue, 400), answer: clean(q.answer, 80), alts: (Array.isArray(q.alts) ? q.alts : []).map(x => clean(x, 80)).filter(Boolean).slice(0, 4), value: CONFIG.values[i], used: false }));
        cat.status = 'ready'; cat.source = clean(a.source, 60);
        log(`"${cat.name}" ready · ${cat.source}${a.note ? ' · ' + clean(a.note, 80) : ''}`);
        lobbyCheck();
        return;
      }
      case 'removeCategory': {
        if (S.phase !== 'lobby') return;
        const cat = S.categories.find(c => c.id === a.catId); if (!cat) return;
        // Only your own, or anyone's if they've left; removing yours un-readies you so you can add another.
        if (cat.by !== a.by && P(cat.by)?.connected) return err(`That's ${nameOf(cat.by)}'s category.`);
        S.categories = S.categories.filter(c => c !== cat);
        S.ready = S.ready.filter(id => id !== cat.by);
        log(`${nameOf(a.by)} removed "${cat.name}"`);
        lobbyCheck();
        return;
      }
      case 'ready': {
        if (S.phase !== 'lobby') return;
        if (a.ready === false) { S.ready = S.ready.filter(id => id !== a.by); return; }
        if (!canReady(a.by)) return err('Add your category first.');
        if (!S.ready.includes(a.by)) { S.ready.push(a.by); log(`${nameOf(a.by)} is ready`); }
        lobbyCheck();
        return;
      }

      // ---------- a clue ----------
      case 'pickClue': {
        if (S.phase !== 'board') return;
        const pickerAway = !P(S.picker)?.connected;
        if (a.by !== S.picker && !pickerAway) return;
        const cat = S.categories.find(c => c.id === a.catId); const q = cat?.clues[a.idx];
        if (!q || q.used) return;
        const judge = S.judge && S.judge !== a.by && P(S.judge)?.connected ? S.judge : chooseJudge(a.by);
        if (!judge) return err('Need someone else here to judge.');
        q.used = true;
        S.memory.used = [...S.memory.used.filter(id => id !== clueId(cat.name, q.answer)), clueId(cat.name, q.answer)].slice(-CONFIG.memoryAnswers);
        S.picker = a.by;
        S.judge = judge; P(judge).judged++;
        S.round++;
        S.current = { catId: cat.id, idx: a.idx };
        S.buzz = emptyBuzz();
        S.holding = false; S.answerDeadline = null; S.lastResult = null;
        S.phase = 'reading';
        log(`${nameOf(a.by)} picks ${cat.name} for ${q.value} · ${nameOf(S.judge)} reads and judges`);
        return;
      }
      case 'holdStart': {
        if (S.phase !== 'reading' || a.by !== S.judge) return;
        if (!S.holding) log(`${nameOf(a.by)} is reading`);
        S.holding = true;
        return;
      }
      case 'holdEnd': {
        if (S.phase !== 'reading' || a.by !== S.judge || !S.holding) return;
        S.holding = false;
        // The judge's phone stamps the release on the synced clock; trust it within reason.
        const at = Math.min(Math.max(num(a.at, t), t - 2000), t);
        open(at + CONFIG.openDelayMs);
        return;
      }
      case 'reread': {
        if (!CONFIG.rereadBeforeFirstBuzz || S.phase !== 'buzz' || a.by !== S.judge) return;
        if (S.buzz.guessed.length || Object.keys(S.buzz.presses).length) return err('Someone already buzzed.');
        S.buzz = emptyBuzz(); S.phase = 'reading'; S.holding = false;
        log(`${nameOf(a.by)} is re-reading · buzzers closed`);
        return;
      }
      case 'press': {
        const p = P(a.by); if (!p) return;
        if (S.phase !== 'buzz' && S.phase !== 'reading') return;
        if (a.by === S.judge || S.buzz.guessed.includes(a.by)) return;
        const at = Math.min(num(a.at, t), t); // a press can't come from the future
        if ((S.buzz.lockedUntil[a.by] || 0) > at) return;
        if (S.phase === 'reading' || at < S.buzz.openAt) {
          S.buzz.lockedUntil[a.by] = at + CONFIG.earlyLockoutMs;
          log(`${p.name} buzzed early${S.buzz.openAt ? ` (${Math.round(S.buzz.openAt - at)}ms before open)` : ''} · locked ${CONFIG.earlyLockoutMs}ms`);
          return;
        }
        if (S.buzz.winner || S.buzz.presses[a.by] != null) return;
        S.buzz.presses[a.by] = at - S.buzz.openAt;
        log(`${p.name} pressed +${Math.round(at - S.buzz.openAt)}ms (arrived +${Math.round(t - S.buzz.openAt)}ms, rtt ${p.clock?.rtt ?? '?'}ms)`);
        if (Object.keys(S.buzz.presses).length === 1) later(CONFIG.collectWindowMs, resolveBuzz);
        return;
      }
      case 'rule': {
        if (S.phase !== 'answering' || a.by !== S.judge) return;
        const q = cur(); const w = S.buzz.winner; const late = t > S.answerDeadline;
        if (a.right) {
          P(w).score += q.value; S.lastResult = { who: w, right: true };
          sfx('right');
          log(`${nameOf(S.judge)} rules CORRECT${late ? ' (after time)' : ''} · ${nameOf(w)} +${q.value}`);
          reveal(w);
        } else {
          P(w).score -= q.value; S.lastResult = { who: w, right: false };
          sfx('wrong');
          log(`${nameOf(S.judge)} rules INCORRECT${late ? ' (out of time)' : ''} · ${nameOf(w)} −${q.value}`);
          const remaining = connected().filter(p => p.id !== S.judge && !S.buzz.guessed.includes(p.id));
          S.answerDeadline = null;
          if (remaining.length) open(t + CONFIG.openDelayMs);
          else nobody();
        }
        return;
      }

      // ---------- between games ----------
      case 'end': {
        if (S.phase !== 'board') return;
        S.phase = 'over'; log(`${nameOf(a.by)} ended the game`);
        return;
      }
      case 'again': {
        if (S.phase !== 'over') return;
        const players = S.players.map(p => ({ ...p, score: 0, judged: 0 }));
        stop();
        S = Object.assign(S, freshState(S), { players });
        log(`${nameOf(a.by)} started a new game`);
        return;
      }
    }
  }

  // After a restore from storage, timers are gone. Put back the ones the current phase needs.
  function resume() {
    run(() => {
      S.players.forEach(p => { p.connected = false; later(CONFIG.awayGraceMs, () => away(p.id)); });
      if (S.phase === 'buzz') {
        if (Object.keys(S.buzz.presses).length) later(0, resolveBuzz);
        else { const at = S.buzz.openAt, round = S.round; later(at + CONFIG.buzzTimeoutMs - now(), () => { if (S.phase === 'buzz' && S.round === round && !Object.keys(S.buzz.presses).length) nobody(); }); }
      }
      if (S.phase === 'reveal') { const round = S.round; later(500, () => { if (S.phase === 'reveal' && S.round === round) advance(); }); }
      if (S.phase === 'reading') S.holding = false;
    });
  }

  return {
    get state() { return S; },
    dispatch: a => run(() => reduce(a)),
    resume,
    stop,
  };
}

// What one phone is allowed to see. Unused clues are blank; the current clue's text reaches
// non-judges only once buzzers open, and its answer only at reveal. pid null = observer.
export function viewFor(S, pid) {
  const V = JSON.parse(JSON.stringify(S));
  const judge = pid != null && pid === S.judge;
  let curId = null;
  V.categories.forEach(c => c.clues.forEach((q, i) => {
    const isCur = S.current && S.current.catId === c.id && S.current.idx === i;
    if (isCur) {
      curId = clueId(c.name, q.answer);
      if (!judge && !['buzz', 'answering', 'reveal'].includes(S.phase)) q.clue = null;
      if (!judge && S.phase !== 'reveal') { q.answer = null; q.alts = []; }
    } else if (!q.used) { q.clue = null; q.answer = null; q.alts = []; }
  }));
  if (curId && S.phase !== 'reveal') V.memory.used = V.memory.used.filter(id => id !== curId);
  V.players.forEach(p => { delete p.key; });
  return V;
}
