import { makeTimedMode } from './timedShared.js';

// "Timed WPM" — 10-word scored run with the tree visible. Best WPM
// persists at meetmorse:scores.timedWpmBest.
export const timedWpm = makeTimedMode({
  id: 'timedWpm',
  name: 'Timed WPM',
  description: 'Spell 10 words against the clock. Best WPM is saved.',
  showTree: true,
  scoreKey: 'timedWpmBest',
});
