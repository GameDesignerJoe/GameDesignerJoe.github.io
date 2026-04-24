import { create } from 'zustand';
import { CODE_TO_LETTER } from '../data/morseTree';
import {
  AUTO_COMMIT_DELAY_MS,
  detectSymbol,
  type Symbol,
} from '../engines/inputEngine';
import {
  HAPTIC_DASH_MS,
  HAPTIC_DOT_MS,
  vibrate,
} from '../engines/hapticsEngine';
import { audioEngine } from '../engines/audioEngine';

const MAX_TAPE_LENGTH = 40;
const ERROR_FLASH_MS = 400;

interface InputState {
  pressing: boolean;
  currentCode: string;
  tape: string[];
  errorCode: string | null;
  committedCode: string | null;
  pressDown: () => void;
  pressUp: () => void;
  commitLetter: () => void;
  clearError: () => void;
  resetTape: () => void;
}

let pressStartMs: number | null = null;
let autoCommitTimer: ReturnType<typeof setTimeout> | null = null;
let errorTimer: ReturnType<typeof setTimeout> | null = null;
let committedFlashTimer: ReturnType<typeof setTimeout> | null = null;

export const useInputStore = create<InputState>((set, get) => {
  const scheduleAutoCommit = () => {
    if (autoCommitTimer) clearTimeout(autoCommitTimer);
    autoCommitTimer = setTimeout(() => {
      get().commitLetter();
    }, AUTO_COMMIT_DELAY_MS);
  };

  const clearAutoCommit = () => {
    if (autoCommitTimer) {
      clearTimeout(autoCommitTimer);
      autoCommitTimer = null;
    }
  };

  return {
    pressing: false,
    currentCode: '',
    tape: [],
    errorCode: null,
    committedCode: null,

    pressDown: () => {
      if (get().pressing) return;
      clearAutoCommit();
      audioEngine.init();
      audioEngine.startTone();
      pressStartMs = performance.now();
      set({ pressing: true });
    },

    pressUp: () => {
      if (!get().pressing) return;
      audioEngine.stopTone();
      const duration =
        pressStartMs != null ? performance.now() - pressStartMs : 0;
      pressStartMs = null;
      const symbol: Symbol = detectSymbol(duration);
      vibrate(symbol === '.' ? HAPTIC_DOT_MS : HAPTIC_DASH_MS);
      const nextCode = get().currentCode + symbol;
      set({ pressing: false, currentCode: nextCode });
      scheduleAutoCommit();
    },

    commitLetter: () => {
      clearAutoCommit();
      const code = get().currentCode;
      if (!code) return;
      const letter = CODE_TO_LETTER[code];
      if (letter) {
        if (committedFlashTimer) clearTimeout(committedFlashTimer);
        const nextTape = [...get().tape, letter].slice(-MAX_TAPE_LENGTH);
        set({ tape: nextTape, currentCode: '', committedCode: code });
        committedFlashTimer = setTimeout(() => {
          set({ committedCode: null });
        }, ERROR_FLASH_MS);
      } else {
        if (errorTimer) clearTimeout(errorTimer);
        set({ currentCode: '', errorCode: code });
        errorTimer = setTimeout(() => {
          set({ errorCode: null });
        }, ERROR_FLASH_MS);
      }
    },

    clearError: () => {
      if (errorTimer) {
        clearTimeout(errorTimer);
        errorTimer = null;
      }
      set({ errorCode: null });
    },

    resetTape: () => {
      clearAutoCommit();
      set({ currentCode: '', tape: [], errorCode: null, committedCode: null });
    },
  };
});
