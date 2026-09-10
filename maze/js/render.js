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
  const f = SAVE.ui.floor || 'off';
  if (f === 'off') return;
  const all = f === 'all';
  if ((all || f === 'worn') && CONFIG.floorWorn > 0) drawWorn(S, ox, oy, x0_, x1_, y0_, y1_);
  if ((all || f === 'lights') && CONFIG.floorLights > 0) drawLights(S, ox, oy, vw, vh, nowMs);
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
function drawDust(vw, vh, dt) {
  if (!motes) { motes = []; for (let i = 0; i < CONFIG.textureMotes; i++) motes.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.012, vy: -0.004 - Math.random() * 0.012, r: 0.6 + Math.random() * 1.7, a: 0.1 + Math.random() * 0.4 }); }
  ctx.save(); ctx.fillStyle = '#ece7da';
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
function drawPlayerBody(c, r) {
  const C = CONFIG.colors, n = STONES.length;
  c.beginPath(); c.moveTo(r, 0); c.lineTo(-r*0.8, -r*0.75); c.lineTo(-r*0.45, 0); c.lineTo(-r*0.8, r*0.75); c.closePath();
  c.save(); c.clip();
  const x0 = -r*0.8, span = r*1.8;
  for (let i = 0; i < n; i++) { c.fillStyle = has(i) ? C.player : C.playerBurdened; c.fillRect(x0 + span*i/n - 0.5, -r*1.1, span/n + 1, r*2.2); }
  c.restore();
  if (CONFIG.playerOutline > 0) { c.strokeStyle = C.player; c.lineWidth = r * CONFIG.playerOutline; c.lineJoin = 'round'; c.stroke(); }
}

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
    const fadeT = intro ? Math.max(0, 1 - (performance.now() - intro.t0) / 900) : 1;
    const tx = startRoom.x0 + 2, ty = startRoom.y0 + 1, px = ox + tx*S + S/2, py = oy + ty*S + S/2;
    ctx.save(); ctx.globalAlpha = fadeT; ctx.fillStyle = C.mark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `500 ${S*0.13}px Futura, "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif`; ctx.fillText('T H E', px, py - S*0.26);
    ctx.font = `700 ${S*0.34}px Futura, "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif`; ctx.fillText('M A Z E', px, py + S*0.06);
    ctx.restore();
  }
  if (!started && !intro) {   // asleep: a slow breath of light around the mat
    const glow = 0.5 + 0.5 * Math.sin(performance.now() / 900), px = ox + player.x*S, py = oy + player.y*S;
    ctx.fillStyle = CONFIG.hintColor; ctx.globalAlpha = 0.05 + 0.09 * glow; ctx.beginPath(); ctx.arc(px, py, S*0.7, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  }

  // crawl gaps: the wall tile stays wall-coloured, with a narrow strip of floor squeezed through the middle
  for (const k of crawlGaps) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue;
    const px = ox + mx*S, py = oy + my*S, horiz = isOpen(mx-1, my) && isOpen(mx+1, my), open = phase().f.crawl, w = 0.28;
    ctx.fillStyle = C.wall; ctx.fillRect(px, py, S+0.5, S+0.5);
    ctx.fillStyle = open ? C.floor : '#151819';
    if (horiz) ctx.fillRect(px, py + S*(0.5 - w/2), S+0.5, S*w); else ctx.fillRect(px + S*(0.5 - w/2), py, S*w, S+0.5);
    if (open) { ctx.fillStyle = C.thick; if (horiz) { ctx.fillRect(px, py + S*(0.5 - w/2) - 1, S+0.5, 1.5); ctx.fillRect(px, py + S*(0.5 + w/2) - 0.5, S+0.5, 1.5); } else { ctx.fillRect(px + S*(0.5 - w/2) - 1, py, 1.5, S+0.5); ctx.fillRect(px + S*(0.5 + w/2) - 0.5, py, 1.5, S+0.5); } } }
  // between-cells of a multi-section squeeze: wall-coloured, with strips running to each of its gaps
  if (phase().f.crawl) for (const k of crawlCells) { const [mx, my] = k.split(',').map(Number); if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue;
    const px = ox + mx*S, py = oy + my*S, w = 0.28, lo = 0.5 - w/2, hi = 0.5 + w/2;
    ctx.fillStyle = C.wall; ctx.fillRect(px, py, S+0.5, S+0.5);
    ctx.fillStyle = C.floor; ctx.fillRect(px + S*lo, py + S*lo, S*w, S*w);   // the hub
    for (const [dx, dy] of DIRS) if (crawlGaps.has((mx+dx)+','+(my+dy)) || (isOpen(mx+dx, my+dy) && !crawlGaps.has((mx+dx)+','+(my+dy)) && !crawlCells.has((mx+dx)+','+(my+dy)))) {
      if (dx === 1) ctx.fillRect(px + S*hi, py + S*lo, S*(1-hi) + 0.5, S*w); else if (dx === -1) ctx.fillRect(px, py + S*lo, S*lo, S*w);
      else if (dy === 1) ctx.fillRect(px + S*lo, py + S*hi, S*w, S*(1-hi) + 0.5); else ctx.fillRect(px + S*lo, py, S*w, S*lo); } }
  // tic-tac-toe, chalked on the floor
  if (ticTacToe) { const [px, py] = T(ticTacToe.x, ticTacToe.y), g = S*0.26; ctx.save(); ctx.globalAlpha = 0.85;
    ctx.strokeStyle = C.mark; ctx.lineWidth = Math.max(1, S*0.03); ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(px - g/2, py - g*1.5); ctx.lineTo(px - g/2, py + g*1.5); ctx.moveTo(px + g/2, py - g*1.5); ctx.lineTo(px + g/2, py + g*1.5);
    ctx.moveTo(px - g*1.5, py - g/2); ctx.lineTo(px + g*1.5, py - g/2); ctx.moveTo(px - g*1.5, py + g/2); ctx.lineTo(px + g*1.5, py + g/2); ctx.stroke();
    ticTacToe.cells.forEach((c, i) => { const cx = px + ((i % 3) - 1) * g, cy = py + (Math.floor(i / 3) - 1) * g, a = g*0.28; ctx.lineWidth = Math.max(1.2, S*0.035); ctx.beginPath();
      if (c === 'x') { ctx.moveTo(cx-a, cy-a); ctx.lineTo(cx+a, cy+a); ctx.moveTo(cx+a, cy-a); ctx.lineTo(cx-a, cy+a); } else if (c === 'o') ctx.arc(cx, cy, a, 0, Math.PI*2); ctx.stroke(); });
    ctx.restore(); }
  // hopscotch: chalk numbers down the corridor
  if (hopscotch.length) { ctx.fillStyle = C.mark; ctx.globalAlpha = 0.85; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${S*0.34}px "Iowan Old Style", Palatino, Georgia, serif`;
    hopscotch.forEach((k, i) => { const [mx, my] = k.split(',').map(Number); const [px, py] = T(mx, my); ctx.strokeStyle = C.mark; ctx.lineWidth = 1; ctx.strokeRect(px - S*0.3, py - S*0.3, S*0.6, S*0.6); ctx.fillText(String(i + 1), px, py + 1); });
    ctx.globalAlpha = 1; }
  // sliding tile in flight
  if (sliding) { let fx = player.x, fy = player.y;
    if (sliding.carry === false) { const k = Math.min(1, (nowMs - sliding.t0) / sliding.dur), e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2; fx = sliding.from[0] + 0.5 + (sliding.to[0] - sliding.from[0]) * e; fy = sliding.from[1] + 0.5 + (sliding.to[1] - sliding.from[1]) * e; }
    ctx.fillStyle = C.floor; ctx.fillRect(ox + (fx-0.5)*S, oy + (fy-0.5)*S, S+0.5, S+0.5); }
  // thick wall on the pushable side of each slider
  ctx.fillStyle = C.thick;
  for (const sl of sliders) {
    if (sl.auto || (sliding && sliding.sl === sl)) continue;
    const tx = sl.shifted ? sl.x + sl.dx : sl.x, ty = sl.shifted ? sl.y + sl.dy : sl.y;
    const dx = sl.shifted ? -sl.dx : sl.dx, dy = sl.shifted ? -sl.dy : sl.dy, w = S*0.08;
    const px = ox + tx*S, py = oy + ty*S;
    if (dx === 1) ctx.fillRect(px + S - w, py, w, S); else if (dx === -1) ctx.fillRect(px, py, w, S);
    else if (dy === 1) ctx.fillRect(px, py + S - w, S, w); else ctx.fillRect(px, py, S, w);
    // hint: the first slider glints if you've been standing still and haven't pushed it yet
    if (sl.atStart && !firstPushDone && started && !solved && nowMs - idleSince > CONFIG.hintIdleSec * 1000 && Math.hypot(tx + 0.5 - player.x, ty + 0.5 - player.y) < B.viewRadius() * 2 + 1) {
      const t = (nowMs - idleSince - CONFIG.hintIdleSec * 1000) / 1000;
      const a = Math.min(1, t / 1.5) * (0.22 + 0.18 * Math.sin(t * 2.2));
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = CONFIG.hintColor;
      if (dx === 1) ctx.fillRect(px + S - w, py, w, S); else if (dx === -1) ctx.fillRect(px, py, w, S);
      else if (dy === 1) ctx.fillRect(px, py + S - w, S, w); else ctx.fillRect(px, py, S, w);
      ctx.restore(); ctx.fillStyle = C.thick;
    }
  }

  // the pool level's door: a grey panel filling the doorway, unlike the hairline edge of a push block
  // the pool level's door: the same barred gate as a locked door inside the maze, but what it
  // wants is not a shape. It is the stone, so the stone is what is drawn on it.
  if (poolDoor) { const open = poolDoor.openAt ? Math.min(1, (nowMs - poolDoor.openAt) / 650) : 0;
    if (open < 1) { const [px, py] = T(poolDoor.x, poolDoor.y), horiz = isOpen(poolDoor.x-1, poolDoor.y) && isOpen(poolDoor.x+1, poolDoor.y);
      const off = open * open * S;
      ctx.save(); ctx.beginPath(); ctx.rect(px - S/2, py - S/2, S, S); ctx.clip();
      ctx.translate(horiz ? off : 0, horiz ? 0 : off);
      ctx.strokeStyle = C.gate; ctx.lineWidth = Math.max(2, S*0.07); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = -1; i <= 1; i++) { if (horiz) { ctx.moveTo(px - S*0.06, py + i*S*0.26); ctx.lineTo(px + S*0.06, py + i*S*0.26); } else { ctx.moveTo(px + i*S*0.26, py - S*0.06); ctx.lineTo(px + i*S*0.26, py + S*0.06); } }
      if (horiz) { ctx.moveTo(px, py - S*0.42); ctx.lineTo(px, py + S*0.42); } else { ctx.moveTo(px - S*0.42, py); ctx.lineTo(px + S*0.42, py); }
      ctx.stroke(); drawStone(ctx, px, py, S*0.17, C.gate);
      ctx.restore(); } }

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

  // someone else's chalk, all over the secret room's floor. Fainter than yours: it is old.
  if (secretMarks.size) { ctx.save(); ctx.strokeStyle = C.mark; ctx.globalAlpha = 0.42;
    for (const [k, g] of secretMarks) { const [mx, my] = k.split(',').map(Number);
      if (mx < x0_ || mx > x1_ || my < y0_ || my > y1_) continue;
      const [px, py] = T(mx, my); drawGlyph(ctx, g, px, py, S*0.19, Math.max(1, S*0.055)); }
    ctx.restore(); }

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

  // player: arrowhead, black nose; ghosted inside a tunnel
  { const px = ox + player.x*S, py = oy + player.y*S, r = CONFIG.playerSize * S * 0.62 * (phase().bodyScale || 1);
    const inTunnel = tunnelTiles.has(Math.floor(player.x) + ',' + Math.floor(player.y));
    ctx.save(); ctx.translate(px, py); ctx.rotate(facingShown); ctx.globalAlpha = inTunnel ? 0.35 : inSqueeze ? 0.7 : 1;
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
    if (!inDark || (hasLamp && lampOn)) { const px = ox + player.x*S, py = oy + player.y*S, r = CONFIG.playerSize * S * 0.62 * (phase().bodyScale || 1);
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
    else if (tex === 'dust') drawDust(vw, vh, Math.min(0.05, (nowMs - (draw.lastMs || nowMs)) / 1000));
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

