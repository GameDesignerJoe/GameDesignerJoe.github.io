// Standard Morse PARIS convention: 1 "word" = 5 characters.
// WPM = (characters typed / 5) / minutes elapsed.
export function calculateWpm(charactersTyped, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60000;
  return charactersTyped / 5 / minutes;
}

// Display: 1 decimal under 20, integer at 20+. Per the TDD.
export function formatWpm(wpm) {
  if (!isFinite(wpm) || wpm <= 0) return '0';
  if (wpm < 20) return wpm.toFixed(1);
  return Math.round(wpm).toString();
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
