// ============================================================
// THE CARTOGRAPHER - draw/animations.js
// Canvas animations: theodolite survey ring, sextant starlines,
// specimen bobbing (via drawSpecimens in entities.js).
// ============================================================

import { ctx } from '../canvas.js';
import { COLORS } from '../config.js';
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';
import { wobblyLine } from './coastline.js';

export function drawAnimations() {
  if (!state.activeAnimation) return;

  const t = (Date.now() - state.activeAnimation.startTime) / state.activeAnimation.duration;
  if (t > 1) {
    state.activeAnimation = null;
    return;
  }

  const ease = 1 - Math.pow(1 - t, 3); // cubic ease out

  if (state.activeAnimation.type === 'survey') {
    drawSurveyAnimation(t, ease);
  } else if (state.activeAnimation.type === 'sextant') {
    drawSextantAnimation(t, ease);
  }
}

function drawSurveyAnimation(t, ease) {
  const scr = worldToScreen(state.player.x, state.player.y);
  const r = state.activeAnimation.maxRadius * ease;

  // Expanding dashed ring
  ctx.strokeStyle = `rgba(58, 47, 36, ${0.4 * (1 - t)})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(scr.x, scr.y - 4, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4 radiating spoke lines
  const len = r * 0.3;
  ctx.strokeStyle = `rgba(58, 47, 36, ${0.2 * (1 - t)})`;
  ctx.lineWidth = 0.8;
  for (let a = 0; a < 4; a++) {
    const angle = a * Math.PI / 2 + t * 0.3;
    wobblyLine(
      scr.x + Math.cos(angle) * (r - len), scr.y - 4 + Math.sin(angle) * (r - len),
      scr.x + Math.cos(angle) * r,         scr.y - 4 + Math.sin(angle) * r,
      1,
    );
  }
}

function drawSextantAnimation(t, ease) {
  const scr = worldToScreen(state.activeAnimation.x, state.activeAnimation.y);
  const alpha = 0.6 * (1 - t);

  // Star sight lines radiating upward
  ctx.strokeStyle = `rgba(74, 122, 154, ${alpha})`;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i - 2) * 0.2;
    const len = 80 * ease;
    wobblyLine(scr.x, scr.y, scr.x + Math.cos(angle) * len, scr.y + Math.sin(angle) * len, 1);
  }

  // Angle arc
  ctx.beginPath();
  ctx.arc(scr.x, scr.y, 25 * ease, -Math.PI * 0.85, -Math.PI * 0.15);
  ctx.stroke();

  // Small star dots
  ctx.fillStyle = `rgba(74, 122, 154, ${alpha * 0.8})`;
  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI / 2 + (i - 1) * 0.25;
    const len = 60 + i * 15;
    ctx.beginPath();
    ctx.arc(
      scr.x + Math.cos(angle) * len * ease,
      scr.y + Math.sin(angle) * len * ease,
      2, 0, Math.PI * 2,
    );
    ctx.fill();
  }
}
