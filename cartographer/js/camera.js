// ============================================================
// THE CARTOGRAPHER - camera.js
// Camera follow, zoom, world↔screen coordinate transforms.
// ============================================================

import { TILE, CAMERA_LERP } from './config.js';
import { state } from './state.js';
import { canvas } from './canvas.js';

// Convert world tile coords to canvas screen pixels (within zoom transform)
export function worldToScreen(wx, wy) {
  const W = canvas.width, H = canvas.height;
  return {
    x: wx * TILE - state.camera.x + W / 2,
    y: wy * TILE - state.camera.y + H / 2,
  };
}

// Convert screen pixels (mouse/touch) to world tile coords
export function screenToWorld(sx, sy) {
  const W = canvas.width, H = canvas.height;
  return {
    x: ((sx - W / 2) / state.zoom + state.camera.x) / TILE,
    y: ((sy - H / 2) / state.zoom + state.camera.y) / TILE,
  };
}

// Smoothly move camera toward player (call once per update frame)
export function updateCamera() {
  state.camera.x += (state.player.x * TILE - state.camera.x) * CAMERA_LERP;
  state.camera.y += (state.player.y * TILE - state.camera.y) * CAMERA_LERP;
}
