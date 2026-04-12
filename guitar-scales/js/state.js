// Standard tuning: string open note as semitone from C
// E=4, A=9, D=2, G=7, B=11, E=4
export const TUNING = [4, 11, 7, 2, 9, 4]; // high E to low E
export const STRING_NAMES = ['e1', 'b', 'g', 'd', 'a', 'e6'];
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FRET_COUNT = 13; // 0 (open) through 12

// 6 strings × 13 frets, true = note active
export const grid = Array.from({ length: 6 }, () => new Array(FRET_COUNT).fill(false));

export let currentKey = 0;   // semitone index into NOTE_NAMES (0 = C)
export let currentScale = ''; // scale name or '' for custom

export function setKey(k) { currentKey = k; }
export function setScale(s) { currentScale = s; }

export function clearGrid() {
  for (let s = 0; s < 6; s++)
    for (let f = 0; f < FRET_COUNT; f++)
      grid[s][f] = false;
}

export function toggle(string, fret) {
  grid[string][fret] = !grid[string][fret];
}

// Get the note name at a given string/fret position
export function noteName(string, fret) {
  const semitone = (TUNING[string] + fret) % 12;
  return NOTE_NAMES[semitone];
}

// Check if a fret position is a root note
export function isRoot(string, fret) {
  const semitone = (TUNING[string] + fret) % 12;
  return semitone === currentKey;
}
