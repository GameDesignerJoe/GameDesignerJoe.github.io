import * as state from './state.js';

let chordData = {}; // { category: { chordName: [e1, b, g, d, a, e6] } }
let flatChords = {}; // { chordName: [e1, b, g, d, a, e6] } — flattened for quick lookup

export async function loadChords() {
  const resp = await fetch('./data/chords.json');
  chordData = await resp.json();
  // Flatten into a single lookup
  flatChords = {};
  for (const category of Object.values(chordData)) {
    Object.assign(flatChords, category);
  }
  return chordData;
}

export function getCategories() {
  return chordData;
}

export function getChordNames() {
  return Object.keys(flatChords);
}

export function getVoicing(chordName) {
  return flatChords[chordName] || null;
}

// Compute an overlay grid for a chord voicing.
// Returns a 6×13 boolean grid marking the chord's fret positions.
export function computeOverlayGrid(chordName) {
  const grid = Array.from({ length: 6 }, () => new Array(state.FRET_COUNT).fill(false));
  const voicing = flatChords[chordName];
  if (!voicing) return grid;
  for (let s = 0; s < 6; s++) {
    const fret = voicing[s];
    if (fret >= 0) grid[s][fret] = true;
  }
  return grid;
}

// Apply a chord voicing to a board's grid.
// Voicing is [e1, b, g, d, a, e6] where -1 = muted, 0+ = fret number.
export function applyChord(board, chordName) {
  state.clearGrid(board);
  board.chord = chordName;
  board.scale = '';
  board.position = -1;

  const voicing = flatChords[chordName];
  if (!voicing) return;

  // Set root key from chord name (first letter + optional sharp/flat)
  const rootMatch = chordName.match(/^([A-G][b#]?)/);
  if (rootMatch) {
    const rootMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
      'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const key = rootMap[rootMatch[1]];
    if (key !== undefined) board.key = key;
  }

  for (let s = 0; s < 6; s++) {
    const fret = voicing[s];
    if (fret >= 0) {
      board.grid[s][fret] = true;
      board.muted[s] = false;
    } else {
      board.muted[s] = true;
    }
  }
}
