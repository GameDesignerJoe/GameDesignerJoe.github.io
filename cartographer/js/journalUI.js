// ============================================================
// THE CARTOGRAPHER - journalUI.js
// Journal directory overlay and entry reader UI.
// ============================================================

import { getJournalData, getCollectedEntries, isSetComplete, areAllSetsComplete } from './journals.js';

let _currentSetId = null;    // which set is open in the entry reader
let _currentEntryIdx = 0;    // which entry is showing in the reader

// --- SHOW / HIDE ---

export function showJournalOverlay() {
  renderDirectory();
  document.getElementById('journalOverlay').classList.add('visible');
}

export function hideJournalOverlay() {
  document.getElementById('journalOverlay').classList.remove('visible');
  _showDirectory();
}

// --- DIRECTORY ---

function _showDirectory() {
  document.getElementById('journalDirectory').style.display = '';
  document.getElementById('journalEntryReader').style.display = 'none';
}

function _showReader() {
  document.getElementById('journalDirectory').style.display = 'none';
  document.getElementById('journalEntryReader').style.display = '';
}

export function renderDirectory() {
  const data = getJournalData();
  const grid = document.getElementById('journalSetGrid');
  grid.innerHTML = '';

  const allComplete = areAllSetsComplete();

  const completeHeader = document.getElementById('journalCompleteHeader');
  if (completeHeader) {
    completeHeader.style.display = allComplete ? 'block' : 'none';
  }

  if (!data || data.sets.length === 0) {
    grid.innerHTML = '<div class="journal-empty">No journals found in this world.</div>';
    return;
  }

  for (const set of data.sets) {
    const collected = getCollectedEntries(set.id);
    const complete  = isSetComplete(set.id);
    const known     = collected.length > 0;

    const card = document.createElement('div');
    card.className = 'journal-set-card' + (known ? ' known' : ' unknown') + (complete ? ' complete' : '');

    const nameEl = document.createElement('div');
    nameEl.className = 'journal-set-name';
    nameEl.textContent = known ? set.name : '???';
    card.appendChild(nameEl);

    const progressEl = document.createElement('div');
    progressEl.className = 'journal-set-progress';
    if (known) {
      progressEl.textContent = complete ? '⊕ Complete' : `${collected.length} / ${set.entries.length}`;
    } else {
      progressEl.textContent = `? / ${set.entries.length}`;
    }
    card.appendChild(progressEl);

    if (known) {
      card.addEventListener('click', () => openEntryReader(set.id, 0));
    }

    grid.appendChild(card);
  }

  _showDirectory();
}

// --- ENTRY READER ---

export function openEntryReader(setId, entryIdx) {
  _currentSetId = setId;
  _currentEntryIdx = entryIdx;
  _renderEntry();
  _showReader();
}

function _renderEntry() {
  const data = getJournalData();
  const set  = data?.sets.find(s => s.id === _currentSetId);
  if (!set) return;

  const collected = getCollectedEntries(_currentSetId);
  const entry     = set.entries[_currentEntryIdx];
  const isCollected = collected.includes(_currentEntryIdx);

  document.getElementById('readerSetName').textContent = set.name;
  document.getElementById('readerEntryTitle').textContent = entry.title;
  document.getElementById('readerEntryBody').textContent = isCollected ? entry.text : '???';
  document.getElementById('readerEntryBody').classList.toggle('unknown-entry', !isCollected);

  const total = set.entries.length;
  document.getElementById('readerProgress').textContent = `${_currentEntryIdx + 1} of ${total}`;

  document.getElementById('readerPrev').disabled = _currentEntryIdx === 0;
  document.getElementById('readerNext').disabled = _currentEntryIdx === total - 1;
}

export function navigateEntry(delta) {
  const data = getJournalData();
  const set  = data?.sets.find(s => s.id === _currentSetId);
  if (!set) return;

  const next = _currentEntryIdx + delta;
  if (next < 0 || next >= set.entries.length) return;
  _currentEntryIdx = next;
  _renderEntry();
}

// --- WIRE UP EVENT LISTENERS (called once from ui.js) ---

export function initJournalUI() {
  const overlay   = document.getElementById('journalOverlay');
  const closeBtn  = document.getElementById('journalCloseBtn');
  const backBtn   = document.getElementById('readerBackBtn');
  const prevBtn   = document.getElementById('readerPrev');
  const nextBtn   = document.getElementById('readerNext');

  closeBtn.addEventListener('click', hideJournalOverlay);
  // Click backdrop to close
  overlay.addEventListener('click', e => { if (e.target === overlay) hideJournalOverlay(); });
  backBtn.addEventListener('click', () => {
    renderDirectory();
    _showDirectory();
  });
  prevBtn.addEventListener('click', () => navigateEntry(-1));
  nextBtn.addEventListener('click', () => navigateEntry(1));
}
