import { guidedWord } from './guidedWord.js';

// Same flow as Guided Word, but the tree dims every node/edge that isn't
// part of the path to one of the letters in the current target word.
// The behavioral hooks are inherited verbatim — only the visual flag and
// surface-level identity differ.
export const focusedWord = {
  ...guidedWord,
  id: 'focusedWord',
  name: 'Focused Word',
  description: 'Like Guided Word, but only the letters you need are visible.',
  focusOnTargetWord: true,
};
