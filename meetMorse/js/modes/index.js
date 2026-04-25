import { freePlay } from './freePlay.js';
import { guidedWord } from './guidedWord.js';

// Placeholders for the modes we haven't built yet. They appear on the modes
// screen as disabled cards; tapping them does nothing.
const placeholder = (id, name, description) => ({
  id, name, description,
  available: false,
  showTree: true, showWord: false, showPaperTape: true, scored: false,
  enter() {}, exit() {}, onSymbol() { return true; }, onLetterCommit() { return true; },
});

export const MODES = {
  freePlay,
  guidedWord,
  timedWpm: placeholder('timedWpm', 'Timed WPM', 'Race the clock — coming soon.'),
  listening: placeholder('listening', 'Listening', 'Decode by ear — coming soon.'),
  memory: placeholder('memory', 'Memory', 'No tree, no safety net — coming soon.'),
};

export const MODE_ORDER = ['freePlay', 'guidedWord', 'timedWpm', 'listening', 'memory'];

export function getMode(id) {
  return MODES[id] || MODES.freePlay;
}
