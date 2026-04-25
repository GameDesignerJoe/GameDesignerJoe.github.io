import { state } from '../state.js';
import { renderTree } from '../ui/tree.js';

const FLASH_MS = 400;

// Flash a node red briefly. `kind` colors the flash:
//   'wrong' — generic mistake, default red
//   'fast'  — pressed dot when dash was expected (timing slip), red
//   'slow'  — pressed dash when dot was expected (timing slip), blue
export function flashError(code, kind = 'wrong') {
  if (state.errorTimer) clearTimeout(state.errorTimer);
  state.errorCode = code;
  state.errorKind = kind;
  renderTree();
  state.errorTimer = setTimeout(() => {
    state.errorCode = null;
    state.errorKind = null;
    renderTree();
  }, FLASH_MS);
}

// Flash a node green briefly to confirm a successful commit / tap.
export function flashCommitted(code) {
  if (state.committedTimer) clearTimeout(state.committedTimer);
  state.committedCode = code;
  renderTree();
  state.committedTimer = setTimeout(() => {
    state.committedCode = null;
    renderTree();
  }, FLASH_MS);
}
