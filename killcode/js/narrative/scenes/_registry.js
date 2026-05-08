// ══════════════════════════════════════════════
// kill.code — narrative/scenes/_registry.js
// SCENES is the only manifest narrative reads from. To add a scene: create a
// file in this folder with a default export, then import + add it here.
// Order matters only as a tiebreaker when multiple scenes match the same event
// — they are queued in registry order.
// ══════════════════════════════════════════════

// Uncomment scenes to enable them. Empty array = no narrative.
// import intro     from './intro.js';
// import rivalLock from './rival-lock.js';

export const SCENES = [
  // intro,
  // rivalLock,
];
