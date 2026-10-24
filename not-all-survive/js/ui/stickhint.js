// The thumbstick hint (Joe): on a touch screen the bottom half is a hidden thumbstick (input.js).
// Nothing is drawn for it, unless a touch player who has never used it stands still for 10 s:
// then a faint ring and knob pulse low on the screen, the knob nudging out and back, to show
// where a thumb goes. The first time they walk with it (state.stick.used, remembered on this
// device) it never shows again. ?stickhint shows it straight away (for captures).
import { state } from '../state.js';

const IDLE_S = 10;
const touchScreen = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const forced = state.params.has('stickhint');
let idle = 0, a = 0;

export function update(dt) {
  const S = state.stick, P = state.player;
  const can = (touchScreen || forced || state.params.has('stick')) && S && !S.used && state.begun !== false
    && (P.mode === 'walk' || P.mode === 'cower');
  idle = can && !P.moving ? idle + dt : 0;
  const want = can && (idle > IDLE_S || forced) ? 1 : 0;
  a += (want - a) * Math.min(1, dt * (want ? 1.5 : 4));
}

export function drawOverlay(ctx) {
  if (a < 0.01) return;
  const { dpr, w, h } = state.view;
  const R = Math.min(70, w * 0.17), cx = w / 2, cy = h - Math.max(R + 40, h * 0.2);
  const t = state.time, pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
  // the knob nudges up and out and back, as a thumb would push it
  const nudge = Math.max(0, Math.sin(t * 1.6)) * R * 0.45;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = a * (0.55 + 0.35 * pulse);
  ctx.beginPath(); ctx.arc(cx, cy, R * (1 + 0.06 * pulse), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(250,250,247,0.10)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(40,40,44,0.35)'; ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(cx, cy, R * (1 + 0.06 * pulse) - 1.5, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = a * 0.9;
  ctx.beginPath(); ctx.arc(cx, cy - nudge, R * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(250,250,247,0.55)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(40,40,44,0.4)'; ctx.stroke();
  ctx.restore();
}
