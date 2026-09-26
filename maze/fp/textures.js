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

  // ══ bleached: Greek meets the back rooms ═══════════════════
  // Joe: "a more bleached tile … a liminal space like something from a back rooms style. Think
  // Greek meets liminal back room space." Lime plaster gone the colour of old paper, a meander
  // frieze running round every wall at the top, marble skirting, a water stain here and there,
  // pale travertine underfoot, and a sky that is only haze. The fog is white, not dark: far halls
  // don't fall into shadow, they wash out — which is most of what makes a place feel liminal.
  const PLASTER = ramp(['#8f8873', '#a59e88', '#b8b19b', '#c9c2ad', '#d7d1be', '#e2ddcc', '#ebe7da', '#f3f0e6']);
  const STAIN = ramp(['#a99a68', '#bcae7d', '#cbbf93', '#d6cca5']);
  const MARBLE = ramp(['#9f9b91', '#b7b3a9', '#cbc8bf', '#dcd9d1', '#e8e6df', '#f2f0ea', '#faf9f5']);
  const TRAV = ramp(['#978e79', '#ada48e', '#bfb7a1', '#cfc8b3', '#dbd5c3', '#e5e0d0', '#eeeadd']);
  const AEGEAN = ramp(['#0b2544', '#123a63', '#1a5283', '#2b6d9f', '#4f8dbb', '#86b3d3', '#c4dbe9', '#f4f6f2']);
  const HAZE = ramp(['#b9c0c2', '#c3c9c9', '#cdd1ce', '#d6d8d2', '#dedfd8', '#e5e3da', '#ebe8dd', '#f0ece0', '#f4f0e4']);

  // soft blotches: a few seeded sine fields summed, for plaster that isn't flat and isn't noisy
  function field(seed) {
    const R = rng(seed), waves = [0, 1, 2, 3].map(() => [R() * 6.28, R() * 6.28, 0.15 + R() * 0.35, 0.15 + R() * 0.35]);
    // integer multiples of 2π/32 so every field tiles seamlessly across wall faces
    return (x, y) => waves.reduce((a, [p, q, fx, fy], i) => a + Math.sin(x * Math.round(fx * 5) * Math.PI / 16 + p) * Math.cos(y * Math.round(fy * 5) * Math.PI / 16 + q) / (i + 1), 0);
  }
  // The meander: one 8×5 unit, repeated. Each spiral hands its baseline to the next.
  const KEY = ['######..', '#....#..', '#.##.#..', '#..#.#..', '####.###'];
  function plaster(seed, o = {}) {
    const R = rng(seed), T = blank(32, 32), F = field(seed);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      let f = 5.3 + F(x, y) * 0.55 + (R() - 0.5) * 0.5;
      if (o.frieze && y < 11) f += 0.3;   // the band the frieze sits in is kept cleaner
      T.px[y * 32 + x] = dith(PLASTER, f, x, y);
    }
    if (o.stain) {   // damp coming down from somewhere above: a tide line, and a few runs
      const cx = 4 + R() * 24, top = 13 + R() * 5;
      for (let y = Math.floor(top); y < 27; y++) for (let x = 0; x < 32; x++) {
        const d = Math.abs(x - cx) / (6 + (y - top) * 0.9 * o.stain);
        if (d < 1 && R() < 0.9 - d * 0.5) T.px[y * 32 + x] = dith(STAIN, 2.6 - d * 1.2 + (y - top) * 0.04, x, y);
      }
      for (let r = 0; r < 3; r++) { const x = Math.floor(cx + (R() - 0.5) * 10) & 31; for (let y = Math.floor(top) + 4; y < 27; y++) if (R() < 0.85) T.px[y * 32 + x] = STAIN[1]; }
    }
    if (o.crack) {
      let x = Math.floor(8 + R() * 16), y = 11;
      for (let n = 0; n < 16 && y < 27; n++) { T.px[y * 32 + x] = PLASTER[1]; if (x + 1 < 32) T.px[y * 32 + x + 1] = PLASTER[6]; y++; x = (x + (R() < 0.35 ? -1 : R() < 0.6 ? 1 : 0) + 32) & 31; }
    }
    // frieze: a rule, the key, a rule. Off by default now — Joe: "remove the swirls at the top of the
    // walls and the columns. I want it reminiscent of Greek, not totally Greek … 'sterile' and
    // 'pristine' that has shown some wear through the centuries."
    if (o.frieze) for (let x = 0; x < 32; x++) {
      T.px[1 * 32 + x] = PLASTER[3]; T.px[2 * 32 + x] = PLASTER[7];
      T.px[9 * 32 + x] = PLASTER[7]; T.px[10 * 32 + x] = PLASTER[3];
      for (let r = 0; r < 5; r++) if (KEY[r][x & 7] === '#') { T.px[(r + 3) * 32 + x] = PLASTER[2]; if (r + 4 < 9 && KEY[r + 1] && KEY[r + 1][x & 7] !== '#') T.px[(r + 4) * 32 + x] = PLASTER[6]; }
    }
    // skirting: marble, with a lit top edge and a shadow line where it meets the plaster
    for (let x = 0; x < 32; x++) {
      T.px[26 * 32 + x] = PLASTER[2];
      T.px[27 * 32 + x] = MARBLE[6];
      for (let y = 28; y < 32; y++) T.px[y * 32 + x] = dith(MARBLE, 4.2 - (y - 28) * 0.45 + (R() - 0.5) * 0.6, x, y);
    }
    // centuries: the skirting's top edge chipped, a scuff or two where things brushed past, and the
    // faintest hairline. Wear, not ruin — it should still read as clean
    if (o.wear) {
      for (let c = 0; c < 2 + o.wear * 2; c++) {
        const x = Math.floor(R() * 29), w = 1 + Math.floor(R() * 3);
        for (let i = 0; i < w; i++) { T.px[27 * 32 + x + i] = PLASTER[3]; if (R() < 0.6) T.px[28 * 32 + x + i] = MARBLE[2]; }
      }
      for (let c = 0; c < o.wear * 2; c++) {
        const x0 = Math.floor(R() * 26), y0 = 18 + Math.floor(R() * 7);
        for (let i = 0; i < 5; i++) if (R() < 0.7) T.px[(y0 + (i >> 2)) * 32 + x0 + i] = PLASTER[4];
      }
      let x = Math.floor(R() * 32), y = Math.floor(R() * 8);
      for (let n = 0; n < 7 + o.wear * 5 && y < 26; n++) { T.px[y * 32 + x] = PLASTER[4]; y++; x = (x + (R() < 0.3 ? -1 : R() < 0.55 ? 1 : 0) + 32) & 31; }
    }
    return T;
  }
  // ashlar: big pale blocks, veined, set with hairline joints
  function ashlar(seed) {
    const R = rng(seed), T = blank(32, 32), tone = {};
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const row = y >> 4, off = (row & 1) * 16, bx = ((x + off) & 31) >> 4, lx = (x + off) & 15, ly = y & 15;
      if (ly === 15 || lx === 15) { T.px[y * 32 + x] = MARBLE[1]; continue; }
      const k = row * 2 + bx; if (tone[k] === undefined) tone[k] = 3.6 + R() * 1.4;
      let f = tone[k] + (ly === 0 || lx === 0 ? 0.8 : 0) + (ly === 14 || lx === 14 ? -0.7 : 0) + (R() - 0.5) * 0.4;
      T.px[y * 32 + x] = dith(MARBLE, f, x, y);
    }
    for (let v = 0; v < 4; v++) {   // veins: slow diagonal walks
      let x = R() * 32, y = R() * 32; const dx = (R() - 0.5) * 1.4, dy = 0.6 + R() * 0.5;
      for (let n = 0; n < 26; n++) { const i = (Math.floor(y) & 31) * 32 + (Math.floor(x) & 31); if (T.px[i] !== MARBLE[1]) T.px[i] = MARBLE[R() < 0.5 ? 1 : 2]; x += dx + (R() - 0.5); y += dy; }
    }
    return T;
  }
  // a fluted pilaster standing out of the plaster, capital and base. Out of the bleached look since
  // Joe asked for Greek-reminiscent rather than Greek; kept for a room that wants one
  function pilaster(seed) {
    const T = plaster(seed), R = rng(seed + 9);
    for (let y = 3; y < 30; y++) for (let x = 0; x < 32; x++) {
      const cap = y < 8, base = y > 25, half = cap ? 11 : base ? 10 : 8;
      const d = x - 15.5;
      if (Math.abs(d) > half) continue;
      let f;
      if (cap) f = y === 3 ? 6 : y === 7 ? 1.8 : (y === 5 && Math.abs(Math.abs(d) - 9) < 1.2 ? 1.5 : 4.6);   // abacus, echinus, a volute each side
      else if (base) f = y === 26 ? 6 : y === 29 ? 2 : 4.2;
      else { const fl = (Math.floor(d + 16) & 3); f = fl === 0 ? 2.2 : fl === 1 ? 5.4 : 4.4; if (Math.abs(d) > half - 1) f = d > 0 ? 2.4 : 5.6; }
      T.px[y * 32 + x] = dith(MARBLE, f + (R() - 0.5) * 0.3, x, y);
    }
    return T;
  }
  // travertine: four pale squares, pitted, with the faint banding the stone is laid down in
  function travertine(seed, o = {}) {
    const R = rng(seed), T = blank(32, 32), tone = [0, 1, 2, 3].map(() => 3.4 + R() * 1.5);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if ((x & 15) === 15 || (y & 15) === 15) { T.px[y * 32 + x] = TRAV[2]; continue; }
      const q = (x >> 4) + (y >> 4) * 2;
      let f = (o.checker && (q === 1 || q === 2)) ? tone[q] - 1.3 : tone[q];
      f += Math.sin((y + q * 5) * 0.9) * 0.25 + (R() - 0.5) * 0.45;
      if ((x & 15) === 0 || (y & 15) === 0) f += 0.6;
      T.px[y * 32 + x] = dith(TRAV, f, x, y);
      if (R() < 0.025) T.px[y * 32 + x] = TRAV[1];   // pits
    }
    if (o.stain) { const cx = R() * 32, cy = R() * 32; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(((x - cx + 48) % 32) - 16, ((y - cy + 48) % 32) - 16) / 11; if (d < 1 && R() < 1 - d * 0.6) T.px[y * 32 + x] = dith(STAIN, 3 - d * 1.5, x, y); } }
    return T;
  }
  // the lintel over a gap: a marble beam and plaster under it. Unused since squeezes became slots rather
  // than low openings; kept in the themes in case a low opening comes back
  function beam(seed) {
    const R = rng(seed), T = blank(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) T.px[y * 32 + x] = dith(MARBLE, (y === 12 ? 5.8 : y === 19 ? 1.6 : y === 15 ? 2.4 : 3.8) + (R() - 0.5) * 0.5, x, y);
    return T;
  }
  function underPlaster(seed) {
    const R = rng(seed), T = blank(32, 32), F = field(seed);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) T.px[y * 32 + x] = dith(PLASTER, 4.4 + F(x, y) * 0.4 + (R() - 0.5) * 0.4, x, y);
    return T;
  }
  // The way out, here: a marble doorway onto the sea. Glowing, so the haze never takes it — a hard
  // blue hole in a white world is the one thing in it that doesn't look like everywhere else.
  function seaDoor() {
    const T = plaster(313); T.glow = new Uint8Array(32 * 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = y * 32 + x, d = Math.abs(x - 15.5);
      if (d < 10.5 && y >= 5 && y < 29) {
        if (d > 8.5 || y < 7) { T.px[i] = MARBLE[y < 7 ? 6 : d > 9.5 ? 3 : 5]; continue; }
        const hz = 19;
        const f = y < hz ? 5.8 - (hz - y) * 0.11 : y === hz ? 7 : 3.2 - (y - hz) * 0.25;
        T.px[i] = dith(AEGEAN, f, x, y); T.glow[i] = 1;
      }
    }
    return T;
  }
  function haze() {
    const W = 1536, H = 96, T = blank(W, H), R = rng(5151);
    const cloud = field(77);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let f = (y / (H - 1)) ** 0.9 * (HAZE.length - 1.2);
      f += cloud(x * 0.25, y * 0.8) * 0.45 * (1 - y / H);
      T.px[y * W + x] = dith(HAZE, f, x, y);
    }
    const sx = 980, sy = 30;   // a sun you can look straight at, which is wrong in the right way
    for (let y = sy - 14; y <= sy + 14; y++) for (let x = sx - 14; x <= sx + 14; x++) {
      const d = Math.hypot(x - sx, y - sy);
      if (d < 5) T.px[y * W + x] = hex('#fbf9f1'); else if (d < 14) T.px[y * W + x] = dith(HAZE, 8.4 - (d - 5) * 0.12, x, y);
    }
    return T;
  }

  // ══ office: the back rooms proper ═════════════════════════
  // Joe: "modern office building yellow walls, deep ambient occlusion in the corners. I want a
  // ceiling on it … that white paneling that you see in old office buildings." Mono-yellow
  // wallpaper with its faint repeat, a rubber cove base, damp mustard carpet, and a drop ceiling:
  // acoustic tiles on a T-bar grid, the odd water-stained one, and fluorescent panels. The corner
  // shadows aren't in these textures — the renderer lays them on from the maze, so every inside
  // corner gets one whatever tile is there.
  const YELLOW = ramp(['#5f5222', '#766631', '#8c7b3b', '#a08e46', '#b19e50', '#c0ad5b', '#cdba66', '#d9c775']);
  const CARPET = ramp(['#4c4326', '#5b512e', '#6a5f36', '#786c3e', '#857846', '#91844e', '#9d9057']);
  const CEIL = ramp(['#7f7c70', '#9a9689', '#afab9c', '#c1bdad', '#cfcbbb', '#dbd7c7', '#e5e1d2']);
  const LAMP = ramp(['#c9cfc6', '#dfe5dc', '#eef2ea', '#f8faf4', '#ffffff']);
  const BASE = ramp(['#3c342a', '#4a4134', '#5a5040']);
  const DOOR = ramp(['#4e3b26', '#5f4a30', '#71593a', '#826846']);
  function wallpaper(seed, o = {}) {
    const R = rng(seed), T = blank(32, 32), F = field(seed);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      let f = 5 + F(x, y) * 0.35 + (R() - 0.5) * 0.35;
      const sx = x & 7;
      if (sx === 0) f -= 0.45;                                   // the faint stripe
      if (sx === 4 && ((y + ((x >> 3) & 1) * 4) & 7) === 2) f -= 0.7;   // and the little mark between, staggered
      T.px[y * 32 + x] = dith(YELLOW, f, x, y);
    }
    if (o.stain) {   // a leak from the ceiling, running down
      const cx = 6 + R() * 20;
      for (let y = 0; y < 26; y++) for (let x = 0; x < 32; x++) {
        const w = 5 - y * 0.12 + Math.sin(y * 0.7 + cx) * 1.2, d = Math.abs(x - cx) / Math.max(1, w);
        if (d < 1 && R() < 0.95 - d * 0.4 - y * 0.012) T.px[y * 32 + x] = dith(YELLOW, 2.6 - (1 - d) * 1.4 + y * 0.03, x, y);
      }
    }
    if (o.door) {    // a door that isn't a way anywhere
      for (let y = 6; y < 29; y++) for (let x = 9; x < 23; x++) {
        const frame = x === 9 || x === 22 || y === 6;
        const panel = (x === 12 || x === 19) && y > 9 && y < 27;
        T.px[y * 32 + x] = frame ? YELLOW[2] : dith(DOOR, panel ? 1.2 : 2.2 + ((x * 3 + y) % 5 === 0 ? 0.6 : 0) + (R() - 0.5) * 0.5, x, y);
      }
      T.px[18 * 32 + 20] = hex('#c9c3a8'); T.px[18 * 32 + 19] = hex('#8f8a72');
    }
    if (o.outlet) {
      for (let y = 22; y < 26; y++) for (let x = 14; x < 17; x++) T.px[y * 32 + x] = hex('#e8e3cf');
      T.px[23 * 32 + 15] = BASE[0]; T.px[24 * 32 + 15] = BASE[0];
    }
    for (let x = 0; x < 32; x++) { T.px[28 * 32 + x] = BASE[2]; T.px[29 * 32 + x] = BASE[1]; T.px[30 * 32 + x] = BASE[1]; T.px[31 * 32 + x] = BASE[0]; }
    return T;
  }
  function carpet(seed, o = {}) {
    const R = rng(seed), T = blank(32, 32), F = field(seed + 1), tone = [0, 1, 2, 3].map(() => 3.3 + R() * 0.7);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      let f = tone[(x >> 4) + (y >> 4) * 2] + F(x, y) * 0.3 + (R() - 0.5) * 1.6;   // carpet is all noise
      if (o.stain) { const d = Math.hypot(x - 16, y - 16) / 13 + F(y, x) * 0.15; if (d < 1) f -= 1.8 * (1 - d * d); }
      T.px[y * 32 + x] = dith(CARPET, f, x, y);
    }
    return T;
  }
  // the drop ceiling: four acoustic tiles to a maze tile, pinholed, in a T-bar grid
  function acoustic(seed, o = {}) {
    const R = rng(seed), T = blank(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const gx = x & 15, gy = y & 15;
      if (gx === 15 || gy === 15) { T.px[y * 32 + x] = CEIL[3]; continue; }
      let f = 4.6 + (gx === 0 || gy === 0 ? -0.8 : 0) + (gx === 14 || gy === 14 ? -0.5 : 0) + (R() - 0.5) * 0.4;
      if (R() < 0.09) f -= 1.4;   // pinholes
      if (o.stain) { const d = Math.hypot(x - 8, y - 22) / 7; if (d < 1) f -= d > 0.8 ? 2.4 : 1.1; }   // a ring where it dripped
      T.px[y * 32 + x] = o.stain && Math.hypot(x - 8, y - 22) < 7 ? dith(STAIN, f - 1.8, x, y) : dith(CEIL, f, x, y);
    }
    return T;
  }
  function fluorescent(seed) {
    const T = acoustic(seed); T.glow = new Uint8Array(32 * 32);
    for (let y = 3; y < 29; y++) for (let x = 7; x < 25; x++) {
      const i = y * 32 + x, frame = x === 7 || x === 24 || y === 3 || y === 28;
      if (frame) { T.px[i] = CEIL[2]; continue; }
      const tube = x === 11 || x === 16 || x === 20;
      T.px[i] = dith(LAMP, (tube ? 3.9 : 2.8) + ((x + y) & 1 ? 0.3 : -0.3) + (y === 4 || y === 27 ? -1 : 0), x, y);
      T.glow[i] = 1;
    }
    return T;
  }
  function vent(seed) {
    const T = acoustic(seed);
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) T.px[y * 32 + x] = (y & 1) ? CEIL[1] : CEIL[4];
    return T;
  }
  // the way out: a steel fire door under a green EXIT sign, light through its wired-glass window
  function exitSign() {
    const T = wallpaper(911); T.glow = new Uint8Array(32 * 32);
    const G = ['111.1.1.1.111', '1...1.1.1..1.', '11...1..1..1.', '1...1.1.1..1.', '111.1.1.1..1.'];
    for (let y = 1; y < 8; y++) for (let x = 8; x < 24; x++) { const i = y * 32 + x; T.px[i] = hex('#16562c'); T.glow[i] = 1; }
    for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) if (G[r][c] === '1') T.px[(r + 2) * 32 + c + 10] = hex('#c8ffd2');
    for (let y = 10; y < 28; y++) for (let x = 9; x < 23; x++) {
      const i = y * 32 + x, frame = x === 9 || x === 22 || y === 10;
      const win = x >= 13 && x <= 18 && y >= 13 && y <= 19;
      if (win) { T.px[i] = ((x + y) & 3) ? hex('#fff4d6') : hex('#d8cfae'); T.glow[i] = 1; }
      else T.px[i] = frame ? hex('#5d6158') : y === 21 ? hex('#b9bcb2') : hex(((x + y * 3) % 7) ? '#8b8f84' : '#80847a');
    }
    return T;
  }

  const t0 = performance.now();
  const wood = planks(211);
  const themes = {
    office: {
      label: 'Office (the back rooms)',
      walls: [wallpaper(11), wallpaper(23), wallpaper(31, { stain: 1 }), wallpaper(47, { door: 1 }), wallpaper(59, { outlet: 1 })],
      // no 3: the door that went nowhere is out (Joe: "just remove dead doors"). No 4 either, the painted
      // outlet: once real switches came in it read as one — Joe: "I kept trying to get close and turning
      // them on and I just put Xs on the switches." A plate on a wall now always does something
      pick: [0, 1, 0, 1, 0, 1, 2, 0, 1, 0, 1, 2],
      floors: [carpet(101), carpet(103), carpet(107), carpet(109, { stain: 1 })],
      // a ceiling instead of a sky: `ceils` are picked per tile like the walls; `ceilPick` is the
      // weighting, and the fluorescent one (index 1) is the only one that glows
      ceils: [acoustic(301), fluorescent(303), acoustic(307, { stain: 1 }), vent(309), acoustic(311)],
      ceilPick: [0, 4, 1, 4, 0, 0, 4, 2, 1, 3, 4, 0],
      exit: exitSign(), lintel: wallpaper(401), under: acoustic(403), sky: null,
      fog: '#8f8762', side: 0.84, underLit: 0.8, ao: 0.78,
      furnish: true,   // gets the furniture below
      ambient: 0.3, lampPower: 1.1,   // lit by its own lamps: this much light with none nearby, and each lamp's strength
    },
    bleached: {
      label: 'Bleached (worn stone)',
      walls: [plaster(11), plaster(23, { wear: 1 }), plaster(31, { stain: 0.5, wear: 1 }), ashlar(47), plaster(59, { wear: 2 }), plaster(61, { stain: 0.3, crack: 1, wear: 1 })],
      pick: [0, 1, 0, 1, 0, 1, 2, 3, 4, 4, 5, 3],
      floors: [travertine(101), travertine(103, { checker: 1 }), travertine(107), travertine(109, { stain: 1 })],
      exit: seaDoor(), lintel: beam(211), under: underPlaster(223), sky: haze(),
      fog: '#e6e1d3', side: 0.86, underLit: 0.8, ao: 0.32,
    },
    dusk: {
      label: 'Dusk stone',
      walls: [bricks(11), bricks(23), cracked(31), mossy(47), bricks(59), mossy(61)],
      pick: [0, 0, 1, 1, 4, 4, 0, 1, 2, 3, 5, 4],
      floors: [flags(101), flags(103), flagsWorn(107), flags(109)],
      exit: exitDoor(), lintel: wood, under: wood, sky: sky(),
      fog: '#15141d', side: 0.78, underLit: 0.55, ao: 0.4,
    },
  };
  // ── things in the world ─────────────────────────────────────
  // Drawn as flat pictures that always face you. A transparent pixel is 0. Shared by every look.
  function sprite(rows, pal) {
    const h = rows.length, w = rows[0].length, T = blank(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = rows[y][x]; T.px[y * w + x] = c === '.' ? 0 : pal[c]; }
    return T;
  }
  const P = { k: hex('#1e1812'), b: hex('#5a3a22'), B: hex('#7a5232'), g: hex('#c9a45a'), p: hex('#efe6cf'), P: hex('#d8ceb2'),
              w: hex('#f4f0e4'), W: hex('#cfc9b8'), c: hex('#2a2724'), C: hex('#43403b') };
  const sprites = {
    // a journal, standing: a cloth cover, a gilt line, the page edges showing
    book: sprite([
      '....kkkkkkkk....', '...kbbbbbbbBk...', '...kbBBBBBBBkp..', '...kbBggggBBkp..', '...kbBBBBBBBkp..',
      '...kbBBBBBBBkp..', '...kbBggggBBkp..', '...kbBBBBBBBkp..', '...kbBBBBBBBkp..', '...kbBBBBBBBkP..',
      '...kbBBBBBBBkP..', '...kbBggggBBkP..', '...kbBBBBBBBkp..', '...kbbbbbbbbkp..', '....kkkkkkkkPp..', '.....kkkkkkkk...'], P),
    // a stub of chalk, and one of charcoal, lying on the floor
    chalk: sprite(['................', '................', '.....wwwwwww....', '....wwwwwwwwW...', '....WwwwwwwWW...', '.....WWWWWWW....'], P),
    charcoal: sprite(['................', '................', '.....ccccccc....', '....cCcccccccc..', '....cccccccCcc..', '.....ccccccc....'], P),
    // a folded note, and a wristwatch with a cracked face — the story rooms' keepsakes
    note: sprite(['................', '...pppppppppp...', '..pPPPPPPPPPPp..', '..pPppPpppPPPp..', '..pPPPPPPPPPPp..', '...pppppppppp...'],
      Object.assign({}, P, { p: hex('#e9e1c8'), P: hex('#c9bf9f') })),
    watch: sprite(['.....bb.....', '....kkkk....', '...kwwwwk...', '..kwwkwwwk..', '..kwwkkwwk..', '..kwwwwwwk..', '...kwwwwk...', '....kkkk....', '.....bb.....'],
      Object.assign({}, P, { b: hex('#4a3325'), w: hex('#ddd6c0') })),
    // the being: tall as the ceiling nearly, thin, arms hanging past its knees, two pale eyes that are
    // their own light (alpha 0xfe) — in the dark, the eyes are all of it you see. Two frames of its stride
    being: [0, 1].map((f) => {
      const T = blank(16, 40), k = hex('#0c0b0d'), e = hex('#1c1a1f'), eye = (hex('#e9e4cf') & 0x00ffffff) | 0xfe000000;
      const r = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) T.px[y * 16 + x] = c; };
      r(5, 0, 10, 7, k); r(6, 0, 9, 0, e); r(4, 2, 4, 6, k); r(11, 2, 11, 6, k);            // the head, long
      T.px[3 * 16 + 6] = eye; T.px[3 * 16 + 9] = eye; T.px[4 * 16 + 6] = eye; T.px[4 * 16 + 9] = eye;
      r(7, 8, 8, 9, k);                                                                         // the neck
      r(2, 10, 13, 11, k); r(3, 12, 12, 17, k); r(4, 18, 11, 23, k); r(5, 24, 10, 25, k);      // shoulders, the body narrowing
      const sway = f ? 1 : 0;
      r(1, 11, 2, 29 + sway, k); r(13, 11, 14, 29 - sway, k);                                  // the arms, to the knee
      r(0, 30 + sway, 1, 33 + sway, k); r(14, 30 - sway, 15, 33 - sway, k);                    // and the long hands
      if (f) { r(5, 26, 6, 38, k); r(9, 26, 10, 35, k); r(10, 36, 11, 38, k); } else { r(5, 26, 6, 35, k); r(4, 36, 5, 38, k); r(9, 26, 10, 38, k); }
      r(4, 39, 6, 39, k); r(9, 39, 11, 39, k);
      return T;
    }),
    // a kid's heap of chalk in a corner, the colours as well as the white: Joe, "Put a pile of chalk in one corner"
    chalkPile: sprite([
      '................', '......rr........', '...wwwwwWbb.....', '..yyyywwwWbbbb..', '.wwwwrrrrWwwwww.', 'WWwwwwwWyyyyyWW.'],
      Object.assign({}, P, { r: hex('#e8a4b6'), b: hex('#9cc2e4'), y: hex('#eedf8c') })),
  };
  // the father, seen from the side, walking right (the renderer mirrors him walking left): a man in a
  // dark coat, two frames of a stride. He is only ever glimpsed, a way off and in passing, so he is a
  // shape first — the head, the coat, the legs going — and a face never
  {
    const F = { k: hex('#16130f'), h: hex('#2e2620'), s: hex('#a88a70'), S: hex('#7d6452'), c: hex('#3b3a40'), C: hex('#2a2a2f'),
                t: hex('#2d2a27'), T: hex('#1f1d1b'), o: hex('#0f0d0b') };
    const top = [
      '......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhsk....', '....khhhhssk....', '....kkhhsssk....',
      '.....khsssSk....', '......kSsssk....', '.......kSSk.....', '.....kkccckk....', '....kCcccccck...', '....kCcccccck...',
      '...kCCcccccccck.', '...kCCcCccccck..', '...kCCcCccccck..', '...kCCcCccccck..', '...kCCcCccccck..', '...kCCcsccccck..',
      '...kCCcccccccck.', '....kCcccccccck.', '....kCccccccck..', '....kkttttttk...'];
    const stride = [
      '....kttttTTtk...', '...kttk..kTtk...', '...kttk...kTtk..', '..kttk....kTtk..', '..kttk.....kTtk.', '.kttk......kTtk.',
      '.kttk.......kTk.', '.ktk........kTk.', 'kook.......koook', 'kkkk.......kkkkk'];
    const pass = [
      '....kttttTTtk...', '....kttttTTk....', '....ktttTTtk....', '....kttTTttk....', '.....ktTTtk.....', '.....ktTTtk.....',
      '.....ktTTtk.....', '.....koTTok.....', '....koooookok...', '....kkkkkkkkk...'];
    sprites.father = [sprite(top.concat(stride), F), sprite(top.concat(pass), F)];
    // and from behind, for when he is walking away down the hall you're looking along — which is how
    // the top-down draws him too, facing away
    const back = [
      '......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '.....khhhhk.....', '......kSSk......', '......kSSk......', '...kkkcccckkk...', '..kCccccccccCk..', '.kCCccccccccCCk.', '.kCCccccccccCCk.', '.kCCcccCCcccCCk.', '.kCCcccCCcccCCk.', '.kCCcccCCcccCCk.', '.kCCcccCCcccCCk.', '.kskcccCCcccksk.', '..kCcccCCcccCk..', '..kCcccCCcccCk..', '..kCcccCCcccCk..', '...kkttttttkk...'];
    const backA = [
      '....kttkkTTk....', '....kttkkTTk....', '....kttk.kTTk...', '....kttk.kTTk...', '....kttk.kTTk...', '....kttk.kTTk...', '....kttk..kTk...', '....kttk..kTk...', '...kootk..kok...', '...kkkkk..kkk...'];
    const backB = [
      '....kttkkTTk....', '....kttkkTTk....', '...kttk.kTTk....', '...kttk.kTTk....', '...kttk.kTTk....', '...kttk.kTTk....', '...ktk..kTTk....', '...ktk..kTTk....', '...kok..kTok....', '...kkk..kkkkk...'];
    sprites.fatherBack = [sprite(back.concat(backA), F), sprite(back.concat(backB), F)];
  }
  // ── doors ─────────────────────────────────────────────────
  // A door you walk through: a full leaf, stained wood, panels, a handle both sides — it is drawn
  // from either face. And a closet's: narrow, painted lighter than the wall, a vent of slats at eye
  // height, because the vent is what you look out through once you're inside.
  function doorLeaf() {
    const R = rng(501), T = blank(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const edge = x < 2 || x > 29 || y < 2;
      const panel = (x > 6 && x < 25) && ((y > 5 && y < 14) || (y > 17 && y < 29));
      const bevel = panel && (x === 7 || y === 6 || y === 18);
      let f = edge ? 1 : panel ? (bevel ? 3.2 : 2.3) : 2.8;
      f += ((x * 7 + y) % 9 === 0 ? 0.35 : 0) + (R() - 0.5) * 0.35;
      T.px[y * 32 + x] = dith(DOOR, f, x, y);
    }
    // the handle, on the edge away from the hinge only. The renderer runs a leaf's texture from its
    // hinge (u 0) to its free edge (u 1), from whichever side you see it, so one handle at the far
    // edge is right on both faces. Joe: "we should only have a handle on the side opposite the hinges"
    for (let y = 15; y < 18; y++) { T.px[y * 32 + 27] = hex('#c9c3a8'); T.px[y * 32 + 26] = hex('#8f8a72'); }
    return T;
  }
  function closetFace() {   // drawn into a wall decal, 64×64, so it sits on whatever wall it's on
    const T = blank(64, 64), R = rng(503);
    const PAINT = ramp(['#8d8672', '#b5ae98', '#cfc9b4', '#dfd9c6', '#ebe6d6']);
    for (let y = 8; y < 64; y++) for (let x = 22; x < 42; x++) {
      const frame = x === 22 || x === 41 || y === 8;
      const slat = y >= 16 && y <= 30 && x > 25 && x < 38;
      let f = frame ? 1 : slat ? ((y - 16) % 3 === 0 ? 3.9 : 0.6) : 3 + (R() - 0.5) * 0.4;
      T.px[y * 64 + x] = dith(PAINT, f, x, y);
    }
    T.px[40 * 64 + 38] = hex('#6b6552'); T.px[40 * 64 + 37] = hex('#8d8672');
    return T;
  }
  // a light switch: an old cream plate at hand height, the toggle up for on and down for off. Also a
  // wall decal; only its own pixels are drawn, so the wall shows round it
  function switchPlate(on) {
    const T = blank(64, 64);
    // Joe: "The light switches are massive. Reduce by 75%." A quarter of the size it was: half as wide, half as tall
    const edge = hex('#7e7663'), plate = hex('#e3dcc6'), lit = hex('#f1ecdc'), slot = hex('#4d473b'), nub = hex('#f7f4ea');
    for (let y = 27; y <= 36; y++) for (let x = 30; x <= 35; x++) {
      const e = x === 30 || x === 35 || y === 27 || y === 36;
      T.px[y * 64 + x] = e ? edge : (x === 31 || y === 28) ? lit : plate;
    }
    for (let y = 30; y <= 33; y++) for (let x = 32; x <= 33; x++) T.px[y * 64 + x] = slot;
    const y0 = on ? 29 : 32;
    for (let y = y0; y < y0 + 2; y++) for (let x = 32; x <= 33; x++) T.px[y * 64 + x] = nub;
    // off, a pilot light in the toggle glows amber, so the switch can be found in the dark room it
    // works. Alpha 0xfe marks a pixel the renderer draws as its own light
    if (!on) { const pilot = (hex('#f0a040') & 0x00ffffff) | 0xfe000000; T.px[30 * 64 + 32] = pilot; T.px[30 * 64 + 33] = pilot; }
    return T;
  }
  // ── furniture, for the back rooms ───────────────────────────
  // Joe: "Need furniture in the space as well. Desks, couches, office lamps, water cooler … let's start
  // with back rooms theme." Then, of the flat pictures that turned to face you: "since they move with
  // the player, they clip into the walls. What is the likelihood of you making actual meshes, cubes …
  // that we can then put the pixels over" — and "they don't match the lighting in the room." So every
  // piece is built from boxes (fp.js, FURN), and these are what goes on their faces: materials that
  // tile at 32 texels a tile, like the walls, and a few `fronts` stretched once over one face (a
  // drawer pedestal, a CRT, a cooler's taps). Tired office stock: laminate gone yellow, grey steel, a
  // couch in a green nobody chose. 0 is a hole (the plant's leaves); alpha 0xfe is its own light.
  const furn = (() => {
    const E = (c) => (hex(c) & 0x00ffffff) | 0xfe000000;
    const tex = (w, h, fn) => { const T = blank(w, h), R = rng(w * 131 + h * 7 + fn.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) T.px[y * w + x] = fn(x, y, R); return T; };
    const ramp4 = (cs) => ramp(cs);
    const LAM = ramp4(['#6f6650', '#8f866c', '#ab9f82', '#c4b99c']), STEEL = ramp4(['#4a4b48', '#6a6b66', '#83847e', '#9d9e98']);
    const FAB = ramp4(['#34463c', '#46604f', '#5a7563', '#6f8b78']), BEIGE = ramp4(['#8d8672', '#aaa28c', '#c4bda7', '#d6cfba']);
    const CARD = ramp4(['#7a5a34', '#95703f', '#ad8752', '#c29d66']);
    const mats = {
      laminate: tex(16, 16, (x, y, R) => dith(LAM, 2.1 + ((y * 5 + (x >> 2)) % 7 === 0 ? -0.8 : 0) + (R() - 0.5) * 0.5, x, y)),
      steel:    tex(16, 16, (x, y, R) => dith(STEEL, 1.8 + (R() - 0.5) * 0.4 + (x % 8 === 0 ? -0.5 : 0), x, y)),
      fabric:   tex(16, 16, (x, y, R) => dith(FAB, 1.8 + (y % 4 === 0 ? -0.3 : 0) + (R() - 0.5) * 0.35, x, y)),
      fabricDk: tex(16, 16, (x, y, R) => dith(FAB, 1.0 + (y % 4 === 0 ? -0.25 : 0) + (R() - 0.5) * 0.3, x, y)),
      beige:    tex(16, 16, (x, y, R) => dith(BEIGE, 2.2 + (R() - 0.5) * 0.4, x, y)),
      white:    tex(16, 16, (x, y, R) => dith(ramp4(['#a9a59a', '#c8c4b8', '#dedad0', '#ebe8e0']), 2.3 + (R() - 0.5) * 0.3, x, y)),
      bottle:   tex(16, 16, (x, y, R) => dith(ramp4(['#3f6f86', '#5b8fa7', '#79aec4', '#a6d0de']), (x % 16 === 4 || x % 16 === 5) ? 3.4 : 1.6 + (R() - 0.5) * 0.4, x, y)),
      card:     tex(16, 16, (x, y, R) => dith(CARD, 2 + (R() - 0.5) * 0.7 + ((x * 7 + y * 3) % 11 === 0 ? -0.6 : 0), x, y)),
      pot:      tex(16, 16, (x, y, R) => dith(ramp4(['#5e3a24', '#7a4c30', '#8e5b3c', '#a36d4a']), 2 + (y % 8 === 0 ? -0.8 : 0) + (R() - 0.5) * 0.5, x, y)),
      leaves:   tex(16, 16, (x, y, R) => R() < 0.28 ? 0 : dith(ramp4(['#2f4520', '#3f5a2b', '#557538', '#6d8f47']), 1.2 + R() * 2, x, y)),
      dark:     tex(16, 16, (x, y, R) => dith(ramp4(['#1f1d1a', '#2d2a26', '#3b3833', '#4a4640']), 1.5 + (R() - 0.5) * 0.4, x, y)),
      bin:      tex(16, 16, (x, y, R) => dith(ramp4(['#3c3f3c', '#4d504c', '#5d605c', '#6e716c']), 1.6 + (x % 4 === 0 ? 0.5 : 0) + (R() - 0.5) * 0.3, x, y)),
      shade:    tex(16, 16, (x, y) => E(y % 5 === 0 ? '#e9c98a' : '#f6dca6')),
      bag:      tex(16, 16, (x, y, R) => dith(ramp4(['#3e2620', '#56332a', '#6e4335', '#855443']), 1.9 + (y === 5 || x === 8 ? -0.9 : 0) + (R() - 0.5) * 0.4, x, y)),
      stair:    tex(16, 16, (x, y, R) => dith(ramp4(['#4b4943', '#5f5c55', '#74716a', '#8a877f']), 1.9 + (R() - 0.5) * 0.7 + ((x * 3 + y * 5) % 13 === 0 ? -0.7 : 0), x, y)),
    };
    // fronts: one picture stretched over the face that looks into the room
    const front = (w, h, base, fn) => { const T = blank(w, h); for (let i = 0; i < w * h; i++) T.px[i] = base.px[(((i / w) | 0) & 15) * 16 + ((i % w) & 15)]; fn(T, (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) T.px[y * w + x] = typeof c === 'string' ? hex(c) : c; }); return T; };
    const fronts = {
      pedestal: front(16, 16, mats.laminate, (T, set) => { for (const y of [5, 10]) for (let x = 0; x < 16; x++) set(x, y, '#5a5240'); for (const y of [2, 7, 13]) for (let x = 6; x < 10; x++) set(x, y, '#9d9e98'); }),
      cabinet:  front(12, 24, mats.steel, (T, set) => { for (const y of [6, 12, 18]) for (let x = 0; x < 12; x++) set(x, y, '#2f302d'); for (const y of [2, 8, 14, 20]) for (let x = 4; x < 8; x++) { set(x, y, '#c9c7bb'); set(x, y + 1, '#3f403d'); } }),
      crt:      front(16, 12, mats.beige, (T, set) => { for (let y = 2; y < 9; y++) for (let x = 2; x < 14; x++) set(x, y, y < 4 && x < 5 ? '#34423e' : '#1c2321'); for (let x = 0; x < 16; x++) set(x, 11, '#8d8672'); }),
      cooler:   front(10, 20, mats.white, (T, set) => { set(3, 5, '#2f5f96'); set(6, 5, '#a33a32'); for (let x = 2; x < 8; x++) { set(x, 9, '#7d7d78'); set(x, 10, '#5d5d58'); } for (let x = 0; x < 10; x++) set(x, 19, '#8d897e'); }),
      nosing:   front(16, 8, mats.stair, (T, set) => { for (let x = 0; x < 16; x++) { set(x, 0, '#a9a69d'); set(x, 1, '#8e8b83'); set(x, 7, '#34322e'); } }),
      boxTop:   front(16, 16, mats.card, (T, set) => { for (let y = 0; y < 16; y++) { set(7, y, '#d8c08c'); set(8, y, '#cdb47e'); } }),
    };
    return { mats, fronts };
  })();
  return { themes, sprites, furn, door: doorLeaf(), closet: closetFace(), lightSwitch: [switchPlate(false), switchPlate(true)], hex, buildMs: performance.now() - t0 };
})();
