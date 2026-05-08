// ══════════════════════════════════════════════
// kill.code — engine.js
// Pure rules: deal, deploy, multi-step runner, peg cycling, submit.
// Engine emits bus events; render and audio listen. Engine never touches DOM.
// All state mutation goes through state.js / fx.* / engine itself.
// ══════════════════════════════════════════════

import { state, resetState } from './state.js';
import { K, DECK_SRC, MAX_ROWS_DEFAULT, SECRET_LEN } from './config.js';
import { shuffle, randInt } from './rng.js';
import { bus } from './bus.js';
import { fx } from './effects.js';
import { enterPhase } from './phases.js';
import { getCard } from './cards/_registry.js';

// ── Pure helpers ─────────────────────────────────
function nextColour(current){
  const avail = K.map((_, i) => i).filter(i => !state.eliminated.includes(i));
  if(!avail.length) return current;
  if(current === -1) return avail[0];
  const pos = avail.indexOf(current);
  if(pos === -1) return avail[0];
  return avail[(pos + 1) % avail.length];
}

function checkGuess(g, c){
  let exact = 0;
  const cc = [...c], gc = [...g];
  for(let i = 0; i < SECRET_LEN; i++) if(gc[i] === cc[i]){ exact++; cc[i] = gc[i] = -1; }
  let miss = 0;
  for(let i = 0; i < SECRET_LEN; i++){
    if(gc[i] === -1) continue;
    const x = cc.indexOf(gc[i]);
    if(x !== -1){ miss++; cc[x] = -1; }
  }
  return { exact, miss };
}

// ── Lifecycle ────────────────────────────────────
export function newGame(){
  resetState({
    secret:      Array.from({ length: SECRET_LEN }, () => randInt(K.length)),
    deck:        shuffle([...DECK_SRC]),
    hand:        [],
    rows:        [],
    maxRows:     MAX_ROWS_DEFAULT,
    cur:         [-1,-1,-1,-1],
    locked:      [false,false,false,false],
    rooted:      [null,null,null,null],
    eliminated:  [],
    phase:       '',
    selCard:     null,
    probeSlot:   null,
    cardCtx:     null,
    phaseReturn: null,
    over:        false,
    flags:       {},
  });
  state.hand.push(state.deck.pop());
  startTurn({ firstTurn: true });
}

export function startTurn({ firstTurn = false } = {}){
  state.cur     = state.rooted.map(c => c == null ? -1 : c);
  state.locked  = state.rooted.map(c => c != null);
  state.selCard = null;
  state.cardCtx = null;
  if(state.deck.length > 0) state.hand.push(state.deck.pop());
  enterPhase('play-card');                                          // resting phase BEFORE any narrative
  if(firstTurn) bus.emit('game.started', { secret: state.secret }); // narrative captures returnTo='play-card'
  bus.emit('turn.started', { rowIndex: state.rows.length });
}

// ── Hand interaction ─────────────────────────────
export function selectHandCard(handIndex){
  // Clicking a card during play-card or mid-step toggles selection.
  if(state.phase !== 'play-card' && state.phase !== 'card-step') return;
  state.selCard = state.selCard === handIndex ? null : handIndex;
  bus.emit('card.selected', { cardId: state.hand[handIndex] ?? null, handIndex });
}

export function deployCard(){
  if(state.selCard === null || state.phase !== 'play-card') return;
  const handIndex = state.selCard;
  const cardId    = state.hand[handIndex];
  const card      = getCard(cardId);
  if(!card) return;

  bus.emit('sfx.deploy');

  if(Array.isArray(card.steps) && card.steps.length){
    // Multi-step card. Engine holds onto the hand index so we can splice on completion.
    state.cardCtx = { cardId, handIndex, stepIndex: 0, scratch: {} };
    enterPhase('card-step');
    return;
  }

  // Single-shot: remove from hand, resolve, advance to guess.
  state.hand.splice(handIndex, 1);
  state.selCard = null;
  card.onResolve(state, fx);
  bus.emit('card.deployed', { cardId, rowIndex: state.rows.length });
  enterPhase('guess');
}

export function pickStepChoice(value){
  if(state.phase !== 'card-step' || !state.cardCtx) return;
  const { cardId, stepIndex, scratch } = state.cardCtx;
  const card = getCard(cardId);
  if(!card) return;
  const step = card.steps[stepIndex];
  if(!step) return;

  step.pick(value, state, fx, scratch);
  bus.emit('step.advanced', { cardId, stepIndex, value });

  if(stepIndex + 1 < card.steps.length){
    state.cardCtx.stepIndex = stepIndex + 1;
    return;   // step.advanced already emitted; render listens for it
  }

  // Last step: remove the card from hand, clear ctx, deploy, advance to guess.
  const handIndex = state.cardCtx.handIndex;
  if(typeof handIndex === 'number' && state.hand[handIndex] === cardId){
    state.hand.splice(handIndex, 1);
  } else {
    // Defensive: if the index drifted, fall back to first match.
    const i = state.hand.indexOf(cardId);
    if(i !== -1) state.hand.splice(i, 1);
  }
  state.selCard = null;
  bus.emit('sfx.deploy');
  bus.emit('card.deployed', { cardId, rowIndex: state.rows.length });
  enterPhase('guess');
}

// ── Guess interaction ────────────────────────────
export function cyclePeg(slot){
  if(state.phase !== 'guess' || state.locked[slot]) return;
  state.cur[slot] = nextColour(state.cur[slot]);
  bus.emit('peg.cycled', { slot, ci: state.cur[slot] });
}

export function purgeGuess(){
  for(let i = 0; i < SECRET_LEN; i++){
    if(!state.locked[i]) state.cur[i] = -1;
  }
  bus.emit('guess.purged');
}

export function submitGuess(){
  if(state.phase !== 'guess' || state.cur.some(v => v === -1)) return;
  const fb = checkGuess(state.cur, state.secret);
  state.rows.push({ guess: [...state.cur], feedback: fb });
  bus.emit('guess.submitted', { guess: [...state.cur], feedback: fb, rowIndex: state.rows.length - 1 });

  if(fb.exact === SECRET_LEN){
    enterPhase('done', { outcome: 'won' });
    bus.emit('game.won',  { rows: state.rows });
    return;
  }
  if(state.rows.length >= state.maxRows){
    enterPhase('done', { outcome: 'lost' });
    bus.emit('game.lost', { rows: state.rows });
    return;
  }
  startTurn();
}
