import * as state from './state.js';
import * as scales from './scales.js';
import * as fretboard from './fretboard.js';
import * as url from './url.js';
import * as exp from './export.js';

async function init() {
  // Load scale data
  const scaleData = await scales.loadScales();

  // Populate scale dropdown
  const scaleSelect = document.getElementById('scale-select');
  for (const name of scales.getScaleNames()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    scaleSelect.appendChild(opt);
  }

  // Check URL for rebuild parameter
  const keySelect = document.getElementById('key-select');
  if (url.readFromUrl()) {
    keySelect.value = state.currentKey;
    scaleSelect.value = state.currentScale;
  } else {
    // Default: C Major
    scales.applyScale('Major', 0);
    keySelect.value = '0';
    scaleSelect.value = 'Major';
  }

  // When fretboard changes (click-to-toggle), update URL and sync dropdown
  fretboard.onChange(() => {
    scaleSelect.value = state.currentScale;
    url.pushToUrl();
  });

  // Initial render
  fretboard.render();
  url.pushToUrl();

  // ── Event Listeners ──

  keySelect.addEventListener('change', () => {
    const rootSemitone = parseInt(keySelect.value);
    const scaleName = scaleSelect.value;
    if (scaleName) {
      scales.applyScale(scaleName, rootSemitone);
    } else {
      state.setKey(rootSemitone);
    }
    fretboard.render();
    url.pushToUrl();
  });

  scaleSelect.addEventListener('change', () => {
    const scaleName = scaleSelect.value;
    const rootSemitone = parseInt(keySelect.value);
    if (scaleName) {
      scales.applyScale(scaleName, rootSemitone);
    } else {
      state.setScale('');
    }
    fretboard.render();
    url.pushToUrl();
  });

  document.getElementById('show-notes').addEventListener('change', (e) => {
    fretboard.setShowNotes(e.target.checked);
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    state.clearGrid();
    state.setScale('');
    scaleSelect.value = '';
    fretboard.render();
    url.pushToUrl();
  });

  document.getElementById('btn-copy').addEventListener('click', () => exp.copyToClipboard());
  document.getElementById('btn-png').addEventListener('click', () => exp.downloadPng());
  document.getElementById('btn-print').addEventListener('click', () => exp.printPdf());
  document.getElementById('btn-share').addEventListener('click', () => exp.shareUrl());
}

init();
