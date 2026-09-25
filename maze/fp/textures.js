// The Maze, first person — the pixel art
//
// Every texture is drawn here, pixel by pixel, from a small fixed palette and its own seeded
// random stream, so the art is the same on every load and every phone. Nothing is an image file
// yet. Each texture is a plain { w, h, px: Uint32Array, glow?: Uint8Array } — swap any of them for
// hand-drawn art later by decoding a PNG into the same shape, and the renderer never knows.
//
// Pixels are packed the way ImageData wants them on every phone in use: 0xAABBGGRR.

const TEX = (() => {
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return 0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16); };
  const ramp = (list) => list.map(hex);

  // The palette. The stone is the top-down's own greys (#8a857a, #a29d92 are the stone icon's), taken
  // down into shadow; the sky is dusk, because a sky over a maze should look like it is running out.
  const STONE = ramp(['#1e1c1a', '#2b2926', '#3a3833', '#4a4740', '#5c5850', '#6f6a60', '#8a857a', '#a29d92']);
  const MORTAR = hex('#171614');
  const FLOOR = ramp(['#191816', '#24221f', '#2f2d29', '#3b3934', '#48453f', '#57534b', '#66615a']);
  const GROUT = hex('#121110');
  const MOSS = ramp(['#262d1c', '#34402a', '#475633', '#5d6e3e']);
  const WOOD = ramp(['#20160e', '#2e2116', '#3f2e1e', '#53402a', '#6b5436']);
  const LIGHT = ramp(['#6b5436', '#b89a5a', '#e0c98a', '#f3e6c0', '#fff8e6']);
  const SKY = ramp(['#07081a', '#0b0d1f', '#10142b', '#161c38', '#1f2748', '#2b3258', '#3b3c66', '#524674', '#6e5580', '#8c607f', '#aa6d7c', '#c47f78', '#d9967a']);

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clampI = (i, n) => Math.max(0, Math.min(n - 1, i));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  // a fractional palette position, dithered to one of its two neighbours — the only way a
  // 12-colour sky gets a smooth gradient and still reads as pixel art
  const dith = (pal, f, x, y) => pal[clampI(Math.floor(f + BAYER[(y & 3) * 4 + (x & 3)]), pal.length)];

  function blank(w, h) { return { w, h, px: new Uint32Array(w * h) }; }

  // ── walls ───────────────────────────────────────────────────
  // Four courses of brick, 16 wide, staggered. Each brick picks its own tone and gets a lit top
  // edge and a shadowed bottom, which is most of what makes a flat 32×32 read as stone.
  function bricks(seed) {
    const R = rng(seed), T = blank(32, 32), tone = {};
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const row = y >> 3, off = (row & 1) * 8, bx = ((x + off) & 31) >> 4, by = y & 7, lx = (x + off) & 15;
      if (by === 7 || lx === 15) { T.px[y * 32 + x] = MORTAR; continue; }
      const k = row * 2 + bx;
      if (tone[k] === undefined) tone[k] = 3 + Math.floor(R() * 3);
      let i = tone[k];
      if (by === 0) i += 1;
      if (by === 6 || lx === 14) i -= 1;
      if (lx === 0 && by < 6) i += R() < 0.5 ? 1 : 0;
      const n = R();
      if (n < 0.12) i -= 1; else if (n > 0.93) i += 1;
      T.px[y * 32 + x] = STONE[clampI(i, STONE.length)];
    }
    return T;
  }
  function cracked(seed) {
    const T = bricks(seed), R = rng(seed * 3 + 1);
    for (let c = 0; c < 2; c++) {
      let x = 6 + Math.floor(R() * 20), y = Math.floor(R() * 6);
      for (let n = 0; n < 18 + R() * 10; n++) {
        if (x < 0 || x > 31 || y > 31) break;
        T.px[y * 32 + x] = STONE[0];
        if (x + 1 < 32) T.px[y * 32 + x + 1] = STONE[2];
        y += 1; x += R() < 0.4 ? -1 : R() < 0.7 ? 1 : 0;
      }
    }
    return T;
  }
  function mossy(seed) {
    const T = bricks(seed), R = rng(seed * 5 + 2);
    for (let y = 14; y < 32; y++) for (let x = 0; x < 32; x++) {
      const p = ((y - 14) / 18) ** 1.6 * 0.85;
      if (R() < p) T.px[y * 32 + x] = MOSS[clampI(Math.floor(R() * 2 + (y > 26 ? 2 : 1)), MOSS.length)];
    }
    for (let d = 0; d < 5; d++) {   // drips, running down from the courses
      const x = Math.floor(R() * 32);
      for (let y = 4 + Math.floor(R() * 8); y < 20 + R() * 8; y++) T.px[y * 32 + x] = MOSS[1];
    }
    return T;
  }
  // The way out. An arch cut in the stone with light behind it. The light is flagged `glow`, so
  // fog never eats it: the far end of the right corridor is a warm spot in the dark before it is
  // anything else, which is the whole of the top-down's "the exit beckons" in one texture.
  function exitDoor() {
    const T = bricks(907); T.glow = new Uint8Array(32 * 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const dx = (x - 15.5) / 10, dy = (y - 13) / 13;
      const inArch = (y >= 13 && Math.abs(x - 15.5) < 10) || (y < 13 && dx * dx + dy * dy < 1);
      const inFrame = (y >= 11 && Math.abs(x - 15.5) < 12) || (y < 13 && (dx * 10 / 12) ** 2 + ((y - 13) / 15) ** 2 < 1);
      const i = y * 32 + x;
      if (inArch && y > 2) {
        const f = 4 - Math.hypot(x - 15.5, y - 24) / 5;   // brightest low in the doorway, like a sunset through it
        T.px[i] = dith(LIGHT, f, x, y); T.glow[i] = 1;
      } else if (inFrame) {
        T.px[i] = ((x + y) & 3) === 0 ? STONE[5] : STONE[6];
      }
    }
    return T;
  }

  // ── floor ───────────────────────────────────────────────────
  // Four flagstones to a tile, grout wandering a pixel either way so the grid does not show.
  function flags(seed) {
    const R = rng(seed), T = blank(32, 32), tone = [0, 1, 2, 3].map(() => 2 + Math.floor(R() * 3));
    const jx = [Math.floor(R() * 3) - 1, Math.floor(R() * 3) - 1], jy = [Math.floor(R() * 3) - 1, Math.floor(R() * 3) - 1];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const splitX = 15 + (y < 16 ? jx[0] : jx[1]), splitY = 15 + (x < 16 ? jy[0] : jy[1]);
      if (x === splitX || y === splitY || x === 31 || y === 31) { T.px[y * 32 + x] = GROUT; continue; }
      const q = (x > splitX ? 1 : 0) + (y > splitY ? 2 : 0);
      let i = tone[q];
      if (x === splitX + 1 || y === splitY + 1 || x === 0 || y === 0) i += 1;   // worn, rounded edges
      const n = R(); if (n < 0.14) i -= 1; else if (n > 0.95) i += 1;
      T.px[y * 32 + x] = FLOOR[clampI(i, FLOOR.length)];
    }
    return T;
  }
  function flagsWorn(seed) {
    const T = flags(seed), R = rng(seed + 77);
    for (let n = 0; n < 40; n++) { const x = Math.floor(R() * 32), y = Math.floor(R() * 32); if (T.px[y * 32 + x] !== GROUT) T.px[y * 32 + x] = FLOOR[1]; }
    for (let n = 0; n < 6; n++) { const x = Math.floor(R() * 30), y = Math.floor(R() * 30); T.px[y * 32 + x] = MOSS[0]; T.px[y * 32 + x + 1] = MOSS[1]; }
    return T;
  }

  // ── the timber over a crawl gap, and its underside ──────────
  function planks(seed) {
    const R = rng(seed), T = blank(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const board = x >> 3, lx = x & 7;
      if (lx === 7) { T.px[y * 32 + x] = WOOD[0]; continue; }
      let i = 2 + ((board * 7 + (y >> 2)) % 3 === 0 ? 1 : 0);
      if (lx === 0) i += 1;
      if (R() < 0.15) i -= 1;
      if ((y + board * 9) % 23 === 0 && lx > 1 && lx < 5) i = 0;   // a knot, a nail
      T.px[y * 32 + x] = WOOD[clampI(i, WOOD.length)];
    }
    return T;
  }

  // ── sky ─────────────────────────────────────────────────────
  // One panorama, wrapped all the way round. 1536 across keeps its pixels close to square at the
  // default field of view, so stars stay dots and don't smear into dashes.
  function sky() {
    const W = 1536, H = 96, T = blank(W, H), R = rng(4242);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f = (y / (H - 1)) ** 1.7 * (SKY.length - 1);
      T.px[y * W + x] = dith(SKY, f, x, y);
    }
    // clouds: long low bands, lit from below by whatever sun is left
    for (let c = 0; c < 14; c++) {
      const cx = R() * W, cy = 40 + R() * 38, rw = 30 + R() * 70, rh = 3 + R() * 5;
      for (let y = Math.floor(cy - rh * 2); y < cy + rh; y++) for (let dx = -rw * 1.2; dx < rw * 1.2; dx++) {
        const x = ((Math.floor(cx + dx) % W) + W) % W;
        const bump = Math.sin(dx * 0.19 + c) * 0.35 + Math.sin(dx * 0.07 + c * 2) * 0.4;
        const e = (dx / rw) ** 2 + ((y - cy) / (rh * (1.2 + bump))) ** 2;
        if (e < 1 && y >= 0 && y < H) {
          const under = (y - cy) / rh;   // lit at the bottom edge, dark at the top
          const base = 5 + (y / H) * 5;
          T.px[y * W + x] = dith(SKY, base + (under > 0.3 ? 1.5 : -1.2), x, y);
        }
      }
    }
    // stars, thick at the top and gone before the dusk band
    for (let n = 0; n < 520; n++) {
      const x = Math.floor(R() * W), y = Math.floor((R() ** 1.8) * 48);
      const b = R();
      T.px[y * W + x] = b > 0.9 ? hex('#fff8e6') : b > 0.6 ? hex('#c9c6d8') : hex('#6f6d8a');
      if (b > 0.985 && y > 1 && x > 1 && x < W - 2) {   // a few bright ones with a cross
        const d = hex('#8a88a6');
        T.px[(y - 1) * W + x] = d; T.px[(y + 1) * W + x] = d; T.px[y * W + x - 1] = d; T.px[y * W + x + 1] = d;
      }
    }
    // the moon, low and to one side
    const mx = 420, my = 22, mr = 8;
    for (let y = my - mr; y <= my + mr; y++) for (let x = mx - mr; x <= mx + mr; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d <= mr) {
        const crater = Math.hypot(x - mx - 3, y - my + 2) < 2.2 || Math.hypot(x - mx + 2, y - my - 3) < 1.6;
        const shade = (x - mx) - (y - my) > 6;
        T.px[y * W + x] = crater ? hex('#b9b4a8') : shade ? hex('#cfc8b6') : hex('#ece7da');
      } else if (d <= mr + 1.5) {
        T.px[y * W + x] = dith(SKY, 4.5, x, y);
      }
    }
    return T;
  }

  const t0 = performance.now();
  const out = {
    walls: [bricks(11), bricks(23), cracked(31), mossy(47), bricks(59), mossy(61)],
    floors: [flags(101), flags(103), flagsWorn(107), flags(109)],
    exit: exitDoor(),
    wood: planks(211),
    sky: sky(),
    palette: { STONE, FLOOR, SKY, LIGHT, hex },
  };
  out.buildMs = performance.now() - t0;
  return out;
})();
