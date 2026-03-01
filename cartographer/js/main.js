// ============================================================
// THE CARTOGRAPHER - main.js
// Entry point. Game loop, startGame(), newMap(), init.
// ============================================================

import { TILE, GRID, START_REVEAL_RADIUS } from './config.js';
import { state } from './state.js';
import { getTerrain } from './terrain.js';
import { updateCamera } from './camera.js';
import { revealSquareAround, revealAroundPlayer } from './fogOfWar.js';
import { processKeyboardMovement, processClickMovement, updateMeasureTrail } from './movement.js';
import { generateLandmarks } from './landmarks.js';
import { generateSpecimens, generateIslandName } from './specimens.js';
import { render } from './rendering.js';
import { setupInputHandlers } from './input.js';
import { selectTool } from './tools.js';
import { initDebugPanel } from './debug.js';
import {
  showGameUI, resetQuestUI, setIslandName,
  rebuildSpecimenSlots, initCoordDisplay,
  updateMapPercent, updateQuestTracker,
  updateMeasureDisplay,
} from './ui.js';

// --- GAME LOOP ---

let lastQuestUpdate = 0;

function update() {
  if (!state.gameStarted) {
    requestAnimationFrame(update);
    return;
  }

  processKeyboardMovement();
  processClickMovement();
  revealAroundPlayer();

  const moved = updateMeasureTrail();
  if (moved && state.measuring) {
    updateMeasureDisplay();
  }

  // Throttle expensive per-frame calculations (~30×/sec)
  const now = Date.now();
  if (now - lastQuestUpdate > 33) {
    lastQuestUpdate = now;
    updateMapPercent();
    updateQuestTracker();
  }

  requestAnimationFrame(update);
}

function renderLoop() {
  updateCamera();
  render();
  requestAnimationFrame(renderLoop);
}

// --- START GAME ---

export function startGame() {
  state.gameStarted = true;

  const islandName = generateIslandName();
  showGameUI(islandName);

  generateLandmarks();
  initCoordDisplay();
  _spawnPlayer();
  generateSpecimens();
  rebuildSpecimenSlots();
  selectTool('walk');
  updateMapPercent();
  updateQuestTracker();
}

// --- NEW MAP ---

export function newMap() {
  // Reset mutable state
  state.zoom = 1.0;
  state.revealedTiles = new Set();
  state.surveyedTiles = new Set();
  state.specimens = [];
  state.collectedSpecimens = [];
  state.mapPercent = 0;
  state.measuring = false;
  state.measureTrail = [];
  state.measureDistance = 0;
  state.completedMeasures = [];
  state.sextantReadings = [];
  state.coordDigitsLat = [];
  state.coordDigitsLng = [];
  state.revealedDigitCount = 0;
  state.landmarks = [];
  state.discoveredLandmarks = new Set();
  state.moveTarget = null;
  state.activeAnimation = null;

  // New island seed
  state.seedOffset = Math.floor(Math.random() * 100000);
  state.placementSeed = Math.floor(Math.random() * 100000);

  resetQuestUI();
  setIslandName(generateIslandName());

  generateLandmarks();
  initCoordDisplay();
  _spawnPlayer();
  generateSpecimens();
  rebuildSpecimenSlots();
  selectTool('walk');
  updateMapPercent();
  updateQuestTracker();
}

// Find a beach tile to spawn on and set initial camera / reveal
function _spawnPlayer() {
  for (let tx = 0; tx < GRID; tx++) {
    for (let ty = 0; ty < GRID; ty++) {
      if (getTerrain(tx, ty) === 'beach') {
        state.player.x = tx + 0.5;
        state.player.y = ty + 0.5;
        state.camera.x = state.player.x * TILE;
        state.camera.y = state.player.y * TILE;
        state.lastPlayerPos = { x: state.player.x, y: state.player.y };
        revealSquareAround(tx, ty, START_REVEAL_RADIUS);
        return;
      }
    }
  }
}

// --- INIT ---

setupInputHandlers(startGame, newMap);
initDebugPanel();
update();
renderLoop();
