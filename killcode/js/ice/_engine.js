// ══════════════════════════════════════════════
// kill.code — ice/_engine.js
// ICE deck construction + per-turn resolution.
// Called from engine.startTurn() before the player acts.
// ══════════════════════════════════════════════

import { shuffle }       from '../rng.js';
import { ICE_DECK_SRC }  from '../config.js';
import { getIce }        from './_registry.js';
import { bus }           from '../bus.js';

export function buildIceDeck(){
  return shuffle([...ICE_DECK_SRC]);
}

// Escalation curve:
//   Cycle 1–2: no ICE
//   Cycle 3–4: 1 ICE / turn
//   Cycle 5+:  2 ICE / turn  (also covers BUFFER bonus cycles)
export function iceCountForCycle(cycle){
  if(cycle <= 2) return 0;
  if(cycle <= 4) return 1;
  return 2;
}

// Sequenced resolver — paces ICE one card at a time with beats so the player
// can clearly see each Corp attack land. No per-card overlay anymore: each
// card fires its effect, the board pulses the affected element, and the
// Corp Activity log entry pulses to draw the player's eye.
const POST_SUBMIT_MS = 250;   // beat after submit before the overlay appears
const INTRO_HOLD_MS  = 1100;  // "System Defenses Initiated" hold time
const POST_INTRO_MS  = 250;   // beat between overlay hiding and first action
const SETTLE_MS      = 1500;  // beat after each action so pulses are visible
const OUTRO_MS       = 700;   // beat before play-card returns

export function resolveIceSequence(state, fx, onDone){
  const cycle = state.rows.length + 1;
  const count = iceCountForCycle(cycle);
  const draws = [];
  for(let i = 0; i < count; i++){
    if(!state.iceDeck.length) break;
    draws.push(state.iceDeck.pop());
  }
  if(!draws.length){ onDone(); return; }

  let i = 0;
  const fireNext = () => {
    if(i >= draws.length){
      bus.emit('ice.sequence.end', { cycle });
      setTimeout(onDone, OUTRO_MS);
      return;
    }
    const id  = draws[i++];
    const ice = getIce(id);
    if(!ice){ fireNext(); return; }
    bus.emit('ice.card.starting', { id, name: ice.name });
    ice.onResolve(state, fx);                         // mutates state, emits ice.logged + applied
    bus.emit('ice.card.applied', { id, name: ice.name });
    setTimeout(fireNext, SETTLE_MS);
  };

  setTimeout(() => {
    bus.emit('ice.sequence.start', { cycle, count: draws.length });
    setTimeout(() => {
      bus.emit('ice.sequence.intro-end');
      setTimeout(fireNext, POST_INTRO_MS);
    }, INTRO_HOLD_MS);
  }, POST_SUBMIT_MS);
}
