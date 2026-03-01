// ============================================================
// THE CARTOGRAPHER - draw/features.js
// Tile feature generation and drawing: trees, rocks, grass,
// contour lines. Also getTileFeatures() for surveyed tiles.
// ============================================================

import { ctx } from '../canvas.js';
import { TILE, COLORS, CONTOUR_LEVELS } from '../config.js';
import { seededRandom, smoothNoise, getTerrain, getElevation } from '../terrain.js';
import { wobblyLine, stableLine } from './coastline.js';

// Returns array of feature descriptors for a surveyed tile (deterministic)
export function getTileFeatures(tx, ty) {
  const terrain = getTerrain(tx, ty);
  const r = seededRandom(tx * 13 + 7, ty * 17 + 3);
  const features = [];

  if (terrain === 'forest') {
    const numTrees = Math.floor(r * 4) + 2;
    for (let i = 0; i < numTrees; i++) {
      features.push({
        type: 'tree',
        ox:   seededRandom(tx + i * 3, ty + i * 7) * 0.8 + 0.1,
        oy:   seededRandom(tx + i * 5, ty + i * 2) * 0.8 + 0.1,
        size: 0.5 + seededRandom(tx + i, ty) * 0.5,
        seed: seededRandom(tx * 11 + i * 7, ty * 13 + i * 5),
      });
    }
  }

  if (terrain === 'highland' || terrain === 'peak') {
    if (r > 0.4) {
      features.push({
        type: 'rock',
        ox: 0.3 + r * 0.4,
        oy: 0.3 + seededRandom(tx, ty + 1) * 0.4,
        size: 0.6 + r * 0.4,
        seed: seededRandom(tx * 17 + 3, ty * 19 + 7),
      });
    }
  }

  if (terrain === 'lowland' && r > 0.5) {
    const numGrass = Math.floor(r * 3) + 1;
    for (let i = 0; i < numGrass; i++) {
      features.push({
        type: 'grass',
        ox: seededRandom(tx + i * 2, ty + i * 5) * 0.8 + 0.1,
        oy: seededRandom(tx + i * 4, ty + i * 3) * 0.8 + 0.1,
      });
    }
  }

  return features;
}

export function drawTree(x, y, size, seed = 0.5) {
  const s = size * 8;
  const jL = (seed - 0.5) * 2;         // left canopy offset  (-1 to +1)
  const jR = ((seed * 7919) % 1 - 0.5) * 2; // right canopy offset (different value from same seed)
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 0.8;
  stableLine(x, y, x, y - s * 0.6, seed, 0.5);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.4);
  ctx.quadraticCurveTo(x - s * 0.5 + jL, y - s * 0.7, x - s * 0.4, y - s * 0.5);
  ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.55, x, y - s * 0.6);
  ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.55, x + s * 0.4, y - s * 0.5);
  ctx.quadraticCurveTo(x + s * 0.5 + jR, y - s * 0.7, x, y - s * 1.4);
  ctx.fillStyle = 'rgba(100, 120, 70, 0.15)';
  ctx.fill();
  ctx.stroke();
}

export function drawRock(x, y, size, seed = 0.5) {
  const s = size * 6;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y);
  ctx.lineTo(x - s * 0.3, y - s * 0.5);
  ctx.lineTo(x + s * 0.1, y - s * 0.7);
  ctx.lineTo(x + s * 0.4, y - s * 0.3);
  ctx.lineTo(x + s * 0.3, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(160, 140, 120, 0.1)';
  ctx.fill();
  ctx.stroke();
  stableLine(x - s * 0.15, y - s * 0.1, x + s * 0.1, y - s * 0.55, seed, 0.5);
}

export function drawGrass(x, y) {
  ctx.strokeStyle = COLORS.inkLight;
  ctx.lineWidth = 0.6;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 2, y);
    ctx.quadraticCurveTo(x + i * 3, y - 5, x + i * 4, y - 8);
    ctx.stroke();
  }
}

export function drawContourForTile(sx, sy, tx, ty) {
  const e = getElevation(tx, ty);
  if (e < 0.1) return;

  for (const level of CONTOUR_LEVELS) {
    if (Math.abs(e - level) < 0.08) {
      ctx.strokeStyle = `rgba(58, 47, 36, ${0.12 + level * 0.15})`;
      ctx.lineWidth = level > 0.5 ? 1.0 : 0.7;

      const samples = 6;
      const points = [];
      for (let side = 0; side < 4; side++) {
        for (let i = 0; i <= samples; i++) {
          const t = i / samples;
          let stx, sty;
          if (side === 0) { stx = tx + t;     sty = ty; }
          if (side === 1) { stx = tx + 1;     sty = ty + t; }
          if (side === 2) { stx = tx + 1 - t; sty = ty + 1; }
          if (side === 3) { stx = tx;          sty = ty + 1 - t; }
          const se = getElevation(Math.floor(stx), Math.floor(sty));
          if (Math.abs(se - level) < 0.05) {
            points.push({ x: sx + (stx - tx) * TILE, y: sy + (sty - ty) * TILE });
          }
        }
      }

      if (points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(
          points[0].x + (seededRandom(tx * 17,     ty * 23    ) - 0.5),
          points[0].y + (seededRandom(tx * 17 + 1,  ty * 23 + 1) - 0.5),
        );
        for (let i = 1; i < Math.min(points.length, 4); i++) {
          ctx.lineTo(
            points[i].x + (seededRandom(tx * 17 + i * 3,     ty * 23 + i * 5    ) - 0.5) * 1.5,
            points[i].y + (seededRandom(tx * 17 + i * 3 + 1,  ty * 23 + i * 5 + 1) - 0.5) * 1.5,
          );
        }
        ctx.stroke();
      }

      // Elevation label on occasional tiles
      if (seededRandom(tx * 41 + level * 100, ty * 43) > 0.92) {
        ctx.save();
        ctx.font = '8px "Caveat", cursive';
        ctx.fillStyle = `rgba(58, 47, 36, ${0.25 + level * 0.2})`;
        ctx.fillText(`${Math.round(level * 340)}`, sx + TILE * 0.3, sy + TILE * 0.5);
        ctx.restore();
      }
    }
  }
}
