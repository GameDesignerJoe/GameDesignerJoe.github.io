import * as state from './state.js';
import * as scales from './scales.js';
import * as chords from './chords.js';
import * as fretboard from './fretboard.js';
import * as url from './url.js';
import * as exp from './export.js';

async function init() {
  await Promise.all([scales.loadScales(), chords.loadChords()]);

  // Load boards from URL, or create a default one
  const pageTitleInput = document.getElementById('page-title');
  if (!url.readFromUrl()) {
    const board = state.createBoard();
    scales.applyScale(board, 'Major', 0);
  }
  pageTitleInput.value = state.pageTitle;

  // When any board changes, update URL
  fretboard.onChange(() => url.pushToUrl());

  pageTitleInput.addEventListener('input', () => {
    state.setPageTitle(pageTitleInput.value);
    url.pushToUrl();
  });

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

  // New / Reset button
  document.getElementById('btn-new').addEventListener('click', () => {
    state.boards.length = 0;
    state.setPageTitle('');
    pageTitleInput.value = '';
    const board = state.createBoard();
    scales.applyScale(board, 'Major', 0);
    fretboard.render();
    history.replaceState(null, '', window.location.pathname);
  });

  // Export dropdown toggle
  const dropdown = document.querySelector('.dropdown');
  const appEl = document.querySelector('.app');
  document.getElementById('btn-export').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    appEl.classList.toggle('dropdown-open', dropdown.classList.contains('open'));
  });
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    appEl.classList.remove('dropdown-open');
  });

  const closeAndRun = (fn) => () => { dropdown.classList.remove('open'); fn(); };
  document.getElementById('btn-copy').addEventListener('click', closeAndRun(() => exp.copyToClipboard()));
  document.getElementById('btn-png').addEventListener('click', closeAndRun(() => exp.downloadPng()));
  document.getElementById('btn-print').addEventListener('click', closeAndRun(() => exp.printPdf()));
  document.getElementById('btn-share').addEventListener('click', closeAndRun(() => exp.shareUrl()));
}

init();
