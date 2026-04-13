// Save/load the current page to/from a .gscale file.
// Prefers the File System Access API for a true Save As / Open dialog
// (with folder navigation and new-folder creation). Falls back to download/upload
// for browsers that don't support it (Firefox, Safari).

import * as state from './state.js';

const FILE_VERSION = 1;
const FILE_EXTENSION = '.gscale';
const MIME_TYPE = 'application/json';

// Snapshot the current page into a plain JSON-friendly object.
function serializePage() {
  return {
    version: FILE_VERSION,
    pageTitle: state.pageTitle,
    savedAt: new Date().toISOString(),
    boards: state.boards.map(b => ({
      grid: b.grid.map(row => row.slice()),
      fingers: b.fingers.map(row => row.slice()),
      muted: b.muted.slice(),
      key: b.key,
      scale: b.scale,
      chord: b.chord,
      overlay: b.overlay,
      position: b.position,
      sequence: b.sequence.map(p => ({ s: p.s, f: p.f })),
      caption: b.caption,
      labelMode: b.labelMode,
      includeInExport: b.includeInExport,
      fretLo: b.fretLo,
      fretHi: b.fretHi,
    })),
  };
}

// Restore a page from a parsed JSON object.
// Returns true on success, false on invalid data.
function deserializePage(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.boards)) return false;

  // Clear existing boards
  state.boards.length = 0;

  state.setPageTitle(typeof data.pageTitle === 'string' ? data.pageTitle : '');

  for (const saved of data.boards) {
    const board = state.createBoard();
    // Copy over each field with safe defaults if missing
    if (Array.isArray(saved.grid)) {
      for (let s = 0; s < 6; s++) {
        if (!Array.isArray(saved.grid[s])) continue;
        for (let f = 0; f < state.FRET_COUNT; f++) {
          board.grid[s][f] = !!saved.grid[s][f];
        }
      }
    }
    if (Array.isArray(saved.fingers)) {
      for (let s = 0; s < 6; s++) {
        if (!Array.isArray(saved.fingers[s])) continue;
        for (let f = 0; f < state.FRET_COUNT; f++) {
          board.fingers[s][f] = Number(saved.fingers[s][f]) || 0;
        }
      }
    }
    if (Array.isArray(saved.muted)) {
      for (let s = 0; s < 6; s++) board.muted[s] = !!saved.muted[s];
    }
    if (typeof saved.key === 'number') board.key = saved.key;
    if (typeof saved.scale === 'string') board.scale = saved.scale;
    if (typeof saved.chord === 'string') board.chord = saved.chord;
    if (typeof saved.overlay === 'string') board.overlay = saved.overlay;
    if (typeof saved.position === 'number') board.position = saved.position;
    if (Array.isArray(saved.sequence)) {
      board.sequence = saved.sequence
        .filter(p => p && typeof p.s === 'number' && typeof p.f === 'number')
        .map(p => ({ s: p.s, f: p.f }));
    }
    if (typeof saved.caption === 'string') board.caption = saved.caption;
    if (typeof saved.labelMode === 'string') board.labelMode = saved.labelMode;
    if (typeof saved.includeInExport === 'boolean') board.includeInExport = saved.includeInExport;
    if (typeof saved.fretLo === 'number') board.fretLo = saved.fretLo;
    if (typeof saved.fretHi === 'number') board.fretHi = saved.fretHi;
  }

  // Ensure at least one board exists
  if (state.boards.length === 0) {
    state.createBoard();
  }

  return true;
}

// Build a default filename from the current page title
function suggestedFilename() {
  const title = (state.pageTitle || 'Untitled Fretboard Page').trim();
  // Sanitize: replace characters that are invalid in filenames on Windows
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');
  return safe + FILE_EXTENSION;
}

function isFilePickerSupported() {
  return typeof window.showSaveFilePicker === 'function'
      && typeof window.showOpenFilePicker === 'function';
}

// Save current page to a file via native dialog or download fallback.
// Returns the saved filename on success, or null if user cancelled.
export async function saveToFile() {
  const payload = JSON.stringify(serializePage(), null, 2);

  if (isFilePickerSupported()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedFilename(),
        types: [{
          description: 'Guitar Scale Page',
          accept: { [MIME_TYPE]: [FILE_EXTENSION] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      return handle.name;
    } catch (err) {
      if (err && err.name === 'AbortError') return null; // user cancelled
      console.error('Save failed', err);
      throw err;
    }
  }

  // Fallback: download
  const blob = new Blob([payload], { type: MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return a.download;
}

// Load a page from a file via native dialog or file-input fallback.
// Returns the loaded filename on success, or null if user cancelled.
export async function loadFromFile() {
  if (isFilePickerSupported()) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Guitar Scale Page',
          accept: { [MIME_TYPE]: [FILE_EXTENSION, '.json'] },
        }],
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      if (!deserializePage(data)) throw new Error('Invalid file format');
      return file.name;
    } catch (err) {
      if (err && err.name === 'AbortError') return null;
      console.error('Load failed', err);
      throw err;
    }
  }

  // Fallback: hidden <input type="file">
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${FILE_EXTENSION},.json,${MIME_TYPE}`;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!deserializePage(data)) throw new Error('Invalid file format');
        resolve(file.name);
      } catch (err) {
        reject(err);
      }
    });
    // If user cancels, no change event fires. Resolve null on body focus return.
    const cancelHandler = () => {
      setTimeout(() => {
        if (document.body.contains(input) && (!input.files || !input.files.length)) {
          input.remove();
          resolve(null);
        }
        window.removeEventListener('focus', cancelHandler);
      }, 300);
    };
    window.addEventListener('focus', cancelHandler);
    input.click();
  });
}
