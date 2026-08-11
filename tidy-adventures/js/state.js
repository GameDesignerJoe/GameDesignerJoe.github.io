/* ============================================================
   STATE — the one mutable game object.

   G is a SINGLETON that is never reassigned, only refilled in place. That
   matters for two reasons:
     1. `import { G }` gives every module a live view with no ceremony.
     2. generate() can be a pure function that RETURNS a run, instead of
        stomping the global — which is what forced startFree/startCampaign to
        patch mode/size/levelIdx back on afterwards, and how a bogus
        size:"long" (not a real size id) shipped in the v3 build.

   `G.active` replaces the old `G === null` sentinel. Menus and the tip loop
   run before any run exists, and reading fields off null was a live crash
   (arrow keys on the title screen threw).

   Imports: config, data.
============================================================ */
import { INV_SIZE, ZOOM_START } from './config.js';
import { upgradeDefaults } from './data.js';

export function blankRun() {
  return {
    active: false,

    /* world */
    rooms: [], items: {}, typeHome: {}, locks: [], rowLen: 5,
    current: 0,

    /* which config produced this run */
    mode: "free", levelIdx: null, size: null, theme: "house",

    /* camera — still the v3 two-state model; Phase 4 replaces it with a
       continuous {z,x,y} once pinch and wheel zoom land. */
    cam: "room", pan: { x: 0, y: 0 },

    /* player */
    inv: Array(INV_SIZE).fill(null), sel: null, openCont: null,

    /* progress + scoring */
    stats: { tosses: 0, firstGood: 0, start: 0 },
    visited: new Set(),
    awarded: new Set(),       // "room|cont|row" of rows already paid out
    points: 0,                // displayed ⭐
    starsEarned: 0,           // lifetime ⭐, drives talent drafts; never decreases
    pendingDrafts: 0,
    draftsTaken: 0,
    up: {},
    whirlReady: 0,
    freeWhirls: 0,
    xrayUntil: 0,

    /* teaching */
    tips: [], tipsDone: new Set(), tipShown: new Set(),
    events: new Set(), tipCtx: {},
    taught: new Set(),        // rules already explained in words, once ever

    /* the note loop */
    quests: { notes: {}, dropped: [], completed: [], active: null },

    /* one-shot effects */
    roomFxDone: new Set(),
    propsShown: new Set(),
    sawFirstGold: false,
  };
}

export const G = blankRun();

/* Replace the run's contents without replacing the object. */
export function setRun(run, meta = {}) {
  Object.assign(G, blankRun(), run, meta, { active: true });
  if (!G.up || !Object.keys(G.up).length) G.up = upgradeDefaults();
  return G;
}

/* Back to "no run in progress" — the title screen state. */
export function endRun() {
  Object.assign(G, blankRun());
}
