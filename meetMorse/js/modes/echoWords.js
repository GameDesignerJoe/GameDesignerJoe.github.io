import { ALL_WORDS, shuffled } from '../data/words.js';
import { makeEchoMode } from './echoShared.js';

// "Echo · Words" — hear a full word, reproduce it on the telegraph key
// without errors. The harder Echo variant.
export const echoWords = makeEchoMode({
  id: 'echoWords',
  name: 'Echo · Words',
  description: 'Hear a word, reproduce it on the telegraph key.',
  getPool: () => shuffled(ALL_WORDS),
  scoreKey: 'echoWordsStreak',
});
