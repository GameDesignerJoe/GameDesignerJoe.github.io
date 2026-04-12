import * as state from './state.js';
import * as scales from './scales.js';

const STRING_LABELS = ['E', 'B', 'G', 'D', 'A', 'E'];
const INLAY_FRETS = [3, 5, 7, 9, 12];
const INLAY_STRING = 2;

let onChangeCallback = null;

export function onChange(cb) {
  onChangeCallback = cb;
}

function fireChange() {
  if (onChangeCallback) onChangeCallback();
}

// Build the <option> HTML for key selects (reused per board)
function keyOptionsHtml(selected) {
  const keys = [
    'C', 'C# / Db', 'D', 'D# / Eb', 'E', 'F',
    'F# / Gb', 'G', 'G# / Ab', 'A', 'A# / Bb', 'B'
  ];
  return keys.map((name, i) =>
    `<option value="${i}"${i === selected ? ' selected' : ''}>${name}</option>`
  ).join('');
}

// Build <option> HTML for scale selects
function scaleOptionsHtml(selected) {
  let html = `<option value=""${selected === '' ? ' selected' : ''}>-- Custom --</option>`;
  for (const name of scales.getScaleNames()) {
    html += `<option value="${name}"${name === selected ? ' selected' : ''}>${name}</option>`;
  }
  return html;
}

// Build <option> HTML for label mode selects
function labelOptionsHtml(selected) {
  const modes = [['none', 'None'], ['notes', 'Note Names'], ['intervals', 'Intervals']];
  return modes.map(([val, label]) =>
    `<option value="${val}"${val === selected ? ' selected' : ''}>${label}</option>`
  ).join('');
}

// Render a single board's fretboard grid into a container element
function renderGrid(board, container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'fretboard-wrapper';

  // String labels
  const sl = document.createElement('div');
  sl.className = 'string-labels';
  for (let s = 0; s < 6; s++) {
    const lbl = document.createElement('div');
    lbl.textContent = STRING_LABELS[s];
    sl.appendChild(lbl);
  }
  wrapper.appendChild(sl);

  const col = document.createElement('div');
  col.className = 'fretboard-col';

  // Fretboard grid
  const fb = document.createElement('div');
  fb.className = 'fretboard';

  for (let s = 0; s < 6; s++) {
    for (let f = 0; f < state.FRET_COUNT; f++) {
      const cell = document.createElement('div');
      cell.className = 'fret-cell';
      cell.dataset.string = s;
      cell.dataset.fret = f;

      if (f === 12 && (s === 1 || s === 4)) {
        cell.classList.add('inlay');
      } else if (INLAY_FRETS.includes(f) && f !== 12 && s === INLAY_STRING) {
        cell.classList.add('inlay');
      }

      if (board.grid[s][f]) {
        const dot = document.createElement('div');
        dot.className = 'note-dot';
        if (state.isRoot(s, f, board.key)) dot.classList.add('root');
        if (board.labelMode === 'notes') dot.textContent = state.noteName(s, f);
        else if (board.labelMode === 'intervals') dot.textContent = state.intervalName(s, f, board.key);
        cell.appendChild(dot);
      }

      cell.addEventListener('click', () => {
        state.toggle(board, s, f);
        board.scale = '';
        render();
        fireChange();
      });

      fb.appendChild(cell);
    }
  }
  col.appendChild(fb);

  // Fret numbers
  const fn = document.createElement('div');
  fn.className = 'fret-numbers';
  for (let f = 0; f < state.FRET_COUNT; f++) {
    const num = document.createElement('div');
    num.className = 'fret-num';
    num.textContent = f === 0 ? '' : f;
    fn.appendChild(num);
  }
  col.appendChild(fn);
  wrapper.appendChild(col);
  container.appendChild(wrapper);
}

// Render the inline controls bar for a board
function renderBoardControls(board, container) {
  const bar = document.createElement('div');
  bar.className = 'board-controls';

  bar.innerHTML = `
    <input type="text" class="board-caption" placeholder="Title..." maxlength="100" value="${board.caption.replace(/"/g, '&quot;')}">
    <select class="board-key" title="Key">${keyOptionsHtml(board.key)}</select>
    <select class="board-scale" title="Scale">${scaleOptionsHtml(board.scale)}</select>
    <select class="board-labels" title="Labels">${labelOptionsHtml(board.labelMode)}</select>
    <label class="board-export-label" title="Include in export">
      <input type="checkbox" class="board-export" ${board.includeInExport ? 'checked' : ''}> Export
    </label>
    <button class="board-clear" title="Clear this board">Clear</button>
    <button class="board-delete" title="Delete this board">&times;</button>
  `;

  // Wire up controls
  const keySelect = bar.querySelector('.board-key');
  const scaleSelect = bar.querySelector('.board-scale');
  const labelsSelect = bar.querySelector('.board-labels');
  const captionInput = bar.querySelector('.board-caption');
  const exportCheck = bar.querySelector('.board-export');
  const clearBtn = bar.querySelector('.board-clear');
  const deleteBtn = bar.querySelector('.board-delete');

  keySelect.addEventListener('change', () => {
    const root = parseInt(keySelect.value);
    if (scaleSelect.value) {
      scales.applyScale(board, scaleSelect.value, root);
    } else {
      board.key = root;
    }
    render();
    fireChange();
  });

  scaleSelect.addEventListener('change', () => {
    const scaleName = scaleSelect.value;
    const root = parseInt(keySelect.value);
    if (scaleName) {
      scales.applyScale(board, scaleName, root);
    } else {
      board.scale = '';
    }
    render();
    fireChange();
  });

  labelsSelect.addEventListener('change', () => {
    board.labelMode = labelsSelect.value;
    render();
  });

  captionInput.addEventListener('input', () => {
    board.caption = captionInput.value;
    fireChange();
  });

  exportCheck.addEventListener('change', () => {
    board.includeInExport = exportCheck.checked;
  });

  clearBtn.addEventListener('click', () => {
    state.clearGrid(board);
    board.scale = '';
    render();
    fireChange();
  });

  deleteBtn.addEventListener('click', () => {
    if (state.boards.length <= 1) return; // keep at least one
    state.removeBoard(board.id);
    render();
    fireChange();
  });

  // Hide delete if only one board
  if (state.boards.length <= 1) {
    deleteBtn.style.display = 'none';
  }

  container.appendChild(bar);
}

// Render all boards
export function render() {
  const container = document.getElementById('boards-container');
  container.innerHTML = '';

  for (const board of state.boards) {
    const card = document.createElement('div');
    card.className = 'board-card';
    card.dataset.boardId = board.id;

    renderBoardControls(board, card);
    renderGrid(board, card);

    container.appendChild(card);
  }
}
