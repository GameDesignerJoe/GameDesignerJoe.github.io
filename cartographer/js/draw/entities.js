// ============================================================
// THE CARTOGRAPHER - draw/entities.js
// Drawing: player, landmarks, specimens, measure trails,
// sextant fix crosshairs, coordinate grid.
// ============================================================

import { ctx } from '../canvas.js';
import { TILE, COLORS, GRID } from '../config.js';
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { stableLine } from './coastline.js';
import { seededRandom } from '../terrain.js';

// --- PLAYER ---

export function drawPlayer() {
  const scr = worldToScreen(state.player.x, state.player.y);
  const px = scr.x, py = scr.y;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(px, py + 4, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = COLORS.red;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(px, py - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px - 3, py - 4);
  ctx.lineTo(px, py + 2);
  ctx.lineTo(px + 3, py - 4);
  ctx.fill();

  // Tool indicator rings
  if (state.currentTool === 'theodolite') {
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(px, py - 8, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.currentTool === 'naturalist') {
    ctx.strokeStyle = 'rgba(100, 160, 80, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(px, py - 4, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.measuring) {
    const pulse = 0.5 + Math.sin(Date.now() / 300) * 0.3;
    ctx.strokeStyle = `rgba(196, 85, 61, ${pulse})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(px, py - 4, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// --- LANDMARKS ---

export function drawLandmarks() {
  for (const lm of state.landmarks) {
    drawLandmarkOnMap(lm);
  }
}

function drawLandmarkOnMap(lm) {
  const key = `${lm.tx},${lm.ty}`;
  if (!state.revealedTiles.has(key) && !state.surveyedTiles.has(key)) return;

  const scr = worldToScreen(lm.tx + 0.5, lm.ty + 0.5);
  const discovered = state.discoveredLandmarks.has(lm.name);
  const lmSeed  = seededRandom(lm.tx * 31, lm.ty * 37);
  const lmSeed2 = seededRandom(lm.tx * 37, lm.ty * 31);

  if (lm.type === 'mountain') {
    ctx.strokeStyle = discovered ? COLORS.ink : 'rgba(58,47,36,0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(scr.x, scr.y - 12);
    ctx.lineTo(scr.x - 8, scr.y + 4);
    ctx.lineTo(scr.x + 8, scr.y + 4);
    ctx.closePath();
    ctx.stroke();
    if (discovered) { ctx.fillStyle = 'rgba(190, 175, 155, 0.3)'; ctx.fill(); }

  } else if (lm.type === 'lake') {
    ctx.strokeStyle = discovered ? COLORS.waterInk : 'rgba(90,122,138,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const r = 10 + Math.sin(a * 3) * 2;
      const px = scr.x + Math.cos(a) * r, py = scr.y + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (discovered) { ctx.fillStyle = 'rgba(140, 175, 195, 0.2)'; ctx.fill(); }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(scr.x - 5, scr.y);
    ctx.quadraticCurveTo(scr.x - 2, scr.y - 3, scr.x + 1, scr.y);
    ctx.quadraticCurveTo(scr.x + 4, scr.y + 3, scr.x + 7, scr.y);
    ctx.stroke();

  } else if (lm.type === 'cave') {
    ctx.strokeStyle = discovered ? COLORS.ink : 'rgba(58,47,36,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 7, Math.PI, 0);
    ctx.stroke();
    if (discovered) {
      ctx.fillStyle = 'rgba(40, 30, 20, 0.3)';
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, 6, Math.PI, 0);
      ctx.fill();
    }

  } else if (lm.type === 'ancient_tree') {
    const s = 1.8;
    ctx.strokeStyle = discovered ? COLORS.ink : 'rgba(58,47,36,0.3)';
    ctx.lineWidth = 1;
    stableLine(scr.x, scr.y + 4, scr.x, scr.y - 4, lmSeed, 0.5);
    ctx.beginPath();
    ctx.arc(scr.x, scr.y - 9, 7 * s, 0, Math.PI * 2);
    ctx.fillStyle = discovered ? 'rgba(80, 110, 55, 0.2)' : 'rgba(80,110,55,0.08)';
    ctx.fill();
    ctx.stroke();

  } else if (lm.type === 'rock_arch') {
    ctx.strokeStyle = discovered ? COLORS.ink : 'rgba(58,47,36,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y + 2, 9, Math.PI, 0);
    ctx.stroke();
    stableLine(scr.x - 9, scr.y + 2, scr.x - 9, scr.y + 8, lmSeed,  0.5);
    stableLine(scr.x + 9, scr.y + 2, scr.x + 9, scr.y + 8, lmSeed2, 0.5);

  } else if (lm.type === 'spring') {
    ctx.strokeStyle = discovered ? COLORS.waterInk : 'rgba(90,122,138,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    if (discovered) { ctx.fillStyle = 'rgba(140, 175, 195, 0.3)'; ctx.fill(); }
    for (let a = 0; a < 4; a++) {
      const angle = a * Math.PI / 2 + Math.PI / 4;
      stableLine(
        scr.x + Math.cos(angle) * 6, scr.y + Math.sin(angle) * 6,
        scr.x + Math.cos(angle) * 10, scr.y + Math.sin(angle) * 10,
        (lmSeed + a * 0.13) % 1, 0.5,
      );
    }
  }

  // Name label when discovered + surveyed
  if (discovered && state.surveyedTiles.has(key)) {
    ctx.save();
    ctx.font = 'italic 11px "Caveat", cursive';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.fillText(lm.name, scr.x, scr.y + 20);
    ctx.restore();
  }
}

// --- SPECIMENS ---

export function drawSpecimens() {
  for (const spec of state.specimens) {
    if (spec.collected) continue;
    const key = `${spec.tx},${spec.ty}`;
    if (!state.revealedTiles.has(key) && !state.surveyedTiles.has(key)) continue;

    const scr = worldToScreen(spec.tx + 0.5, spec.ty + 0.5);
    const bob = Math.sin(Date.now() / 800 + spec.tx) * 2;

    // Small neutral backing so emoji colors render correctly over parchment
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(scr.x, scr.y + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.emoji, scr.x, scr.y + bob);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Highlight ring when naturalist tool active and in range
    if (state.currentTool === 'naturalist') {
      const pdx = state.player.x - (spec.tx + 0.5);
      const pdy = state.player.y - (spec.ty + 0.5);
      if (Math.sqrt(pdx * pdx + pdy * pdy) < 2) {
        ctx.strokeStyle = 'rgba(100, 160, 80, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

// --- MEASURE TRAILS ---

export function drawMeasureTrails() {
  for (const m of state.completedMeasures) {
    drawMeasurePath(m.trail, m.distance, 0.4);
  }
  if (state.measuring && state.measureTrail.length >= 2) {
    drawMeasurePath(state.measureTrail, state.measureDistance, 0.7);
  }
}

function drawMeasurePath(trail, totalDist, alpha) {
  if (trail.length < 2) return;

  ctx.strokeStyle = `rgba(196, 85, 61, ${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);

  const first = worldToScreen(trail[0].x, trail[0].y);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < trail.length; i++) {
    const p = worldToScreen(trail[i].x, trail[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = `rgba(196, 85, 61, ${alpha})`;
  ctx.beginPath();
  ctx.arc(first.x, first.y, 3, 0, Math.PI * 2);
  ctx.fill();

  const last = worldToScreen(trail[trail.length - 1].x, trail[trail.length - 1].y);
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fill();

  const mid = worldToScreen(trail[Math.floor(trail.length / 2)].x, trail[Math.floor(trail.length / 2)].y);
  ctx.font = 'italic 12px "Caveat", cursive';
  ctx.fillStyle = `rgba(196, 85, 61, ${alpha + 0.1})`;
  ctx.fillText(`${Math.round(totalDist)}m`, mid.x + 6, mid.y - 8);
}

// --- SEXTANT FIXES ---

export function drawCoordinateGrid() {
  if (state.sextantReadings.length === 0) return;
  const alpha = Math.min(0.2, state.sextantReadings.length * 0.04);
  const gridSpacing = 4;

  ctx.strokeStyle = `rgba(74, 122, 154, ${alpha})`;
  ctx.lineWidth = 0.4;
  ctx.setLineDash([8, 8]);

  for (let tx = 0; tx < GRID; tx += gridSpacing) {
    const top = worldToScreen(tx, -1);
    const bot = worldToScreen(tx, GRID + 1);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
  }
  for (let ty = 0; ty < GRID; ty += gridSpacing) {
    const left  = worldToScreen(-1, ty);
    const right = worldToScreen(GRID + 1, ty);
    ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.stroke();
  }
  ctx.setLineDash([]);
}

export function drawSextantFixes() {
  for (const reading of state.sextantReadings) {
    const scr = worldToScreen(reading.x, reading.y);
    const age = (Date.now() - reading.time) / 1000;
    const alpha = Math.min(0.7, age / 0.5);
    const s = 8;

    ctx.strokeStyle = `rgba(74, 122, 154, ${alpha * 0.5})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(scr.x - s, scr.y); ctx.lineTo(scr.x + s, scr.y);
    ctx.moveTo(scr.x, scr.y - s); ctx.lineTo(scr.x, scr.y + s);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.font = '9px "Caveat", cursive';
    ctx.fillStyle = COLORS.coordBlue;
    ctx.fillText('fix', scr.x + 10, scr.y - 2);
    ctx.restore();
  }
}
