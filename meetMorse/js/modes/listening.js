import { state } from '../state.js';
import { LETTER_TO_CODE } from '../data/morseTree.js';
import { ALL_WORDS, shuffled } from '../data/words.js';
import { audioEngine } from '../engines/audioEngine.js';
import { saveScores } from '../lib/storage.js';
import { renderTree } from '../ui/tree.js';
import { renderWord } from '../ui/wordDisplay.js';
import { renderListeningStatus } from '../ui/listening.js';

const NEXT_WORD_DELAY_MS = 800;
const PLAY_DIT_MS = 100;          // 12 WPM
const PLAY_LEAD_MS = 250;         // brief silence before the audio starts

let pool = [];

function pickNextWord() {
  if (pool.length === 0) pool = shuffled(ALL_WORDS);
  return pool.shift();
}

async function startNewWord() {
  state.currentWord = pickNextWord();
  state.completedLetters = 0;
  state.currentCode = '';
  state.listeningWordHasError = false;
  renderWord();
  renderTree();
  renderListeningStatus();
  // brief delay before audio plays so the screen finishes settling
  await new Promise((r) => setTimeout(r, PLAY_LEAD_MS));
  // Guard against the user navigating away during the wait
  if (state.mode === 'listening' && state.currentWord) {
    audioEngine.playWord(state.currentWord, PLAY_DIT_MS);
  }
}

export function replayCurrentWord() {
  if (state.mode !== 'listening' || !state.currentWord) return;
  audioEngine.playWord(state.currentWord, PLAY_DIT_MS);
}

export const listening = {
  id: 'listening',
  name: 'Listening',
  description: 'Hear a word in Morse, type what you hear.',
  showTree: true,
  showWord: true,
  showPaperTape: false,
  showTimer: false,
  showReplay: true,
  showListeningStatus: true,
  scored: true,
  available: true,

  // Tree should NOT dim non-target letters here (that would reveal the
  // answer). The word display also blanks future letters (underscores).
  targetIsSecret: true,

  enter() {
    pool = [];
    state.listeningStreakCurrent = 0;
    startNewWord();
  },

  exit() {
    audioEngine.stopTone();
    state.currentWord = null;
    state.completedLetters = 0;
    state.listeningWordHasError = false;
  },

  onSymbol() {
    if (!state.currentWord) return true;
    const target = state.currentWord[state.completedLetters];
    if (!target) return true;
    const targetCode = LETTER_TO_CODE[target];
    if (!targetCode) return true;
    if (!targetCode.startsWith(state.currentCode)) {
      state.listeningWordHasError = true;
      return false;
    }
    return true;
  },

  onLetterCommit(letter) {
    if (!state.currentWord) return true;
    const target = state.currentWord[state.completedLetters];
    if (letter !== target) {
      state.listeningWordHasError = true;
      return false;
    }
    state.completedLetters += 1;
    renderWord();
    if (state.completedLetters >= state.currentWord.length) {
      // Word done. Streak counts only error-free runs.
      if (!state.listeningWordHasError) {
        state.listeningStreakCurrent += 1;
        if (state.listeningStreakCurrent > state.scores.listeningStreak) {
          state.scores.listeningStreak = state.listeningStreakCurrent;
          saveScores(state.scores);
        }
      } else {
        state.listeningStreakCurrent = 0;
      }
      renderListeningStatus();
      setTimeout(startNewWord, NEXT_WORD_DELAY_MS);
    }
    return true;
  },
};
