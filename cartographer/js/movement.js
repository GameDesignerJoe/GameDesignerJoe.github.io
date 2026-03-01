// ============================================================
// THE CARTOGRAPHER - movement.js
// Player movement and collision detection.
// ============================================================

import { PLAYER_SPEED, MEASURE_STEP_THRESHOLD, MEASURE_METERS_PER_TILE } from './config.js';
import { state } from './state.js';
import { isWalkable } from './terrain.js';
import { revealAroundPlayer } from './fogOfWar.js';

// Attempt to move player by (dx, dy) tiles.
// Checks all 4 corners of a 0.3-tile bounding box (AABB collision).
export function tryMove(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  const r = 0.3;
  const walkable =
    isWalkable(Math.floor(nx - r), Math.floor(ny - r)) &&
    isWalkable(Math.floor(nx + r), Math.floor(ny - r)) &&
    isWalkable(Math.floor(nx - r), Math.floor(ny + r)) &&
    isWalkable(Math.floor(nx + r), Math.floor(ny + r));
  if (walkable) {
    state.player.x = nx;
    state.player.y = ny;
  }
}

// Process WASD / arrow key movement. Called each update frame.
export function processKeyboardMovement() {
  let dx = 0, dy = 0;
  if (state.keys['w'] || state.keys['arrowup'])    dy -= 1;
  if (state.keys['s'] || state.keys['arrowdown'])  dy += 1;
  if (state.keys['a'] || state.keys['arrowleft'])  dx -= 1;
  if (state.keys['d'] || state.keys['arrowright']) dx += 1;

  if (dx !== 0 || dy !== 0) {
    state.moveTarget = null;
    const len = Math.sqrt(dx * dx + dy * dy);
    tryMove((dx / len) * PLAYER_SPEED, (dy / len) * PLAYER_SPEED);
  }
}

// Walk player toward click-to-move target. Called each update frame.
export function processClickMovement() {
  if (!state.moveTarget) return;
  const mdx = state.moveTarget.x - state.player.x;
  const mdy = state.moveTarget.y - state.player.y;
  const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
  if (mdist > 0.1) {
    tryMove((mdx / mdist) * PLAYER_SPEED, (mdy / mdist) * PLAYER_SPEED);
  } else {
    state.moveTarget = null;
  }
}

// Update measurement trail while measuring. Call after player position changes.
// Returns distance moved this frame (for UI updates).
export function updateMeasureTrail() {
  if (!state.measuring) {
    state.lastPlayerPos.x = state.player.x;
    state.lastPlayerPos.y = state.player.y;
    return 0;
  }

  const moveDx = state.player.x - state.lastPlayerPos.x;
  const moveDy = state.player.y - state.lastPlayerPos.y;
  const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);

  if (moveDist > MEASURE_STEP_THRESHOLD) {
    state.measureTrail.push({ x: state.player.x, y: state.player.y });
    state.measureDistance += moveDist * MEASURE_METERS_PER_TILE;
    state.lastPlayerPos.x = state.player.x;
    state.lastPlayerPos.y = state.player.y;
    return moveDist;
  }
  return 0;
}
