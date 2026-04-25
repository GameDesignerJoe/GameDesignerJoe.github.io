import { state } from '../state.js';
import { audioEngine } from '../engines/audioEngine.js';
import { saveScores } from '../lib/storage.js';
import {
  SPEED_STAGES,
  STREAK_TO_ADVANCE,
  RESPONSE_WINDOW_MS,
} from '../data/speedStages.js';
import { SPEED_TIERS } from '../data/speedTiers.js';
import {
  renderSpeedStatus,
  renderSpeedReady,
  renderSpeedTrack,
  resetSpeedGrid,
  flashSpeedLetter,
  startSpeedCountdown,
  stopSpeedCountdown,
} from '../ui/speedGrid.js';

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

function refillPool() {
  const tier = SPEED_TIERS[state.speedTierIndex];
  pool = [...tier.letters].sort(() => Math.random() - 0.5);
}

function pickNext() {
  if (pool.length === 0) refillPool();
  return pool.shift();
}

async function startNewLetter() {
  state.currentWord = pickNext();
  state.completedLetters = 0;
  state.speedAwaitingTap = false;
  resetSpeedGrid();
  renderSpeedStatus();
  renderSpeedTrack();
  audioEngine.init();

  await new Promise((r) => setTimeout(r, PLAY_LEAD_MS));
  if (state.mode !== 'speed' || !state.currentWord) return;

  const stage = SPEED_STAGES[state.speedStageIndex];
  await audioEngine.playWord(state.currentWord, stage.ditMs);

  if (state.mode !== 'speed' || !state.currentWord) return;

  state.speedAwaitingTap = true;
  startSpeedCountdown(RESPONSE_WINDOW_MS, onTimeout);
}

// Move to the next sub-stage. Returns true if we crossed into a new tier
// (so callers can refill the pool, etc.).
function advanceProgress() {
  let crossedTier = false;
  if (state.speedStageIndex < SPEED_STAGES.length - 1) {
    state.speedStageIndex += 1;
  } else if (state.speedTierIndex < SPEED_TIERS.length - 1) {
    state.speedTierIndex += 1;
    state.speedStageIndex = 0;
    crossedTier = true;
  }
  // else: mastered everything; stay put.

  // Persist best (current is always >= best by construction)
  const tier = state.speedTierIndex;
  const stage = state.speedStageIndex;
  const oldTier = state.scores.speedBestTier || 0;
  const oldStage = state.scores.speedBestStage || 0;
  if (tier > oldTier || (tier === oldTier && stage > oldStage)) {
    state.scores.speedBestTier = tier;
    state.scores.speedBestStage = stage;
    saveScores(state.scores);
  }
  return crossedTier;
}

function onTimeout() {
  if (state.mode !== 'speed' || !state.currentWord) return;
  state.speedAwaitingTap = false;
  flashSpeedLetter(state.currentWord, 'correct'); // reveal answer
  state.speedStreak = 0;
  renderSpeedStatus();
  pendingTimer = setTimeout(startNewLetter, NEXT_DELAY_MS + FEEDBACK_MS / 2);
}

function onCorrect(letter) {
  flashSpeedLetter(letter, 'correct');
  state.speedStreak += 1;
  if (state.speedStreak >= STREAK_TO_ADVANCE) {
    const crossedTier = advanceProgress();
    state.speedStreak = 0;
    if (crossedTier) refillPool();
  }
  renderSpeedStatus();
  renderSpeedTrack();
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
  description: 'Tiered ear-training: hear a letter at progressively faster WPM. 5 right to advance a stage; clear all 9 stages to unlock the next tier.',
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
  scoreKey: 'speedBestTier',

  enter() {
    // Resume from saved progress
    state.speedTierIndex = state.scores.speedBestTier || 0;
    state.speedStageIndex = state.scores.speedBestStage || 0;
    state.speedStreak = 0;
    state.speedAwaitingTap = false;
    state.speedAwaitingStart = true;
    state.currentWord = null;
    pool = [];
    clearPending();
    resetSpeedGrid();
    renderSpeedStatus();
    renderSpeedTrack();
    renderSpeedReady();
    audioEngine.init();
  },

  exit() {
    clearPending();
    stopSpeedCountdown();
    audioEngine.stopTone();
    state.currentWord = null;
    state.speedAwaitingTap = false;
    state.speedAwaitingStart = false;
  },

  onStart() {
    if (!state.speedAwaitingStart) return;
    state.speedAwaitingStart = false;
    renderSpeedReady();
    startNewLetter();
  },

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

  onSymbol() { return false; },
  onLetterCommit() { return false; },
};
