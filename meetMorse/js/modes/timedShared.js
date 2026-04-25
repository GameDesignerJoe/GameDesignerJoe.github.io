import { state } from '../state.js';
import { LETTER_TO_CODE } from '../data/morseTree.js';
import { ALL_WORDS, shuffled } from '../data/words.js';
import { renderTree } from '../ui/tree.js';
import { renderWord } from '../ui/wordDisplay.js';
import { renderTimerStatus } from '../ui/timer.js';
import { showResults } from '../ui/results.js';
import { calculateWpm } from '../lib/timing.js';
import { saveScores } from '../lib/storage.js';

const TOTAL_WORDS = 10;
const NEXT_WORD_DELAY_MS = 500;
const FINISH_DELAY_MS = 250;
const TIMER_TICK_MS = 250;

// Factory for "scored 10-word run with a live timer" modes. Differences
// between Timed WPM (tree visible) and Memory (tree hidden) are expressed
// in config.
export function makeTimedMode(config) {
  let pool = [];
  let timerInterval = null;

  function pickNextWord() {
    if (pool.length === 0) pool = shuffled(ALL_WORDS);
    return pool.shift();
  }

  function ensureTimerStarted() {
    if (state.timedStartMs != null) return;
    state.timedStartMs = performance.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      state.timedElapsedMs = performance.now() - state.timedStartMs;
      renderTimerStatus();
    }, TIMER_TICK_MS);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startNewWord() {
    state.currentWord = pickNextWord();
    state.completedLetters = 0;
    state.currentCode = '';
    renderWord();
    renderTree();
    renderTimerStatus();
  }

  function finish() {
    stopTimer();
    if (state.timedStartMs != null) {
      state.timedElapsedMs = performance.now() - state.timedStartMs;
    }
    const elapsedMs = state.timedElapsedMs;
    const wpm = calculateWpm(state.timedCharCount, elapsedMs);

    const previousBest = state.scores[config.scoreKey] || 0;
    const isNewHighScore = wpm > previousBest;
    if (isNewHighScore) {
      state.scores[config.scoreKey] = wpm;
      saveScores(state.scores);
    }

    state.lastResult = {
      wpm,
      elapsedMs,
      errors: state.timedErrors,
      isNewHighScore,
      bestKey: config.scoreKey,
    };

    showResults();
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    showTree: config.showTree !== false,
    showWord: true,
    showPaperTape: false,
    showTimer: true,
    scored: true,
    available: true,
    scoreKey: config.scoreKey,

    enter() {
      pool = [];
      state.timedStartMs = null;
      state.timedElapsedMs = 0;
      state.timedWordsCompleted = 0;
      state.timedTotalWords = TOTAL_WORDS;
      state.timedCharCount = 0;
      state.timedErrors = 0;
      stopTimer();
      startNewWord();
    },

    exit() {
      stopTimer();
      state.currentWord = null;
      state.completedLetters = 0;
    },

    onSymbol() {
      ensureTimerStarted();
      if (!state.currentWord) return true;
      const target = state.currentWord[state.completedLetters];
      if (!target) return true;
      const targetCode = LETTER_TO_CODE[target];
      if (!targetCode) return true;
      if (!targetCode.startsWith(state.currentCode)) {
        state.timedErrors += 1;
        return false;
      }
      return true;
    },

    onLetterCommit(letter) {
      if (!state.currentWord) return true;
      const target = state.currentWord[state.completedLetters];
      if (letter !== target) {
        state.timedErrors += 1;
        return false;
      }
      state.completedLetters += 1;
      renderWord();
      if (state.completedLetters >= state.currentWord.length) {
        state.timedCharCount += state.currentWord.length;
        state.timedWordsCompleted += 1;
        renderTimerStatus();
        if (state.timedWordsCompleted >= TOTAL_WORDS) {
          setTimeout(finish, FINISH_DELAY_MS);
        } else {
          setTimeout(startNewWord, NEXT_WORD_DELAY_MS);
        }
      }
      return true;
    },
  };
}
