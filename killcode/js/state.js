// ══════════════════════════════════════════════
// kill.code — state.js
// Single shared mutable game state. No imports.
// All modules import and mutate `state` directly.
// JSON-safe shape (no Sets, Maps, functions, DOM refs)
// so JSON.stringify(state) round-trips for save/resume.
// ══════════════════════════════════════════════

export const state = {
  // Game core
  secret:     [],                          // Array<int> length 4 — colour indices
  deck:       [],                          // Array<cardId>
  hand:       [],                          // Array<cardId>
  rows:       [],                          // Array<{guess:int[4], feedback:{exact,miss}}>
  maxRows:    5,
  cur:        [-1,-1,-1,-1],               // current row being filled
  locked:     [false,false,false,false],   // which slots are locked this turn
  rooted:     [null,null,null,null],       // persistent ROOT locks: colour idx or null
  eliminated: [],                          // colour indices ghosted out of the pool

  // Phase / interaction
  phase:       '',
  selCard:     null,
  probeSlot:   null,                       // legacy multi-step scratch (PROBE)
  cardCtx:     null,                       // generic multi-step card scratchpad (post-refactor)
  phaseReturn: null,                       // where to return after a 'narrative' phase

  // Outcome
  over: false,                             // false | 'won' | 'lost'

  // Narrative scratch flags (durable per-run)
  flags: {},

  // ICE / Corp counterplay
  iceDeck:      [],                        // Array<iceId> — pop() to draw
  iceLog:       [],                        // Array<{turn, id, message}>
  corpLocked:   [false,false,false,false], // forced-by-Corp slots this turn
  badDataSlots: [],                        // slots blocked from input this turn
};

// Reset state in-place. Used by newGame() so the exported reference stays stable.
export function resetState(initial) {
  // Wipe every key, then apply initial values.
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, initial);
}
