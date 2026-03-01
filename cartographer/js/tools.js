// ============================================================
// THE CARTOGRAPHER - tools.js
// Tool actions: survey, measure, sextant, collect, selectTool.
// ============================================================

import { TOTAL_DIGITS, MIN_DISTANCE_BASE, DISTANCE_SCALE, SURVEY_RADIUS } from './config.js';
import { state } from './state.js';
import { surveyAroundPlayer } from './fogOfWar.js';
import { checkLandmarkDiscovery } from './landmarks.js';
import { tryCollectSpecimen } from './specimens.js';
import {
  showSextantFeedback, showLandmarkToast, showToolHint,
  updateQuestTracker, updateCoordDisplay, revealNextTwoDigits,
  showMeasureDisplay, hideMeasureDisplay,
  setToolActive, setMeasuringStyle, markSpecimenCollected,
} from './ui.js';

// --- THEODOLITE (SURVEY) ---

export function doSurvey() {
  state.activeAnimation = {
    type: 'survey',
    maxRadius: 40 * SURVEY_RADIUS, // TILE * SURVEY_RADIUS in pixels
    startTime: Date.now(),
    duration: 1800,
  };

  surveyAroundPlayer();

  const discovered = checkLandmarkDiscovery();
  for (const lm of discovered) {
    showLandmarkToast(lm);
    updateQuestTracker();
  }
}

// --- MEASURE ---

export function toggleMeasure() {
  if (state.measuring) {
    // Stop — save the trail
    if (state.measureTrail.length >= 2) {
      state.completedMeasures.push({ trail: [...state.measureTrail], distance: state.measureDistance });
    }
    state.measuring = false;
    state.measureTrail = [];
    state.measureDistance = 0;
    hideMeasureDisplay();
    setMeasuringStyle(false);
  } else {
    // Start
    state.measuring = true;
    state.measureTrail = [{ x: state.player.x, y: state.player.y }];
    state.measureDistance = 0;
    showMeasureDisplay();
    setMeasuringStyle(true);
    document.getElementById('measureDist').textContent = '0m';
  }
}

// --- SEXTANT ---

export function doSextant() {
  // Play animation regardless of success
  state.activeAnimation = {
    type: 'sextant',
    x: state.player.x,
    y: state.player.y,
    startTime: Date.now(),
    duration: 1500,
  };

  if (state.revealedDigitCount >= TOTAL_DIGITS) {
    showSextantFeedback('Position fully established. Coordinates complete.', false);
    return;
  }

  // Calculate minimum distance from all previous readings
  let minDist = Infinity;
  for (const reading of state.sextantReadings) {
    const dx = state.player.x - reading.x;
    const dy = state.player.y - reading.y;
    minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
  }

  // First reading is always free
  if (state.sextantReadings.length === 0) minDist = Infinity;

  const requiredDistance = MIN_DISTANCE_BASE + (state.revealedDigitCount * DISTANCE_SCALE);

  if (minDist < requiredDistance) {
    const needed = Math.ceil(requiredDistance - minDist);
    if (minDist < 2) {
      showSextantFeedback('Reading too similar to a previous fix. Travel further afield.', false);
    } else {
      showSextantFeedback(`Insufficient distance from nearest fix. Move ~${needed} more paces.`, false);
    }
    return;
  }

  // Success
  state.sextantReadings.push({ x: state.player.x, y: state.player.y, time: Date.now() });
  revealNextTwoDigits();
  updateQuestTracker();

  const remaining = TOTAL_DIGITS - state.revealedDigitCount;
  if (remaining === 0) {
    showSextantFeedback('Position fully triangulated! Coordinates complete.', true);
  } else {
    showSextantFeedback(`New digits revealed! ${remaining} remaining.`, true);
  }
}

// --- NATURALIST (COLLECT) ---

export function doCollect() {
  const idx = tryCollectSpecimen();
  if (idx >= 0) {
    markSpecimenCollected(idx);
    updateQuestTracker();
  }
}

// --- TOOL SELECTION ---

export function selectTool(tool) {
  // Stop measuring if switching away from measure tool
  if (tool !== 'measure' && state.measuring) {
    toggleMeasure();
  }

  state.currentTool = tool;
  setToolActive(tool);
  showToolHint(tool);
}

// --- HANDLE INTERACTION (dispatch click/tap to active tool) ---

export function handleInteraction(worldX, worldY) {
  if (!state.gameStarted) return;

  switch (state.currentTool) {
    case 'walk':       state.moveTarget = { x: worldX, y: worldY }; break;
    case 'theodolite': doSurvey();   break;
    case 'measure':    toggleMeasure(); break;
    case 'sextant':    doSextant();  break;
    case 'naturalist': doCollect();  break;
  }
}
