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

  // Touch tap — detected on touchend so pinch first-finger doesn't fire interaction
  let _tapStart = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    _tapStart = e.touches.length === 1
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
      : null; // multi-touch clears tap intent
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
  canvas.addEventListener('touchend', e => {
    state.lastPinchDist = 0;
    if (_tapStart && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const dx = t.clientX - _tapStart.x;
      const dy = t.clientY - _tapStart.y;
      if (dx * dx + dy * dy < 100 && Date.now() - _tapStart.t < 400) {
        const world = screenToWorld(t.clientX, t.clientY);
        handleInteraction(world.x, world.y);
      }
    }
    _tapStart = null;
  }, { passive: true });

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  // Start / new map buttons
  document.getElementById('startBtn').addEventListener('click', onStartGame);
  document.getElementById('newMapBtn').addEventListener('click', onNewMap);

  // Info panel collapse toggle
  document.getElementById('panelToggle').addEventListener('click', () => {
    document.getElementById('infoPanel').classList.toggle('collapsed');
  });

  // Auto-collapse the info panel on small screens so the map gets priority
  if (window.innerWidth <= 600) {
    document.getElementById('infoPanel').classList.add('collapsed');
  }
}
