// ══════════════════════════════════════════════
// kill.code — phases.js
// Declarative phase machine. All transitions go through enterPhase().
// state.phase remains a serializable string id; the table is metadata.
// ══════════════════════════════════════════════

import { state } from './state.js';
import { bus } from './bus.js';

export const PHASES = {
  // Player chooses a card to deploy.
  'play-card': {
    enter(s){ s.selCard = null; },
  },

  // Corp deck is drawing + resolving. Input is blocked; transient.
  'ice-resolving': {
    enter(){},
    exit(){},
  },

  // Active during a multi-step card. s.cardCtx = { cardId, stepIndex, scratch }.
  'card-step': {
    exit(s){ s.cardCtx = null; },
  },

  // Player fills the current row and submits.
  'guess': {
    enter(s){ s.selCard = null; },
  },

  // Engine paused while a narrative scene is presenting.
  'narrative': {
    enter(s, p){ s.phaseReturn = p?.returnTo ?? null; },
    exit(s){ s.phaseReturn = null; },
  },

  // Run is over. payload.outcome = 'won' | 'lost'.
  'done': {
    enter(s, p){ s.over = p?.outcome ?? false; },
  },
};

export function enterPhase(id, payload = {}){
  const prev = state.phase;
  PHASES[prev]?.exit?.(state, payload);
  state.phase = id;
  PHASES[id]?.enter?.(state, payload);
  bus.emit('phase.changed', { from: prev, to: id });
}
