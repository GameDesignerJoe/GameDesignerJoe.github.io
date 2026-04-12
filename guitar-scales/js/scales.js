import * as state from './state.js';

let scaleData = {};

export async function loadScales() {
  const resp = await fetch('./data/scales.json');
  scaleData = await resp.json();
  return scaleData;
}

export function getScaleNames() {
  return Object.keys(scaleData);
}

export function getIntervals(scaleName) {
  return scaleData[scaleName] || null;
}

// Compute position anchor frets for a scale + root.
// Each position is anchored to a scale note on the low E string, ordered from the root.
// Returns array of { startFret, lo, hi } where lo/hi define the playable fret window.
export function computePositions(scaleName, rootSemitone) {
  const intervals = scaleData[scaleName];
  if (!intervals || intervals.length === 0) return [];

  const lowE = state.TUNING[5]; // low E open = semitone 4
  const rootFret = (rootSemitone - lowE + 12) % 12;

  // All scale note frets on low E (0-11)
  const frets = intervals.map(i => (rootFret + i) % 12);

  // Sort by distance from root fret (ascending up the neck)
  frets.sort((a, b) => {
    const da = (a - rootFret + 12) % 12;
    const db = (b - rootFret + 12) % 12;
    return da - db;
  });

  // Build positions with 5-fret hand span: [startFret-1, startFret+3]
  return frets.map((startFret, i) => {
    const lo = Math.max(0, startFret - 1);
    const hi = Math.min(12, startFret + 3);
    return { index: i, startFret, lo, hi };
  });
}

// Apply a scale to a board's grid, optionally filtered to a single position.
// positionIndex: -1 = all, 0+ = specific position
export function applyScale(board, scaleName, rootSemitone, positionIndex = -1) {
  state.clearGrid(board);
  board.key = rootSemitone;
  board.scale = scaleName;
  board.chord = '';
  board.position = positionIndex;

  const intervals = scaleData[scaleName];
  if (!intervals) return;

  const scaleNotes = new Set(intervals.map(i => (rootSemitone + i) % 12));

  // If a specific position, get the fret window
  let lo = 0, hi = 12;
  if (positionIndex >= 0) {
    const positions = computePositions(scaleName, rootSemitone);
    if (positionIndex < positions.length) {
      lo = positions[positionIndex].lo;
      hi = positions[positionIndex].hi;
    }
  }

  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < state.FRET_COUNT; f++) {
      const semitone = (state.TUNING[s] + f) % 12;
      if (!scaleNotes.has(semitone)) continue;
      if (f >= lo && f <= hi) {
        board.grid[s][f] = true;
      }
    }
  }
}
