import { state } from '../state.js';
import { getMode } from '../modes/index.js';
import { LETTER_TO_CODE } from '../data/morseTree.js';
import { SPEED_STAGES, STREAK_TO_ADVANCE } from '../data/speedStages.js';
import { SPEED_TIERS, activeLettersForTier } from '../data/speedTiers.js';

// Two-column letter grid. Left col = codes starting with `.`, right col
// = codes starting with `-`. Within each column letters climb in
// length and binary order.
const DOT_COLUMN = ['E', 'I', 'A', 'S', 'U', 'R', 'W', 'H', 'V', 'F', 'L', 'P', 'J'];
const DASH_COLUMN = ['T', 'N', 'M', 'D', 'K', 'G', 'O', 'B', 'X', 'C', 'Y', 'Z', 'Q'];

let gridEl = null;
let stageEl = null;
let streakEl = null;
let bestEl = null;
let countdownEl = null;
let countdownFillEl = null;
let startBtnEl = null;
let trackEl = null;

const buttons = new Map();

let countdownTimeout = null;
let countdownRaf = null;
let countdownStart = null;
let countdownDuration = 0;
let countdownCb = null;

let flashTimers = new Map();

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

function buildTrack() {
  if (!trackEl) return;
  trackEl.innerHTML = '';
  for (let tIdx = 0; tIdx < SPEED_TIERS.length; tIdx++) {
    const tier = SPEED_TIERS[tIdx];
    const row = document.createElement('div');
    row.className = 'speed-track-row';
    row.dataset.tier = String(tIdx);

    const label = document.createElement('span');
    label.className = 'speed-track-label';
    label.textContent = tier.letters.join(' ');
    row.appendChild(label);

    const cells = document.createElement('div');
    cells.className = 'speed-track-cells';
    for (let sIdx = 0; sIdx < SPEED_STAGES.length; sIdx++) {
      const cell = document.createElement('span');
      cell.className = 'speed-track-cell';
      cell.dataset.tier = String(tIdx);
      cell.dataset.stage = String(sIdx);
      cells.appendChild(cell);
    }
    row.appendChild(cells);
    trackEl.appendChild(row);
  }
}

export function initSpeedGrid() {
  gridEl = document.getElementById('speed-grid');
  stageEl = document.querySelector('#speed-status .speed-stage');
  streakEl = document.querySelector('#speed-status .speed-streak strong');
  bestEl = document.querySelector('#speed-status .speed-best strong');
  countdownEl = document.getElementById('speed-countdown');
  countdownFillEl = document.getElementById('speed-countdown-fill');
  startBtnEl = document.getElementById('speed-start-button');
  trackEl = document.getElementById('speed-track');

  if (gridEl) {
    gridEl.innerHTML = '';
    buttons.clear();
    for (let i = 0; i < DOT_COLUMN.length; i++) {
      for (const letter of [DOT_COLUMN[i], DASH_COLUMN[i]]) {
        const btn = buildLetterCell(letter);
        gridEl.appendChild(btn);
        buttons.set(letter, btn);
      }
    }
  }

  buildTrack();

  startBtnEl?.addEventListener('click', () => {
    const mode = getMode(state.mode);
    if (mode.id !== 'speed') return;
    if (state.speedAwaitingStart) {
      mode.onStart?.();
    } else if (state.speedPaused) {
      mode.onResume?.();
    } else {
      mode.onPause?.();
    }
  });

  renderSpeedStatus();
  renderSpeedTrack();
  renderSpeedReady();
}

export function renderSpeedStatus() {
  if (state.mode !== 'speed') return;
  const tier = SPEED_TIERS[state.speedTierIndex] || SPEED_TIERS[0];
  const stage = SPEED_STAGES[state.speedStageIndex] || SPEED_STAGES[0];
  if (stageEl) {
    const tierLabel = tier.letters.join(' ');
    stageEl.textContent = `T${state.speedTierIndex + 1} · ${tierLabel} · ${stage.wpm} WPM`;
  }
  if (streakEl) {
    streakEl.textContent = `${state.speedStreak} / ${STREAK_TO_ADVANCE}`;
  }
  if (bestEl) {
    const bestT = state.scores.speedBestTier || 0;
    const bestS = state.scores.speedBestStage || 0;
    if (bestT === 0 && bestS === 0) {
      bestEl.textContent = '—';
    } else {
      const wpm = SPEED_STAGES[bestS]?.wpm || 0;
      bestEl.textContent = `T${bestT + 1} · ${wpm} WPM`;
    }
  }

  // Dim letters outside the active tier so the eye lands on the
  // candidates. Tier letters keep full brightness.
  const active = activeLettersForTier(state.speedTierIndex);
  for (const [letter, btn] of buttons) {
    btn.classList.toggle('off-tier', !active.has(letter));
  }
}

export function renderSpeedTrack() {
  if (!trackEl) return;
  const curTier = state.speedTierIndex;
  const curStage = state.speedStageIndex;

  for (const row of trackEl.querySelectorAll('.speed-track-row')) {
    const tIdx = Number(row.dataset.tier);
    row.classList.toggle('active', tIdx === curTier);
    row.classList.toggle('locked', tIdx > curTier);
  }
  for (const cell of trackEl.querySelectorAll('.speed-track-cell')) {
    const tIdx = Number(cell.dataset.tier);
    const sIdx = Number(cell.dataset.stage);
    const completed =
      tIdx < curTier || (tIdx === curTier && sIdx < curStage);
    const current = tIdx === curTier && sIdx === curStage;
    cell.classList.toggle('completed', completed);
    cell.classList.toggle('current', current);
  }
}

export function renderSpeedReady() {
  const awaiting = !!state.speedAwaitingStart;
  const paused = !!state.speedPaused;

  if (startBtnEl) {
    if (awaiting) startBtnEl.textContent = 'START';
    else if (paused) startBtnEl.textContent = 'RESUME';
    else startBtnEl.textContent = 'PAUSE';
    startBtnEl.classList.remove('hidden');
  }
  if (countdownEl) countdownEl.classList.toggle('hidden', awaiting || paused);
  if (gridEl) gridEl.classList.toggle('inactive', awaiting || paused);
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
