// PARIS convention: ditMs = 1200 / wpm. Stages climb from "barely audio"
// to "proficient listener" speed (25 WPM).
export const SPEED_STAGES = [
  { wpm: 4,  ditMs: 300 },
  { wpm: 6,  ditMs: 200 },
  { wpm: 8,  ditMs: 150 },
  { wpm: 10, ditMs: 120 },
  { wpm: 12, ditMs: 100 },
  { wpm: 15, ditMs: 80  },
  { wpm: 18, ditMs: 67  },
  { wpm: 22, ditMs: 54  },
  { wpm: 25, ditMs: 48  },
];

export const STREAK_TO_ADVANCE = 5;

// How long the user has to tap the right letter after the audio stops.
// Fixed across stages — at higher speeds the audio is shorter, but the
// reaction window stays the same.
export const RESPONSE_WINDOW_MS = 4000;
