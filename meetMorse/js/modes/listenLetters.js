import { shuffled } from '../data/words.js';
import { makeTapMode } from './tapShared.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// "Listen · Letters" — pure recognition. Hear a single letter, tap the
// node on the tree that matches. No reproduction; no key.
export const listenLetters = makeTapMode({
  id: 'listenLetters',
  name: 'Listen · Letters',
  description: 'Hear a letter, tap the matching node on the tree.',
  getPool: () => shuffled(ALPHABET),
  scoreKey: 'listenLettersStreak',
});
