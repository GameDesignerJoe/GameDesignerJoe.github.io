import { ALL_WORDS, shuffled } from '../data/words.js';
import { makeListeningMode } from './listenShared.js';

// "Listen · Words" — the harder variant. Plays a full word; user must
// transcribe the whole thing without errors for the streak to count.
export const listening = makeListeningMode({
  id: 'listening',
  name: 'Listen · Words',
  description: 'Hear a word in Morse, type what you hear.',
  getPool: () => shuffled(ALL_WORDS),
  scoreKey: 'listeningStreak',
});

export { replayCurrentWord } from './listenShared.js';
