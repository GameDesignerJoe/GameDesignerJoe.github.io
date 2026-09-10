// The Maze — the water between phases
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── pool scene ──────────────────────────────────────────────────
let poolStep = 0, poolScript = null;
function poolSet(say, choices, onPick) {
  $('poolSay').textContent = say; const box = $('poolChoices'); box.innerHTML = '';
  choices.forEach(([label, cls], i) => { const b = document.createElement('button'); if (cls) b.className = cls; b.textContent = label; b.addEventListener('click', () => onPick(i)); box.appendChild(b); });
}
function startPool() {
  const idx = Math.min(SAVE.stones || 0, POOLS.length - 1); poolScript = POOLS[idx]; poolStep = 0;
  $('pool').classList.remove('clear'); $('poolWho').textContent = poolScript.who; $('poolKeeper').textContent = 'The Caretaker sits at the edge and says nothing.';
  $('pool').classList.add('show'); AUDIO.poolEnter();
  poolSet(poolScript.open, [['…', 'chalk']], () => poolExchange(0));
}
function poolExchange(i) {
  const ex = poolScript.ex[i];
  if (!ex) return poolSet('Put the stone down.', [['I put it down.', 'chalk']], poolDrop);
  poolSet(ex.say, ex.choices.map(c => [c]), pick => poolSet(ex.reply[pick], [['…', 'chalk']], () => poolExchange(i + 1)));
}
function poolDrop() {
  $('pool').classList.add('clear'); AUDIO.stoneDrop();
  const stoneName = STONES[Math.min(SAVE.stones || 0, STONES.length - 1)];
  setTimeout(() => {
    $('poolKeeper').textContent = 'The Caretaker nods once.';
    poolSet(poolScript.close, [['Wake', 'chalk']], () => {
      // remember that one just came off, so the next waking can show it: the light opens and
      // the pull-out takes its time. Without that the upgrade never reads — you simply play on.
      SAVE.lifted = SAVE.stones || 0;
      SAVE.stones = Math.min(STONES.length, (SAVE.stones || 0) + 1); SAVE.phase = Math.min(PHASES.length - 1, (SAVE.phase || 0) + 1); SAVE.poolPending = false; persist();
      $('pool').classList.remove('show'); reset((Math.random()*1e9)|0); enterMaze();
    });
  }, 1500);
}

