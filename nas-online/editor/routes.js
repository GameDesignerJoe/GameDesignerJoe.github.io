// Climbing / plateau analysis for the editor, using terrain.js's own derivation.
// computeRoutes(terrain, cls) copies the painted class map into terrain's mask, calls
// rebuild(), and returns one code per mask px:
//   0 nothing (spawn-level ground, or plain rock)   1 climbable face
//   2 plateau top (reached by climbing)              3 cut off (cannot be reached)
// plus whether the explorer start ended up inside rock.
// Climb-face detection mirrors terrain.js deriveHeights() (RUN_MAX 55, RUN_LAND 2,
// a run at least half cliff, walkable regions above and below): keep them in step.
export function computeRoutes(terrain, cls) {
  const m0 = terrain.mask();
  if (!m0) throw new Error('terrain did not load');
  m0.cls.set(cls);
  terrain.rebuild();
  const m = terrain.mask();
  const { occ, region, regionReach, spawnRegion, w: MW, h: MH } = m;
  const N = MW * MH, out = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = region[i];
    if (!r || r === spawnRegion) continue;
    out[i] = regionReach[r] ? 2 : 3;
  }
  for (let x = 0; x < MW; x++) {
    let y = 0;
    while (y < MH) {
      if (!occ[y * MW + x]) { y++; continue; }
      const y0 = y;
      while (y < MH && occ[y * MW + x]) y++;
      const y1 = y;
      if (y0 === 0 || y1 + 2 >= MH || y1 - y0 > 55) continue;
      let cl = 0;
      for (let yy = y0; yy < y1; yy++) if (m.cls[yy * MW + x] === 6) cl++;
      if (cl * 2 < y1 - y0) continue;
      let blocked = false;
      for (let k = 0; k <= 2; k++) if (occ[(y1 + k) * MW + x]) blocked = true;
      if (blocked) continue;
      const up = region[(y0 - 1) * MW + x], lo = region[y1 * MW + x];
      if (!up || !lo || up === lo) continue;
      for (let yy = y0; yy < y1; yy++) out[yy * MW + x] = 1;
    }
  }
  return { codes: out, spawnInRock: !spawnRegion };
}
