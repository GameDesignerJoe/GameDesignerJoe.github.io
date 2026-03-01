// ============================================================
// THE CARTOGRAPHER - draw/tiles.js
// Per-tile drawing: water, fog, revealed, and surveyed states.
// ============================================================

import { ctx, canvas } from '../canvas.js';
import { TILE, COLORS } from '../config.js';
import { state } from '../state.js';
import { getTerrain, isLand, seededRandom } from '../terrain.js';
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
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(sx, sy, TILE, TILE);
    if (!state.debug.hideOcean) {
      drawWater(sx, sy, tx, ty);
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

  // Coast edges and corner smoothing are handled by the bezier overlay pass
  // (drawCoastlineBezier in rendering.js), not per-tile.
}


