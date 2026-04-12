import * as state from './state.js';
import * as scales from './scales.js';
import * as fretboard from './fretboard.js';
import * as url from './url.js';
import * as exp from './export.js';

async function init() {
  await scales.loadScales();

  // Load boards from URL, or create a default one
  if (!url.readFromUrl()) {
    const board = state.createBoard();
    scales.applyScale(board, 'Major', 0);
  }

  // When any board changes, update URL
  fretboard.onChange(() => url.pushToUrl());

  // Initial render
  fretboard.render();
  url.pushToUrl();

  // Add Fretboard button
  document.getElementById('btn-add-board').addEventListener('click', () => {
    const board = state.createBoard();
    scales.applyScale(board, 'Major', 0);
    fretboard.render();
    url.pushToUrl();
    // Scroll to the new board
    const cards = document.querySelectorAll('.board-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth' });
  });

  // Export dropdown toggle
  const dropdown = document.querySelector('.dropdown');
  document.getElementById('btn-export').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => dropdown.classList.remove('open'));

  const closeAndRun = (fn) => () => { dropdown.classList.remove('open'); fn(); };
  document.getElementById('btn-copy').addEventListener('click', closeAndRun(() => exp.copyToClipboard()));
  document.getElementById('btn-png').addEventListener('click', closeAndRun(() => exp.downloadPng()));
  document.getElementById('btn-print').addEventListener('click', closeAndRun(() => exp.printPdf()));
  document.getElementById('btn-share').addEventListener('click', closeAndRun(() => exp.shareUrl()));
}

init();
