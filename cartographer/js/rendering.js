// ============================================================
// THE CARTOGRAPHER - rendering.js
// Main render function. Orchestrates all draw calls each frame.
// ============================================================

import { ctx, canvas } from './canvas.js';
import { TILE, COLORS, GRID } from './config.js';
import { state } from './state.js';
import { worldToScreen } from './camera.js';
import { drawTile } from './draw/tiles.js';
import { isLand } from './terrain.js';
import { drawCoastlineBezier } from './draw/coastline-bezier.js';
import { drawLandmarks, drawSpecimens, drawPlayer,
         drawMeasureTrails, drawSextantFixes, drawCoordinateGrid } from './draw/entities.js';
import { drawAnimations } from './draw/animations.js';


export function render() {
  const W = canvas.width, H = canvas.height;

  // Parchment background
  ctx.fillStyle = COLORS.parchment;
  ctx.fillRect(0, 0, W, H);

  // Subtle paper texture (drifting dots)
  ctx.fillStyle = 'rgba(200, 185, 165, 0.08)';
  for (let i = 0; i < 300; i++) {
    ctx.fillRect((i * 137.5 + Date.now() * 0.001) % W, (i * 97.3) % H, 1, 1);
  }

  // Title screen: animated wave lines, then return early
  if (!state.gameStarted) {
    ctx.strokeStyle = 'rgba(90, 122, 138, 0.12)';
    ctx.lineWidth = 0.6;
    const time = Date.now() / 4000;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      for (let x = 0; x < W; x += 8) {
        const y = H / 2 + 100 + i * 25 + Math.sin(time + x * 0.005 + i * 0.5) * 8;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return;
  }

  // Apply zoom transform — everything after this is in zoomed world space
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(state.zoom, state.zoom);
  ctx.translate(-W / 2, -H / 2);

  // Compute visible tile range (frustum cull)
  const viewW = W / state.zoom;
  const viewH = H / state.zoom;
  const startTX = Math.floor((state.camera.x - viewW / 2) / TILE) - 1;
  const endTX   = Math.ceil( (state.camera.x + viewW / 2) / TILE) + 1;
  const startTY = Math.floor((state.camera.y - viewH / 2) / TILE) - 1;
  const endTY   = Math.ceil( (state.camera.y + viewH / 2) / TILE) + 1;

  // Coordinate grid (behind everything, sextant-driven)
  drawCoordinateGrid();

  // Tiles
  for (let ty = startTY; ty <= endTY; ty++) {
    for (let tx = startTX; tx <= endTX; tx++) {
      if (tx < 0 || tx >= GRID || ty < 0 || ty >= GRID) {
        // Out-of-bounds: draw open ocean
        const scr = worldToScreen(tx, ty);
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(scr.x, scr.y, TILE, TILE);
        if (!state.debug.hideOcean) {
          _drawOcean(scr.x, scr.y, tx, ty);
        }
      } else {
        drawTile(tx, ty);
      }
    }
  }

  // Bezier flood-fill: paints water area with COLORS.water, trimming tile corners.
  // This overwrites the wave lines drawn during the tile pass, so we redraw them.
  drawCoastlineBezier();

  // Wave redraw pass — restores wave lines erased by the flood fill
  if (!state.debug.hideOcean) {
    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const outOfBounds = tx < 0 || tx >= GRID || ty < 0 || ty >= GRID;
        if (outOfBounds || !isLand(tx, ty)) {
          const scr = worldToScreen(tx, ty);
          _drawOcean(scr.x, scr.y, tx, ty);
        }
      }
    }
  }

  // World objects (drawn above tiles)
  drawLandmarks();
  drawMeasureTrails();
  drawSextantFixes();
  drawSpecimens();
  drawPlayer();
  drawAnimations();

  // End zoom transform
  ctx.restore();
}

// Ocean waves for tiles outside the island grid
function _drawOcean(sx, sy, tx, ty) {
  ctx.strokeStyle = COLORS.waterInk;
  ctx.lineWidth = 0.5;
  const time = Date.now() / 3000;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const yOff = sy + 8 + i * 12;
    for (let x = 0; x < TILE; x += 4) {
      const px = sx + x;
      const py = yOff + Math.sin(time + tx * 2 + x * 0.1 + i) * 2;
      if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}
