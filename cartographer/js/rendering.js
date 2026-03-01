// ============================================================
// THE CARTOGRAPHER - rendering.js
// Main render function. Orchestrates all draw calls each frame.
// ============================================================

import { ctx, canvas } from './canvas.js';
import { TILE, COLORS, GRID } from './config.js';
import { state } from './state.js';
import { worldToScreen } from './camera.js';
import { drawTile } from './draw/tiles.js';
import { isLand, seededRandom } from './terrain.js';
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

  // Title screen: full-screen fog tile grid (slowly drifting)
  if (!state.gameStarted) {
    const drift = (Date.now() * 0.004) % TILE;
    const ox = drift, oy = drift * 0.65;
    const cols = Math.ceil(W / TILE) + 2;
    const rows = Math.ceil(H / TILE) + 2;
    const swirlPos = [[0.5, 0.3], [0.28, 0.68], [0.72, 0.68]];

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const sx = col * TILE - ox, sy = row * TILE - oy;
        ctx.fillStyle = COLORS.fog;
        ctx.fillRect(sx, sy, TILE, TILE);

        ctx.save();
        ctx.strokeStyle = 'rgba(155, 143, 127, 0.5)';
        ctx.lineWidth = 0.7;
        ctx.lineCap = 'round';
        for (let s = 0; s < 3; s++) {
          const cx = sx + swirlPos[s][0] * TILE;
          const cy = sy + swirlPos[s][1] * TILE;
          const start = seededRandom(col * 7 + s * 17, row * 13 + s * 19) * Math.PI * 2;
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const t = i / 24;
            const angle = start + t * 2.5 * Math.PI * 2;
            const r = t * 6;
            const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
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
