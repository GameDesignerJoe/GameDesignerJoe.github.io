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
  // Take a final reading so the elapsed shown on results matches the run
  if (state.timedStartMs != null) {
    state.timedElapsedMs = performance.now() - state.timedStartMs;
  }
  const elapsedMs = state.timedElapsedMs;
  const wpm = calculateWpm(state.timedCharCount, elapsedMs);

  const isNewHighScore = wpm > state.scores.timedWpmBest;
  if (isNewHighScore) {
    state.scores.timedWpmBest = wpm;
    saveScores(state.scores);
  }

  state.lastResult = {
    wpm,
    elapsedMs,
    errors: state.timedErrors,
    isNewHighScore,
  };

  showResults();
}

export const timedWpm = {
  id: 'timedWpm',
  name: 'Timed WPM',
  description: 'Spell 10 words against the clock. Best WPM is saved.',
  showTree: true,
  showWord: true,
  showPaperTape: false,
  showTimer: true,
  scored: true,
  available: true,

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
