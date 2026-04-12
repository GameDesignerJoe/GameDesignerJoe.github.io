import * as state from './state.js';

const KEY_MAP = {
  'c': 0, 'cs': 1, 'db': 1, 'd': 2, 'ds': 3, 'eb': 3,
  'e': 4, 'f': 5, 'fs': 6, 'gb': 6, 'g': 7, 'gs': 8, 'ab': 8,
  'a': 9, 'as': 10, 'bb': 10, 'b': 11
};

function keyToStr(key) {
  return state.NOTE_NAMES[key].toLowerCase().replace('#', 's');
}

// Encode a single board to the gmcscale format
function encodeBoard(board) {
  const parts = ['gmcscale', keyToStr(board.key)];
  for (let s = 0; s < 6; s++) {
    const prefix = state.STRING_NAMES[s];
    const bits = board.grid[s].map(v => v ? '1' : '0').join('');
    parts.push(prefix + bits);
  }
  return parts.join('_');
}

// Decode a gmcscale string into a board object (must already exist)
function decodeIntoBoard(board, param) {
  if (!param || !param.startsWith('gmcscale_')) return false;

  const parts = param.split('_');
  if (parts.length < 8) return false;

  const keyVal = KEY_MAP[parts[1]];
  if (keyVal === undefined) return false;

  board.key = keyVal;
  board.scale = '';
  state.clearGrid(board);

  const stringParts = parts.slice(2);
  for (let s = 0; s < 6; s++) {
    const raw = stringParts[s];
    const prefix = state.STRING_NAMES[s];
    if (!raw.startsWith(prefix)) return false;
    const bits = raw.slice(prefix.length);
    for (let f = 0; f < Math.min(bits.length, state.FRET_COUNT); f++) {
      board.grid[s][f] = bits[f] === '1';
    }
  }
  return true;
}

// Update the browser URL with all boards
export function pushToUrl() {
  const u = new URL(window.location);
  // Clear old params
  for (const key of [...u.searchParams.keys()]) {
    u.searchParams.delete(key);
  }

  for (let i = 0; i < state.boards.length; i++) {
    const board = state.boards[i];
    u.searchParams.set(`b${i}`, encodeBoard(board));
    if (board.caption) u.searchParams.set(`t${i}`, encodeURIComponent(board.caption));
    if (board.labelMode !== 'none') u.searchParams.set(`l${i}`, board.labelMode);
    if (board.position >= 0) u.searchParams.set(`p${i}`, board.position.toString());
  }

  history.replaceState(null, '', u);
}

// Read boards from current URL. Returns true if boards were loaded.
export function readFromUrl() {
  const u = new URL(window.location);

  // New multi-board format: b0, b1, b2...
  if (u.searchParams.has('b0')) {
    let i = 0;
    while (u.searchParams.has(`b${i}`)) {
      const board = state.createBoard();
      decodeIntoBoard(board, u.searchParams.get(`b${i}`));
      const title = u.searchParams.get(`t${i}`);
      if (title) board.caption = decodeURIComponent(title);
      const labelMode = u.searchParams.get(`l${i}`);
      if (labelMode) board.labelMode = labelMode;
      const pos = u.searchParams.get(`p${i}`);
      if (pos !== null) board.position = parseInt(pos);
      i++;
    }
    return true;
  }

  // Legacy single-board format: rebuild= + title=
  if (u.searchParams.has('rebuild')) {
    const board = state.createBoard();
    decodeIntoBoard(board, u.searchParams.get('rebuild'));
    const title = u.searchParams.get('title');
    if (title) board.caption = decodeURIComponent(title);
    return true;
  }

  return false;
}
