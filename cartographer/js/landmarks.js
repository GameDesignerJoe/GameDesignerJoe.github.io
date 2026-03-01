// ============================================================
// THE CARTOGRAPHER - landmarks.js
// Landmark type definitions, procedural generation, discovery.
// ============================================================

import { GRID, LANDMARK_DISCOVERY_RADIUS, MEASURE_METERS_PER_TILE } from './config.js';
import { state } from './state.js';
import { getTerrain, getElevation } from './terrain.js';

export const LANDMARK_TYPES = [
  { name: 'Summit Peak',     type: 'mountain',     icon: '▲', desc: 'The highest point on the island' },
  { name: 'Mirror Lake',     type: 'lake',          icon: '~', desc: 'A still freshwater lake',             terrain: 'lowland'  },
  { name: 'Whispering Cave', type: 'cave',          icon: '◖', desc: 'A deep cave in the hillside',         terrain: 'highland' },
  { name: 'The Elder Oak',   type: 'ancient_tree',  icon: '♣', desc: 'A massive ancient tree',              terrain: 'forest'   },
  { name: "Neptune's Arch",  type: 'rock_arch',     icon: '⌒', desc: 'A natural stone arch over the waves', terrain: 'coastal'  },
  { name: 'Crystal Spring',  type: 'spring',        icon: '⊙', desc: 'Fresh water bubbling from the rock',  terrain: 'highland' },
];

// Pick a random element from a pool and remove it (prevents duplicates)
function pickRandom(pool) {
  if (!pool || pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const tile = pool[idx];
  pool.splice(idx, 1);
  return tile;
}

// Procedurally place 6 landmarks on the current island (up to 6, terrain permitting)
export function generateLandmarks() {
  state.landmarks = [];

  const pools = {};
  const coastalTiles = [];
  let highestTile = null, maxE = 0;

  for (let tx = 0; tx < GRID; tx++) {
    for (let ty = 0; ty < GRID; ty++) {
      const t = getTerrain(tx, ty);
      const e = getElevation(tx, ty);
      if (t !== 'water') {
        if (!pools[t]) pools[t] = [];
        pools[t].push({ tx, ty });

        if (e > maxE) { maxE = e; highestTile = { tx, ty }; }

        if (t === 'beach') {
          const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
          if (neighbors.some(([dx, dy]) => getElevation(tx + dx, ty + dy) < -0.02)) {
            coastalTiles.push({ tx, ty });
          }
        }
      }
    }
  }

  // Summit Peak — always at the actual highest point
  if (highestTile) {
    state.landmarks.push({ ...LANDMARK_TYPES[0], ...highestTile });
  }

  // Mirror Lake — random lowland
  const lakeTile = pickRandom(pools['lowland']);
  if (lakeTile) state.landmarks.push({ ...LANDMARK_TYPES[1], ...lakeTile });

  // Whispering Cave — random highland
  const caveTile = pickRandom(pools['highland']);
  if (caveTile) state.landmarks.push({ ...LANDMARK_TYPES[2], ...caveTile });

  // The Elder Oak — random forest
  const treeTile = pickRandom(pools['forest']);
  if (treeTile) state.landmarks.push({ ...LANDMARK_TYPES[3], ...treeTile });

  // Neptune's Arch — random coastal beach
  const archTile = pickRandom(coastalTiles);
  if (archTile) state.landmarks.push({ ...LANDMARK_TYPES[4], ...archTile });

  // Crystal Spring — second random highland (after cave was picked)
  const springTile = pickRandom(pools['highland']);
  if (springTile) state.landmarks.push({ ...LANDMARK_TYPES[5], ...springTile });
}

// Generate a landmark-to-landmark measurement quest for the current island.
// Always anchors on Summit Peak (lms[0]) as one endpoint.
export function generateMeasurementQuest() {
  const lms = state.landmarks;
  if (lms.length < 2) { state.measurementQuest = null; return; }

  const lm1 = lms[0]; // Summit Peak — always present, players discover it first
  const lm2 = lms[Math.floor(Math.random() * (lms.length - 1)) + 1];

  const dx = lm2.tx - lm1.tx, dy = lm2.ty - lm1.ty;
  const targetDist = Math.round(Math.sqrt(dx * dx + dy * dy) * MEASURE_METERS_PER_TILE);
  state.measurementQuest = { lm1, lm2, targetDist, completed: false };
}

// Check if any undiscovered landmarks are now in range after a survey.
// Returns array of newly discovered landmark objects.
export function checkLandmarkDiscovery() {
  const ptx = Math.floor(state.player.x);
  const pty = Math.floor(state.player.y);
  const newlyDiscovered = [];

  for (const lm of state.landmarks) {
    if (state.discoveredLandmarks.has(lm.name)) continue;
    const dx = lm.tx - ptx, dy = lm.ty - pty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= LANDMARK_DISCOVERY_RADIUS && state.surveyedTiles.has(`${lm.tx},${lm.ty}`)) {
      state.discoveredLandmarks.add(lm.name);
      newlyDiscovered.push(lm);
    }
  }

  return newlyDiscovered;
}
