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

// Apply a scale to the grid: for each string/fret, activate if the note is in the scale
export function applyScale(scaleName, rootSemitone) {
  state.clearGrid();
  state.setKey(rootSemitone);
  state.setScale(scaleName);

  const intervals = scaleData[scaleName];
  if (!intervals) return;

  const scaleNotes = new Set(intervals.map(i => (rootSemitone + i) % 12));

  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < state.FRET_COUNT; f++) {
      const semitone = (state.TUNING[s] + f) % 12;
      if (scaleNotes.has(semitone)) {
        state.grid[s][f] = true;
      }
    }
  }
}
