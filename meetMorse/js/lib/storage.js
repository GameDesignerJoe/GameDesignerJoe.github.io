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
  timedWpmBest: 0,           // M4
  listeningStreak: 0,        // M5
  memoryWpmBest: 0,          // M6
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const stored = JSON.parse(raw);
    // Merge stored over defaults so new keys added later get sane values
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
