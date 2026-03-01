// ============================================================
// THE CARTOGRAPHER - draw/coastline-bezier.js
// Smooth bezier coastline overlay, drawn after all tile fills.
// ============================================================

import { ctx } from '../canvas.js';
import { TILE, COLORS, GRID } from '../config.js';
import { state } from '../state.js';
import { isLand } from '../terrain.js';
import { worldToScreen } from '../camera.js';

// All coast edges for the FULL island (regardless of reveal state).
// Always produces closed polygon loops — safe for the parchment flood fill.
function collectIslandEdges() {
  const edges = [];
  for (let ty = 0; ty < GRID; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      if (!isLand(tx, ty)) continue;
      if (!isLand(tx, ty - 1)) edges.push({ ax: tx,   ay: ty,   bx: tx+1, by: ty   });
      if (!isLand(tx, ty + 1)) edges.push({ ax: tx+1, ay: ty+1, bx: tx,   by: ty+1 });
      if (!isLand(tx + 1, ty)) edges.push({ ax: tx+1, ay: ty,   bx: tx+1, by: ty+1 });
      if (!isLand(tx - 1, ty)) edges.push({ ax: tx,   ay: ty+1, bx: tx,   by: ty   });
    }
  }
  return edges;
}

// Coast edges for VISIBLE land tiles only (revealed or surveyed).
// May produce OPEN paths when the revealed area doesn't fully enclose a coast.
function collectVisibleEdges(surveyedOnly) {
  const edges = [];
  for (let ty = 0; ty < GRID; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      if (!isLand(tx, ty)) continue;
      const key      = `${tx},${ty}`;
      const surveyed = state.surveyedTiles.has(key);
      const revealed = state.revealedTiles.has(key);
      if (surveyedOnly ? !surveyed : (!revealed && !surveyed)) continue;
      if (!isLand(tx, ty - 1)) edges.push({ ax: tx,   ay: ty,   bx: tx+1, by: ty   });
      if (!isLand(tx, ty + 1)) edges.push({ ax: tx+1, ay: ty+1, bx: tx,   by: ty+1 });
      if (!isLand(tx + 1, ty)) edges.push({ ax: tx+1, ay: ty,   bx: tx+1, by: ty+1 });
      if (!isLand(tx - 1, ty)) edges.push({ ax: tx,   ay: ty+1, bx: tx,   by: ty   });
    }
  }
  return edges;
}

// Chain edges into paths. Returns { pts, closed } objects.
// closed=true when the last edge's endpoint connects back to the first point.
function traceLoops(edges) {
  const adj = new Map();
  for (let i = 0; i < edges.length; i++) {
    const k = `${edges[i].ax},${edges[i].ay}`;
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k).push(i);
  }

  const used  = new Array(edges.length).fill(false);
  const paths = [];

  for (let start = 0; start < edges.length; start++) {
    if (used[start]) continue;
    const pts = [];
    const startAX = edges[start].ax, startAY = edges[start].ay;
    let ei = start;
    let endBX = startAX, endBY = startAY;

    for (let guard = 0; guard <= edges.length; guard++) {
      if (ei === -1 || used[ei]) break;
      used[ei] = true;
      pts.push({ x: edges[ei].ax, y: edges[ei].ay });
      endBX = edges[ei].bx;
      endBY = edges[ei].by;
      const nk    = `${endBX},${endBY}`;
      const cands = adj.get(nk) || [];
      ei = cands.find(i => !used[i]) ?? -1;
    }

    const closed = (endBX === startAX && endBY === startAY);
    if (pts.length >= (closed ? 3 : 2)) paths.push({ pts, closed });
  }
  return paths;
}

// Add a bezier-smoothed path to the CURRENT canvas path.
// closed=true: midpoint method produces a seamless closed loop (use for fills).
// closed=false: open arc from first to last point (stroke only, no diagonal).
function _addPath(pts, closed) {
  const n  = pts.length;
  const sp = pts.map(p => worldToScreen(p.x, p.y));
  const mx = (a, b) => (a.x + b.x) * 0.5;
  const my = (a, b) => (a.y + b.y) * 0.5;

  if (closed) {
    // Start at the midpoint of the last→first edge for a seamless closed loop
    ctx.moveTo(mx(sp[n-1], sp[0]), my(sp[n-1], sp[0]));
    for (let i = 0; i < n; i++) {
      const cur = sp[i], next = sp[(i+1) % n];
      ctx.quadraticCurveTo(cur.x, cur.y, mx(cur, next), my(cur, next));
    }
    ctx.closePath();
  } else {
    // Open arc: start at first point, end at last point
    ctx.moveTo(sp[0].x, sp[0].y);
    for (let i = 0; i + 1 < n; i++) {
      const cur = sp[i], next = sp[i+1];
      ctx.quadraticCurveTo(cur.x, cur.y, mx(cur, next), my(cur, next));
    }
    ctx.lineTo(sp[n-1].x, sp[n-1].y);
    // No closePath — avoids the diagonal artifact on partial coastlines
  }
}

// Main entry point — called once per frame after all tile fills.
// Flood-fills the water area with COLORS.water using the full island outline,
// trimming any protruding rectangular tile corners at the coast.
// No stroke is drawn — the island shape is defined purely by the fill contrast.
export function drawCoastlineBezier() {
  const islandEdges = collectIslandEdges();
  if (islandEdges.length === 0) return;
  const islandLoops = traceLoops(islandEdges);

  ctx.save();

  // Flood-fill outside the full island with the ocean water color.
  // Uses COMPLETE island outline (fog + revealed + surveyed) so fog tiles
  // stay inside the "hole" and aren't painted over.
  ctx.fillStyle = COLORS.water;
  ctx.beginPath();
  ctx.rect(-99999, -99999, 199999, 199999);
  for (const { pts, closed } of islandLoops) _addPath(pts, closed);
  ctx.fill('evenodd');

  ctx.restore();
}
