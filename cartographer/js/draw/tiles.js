// ============================================================
// THE CARTOGRAPHER - draw/tiles.js
// Per-tile drawing: water, fog, revealed, and surveyed states.
// ============================================================

import { ctx, canvas } from '../canvas.js';
import { TILE, COLORS } from '../config.js';
import { state } from '../state.js';
import { getTerrain, isLand, seededRandom } from '../terrain.js';
import { coastLine } from './coastline.js';
import { getTileFeatures, drawTree, drawRock, drawGrass, drawContourForTile } from './features.js';
import { worldToScreen } from '../camera.js';

const TERRAIN_COLORS = {
  beach:    'rgba(220, 200, 160, 0.3)',
  lowland:  'rgba(180, 190, 140, 0.15)',
  forest:   'rgba(120, 145,  85, 0.2)',
  highland: 'rgba(170, 155, 130, 0.2)',
  peak:     'rgba(190, 175, 155, 0.25)',
};

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function drawWater(screenX, screenY, tx, ty) {
  ctx.strokeStyle = COLORS.waterInk;
  ctx.lineWidth = 0.5;
  const time = Date.now() / 3000;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const yOff = screenY + 8 + i * 12;
    for (let x = 0; x < TILE; x += 4) {
      const px = screenX + x;
      const py = yOff + Math.sin(time + tx * 2 + x * 0.1 + i) * 2;
      if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

export function drawTile(tx, ty) {
  const scr = worldToScreen(tx, ty);
  const sx = scr.x, sy = scr.y;

  // Frustum cull: skip tiles entirely off-screen (with 1 tile margin)
  if (sx + TILE < -TILE || sx > canvas.width + TILE || sy + TILE < -TILE || sy > canvas.height + TILE) return;

  const terrain = getTerrain(tx, ty);
  const key     = `${tx},${ty}`;
  const revealed = state.revealedTiles.has(key);
  const surveyed = state.surveyedTiles.has(key);

  // --- WATER ---
  if (terrain === 'water') {
    ctx.fillStyle = COLORS.parchment;
    ctx.fillRect(sx, sy, TILE, TILE);
    if (!state.debug.hideOcean) {
      drawWater(sx, sy, tx, ty);

      // Coastline from water side: draw edge facing a visible land neighbor
      for (const [ndx, ndy] of NEIGHBORS) {
        const ntx = tx + ndx, nty = ty + ndy;
        const nKey = `${ntx},${nty}`;
        if (isLand(ntx, nty) && (state.revealedTiles.has(nKey) || state.surveyedTiles.has(nKey))) {
          const strong = state.surveyedTiles.has(nKey);
          ctx.strokeStyle = strong ? COLORS.ink : 'rgba(58, 47, 36, 0.4)';
          ctx.lineWidth   = strong ? 1.5 : 1.0;
          _drawEdge(sx, sy, ndx, ndy, tx, ty);
        }
      }
    }
    return;
  }

  // --- FOG (unrevealed land) ---
  if (!revealed && !surveyed) {
    ctx.fillStyle = COLORS.fog;
    ctx.fillRect(sx, sy, TILE, TILE);
    if (seededRandom(tx * 3, ty * 7) > 0.7) {
      ctx.fillStyle = 'rgba(195, 185, 170, 0.5)';
      ctx.fillRect(
        sx + seededRandom(tx * 7 + 1, ty * 11 + 1) * TILE,
        sy + seededRandom(tx * 7 + 2, ty * 11 + 2) * TILE,
        2, 2,
      );
    }

    // Still draw coastline if adjacent to a visible tile (prevents disconnected coastline)
    if (isLand(tx, ty)) {
      let hasVisibleNeighbor = false;
      for (const [ndx, ndy] of NEIGHBORS) {
        const nKey = `${tx + ndx},${ty + ndy}`;
        if (state.revealedTiles.has(nKey) || state.surveyedTiles.has(nKey)) {
          hasVisibleNeighbor = true;
          break;
        }
      }
      if (hasVisibleNeighbor) {
        ctx.strokeStyle = 'rgba(58, 47, 36, 0.3)';
        ctx.lineWidth = 0.8;
        for (const [ndx, ndy] of NEIGHBORS) {
          if (!isLand(tx + ndx, ty + ndy)) _drawEdge(sx, sy, ndx, ndy, tx, ty);
        }
      }
    }
    return;
  }

  // --- REVEALED OR SURVEYED ---
  ctx.fillStyle = COLORS.parchment;
  ctx.fillRect(sx, sy, TILE, TILE);
  ctx.fillStyle = TERRAIN_COLORS[terrain] || COLORS.parchment;
  ctx.fillRect(sx, sy, TILE, TILE);

  if (surveyed) {
    const features = getTileFeatures(tx, ty);
    for (const f of features) {
      const fx = sx + f.ox * TILE, fy = sy + f.oy * TILE;
      if (f.type === 'tree')  drawTree(fx, fy, f.size, f.seed);
      if (f.type === 'rock')  drawRock(fx, fy, f.size, f.seed);
      if (f.type === 'grass') drawGrass(fx, fy);
    }
    drawContourForTile(sx, sy, tx, ty);
  }

  // Coastline on any visible tile bordering water
  if (isLand(tx, ty)) {
    for (const [ndx, ndy] of NEIGHBORS) {
      if (!isLand(tx + ndx, ty + ndy)) {
        const strong = surveyed || state.surveyedTiles.has(`${tx + ndx},${ty + ndy}`);
        ctx.strokeStyle = strong ? COLORS.ink : 'rgba(58, 47, 36, 0.4)';
        ctx.lineWidth   = strong ? 1.5 : 1.0;
        _drawEdge(sx, sy, ndx, ndy, tx, ty);
      }
    }
  }
}

// Helper: draw the correct tile edge given a neighbor direction.
// tx, ty: world tile coords of the tile being drawn (used for stable seeding).
// The canonical seed uses the lower-index tile so both sides of the same
// coastline edge always produce identical, camera-independent wobble.
function _drawEdge(sx, sy, ndx, ndy, tx, ty) {
  const canonTX = tx + Math.min(0, ndx);
  const canonTY = ty + Math.min(0, ndy);
  const edgeDir = ndx !== 0 ? 0 : 1;
  const seed = seededRandom(canonTX * 7 + edgeDir * 1000, canonTY * 11);
  if (ndx === -1) coastLine(sx,        sy,        sx,        sy + TILE, 1.5, seed);
  if (ndx ===  1) coastLine(sx + TILE, sy,        sx + TILE, sy + TILE, 1.5, seed);
  if (ndy === -1) coastLine(sx,        sy,        sx + TILE, sy,        1.5, seed);
  if (ndy ===  1) coastLine(sx,        sy + TILE, sx + TILE, sy + TILE, 1.5, seed);
}

