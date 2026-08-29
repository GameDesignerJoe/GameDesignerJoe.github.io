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
export const VERSION = "2.4.0";

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
/* WHICH FREE-PLAY HOUSES YOU HAVE FINISHED. A set of free-job ids
   ("fp:mom:roomy:3"), exactly like DONE_KEY holds a set of level ids and for
   exactly the same reason: an id survives inserting a band, a character or a
   sixth house, and an index does not. Free play had no progress record at all
   before — it was nine buttons that re-rolled a house and forgot. */
export const FREE_KEY = "tidy-free-done-v1";

/* ---------- HOME: the meta progression ----------
   Three keys, because they answer three different questions and a player can
   be anywhere in one and nowhere in the others. Folding them into one blob
   would mean a schema change every time any of them grows.

     STARS_KEY  the wallet. A BALANCE that goes down when you spend, which is
                a reversal: ⭐ used to be lifetime score that was never spent,
                and upgrades.json had a costs[] array deleted for that reason.
                Prices are read now. Do not re-delete them.
     STORE_KEY   {id: level} for the permanent upgrades bought at home.
     CAST_KEY   the client ids you have unlocked. The campaign is not all there
                at the start: you get Mom and Marguerite, and buy the rest. */
export const STARS_KEY = "tidy-stars-v1";
export const STORE_KEY  = "tidy-home-v1";
export const CAST_KEY  = "tidy-cast-v1";
/* Debug: show every job on the board regardless of progress. Deliberately its
   OWN key rather than a value written into DONE_KEY — see debugUnlocked() in
   js/main.js for why unlocking must not mark anything finished. */
export const UNLOCK_KEY   = "tidy-debug-unlock";
/* Debug: show the talent bench — a button under the inventory that hands you
   any talent at any rank on the spot, instead of waiting for a draft to offer
   it. Its own key, and PERSISTED rather than a session flag, for the same
   reason UNLOCK_KEY is: the thing you are testing usually needs a reload
   (a fresh house, a new build) and a toggle that forgets itself across one is
   a toggle you re-find every time. */
export const TALENT_DEBUG_KEY = "tidy-debug-talents";
/* The campaign as it stood when progress was still an index, frozen. The only
   way to read an old save correctly is to know what index 7 MEANT, so this
   list must never be reordered or edited — it is a historical record, not a
   config. New levels go in levels.json; they never go here. */
/* THE OLD ID SCHEME, and the map off it. Level ids used to be `1-1`, `D-2`,
   `Z-5`: a difficulty tier and a stage number. The tier drifted until it meant
   nothing — Delta Tau Chi spanned 3-1, 3-2, 4-2, 5-2 and 6-1, and `Z-*` was
   shared by TWO clients (odd numbers were the parrot, even were the gorilla).
   "Which client, which stage" was unreadable, which is exactly what a bug
   report needs to say. They are `MAR-2`, `GOR-3` now: three letters of client,
   then the stage.

   ID_MAP EXISTS FOR SAVED DATA, not for the game. DONE_KEY holds level IDS, so
   without it every player's campaign progress would silently reset — the
   done-set would simply match nothing. Applied on read and written back, so it
   runs once per save and is idempotent. Do not delete it: a player who has not
   opened the game since the rename still has old ids in localStorage.

   The IN-FLIGHT save needs nothing: it stores `levelIdx` as well as `levelId`
   and prefers the id only when the id resolves, so an old save falls back to
   the index — which still points at the same level, because the ORDER did not
   change. */
export const ID_MAP = {
  "1-1": "MOM-1", "1-2": "MOM-2",
  "2-1": "MAR-1", "2-2": "MAR-2", "6-2": "MAR-3",
  "3-1": "DEL-1", "3-2": "DEL-2", "4-2": "DEL-3", "5-2": "DEL-4", "6-1": "DEL-5",
  "4-1": "ZOR-1", "5-1": "ZOR-2", "5-3": "ZOR-3",
  "D-1": "DRM-1", "D-2": "DRM-2", "D-3": "DRM-3",
  "T-1": "NET-1", "T-2": "NET-2", "T-3": "NET-3",
  "Z-1": "CAP-1", "Z-3": "CAP-2", "Z-5": "CAP-3",
  "Z-2": "GOR-1", "Z-4": "GOR-2", "Z-6": "GOR-3",
  "7-1": "UNI-1", "7-2": "UNI-2", "7-3": "UNI-3",
  "8-1": "SAM-1", "8-2": "SAM-2", "8-3": "SAM-3",
  "9-1": "ASH-1", "9-2": "ASH-2", "9-3": "ASH-3",
};

export const LEGACY_ORDER = [
  "MOM-1", "MOM-2", "MAR-1", "MAR-2", "DEL-1", "DEL-2", "ZOR-1", "DEL-3",
  "ZOR-2", "DEL-4", "ZOR-3", "DEL-5", "MAR-3", "UNI-1", "SAM-1", "UNI-2",
  "ASH-1", "SAM-2", "UNI-3", "ASH-2", "SAM-3", "ASH-3",
];
export const TALENTS_KEY  = "tidy-campaign-talents";
export const SAVE_DEBOUNCE = 400;

/* Appended as ?v= to every data fetch. GitHub Pages caches assets for ten
   minutes; if you edit a JSON file, push, and don't see the change, bump this. */
export const DATA_VERSION = 23;

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
/* IN-LEVEL talents: drafted during a run, gone when it ends.

   TWO AXES, and they are the whole test for whether a new talent belongs here.
   Either ITEMS MOVE THEMSELVES (`hands`… the house tidying itself a little, in
   a direction you chose) or YOU LEARN WHERE THINGS GO (`intuit`, `label`). The
   game has no timer and no fail state, so nothing is scarce except attention:
   a talent that grants the player an ABILITY — more reach, less risk — is
   invisible within thirty seconds, because the baseline resets and there was
   never any pressure for it to relieve. One that makes the WORLD move is felt
   immediately.

   `intuit` is `sense` and `homesick` merged into one three-rung ladder (glows
   in this room -> names the room -> names the container). One talent used to do
   all three at once, which spent the discovery on a single card and left
   nowhere to scale. `tidyHands` is `magnet` and `oneTrip` merged: filing help
   from the floor and filing help from your hands are one talent with two
   flavours, and as two ids they overlapped so heavily that neither felt like
   anything.

   GONE, AND NOT BY ACCIDENT: `keyring` and `skeleton`. Both manipulated keys,
   and everything touching keys, coins or the ⭐ rate is parked until the base
   is worth building on. Skeleton Key was also near-null — it floored a lock's
   `need` at 1 while the generator gives every CONTAINER lock exactly 1, so it
   could only ever weaken a door, and keys spawn exactly-enough-never-more so
   decrementing a need turned an already-spawned key into undroppable ballast. */
export const TALENT_IDS = [
  "intuit", "tidyHands", "label", "goHome", "surface", "meToo", "pet", "holdall",
];

/* HOME upgrades: bought with ⭐, kept forever. These change HOW YOU PLAY rather
   than what you know, which is the line that decides which list a thing goes
   in. Same both-directions boot check as TALENT_IDS: an id here with no code
   reading it is a card that animates, charges you and does nothing.

   FOUR OF THE FIVE WERE CUT, and the store is deliberately thin until it earns
   its way back:
     `picks`  (Reputation)     +1 talent per house. The strongest buy in any
                               such store and it compounds; its level 2 was
                               also dead on most levels, because it added
                               BEFORE the old rooms-1 clamp. It also broke
                               authoring intent: `rewards: 0` stopped being a
                               floor, so levels written to teach nothing did.
     `cards`  (Business Cards) discounted CLIENTS, who are free now. Its level
                               2 never paid for itself even when they were not.
     `spare`  (Spare Set)      started you holding a key — in a hand slot, so
                               on the eight campaign levels with no container
                               lock you paid 55 ⭐ to play with four slots of
                               five. An anti-upgrade.
     `wage`   (Good Name)      paid ⭐ per room. A star-rate manipulator, parked
                               with the rest of them, and it fought the whole
                               point of starving the economy. */
export const STORE_IDS = ["hands", "cluster", "petCarry", "petCount", "petSkin"];

/* `stars` was here and is gone with Lucky Find: a consumable that raised the
   run's counter and never banked to the wallet. ⭐ is minted by finishing rooms
   and nothing else. */
export const CONSUMABLE_EFFECTS = ["fileHands"];

/* THE HELPER'S FACES, here rather than in main.js so validate.js can check them
   without importing the render tier. Every one of these is drawn on the floor
   and tapped like an item, so none of them may also be sortable clutter —
   boot validation compares this list against every container's `types` in
   rooms.json and errors if one collides. */
export const PET_SKIN_EMOJI = ["🦔", "🦥", "🦦"];

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
