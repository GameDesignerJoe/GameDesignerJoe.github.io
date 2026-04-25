import { DEFAULT_SETTINGS } from './lib/storage.js';

// Single shared mutable state object.
// All modules import this and mutate directly. Each mutation is
// followed by a call to whichever render function in js/ui/ owns
// the affected DOM. There's no diffing — the renderers just write
// classes/attributes based on current state.
export const state = {
  view: 'home',           // 'home' | 'modes' | 'game' | 'settings'
  prevView: null,         // for back navigation
  gameBackTarget: 'home', // where the game's BACK button should go

  // active mode in game view
  mode: 'freePlay',       // key into modes registry

  // input
  pressing: false,
  currentCode: '',        // e.g. ".-" being built up

  // free play
  tape: [],               // committed letters, scrolling right

  // guided word
  currentWord: null,      // target word string
  completedLetters: 0,    // index of next letter to spell

  // tree visual flashes
  errorCode: null,        // briefly set on invalid commit / path divergence
  committedCode: null,    // briefly set right after a valid commit
  hintTarget: null,       // code of letter to hint toward (renders amber trail)

  // user settings — replaced by loadSettings() on boot in main.js
  settings: { ...DEFAULT_SETTINGS },

  // ephemeral timers
  pressStartMs: null,
  autoCommitTimer: null,
  errorTimer: null,
  committedTimer: null,
  hintTimer: null,
};
