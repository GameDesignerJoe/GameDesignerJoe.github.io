// Default fallback threshold. The real threshold lives in state.settings
// (DEFAULT_SETTINGS.dotDashThresholdMs) and is tunable from the settings
// screen. Callers should pass the active threshold explicitly.
export const DEFAULT_DOT_DASH_THRESHOLD_MS = 150;
export const AUTO_COMMIT_DELAY_MS = 600;

export function detectSymbol(durationMs, thresholdMs = DEFAULT_DOT_DASH_THRESHOLD_MS) {
  return durationMs < thresholdMs ? '.' : '-';
}
