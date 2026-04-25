// Speed mode letter tiers — 4 letters per tier, ordered from simplest
// codes (1–2 symbols) to deepest (level 4). 26 doesn't divide by 4, so
// the final tier carries the two least-common level-4 letters.
//
// Each tier runs through the full 9-stage WPM ladder before the next
// tier unlocks; clearing tier 7 stage 9 is "mastered".
export const SPEED_TIERS = [
  { id: 0, letters: ['E', 'T', 'I', 'A'] },           // 1–2 symbols
  { id: 1, letters: ['N', 'M', 'S', 'U'] },           // 2–3 symbols
  { id: 2, letters: ['R', 'W', 'D', 'K'] },           // 3 symbols
  { id: 3, letters: ['G', 'O', 'H', 'V'] },           // 3–4 symbols
  { id: 4, letters: ['F', 'L', 'P', 'J'] },           // 4 symbols (dot-side)
  { id: 5, letters: ['B', 'X', 'C', 'Y'] },           // 4 symbols (dash-side)
  { id: 6, letters: ['Z', 'Q'] },                     // 2 hardest, less-common
];

// All letters that have unlocked by the time the user reaches a given
// tier index. Used by the grid to dim everything they shouldn't be
// thinking about right now.
export function activeLettersForTier(tierIdx) {
  return new Set(SPEED_TIERS[tierIdx]?.letters || []);
}
