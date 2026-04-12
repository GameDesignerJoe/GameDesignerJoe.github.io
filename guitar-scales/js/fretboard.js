import * as state from './state.js';
import * as scales from './scales.js';
import * as chords from './chords.js';

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
    `<option value="${i}"${i === selected ? ' selected' : ''}>Key: ${name}</option>`
  ).join('');
}

// Build <option> HTML for scale selects
function scaleOptionsHtml(selected) {
  let html = `<option value=""${selected === '' ? ' selected' : ''}>Scale: Custom</option>`;
  for (const name of scales.getScaleNames()) {
    html += `<option value="${name}"${name === selected ? ' selected' : ''}>Scale: ${name}</option>`;
  }
  return html;
}

// Build <option> HTML for label mode selects
function labelOptionsHtml(selected) {
  const modes = [['none', 'None'], ['notes', 'Note Names'], ['intervals', 'Intervals']];
  return modes.map(([val, label]) =>
    `<option value="${val}"${val === selected ? ' selected' : ''}>Labels: ${label}</option>`
  ).join('');
}

// Build <option> HTML for position selects
function positionOptionsHtml(scaleName, rootSemitone, selected) {
  let html = `<option value="-1"${selected === -1 ? ' selected' : ''}>Position: All</option>`;
  const positions = scales.computePositions(scaleName, rootSemitone);
  for (let i = 0; i < positions.length; i++) {
    html += `<option value="${i}"${i === selected ? ' selected' : ''}>Position: ${i + 1}</option>`;
  }
  return html;
}

// Build <option> HTML for chord selects (grouped by category)
function chordOptionsHtml(selected) {
  let html = `<option value=""${selected === '' ? ' selected' : ''}>Chord: None</option>`;
  const categories = chords.getCategories();
  for (const [category, chordMap] of Object.entries(categories)) {
    html += `<optgroup label="${category}">`;
    for (const name of Object.keys(chordMap)) {
      html += `<option value="${name}"${name === selected ? ' selected' : ''}>Chord: ${name}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

// Render a single board's fretboard grid into a container element
function renderGrid(board, container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'fretboard-wrapper';

  // String labels (clickable to toggle mute)
  const sl = document.createElement('div');
  sl.className = 'string-labels';
  for (let s = 0; s < 6; s++) {
    const lbl = document.createElement('div');
    lbl.className = 'string-label' + (board.muted[s] ? ' muted' : '');
    lbl.innerHTML = board.muted[s]
      ? `<span class="string-name dimmed">${STRING_LABELS[s]}</span><span class="mute-x">X</span>`
      : `<span class="string-name">${STRING_LABELS[s]}</span>`;
    lbl.title = board.muted[s] ? 'Click to unmute' : 'Click to mute';
    lbl.addEventListener('click', () => {
      board.muted[s] = !board.muted[s];
      render();
      fireChange();
    });
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

      if (board.muted[s]) cell.classList.add('string-muted');

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
        // If adding a note on a muted string, unmute it
        if (board.grid[s][f] && board.muted[s]) board.muted[s] = false;
        board.scale = '';
        board.chord = '';
        board.position = -1;
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

  const hasScale = board.scale !== '';
  bar.innerHTML = `
    <input type="text" class="board-caption" placeholder="Title..." maxlength="100" value="${board.caption.replace(/"/g, '&quot;')}">
    <select class="board-key">${keyOptionsHtml(board.key)}</select>
    <select class="board-scale">${scaleOptionsHtml(board.scale)}</select>
    <select class="board-position"${hasScale ? '' : ' disabled'}>
      ${hasScale ? positionOptionsHtml(board.scale, board.key, board.position) : '<option value="-1" selected>Position: N/A</option>'}
    </select>
    <select class="board-chord">${chordOptionsHtml(board.chord)}</select>
    <select class="board-labels">${labelOptionsHtml(board.labelMode)}</select>
    <label class="board-export-label" title="Include in export">
      <input type="checkbox" class="board-export" ${board.includeInExport ? 'checked' : ''}> Export
    </label>
    <button class="board-clear" title="Clear this board">Clear</button>
    <button class="board-delete" title="Delete this board">&times;</button>
  `;

  // Wire up controls
  const keySelect = bar.querySelector('.board-key');
  const scaleSelect = bar.querySelector('.board-scale');
  const positionSelect = bar.querySelector('.board-position');
  const chordSelect = bar.querySelector('.board-chord');
  const labelsSelect = bar.querySelector('.board-labels');
  const captionInput = bar.querySelector('.board-caption');
  const exportCheck = bar.querySelector('.board-export');
  const clearBtn = bar.querySelector('.board-clear');
  const deleteBtn = bar.querySelector('.board-delete');

  keySelect.addEventListener('change', () => {
    const root = parseInt(keySelect.value);
    if (scaleSelect.value) {
      scales.applyScale(board, scaleSelect.value, root, board.position);
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
      board.chord = ''; // clear chord when picking a scale
      board.position = -1;
      scales.applyScale(board, scaleName, root, -1);
    } else {
      board.scale = '';
      board.position = -1;
    }
    render();
    fireChange();
  });

  positionSelect.addEventListener('change', () => {
    const pos = parseInt(positionSelect.value);
    if (board.scale) {
      scales.applyScale(board, board.scale, board.key, pos);
    }
    render();
    fireChange();
  });

  chordSelect.addEventListener('change', () => {
    const chordName = chordSelect.value;
    if (chordName) {
      chords.applyChord(board, chordName); // clears scale + position internally
    } else {
      board.chord = '';
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
    board.muted.fill(false);
    board.scale = '';
    board.chord = '';
    board.position = -1;
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
