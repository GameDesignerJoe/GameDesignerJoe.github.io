// ============================================================
// THE CARTOGRAPHER - input.js
// Keyboard, mouse, and touch event handlers.
// ============================================================

import { ZOOM_MIN, ZOOM_MAX, ZOOM_SPEED } from './config.js';
import { state } from './state.js';
import { canvas } from './canvas.js';
import { screenToWorld } from './camera.js';
import { handleInteraction, selectTool } from './tools.js';

export function setupInputHandlers(onStartGame, onNewMap) {
  // Keyboard
  document.addEventListener('keydown', e => {
    state.keys[e.key.toLowerCase()] = true;
    if (e.key >= '1' && e.key <= '5') {
      const tools = ['walk', 'theodolite', 'measure', 'sextant', 'naturalist'];
      selectTool(tools[parseInt(e.key) - 1]);
    }
  });
  document.addEventListener('keyup', e => {
    state.keys[e.key.toLowerCase()] = false;
  });

  // Canvas click
  canvas.addEventListener('click', e => {
    const world = screenToWorld(e.clientX, e.clientY);
    handleInteraction(world.x, world.y);
  });

  // Touch tap
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const world = screenToWorld(touch.clientX, touch.clientY);
      handleInteraction(world.x, world.y);
    }
  }, { passive: false });

  // Mouse wheel zoom
  canvas.addEventListener('wheel', e => {
    if (!state.gameStarted) return;
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * ZOOM_SPEED;
    state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom + delta));
  }, { passive: false });

  // Pinch-to-zoom
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (state.lastPinchDist > 0) {
        const pinchDelta = (dist - state.lastPinchDist) * 0.005;
        state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom + pinchDelta));
      }
      state.lastPinchDist = dist;
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { state.lastPinchDist = 0; });

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  // Start / new map buttons
  document.getElementById('startBtn').addEventListener('click', onStartGame);
  document.getElementById('newMapBtn').addEventListener('click', onNewMap);
}
