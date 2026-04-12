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
  const captionInput = document.getElementById('caption');
  if (url.readFromUrl()) {
    keySelect.value = state.currentKey;
    scaleSelect.value = state.currentScale;
    captionInput.value = state.caption;
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

  document.getElementById('label-mode').addEventListener('change', (e) => {
    fretboard.setLabelMode(e.target.value);
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    state.clearGrid();
    state.setScale('');
    scaleSelect.value = '';
    fretboard.render();
    url.pushToUrl();
  });

  captionInput.addEventListener('input', () => {
    state.setCaption(captionInput.value);
    url.pushToUrl();
  });

  // Export dropdown toggle
  const dropdown = document.querySelector('.dropdown');
  document.getElementById('btn-export').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => dropdown.classList.remove('open'));

  // Export actions — close dropdown after each
  const closeAndRun = (fn) => () => { dropdown.classList.remove('open'); fn(); };
  document.getElementById('btn-copy').addEventListener('click', closeAndRun(() => exp.copyToClipboard()));
  document.getElementById('btn-png').addEventListener('click', closeAndRun(() => exp.downloadPng()));
  document.getElementById('btn-print').addEventListener('click', closeAndRun(() => exp.printPdf()));
  document.getElementById('btn-share').addEventListener('click', closeAndRun(() => exp.shareUrl()));
}

init();
