// Low-level painting helpers shared by every procedural sprite.
//
// The house style (matched to the reference sheet): chunky dark-navy outline,
// soft two-tone fills, a highlight up-left and shade down-right. Everything is
// drawn in "units" around (0,0); the sprite cache decides the pixel scale.

export const INK = '#262a3b';
export const INK_W = 3.2; // outline width in units at the standard sheep size

// Small deterministic RNG so a breed always grows the same wool.
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function circle(p, x, y, r) { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); }
export function ellipse(p, x, y, rx, ry, rot = 0) {
  p.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

// Stroke-then-fill: the doubled stroke leaves exactly `w` of outline outside the
// fill, and overlapping sub-shapes merge into one silhouette.
export function inked(ctx, path, fill, w = INK_W, ink = INK) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (w > 0) {
    ctx.lineWidth = w * 2;
    ctx.strokeStyle = ink;
    ctx.stroke(path);
  }
  ctx.fillStyle = fill;
  ctx.fill(path);
}

// Shade a filled shape: clip to it, then lay a darker crescent along the lower
// right and a soft highlight up-left. `box` is the shape's rough bounds.
export function shadeInside(ctx, path, { x, y, rx, ry }, shade, light, amount = 0.28) {
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = shade;
  const p = new Path2D();
  p.rect(x - rx * 2, y - ry * 2, rx * 4, ry * 4);
  ellipse(p, x - rx * amount, y - ry * amount, rx * 1.02, ry * 1.02);
  ctx.fill(p, 'evenodd');
  if (light) {
    ctx.fillStyle = light;
    const h = new Path2D();
    ellipse(h, x - rx * 0.38, y - ry * 0.42, rx * 0.34, ry * 0.22, -0.5);
    ctx.fill(h);
  }
  ctx.restore();
}

// Generic fluffy cloud — wool bodies, head tufts, tail puffs, bushes and tree
// canopies all use it. Returns the silhouette path so callers can clip to it.
export function cloud(ctx, opts, pal, inkW = INK_W) {
  const {
    x = 0, y = 0, rx, ry, lobes = 12, lobeR, jitter = 0.18, seed = 1,
    curls = 0, curlR = lobeR * 0.7, lightSide = -1,
  } = opts;
  const rand = rng(seed);
  const lobeList = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const r = lobeR * (1 - jitter + rand() * jitter * 2);
    lobeList.push({
      x: x + Math.cos(a) * (rx - r * 0.62),
      y: y + Math.sin(a) * (ry - r * 0.62),
      r,
    });
  }
  const coreRx = rx - lobeR * 0.75, coreRy = ry - lobeR * 0.75;
  const path = new Path2D();
  ellipse(path, x, y, coreRx, coreRy);
  for (const l of lobeList) circle(path, l.x, l.y, l.r);

  inked(ctx, path, pal.shade, inkW);

  ctx.save();
  ctx.clip(path);
  // Each perimeter lobe: base-coloured puff nudged toward the light, leaving a
  // shade rim on its lower-right edge. Lower lobes first so upper ones overlap.
  const sorted = [...lobeList].sort((a, b) => a.y - b.y);
  ctx.fillStyle = pal.base;
  for (const l of sorted) {
    const p = new Path2D();
    circle(p, l.x - l.r * 0.12, l.y - l.r * 0.16, l.r * 0.8);
    ctx.fill(p);
  }
  // The core, slightly lifted.
  const core = new Path2D();
  ellipse(core, x - rx * 0.04, y - ry * 0.05, coreRx * 0.98, coreRy * 0.98);
  ctx.fill(core);

  // Interior curls — the thing that makes it read as wool rather than a blob.
  if (curls > 0) {
    const cr = rng(seed * 7 + 3);
    const ring = [];
    const rings = curls > 6 ? 2 : 1;
    for (let k = 0; k < rings; k++) {
      const n = k === 0 ? curls : Math.max(3, Math.round(curls / 2.2));
      const f = k === 0 ? 0.56 : 0.2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + cr() * 0.6 + k;
        ring.push({
          x: x + Math.cos(a) * coreRx * f,
          y: y + Math.sin(a) * coreRy * f,
          r: curlR * (0.85 + cr() * 0.35),
        });
      }
    }
    ring.sort((a, b) => a.y - b.y);
    for (const c of ring) {
      const sh = new Path2D();
      circle(sh, c.x, c.y, c.r);
      ctx.fillStyle = pal.mid || pal.shade;
      ctx.fill(sh);
      const top = new Path2D();
      circle(top, c.x - c.r * 0.12, c.y - c.r * 0.18, c.r * 0.84);
      ctx.fillStyle = pal.base;
      ctx.fill(top);
    }
  }

  // Highlights on the lobes facing the light.
  ctx.fillStyle = pal.light;
  for (const l of sorted.slice(0, Math.ceil(sorted.length / 2))) {
    if ((l.x - x) * lightSide < -rx * 0.2) continue;
    const h = new Path2D();
    ellipse(h, l.x - l.r * 0.25, l.y - l.r * 0.3, l.r * 0.32, l.r * 0.2, -0.6);
    ctx.fill(h);
  }
  const big = new Path2D();
  ellipse(big, x - rx * 0.3, y - ry * 0.38, rx * 0.22, ry * 0.13, -0.5);
  ctx.globalAlpha = 0.8;
  ctx.fill(big);
  ctx.restore();
  return { path, lobes: lobeList };
}

// Soft ground shadow (the reference uses a cool blue-grey drop shadow).
export function groundShadow(ctx, x, y, rx, ry, alpha = 0.28) {
  ctx.save();
  ctx.fillStyle = `rgba(22, 40, 30, ${alpha})`;
  const p = new Path2D();
  ellipse(p, x, y, rx, ry);
  ctx.fill(p);
  ctx.restore();
}

export function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// Dense points along a smooth closed curve through control points
// (Catmull-Rom). Used to build organic outlines that fur() can roughen.
export function smoothClosed(ctrl, perSeg = 6) {
  const out = [];
  const n = ctrl.length;
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      // optional 3rd element = spike size at that control point, interpolated
      const s1 = p1[2] ?? 0, s2 = p2[2] ?? 0;
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), s1 + (s2 - s1) * t]);
    }
  }
  return out;
}

// Roughen an outline into fur: every other point is pushed outward into a
// spike (size from the point's 3rd element), giving the jagged tufted edge of
// the reference wolves. Returns a Path2D.
export function fur(pts, seed = 1, scale = 1) {
  const r = rng(seed);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area > 0 ? -1 : 1;
  const p = new Path2D();
  pts.forEach((pt, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length], next = pts[(i + 1) % pts.length];
    let nx = next[1] - prev[1], ny = -(next[0] - prev[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx = (nx / len) * sign; ny = (ny / len) * sign;
    const s = (pt[2] || 0) * scale * (i % 2 ? (0.7 + r() * 0.6) : 0);
    const x = pt[0] + nx * s, y = pt[1] + ny * s;
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  });
  p.closePath();
  return p;
}
