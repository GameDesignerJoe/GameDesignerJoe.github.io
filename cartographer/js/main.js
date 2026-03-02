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
import { generateLandmarks, generateMeasurementQuest } from './landmarks.js';
import { generateSpecimens, generateIslandName } from './specimens.js';
import { render } from './rendering.js';
import { setupInputHandlers } from './input.js';
import { selectTool } from './tools.js';
import { initDebugPanel } from './debug.js';
import { startArrival, updateArrival, isSequenceActive } from './arrival.js';
import {
  showGameUI, resetQuestUI,
  rebuildSpecimenSlots, initCoordDisplay,
  updateMapPercent, updateQuestTracker,
  updateMeasureDisplay, updateZoomIndicator,
} from './ui.js';
import {
  initAudio, playMusic, playLoop, stopLoop,
  updateAmbience, onPlayerMoved, playSFX, fadeOutAmbience, resetAudio,
} from './audio.js';

// --- GAME LOOP ---

let lastQuestUpdate = 0;
let _prevFootX = 0, _prevFootY = 0; // independent footstep tracking

function update() {
  updateArrival(); // always first — advances sequence phases each frame

  if (!state.gameStarted) {
    requestAnimationFrame(update);
    return;
  }

  if (isSequenceActive()) {
    // Block normal gameplay input during arrival sequence
    requestAnimationFrame(update);
    return;
  }

  processKeyboardMovement();
  processClickMovement();
  revealAroundPlayer();

  // Footsteps: detect movement each frame; audio handles start/stop/terrain swap
  const fdx      = state.player.x - _prevFootX;
  const fdy      = state.player.y - _prevFootY;
  const isMoving = fdx * fdx + fdy * fdy > 0.000001;
  const ftx      = Math.floor(state.player.x);
  const fty      = Math.floor(state.player.y);
  onPlayerMoved(isMoving, getTerrain(ftx, fty));
  _prevFootX = state.player.x;
  _prevFootY = state.player.y;

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
    updateZoomIndicator();
    // Update terrain ambience (crossfades automatically when terrain changes)
    const tx = Math.floor(state.player.x), ty = Math.floor(state.player.y);
    updateAmbience(getTerrain(tx, ty));
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
  state.zoom = 3.0;

  const islandName = generateIslandName();
  // Hide the title card immediately; the rest of the game UI is deferred until arrival completes
  document.getElementById('titleCard').style.display = 'none';

  initAudio(); // unlock AudioContext — startBtn click is the required user gesture

  generateLandmarks();
  generateMeasurementQuest();
  state.startTime = Date.now();
  initCoordDisplay();
  _spawnPlayer();
  _prevFootX = state.player.x; _prevFootY = state.player.y;
  generateSpecimens();
  rebuildSpecimenSlots();
  selectTool('walk');

  // Cinematic audio: ocean ambience + sailboat SFX loop during arrival
  updateAmbience('beach');
  playLoop('snd_sailboat');

  startArrival(islandName, () => {
    stopLoop('snd_sailboat');
    showGameUI(islandName);
    playMusic('bgm_empty_island');
    playSFX('snd_start_play_01');
    fadeOutAmbience(10000);
    updateMapPercent();
    updateQuestTracker();
  });
}

// --- NEW MAP ---

export function newMap() {
  // Reset mutable state
  resetAudio();
  state.zoom = 3.0;
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
  state.measurementQuest = null;
  state.completionShown = false;
  state.startTime = 0;
  state.ship    = null;
  state.arrival = null;

  // New island seed
  state.seedOffset = Math.floor(Math.random() * 100000);
  state.placementSeed = Math.floor(Math.random() * 100000);

  resetQuestUI();

  const islandName = generateIslandName();

  generateLandmarks();
  generateMeasurementQuest();
  state.startTime = Date.now();
  initCoordDisplay();
  _spawnPlayer();
  _prevFootX = state.player.x; _prevFootY = state.player.y;
  generateSpecimens();
  rebuildSpecimenSlots();
  selectTool('walk');

  // Cinematic audio: ocean ambience + sailboat SFX loop during arrival
  updateAmbience('beach');
  playLoop('snd_sailboat');

  startArrival(islandName, () => {
    stopLoop('snd_sailboat');
    showGameUI(islandName);
    playMusic('bgm_empty_island');
    playSFX('snd_start_play_01');
    fadeOutAmbience(10000);
    updateMapPercent();
    updateQuestTracker();
  });
}

// Find a beach tile to spawn on, anchor the ship there, set initial camera / reveal
function _spawnPlayer() {
  for (let tx = 0; tx < GRID; tx++) {
    for (let ty = 0; ty < GRID; ty++) {
      if (getTerrain(tx, ty) === 'beach') {
        state.ship = { tx, ty };  // ship anchors at this beach tile
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
