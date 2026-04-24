export const DOT_DASH_THRESHOLD_MS = 150;
export const AUTO_COMMIT_DELAY_MS = 600;

export type Symbol = '.' | '-';

export function detectSymbol(durationMs: number): Symbol {
  return durationMs < DOT_DASH_THRESHOLD_MS ? '.' : '-';
}

export function isValidCodePrefix(
  code: string,
  validCodes: Iterable<string>,
): boolean {
  if (code === '') return true;
  for (const valid of validCodes) {
    if (valid === code || valid.startsWith(code)) return true;
  }
  return false;
}
