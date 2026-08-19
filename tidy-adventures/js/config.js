/* ============================================================
   CONFIG — constants that are code, not content.

   If a number is something a designer would want to tune, it belongs in
   data/*.json, not here. What's left is engine plumbing: storage keys,
   grid limits, animation timings, gesture thresholds.

   Imports: none. This is a leaf.
============================================================ */

/* The build, shown on the title screen and in the gear. Bump it whenever you
   ship something you'd want to be able to point at from a phone — it is the
   only way to tell, on a home-screen install, whether the thing in your hand
   is the thing you just pushed. Bump DATA_VERSION with it if any data/*.json
   changed. */
export const VERSION = "1.7.0";

/* ---------- persistence ---------- */
export const SAVE_VERSION = 4;
export const SAVE_KEY     = "tidy-adventures-v" + SAVE_VERSION;
/* The OLD progress key: a single integer, "how many levels are unlocked".
   Read once at boot to migrate, then never written again — left in place so
   rolling back to an older build doesn't lose anyone's campaign. */
export const PROGRESS_KEY = "tidy-campaign-unlocked";
/* The new one: the ids of the jobs you have actually finished. An index can
   only ever mean "the file has not changed since"; ids survive insertion,
   which is what lets a level land in the middle of the campaign. */
export const DONE_KEY     = "tidy-campaign-done";
/* Debug: show every job on the board regardless of progress. Deliberately its
   OWN key rather than a value written into DONE_KEY — see debugUnlocked() in
   js/main.js for why unlocking must not mark anything finished. */
export const UNLOCK_KEY   = "tidy-debug-unlock";
/* The campaign as it stood when progress was still an index, frozen. The only
   way to read an old save correctly is to know what index 7 MEANT, so this
   list must never be reordered or edited — it is a historical record, not a
   config. New levels go in levels.json; they never go here. */
export const LEGACY_ORDER = [
  "1-1","1-2","2-1","2-2","3-1","3-2","4-1","4-2","5-1","5-2","5-3",
  "6-1","6-2","7-1","8-1","7-2","9-1","8-2","7-3","9-2","8-3","9-3",
];
export const TALENTS_KEY  = "tidy-campaign-talents";
export const SAVE_DEBOUNCE = 400;

/* Appended as ?v= to every data fetch. GitHub Pages caches assets for ten
   minutes; if you edit a JSON file, push, and don't see the change, bump this. */
export const DATA_VERSION = 17;

/* ---------- world ---------- */
export const GRID = 3;              // houses grow on a GRID x GRID lattice
export const MAX_ROOMS = GRID * GRID;
export const INV_SIZE = 5;          // starting hand slots, before Bigger Hands
export const BONUS_DOOR_CHANCE = 0.4;
export const JUNK_CONTAINER_CHANCE = 0.25;
export const JUNK_FILL = [0.01, 0.10];   // 1%-10% of a container's capacity
export const CACHE_STASH = [3, 5];       // items hidden in each coin box
export const PLACE_TRIES = 70;           // scatter attempts before giving up
/* Roughly how wide a floor item is, as a % of a FULL-SIZE room. bury() divides
   this by the room's own scale, because the same emoji covers far more of a
   small room. Raise it and keys peek out further; drop it toward 0 and they
   vanish underneath the clutter entirely, which is where this started. */
export const ITEM_SPAN = 9;
/* How long "Debug: where are the keys" flashes for. It used to stay on until
   you went back into the gear and turned it off, which is nagging rather than
   helpful — long enough to point, short enough to shut up. */
export const REVEAL_MS = 5000;

/* ---------- talents ----------
   THE CONTRACT BETWEEN upgrades.json AND THE CODE.

   A talent is data plus a piece of code that reads it, and only the data half
   is visible. Add an id to upgrades.json and nothing else, and you get a card
   that animates, says its name, raises a level and does absolutely nothing —
   which on screen is indistinguishable from a talent you simply misunderstood.
   That is not hypothetical: two consumables shipped in exactly that state,
   setting a field on the run that nothing ever read.

   So the ids the code implements live HERE, in a tier-0 leaf that both
   js/validate.js and js/talents.js can see, and boot validation compares this
   list against the data in both directions. Adding either half without the
   other is a named error on a black screen instead of a quiet nothing. */
export const TALENT_IDS = ["hands", "sense", "magnet", "oneTrip", "homesick"];
export const CONSUMABLE_EFFECTS = ["stars", "fileHands"];

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
