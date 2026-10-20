// Keyboard (WASD / arrows) and pointer (hold anywhere to walk toward it) input.
// Writes state.input = { x, y, active } as a direction with magnitude 0..1.
import { state } from './state.js';
import { screenToWorld, nudgeZoom } from './camera.js';

const keys = new Set();
let pointerId = null;
const touches = new Map(); // pointerId -> {x, y}, for pinch zoom
let pinchDist = 0;

export function initInput(canvas) {
  addEventListener('keydown', e => { keys.add(e.code); });
  addEventListener('keyup', e => { keys.delete(e.code); });
  addEventListener('blur', () => keys.clear());

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    nudgeZoom(Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointers */ }
    if (touches.size === 2) {
      // Second finger: switch from walking to pinching.
      pointerId = null;
      state.input.pointer = null;
      pinchDist = pinchSpan();
      return;
    }
    if (touches.size > 2) return;
    pointerId = e.pointerId;
    state.input.pointer = { sx: e.clientX, sy: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      const d = pinchSpan();
      if (pinchDist > 0 && d > 0) nudgeZoom(d / pinchDist);
      pinchDist = d;
      return;
    }
    if (e.pointerId === pointerId) state.input.pointer = { sx: e.clientX, sy: e.clientY };
  });
  const end = e => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchDist = 0;
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    state.input.pointer = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function pinchSpan() {
  const [a, b] = [...touches.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

export function updateInput() {
  const inp = state.input;
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;

  if (inp.pointer) {
    const p = state.player;
    const w = screenToWorld(inp.pointer.sx, inp.pointer.sy);
    const dx = w.x - p.x, dy = w.y - p.y;
    const d = Math.hypot(dx, dy);
    // Ease off as the finger nears the explorer so they don't jitter on the spot.
    const mag = Math.min(1, Math.max(0, (d - 4) / 30));
    if (d > 0.001) { x = (dx / d) * mag; y = (dy / d) * mag; }
  } else {
    const d = Math.hypot(x, y);
    if (d > 0) { x /= d; y /= d; }
  }

  if (state.demoInput) { x = state.demoInput.x; y = state.demoInput.y; }

  inp.x = x; inp.y = y;
  inp.active = Math.hypot(x, y) > 0.05;
}
