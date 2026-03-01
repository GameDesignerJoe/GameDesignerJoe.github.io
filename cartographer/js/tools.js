// ============================================================
// THE CARTOGRAPHER - tools.js
// Tool actions: survey, measure, sextant, collect, selectTool.
// ============================================================

import { TOTAL_DIGITS, MIN_DISTANCE_BASE, DISTANCE_SCALE, SURVEY_RADIUS, ISLAND_R } from './config.js';
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
  // Prevent re-survey while animation is running (natural cooldown gate)
  if (state.activeAnimation?.type === 'survey') return;

  state.moveTarget = null; // cancel any pending click-walk

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
    // Stop — check measurement quest BEFORE clearing trail, then save
    if (state.measureTrail.length >= 2) {
      _checkMeasurementQuest();
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
  state.moveTarget = null; // cancel any pending click-walk

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

  // Scale required distance proportionally to island size (ISLAND_R=14 is the reference size)
  const requiredDistance = (MIN_DISTANCE_BASE + (state.revealedDigitCount * DISTANCE_SCALE)) * (ISLAND_R / 14);

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

// --- MEASUREMENT QUEST CHECK ---

function _checkMeasurementQuest() {
  const q = state.measurementQuest;
  if (!q || q.completed) return;

  const trail = state.measureTrail;
  const start = trail[0], end = trail[trail.length - 1];
  const ENDPOINT_R = 4.0; // tiles — generous radius so player doesn't need pixel precision

  const near = (p, lm) => {
    const dx = p.x - (lm.tx + 0.5), dy = p.y - (lm.ty + 0.5);
    return Math.sqrt(dx * dx + dy * dy) < ENDPOINT_R;
  };

  const validEndpoints =
    (near(start, q.lm1) && near(end, q.lm2)) ||
    (near(start, q.lm2) && near(end, q.lm1));

  if (!validEndpoints) {
    showSextantFeedback('Measure between the two quest landmarks to record distance.', false);
    return;
  }

  // Require at least 50% of the target distance to prevent trivial one-tile measures
  if (state.measureDistance < q.targetDist * 0.5) {
    showSextantFeedback('Trail too short — walk more of the route between landmarks.', false);
    return;
  }

  q.completed = true;
  showSextantFeedback('Distance confirmed! Measurement recorded.', true);
  updateQuestTracker();
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
