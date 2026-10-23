// Wildlife: one polar bear patrolling the ice west of the landing, a small group of
// penguins near the explorer's spawn, another out on the central ice, and the main
// colony on the snow slope under the "hunt for food" crags.
//
// Wildlife-owned URL params (for captures):
//   ?spawnWildlife=near   bear + a penguin group right beside the spawn
//   ?wlBear=walk|sit|lie|sniff|ground|stare|h<deg>   force a bear pose (h90 = stand facing south)
//   ?wlPeng=huddle        force huddling
//
// Events: { type: 'penguin', x, y, kind: 'call' }, { type: 'bear', x, y, kind: 'huff'|'growl' }
import { state, MAP_W, MAP_H } from '../state.js';
import { visibleRect } from '../camera.js';
import * as terrain from '../world/terrain.js';
import { makeBear, updateBear, drawBear, bearShadow } from './wildlife-bear.js';
import { makeGroup, updateGroup, drawPenguin, penguinShadow, setBear } from './wildlife-penguin.js';
import { pathOf } from './wildlife-rig.js';

// ---------------------------------------------------------------- walkability
// Prefer the real terrain module once it exists (it exports findWalkable); until then
// use our own coarse rock/ice mask (8 map px per cell) derived from the painting.
let mask = null, MW = 0, MHh = 0;
let REGIONS = null; // foot regions of the animals' homes, set at init
const realTerrain = () => typeof terrain.findWalkable === 'function' && !!terrain.mask?.();

function maskAt(x, y) {
  if (!mask) return 0;
  const i = Math.floor(x / 8), j = Math.floor(y / 8);
  if (i < 0 || j < 0 || i >= MW || j >= MHh) return 255;
  return mask[(j * MW + i) * 4];
}

const W = {
  walkable(x, y, bear = false) {
    if (x < 8 || y < 8 || x > MAP_W - 8 || y > MAP_H - 8) return false;
    if (realTerrain()) {
      const t = terrain.terrainAt?.(x, y);
      if (t === 'rock') return false;
      if (!bear && t === 'thin') return false;
      if (terrain.isWater?.(x, y)) return false;     // nobody walks on open water
      if (!(terrain.isWalkable?.(x, y) ?? true)) return false;
      // stay in the explorer's on-foot region: never on climb-only plateau tops
      if (terrain.isPlateau?.(x, y)) return false;
      // and inside the ground regions their homes are on (no climbing between regions)
      return !REGIONS || !terrain.regionAt || REGIONS.has(terrain.regionAt(x, y));
    }
    return maskAt(x, y) < 200; // fallback until/unless the real terrain mask exists
  },
  icy(x, y) {
    if (realTerrain()) { const t = terrain.terrainAt?.(x, y); return t === 'ice' || t === 'thin'; }
    const v = maskAt(x, y);
    return v > 90 && v < 170;
  },
  clearLine(x0, y0, x1, y1, bear = false) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 4));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      if (!this.walkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, bear)) return false;
    }
    return true;
  },
  // steer around small obstacles: the clear heading nearest the wanted one (or null)
  steer(x, y, a, look, bear = false) {
    for (const d of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.1, -2.1]) {
      const h = a + d;
      if (this.walkable(x + Math.cos(h) * look, y + Math.sin(h) * look, bear) &&
          this.walkable(x + Math.cos(h) * look * 0.5, y + Math.sin(h) * look * 0.5, bear)) return h;
    }
    return null;
  },
  // Short BFS on a 5-unit grid around start/goal. Returns the farthest point along the
  // route that is in straight clear line from the start (a waypoint), plus how close the
  // route gets to the goal (reach). Cheap enough to call about once a second.
  route(x0, y0, x1, y1, bear = false) {
    const S = 5, pad = 90;
    const bx = Math.min(x0, x1) - pad, by = Math.min(y0, y1) - pad;
    const gw = Math.ceil((Math.abs(x1 - x0) + pad * 2) / S), gh = Math.ceil((Math.abs(y1 - y0) + pad * 2) / S);
    if (gw * gh > 40000) return null;
    const prev = new Int32Array(gw * gh).fill(-2);
    const cell = (x, y) => Math.floor((y - by) / S) * gw + Math.floor((x - bx) / S);
    const s0 = cell(x0, y0); prev[s0] = -1;
    const q = [s0]; let best = s0, bd = Infinity;
    const gx = (x1 - bx) / S, gy = (y1 - by) / S;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], cx = c % gw, cy = (c / gw) | 0;
      const d = Math.hypot(cx - gx, cy - gy);
      if (d < bd) { bd = d; best = c; if (d < 1) break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (prev[n] !== -2) continue;
        if (!this.walkable(bx + (nx + 0.5) * S, by + (ny + 0.5) * S, bear)) { prev[n] = -3; continue; }
        prev[n] = c; q.push(n);
      }
    }
    // walk back from the best cell, keep the farthest point visible from the start
    const pts = [];
    for (let c = best; c >= 0; c = prev[c]) pts.push(c);
    pts.reverse();
    let wp = { x: x1, y: y1 };
    for (let k = pts.length - 1; k >= 0; k--) {
      const c = pts[k], px = bx + (c % gw + 0.5) * S, py = by + (((c / gw) | 0) + 0.5) * S;
      if (k === 0 || this.clearLine(x0, y0, px, py, bear)) { wp = { x: px, y: py }; break; }
    }
    return { x: wp.x, y: wp.y, reach: bd * S };
  },
  near(x, y, bear = false) {
    // every spawn and home goes through terrain.findWalkable first, so mask changes can't strand it
    if (realTerrain()) { const p = terrain.findWalkable(x, y); if (p) { x = p.x; y = p.y; } }
    if (this.walkable(x, y, bear)) return { x, y };
    if (realTerrain()) { const p = terrain.findWalkable(x, y); if (p && this.walkable(p.x, p.y, bear)) return p; }
    for (let r = 4; r < 160; r += 4) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r;
      if (this.walkable(px, py, bear)) return { x: px, y: py };
    }
    return { x, y };
  },
};

function loadMask() {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = MW = img.width; c.height = MHh = img.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        mask = g.getImageData(0, 0, MW, MHh).data;
        c.width = c.height = 0;
      } catch (e) { mask = null; }
      res();
    };
    img.onerror = res;
    img.src = 'assets/wildlife-rock.png';
  });
}

// ---------------------------------------------------------------- setup
let bear = null;
const groups = [];

export async function init() {
  await loadMask();
  // place animals against the real terrain mask: wait (briefly) for terrain.js to be ready
  for (let k = 0; k < 80 && typeof terrain.mask === 'function' && !terrain.mask(); k++) await new Promise(r => setTimeout(r, 50));
  const near = state.params.get('spawnWildlife') === 'near';
  const sx = state.player.x, sy = state.player.y;
  const forceBear = state.params.get('wlBear');
  const forcePeng = state.params.get('wlPeng');

  let bh, b0;
  if (near) {
    bh = W.near(sx + 34, sy - 20, true);
    bear = makeBear(bh.x, bh.y, { x: bh.x, y: bh.y, r: 45 }, { awareRange: 22, force: forceBear });
    bear.heading = Math.PI; // walking across the view
  } else {
    // west of the landing, out on the frozen inlet: seen patrolling from ~370 units
    bh = W.near(1010, 1490, true);
    b0 = W.near(1080, 1470, true);
    bear = makeBear(b0.x, b0.y, { x: bh.x, y: bh.y, r: 120 }, { force: forceBear });
  }

  const spec = near
    ? [[sx + 72, sy + 10, forcePeng === 'dirs' ? 24 : 9, 30]]
    : [];
  spec.push(
    [1235, 1438, 7, 50],        // a small party on the ice edge, ~190 units NW of spawn
    [1110, 1530, 5, 60],        // a few more out on the inlet ice, near the bear
    [1601, 1673, 3, 40],        // stragglers on the snow to the east
    [1500, 885, 26, 100, 55],   // the colony under the crags ("hunt for food")
  );
  const homes = [];
  for (const [x, y, n, r, spread] of spec) homes.push([W.near(x, y), n, r, spread]);
  if (realTerrain() && terrain.regionAt) {
    REGIONS = new Set([terrain.regionAt(bear.home.x, bear.home.y), ...homes.map(h => terrain.regionAt(h[0].x, h[0].y))]);
    REGIONS.delete(0);
    if (!REGIONS.size) REGIONS = null;
  }
  setBear(bear);
  for (const [p, n, r, spread] of homes) groups.push(makeGroup(p.x, p.y, n, r, W, { force: forcePeng, spread }));
}

export function update(dt) {
  if (!bear) return;
  updateBear(bear, dt, W);
  for (const g of groups) updateGroup(g, dt, W);
}

function onScreen(r, x, y) { return x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1; }

export function drawGround(ctx) {
  if (!bear) return;
  const r = visibleRect(40);
  const sh = [];
  if (onScreen(r, bear.x, bear.y)) bearShadow(bear, sh);
  const ps = [];
  for (const g of groups) for (const m of g.members) if (onScreen(r, m.x, m.y)) penguinShadow(m, ps);
  if (ps.length) { ctx.fillStyle = 'rgba(96,101,108,0.2)'; ctx.fill(pathOf(ps)); }
  if (!sh.length) return;
  const p = pathOf(sh);
  // one fill, so overlapping blobs never darken or leave lighter patches
  ctx.fillStyle = 'rgba(88,93,100,0.3)';
  ctx.fill(p);
}

export function drawables() {
  if (!bear) return [];
  const r = visibleRect(30);
  const out = [];
  if (onScreen(r, bear.x, bear.y)) out.push({ x: bear.x, y: bear.y, draw: ctx => drawBear(ctx, bear) });
  for (const g of groups) for (const m of g.members) {
    if (onScreen(r, m.x, m.y)) out.push({ x: m.x, y: m.y, draw: ctx => drawPenguin(ctx, m) });
  }
  return out;
}

// for the console / critics
if (typeof window !== 'undefined') window.NAS_WILDLIFE = { get bear() { return bear; }, groups, W };
