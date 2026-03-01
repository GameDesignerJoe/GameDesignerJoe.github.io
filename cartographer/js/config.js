// ============================================================
// THE CARTOGRAPHER - config.js
// All constants. No imports.
// ============================================================

export const TILE = 40;         // pixels per tile at zoom 1
export const ISLAND_R = 14;     // island radius in tiles
export const GRID = ISLAND_R * 2 + 1; // 29

export const ZOOM_MIN = 1.0;
export const ZOOM_MAX = 3.0;
export const ZOOM_SPEED = 0.1;

export const PLAYER_SPEED = 0.06;        // tiles per frame
export const CAMERA_LERP = 0.08;

export const REVEAL_RADIUS = 1;          // tiles revealed around player (3x3)
export const START_REVEAL_RADIUS = 2;    // initial reveal on spawn (5x5)
export const SURVEY_RADIUS = 3.5;        // theodolite survey radius in tiles

export const MEASURE_STEP_THRESHOLD = 0.15; // min move to record trail point
export const MEASURE_METERS_PER_TILE = 23;  // game-world meters per tile

export const SPECIMEN_COLLECT_RADIUS = 2;   // tiles proximity to collect
export const LANDMARK_DISCOVERY_RADIUS = 3.5;

export const TOTAL_DIGITS = 10;     // sextant coordinate digits total (5 lat + 5 lng)
export const MIN_DISTANCE_BASE = 3; // min tile distance for first sextant fix
export const DISTANCE_SCALE = 0.8;  // required distance growth per digit revealed

export const CONTOUR_LEVELS = [0.15, 0.3, 0.45, 0.6, 0.75];

export const COLORS = {
  parchment: '#f5ebdc',
  water: '#e8ecee',     // faint cool blue — ocean fill, contrasts with warm parchment land
  ink: '#3a2f24',
  inkLight: '#6a5a48',
  waterInk: '#5a7a8a',
  fog: '#ddd4c4',
  red: '#c4553d',
  coordBlue: '#4a7a9a',
};
