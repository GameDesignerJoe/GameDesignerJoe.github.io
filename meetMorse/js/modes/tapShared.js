import { state } from '../state.js';
import { audioEngine } from '../engines/audioEngine.js';
import { saveScores } from '../lib/storage.js';
import { renderTree } from '../ui/tree.js';
import { renderWord } from '../ui/wordDisplay.js';
import { renderListeningStatus } from '../ui/listening.js';
import { flashError, flashCommitted } from '../lib/flash.js';

export const PLAY_DIT_MS = 100;     // 12 WPM
const NEXT_DELAY_MS = 800;
const PLAY_LEAD_MS = 250;

// Factory for "hear, then identify by tapping the tree" modes (Listen).
// No telegraph key — the user touches a node on the tree to commit a
// guess. Streak counts only error-free runs.
export function makeTapMode(config) {
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
    audioEngine.init();
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
    hideKey: true,            // No telegraph key in listen modes
    tappableTree: true,       // Nodes respond to clicks/taps
    scored: true,
    available: true,
    targetIsSecret: true,     // Don't dim or highlight target letters
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

    // The user tapped a tree node. letter is the node's letter, code is
    // its morse code path string.
    onTreeTap(letter, code) {
      if (!state.currentWord) return;
      const target = state.currentWord[state.completedLetters];
      if (letter === target) {
        flashCommitted(code);
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
      } else {
        state.listeningWordHasError = true;
        flashError(code, 'wrong');
      }
    },

    // Telegraph key is hidden in tap modes; these defaults keep the
    // contract intact in case anything else dispatches symbols.
    onSymbol() { return false; },
    onLetterCommit() { return false; },
  };
}
