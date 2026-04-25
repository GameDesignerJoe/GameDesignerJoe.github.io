import { ALL_WORDS, shuffled } from '../data/words.js';
import { makeTapMode } from './tapShared.js';

// "Listen · Words" — hear a full word, tap each letter in order. Replay
// rehears the whole word; one wrong tap breaks the streak.
export const listenWords = makeTapMode({
  id: 'listenWords',
  name: 'Listen · Words',
  description: 'Hear a word, tap the matching letters in order.',
  getPool: () => shuffled(ALL_WORDS),
  scoreKey: 'listenWordsStreak',
});
