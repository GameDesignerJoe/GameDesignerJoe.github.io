// Standard tuning: string open note as semitone from C
// E=4, A=9, D=2, G=7, B=11, E=4
export const TUNING = [4, 11, 7, 2, 9, 4]; // high E to low E
export const STRING_NAMES = ['e1', 'b', 'g', 'd', 'a', 'e6'];
export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// Backwards-compatible alias (used by URL encoding/legacy code). Always points to sharps.
export const NOTE_NAMES = NOTE_NAMES_SHARP;
export const FRET_COUNT = 25; // 0 (open) through 24 — max possible frets

// Interval names indexed by semitone distance from root
const INTERVAL_NAMES = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

export let pageTitle = '';
export function setPageTitle(t) { pageTitle = t; }

// Global settings
// handedness: 'right' | 'left' | 'leftUpside'
// 'left' = mirrored horizontally (lefty with restrung guitar)
// 'leftUpside' = mirrored horizontally AND strings reversed vertically (lefty playing
// a right-handed guitar without restringing it)
export const settings = {
  useFlats: false,
  handedness: 'right',
  theme: 'midnight',
};

export function setSetting(key, value) {
  settings[key] = value;
}

// Convenience helpers
export function isLefty() {
  return settings.handedness === 'left' || settings.handedness === 'leftUpside';
}
export function isUpsideDown() {
  return settings.handedness === 'leftUpside';
}

// Get the preferred note names array based on current settings
export function getNoteNames() {
  return settings.useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
}

let nextId = 0;

// All boards
export const boards = [];

export function createBoard() {
  const board = {
    id: nextId++,
    grid: Array.from({ length: 6 }, () => new Array(FRET_COUNT).fill(false)),
    fingers: Array.from({ length: 6 }, () => new Array(FRET_COUNT).fill(0)), // 0=none, 1-4=finger
    muted: new Array(6).fill(false), // per-string mute flags
    key: 0,
    scale: '',
    chord: '',
    overlay: '', // chord name to overlay on top of scale
    position: -1, // -1 = all positions, 0+ = specific position index
    fretLo: 0,   // first visible fret
    fretHi: 12,  // last visible fret
    sequence: [], // array of {s, f} in order clicked — for sequence mode
    caption: '',
    labelMode: 'none',
    includeInExport: true,
  };
  boards.push(board);
  return board;
}

export function removeBoard(id) {
  const idx = boards.findIndex(b => b.id === id);
  if (idx !== -1) boards.splice(idx, 1);
}

export function getBoard(id) {
  return boards.find(b => b.id === id);
}

export function clearGrid(board) {
  for (let s = 0; s < 6; s++)
    for (let f = 0; f < FRET_COUNT; f++) {
      board.grid[s][f] = false;
      board.fingers[s][f] = 0;
    }
}

export function toggle(board, string, fret) {
  board.grid[string][fret] = !board.grid[string][fret];
  if (!board.grid[string][fret]) board.fingers[string][fret] = 0;
}

// Get the note name at a given string/fret position (respects flats/sharps setting)
export function noteName(string, fret) {
  const semitone = (TUNING[string] + fret) % 12;
  return getNoteNames()[semitone];
}

// Check if a fret position is a root note
export function isRoot(string, fret, key) {
  const semitone = (TUNING[string] + fret) % 12;
  return semitone === key;
}

// Get the interval name relative to a key
export function intervalName(string, fret, key) {
  const semitone = (TUNING[string] + fret) % 12;
  const interval = (semitone - key + 12) % 12;
  return INTERVAL_NAMES[interval];
}

// Get boards to export (checked ones, or all if none checked)
export function getExportBoards() {
  const checked = boards.filter(b => b.includeInExport);
  return checked.length > 0 ? checked : boards;
}
