// Keyboard (WASD / arrows) and pointer (hold anywhere to walk toward it) input.
// On touch screens (Joe, as in the Maze and Unseen): the bottom part of the screen is a hidden
// thumbstick. Wherever a thumb goes down there is the stick's centre; dragging from it walks that
// way. No stick is drawn: ui/stickhint.js pulses one only if a touch player hasn't moved for
// 10 s, until they first use it. Touches higher up are taps (a cliff, the tent, the sled), not
// walks. ?stick forces this on a desktop (mouse) for testing.
// Writes state.input = { x, y, active } as a direction with magnitude 0..1, plus
// state.input.tap = { x, y, t } (world point of the latest press) and
// state.input.action = <time> (latest Space/E press). Consumers clear tap/action when used.
import { state } from './state.js';
import { screenToWorld, nudgeZoom } from './camera.js';

const keys = new Set();
let pointerId = null;
const touches = new Map(); // pointerId -> {x, y}, for pinch zoom
let pinchDist = 0;
let claimedId = null;      // pointer held by a UI element (compass) rather than walking
const STICK_ZONE = 0.5;    // the bottom half of the screen is the stick
const STICK_MAX = 54;      // px from the centre for a full push (the Maze's knob travel)
const STICK_DEAD = 0.22;   // fraction of travel that reads as "not pushing"
const forceStick = state.params?.has?.('stick');
let stick = null;          // { id, ox, oy, x, y }: the hidden stick, while a thumb is on it
state.stick = { active: false, x: 0, y: 0, used: (() => { try { return localStorage.getItem('nas_stickUsed') === '1'; } catch { return false; } })() };
const stickish = e => forceStick || e.pointerType === 'touch';

// UI elements can claim a press before it turns into walking or a climb tap:
// state.uiPress(sx, sy) -> true to take it; state.uiRelease() is called when it ends.
state.uiPress = null;
state.uiRelease = null;

export function initInput(canvas) {
  addEventListener('keydown', e => {
    keys.add(e.code);
    // Space / E: the context action (climb the face you're walking into).
    if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) state.input.action = state.time;
  });
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
      stick = null;
      pinchDist = pinchSpan();
      return;
    }
    if (touches.size > 2) return;
    if (state.uiPress?.(e.clientX, e.clientY)) { claimedId = e.pointerId; return; }
    if (stickish(e)) {
      const w = screenToWorld(e.clientX, e.clientY);
      if (e.clientY > innerHeight * (1 - STICK_ZONE)) {
        // the hidden stick: centred where the thumb landed. (Climbing, a thumb on it is the
        // next move, like Space.)
        stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        if (state.player?.mode === 'climb') state.input.action = state.time;
      } else state.input.tap = { x: w.x, y: w.y, t: state.time };   // higher up: a tap, not a walk
      return;
    }
    pointerId = e.pointerId;
    state.input.pointer = { sx: e.clientX, sy: e.clientY };
    // Every press is also reported as a tap at a world point, so actors can treat a
    // press on a cliff as "climb this" rather than "walk toward this".
    const w = screenToWorld(e.clientX, e.clientY);
    state.input.tap = { x: w.x, y: w.y, t: state.time };
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
    if (stick && e.pointerId === stick.id) { stick.x = e.clientX; stick.y = e.clientY; }
  });
  const end = e => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchDist = 0;
    if (e.pointerId === claimedId) { claimedId = null; state.uiRelease?.(); return; }
    if (stick && e.pointerId === stick.id) { stick = null; return; }
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

  // the hidden stick: direction and push from where the thumb went down
  const S = state.stick;
  S.active = false; S.x = S.y = 0;
  if (stick) {
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, len = Math.hypot(dx, dy);
    const k = Math.min(1, len / STICK_MAX);
    if (k > STICK_DEAD) {
      const m = (k - STICK_DEAD) / (1 - STICK_DEAD);
      x = dx / len * m; y = dy / len * m;
      S.active = true; S.x = x; S.y = y;
      if (!S.used) { S.used = true; try { localStorage.setItem('nas_stickUsed', '1'); } catch { /* private mode */ } }
    }
  }

  if (state.demoInput) { x = state.demoInput.x; y = state.demoInput.y; }

  inp.x = x; inp.y = y;
  inp.active = Math.hypot(x, y) > 0.05;
}
