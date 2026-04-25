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
  speedBestTier: 0,                // M5c — highest tier reached (0–6)
  speedBestStage: 0,               // M5c — highest stage within that tier (0–8)
  memoryWpmBest: 0,                // M6
};

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

    // Speed mode was redesigned around tiered letter groups. Old
    // speedHighStage (index) and speedBestWpm (raw WPM, full alphabet)
    // don't translate cleanly — the new mode practices subsets of
    // letters, so a 12 WPM score on the old "all 26" mode isn't the
    // same achievement as 12 WPM on tier 1's four easy letters. Reset
    // and let users earn new bests in the new system.
    delete stored.speedHighStage;
    delete stored.speedBestWpm;

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
