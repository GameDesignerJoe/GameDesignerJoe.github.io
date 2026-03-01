// ============================================================
// THE CARTOGRAPHER - fogOfWar.js
// Revealed / surveyed tile tracking and mutation.
// ============================================================

import { REVEAL_RADIUS, SURVEY_RADIUS } from './config.js';
import { state } from './state.js';
import { isLand } from './terrain.js';

// Called every frame during movement — reveals 3×3 area around player
export function revealAroundPlayer() {
  const ptx = Math.floor(state.player.x);
  const pty = Math.floor(state.player.y);
  for (let ddx = -REVEAL_RADIUS; ddx <= REVEAL_RADIUS; ddx++) {
    for (let ddy = -REVEAL_RADIUS; ddy <= REVEAL_RADIUS; ddy++) {
      if (isLand(ptx + ddx, pty + ddy)) {
        state.revealedTiles.add(`${ptx + ddx},${pty + ddy}`);
      }
    }
  }
}

// Called when theodolite is used — surveys circular area around player
export function surveyAroundPlayer() {
  const ptx = Math.floor(state.player.x);
  const pty = Math.floor(state.player.y);
  const r = Math.ceil(SURVEY_RADIUS);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (Math.sqrt(dx * dx + dy * dy) <= SURVEY_RADIUS) {
        const ttx = ptx + dx, tty = pty + dy;
        if (isLand(ttx, tty)) state.surveyedTiles.add(`${ttx},${tty}`);
      }
    }
  }
}

// Reveal a square around a specific tile (used on spawn)
export function revealSquareAround(tx, ty, radius) {
  for (let ddx = -radius; ddx <= radius; ddx++) {
    for (let ddy = -radius; ddy <= radius; ddy++) {
      state.revealedTiles.add(`${tx + ddx},${ty + ddy}`);
    }
  }
}

export function isRevealed(tx, ty) { return state.revealedTiles.has(`${tx},${ty}`); }
export function isSurveyed(tx, ty) { return state.surveyedTiles.has(`${tx},${ty}`); }
