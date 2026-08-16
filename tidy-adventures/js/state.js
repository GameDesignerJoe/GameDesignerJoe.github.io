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

    /* camera — a continuous {z,x,y}, read and written by js/camera.js.
       This used to be the string "room", the v3 two-state model, left behind
       when pinch and wheel zoom landed. Every path that STARTS a run happened
       to call resetZoom() afterwards and quietly repaired it; Continue did
       not, so a resumed run had a string here and the first zoom threw
       "Cannot create property 'z' on string 'room'". Walking through a door
       threw too, in resetPan(), leaving the run pointing at a room it had not
       drawn. */
    cam: { z: ZOOM_START, x: 0, y: 0 },

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
    sawFirstGold: false,
  };
}

export const G = blankRun();

/* Replace the run's contents without replacing the object. */
export function setRun(run, meta = {}) {
  Object.assign(G, blankRun(), run, meta, { active: true });
  if (!G.up || !Object.keys(G.up).length) G.up = upgradeDefaults();
  /* Every run funnels through here, so this is the one place that can promise
     the camera is a camera — whatever a caller or an old save hands over. */
  if (!G.cam || typeof G.cam !== "object") G.cam = { z: ZOOM_START, x: 0, y: 0 };
  return G;
}

/* Back to "no run in progress" — the title screen state. */
export function endRun() {
  Object.assign(G, blankRun());
}
