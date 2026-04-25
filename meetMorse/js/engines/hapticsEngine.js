export const HAPTIC_DOT_MS = 30;
export const HAPTIC_DASH_MS = 80;

export function vibrate(ms, enabled = true) {
  if (!enabled) return;
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(ms);
}
