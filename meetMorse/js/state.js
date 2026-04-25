// Single shared mutable state object.
// All modules import this and mutate directly. Each mutation is
// followed by a call to whichever render function in js/ui/ owns
// the affected DOM. There's no diffing — the renderers just write
// classes/attributes based on current state.
export const state = {
  view: 'home',           // 'home' | 'game'
  pressing: false,
  currentCode: '',        // e.g. ".-" being built up
  tape: [],               // committed letters, scrolling right
  errorCode: null,        // briefly set when an invalid code is committed
  committedCode: null,    // briefly set right after a successful letter commit

  // ephemeral input timing — not view-dependent, lives on state for clarity
  pressStartMs: null,
  autoCommitTimer: null,
  errorTimer: null,
  committedTimer: null,
};
