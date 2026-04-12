import * as state from './state.js';

// Encode current state to URL parameter
// Format: gmcscale_{key}_{e1}{13 bits}_{b}{13 bits}_{g}{13 bits}_{d}{13 bits}_{a}{13 bits}_{e6}{13 bits}
export function encode() {
  const keyName = state.NOTE_NAMES[state.currentKey].toLowerCase().replace('#', 's');
  const parts = ['gmcscale', keyName];

  for (let s = 0; s < 6; s++) {
    const prefix = state.STRING_NAMES[s];
    const bits = state.grid[s].map(v => v ? '1' : '0').join('');
    parts.push(prefix + bits);
  }

  return parts.join('_');
}

// Decode URL parameter into state
export function decode(param) {
  if (!param || !param.startsWith('gmcscale_')) return false;

  const parts = param.split('_');
  if (parts.length < 8) return false; // gmcscale + key + 6 strings

  // Parse key
  const keyStr = parts[1];
  const keyMap = {
    'c': 0, 'cs': 1, 'db': 1, 'd': 2, 'ds': 3, 'eb': 3,
    'e': 4, 'f': 5, 'fs': 6, 'gb': 6, 'g': 7, 'gs': 8, 'ab': 8,
    'a': 9, 'as': 10, 'bb': 10, 'b': 11
  };
  const keyVal = keyMap[keyStr];
  if (keyVal === undefined) return false;

  state.setKey(keyVal);
  state.setScale(''); // URL-loaded = custom
  state.clearGrid();

  // Parse strings — need to reassemble since string names may contain digits
  // Expected order after key: e1, b, g, d, a, e6
  const stringParts = parts.slice(2);
  const expectedPrefixes = state.STRING_NAMES; // ['e1', 'b', 'g', 'd', 'a', 'e6']

  for (let s = 0; s < 6; s++) {
    const raw = stringParts[s];
    const prefix = expectedPrefixes[s];
    if (!raw.startsWith(prefix)) return false;

    const bits = raw.slice(prefix.length);
    for (let f = 0; f < Math.min(bits.length, state.FRET_COUNT); f++) {
      state.grid[s][f] = bits[f] === '1';
    }
  }

  return true;
}

// Update the browser URL without reloading
export function pushToUrl() {
  const encoded = encode();
  const url = new URL(window.location);
  url.searchParams.set('rebuild', encoded);
  history.replaceState(null, '', url);
}

// Read from current URL
export function readFromUrl() {
  const url = new URL(window.location);
  const param = url.searchParams.get('rebuild');
  return param ? decode(param) : false;
}
