export const DOT_DASH_THRESHOLD_MS = 150;
export const AUTO_COMMIT_DELAY_MS = 600;

export function detectSymbol(durationMs) {
  return durationMs < DOT_DASH_THRESHOLD_MS ? '.' : '-';
}
