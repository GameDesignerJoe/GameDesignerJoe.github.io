export function vibrate(ms: number, enabled = true) {
  if (!enabled) return;
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(ms);
}

export const HAPTIC_DOT_MS = 30;
export const HAPTIC_DASH_MS = 80;
