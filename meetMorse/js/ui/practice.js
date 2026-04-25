import { state } from '../state.js';

// Visualizer scales 0..VISUALIZER_MAX_MS across the full bar width.
// Threshold marker sits at threshold/MAX (e.g. 150/400 = 37.5%).
const VISUALIZER_MAX_MS = 400;

let promptEl = null;
let resultEl = null;
let streakEl = null;
let visualizerEl = null;
let fillEl = null;
let thresholdEl = null;
let zoneEl = null;

let rafId = null;
let visStartMs = null;

export function initPracticeUI() {
  promptEl = document.getElementById('practice-prompt');
  resultEl = document.getElementById('practice-result');
  streakEl = document.getElementById('practice-streak');
  visualizerEl = document.getElementById('practice-visualizer');
  fillEl = document.querySelector('#practice-visualizer .visualizer-fill');
  thresholdEl = document.querySelector('#practice-visualizer .visualizer-threshold');
  zoneEl = document.querySelector('#practice-visualizer .visualizer-target-zone');
  renderPractice();
}

export function renderPractice() {
  if (!promptEl) return;
  const target = state.practiceTarget;
  promptEl.textContent = target === '.' ? 'DOT' : target === '-' ? 'DASH' : '';
  promptEl.dataset.symbol = target || '';

  if (visualizerEl) {
    visualizerEl.classList.toggle('target-dot', target === '.');
    visualizerEl.classList.toggle('target-dash', target === '-');
  }

  // Position the threshold marker + target zone based on the user's
  // active threshold so the visualizer matches what input actually does.
  const thresholdMs = state.settings.dotDashThresholdMs;
  const thresholdPct = Math.min(thresholdMs / VISUALIZER_MAX_MS, 1) * 100;
  if (thresholdEl) thresholdEl.style.left = `${thresholdPct}%`;
  if (zoneEl) {
    if (target === '.') {
      zoneEl.style.left = '0%';
      zoneEl.style.width = `${thresholdPct}%`;
    } else if (target === '-') {
      zoneEl.style.left = `${thresholdPct}%`;
      zoneEl.style.width = `${100 - thresholdPct}%`;
    } else {
      zoneEl.style.width = '0%';
    }
  }

  if (resultEl) {
    if (state.practiceLastResult === 'success') {
      resultEl.textContent = '✓';
      resultEl.className = 'practice-result success';
    } else if (state.practiceLastResult === 'fail') {
      resultEl.textContent = '✗';
      resultEl.className = 'practice-result fail';
    } else {
      resultEl.textContent = '';
      resultEl.className = 'practice-result';
    }
  }

  if (streakEl) {
    streakEl.textContent = `streak ${state.practiceStreak}`;
  }
}

export function startVisualizer(timestampMs) {
  if (!fillEl) return;
  visStartMs = timestampMs;
  fillEl.classList.add('active');
  fillEl.classList.remove('settled');
  fillEl.style.width = '0%';
  if (rafId) cancelAnimationFrame(rafId);
  const tick = () => {
    if (visStartMs == null) return;
    // Use performance.now() during the rAF loop (no event to source
    // from); the bar is just visual feedback so handler-delay error is
    // OK here. Real timing measurement happens in input.js.
    const elapsed = performance.now() - visStartMs;
    const pct = Math.min(elapsed / VISUALIZER_MAX_MS, 1) * 100;
    fillEl.style.width = `${pct}%`;
    if (elapsed < VISUALIZER_MAX_MS) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };
  rafId = requestAnimationFrame(tick);
}

export function stopVisualizer(durationMs) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  visStartMs = null;
  if (!fillEl) return;
  const pct = Math.min(durationMs / VISUALIZER_MAX_MS, 1) * 100;
  fillEl.style.width = `${pct}%`;
  fillEl.classList.remove('active');
  fillEl.classList.add('settled');
}
