import { state } from '../state.js';
import { audioEngine } from '../engines/audioEngine.js';
import { saveScores } from '../lib/storage.js';
import {
  SPEED_STAGES,
  STREAK_TO_ADVANCE,
  RESPONSE_WINDOW_MS,
} from '../data/speedStages.js';
import {
  renderSpeedStatus,
  renderSpeedReady,
  resetSpeedGrid,
  flashSpeedLetter,
  startSpeedCountdown,
  stopSpeedCountdown,
} from '../ui/speedGrid.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PLAY_LEAD_MS = 200;
const NEXT_DELAY_MS = 700;
const FEEDBACK_MS = 600;

let pool = [];
let pendingTimer = null;

function clearPending() {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function pickNext() {
  if (pool.length === 0) {
    pool = [...ALPHABET].sort(() => Math.random() - 0.5);
  }
  return pool.shift();
}

async function startNewLetter() {
  state.currentWord = pickNext();
  state.completedLetters = 0;
  state.speedAwaitingTap = false;
  resetSpeedGrid();
  renderSpeedStatus();
  audioEngine.init();

  await new Promise((r) => setTimeout(r, PLAY_LEAD_MS));
  if (state.mode !== 'speed' || !state.currentWord) return;

  const stage = SPEED_STAGES[state.speedStageIndex];
  await audioEngine.playWord(state.currentWord, stage.ditMs);

  // Bail if user navigated away during playback
  if (state.mode !== 'speed' || !state.currentWord) return;

  state.speedAwaitingTap = true;
  startSpeedCountdown(RESPONSE_WINDOW_MS, onTimeout);
}

function onTimeout() {
  if (state.mode !== 'speed' || !state.currentWord) return;
  state.speedAwaitingTap = false;
  flashSpeedLetter(state.currentWord, 'correct'); // reveal what it was
  state.speedStreak = 0;
  renderSpeedStatus();
  pendingTimer = setTimeout(startNewLetter, NEXT_DELAY_MS + FEEDBACK_MS / 2);
}

function onCorrect(letter) {
  flashSpeedLetter(letter, 'correct');
  state.speedStreak += 1;
  if (
    state.speedStreak >= STREAK_TO_ADVANCE &&
    state.speedStageIndex < SPEED_STAGES.length - 1
  ) {
    state.speedStageIndex += 1;
    state.speedStreak = 0;
    if (state.speedStageIndex > (state.scores.speedHighStage || 0)) {
      state.scores.speedHighStage = state.speedStageIndex;
      saveScores(state.scores);
    }
  }
  renderSpeedStatus();
  pendingTimer = setTimeout(startNewLetter, NEXT_DELAY_MS);
}

function onWrong(letter, target) {
  flashSpeedLetter(letter, 'wrong');
  if (target) flashSpeedLetter(target, 'correct');
  state.speedStreak = 0;
  renderSpeedStatus();
  pendingTimer = setTimeout(startNewLetter, NEXT_DELAY_MS + FEEDBACK_MS);
}

export const speed = {
  id: 'speed',
  name: 'Speed',
  description: 'Identify letters at progressively faster speeds. 5 right to advance.',
  showTree: false,
  showWord: false,
  showPaperTape: false,
  showTimer: false,
  showReplay: false,
  showListeningStatus: false,
  showSpeedContent: true,
  hideKey: true,
  scored: true,
  available: true,
  scoreKey: 'speedHighStage',

  enter() {
    pool = [];
    state.speedStageIndex = 0;
    state.speedStreak = 0;
    state.speedAwaitingTap = false;
    state.speedAwaitingStart = true;       // wait for explicit Start tap
    state.currentWord = null;
    clearPending();
    resetSpeedGrid();
    renderSpeedStatus();
    renderSpeedReady();
    audioEngine.init();                    // prep audio context inside the gesture
  },

  exit() {
    clearPending();
    stopSpeedCountdown();
    audioEngine.stopTone();
    state.currentWord = null;
    state.speedAwaitingTap = false;
    state.speedAwaitingStart = false;
  },

  // Called by speedGrid.js when the user taps the Start button.
  onStart() {
    if (!state.speedAwaitingStart) return;
    state.speedAwaitingStart = false;
    renderSpeedReady();
    startNewLetter();
  },

  // Called by speedGrid.js when the user taps a letter button.
  onLetterTap(letter) {
    if (!state.speedAwaitingTap) return;
    state.speedAwaitingTap = false;
    stopSpeedCountdown();
    audioEngine.stopTone();
    const target = state.currentWord;
    if (letter === target) {
      onCorrect(letter);
    } else {
      onWrong(letter, target);
    }
  },

  // Required interface — speed mode never goes through key input.
  onSymbol() { return false; },
  onLetterCommit() { return false; },
};
