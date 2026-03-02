// ============================================================
// THE CARTOGRAPHER - arrival.js
// Arrival sequence state machine, ship drawing, and overlay.
// ============================================================

import { TILE, GRID } from './config.js';
import { state } from './state.js';
import { ctx, canvas } from './canvas.js';
import { worldToScreen } from './camera.js';

// ============================================================
// PUBLIC API
// ============================================================

// Begin the arrival sequence. onComplete is called when sequence ends or is skipped.
export function startArrival(islandName, onComplete) {
  if (!state.ship) { onComplete(); return; } // safety: no ship = skip sequence

  // Direction: from island center through beach tile, projected outward into ocean
  const cx = GRID / 2, cy = GRID / 2;
  const bx = state.ship.tx + 0.5, by = state.ship.ty + 0.5;
  const dx = bx - cx, dy = by - cy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const normX = dx / len, normY = dy / len;

  // Ship stops in the water, one tile offshore from the beach
  const shipEndX = bx + normX * 1.0;
  const shipEndY = by + normY * 1.0;

  // Ship always enters from the left — 12 tiles to the left of its destination, same Y
  const shipStartX = shipEndX - 12;
  const shipStartY = shipEndY;

  // Store the ship's permanent water position so drawShip() uses it after arrival
  state.ship.drawX = shipEndX;
  state.ship.drawY = shipEndY;

  state.arrival = {
    phase:      'sailing',   // start sailing immediately — no separate fadein phase
    phaseStart:  Date.now(),
    fadeStart:   Date.now(), // drives black-to-clear overlay independently of phase
    islandName,
    shipStartX,
    shipStartY,
    shipEndX,
    shipEndY,
    shipX:       shipStartX, // current animated ship position (separate from player)
    shipY:       shipStartY,
    normX,
    normY,
    onComplete,
  };

  // Camera anchored at the beach — player stays fixed here while ship slides in from left
  state.player.x = shipEndX;
  state.player.y = shipEndY;
  state.camera.x = state.player.x * TILE;
  state.camera.y = state.player.y * TILE;
}

// Skip to end immediately — any key/tap triggers this.
export function skipSequence() {
  if (!state.arrival) return;
  // Place player on the beach tile (ship is anchored in the water beside it)
  state.player.x = state.ship.tx + 0.5;
  state.player.y = state.ship.ty + 0.5;
  state.camera.x = state.player.x * TILE;
  state.camera.y = state.player.y * TILE;
  _completeArrival();
}

// Returns true while a sequence is running.
export function isSequenceActive() { return !!state.arrival; }

// Returns false during fadein/sailing/anchoring (player hasn't stepped off yet).
export function isPlayerVisible() {
  if (!state.arrival) return true;
  return state.arrival.phase === 'disembark' || state.arrival.phase === 'namecard';
}

// ============================================================
// UPDATE — call first in the update() loop, every frame
// ============================================================

export function updateArrival() {
  if (!state.arrival) return;

  const elapsed = Date.now() - state.arrival.phaseStart;
  const { phase, shipStartX, shipStartY, shipEndX, shipEndY, normX, normY } = state.arrival;

  if (phase === 'sailing') {
    // Ship slides in from the left; camera stays fixed at beach (player not updated here)
    const t    = Math.min(elapsed / 12000, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out
    state.arrival.shipX = shipStartX + (shipEndX - shipStartX) * ease;
    state.arrival.shipY = shipStartY + (shipEndY - shipStartY) * ease;
    if (elapsed > 12000) _nextPhase('anchoring');

  } else if (phase === 'anchoring') {
    // Ship stopped — rocking handled in drawShip; camera still fixed
    state.arrival.shipX = shipEndX;
    state.arrival.shipY = shipEndY;
    if (elapsed > 700) _nextPhase('disembark');

  } else if (phase === 'disembark') {
    // Ship stays anchored; player walks from bow toward island interior
    state.arrival.shipX = shipEndX;
    state.arrival.shipY = shipEndY;
    const t    = Math.min(elapsed / 900, 1);
    const ease = 1 - (1 - t) * (1 - t);
    // Bow is the front of the ship (facing land, -norm direction from center)
    const bowX = shipEndX - normX * 0.4;
    const bowY = shipEndY - normY * 0.4;
    // Player walks onto the beach tile (ship stays in the water)
    const landX = state.ship.tx + 0.5;
    const landY = state.ship.ty + 0.5;
    state.player.x = bowX + (landX - bowX) * ease;
    state.player.y = bowY + (landY - bowY) * ease;
    if (elapsed > 900) {
      state.player.x = landX;
      state.player.y = landY;
      _nextPhase('namecard');
    }

  } else if (phase === 'namecard') {
    if (elapsed > 3200) _completeArrival();
  }
}

// ============================================================
// DRAW: SHIP — call inside zoom transform, after specimens, before player
// ============================================================

export function drawShip() {
  if (!state.ship) return;

  // During sequence the ship uses its own animated position (separate from player during disembark);
  // after the sequence it sits permanently in the water beside the beach.
  const wx = state.arrival ? state.arrival.shipX : (state.ship.drawX ?? state.ship.tx + 0.5);
  const wy = state.arrival ? state.arrival.shipY : (state.ship.drawY ?? state.ship.ty + 0.5);
  const { x: sx, y: sy } = worldToScreen(wx, wy);
  const S = TILE * 0.5; // half-tile as the ship size unit (~correct visual scale)

  ctx.save();
  ctx.translate(sx, sy);

  // Gentle rocking during anchoring phase
  if (state.arrival?.phase === 'anchoring') {
    const t = (Date.now() - state.arrival.phaseStart) / 700;
    ctx.rotate(Math.sin(t * Math.PI * 6) * 0.04);
  }

  // --- Hull ---
  ctx.beginPath();
  ctx.moveTo(-S * 0.7, S * 0.05);
  ctx.bezierCurveTo(-S * 0.9, S * 0.05, -S * 0.85, S * 0.25, -S * 0.4, S * 0.28);
  ctx.lineTo(S * 0.4, S * 0.28);
  ctx.bezierCurveTo(S * 0.85, S * 0.25, S * 0.9, S * 0.05, S * 0.7, S * 0.05);
  ctx.closePath();
  ctx.fillStyle   = 'rgba(210, 185, 145, 0.92)';
  ctx.strokeStyle = 'rgba(58, 47, 36, 0.9)';
  ctx.lineWidth   = 1.0;
  ctx.fill();
  ctx.stroke();

  // --- Mast (straight line — no jitter on structural elements) ---
  ctx.strokeStyle = 'rgba(58, 47, 36, 0.85)';
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, S * 0.05);
  ctx.lineTo(0, -S * 0.7);
  ctx.stroke();

  // --- Sail (only while sailing, anchoring, or fading in) ---
  const showSail = state.arrival &&
    ['sailing', 'anchoring'].includes(state.arrival.phase);

  if (showSail) {
    const billow = state.arrival.phase === 'sailing'
      ? Math.sin((Date.now() - state.arrival.phaseStart) / 600) * S * 0.08
      : 0;
    ctx.beginPath();
    ctx.moveTo(0, -S * 0.65);
    ctx.quadraticCurveTo(S * 0.35 + billow, -S * 0.35, S * 0.05, S * 0.05);
    ctx.lineTo(0, S * 0.05);
    ctx.closePath();
    ctx.fillStyle   = 'rgba(245, 235, 215, 0.88)';
    ctx.strokeStyle = 'rgba(58, 47, 36, 0.7)';
    ctx.lineWidth   = 0.7;
    ctx.fill();
    ctx.stroke();
  }

  // --- Rigging (straight lines — no jitter on structural elements) ---
  ctx.strokeStyle = 'rgba(58, 47, 36, 0.4)';
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -S * 0.65);
  ctx.lineTo(-S * 0.5, S * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -S * 0.65);
  ctx.lineTo(S * 0.3, S * 0.05);
  ctx.stroke();

  ctx.restore();
}

// ============================================================
// DRAW: OVERLAY — call OUTSIDE zoom transform (screen space)
// ============================================================

export function drawArrivalOverlay() {
  if (!state.arrival) return;

  const { phase, phaseStart, fadeStart, islandName } = state.arrival;
  const W = canvas.width, H = canvas.height;
  const elapsed = Date.now() - phaseStart;

  // --- Black fade at sequence start (independent of phase — ship is already moving under it) ---
  const fadeElapsed = Date.now() - fadeStart;
  const fadeAlpha = 1 - Math.min(fadeElapsed / 1200, 1);
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(20, 15, 10, ${fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Island name card during namecard phase (twice as long as before) ---
  if (phase === 'namecard') {
    const tIn  = Math.min(elapsed / 400, 1);
    const tOut = elapsed > 2400 ? (elapsed - 2400) / 400 : 0;
    const alpha = Math.max(0, tIn - tOut);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    const cardW = Math.min(420, W * 0.8), cardH = 90;
    const cxCard = W / 2, cyCard = H * 0.28;

    // Parchment backing
    ctx.fillStyle = 'rgba(245, 235, 215, 0.85)';
    ctx.beginPath();
    ctx.roundRect(cxCard - cardW / 2, cyCard - cardH / 2, cardW, cardH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58, 47, 36, 0.5)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Island name
    ctx.fillStyle    = 'rgba(58, 47, 36, 0.9)';
    ctx.font         = `italic 30px 'Caveat', 'IM Fell DW Pica', serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(islandName, cxCard, cyCard - 10);

    // Subtitle
    ctx.font      = `13px 'IM Fell DW Pica', serif`;
    ctx.fillStyle = 'rgba(100, 80, 60, 0.75)';
    ctx.fillText('UNCHARTED TERRITORY', cxCard, cyCard + 26);

    ctx.restore();
  }
}

// ============================================================
// PRIVATE HELPERS
// ============================================================

function _nextPhase(phase) {
  state.arrival.phase      = phase;
  state.arrival.phaseStart = Date.now();
}

function _completeArrival() {
  const cb = state.arrival.onComplete;
  state.arrival = null;
  cb?.();
}
