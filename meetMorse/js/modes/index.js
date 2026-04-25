import { freePlay } from './freePlay.js';
import { alphabet } from './alphabet.js';
import { guidedWord } from './guidedWord.js';
import { timedWpm } from './timedWpm.js';
import { practice } from './practice.js';

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
  practice,
  alphabet,
  guidedWord,
  timedWpm,
  drill: placeholder('drill', 'Drill', 'Cluster of similar-letter words for repetition learning — coming soon.'),
  listening: placeholder('listening', 'Listening', 'Decode by ear — coming soon.'),
  memory: placeholder('memory', 'Memory', 'No tree, no safety net — coming soon.'),
};

export const MODE_ORDER = [
  'freePlay',
  'practice',
  'alphabet',
  'guidedWord',
  'timedWpm',
  'drill',
  'listening',
  'memory',
];

export function getMode(id) {
  return MODES[id] || MODES.freePlay;
}
