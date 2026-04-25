import { shuffled } from '../data/words.js';
import { makeListeningMode } from './listenShared.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// "Listen · Letters" — the easier listening variant. Plays a single
// random letter at a time. Each completed cycle works through all 26
// letters in random order before reshuffling.
export const listenLetters = makeListeningMode({
  id: 'listenLetters',
  name: 'Listen · Letters',
  description: 'Hear a single letter in Morse, type what you hear. Easier ear-training warm-up.',
  getPool: () => shuffled(ALPHABET),
  scoreKey: 'listenLettersStreak',
});
