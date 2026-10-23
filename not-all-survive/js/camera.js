// Camera follows the explorer closely. Zoom is in screen px per world px.
import { state, MAP_W, MAP_H } from './state.js';

// How many world px of map should fit across the shorter screen side. Phones (portrait)
// sit close on the explorer; landscape screens get a little more of the world.
const VIEW_SPAN_PORTRAIT = 190;
const VIEW_SPAN_LANDSCAPE = 230;

// Title screen shows the wide country; begin() pushes in to the explorer over REVEAL_S.
const INTRO_ZOOM = 0.42;
const REVEAL_S = 6;

export function baseZoom() {
  const { w, h } = state.view;
  const span = w > h ? VIEW_SPAN_LANDSCAPE : VIEW_SPAN_PORTRAIT;
  return Math.max(1.2, Math.min(w, h) / span);
}

function introFactor() {
  if (!state.begun) return state.started ? 1 : INTRO_ZOOM;
  const t = Math.min(1, (state.time - state.begunAt) / REVEAL_S);
  const e = t * t * (3 - 2 * t); // smoothstep: slow start, slow settle
  return INTRO_ZOOM + (1 - INTRO_ZOOM) * e;
}

export function updateCamera(dt) {
  const c = state.cam, p = state.player;
  const intro = introFactor();
  const target = state.params.has('zoom') ? parseFloat(state.params.get('zoom')) : baseZoom() * (c.user || 1) * intro;
  // During the reveal the target itself is eased, so follow it tightly.
  const rate = intro < 1 ? 12 : 2;
  c.zoom = c.zoom ? c.zoom + (target - c.zoom) * Math.min(1, dt * rate) : target;

  // Lead slightly in the direction of travel, then ease in.
  const lead = 0.6;
  // While the title is up, frame the explorer low on screen, clear of the lettering.
  const titleDrop = (1 - intro) / (1 - INTRO_ZOOM) * state.view.h * 0.22 / (c.zoom || 1);
  const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead - 6 - titleDrop;
  const k = intro < 1 ? Math.min(1, dt * 12) : Math.min(1, dt * 2.2);
  c.x += (tx - c.x) * k;
  c.y += (ty - c.y) * k;

  // Keep the view inside the painting, except that at the bottom edge (the sea) it may run
  // a little past it, so the explorer isn't pinned low on a tall phone screen; the white
  // border haze covers what's beyond.
  const hw = state.view.w / 2 / c.zoom, hh = state.view.h / 2 / c.zoom;
  c.x = Math.max(hw, Math.min(MAP_W - hw, c.x));
  c.y = Math.max(hh, Math.min(MAP_H - hh * 0.8, c.y));
}

// Applies the world transform to ctx (canvas already scaled for DPR).
export function applyCamera(ctx) {
  const c = state.cam;
  ctx.translate(state.view.w / 2 + c.shakeX, state.view.h / 2 + c.shakeY);
  ctx.scale(c.zoom, c.zoom);
  ctx.translate(-c.x, -c.y);
}

export function screenToWorld(sx, sy) {
  const c = state.cam;
  return {
    x: (sx - state.view.w / 2 - c.shakeX) / c.zoom + c.x,
    y: (sy - state.view.h / 2 - c.shakeY) / c.zoom + c.y,
  };
}

export function worldToScreen(wx, wy) {
  const c = state.cam;
  return {
    x: (wx - c.x) * c.zoom + state.view.w / 2 + c.shakeX,
    y: (wy - c.y) * c.zoom + state.view.h / 2 + c.shakeY,
  };
}

// World-space rectangle currently on screen (plus margin), for culling.
export function visibleRect(margin = 0) {
  const c = state.cam;
  const hw = state.view.w / 2 / c.zoom + margin, hh = state.view.h / 2 / c.zoom + margin;
  return { x0: c.x - hw, y0: c.y - hh, x1: c.x + hw, y1: c.y + hh };
}

// Wheel / pinch zoom: a multiplier on the base zoom, kept within what the painting can bear.
export function nudgeZoom(factor) {
  const c = state.cam;
  c.user = Math.max(0.65, Math.min(1.5, (c.user || 1) * factor));
}
