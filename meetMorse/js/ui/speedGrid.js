import { state } from '../state.js';
import { getMode } from '../modes/index.js';
import { SPEED_STAGES, STREAK_TO_ADVANCE } from '../data/speedStages.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let gridEl = null;
let stageEl = null;
let streakEl = null;
let bestEl = null;
let countdownFillEl = null;

const buttons = new Map();

let countdownTimeout = null;
let countdownRaf = null;
let countdownStart = null;
let countdownDuration = 0;
let countdownCb = null;

let flashTimers = new Map(); // letter → timeoutId, so re-tapping during a flash resets cleanly

export function initSpeedGrid() {
  gridEl = document.getElementById('speed-grid');
  stageEl = document.querySelector('#speed-status .speed-stage');
  streakEl = document.querySelector('#speed-status .speed-streak strong');
  bestEl = document.querySelector('#speed-status .speed-best strong');
  countdownFillEl = document.getElementById('speed-countdown-fill');

  if (!gridEl) return;
  gridEl.innerHTML = '';
  buttons.clear();
  for (const letter of ALPHABET) {
    const btn = document.createElement('button');
    btn.className = 'speed-letter';
    btn.type = 'button';
    btn.textContent = letter;
    btn.dataset.letter = letter;
    btn.addEventListener('click', () => {
      const mode = getMode(state.mode);
      if (mode.id !== 'speed') return;
      mode.onLetterTap?.(letter);
    });
    gridEl.appendChild(btn);
    buttons.set(letter, btn);
  }

  renderSpeedStatus();
}

export function renderSpeedStatus() {
  if (state.mode !== 'speed') return;
  const stage = SPEED_STAGES[state.speedStageIndex] || SPEED_STAGES[0];
  if (stageEl) {
    stageEl.textContent = `STAGE ${state.speedStageIndex + 1} · ${stage.wpm} WPM`;
  }
  if (streakEl) {
    streakEl.textContent = `${state.speedStreak} / ${STREAK_TO_ADVANCE}`;
  }
  if (bestEl) {
    bestEl.textContent = String((state.scores.speedHighStage || 0) + 1);
  }
}

// Reset every letter button to its idle state. Called between letters.
export function resetSpeedGrid() {
  for (const [letter, timer] of flashTimers) {
    clearTimeout(timer);
    const btn = buttons.get(letter);
    btn?.classList.remove('correct', 'wrong');
  }
  flashTimers.clear();
}

// Briefly highlight a single letter as correct or wrong.
export function flashSpeedLetter(letter, kind) {
  const btn = buttons.get(letter);
  if (!btn) return;
  btn.classList.remove('correct', 'wrong');
  btn.classList.add(kind);
  if (flashTimers.has(letter)) clearTimeout(flashTimers.get(letter));
  flashTimers.set(
    letter,
    setTimeout(() => {
      btn.classList.remove('correct', 'wrong');
      flashTimers.delete(letter);
    }, 750),
  );
}

// Drain the countdown bar from 100% to 0% over durationMs. When it
// reaches 0, callback fires (timeout). Cancelable via stopSpeedCountdown.
export function startSpeedCountdown(durationMs, callback) {
  stopSpeedCountdown();
  countdownStart = performance.now();
  countdownDuration = durationMs;
  countdownCb = callback;

  if (countdownFillEl) {
    countdownFillEl.style.width = '100%';
    countdownFillEl.classList.add('active');
  }
  countdownTimeout = setTimeout(() => {
    countdownTimeout = null;
    countdownCb?.();
    stopSpeedCountdown();
  }, durationMs);

  const tick = () => {
    if (countdownStart == null) return;
    const elapsed = performance.now() - countdownStart;
    const pct = Math.max(0, 1 - elapsed / countdownDuration) * 100;
    if (countdownFillEl) countdownFillEl.style.width = `${pct}%`;
    if (elapsed < countdownDuration) {
      countdownRaf = requestAnimationFrame(tick);
    } else {
      countdownRaf = null;
    }
  };
  countdownRaf = requestAnimationFrame(tick);
}

export function stopSpeedCountdown() {
  if (countdownTimeout) {
    clearTimeout(countdownTimeout);
    countdownTimeout = null;
  }
  if (countdownRaf) {
    cancelAnimationFrame(countdownRaf);
    countdownRaf = null;
  }
  countdownStart = null;
  countdownCb = null;
  if (countdownFillEl) {
    countdownFillEl.classList.remove('active');
    countdownFillEl.style.width = '0%';
  }
}
