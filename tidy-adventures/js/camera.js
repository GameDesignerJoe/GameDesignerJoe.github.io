/* ============================================================
   CAMERA — auto-fit framing plus continuous zoom and pan.

   THE DIAGNOSIS. "It feels too far away at the start, and the zoomed level
   is where I'd want to begin" is not a camera complaint, it's a framing one.
   Level 1-1 sets scale [0.42, 0.5], so the room renders at ~46% of the stage
   and floats in a sea of background. 0.46 x 2.3 (the old ZOOM constant) is
   about 1.06 — i.e. the "zoomed in" view was simply the room at natural
   size. So the fix is to fit the room to the stage, not to raise a constant.

   Fit is applied at FIT_STRENGTH rather than fully, because the campaign's
   scale ramp (0.42 -> 0.9) is doing real work: the house visibly grows as
   you progress. Full auto-fit would silently erase that.

   STRUCTURE. #roomHost > .cam > .room. The camera owns zoom/pan; the room
   owns the slide and bounce animations. In v3 all three wrote to the same
   element's `transform`, which is why bounce() had to call applyCam() to
   repair itself and why zoom reset every time you walked through a door.

   Imports: config, dom, state, util.
============================================================ */
import { ZOOM_MIN, ZOOM_MAX, ZOOM_START, WHEEL_K, FIT_STRENGTH } from './config.js';
import { host } from './dom.js';
import { G } from './state.js';
import { clamp } from './util.js';

export const camEl  = () => host.querySelector(".cam");
export const roomEl = () => host.querySelector(".room");

/* How much to scale so the room roughly fills the stage. sw/sh are the
   room's size as a fraction of the host, so the ideal is 1/max(sw,sh). */
export function fitScale(room) {
  if (!room) return 1;
  const ideal = 1 / Math.max(room.sw || 1, room.sh || 1);
  return clamp(1 + (ideal - 1) * FIT_STRENGTH, 1, 2.6);
}

/* The scale actually applied: auto-fit times the player's own zoom. */
export function camScale() {
  return fitScale(G.rooms[G.current]) * (G.cam?.z ?? 1);
}

export function applyCam() {
  const el = camEl();
  if (!el) return;
  const t = camScale();
  el.style.transform = `scale(${t}) translate(${G.cam.x}px, ${G.cam.y}px)`;
  /* Anything that must not grow with zoom can use var(--cs). */
  el.style.setProperty("--cs", 1 / t);
}

/* Pan limits. The v3 formula was w*(ZOOM-1)/(2*ZOOM), which assumed the room
   filled the host and a fixed scale — it produces nonsense once the scale is
   variable and rooms are not square. Measure the real overhang instead. */
function panLimit(scaledSize, viewSize, t) {
  return Math.max(0, (scaledSize - viewSize) / 2) / t;
}
export function clampPan() {
  const r = roomEl();
  if (!r) return;
  const t = camScale();
  const lx = panLimit(r.offsetWidth * t, host.clientWidth, t);
  const ly = panLimit(r.offsetHeight * t, host.clientHeight, t);
  G.cam.x = clamp(G.cam.x, -lx, lx);
  G.cam.y = clamp(G.cam.y, -ly, ly);
}

/* Zoom toward a screen point, keeping that point stationary. */
export function zoomAt(nextZ, clientX, clientY) {
  const before = camScale();
  G.cam.z = clamp(nextZ, ZOOM_MIN, ZOOM_MAX);
  const after = camScale();
  if (after !== before && clientX != null) {
    const hr = host.getBoundingClientRect();
    const ox = clientX - (hr.left + hr.width / 2);
    const oy = clientY - (hr.top + hr.height / 2);
    G.cam.x += ox * (1 / after - 1 / before);
    G.cam.y += oy * (1 / after - 1 / before);
  }
  clampPan();
  applyCam();
}

export function zoomBy(factor, clientX, clientY) {
  zoomAt((G.cam.z ?? 1) * factor, clientX, clientY);
}

/* Wheel: continuous. v3 ignored deltaY's magnitude entirely and snapped
   between exactly two levels. deltaMode 1 is Firefox's line-based wheel. */
export function wheelZoom(e) {
  const k = WHEEL_K * (e.deltaMode === 1 ? 16 : 1);
  zoomBy(Math.exp(-e.deltaY * k), e.clientX, e.clientY);
}

export function panBy(dx, dy) {
  const t = camScale();
  G.cam.x += dx / t;
  G.cam.y += dy / t;
  clampPan();
  applyCam();
}

/* Walking through a door keeps your zoom — snapping back to wide every time
   is what made zoom feel disposable. Pan recentres, since the old offset
   means nothing in a differently-sized room. */
export function resetPan() {
  G.cam.x = 0; G.cam.y = 0;
  clampPan();
}

export function resetZoom() {
  G.cam = { z: ZOOM_START, x: 0, y: 0 };
}

export const isZoomed = () => (G.cam?.z ?? 1) > 1.02;

/* Smooth transitions for discrete jumps, off during a live gesture. */
export function setCamSmooth(on) {
  const el = camEl();
  if (el) el.classList.toggle("smooth", !!on);
}
