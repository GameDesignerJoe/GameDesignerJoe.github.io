import * as state from './state.js';
import * as scales from './scales.js';
import * as chords from './chords.js';

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
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
  const modes = [['none', 'None'], ['notes', 'Note Names'], ['intervals', 'Intervals'], ['sequence', 'Sequence']];
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

// Build <option> HTML for overlay chord selects
function overlayOptionsHtml(selected) {
  let html = `<option value=""${selected === '' ? ' selected' : ''}>Overlay: None</option>`;
  const categories = chords.getCategories();
  for (const [category, chordMap] of Object.entries(categories)) {
    html += `<optgroup label="${category}">`;
    for (const name of Object.keys(chordMap)) {
      html += `<option value="${name}"${name === selected ? ' selected' : ''}>Overlay: ${name}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

// Render a single board's fretboard grid into a container element
function renderGrid(board, container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'fretboard-wrapper';
  const lefty = state.isLefty();
  const upside = state.isUpsideDown();
  if (lefty) wrapper.classList.add('lefty');
  if (upside) wrapper.classList.add('upside');

  // String label display order — reversed for upside-down mode
  // Grid data stays s=0..5 (high e to low E); only the visual order changes.
  const stringIndices = upside ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];

  // String labels (clickable to toggle mute)
  const sl = document.createElement('div');
  sl.className = 'string-labels';
  for (const s of stringIndices) {
    const lbl = document.createElement('div');
    lbl.className = 'string-label' + (board.muted[s] ? ' muted' : '');
    // In lefty mode, put X before the letter since labels are on the right side
    const mutedHtml = lefty
      ? `<span class="mute-x">X</span><span class="string-name dimmed">${STRING_LABELS[s]}</span>`
      : `<span class="string-name dimmed">${STRING_LABELS[s]}</span><span class="mute-x">X</span>`;
    lbl.innerHTML = board.muted[s]
      ? mutedHtml
      : `<span class="string-name">${STRING_LABELS[s]}</span>`;
    lbl.title = board.muted[s] ? 'Click to unmute' : 'Click to mute';
    lbl.addEventListener('click', () => {
      board.muted[s] = !board.muted[s];
      render();
      fireChange();
    });
    sl.appendChild(lbl);
  }

  const col = document.createElement('div');
  col.className = 'fretboard-col';

  // Fretboard grid
  const fb = document.createElement('div');
  fb.className = 'fretboard';
  const visibleFrets = board.fretHi - board.fretLo + 1;
  const hasOpen = board.fretLo === 0;

  // Cap the width so small fret counts don't stretch absurdly
  // ~80px per fret feels right; scale up for more frets, no cap above 10
  if (visibleFrets <= 10) {
    wrapper.style.maxWidth = (visibleFrets * 80) + 'px';
  }
  // Open fret gets narrow column, numbered frets get equal 1fr
  // In lefty mode, the open column goes on the right instead of the left
  const openCols = hasOpen ? (lefty ? ' 3%' : '3% ') : '';
  const fretCols = hasOpen ? visibleFrets - 1 : visibleFrets;
  fb.style.gridTemplateColumns = lefty
    ? `repeat(${fretCols}, 1fr)${openCols}`
    : `${openCols}repeat(${fretCols}, 1fr)`;

  // Compute overlay grid if an overlay chord is set
  const overlayGrid = board.overlay ? chords.computeOverlayGrid(board.overlay) : null;

  // Build the fret iteration order: low-to-high for righty, high-to-low for lefty
  const fretOrder = [];
  if (lefty) {
    // For lefty with open fret, open goes at the end (right side)
    for (let f = board.fretHi; f > board.fretLo; f--) fretOrder.push(f);
    for (let f = board.fretLo; f <= board.fretLo && hasOpen; f++) fretOrder.push(f);
    if (!hasOpen) {
      // re-build simple reverse
      fretOrder.length = 0;
      for (let f = board.fretHi; f >= board.fretLo; f--) fretOrder.push(f);
    }
  } else {
    for (let f = board.fretLo; f <= board.fretHi; f++) fretOrder.push(f);
  }

  for (const s of stringIndices) {
    for (const f of fretOrder) {
      const cell = document.createElement('div');
      cell.className = 'fret-cell';
      cell.dataset.string = s;
      cell.dataset.fret = f;

      if (board.muted[s]) cell.classList.add('string-muted');

      const isDoubleDot = (f === 12 || f === 24);
      if (isDoubleDot && (s === 1 || s === 4)) {
        cell.classList.add('inlay');
      } else if (INLAY_FRETS.includes(f) && !isDoubleDot && s === INLAY_STRING) {
        cell.classList.add('inlay');
      }

      const isOverlay = overlayGrid && overlayGrid[s][f];
      const isActive = board.grid[s][f];
      const isSequenceMode = board.labelMode === 'sequence';
      const seqIndex = isSequenceMode ? board.sequence.findIndex(p => p.s === s && p.f === f) : -1;
      const isInSequence = seqIndex >= 0;

      if (isActive) {
        const dot = document.createElement('div');
        dot.className = 'note-dot';
        if (isOverlay) dot.classList.add('overlay-hit');
        if (state.isRoot(s, f, board.key)) dot.classList.add('root');
        if (isInSequence) dot.classList.add('seq-active');

        const finger = board.fingers[s][f];
        if (finger > 0) {
          dot.textContent = finger;
          dot.classList.add('has-finger');
        } else if (isSequenceMode) {
          dot.textContent = state.intervalName(s, f, board.key);
        } else if (board.labelMode === 'notes') {
          dot.textContent = state.noteName(s, f);
        } else if (board.labelMode === 'intervals') {
          dot.textContent = state.intervalName(s, f, board.key);
        }
        cell.appendChild(dot);
      } else if (isOverlay) {
        const dot = document.createElement('div');
        dot.className = 'note-dot overlay-only';
        if (board.labelMode === 'notes') dot.textContent = state.noteName(s, f);
        else if (board.labelMode === 'intervals' || isSequenceMode) dot.textContent = state.intervalName(s, f, board.key);
        cell.appendChild(dot);
      }

      cell.addEventListener('click', (e) => {
        if (isSequenceMode) {
          // Shift-click in sequence mode: remove the dot entirely
          if (e.shiftKey && board.grid[s][f]) {
            board.grid[s][f] = false;
            board.fingers[s][f] = 0;
            // Remove all occurrences from sequence
            board.sequence = board.sequence.filter(p => !(p.s === s && p.f === f));
            render();
            fireChange();
            return;
          }
          // Sequence mode click logic
          const existingIdx = board.sequence.findIndex(p => p.s === s && p.f === f);
          if (existingIdx >= 0 && existingIdx === board.sequence.length - 1) {
            // Clicking the last dot removes it from the sequence
            board.sequence.pop();
          } else if (existingIdx < 0) {
            // Not in sequence — add the dot if needed, then add to sequence
            if (!board.grid[s][f]) {
              board.grid[s][f] = true;
              if (board.muted[s]) board.muted[s] = false;
            }
            board.sequence.push({ s, f });
          }
          render();
          fireChange();
          return;
        }

        if (e.shiftKey && board.grid[s][f]) {
          board.fingers[s][f] = board.fingers[s][f] >= 4 ? 0 : board.fingers[s][f] + 1;
          render();
          fireChange();
          return;
        }
        state.toggle(board, s, f);
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

  // Sequence lines (SVG overlay)
  // Filter sequence to only valid grid entries before drawing
  if (board.labelMode === 'sequence') {
    board.sequence = board.sequence.filter(p => board.grid[p.s][p.f]);
  }
  if (board.labelMode === 'sequence' && board.sequence.length >= 2) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('seq-lines');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    fb.style.position = 'relative';
    fb.appendChild(svg);

    // Use a double rAF to ensure layout is fully settled
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fbRect = fb.getBoundingClientRect();
      if (fbRect.width === 0 || fbRect.height === 0) return;
      svg.setAttribute('viewBox', `0 0 ${fbRect.width} ${fbRect.height}`);

      for (let i = 0; i < board.sequence.length - 1; i++) {
        const from = board.sequence[i];
        const to = board.sequence[i + 1];
        const fromCell = fb.querySelector(`.fret-cell[data-string="${from.s}"][data-fret="${from.f}"]`);
        const toCell = fb.querySelector(`.fret-cell[data-string="${to.s}"][data-fret="${to.f}"]`);
        if (!fromCell || !toCell) continue;

        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();

        const x1 = fromRect.left + fromRect.width / 2 - fbRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - fbRect.top;
        const x2 = toRect.left + toRect.width / 2 - fbRect.left;
        const y2 = toRect.top + toRect.height / 2 - fbRect.top;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#22c55e');
        line.setAttribute('stroke-width', '5');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      }
    }));
  }

  // Fret numbers row with +/- controls
  const fnRow = document.createElement('div');
  fnRow.className = 'fret-numbers-row';

  // "+" button for the low end (adds fretLo - 1)
  const makeAddLow = () => {
    const btn = document.createElement('div');
    btn.className = 'fret-add';
    btn.textContent = '+';
    btn.title = `Add fret ${board.fretLo - 1}`;
    btn.addEventListener('click', () => { board.fretLo--; render(); fireChange(); });
    return btn;
  };
  // "+" button for the high end (adds fretHi + 1)
  const makeAddHigh = () => {
    const btn = document.createElement('div');
    btn.className = 'fret-add';
    btn.textContent = '+';
    btn.title = `Add fret ${board.fretHi + 1}`;
    btn.addEventListener('click', () => { board.fretHi++; render(); fireChange(); });
    return btn;
  };

  // Low-end "+" appears on the left for righty, right for lefty
  if (board.fretLo > 0 && !lefty) fnRow.appendChild(makeAddLow());
  if (board.fretHi < 24 && lefty) fnRow.appendChild(makeAddHigh());

  const fn = document.createElement('div');
  fn.className = 'fret-numbers';
  fn.style.gridTemplateColumns = fb.style.gridTemplateColumns;

  const canRemove = board.fretHi > board.fretLo;
  const numberOrder = lefty
    ? [...fretOrder] // same order as the grid cells
    : [...fretOrder];

  for (const f of numberOrder) {
    const isLoEnd = f === board.fretLo && canRemove;
    const isHiEnd = f === board.fretHi && canRemove;
    const num = document.createElement('div');
    num.className = 'fret-num' + (isLoEnd || isHiEnd ? ' fret-removable' : '');
    num.textContent = f === 0 ? '0' : f;

    if (isLoEnd) {
      num.title = `Remove fret ${f}`;
      num.addEventListener('click', () => { board.fretLo++; render(); fireChange(); });
    } else if (isHiEnd) {
      num.title = `Remove fret ${f}`;
      num.addEventListener('click', () => { board.fretHi--; render(); fireChange(); });
    }
    fn.appendChild(num);
  }
  fnRow.appendChild(fn);

  // High-end "+" appears on the right for righty, left for lefty
  if (board.fretHi < 24 && !lefty) fnRow.appendChild(makeAddHigh());
  if (board.fretLo > 0 && lefty) fnRow.appendChild(makeAddLow());

  col.appendChild(fnRow);

  // Assemble wrapper: string labels on left (righty) or right (lefty)
  if (lefty) {
    wrapper.appendChild(col);
    wrapper.appendChild(sl);
  } else {
    wrapper.appendChild(sl);
    wrapper.appendChild(col);
  }
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
    <select class="board-overlay">${overlayOptionsHtml(board.overlay)}</select>
    <select class="board-labels">${labelOptionsHtml(board.labelMode)}</select>
    <label class="board-export-label" title="Include in export">
      <input type="checkbox" class="board-export" ${board.includeInExport ? 'checked' : ''}> Export
    </label>
    <button class="board-clear" title="Clear this board">Clear</button>
    <button class="board-clear-seq" title="Clear sequence" style="${board.labelMode === 'sequence' ? '' : 'display:none'}">Clear Sequence</button>
    <button class="board-delete" title="Delete this board">&times;</button>
  `;

  // Wire up controls
  const keySelect = bar.querySelector('.board-key');
  const scaleSelect = bar.querySelector('.board-scale');
  const positionSelect = bar.querySelector('.board-position');
  const chordSelect = bar.querySelector('.board-chord');
  const overlaySelect = bar.querySelector('.board-overlay');
  const labelsSelect = bar.querySelector('.board-labels');
  const captionInput = bar.querySelector('.board-caption');
  const exportCheck = bar.querySelector('.board-export');
  const clearBtn = bar.querySelector('.board-clear');
  const clearSeqBtn = bar.querySelector('.board-clear-seq');
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
      chords.applyChord(board, chordName);
      board.overlay = ''; // clear overlay when picking a main chord
    } else {
      board.chord = '';
    }
    render();
    fireChange();
  });

  overlaySelect.addEventListener('change', () => {
    board.overlay = overlaySelect.value;
    render();
    fireChange();
  });

  labelsSelect.addEventListener('change', () => {
    // Clear sequence when leaving sequence mode
    if (board.labelMode === 'sequence' && labelsSelect.value !== 'sequence') {
      board.sequence = [];
    }
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

  clearSeqBtn.addEventListener('click', () => {
    board.sequence = [];
    render();
    fireChange();
  });

  clearBtn.addEventListener('click', () => {
    state.clearGrid(board);
    board.muted.fill(false);
    board.scale = '';
    board.chord = '';
    board.overlay = '';
    board.sequence = [];
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
