// Standard tuning: string open note as semitone from C
// E=4, A=9, D=2, G=7, B=11, E=4
export const TUNING = [4, 11, 7, 2, 9, 4]; // high E to low E
export const STRING_NAMES = ['e1', 'b', 'g', 'd', 'a', 'e6'];
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FRET_COUNT = 13; // 0 (open) through 12

// Interval names indexed by semitone distance from root
const INTERVAL_NAMES = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

let nextId = 0;

// All boards
export const boards = [];

export function createBoard() {
  const board = {
    id: nextId++,
    grid: Array.from({ length: 6 }, () => new Array(FRET_COUNT).fill(false)),
    key: 0,
    scale: '',
    position: -1, // -1 = all positions, 0+ = specific position index
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
    for (let f = 0; f < FRET_COUNT; f++)
      board.grid[s][f] = false;
}

export function toggle(board, string, fret) {
  board.grid[string][fret] = !board.grid[string][fret];
}

// Get the note name at a given string/fret position
export function noteName(string, fret) {
  const semitone = (TUNING[string] + fret) % 12;
  return NOTE_NAMES[semitone];
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
