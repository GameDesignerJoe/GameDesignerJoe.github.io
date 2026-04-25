import { state } from '../state.js';
import { getMode } from '../modes/index.js';
import { LETTER_TO_CODE } from '../data/morseTree.js';
import { SPEED_STAGES, STREAK_TO_ADVANCE } from '../data/speedStages.js';

// Two-column layout: left column starts with `.` (E, I, A, S, ...), right
// starts with `-` (T, N, M, D, ...). Within each column letters climb in
// complexity — length first, then binary order on the symbols. Easiest
// stuff (E, T) at top; deepest level-4 letters (J, Q) at the bottom.
const DOT_COLUMN = ['E', 'I', 'A', 'S', 'U', 'R', 'W', 'H', 'V', 'F', 'L', 'P', 'J'];
const DASH_COLUMN = ['T', 'N', 'M', 'D', 'K', 'G', 'O', 'B', 'X', 'C', 'Y', 'Z', 'Q'];

let gridEl = null;
let stageEl = null;
let streakEl = null;
let bestEl = null;
let countdownEl = null;
let countdownFillEl = null;
let startBtnEl = null;

const buttons = new Map();

let countdownTimeout = null;
let countdownRaf = null;
let countdownStart = null;
let countdownDuration = 0;
let countdownCb = null;

let flashTimers = new Map();

// Replace ASCII dot/dash with prettier middle-dot + en-dash for the labels.
function formatCode(code) {
  return code.replace(/\./g, '·').replace(/-/g, '−');
}

function buildLetterCell(letter) {
  const btn = document.createElement('button');
  btn.className = 'speed-letter';
  btn.type = 'button';
  btn.dataset.letter = letter;

  const charEl = document.createElement('span');
  charEl.className = 'speed-letter-char';
  charEl.textContent = letter;

  const codeEl = document.createElement('span');
  codeEl.className = 'speed-letter-code';
  codeEl.textContent = formatCode(LETTER_TO_CODE[letter] || '');

  btn.appendChild(charEl);
  btn.appendChild(codeEl);

  btn.addEventListener('click', () => {
    const mode = getMode(state.mode);
    if (mode.id !== 'speed') return;
    mode.onLetterTap?.(letter);
  });
  return btn;
}

export function initSpeedGrid() {
  gridEl = document.getElementById('speed-grid');
  stageEl = document.querySelector('#speed-status .speed-stage');
  streakEl = document.querySelector('#speed-status .speed-streak strong');
  bestEl = document.querySelector('#speed-status .speed-best strong');
  countdownEl = document.getElementById('speed-countdown');
  countdownFillEl = document.getElementById('speed-countdown-fill');
  startBtnEl = document.getElementById('speed-start-button');

  if (gridEl) {
    gridEl.innerHTML = '';
    buttons.clear();
    // Interleave row-by-row so CSS grid (1fr 1fr) places dot column on
    // the left, dash column on the right.
    for (let i = 0; i < DOT_COLUMN.length; i++) {
      for (const letter of [DOT_COLUMN[i], DASH_COLUMN[i]]) {
        const btn = buildLetterCell(letter);
        gridEl.appendChild(btn);
        buttons.set(letter, btn);
      }
    }
  }

  startBtnEl?.addEventListener('click', () => {
    const mode = getMode(state.mode);
    if (mode.id !== 'speed') return;
    mode.onStart?.();
  });

  renderSpeedStatus();
  renderSpeedReady();
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
    const bestWpm = state.scores.speedBestWpm || 0;
    bestEl.textContent = bestWpm > 0 ? `${bestWpm} WPM` : '—';
  }
}

// Toggles between the Start button (pre-game) and the countdown bar
// (mid-game) based on state.speedAwaitingStart.
export function renderSpeedReady() {
  const awaiting = !!state.speedAwaitingStart;
  if (startBtnEl) startBtnEl.classList.toggle('hidden', !awaiting);
  if (countdownEl) countdownEl.classList.toggle('hidden', awaiting);
  if (gridEl) gridEl.classList.toggle('inactive', awaiting);
}

export function resetSpeedGrid() {
  for (const [letter, timer] of flashTimers) {
    clearTimeout(timer);
    const btn = buttons.get(letter);
    btn?.classList.remove('correct', 'wrong');
  }
  flashTimers.clear();
}

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
