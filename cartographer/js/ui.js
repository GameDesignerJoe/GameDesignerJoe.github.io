// ============================================================
// THE CARTOGRAPHER - ui.js
// All DOM reads/writes: quest panel, map %, coord display,
// specimen slots, toasts, tool hints.
// ============================================================

import { TOTAL_DIGITS, GRID } from './config.js';
import { state } from './state.js';
import { isLand, seededRandom } from './terrain.js';

// --- MAP PROGRESS ---

export function updateMapPercent() {
  let landTiles = 0, progress = 0;
  for (let tx = 0; tx < GRID; tx++) {
    for (let ty = 0; ty < GRID; ty++) {
      if (isLand(tx, ty)) {
        landTiles++;
        const key = `${tx},${ty}`;
        if (state.surveyedTiles.has(key))      progress += 1;
        else if (state.revealedTiles.has(key)) progress += 0.3;
      }
    }
  }
  state.mapPercent = landTiles > 0 ? Math.round((progress / landTiles) * 100) : 0;
  document.getElementById('mapProgress').textContent = `Map: ${state.mapPercent}% charted`;
}

// --- QUEST TRACKER ---

export function updateQuestTracker() {
  const collectedCount  = state.specimens.filter(s => s.collected).length;
  const totalSpec       = state.specimens.length;
  const discoveredCount = state.discoveredLandmarks.size;
  const totalLm         = state.landmarks.length;

  const posEl     = document.getElementById('questPosition');
  const posDetail = document.getElementById('questPositionDetail');
  posDetail.textContent = `${state.revealedDigitCount}/${TOTAL_DIGITS}`;
  posEl.classList.toggle('complete', state.revealedDigitCount >= TOTAL_DIGITS);

  const specEl     = document.getElementById('questSpecimens');
  const specDetail = document.getElementById('questSpecimensDetail');
  specDetail.textContent = `${collectedCount}/${totalSpec}`;
  specEl.classList.toggle('complete', totalSpec > 0 && collectedCount >= totalSpec);

  const lmEl     = document.getElementById('questLandmarks');
  const lmDetail = document.getElementById('questLandmarksDetail');
  lmDetail.textContent = `${discoveredCount}/${totalLm}`;
  lmEl.classList.toggle('complete', totalLm > 0 && discoveredCount >= totalLm);

  const mapDone  = state.mapPercent >= 100;
  const posDone  = state.revealedDigitCount >= TOTAL_DIGITS;
  const specDone = totalSpec > 0 && collectedCount >= totalSpec;
  const lmDone   = totalLm  > 0 && discoveredCount >= totalLm;
  document.getElementById('newMapBtn').style.display =
    (mapDone && posDone && specDone && lmDone) ? 'block' : 'none';
}

// --- SPECIMEN SLOTS ---

export function rebuildSpecimenSlots() {
  const panel = document.getElementById('specimenPanel');
  panel.innerHTML = '';
  state.specimens.forEach((s, i) => {
    const slot = document.createElement('div');
    slot.className = 'specimen-slot';
    slot.id = `spec-${i}`;
    slot.textContent = s.emoji;
    slot.title = s.name;
    panel.appendChild(slot);
  });
}

export function markSpecimenCollected(index) {
  document.getElementById(`spec-${index}`)?.classList.add('collected');
}

// --- SEXTANT / COORDINATE DISPLAY ---

export function initCoordDisplay() {
  const latDec = '' +
    Math.floor(seededRandom(42, 99) * 9 + 1) +
    Math.floor(seededRandom(43, 98) * 10) +
    Math.floor(seededRandom(44, 97) * 10);
  const lngDec = '' +
    Math.floor(seededRandom(45, 96) * 9 + 1) +
    Math.floor(seededRandom(46, 95) * 10) +
    Math.floor(seededRandom(47, 94) * 10);

  state.coordDigitsLat = [
    { char: '2', revealed: false },
    { char: '4', revealed: false },
    { char: latDec[0], revealed: false },
    { char: latDec[1], revealed: false },
    { char: latDec[2], revealed: false },
  ];
  state.coordDigitsLng = [
    { char: '5', revealed: false },
    { char: '1', revealed: false },
    { char: lngDec[0], revealed: false },
    { char: lngDec[1], revealed: false },
    { char: lngDec[2], revealed: false },
  ];

  updateCoordDisplay();
}

export function revealNextTwoDigits() {
  const digitsToReveal = Math.min(2, TOTAL_DIGITS - state.revealedDigitCount);
  for (let i = 0; i < digitsToReveal; i++) {
    _revealDigit(state.revealedDigitCount);
    state.revealedDigitCount++;
  }
  updateCoordDisplay();
}

function _revealDigit(index) {
  if (index % 2 === 0) {
    const latIdx = Math.floor(index / 2);
    if (latIdx < state.coordDigitsLat.length) {
      state.coordDigitsLat[latIdx].revealed = true;
      state.coordDigitsLat[latIdx].fresh = true;
      setTimeout(() => { state.coordDigitsLat[latIdx].fresh = false; updateCoordDisplay(); }, 1500);
    }
  } else {
    const lngIdx = Math.floor(index / 2);
    if (lngIdx < state.coordDigitsLng.length) {
      state.coordDigitsLng[lngIdx].revealed = true;
      state.coordDigitsLng[lngIdx].fresh = true;
      setTimeout(() => { state.coordDigitsLng[lngIdx].fresh = false; updateCoordDisplay(); }, 1500);
    }
  }
}

export function updateCoordDisplay() {
  function buildSpan(d) {
    const cls = d.revealed ? (d.fresh ? 'digit fresh' : 'digit revealed') : 'digit hidden';
    return `<span class="${cls}">${d.revealed ? d.char : '?'}</span>`;
  }

  const latSpans = state.coordDigitsLat.map(buildSpan);
  const latHTML = `<span class="digit revealed">2</span><span class="digit revealed">8</span>°` +
    latSpans[0] + latSpans[1] +
    `<span class="digit revealed">.</span>` +
    latSpans[2] + latSpans[3] + latSpans[4] +
    `<span class="digit revealed">'N</span>`;

  const lngSpans = state.coordDigitsLng.map(buildSpan);
  const lngHTML = `<span class="digit revealed">1</span><span class="digit revealed">7</span>°` +
    lngSpans[0] + lngSpans[1] +
    `<span class="digit revealed">.</span>` +
    lngSpans[2] + lngSpans[3] + lngSpans[4] +
    `<span class="digit revealed">'W</span>`;

  document.getElementById('coordLat').innerHTML = latHTML;
  document.getElementById('coordLng').innerHTML = lngHTML;

  const pct = Math.round((state.revealedDigitCount / TOTAL_DIGITS) * 100);
  document.getElementById('coordFill').style.width = pct + '%';

  let statusText;
  if (state.revealedDigitCount === 0)                statusText = 'No readings taken';
  else if (state.revealedDigitCount >= TOTAL_DIGITS) statusText = 'Position established ✓';
  else                                               statusText = `${state.revealedDigitCount}/${TOTAL_DIGITS} digits fixed`;
  document.getElementById('coordStatus').textContent = statusText;
}

// --- TOASTS ---

export function showSextantFeedback(msg, success) {
  const el = document.getElementById('sextantFeedback');
  el.textContent = msg;
  el.className = success ? 'visible success' : 'visible';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.className = ''; }, 3000);
}

export function showLandmarkToast(lm) {
  document.getElementById('toastName').textContent = lm.name;
  document.getElementById('toastSub').textContent = lm.desc;
  const toast = document.getElementById('landmarkToast');
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

export function showToolHint(tool) {
  const hints = {
    walk:       'Click to move · WASD or Arrow keys',
    theodolite: 'Click to survey — reveals terrain, contours & landmarks',
    measure:    'Click to start/stop measuring — walk to trace distances',
    sextant:    'Click to take a reading — travel far between fixes for new digits',
    naturalist: 'Walk near specimens and click to collect',
  };
  const hint = document.getElementById('toolHint');
  hint.textContent = hints[tool] || '';
  hint.classList.add('visible');
  clearTimeout(hint._timeout);
  hint._timeout = setTimeout(() => hint.classList.remove('visible'), 3000);
}

// --- MEASURE DISPLAY ---

export function updateMeasureDisplay() {
  document.getElementById('measureDist').textContent = `${Math.round(state.measureDistance)}m`;
}

export function showMeasureDisplay() { document.getElementById('measureDisplay').classList.add('visible'); }
export function hideMeasureDisplay() { document.getElementById('measureDisplay').classList.remove('visible'); }

// --- TOOL BUTTON STATES ---

export function setToolActive(tool) {
  document.querySelectorAll('.tool-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === tool)
  );
}

export function setMeasuringStyle(active) {
  document.querySelector('[data-tool="measure"]')?.classList.toggle('measuring', active);
}

// --- GAME START / RESET ---

export function showGameUI(islandName) {
  document.getElementById('titleCard').style.display = 'none';
  document.getElementById('toolbar').style.display = 'flex';
  document.getElementById('infoPanel').classList.add('visible');
  document.getElementById('compass').classList.add('visible');
  document.getElementById('specimenPanel').classList.add('visible');
  document.getElementById('coordPanel').classList.add('visible');
  document.getElementById('islandName').textContent = islandName;
}

export function resetQuestUI() {
  document.getElementById('newMapBtn').style.display = 'none';
  document.getElementById('measureDisplay').classList.remove('visible');
  document.querySelector('[data-tool="measure"]')?.classList.remove('measuring');
  document.querySelectorAll('.quest-item').forEach(el => el.classList.remove('complete'));
}

export function setIslandName(name) {
  document.getElementById('islandName').textContent = name;
}
