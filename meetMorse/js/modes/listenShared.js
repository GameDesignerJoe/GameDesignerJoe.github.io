import { state } from '../state.js';
import { LETTER_TO_CODE } from '../data/morseTree.js';
import { audioEngine } from '../engines/audioEngine.js';
import { saveScores } from '../lib/storage.js';
import { renderTree } from '../ui/tree.js';
import { renderWord } from '../ui/wordDisplay.js';
import { renderListeningStatus } from '../ui/listening.js';

export const PLAY_DIT_MS = 100;        // 12 WPM
const NEXT_DELAY_MS = 800;
const PLAY_LEAD_MS = 250;

// Replay the current target. Works for both letter and word modes since
// audioEngine.playWord handles both (a 1-char "word" is a single letter).
export function replayCurrentWord() {
  if (!state.currentWord) return;
  audioEngine.playWord(state.currentWord, PLAY_DIT_MS);
}

// Factory for any "listen, then transcribe" mode. Differences between
// letter and word variants live in config (pool source + score key).
export function makeListeningMode(config) {
  let pool = [];
  let pendingTimer = null;

  function clearPending() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function pickNext() {
    if (pool.length === 0) pool = config.getPool();
    return pool.shift();
  }

  async function startNew() {
    state.currentWord = pickNext();
    state.completedLetters = 0;
    state.currentCode = '';
    state.listeningWordHasError = false;
    renderWord();
    renderTree();
    renderListeningStatus();
    await new Promise((r) => setTimeout(r, PLAY_LEAD_MS));
    if (state.mode === config.id && state.currentWord) {
      audioEngine.playWord(state.currentWord, PLAY_DIT_MS);
    }
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    showTree: true,
    showWord: true,
    showPaperTape: false,
    showTimer: false,
    showReplay: true,
    showListeningStatus: true,
    scored: true,
    available: true,
    targetIsSecret: true,
    scoreKey: config.scoreKey,

    enter() {
      pool = [];
      state.listeningStreakCurrent = 0;
      clearPending();
      startNew();
    },

    exit() {
      clearPending();
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
        if (!state.listeningWordHasError) {
          state.listeningStreakCurrent += 1;
          const best = state.scores[config.scoreKey] || 0;
          if (state.listeningStreakCurrent > best) {
            state.scores[config.scoreKey] = state.listeningStreakCurrent;
            saveScores(state.scores);
          }
        } else {
          state.listeningStreakCurrent = 0;
        }
        renderListeningStatus();
        pendingTimer = setTimeout(startNew, NEXT_DELAY_MS);
      }
      return true;
    },
  };
}
