// ============================================================
// THE CARTOGRAPHER - journals.js
// Journal set data loading, island drop logic, page placement,
// proximity collection, and localStorage persistence.
// ============================================================

import { GRID, SPECIMEN_COLLECT_RADIUS } from './config.js';
import { state } from './state.js';
import { getTerrain } from './terrain.js';

const LS_KEY = 'cartographer_journals';

// Cached journal data from journals.json (loaded once at startup)
let _journalData = null;

// --- DATA LOADING ---

export async function initJournals() {
  try {
    const res = await fetch('data/journals.json');
    _journalData = await res.json();
  } catch (e) {
    console.warn('Could not load journals.json — journals disabled.', e);
    _journalData = { sets: [] };
  }
}

export function getJournalData() {
  return _journalData;
}

// --- PERSISTENCE ---

export function loadPersistence() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return { sets: {} };
}

export function savePersistence(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (_) { /* ignore */ }
}

// --- DROP LOGIC ---

// Returns a setId for this expedition, or null if all sets are complete.
// Picks randomly from sets that still have uncollected entries.
export function pickJournalSet() {
  if (!_journalData || _journalData.sets.length === 0) return null;

  const persistence = loadPersistence();

  const available = _journalData.sets.filter(set => {
    const saved = persistence.sets[set.id];
    if (!saved) return true; // never seen — always available
    return saved.collected.length < set.entries.length; // incomplete
  });

  if (available.length === 0) return null;

  const chosen = available[Math.floor(Math.random() * available.length)];
  return chosen.id;
}

// --- PAGE PLACEMENT ---

// Place journal pages for the current expedition on the island.
// Called from main.js after generateSpecimens().
export function generateJournalPages() {
  state.journalPages = [];
  state.currentJournalSetId = null;
  state.journalTotal = 0;
  state.journalsCollected = 0;

  if (!_journalData) return;

  const setId = pickJournalSet();
  if (!setId) return;

  const set = _journalData.sets.find(s => s.id === setId);
  if (!set) return;

  const persistence = loadPersistence();
  const saved = persistence.sets[setId] || { collected: [], complete: false };
  const alreadyCollected = saved.collected.length;
  const remaining = set.entries.length - alreadyCollected;

  if (remaining <= 0) return;

  state.currentJournalSetId = setId;
  state.journalTotal = remaining;

  // Build a pool of valid land tiles (exclude water, exclude landmark/specimen tiles)
  const occupiedTiles = new Set([
    ...state.landmarks.map(lm => `${lm.tx},${lm.ty}`),
    ...state.specimens.map(sp => `${sp.tx},${sp.ty}`),
  ]);

  const validTiles = [];
  for (let tx = 0; tx < GRID; tx++) {
    for (let ty = 0; ty < GRID; ty++) {
      const terrain = getTerrain(tx, ty);
      if (terrain !== 'water' && !occupiedTiles.has(`${tx},${ty}`)) {
        validTiles.push({ tx, ty });
      }
    }
  }

  // Shuffle the valid tile pool
  for (let i = validTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [validTiles[i], validTiles[j]] = [validTiles[j], validTiles[i]];
  }

  // Place one page per remaining entry, in sequential order
  for (let i = 0; i < remaining && i < validTiles.length; i++) {
    const tile = validTiles[i];
    state.journalPages.push({
      tx: tile.tx,
      ty: tile.ty,
      entryIndex: alreadyCollected + i, // absolute entry index in the set
      collected: false,
    });
  }
}

// --- COLLECTION ---

// Called from doCollect() in tools.js alongside specimen collection.
// Returns the collected page object, or null if nothing in range.
export function tryCollectJournalPage() {
  for (const page of state.journalPages) {
    if (page.collected) continue;
    const dx = state.player.x - (page.tx + 0.5);
    const dy = state.player.y - (page.ty + 0.5);
    if (Math.sqrt(dx * dx + dy * dy) < SPECIMEN_COLLECT_RADIUS) {
      page.collected = true;
      state.journalsCollected++;

      // Persist to localStorage — always award the NEXT sequential entry,
      // regardless of which physical page tile was touched first.
      const persistence = loadPersistence();
      if (!persistence.sets[state.currentJournalSetId]) {
        persistence.sets[state.currentJournalSetId] = { collected: [], complete: false };
      }
      const saved = persistence.sets[state.currentJournalSetId];
      const nextIndex = saved.collected.length; // always sequential
      page.entryIndex = nextIndex; // update page so tools.js toast shows correct title
      if (!saved.collected.includes(nextIndex)) {
        saved.collected.push(nextIndex);
        // no sort needed — appended in order
      }

      // Check if set is now complete
      const set = _journalData.sets.find(s => s.id === state.currentJournalSetId);
      if (set && saved.collected.length >= set.entries.length) {
        saved.complete = true;
      }

      savePersistence(persistence);
      return page;
    }
  }
  return null;
}

// --- HELPERS ---

export function isSetComplete(setId) {
  const persistence = loadPersistence();
  return persistence.sets[setId]?.complete === true;
}

export function getCollectedEntries(setId) {
  const persistence = loadPersistence();
  return persistence.sets[setId]?.collected || [];
}

export function areAllSetsComplete() {
  if (!_journalData) return false;
  const persistence = loadPersistence();
  return _journalData.sets.every(set => {
    const saved = persistence.sets[set.id];
    return saved && saved.collected.length >= set.entries.length;
  });
}
