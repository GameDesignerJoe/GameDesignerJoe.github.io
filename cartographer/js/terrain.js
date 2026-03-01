// ============================================================
// THE CARTOGRAPHER - terrain.js
// Island generation: elevation noise, biome classification.
// All functions are pure given state.seedOffset.
// ============================================================

import { ISLAND_R } from './config.js';
import { state } from './state.js';

// Deterministic hash-based pseudo-random, seeded by island seedOffset
export function seededRandom(x, y) {
  const n = Math.sin((x + state.seedOffset) * 127.1 + (y + state.seedOffset) * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Smooth (Perlin-like) noise via bilinear interpolation of seeded values
export function smoothNoise(x, y, scale) {
  const sx = x / scale, sy = y / scale;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  const fx = sx - ix, fy = sy - iy;
  const a = seededRandom(ix, iy),     b = seededRandom(ix + 1, iy);
  const c = seededRandom(ix, iy + 1), d = seededRandom(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

// Source of truth for all terrain. Returns elevation float.
export function getElevation(tx, ty) {
  const cx = ISLAND_R, cy = ISLAND_R;
  let dx = tx - cx, dy = ty - cy;

  // Global shape deformation — random stretch/rotation per seed
  const stretchAngle  = seededRandom(state.seedOffset + 700, 701) * Math.PI;
  const stretchAmount = 0.4 + seededRandom(state.seedOffset + 702, 703) * 0.6;
  const cosS = Math.cos(stretchAngle), sinS = Math.sin(stretchAngle);
  const rx = dx * cosS + dy * sinS;
  const ry = (-dx * sinS + dy * cosS) * (1 / stretchAmount);
  const dist = Math.sqrt(rx * rx + ry * ry) / ISLAND_R;

  if (dist > 1.4) return -0.3;

  // Irregular coastline via angle-based warp
  const angle = Math.atan2(dy, dx);

  let coastWarp = 0;
  const lobeCount   = 2 + Math.floor(seededRandom(state.seedOffset + 710, 711) * 3);
  const lobeStrength = 0.3 + seededRandom(state.seedOffset + 712, 713) * 0.4;
  const lobePhase   = seededRandom(state.seedOffset + 714, 715) * Math.PI * 2;
  coastWarp += Math.sin(angle * lobeCount + lobePhase) * lobeStrength;
  coastWarp += smoothNoise(angle * 4  + state.seedOffset * 0.017, state.seedOffset * 0.013, 1.2) * 0.30;
  coastWarp += smoothNoise(angle * 7  + state.seedOffset * 0.023 + 80, state.seedOffset * 0.019 + 80, 1.0) * 0.15;
  coastWarp += smoothNoise(angle * 14 + state.seedOffset * 0.031 + 160, state.seedOffset * 0.029 + 160, 0.8) * 0.08;

  // Deep fjord cut
  const cutAngle = seededRandom(state.seedOffset + 720, 721) * Math.PI * 2;
  const cutWidth = 0.3 + seededRandom(state.seedOffset + 722, 723) * 0.4;
  let angleDiff = Math.abs(angle - cutAngle);
  if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
  if (angleDiff < cutWidth) {
    const cutDepth = 0.2 + seededRandom(state.seedOffset + 724, 725) * 0.35;
    coastWarp -= cutDepth * (1 - angleDiff / cutWidth);
  }

  const effectiveRadius = 0.75 + coastWarp;
  const relDist = dist / Math.max(0.15, effectiveRadius);
  if (relDist > 1.15) return -0.2;

  // Terrain elevation (3 octaves of noise)
  let e = 0;
  e += smoothNoise(tx, ty, 8) * 1.00;
  e += smoothNoise(tx, ty, 4) * 0.50;
  e += smoothNoise(tx, ty, 2) * 0.25;
  e /= 1.75;

  const mask = Math.max(0, 1 - relDist * relDist);
  e = e * mask;

  // Two Gaussian peaks
  const peak1Angle = seededRandom(state.seedOffset + 500, 1) * Math.PI * 2;
  const peak1R = 0.2 + seededRandom(state.seedOffset + 501, 2) * 0.25;
  const peak1X = cx + Math.cos(peak1Angle) * peak1R * ISLAND_R;
  const peak1Y = cy + Math.sin(peak1Angle) * peak1R * ISLAND_R;
  const peak1Dist = Math.sqrt((tx - peak1X) ** 2 + (ty - peak1Y) ** 2) / 6;
  e += Math.max(0, 0.4 - peak1Dist) * 1.2;

  const peak2Angle = peak1Angle + Math.PI * 0.6 + seededRandom(state.seedOffset + 502, 3) * Math.PI * 0.8;
  const peak2R = 0.2 + seededRandom(state.seedOffset + 503, 4) * 0.3;
  const peak2X = cx + Math.cos(peak2Angle) * peak2R * ISLAND_R;
  const peak2Y = cy + Math.sin(peak2Angle) * peak2R * ISLAND_R;
  const peak2Dist = Math.sqrt((tx - peak2X) ** 2 + (ty - peak2Y) ** 2) / 5;
  e += Math.max(0, 0.3 - peak2Dist) * 0.8;

  return e;
}

// Maps elevation to biome string. Source of truth for tile type.
export function getTerrain(tx, ty) {
  const e = getElevation(tx, ty);
  if (e < -0.02) return 'water';
  if (e < 0.08)  return 'beach';
  if (e < 0.25)  return 'lowland';
  if (e < 0.45)  return 'forest';
  if (e < 0.65)  return 'highland';
  return 'peak';
}

export function isLand(tx, ty)     { return getTerrain(tx, ty) !== 'water'; }
export function isWalkable(tx, ty) { return getTerrain(tx, ty) !== 'water'; }
