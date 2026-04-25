// Persisted user settings + scores. localStorage is wrapped in try/catch
// so a quota error or private-mode restriction silently falls back to
// defaults.

const SETTINGS_KEY = 'meetmorse:settings';
const SCORES_KEY = 'meetmorse:scores';

export const DEFAULT_SETTINGS = {
  soundOn: true,
  hintsOn: false,                // M2 turned hints off by default; flip in settings
  hintDelayMs: 3000,             // 2000 / 3000 / 5000 / 8000
  autoCommitDelayMs: 600,        // 400 / 600 / 900
  dotDashThresholdMs: 150,       // 120 / 150 / 200 / 250 — boundary between dot and dash
  hapticsOn: true,
  debugTiming: false,            // shows recent press durations below the key
  numbersUnlocked: false,        // tree extension + word content TBD
  punctuationUnlocked: false,
};

export const DEFAULT_SCORES = {
  timedWpmBest: 0,                 // M4
  listenLettersStreak: 0,          // M5 tap-tree letters
  listenWordsStreak: 0,            // M5 tap-tree words
  echoLettersStreak: 0,            // M5 reproduce letters
  echoWordsStreak: 0,              // M5 reproduce words
  speedBestWpm: 0,                 // M5b — highest WPM stage cleared
  memoryWpmBest: 0,                // M6
};

// Old speed stage indices. Used only for migration from pre-WPM-score
// builds; kept here so the migration is self-contained.
const LEGACY_SPEED_STAGE_WPMS = [8, 10, 12, 15, 18, 22, 25];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const stored = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {
    // ignore (quota, private mode, etc.)
  }
}

export function loadScores() {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return { ...DEFAULT_SCORES };
    const stored = JSON.parse(raw);

    // Pre-listen-split migration. The original "Listen" modes required
    // the user to reproduce the audio on the key — what we now call
    // Echo. Their saved bests carry over to the Echo variants so users
    // don't see their high scores vanish; the new tap-tree Listen
    // modes start fresh.
    if ('listeningStreak' in stored) {
      if (stored.echoWordsStreak == null) {
        stored.echoWordsStreak = stored.listeningStreak;
      }
      delete stored.listeningStreak;
    }
    if ('listenLettersStreak' in stored && stored.echoLettersStreak == null) {
      // Old listenLettersStreak was the echo-letters score. Move it to
      // echoLettersStreak; the new tap-tree listenLettersStreak starts
      // at 0 (will be filled in by ...DEFAULT_SCORES merge below).
      stored.echoLettersStreak = stored.listenLettersStreak;
      delete stored.listenLettersStreak;
    }

    // Speed-mode migration: stage indices weren't stable across stage
    // list changes, so we now store the actual best WPM. Convert any
    // saved speedHighStage (using the old 7-stage WPM ladder) to a WPM.
    if ('speedHighStage' in stored) {
      const idx = stored.speedHighStage;
      const wpm = LEGACY_SPEED_STAGE_WPMS[idx] || 0;
      if (wpm > (stored.speedBestWpm || 0)) {
        stored.speedBestWpm = wpm;
      }
      delete stored.speedHighStage;
    }

    return { ...DEFAULT_SCORES, ...stored };
  } catch (_) {
    return { ...DEFAULT_SCORES };
  }
}

export function saveScores(scores) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch (_) {
    // ignore
  }
}
