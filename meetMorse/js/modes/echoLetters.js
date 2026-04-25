import { shuffled } from '../data/words.js';
import { makeEchoMode } from './echoShared.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// "Echo · Letters" — hear a single letter, reproduce its code on the
// telegraph key. The easier Echo warm-up.
export const echoLetters = makeEchoMode({
  id: 'echoLetters',
  name: 'Echo · Letters',
  description: 'Hear a single letter, reproduce its code on the key.',
  getPool: () => shuffled(ALPHABET),
  scoreKey: 'echoLettersStreak',
});
