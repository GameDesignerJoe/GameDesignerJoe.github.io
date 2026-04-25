// Persisted user settings. localStorage is wrapped in try/catch so a
// quota error or private-mode restriction silently falls back to defaults.

const KEY = 'meetmorse:settings';

export const DEFAULT_SETTINGS = {
  soundOn: true,
  hintsOn: false,            // M2 turned hints off by default; flip in settings
  hintDelayMs: 3000,         // 2000 / 3000 / 5000 / 8000
  autoCommitDelayMs: 600,    // 400 / 600 / 900
  hapticsOn: true,
  numbersUnlocked: false,    // tree extension + word content TBD
  punctuationUnlocked: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
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
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (_) {
    // ignore (quota, private mode, etc.)
  }
}
