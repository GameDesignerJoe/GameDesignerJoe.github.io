// ============================================================
// THE CARTOGRAPHER - state.js
// Single shared mutable state object. No imports.
// All modules import and mutate this directly.
// ============================================================

export const state = {
  // Game status
  gameStarted: false,
  currentTool: 'walk',

  // Player & camera
  player: { x: 0, y: 0 },
  camera: { x: 0, y: 0 },
  zoom: 3.0,
  moveTarget: null,
  lastPlayerPos: { x: 0, y: 0 },

  // Island seed (drives ALL procedural generation)
  seedOffset: Math.floor(Math.random() * 100000),
  placementSeed: Math.floor(Math.random() * 100000),

  // Fog of war
  revealedTiles: new Set(),   // "tx,ty" keys
  surveyedTiles: new Set(),   // "tx,ty" keys

  // Map features
  landmarks: [],
  specimens: [],
  discoveredLandmarks: new Set(),
  collectedSpecimens: [],
  mapPercent: 0,

  // Measurement
  measuring: false,
  measureTrail: [],       // Array of {x, y} world positions
  measureDistance: 0,     // Running total in game meters
  completedMeasures: [],  // Array of { trail, distance }

  // Sextant / coordinate reveal
  sextantReadings: [],      // Array of { x, y, time }
  coordDigitsLat: [],       // Array of { char, revealed, fresh }
  coordDigitsLng: [],       // Array of { char, revealed, fresh }
  revealedDigitCount: 0,

  // Measurement quest
  measurementQuest: null,   // { lm1, lm2, targetDist, completed }

  // Completion
  completionShown: false,
  startTime: 0,

  // Active canvas animation
  activeAnimation: null,

  // Input state
  keys: {},
  lastPinchDist: 0,

  // Debug flags
  debug: { hideOcean: false },
};
