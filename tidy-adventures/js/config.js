/* ============================================================
   CONFIG — constants that are code, not content.

   If a number is something a designer would want to tune, it belongs in
   data/*.json, not here. What's left is engine plumbing: storage keys,
   grid limits, animation timings, gesture thresholds.

   Imports: none. This is a leaf.
============================================================ */

/* ---------- persistence ---------- */
export const SAVE_VERSION = 4;
export const SAVE_KEY     = "tidy-adventures-v" + SAVE_VERSION;
export const PROGRESS_KEY = "tidy-campaign-unlocked";
export const TALENTS_KEY  = "tidy-campaign-talents";
export const SAVE_DEBOUNCE = 400;

/* Appended as ?v= to every data fetch. GitHub Pages caches assets for ten
   minutes; if you edit a JSON file, push, and don't see the change, bump this. */
export const DATA_VERSION = 3;

/* ---------- world ---------- */
export const GRID = 3;              // houses grow on a GRID x GRID lattice
export const MAX_ROOMS = GRID * GRID;
export const INV_SIZE = 5;          // starting hand slots, before Bigger Hands
export const BONUS_DOOR_CHANCE = 0.4;
export const JUNK_CONTAINER_CHANCE = 0.25;
export const JUNK_FILL = [0.01, 0.10];   // 1%-10% of a container's capacity
export const CACHE_STASH = [3, 5];       // items hidden in each coin box
export const PLACE_TRIES = 70;           // scatter attempts before giving up

export const DIRS = { N:[0,-1], S:[0,1], W:[-1,0], E:[1,0] };
export const OPP  = { N:"S", S:"N", W:"E", E:"W" };
/* Solid triangles, not the old ˄ ˅ ‹ › chevrons: with the doorknob gone the
   glyph carries the whole affordance, and at that size ˅ reads as a letter V
   rather than an arrow. */
export const CHEVRON = { N:"▲", S:"▼", W:"◀", E:"▶" };

/* ---------- camera ---------- */
export const ZOOM_MIN = 0.85;
export const ZOOM_MAX = 2.4;
export const ZOOM_START = 1;
/* Where a double-tap on the floor lands. Short of ZOOM_MAX on purpose: the
   gesture is "get me closer", and leaving headroom keeps pinch and wheel
   meaningful once you're in. */
export const ZOOM_TAP = 1.8;
export const WHEEL_K = 0.0015;      // wheel delta -> zoom exponent
export const FIT_STRENGTH = 0.85;   // 1 = room always fills the stage, 0 = no auto-fit

/* ---------- gestures ---------- */
export const DOUBLE_TAP_MS = 330;
export const DOUBLE_TAP_SLOP = 36;
export const DRAG_THRESHOLD = 10;
export const CELL_DRAG_THRESHOLD = 12;
export const PINCH_TAP_SUPPRESS_MS = 250;

/* ---------- timings (ms) ---------- */
export const T = {
  slide: 340,
  bounce: 120,
  flight: 440,
  toss: 390,
  toastMin: 1400,
  toastMax: 4000,
  toastPerChar: 45,
  toastGap: 200,
  winDelay: 900,
  goldFlash: 900,
  goldFlashFirst: 1600,
  ripple: 900,
  rippleStagger: 180,
};
