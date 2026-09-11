// The Maze — every frame: floor, walls, fog, lamp cone, marks, HUD
//
// Part of the engine, loaded as a plain script in the order it used to appear
// in maze-topdown.html. Everything shares one global scope, exactly as before.

// ── render ──────────────────────────────────────────────────────
let dpr = 1;
function resize() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
addEventListener('resize', resize); resize();

// ── the floor ───────────────────────────────────────────────────
// Marks in the concrete, not effects on the screen. Everything here is fixed by the seed and
// the shape of the maze, so it is in the same place every time you come back to it: this is a
// room somebody has lived in their whole life, not a filter over the picture.
const tileNoise = (x, y, salt) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// how much of the maze's traffic passes over each tile, as distance out from the way through.
// Feet polish the routes people actually take; nothing walks a dead end but you.
let wearMap = null, wearSeed = -1;
function floorWear() {
  if (wearSeed === SEED && wearMap) return wearMap;
  const d = new Map(), q = [];
  for (const [x, y] of solutionPath) { const k = x + ',' + y; if (!d.has(k)) { d.set(k, 0); q.push([x, y]); } }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i], n = d.get(x + ',' + y);
    if (n >= CONFIG.floorWearReach) continue;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (!isOpen(nx, ny) || d.has(k)) continue; d.set(k, n + 1); q.push([nx, ny]); }
  }
  wearSeed = SEED; wearMap = d; return d;
}
function drawWorn(S, ox, oy, x0_, x1_, y0_, y1_) {
  // Stroked along the corridor rather than dabbed on each tile, so it reads as one worn track
  // running through the place instead of a row of spots. Two passes, a soft wide one and a
  // narrower brighter one, and the overlap at a junction comes out brighter — which is right,
  // because a junction is where more feet crossed.
  const wear = floorWear(), reach = CONFIG.floorWearReach;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let y = y0_; y <= y1_; y++) for (let x = x0_; x <= x1_; x++) {
    if (!tiles[y][x]) continue;
    const n = wear.get(x + ',' + y);
    if (n === undefined) continue;
    const w = (1 - n / reach) * (0.7 + 0.3 * tileNoise(x, y, 11));
    if (w <= 0.02) continue;
    const px = ox + x * S + S / 2, py = oy + y * S + S / 2;
    // How open the tile is decides how it is painted. A corridor gets a stroked track. A room
    // gets a flat wash instead, because in an open floor everybody walks everywhere — and because
    // stroking a plus on every tile of a room leaves the diagonals bare and prints a lattice of
    // rings across it, which is what this used to do.
    const openN = DIRS.reduce((n, [dx, dy]) => n + (isOpen(x + dx, y + dy) ? 1 : 0), 0);
    const roomish = Math.max(0, Math.min(1, (openN - 2) / 2));
    if (roomish > 0) {
      ctx.fillStyle = `rgba(186,181,170,${(w * CONFIG.floorWorn * 0.115 * roomish).toFixed(3)})`;
      ctx.fillRect(ox + x * S, oy + y * S, S + 0.5, S + 0.5);
    }
    if (roomish < 1) for (const [width, k] of [[0.66, 0.1], [0.33, 0.13]]) {
      ctx.strokeStyle = `rgba(186,181,170,${(w * CONFIG.floorWorn * k * (1 - roomish)).toFixed(3)})`;
      ctx.lineWidth = S * width; ctx.beginPath();
      let any = false;
      for (const [dx, dy] of DIRS) { if (!isOpen(x + dx, y + dy)) continue; any = true; ctx.moveTo(px, py); ctx.lineTo(px + dx * S * 0.55, py + dy * S * 0.55); }
      if (!any) { ctx.moveTo(px, py); ctx.lineTo(px + 0.01, py); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
// dirt gathers where the mop never reaches: along the foot of every wall, and twice over in a corner
function drawGrime(S, ox, oy, x0_, x1_, y0_, y1_) {
  const reach = 0.42;
  ctx.save();
  for (let y = y0_; y <= y1_; y++) for (let x = x0_; x <= x1_; x++) {
    if (!tiles[y][x]) continue;
    const px = ox + x * S, py = oy + y * S;
    const a = CONFIG.floorGrime * (0.55 + 0.75 * tileNoise(x, y, 23));
    for (const [dx, dy] of DIRS) {
      if (isOpen(x + dx, y + dy)) continue;
      const x1 = dx > 0 ? px + S : dx < 0 ? px : px, y1 = dy > 0 ? py + S : dy < 0 ? py : py;
      const g = ctx.createLinearGradient(x1, y1, x1 - dx * S * reach, y1 - dy * S * reach);
      g.addColorStop(0, `rgba(22,23,24,${(0.55 * a).toFixed(3)})`);
      g.addColorStop(1, 'rgba(22,23,24,0)');
      ctx.fillStyle = g; ctx.fillRect(px, py, S + 0.5, S + 0.5);
    }
  }
  ctx.restore();
}
// strip lights overhead. Most of them work.
let lampGrid = null, lampSeed = -1;
function ceilingLights() {
  if (lampSeed === SEED && lampGrid) return lampGrid;
  const out = [], step = CONFIG.floorLightSpacing * 2;
  for (let cy = P + 1; cy < H; cy += step) for (let cx = P + 1; cx < W; cx += step) {
    const n = tileNoise(cx, cy, 41), m = tileNoise(cx, cy, 57);
    out.push({ x: cx + (n - 0.5) * 3, y: cy + (m - 0.5) * 3, r: 3.1 + n * 1.8, bad: m < CONFIG.floorLightBad, ph: n * 40 });
  }
  lampSeed = SEED; lampGrid = out; return out;
}
function drawLights(S, ox, oy, vw, vh, nowMs) {
  const t = nowMs / 1000;
  ctx.save();
  for (const L of ceilingLights()) {
    const px = ox + L.x * S, py = oy + L.y * S, r = L.r * S;
    if (px + r < 0 || px - r > vw || py + r < 0 || py - r > vh) continue;
    let lit = 0.86 + 0.14 * Math.sin(t * 1.7 + L.ph);
    if (L.bad) {
      const s = Math.sin(t * 17.3 + L.ph) * Math.sin(t * 5.1 + L.ph * 2) * Math.sin(t * 31.7);
      if (s > 0.5) lit *= 0.15;                       // the stutter
      else if (s > 0.35) lit *= 0.6;
    }
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(226,222,206,${(lit * CONFIG.floorLights * 0.22).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(226,222,206,${(lit * CONFIG.floorLights * 0.09).toFixed(3)})`);
    g.addColorStop(1, 'rgba(226,222,206,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function drawFloorTexture(S, ox, oy, vw, vh, x0_, x1_, y0_, y1_, nowMs) {
  const f = SAVE.ui.floor || 'wornlights';   // the two that carry it, on by default
  if (f === 'off') return;
  const all = f === 'all', pair = f === 'wornlights';
  if ((all || pair || f === 'worn') && CONFIG.floorWorn > 0) drawWorn(S, ox, oy, x0_, x1_, y0_, y1_);
  if ((all || pair || f === 'lights') && CONFIG.floorLights > 0) drawLights(S, ox, oy, vw, vh, nowMs);
  if ((all || f === 'grime') && CONFIG.floorGrime > 0) drawGrime(S, ox, oy, x0_, x1_, y0_, y1_);
}

// ── texture ─────────────────────────────────────────────────────
// Three ways to age the concrete, so the look can be picked by eye rather than argued about.
// Damp lies on the floor and goes under the fog, because a stain is a thing in the room. Grain
// and Dust sit on the glass over everything, because they are not.
let grainTile = null, dampBlobs = null, dampFor = -1, motes = null, grainAt = 0, grainOff = [0, 0];
function grainPattern() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 30; }
  g.putImageData(img, 0, 0); grainTile = c; return c;
}
function dampPatches() {
  if (dampFor === SEED) return dampBlobs;
  const R2 = rng((SEED ^ 0x9e3779b9) >>> 0), out = [];
  for (let i = 0; i < CONFIG.textureDamp; i++) out.push({ x: R2() * W, y: R2() * H, r: 1.4 + R2() * 4.2, a: 0.2 + R2() * 0.5 });
  dampFor = SEED; dampBlobs = out; return out;
}
function drawDamp(S, ox, oy, vw, vh) {
  ctx.save(); ctx.globalAlpha = CONFIG.textureAmount;
  for (const b of dampPatches()) {
    const px = ox + b.x * S, py = oy + b.y * S, r = b.r * S;
    if (px + r < 0 || px - r > vw || py + r < 0 || py - r > vh) continue;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(24,26,27,${(0.34 * b.a).toFixed(3)})`); g.addColorStop(1, 'rgba(24,26,27,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function drawGrain(vw, vh, nowMs) {
  if (nowMs - grainAt > 90) { grainAt = nowMs; grainOff = [Math.random() * 128 | 0, Math.random() * 128 | 0]; }
  ctx.save(); ctx.globalAlpha = CONFIG.textureGrain; ctx.translate(-grainOff[0], -grainOff[1]);
  ctx.fillStyle = ctx.createPattern(grainPattern(), 'repeat');
  ctx.fillRect(0, 0, vw + 128, vh + 128); ctx.restore();
}
function drawDust(vw, vh, dt, S, ox, oy, x0_, x1_, y0_, y1_) {
  if (!motes) { motes = []; for (let i = 0; i < CONFIG.textureMotes; i++) motes.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.012, vy: -0.004 - Math.random() * 0.012, r: 0.6 + Math.random() * 1.7, a: 0.1 + Math.random() * 0.4 }); }
  ctx.save();
  // clipped to the floor, so it hangs in the rooms and the halls rather than over the stone
  ctx.beginPath();
  for (let y = y0_; y <= y1_; y++) for (let x = x0_; x <= x1_; x++) if (tiles[y][x]) ctx.rect(ox + x*S, oy + y*S, S + 0.5, S + 0.5);
  ctx.clip();
  ctx.fillStyle = '#ece7da';
  for (const m of motes) {
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } if (m.x < -0.02) m.x = 1.02; if (m.x > 1.02) m.x = -0.02;
    ctx.globalAlpha = m.a * CONFIG.textureAmount;
    ctx.beginPath(); ctx.arc(m.x * vw, m.y * vh, m.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// The body, drawn into an already translated and rotated context. Seven bands from tail to
// nose, one per stone: dark while it is still carried, pale once it has been put down. He
// starts as a shape you can barely see and ends the pale arrow he always used to be.
const mixHex = (a, b, t) => {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b), k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r1 + (r2 - r1) * k)},${Math.round(g1 + (g2 - g1) * k)},${Math.round(b1 + (b2 - b1) * k)})`;
};
// Chalk, the way a kid holds it: a line drawn in three wobbly bits rather than one straight one,
// with the wobble fixed by where the line is so it never shimmers between frames.
function chalkLine(x0, y0, x1, y1, jitter, mx_, my_, salt) {
  const n = 3, nx = -(y1 - y0), ny = x1 - x0, len = Math.hypot(nx, ny) || 1;
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) {
    const t = i / n, ax = x0 + (x1 - x0) * t, ay = y0 + (y1 - y0) * t;
    const off = i === n ? 0 : (tileNoise(mx_, my_, salt + i) - 0.5) * jitter;
    ctx.lineTo(ax + nx / len * off, ay + ny / len * off);
  }
}
// The digits 1–8 as a child would chalk them: strokes, not a typeface, each in a 0–1 box.
const CHALK_DIGITS = {
  1: [[[0.34, 0.18], [0.52, 0.04], [0.5, 0.96]]],
  2: [[[0.16, 0.26], [0.32, 0.04], [0.66, 0.06], [0.74, 0.32], [0.2, 0.94], [0.82, 0.92]]],
  3: [[[0.16, 0.1], [0.62, 0.04], [0.76, 0.28], [0.44, 0.5], [0.78, 0.7], [0.58, 0.96], [0.14, 0.88]]],
  4: [[[0.62, 0.04], [0.12, 0.66], [0.86, 0.62]], [[0.6, 0.04], [0.64, 0.96]]],
  5: [[[0.78, 0.08], [0.26, 0.06], [0.2, 0.46], [0.56, 0.42], [0.78, 0.66], [0.58, 0.94], [0.18, 0.86]]],
  6: [[[0.72, 0.06], [0.3, 0.3], [0.2, 0.66], [0.46, 0.96], [0.76, 0.74], [0.54, 0.5], [0.22, 0.62]]],
  7: [[[0.14, 0.08], [0.84, 0.06], [0.38, 0.96]]],
  8: [[[0.5, 0.04], [0.24, 0.2], [0.5, 0.46], [0.76, 0.22], [0.5, 0.04]], [[0.5, 0.46], [0.22, 0.72], [0.5, 0.96], [0.8, 0.7], [0.5, 0.46]]],
};
function chalkDigit(n, px, py, h, mx_, my_, salt) {
  const paths = CHALK_DIGITS[n]; if (!paths) return;
  const w = h * 0.62, tilt = (tileNoise(mx_, my_, salt) - 0.5) * 0.22;
  ctx.save(); ctx.translate(px, py); ctx.rotate(tilt); ctx.beginPath();
  for (const path of paths) {
    path.forEach(([x, y], i) => { const ax = (x - 0.5) * w, ay = (y - 0.5) * h; i ? ctx.lineTo(ax, ay) : ctx.moveTo(ax, ay); });
  }
  ctx.stroke(); ctx.restore();
}

// the eight lines of a noughts-and-crosses board
const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
// the boards a kid leaves behind: two crosses, no noughts, the middle open
const TTT_GAMES = [
  ['x','','', '','','', '','','x'], ['','','x', '','','', 'x','',''],
  ['','x','', '','','', '','x',''], ['','','', 'x','','x', '','',''],
];
// A game of noughts and crosses chalked on the floor — except there are never any noughts. Two
// crosses are down and the middle is open, so your own X in the middle wins it, and when it does
// the line is struck through. `cells` is nine of '' or 'x'.
function drawTicTacToe(px, py, S, cells, won) {
  const C = CONFIG.colors, g = S * 0.26;
  ctx.save(); ctx.globalAlpha = 0.85;
  ctx.strokeStyle = C.mark; ctx.lineWidth = Math.max(1, S * 0.03); ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(px - g/2, py - g*1.5); ctx.lineTo(px - g/2, py + g*1.5); ctx.moveTo(px + g/2, py - g*1.5); ctx.lineTo(px + g/2, py + g*1.5);
  ctx.moveTo(px - g*1.5, py - g/2); ctx.lineTo(px + g*1.5, py - g/2); ctx.moveTo(px - g*1.5, py + g/2); ctx.lineTo(px + g*1.5, py + g/2);
  ctx.stroke();
  const cross = (i) => { const cx = px + ((i % 3) - 1) * g, cy = py + (Math.floor(i / 3) - 1) * g, a = g * 0.28;
    ctx.beginPath(); ctx.moveTo(cx-a, cy-a); ctx.lineTo(cx+a, cy+a); ctx.moveTo(cx+a, cy-a); ctx.lineTo(cx-a, cy+a); ctx.stroke(); };
  ctx.lineWidth = Math.max(1.2, S * 0.035);
  cells.forEach((c, i) => { if (c === 'x') cross(i); });
  if (won) {
    cross(4);
    const line = TTT_LINES.find(([a, b, c2]) => (cells[a] === 'x' || a === 4) && (cells[b] === 'x' || b === 4) && (cells[c2] === 'x' || c2 === 4));
    if (line) { const at = (i) => [px + ((i % 3) - 1) * g, py + (Math.floor(i / 3) - 1) * g];
      const [ax, ay] = at(line[0]), [bx, by] = at(line[2]);
      ctx.lineWidth = Math.max(1.4, S * 0.04);
      ctx.beginPath(); ctx.moveTo(ax + (ax - bx) * 0.12, ay + (ay - by) * 0.12); ctx.lineTo(bx + (bx - ax) * 0.12, by + (by - ay) * 0.12); ctx.stroke(); }
  }
  ctx.restore();
}

// A squeeze is drawn on the wall it goes through: the tile stays wall-coloured and a narrow
// strip of floor is cut through the middle of it, with one arm reaching toward each side you can
// actually walk to and a lip along the cut. It used to assume every squeeze ran straight through,
// so a squeeze on a tile open three or four ways — they turn up in the exit gauntlet — showed a
// single strip and then let you walk out of a side with nothing drawn on it at all.
function drawSqueeze(px, py, S, mx, my, open) {
  const C = CONFIG.colors, w = CONFIG.squeezeChannel, lo = 0.5 - w/2, hi = 0.5 + w/2, t = 1.5;
  const arm = DIRS.map(([dx, dy]) => isOpen(mx + dx, my + dy));   // DIRS order: right, left, down, up
  ctx.fillStyle = C.wall; ctx.fillRect(px, py, S+0.5, S+0.5);
  ctx.fillStyle = open ? C.floor : '#151819';
  ctx.fillRect(px + S*lo, py + S*lo, S*w + 0.5, S*w + 0.5);
  if (arm[0]) ctx.fillRect(px + S*hi, py + S*lo, S*lo + 0.5, S*w + 0.5);
  if (arm[1]) ctx.fillRect(px, py + S*lo, S*lo, S*w + 0.5);
  if (arm[2]) ctx.fillRect(px + S*lo, py + S*hi, S*w + 0.5, S*lo + 0.5);
  if (arm[3]) ctx.fillRect(px + S*lo, py, S*w + 0.5, S*lo);
  if (!open) return;
  // the lip: along the flanks of each arm, and across the face of the hub where there is no arm
  ctx.fillStyle = C.thick;
  const flankH = (x, wd) => { ctx.fillRect(px + x, py + S*lo - 1, wd, t); ctx.fillRect(px + x, py + S*hi - 0.5, wd, t); };
  const flankV = (y, ht) => { ctx.fillRect(px + S*lo - 1, py + y, t, ht); ctx.fillRect(px + S*hi - 0.5, py + y, t, ht); };
  if (arm[0]) flankH(S*hi, S*lo + 0.5); else ctx.fillRect(px + S*hi - 0.5, py + S*lo - 1, t, S*w + 2);
  if (arm[1]) flankH(0, S*lo); else ctx.fillRect(px + S*lo - 1, py + S*lo - 1, t, S*w + 2);
  if (arm[2]) flankV(S*hi, S*lo + 0.5); else ctx.fillRect(px + S*lo - 1, py + S*hi - 0.5, S*w + 2, t);
  if (arm[3]) flankV(0, S*lo); else ctx.fillRect(px + S*lo - 1, py + S*lo - 1, S*w + 2, t);
}

// A block is floor with a thick sliver of wall down the side it can still be shoved — one sliver
// per way, so a two-way block wears two. Nothing else: the tile has to read as part of the map
// with a hint on it, not as an object sitting on top of one. It was a whole outlined slab from
// v0.54 to v0.60, and Joe was right about that: "the entire thing is outlined and it doesn't even
// look like it's part of the map. It just looks like a block."
function blockSlivers(px, py, S, ways, color) {
  const w = S * 0.08;
  ctx.fillStyle = color || CONFIG.colors.thick;
  for (const [dx, dy] of ways) {
    if (dx === 1) ctx.fillRect(px + S - w, py, w, S);
    else if (dx === -1) ctx.fillRect(px, py, w, S);
    else if (dy === 1) ctx.fillRect(px, py + S - w, S, w);
    else ctx.fillRect(px, py, S, w);
  }
}

function drawPlayerBody(c, r) {
  const C = CONFIG.colors, n = STONES.length;
  c.beginPath(); c.moveTo(r, 0); c.lineTo(-r*0.8, -r*0.75); c.lineTo(-r*0.45, 0); c.lineTo(-r*0.8, r*0.75); c.closePath();
  c.save(); c.clip();
  const x0 = -r*0.8, span = r*1.8;
  for (let i = 0; i < n; i++) {
    // the band for the burden just put down goes pale during the waking, not before it
    // the band coming off goes black → grey → pale, and holds on the grey, so there is a change
    // to watch rather than a flicker of white at the end
    c.fillStyle = i === liftBand
      ? (liftBandAmt < 0.55 ? mixHex(C.playerBurdened, C.playerLifting, liftBandAmt / 0.55)
        : mixHex(C.playerLifting, C.player, (liftBandAmt - 0.55) / 0.45))
      : has(i) ? C.player : C.playerBurdened;
    c.fillRect(x0 + span*i/n - 0.5, -r*1.1, span/n + 1, r*2.2);
  }
  c.restore();
  if (CONFIG.playerOutline > 0) { c.strokeStyle = C.playerEdge || C.player; c.lineWidth = r * CONFIG.playerOutline; c.lineJoin = 'round'; c.stroke(); }
}

// How much of the name, and how much of the chapter, is still showing this many seconds into the
// zoom-out. Joe: "hold the chapter title a little longer as we zoom out so it's readable and then
// fade out" — so the chapter sits at full while the name goes, and is out well before the zoom is.
const nameFade = (el) => Math.max(0, 1 - el / 0.9);
const chapterFade = (el) => Math.max(0, 1 - Math.max(0, el - CONFIG.chapterHoldSec) / CONFIG.chapterFadeSec);

function draw() {
  const C = CONFIG.colors, vw = innerWidth, vh = innerHeight, nowMs = gameNow();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, vw, vh);

  let S = zoomS, ox, oy;
  // Full map only once the run is going. On the title screen it drew the whole maze over
  // the sleeping figure, and since the HUD is hidden there and the figure was a few pixels
  // wide, changing Size with it ticked left you looking at a map you could not leave.
  if (debugMap && started) { const f = dbgFrame(); S = f.S; ox = f.ox; oy = f.oy; }
  else {
    const landscape = vw > vh, leftStick = document.body.classList.contains('stick-left');
    const pre = !started && !intro;   // asleep: dead center, no HUD to make room for
    const ax = 0.5, ay = pre ? 0.47 : landscape ? 0.5 : 0.42;
    ox = vw*ax - cam.x*S; oy = vh*ay - (cam.y + camBump) * S;
  }
  viewS = S; viewOx = ox; viewOy = oy;
  const T = (x, y) => [ox + x*S + S/2, oy + y*S + S/2];

  const x0_ = Math.max(0, Math.floor(-ox/S) - 1), x1_ = Math.min(W-1, Math.ceil((vw-ox)/S) + 1);
  const y0_ = Math.max(0, Math.floor(-oy/S) - 1), y1_ = Math.min(H-1, Math.ceil((vh-oy)/S) + 1);

  // floor + seams
  ctx.fillStyle = C.floor;
  for (let y=y0_; y<=y1_; y++) for (let x=x0_; x<=x1_; x++) if (tiles[y][x]) ctx.fillRect(ox + x*S, oy + y*S, S+0.5, S+0.5);
  ctx.strokeStyle = C.grout; ctx.lineWidth = 1; ctx.beginPath();
  for (let y=y0_; y<=y1_; y++) for (let x=x0_; x<=x1_; x++) if (tiles[y][x]) { ctx.moveTo(ox+x*S, oy+y*S); ctx.lineTo(ox+x*S+S, oy+y*S); ctx.moveTo(ox+x*S, oy+y*S); ctx.lineTo(ox+x*S, oy+y*S+S); }
  ctx.stroke();
  if (!debugMap) drawFloorTexture(S, ox, oy, vw, vh, x0_, x1_, y0_, y1_, nowMs);
  // walls
  ctx.fillStyle = C.wall;
  for (let y=y0_; y<=y1_; y++) for (let x=x0_; x<=x1_; x++) if (!tiles[y][x]) ctx.fillRect(ox + x*S, oy + y*S, S+0.5, S+0.5);

  // shelves in the start room: one per character, five slots each; a white spine for every page you hold
  if (startRoom) {
    const { x0, y0, x1, y1 } = startRoom;
    const spots = SHELF_SPOTS(x0, y0, y1);
    CAST.filter(c => c.pages.length).forEach((c, ci) => {
      const [tx, ty, o] = spots[ci] || []; if (!o || tx < x0_ || tx > x1_ || ty < y0_ || ty > y1_) return;
      const got = SAVE.collected[c.name] || [];
      const px = ox + tx*S, py = oy + ty*S, inset = S*0.14, len = S*0.72, start = (S - len) / 2;
      ctx.strokeStyle = C.shelf; ctx.lineWidth = 1; ctx.beginPath();
      if (o === 'v') { ctx.moveTo(px + inset, py + start); ctx.lineTo(px + inset, py + start + len); } else { ctx.moveTo(px + start, py + S - inset); ctx.lineTo(px + start + len, py + S - inset); }
      ctx.stroke();
      for (let i = 0; i < c.pages.length; i++) {
        const t = start + len * (i + 0.5) / c.pages.length;
        if (got[i]) { ctx.fillStyle = C.book; if (o === 'v') ctx.fillRect(px + inset - S*0.01, py + t - S*0.025, S*0.13, S*0.05); else ctx.fillRect(px + t - S*0.025, py + S - inset - S*0.12, S*0.05, S*0.13); }
        else { ctx.fillStyle = C.shelf; if (o === 'v') ctx.fillRect(px + inset + S*0.04, py + t - S*0.01, S*0.02, S*0.02); else ctx.fillRect(px + t - S*0.01, py + S - inset - S*0.06, S*0.02, S*0.02); }
      }
    });
  }

  // the basin: the stones you carry, heaped where the water should be. One fewer each time you put one down.
  if (startRoom) {
    const bx = ox + (startRoom.x0 + 3) * S + S/2, by = oy + (startRoom.y0 + 3) * S + S/2, r = S*0.3;
    const left = STONES.length - (SAVE.stones || 0) - (poolMode ? 1 : 0);
    ctx.fillStyle = C.wall; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = (left > 0 || (poolMode && keySpot)) ? '#2a2c2e' : '#3d4a52'; ctx.beginPath(); ctx.arc(bx, by, r*0.82, 0, Math.PI*2); ctx.fill();   // water shows once the stones are gone
    if (!left) { ctx.strokeStyle = '#6f8893'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, r*0.45, 0, Math.PI*2); ctx.stroke(); }
    const pos = [[0,0],[-.3,-.22],[.3,-.2],[-.28,.24],[.3,.25],[0,-.42],[0,.42]];
    ctx.fillStyle = '#8a857a';
    for (let i = 0; i < left; i++) { const [px, py] = pos[i]; ctx.beginPath(); ctx.ellipse(bx + px*r, by + py*r, r*0.22, r*0.17, i*0.7, 0, Math.PI*2); ctx.fill(); }
  }

  // the name, set into the tile above the mat: architectural capitals in chalk white
  if (startRoom && (!started || intro)) {
    const fadeT = intro ? nameFade((performance.now() - intro.t0) / 1000) : 1;
    const tx = startRoom.x0 + 2, ty = startRoom.y0 + 1, px = ox + tx*S + S/2, py = oy + ty*S + S/2;
    ctx.save(); ctx.globalAlpha = fadeT; ctx.fillStyle = C.mark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `500 ${S*0.13}px Futura, "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif`; ctx.fillText('T H E', px, py - S*0.26);
    ctx.font = `700 ${S*0.34}px Futura, "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif`; ctx.fillText('M A Z E', px, py + S*0.06);
    ctx.restore();
  }

  // the chapter, set into the floor below him like the name is set into the floor above. Joe:
  // "I'm fine if the fog of war eats the bottom of it, that would actually look kind of cool" —
  // so it is drawn here, under the darkness pass, and held a beat longer than the name on the way
  // out so you can still read it while the camera pulls back.
  if (startRoom && !poolMode && !protoMode && (!started || intro)) {
    const fadeC = intro ? chapterFade((performance.now() - intro.t0) / 1000) : 1;
    if (fadeC > 0) {
      const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      const sp = (t) => t.split('').join(' ');   // the name's own way of tracking letters out
      const cx = ox + (startRoom.x0 + 2)*S + S/2, cy = oy + (start.y + CONFIG.chapterDrop)*S;
      ctx.save(); ctx.fillStyle = C.mark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = fadeC * 0.55;
      ctx.font = `500 ${S*0.08}px Futura, "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif`;
      ctx.fillText(sp('Chapter ' + (roman[SAVE.phase || 0] || (SAVE.phase + 1))), cx, cy);
      ctx.globalAlpha = fadeC;
      ctx.font = `700 ${S*0.18}px Futura, "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif`;
      ctx.fillText(sp(phase().who), cx, cy + S*0.17);
      ctx.restore();
    }
  }
  if (!started && !intro) {   // asleep: a slow breath of light around the mat
    const glow = 0.5 + 0.5 * Math.sin(performance.now() / 900), px = ox + player.x*S, py = oy + player.y*S;
    ctx.fillStyle = CONFIG.hintColor; ctx.globalAlpha = 0.05 + 0.09 * glow; ctx.beginPath(); ctx.arc(px, py, S*0.7, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  }

  // squeezes, gaps and between-cells alike: one arm of floor toward each side you can actually
  // pass to, so the drawing never promises a way that isn't there and never hides one that is
  for (const k of crawlGaps) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue;
    drawSqueeze(ox + mx*S, oy + my*S, S, mx, my, !!phase().f.crawl); }
  if (phase().f.crawl) for (const k of crawlCells) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue;
    drawSqueeze(ox + mx*S, oy + my*S, S, mx, my, true); }
  // Landmarks: what is in a room, filling the room. Joe: "imagine the spiral covering the whole
  // floor rather than just one part of it... the pool takes up the whole room. Or there's a giant
  // ball pit in one." One to a section and never the same as a neighbour's — this is what you
  // navigate by, and it has to be a place, not an ornament on one tile of it.
  for (const L of landmarks) {
    const rx0 = L.rx0 ?? L.x, ry0 = L.ry0 ?? L.y, rx1 = L.rx1 ?? L.x, ry1 = L.ry1 ?? L.y;
    if (rx1 < x0_ - 1 || rx0 > x1_ + 1 || ry1 < y0_ - 1 || ry0 > y1_ + 1) continue;
    const x = ox + rx0 * S, y = oy + ry0 * S, w = (rx1 - rx0 + 1) * S, h = (ry1 - ry0 + 1) * S;
    const cx = x + w / 2, cy = y + h / 2, rad = Math.min(w, h) / 2;
    ctx.save();
    if (L.kind === 'pool') {                       // the room is a pool, with a rim you walk round
      const r2 = rad * 0.80;
      ctx.fillStyle = C.grout; ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2a2c2e'; ctx.beginPath(); ctx.arc(cx, cy, r2 * 0.88, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3d4a52'; ctx.beginPath(); ctx.arc(cx, cy, r2 * 0.80, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#6f8893'; ctx.lineWidth = Math.max(1, S * 0.03);
      for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 0.42 - i * 0.09;
        ctx.beginPath(); ctx.arc(cx, cy, r2 * (0.16 + i * 0.19), 0, Math.PI*2); ctx.stroke(); }
    } else if (L.kind === 'statues') {             // six of them, round the room, looking in
      ctx.strokeStyle = C.grout; ctx.lineWidth = Math.max(1, S * 0.04);
      ctx.beginPath(); ctx.arc(cx, cy, rad * 0.62, 0, Math.PI*2); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.26;
        const sx = cx + Math.cos(a) * rad * 0.68, sy = cy + Math.sin(a) * rad * 0.68;
        ctx.fillStyle = C.wall; ctx.beginPath(); ctx.ellipse(sx, sy, S * 0.25, S * 0.3, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = C.shelf; ctx.beginPath(); ctx.ellipse(sx, sy - S * 0.04, S * 0.16, S * 0.22, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = C.wall; ctx.beginPath(); ctx.arc(sx, sy - S * 0.16, S * 0.07, 0, Math.PI*2); ctx.fill(); }
    } else if (L.kind === 'spiral') {              // drawn across the whole floor
      ctx.strokeStyle = C.mark; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(1.5, S * 0.09); ctx.lineCap = 'round';
      ctx.beginPath();
      const turns = Math.PI * 9;
      for (let t = 0; t <= turns; t += 0.1) { const rr = S * 0.12 + (t / turns) * (rad * 0.86 - S * 0.12);
        const gx = cx + Math.cos(t) * rr, gy = cy + Math.sin(t) * rr; t ? ctx.lineTo(gx, gy) : ctx.moveTo(gx, gy); }
      ctx.stroke();
    } else if (L.kind === 'columns') {             // four of them, well in from the corners
      const d = rad * 0.60;
      ctx.strokeStyle = C.grout; ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.strokeRect(cx - d, cy - d, d * 2, d * 2);
      for (const [ox2, oy2] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const sx = cx + ox2 * d, sy = cy + oy2 * d;
        ctx.fillStyle = C.wall; ctx.fillRect(sx - S*0.3, sy - S*0.3, S*0.6, S*0.6);
        ctx.fillStyle = C.shelf; ctx.globalAlpha = 0.55; ctx.fillRect(sx - S*0.19, sy - S*0.19, S*0.38, S*0.38); ctx.globalAlpha = 1; }
    } else if (L.kind === 'dais') {                // a platform, stepped, filling the middle
      const steps = [[0.86, C.grout], [0.70, C.floor], [0.54, '#7d786d'], [0.38, C.shelf]];
      steps.forEach(([k, col], i) => { ctx.fillStyle = col; ctx.globalAlpha = i === 3 ? 0.55 : 1;
        ctx.fillRect(cx - rad*k, cy - rad*k, rad*k*2, rad*k*2); });
      ctx.globalAlpha = 1;
    } else if (L.kind === 'well') {                // a mouth in the floor, and flagstones round it
      ctx.strokeStyle = C.grout; ctx.lineWidth = Math.max(1, S * 0.05);
      ctx.beginPath(); ctx.arc(cx, cy, rad * 0.82, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = C.wall; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.54, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.38, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = C.shelf; ctx.lineWidth = Math.max(1.5, S * 0.07); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - rad*0.6, cy - rad*0.5); ctx.lineTo(cx + rad*0.6, cy - rad*0.5); ctx.stroke();
    } else if (L.kind === 'balls') {               // a pit of them, all over the floor
      ctx.fillStyle = C.grout; ctx.fillRect(x + S*0.35, y + S*0.35, w - S*0.7, h - S*0.7);
      ctx.fillStyle = C.bg; ctx.fillRect(x + S*0.5, y + S*0.5, w - S, h - S);
      for (let i = 0; i < 46; i++) {
        const a = tileNoise(rx0 + i, ry0, 91 + i), b2 = tileNoise(rx0, ry0 + i, 113 + i), c2 = tileNoise(rx0 + i, ry0 + i, 137);
        const bx = x + S*0.6 + a * (w - S*1.2), by = y + S*0.6 + b2 * (h - S*1.2), br = S * (0.11 + c2 * 0.1);
        ctx.fillStyle = c2 > 0.66 ? C.shelf : c2 > 0.33 ? '#7d786d' : C.floor;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = C.grout; ctx.lineWidth = Math.max(0.6, S*0.012); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // tic-tac-toe, chalked on the floor. Your own chalk X on its tile is the move that wins it
  if (ticTacToe) { const [px, py] = T(ticTacToe.x, ticTacToe.y);
    drawTicTacToe(px, py, S, ticTacToe.cells, marks.get(ticTacToe.x + ',' + ticTacToe.y) === 'x'); }
  // hopscotch: one court chalked down the corridor, not a box per tile. The cells touch, the way
  // a kid draws them, so the numbers sit close together instead of one big square per tile with a
  // gap between each. Small numbers, wobbly lines, no typeface.
  if (hopscotch.length) {
    const first = hopscotch[0].split(',').map(Number), second = (hopscotch[1] || hopscotch[0]).split(',').map(Number);
    const horiz = second[0] !== first[0], hw = S * 0.22;
    ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = C.mark; ctx.lineWidth = Math.max(1, S * 0.024);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const j = S * 0.05;
    hopscotch.forEach((k, i) => {
      const [mx, my] = k.split(',').map(Number), [px, py] = T(mx, my), half = S / 2;
      ctx.beginPath();
      if (horiz) {
        chalkLine(px - half, py - hw, px + half, py - hw, j, mx, my, 61);   // the two rails
        chalkLine(px - half, py + hw, px + half, py + hw, j, mx, my, 67);
        chalkLine(px - half, py - hw, px - half, py + hw, j, mx, my, 71);   // the line off the cell before
        if (i === hopscotch.length - 1) chalkLine(px + half, py - hw, px + half, py + hw, j, mx, my, 73);
      } else {
        chalkLine(px - hw, py - half, px - hw, py + half, j, mx, my, 61);
        chalkLine(px + hw, py - half, px + hw, py + half, j, mx, my, 67);
        chalkLine(px - hw, py - half, px + hw, py - half, j, mx, my, 71);
        if (i === hopscotch.length - 1) chalkLine(px - hw, py + half, px + hw, py + half, j, mx, my, 73);
      }
      ctx.stroke();
      chalkDigit(i + 1, px, py, S * 0.26, mx, my, 79);
    });
    ctx.restore();
  }
  // sliding tile in flight
  if (sliding) { let fx = player.x, fy = player.y;
    if (sliding.carry === false) { const k = Math.min(1, (nowMs - sliding.t0) / sliding.dur), e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2; fx = sliding.from[0] + 0.5 + (sliding.to[0] - sliding.from[0]) * e; fy = sliding.from[1] + 0.5 + (sliding.to[1] - sliding.from[1]) * e; }
    ctx.fillStyle = C.floor; ctx.fillRect(ox + (fx-0.5)*S, oy + (fy-0.5)*S, S+0.5, S+0.5); }
  for (const sl of sliders) {
    if (sl.auto || (sliding && sliding.sl === sl)) continue;
    const [tx, ty] = blockAt(sl);
    const px = ox + tx*S, py = oy + ty*S, ways = blockWays(sl);
    blockSlivers(px, py, S, ways);
    // hint: the first slider glints if you've been standing still and haven't pushed it yet.
    // Only the first — every block after it the player has to read for himself.
    if (sl.atStart && !firstPushDone && started && !solved && nowMs - idleSince > CONFIG.hintIdleSec * 1000 && Math.hypot(tx + 0.5 - player.x, ty + 0.5 - player.y) < B.viewRadius() * 2 + 1) {
      const t = (nowMs - idleSince - CONFIG.hintIdleSec * 1000) / 1000;
      const a = Math.min(1, t / 1.5) * (0.3 + 0.25 * Math.sin(t * 2.2));
      ctx.save(); ctx.globalAlpha = a; blockSlivers(px, py, S, ways, CONFIG.hintColor); ctx.restore();
    }
  }

  // The pool level's gate. Two leaves that swing apart down the middle and lie back against the
  // walls of the hall — and stay there, because a gate you shoved open does not vanish. It sits a
  // little back from the room's wall rather than flush with it, so it reads as a thing standing in
  // the doorway rather than as part of the wall.
  if (poolDoor) {
    const open = poolDoor.openAt ? Math.min(1, (nowMs - poolDoor.openAt) / (CONFIG.poolDoorSeconds * 1000)) : 0;
    const [px, py] = T(poolDoor.x, poolDoor.y), horiz = isOpen(poolDoor.x-1, poolDoor.y) && isOpen(poolDoor.x+1, poolDoor.y);
    const inRoom = (x, y) => !!startRoom && x >= startRoom.x0 && x <= startRoom.x1 && y >= startRoom.y0 && y <= startRoom.y1;
    const toRoom = horiz ? (inRoom(poolDoor.x - 1, poolDoor.y) ? -1 : inRoom(poolDoor.x + 1, poolDoor.y) ? 1 : 0)
                         : (inRoom(poolDoor.x, poolDoor.y - 1) ? -1 : inRoom(poolDoor.x, poolDoor.y + 1) ? 1 : 0);
    const gx = horiz ? px + toRoom * S * CONFIG.poolGateInset : px, gy = horiz ? py : py + toRoom * S * CONFIG.poolGateInset;
    const len = S / 2, th = Math.max(2, S * 0.1), ease = 1 - Math.pow(1 - open, 3);
    const leaf = (hx, hy, shut, swing) => {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(shut + swing * ease * Math.PI / 2);
      ctx.fillStyle = C.poolGate;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, -th / 2, len, th, th / 2); else ctx.rect(0, -th / 2, len, th);
      ctx.fill();
      ctx.restore();
    };
    if (horiz) { leaf(gx, py - S / 2, Math.PI / 2, toRoom); leaf(gx, py + S / 2, -Math.PI / 2, -toRoom); }
    else { leaf(px - S / 2, gy, 0, -toRoom); leaf(px + S / 2, gy, Math.PI, toRoom); }
    // the stone it wants, on the seam. It goes with the seam as the leaves part
    if (open < 0.3) { ctx.save(); ctx.globalAlpha = 1 - open / 0.3;
      drawStone(ctx, gx, gy, S * 0.17, C.poolGate); ctx.restore(); }
  }

  // start & exit (+ gate)
  { const mx = ox + (start.x-0.5)*S, my = oy + (start.y-0.5)*S;   // a thin sleeping mat, with a slightly lighter fold at the head
    ctx.fillStyle = C.start; ctx.fillRect(mx + S*0.24, my + S*0.10, S*0.52, S*0.80);
    ctx.fillStyle = C.grout; ctx.fillRect(mx + S*0.32, my + S*0.15, S*0.36, S*0.13); }   // pillow at the top
  { const [ex, ey] = T(exit.x, exit.y);
    ctx.fillStyle = poolMode ? '#6f8893' : C.exit; ctx.beginPath(); ctx.arc(ex, ey, S*0.22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = poolMode ? '#3d4a52' : C.wall; ctx.beginPath(); ctx.arc(ex, ey, S*0.1, 0, Math.PI*2); ctx.fill();
    if (gated && !solved && !poolMode) {   // bars stay up until you reach them with the key
      ctx.strokeStyle = C.gate; ctx.lineWidth = Math.max(2, S*0.07); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = -1; i <= 1; i++) { ctx.moveTo(ex + i*S*0.26, ey - S*0.42); ctx.lineTo(ex + i*S*0.26, ey + S*0.42); }
      ctx.moveTo(ex - S*0.4, ey - S*0.1); ctx.lineTo(ex + S*0.4, ey - S*0.1); ctx.stroke();
    }
  }

  // debug/timed path (under fog)
  if ((opt.path.checked || pathUntil > nowMs) && solutionPath.length) {
    const fade = opt.path.checked ? 1 : Math.min(1, (pathUntil - nowMs) / (B.pathSec() * 1000));   // bright when found, gone when spent
    ctx.strokeStyle = C.path; ctx.lineWidth = Math.max(2, S*0.12); ctx.lineJoin = 'round'; ctx.globalAlpha = 0.9 * fade; ctx.beginPath();
    solutionPath.forEach(([x,y], i) => { const [px, py] = T(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // chalk pickups
  ctx.fillStyle = C.chalk;
  for (const k of chalkSpots) { const [mx, my] = k.split(',').map(Number); const [px, py] = T(mx, my);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.6); ctx.fillRect(-S*0.18, -S*0.055, S*0.36, S*0.11); ctx.restore(); }
  // charcoal pickups: a dark stub with a lighter edge
  for (const k of charcoalSpots) { const [mx, my] = k.split(',').map(Number); const [px, py] = T(mx, my);
    ctx.save(); ctx.translate(px, py); ctx.rotate(0.5); ctx.fillStyle = C.charcoal; ctx.fillRect(-S*0.16, -S*0.07, S*0.32, S*0.14); ctx.strokeStyle = C.exit; ctx.lineWidth = 1; ctx.strokeRect(-S*0.16, -S*0.07, S*0.32, S*0.14); ctx.restore(); }
  // pointer / path pickups
  for (const [k, kind] of pickups) {
    const [mx, my] = k.split(',').map(Number); const [px, py] = T(mx, my);
    if (kind === 'pointer') { ctx.fillStyle = C.pointerPickup; ctx.beginPath(); ctx.moveTo(px, py - S*0.2); ctx.lineTo(px + S*0.1, py + S*0.14); ctx.lineTo(px, py + S*0.06); ctx.lineTo(px - S*0.1, py + S*0.14); ctx.closePath(); ctx.fill(); }
    else { ctx.strokeStyle = C.pathPickup; ctx.lineWidth = Math.max(1.5, S*0.05); ctx.beginPath();
      for (let i=0; i<=40; i++) { const t = i/40, a = t*Math.PI*5, r = S*0.05 + t*S*0.14; const x = px + Math.cos(a)*r, y = py + Math.sin(a)*r; i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); } ctx.stroke(); }
  }
  // journals: a small open book, breathing on the spot so a page reads as something waiting
  for (const k of journals.keys()) { const [mx, my] = k.split(',').map(Number); const [px, py0] = T(mx, my);
    const py = py0 - Math.sin(nowMs / (CONFIG.journalFloatSec * 1000) * Math.PI * 2 + (mx * 7 + my * 13)) * S * CONFIG.journalFloat;
    ctx.fillStyle = C.journal; ctx.beginPath(); ctx.moveTo(px - S*0.22, py - S*0.14); ctx.lineTo(px, py - S*0.08); ctx.lineTo(px + S*0.22, py - S*0.14); ctx.lineTo(px + S*0.22, py + S*0.14); ctx.lineTo(px, py + S*0.2); ctx.lineTo(px - S*0.22, py + S*0.14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.wall; ctx.lineWidth = Math.max(1, S*0.025); ctx.beginPath(); ctx.moveTo(px, py - S*0.08); ctx.lineTo(px, py + S*0.2); ctx.stroke(); }
  // map scraps: a torn corner of paper
  for (const k of scrapSpots) { const [mx, my] = k.split(',').map(Number); const [px, py] = T(mx, my);
    ctx.fillStyle = C.mapFloor; ctx.beginPath(); ctx.moveTo(px - S*0.2, py - S*0.16); ctx.lineTo(px + S*0.16, py - S*0.2); ctx.lineTo(px + S*0.2, py + S*0.12); ctx.lineTo(px + S*0.02, py + S*0.2); ctx.lineTo(px - S*0.18, py + S*0.14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.wall; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - S*0.1, py - S*0.04); ctx.lineTo(px + S*0.08, py - S*0.04); ctx.moveTo(px - S*0.06, py + S*0.06); ctx.lineTo(px + S*0.12, py + S*0.06); ctx.stroke(); }
  // the lamp
  if (lampSpot) { const [mx, my] = lampSpot.split(',').map(Number); const [px, py] = T(mx, my);
    ctx.strokeStyle = C.lamp; ctx.lineWidth = Math.max(1.2, S*0.035); ctx.lineJoin = 'round'; ctx.beginPath();
    const k = 0.75;
    ctx.moveTo(px - S*0.1*k, py - S*0.24*k); ctx.lineTo(px + S*0.1*k, py - S*0.24*k); ctx.lineTo(px + S*0.18*k, py - S*0.04*k); ctx.lineTo(px - S*0.18*k, py - S*0.04*k); ctx.closePath();
    ctx.moveTo(px - S*0.12*k, py - S*0.04*k); ctx.lineTo(px - S*0.08*k, py + S*0.1*k); ctx.lineTo(px + S*0.08*k, py + S*0.1*k); ctx.lineTo(px + S*0.12*k, py - S*0.04*k);
    ctx.moveTo(px - S*0.06*k, py + S*0.1*k); ctx.lineTo(px - S*0.08*k, py + S*0.24*k); ctx.lineTo(px + S*0.08*k, py + S*0.24*k); ctx.lineTo(px + S*0.06*k, py + S*0.1*k); ctx.stroke(); }
  // inner doors: bars across the passage with the lock's shape; shaped keys lying in dead ends
  for (const d of doors) { if (d.open) continue; const [px, py] = T(d.x, d.y), horiz = isOpen(d.x-1, d.y) && isOpen(d.x+1, d.y);
    ctx.strokeStyle = C.gate; ctx.lineWidth = Math.max(2, S*0.07); ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = -1; i <= 1; i++) { if (horiz) { ctx.moveTo(px, py + i*S*0.26); ctx.lineTo(px, py + i*S*0.26); ctx.moveTo(px - S*0.06, py + i*S*0.26); ctx.lineTo(px + S*0.06, py + i*S*0.26); } else { ctx.moveTo(px + i*S*0.26, py - S*0.06); ctx.lineTo(px + i*S*0.26, py + S*0.06); } }
    if (horiz) { ctx.moveTo(px, py - S*0.42); ctx.lineTo(px, py + S*0.42); } else { ctx.moveTo(px - S*0.42, py); ctx.lineTo(px + S*0.42, py); }
    ctx.stroke(); drawShape(ctx, d.shape, px, py, S*0.13, C.gate, Math.max(1.5, S*0.045)); }
  for (const [k, shape] of innerKeys) { const [mx, my] = k.split(',').map(Number); const [px, py] = T(mx, my);
    ctx.strokeStyle = C.key; ctx.lineWidth = Math.max(2, S*0.06); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px - S*0.02, py); ctx.lineTo(px + S*0.22, py); ctx.moveTo(px + S*0.12, py); ctx.lineTo(px + S*0.12, py + S*0.09); ctx.moveTo(px + S*0.2, py); ctx.lineTo(px + S*0.2, py + S*0.07); ctx.stroke();
    drawShape(ctx, shape, px - S*0.13, py, S*0.1, C.key, Math.max(2, S*0.06)); }
  // key (or, at a pool level, the stone)
  if (keySpot && poolMode) { const [mx, my] = keySpot.split(',').map(Number); const [px, py] = T(mx, my); ctx.fillStyle = '#8a857a'; ctx.beginPath(); ctx.ellipse(px, py + S*0.03, S*0.2, S*0.14, 0.3, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#a29d92'; ctx.beginPath(); ctx.ellipse(px - S*0.06, py - S*0.04, S*0.07, S*0.04, 0.3, 0, Math.PI*2); ctx.fill(); }
  else if (keySpot) { const [mx, my] = keySpot.split(',').map(Number); const [px, py] = T(mx, my);
    ctx.strokeStyle = C.key; ctx.lineWidth = Math.max(2, S*0.06); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(px - S*0.14, py, S*0.1, 0, Math.PI*2); ctx.moveTo(px - S*0.04, py); ctx.lineTo(px + S*0.22, py); ctx.moveTo(px + S*0.12, py); ctx.lineTo(px + S*0.12, py + S*0.09); ctx.moveTo(px + S*0.2, py); ctx.lineTo(px + S*0.2, py + S*0.07); ctx.stroke(); }

  // Someone else's chalk, all over the kid's room floor. Fainter than yours: it is old. A game
  // nobody finished, the word Dad?, a couple of balls, and x's — no arrows. Joe, on the arrows:
  // "it just looks like a code they will need to know."
  if (secretMarks.size) { ctx.save(); ctx.strokeStyle = C.mark; ctx.globalAlpha = 0.42;
    for (const [k, g] of secretMarks) { const [mx, my] = k.split(',').map(Number);
      if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue;
      const [px, py] = T(mx, my), lw = Math.max(1, S * 0.045);
      if (g === 'ttt') { ctx.save(); ctx.globalAlpha = 0.42;
        drawTicTacToe(px, py, S * 0.8, TTT_GAMES[tileNoise(mx, my, 83) * TTT_GAMES.length | 0], marks.get(k) === 'x');
        ctx.restore(); }
      else if (g === 'dad') drawChalkWord(ctx, 'Dad?', px, py, S * 0.3, lw);
      else if (g === 'ball') drawChalkBall(ctx, px, py, S * 0.15, lw);
      else drawGlyph(ctx, g, px, py, S*0.19, Math.max(1, S*0.055)); }
    ctx.restore(); }

  if (startArrow) { const [px, py] = T(startArrow.x, startArrow.y);
    ctx.save(); ctx.strokeStyle = C.mark; ctx.globalAlpha = 0.5;
    drawGlyph(ctx, startArrow.dir, px, py, S * 0.3, Math.max(1.5, S * 0.075)); ctx.restore(); }

  if (secretFather) { const [mx, my] = secretFather.split(',').map(Number);
    if (mx >= x0_ && mx <= x1_ && my >= y0_ && my <= y1_) { const [px, py] = T(mx, my);
      ctx.save(); ctx.strokeStyle = C.mark; ctx.globalAlpha = 0.5; drawChalkPair(ctx, px, py, S * 0.4, Math.max(1, S * 0.05)); ctx.restore(); } }

  // chalk marks (a mark on a sliding tile rides with it)
  ctx.strokeStyle = C.mark;
  for (const [k, g] of marks) {
    let [mx, my] = k.split(',').map(Number); let px, py;
    if (sliding && k === sliding.from.join(',')) { px = ox + player.x*S; py = oy + player.y*S; } else { [px, py] = T(mx, my); }
    drawGlyph(ctx, g, px, py, S*0.16, Math.max(1.5, S*0.05));
  }

  // tunnel roofs (over floor, marks and pickups; under the player)
  ctx.fillStyle = C.tunnel;
  for (const k of tunnelTiles) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue; ctx.fillRect(ox + mx*S, oy + my*S, S+0.5, S+0.5); }

  // The secret place is unlit. From outside all there is to see is the squeeze; inside, the
  // floor is painted back out and the only thing showing is the switch, until you stand on it
  // and the lights argue their way on over everything somebody drew in here.
  if (!debugMap && CONFIG.secretDark && secretTiles.size) {
    const secs = CONFIG.secretLightSec * 1000;
    let lit = 0;
    if (secretOn) { const k = Math.min(1, (nowMs - secretLitAt) / secs);
      lit = k >= 1 ? 1 : Math.max(0, Math.min(1, k * 1.25 + (Math.sin(k * 47) * Math.sin(k * 19) > 0.25 ? -0.75 : 0))); }
    if (lit < 1) {
      // the same colour as the walls, not black: painted-out floor should read as more wall,
      // not as a hole in the picture
      ctx.save(); ctx.fillStyle = C.wall; ctx.globalAlpha = 1 - lit;
      for (const k of secretTiles) { const [mx, my] = k.split(',').map(Number);
        if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue;
        ctx.fillRect(ox + mx*S, oy + my*S, S + 0.5, S + 0.5); }
      ctx.restore();
      // a little light in the floor, breathing — but only once you are actually inside. From the
      // squeeze there is nothing to see; you have to commit to the dark before it shows you anything
      const inside = secretTiles.has(Math.floor(player.x) + ',' + Math.floor(player.y));
      if (secretSwitch && !secretOn && inside) {
        const [bx, by] = secretSwitch.split(',').map(Number);
        if (bx >= x0_ && bx <= x1_ && by >= y0_ && by <= y1_) {
          const [px, py] = T(bx, by), pulse2 = 0.6 + 0.4 * Math.sin(nowMs / 620), rr = S * CONFIG.secretGlowTiles;
          const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
          g.addColorStop(0, `rgba(232,217,160,${(CONFIG.secretGlow * pulse2).toFixed(3)})`); g.addColorStop(1, 'rgba(232,217,160,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = C.lamp; ctx.globalAlpha = (0.35 + 0.5 * pulse2) * CONFIG.secretGlowCore;
          ctx.beginPath(); ctx.arc(px, py, S * 0.055, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
    }
  }

  // player: arrowhead, black nose; ghosted inside a tunnel
  { const px = ox + player.x*S, py = oy + player.y*S, r = CONFIG.playerSize * S * 0.62 * (phase().bodyScale || 1) * (inSqueeze ? CONFIG.squeezeShrink : 1);
    const inTunnel = tunnelTiles.has(Math.floor(player.x) + ',' + Math.floor(player.y));
    ctx.save(); ctx.translate(px, py); ctx.rotate(facingShown); ctx.globalAlpha = inTunnel ? 0.35 : 1;
    drawPlayerBody(ctx, r);
    ctx.restore(); }

  // darkness: dark tiles are painted out entirely, then the lamp cuts a cone and a foot-glow back in
  if (darkTiles.size && !debugMap) {
    if (!draw.dark) draw.dark = document.createElement('canvas');
    const dk = draw.dark; if (dk.width !== cv.width || dk.height !== cv.height) { dk.width = cv.width; dk.height = cv.height; }
    const d = dk.getContext('2d'); d.setTransform(dpr, 0, 0, dpr, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, vw, vh);
    const inDark = darkTiles.has(Math.floor(player.x) + ',' + Math.floor(player.y));
    const paintTile = (mx, my, alpha) => { d.globalAlpha = alpha; d.fillRect(ox + mx*S - 1, oy + my*S - 1, S + 2, S + 2);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) if (!isOpen(mx+dx, my+dy)) d.fillRect(ox + (mx+dx)*S - 1, oy + (my+dy)*S - 1, S + 2, S + 2); };
    d.fillStyle = C.bg;
    // the world dims as you go in: the far halls fade first, the tiles under you last
    d.globalAlpha = Math.pow(darkAmt, 1.6); d.fillRect(0, 0, vw, vh);
    if (darkAmt < 0.999) {
      for (const k of darkTiles) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ - 1 || mx > x1_ + 1 || my < y0_ - 1 || my > y1_ + 1) continue; paintTile(mx, my, 1); }
      for (const [k, level] of darkFringe) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ - 1 || mx > x1_ + 1 || my < y0_ - 1 || my > y1_ + 1) continue; paintTile(mx, my, level === 2 ? 0.72 : 0.42); }
    }
    d.globalAlpha = 1;
    if (hasLamp && lampOn) {
      const px = ox + player.x*S, py = oy + player.y*S, reach = CONFIG.coneTiles * S, half = CONFIG.coneDeg * Math.PI / 360;
      d.globalCompositeOperation = 'destination-out';
      const g = d.createRadialGradient(px, py, S*0.2, px, py, reach); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.75, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      // occluded cone: march rays through the tile grid and stop at the first wall (plus a sliver so the wall face shows)
      d.fillStyle = g; d.beginPath(); d.moveTo(px, py);
      const rays = 72, stepT = 0.08, maxT = CONFIG.coneTiles;
      for (let i = 0; i <= rays; i++) {
        const a = facingShown - half + (2 * half) * i / rays, ca = Math.cos(a), sa = Math.sin(a);
        let t = 0, hit = false;
        while (t < maxT) { const wx = player.x + ca * t, wy = player.y + sa * t; if (!isOpen(Math.floor(wx), Math.floor(wy))) { hit = true; break; } t += stepT; }
        const tt = hit ? Math.min(maxT, t + 0.22) : maxT;
        d.lineTo(px + ca * tt * S, py + sa * tt * S);
      }
      d.closePath(); d.fill();
      const f = d.createRadialGradient(px, py, 0, px, py, S*0.7); f.addColorStop(0, 'rgba(0,0,0,0.9)'); f.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = f; d.beginPath(); d.arc(px, py, S*0.7, 0, Math.PI*2); d.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dk, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // in the dark you can see yourself only by your own lamp
    if (!inDark || (hasLamp && lampOn)) { const px = ox + player.x*S, py = oy + player.y*S, r = CONFIG.playerSize * S * 0.62 * (phase().bodyScale || 1) * (inSqueeze ? CONFIG.squeezeShrink : 1);
      ctx.save(); ctx.translate(px, py); ctx.rotate(facingShown); ctx.globalAlpha = tunnelTiles.has(Math.floor(player.x) + ',' + Math.floor(player.y)) ? 0.35 : 1;
      drawPlayerBody(ctx, r); ctx.restore(); }
  }
  // lit lamp outside the dark: same reach, brighter floor
  if (hasLamp && lampOn && !debugMap) {
    const px = ox + player.x*S, py = oy + player.y*S, rr = B.viewRadius() * 2 * S;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(232,217,160,0.16)'); g.addColorStop(1, 'rgba(232,217,160,0)');
    ctx.fillStyle = g; ctx.fillRect(px - rr, py - rr, rr*2, rr*2);
  }

  // the father: the same figure as you, full-sized, facing away — under the fog like everything else
  for (const f of figures) { if (f.gone || f.hidden) continue; const px = ox + f.x*S, py = oy + f.y*S, r = CONFIG.playerSize * S * 0.62 * 1.1;
    if (px < -S || px > vw + S || py < -S || py > vh + S) continue;
    const ang = Math.atan2(f.y - player.y, f.x - player.x);
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.globalAlpha = f.alpha * 0.9;
    ctx.fillStyle = '#cfcabd'; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r*0.8, -r*0.75); ctx.lineTo(-r*0.45, 0); ctx.lineTo(-r*0.8, r*0.75); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.wall; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r*0.3, -r*0.29); ctx.lineTo(r*0.3, r*0.29); ctx.closePath(); ctx.fill();
    ctx.restore(); }

  if (!debugMap && (SAVE.ui.texture || 'off') === 'damp') drawDamp(S, ox, oy, vw, vh);

  // Grain and Dust go UNDER the fog, not over it. Over the top they carried on across the black
  // surround and the empty space below the maze, which reads as dirt on the screen rather than
  // anything in the room. Under it, the fog puts them out exactly where it puts everything else.
  if (!debugMap) {
    const tex = SAVE.ui.texture || 'off';
    if (tex === 'grain') drawGrain(vw, vh, nowMs);
    else if (tex === 'dust') drawDust(vw, vh, Math.min(0.05, (nowMs - (draw.lastMs || nowMs)) / 1000), S, ox, oy, x0_, x1_, y0_, y1_);
  }
  draw.lastMs = nowMs;

  // fog
  if (!debugMap) {
    const px = ox + player.x*S, py = oy + player.y*S;
    const shrink = 1 - 0.55 * darkAmt;
    const inner = B.viewRadius() * 2 * S * shrink, outer = inner + CONFIG.fogSoftness * S * shrink;
    const g = ctx.createRadialGradient(px, py, inner, px, py, outer);
    g.addColorStop(0, 'rgba(13,15,16,0)'); g.addColorStop(1, 'rgba(13,15,16,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }

  // your chalk used to show through the fog — a beacon you left yourself. It gave away
  // corridors you had not lit, so it is off by default; CONFIG.markGhostAlpha brings it back.
  if (!debugMap && CONFIG.markGhostAlpha > 0) { ctx.strokeStyle = C.mark; ctx.globalAlpha = CONFIG.markGhostAlpha;
    for (const [k, g] of marks) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue; const [px, py] = T(mx, my); if (Math.hypot(px - (ox + player.x*S), py - (oy + player.y*S)) < B.viewRadius() * 2 * S) continue; drawGlyph(ctx, g, px, py, S*0.16, Math.max(1.5, S*0.05)); }
    ctx.globalAlpha = 1; }
  // pointer arrow (over fog)
  if ((opt.arrow.checked || pointerUntil > nowMs) && !solved) {
    const ang = Math.atan2(exit.y + 0.5 - player.y, exit.x + 0.5 - player.x);
    const px = ox + player.x*S, py = oy + player.y*S, d = S*0.75;
    ctx.save(); ctx.translate(px + Math.cos(ang)*d, py + Math.sin(ang)*d); ctx.rotate(ang);
    ctx.fillStyle = C.arrow; ctx.beginPath(); ctx.moveTo(S*0.22, 0); ctx.lineTo(-S*0.12, -S*0.14); ctx.lineTo(-S*0.05, 0); ctx.lineTo(-S*0.12, S*0.14); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

