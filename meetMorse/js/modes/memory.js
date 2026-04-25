import { makeTimedMode } from './timedShared.js';

// "Memory" — same 10-word scored run as Timed WPM, but the tree is
// hidden. The user has to recall codes from memory; for users who've
// graduated from the tree.
export const memory = makeTimedMode({
  id: 'memory',
  name: 'Memory',
  description: 'Spell 10 words with the tree hidden. Best WPM is saved.',
  showTree: false,
  scoreKey: 'memoryWpmBest',
});
