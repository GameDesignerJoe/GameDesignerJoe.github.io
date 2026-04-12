import * as state from './state.js';

const STRING_LABELS = ['E', 'B', 'G', 'D', 'A', 'E'];
const INLAY_FRETS = [3, 5, 7, 9, 12]; // frets that get dot inlays
const INLAY_STRING = 2; // inlay appears on string index 2 (middle area), plus 12th fret double

let showNotes = false;
let onChangeCallback = null;

export function setShowNotes(val) {
  showNotes = val;
  render();
}

export function onChange(cb) {
  onChangeCallback = cb;
}

export function render() {
  const fb = document.getElementById('fretboard');
  const sl = document.getElementById('string-labels');
  const fn = document.getElementById('fret-numbers');
  fb.innerHTML = '';
  sl.innerHTML = '';
  fn.innerHTML = '';

  // String labels
  for (let s = 0; s < 6; s++) {
    const lbl = document.createElement('div');
    lbl.textContent = STRING_LABELS[s];
    sl.appendChild(lbl);
  }

  // Fret cells
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < state.FRET_COUNT; f++) {
      const cell = document.createElement('div');
      cell.className = 'fret-cell';
      cell.dataset.string = s;
      cell.dataset.fret = f;

      // Inlay markers (only on middle strings for single dots, both 2 & 3 for 12th fret)
      if (f === 12 && (s === 1 || s === 4)) {
        cell.classList.add('inlay');
      } else if (INLAY_FRETS.includes(f) && f !== 12 && s === INLAY_STRING) {
        cell.classList.add('inlay');
      }

      // Note dot if active
      if (state.grid[s][f]) {
        const dot = document.createElement('div');
        dot.className = 'note-dot';
        if (state.isRoot(s, f)) dot.classList.add('root');
        if (showNotes) dot.textContent = state.noteName(s, f);
        cell.appendChild(dot);
      }

      cell.addEventListener('click', () => {
        state.toggle(s, f);
        state.setScale(''); // switch to custom
        render();
        if (onChangeCallback) onChangeCallback();
      });

      fb.appendChild(cell);
    }
  }

  // Fret numbers
  for (let f = 0; f < state.FRET_COUNT; f++) {
    const num = document.createElement('div');
    num.className = 'fret-num';
    num.textContent = f === 0 ? '' : f;
    fn.appendChild(num);
  }
}
