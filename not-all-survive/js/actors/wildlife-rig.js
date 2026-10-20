// Shared drawing helpers for the wildlife: a tiny oblique "3D" projection and an
// inked-union renderer (one outline around a group of overlapping blobs, flat fill,
// cel shade on the side away from the upper-left light).

// Ground depth is foreshortened (K) and heights are drawn at H per model unit, so the
// models read like the painting's 50-60 degree oblique camera.
export const K = 0.75;
export const H = 0.8;
// Cast shadow offset on the ground per unit of model height (light from the upper-left).
export const SHX = 1.2, SHY = 0.55;
// Unit vector toward the camera in (x, y-south, z-up) world axes, for feature visibility.
export const CAM_Y = 0.57, CAM_Z = 0.82;

export const INK = '#2b2b2b';

// Local model point (f forward, l right, z up) -> screen-ish world coords.
// Writes { x, y, dy (ground depth offset), gx, gy (ground point), z } into o.
export function proj(o, ox, oy, ca, sa, f, l, z) {
  const dx = f * ca - l * sa, dy = f * sa + l * ca;
  o.gx = ox + dx; o.gy = oy + dy * K;
  o.x = o.gx; o.y = o.gy - z * H; o.dy = dy; o.z = z;
  return o;
}

// Shapes: { t: 0, x, y, r } circle | { t: 1, x1, y1, r1, x2, y2, r2 } capsule |
//         { t: 2, x, y, rx, ry, rot } ellipse.   All wound clockwise so a nonzero
// fill/clip of one Path2D is their union.
export function addShape(p, s, ox = 0, oy = 0) {
  if (s.t === 0) {
    p.moveTo(s.x + ox + s.r, s.y + oy);
    p.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
  } else if (s.t === 1) {
    const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    const d = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    // tangent correction for unequal radii
    const k = d > Math.abs(s.r1 - s.r2) ? Math.asin((s.r1 - s.r2) / Math.max(d, 1e-4)) : 0;
    p.moveTo(s.x1 + ox + Math.cos(a + Math.PI / 2 + k) * s.r1, s.y1 + oy + Math.sin(a + Math.PI / 2 + k) * s.r1);
    p.arc(s.x1 + ox, s.y1 + oy, s.r1, a + Math.PI / 2 + k, a + Math.PI * 1.5 - k);
    p.arc(s.x2 + ox, s.y2 + oy, s.r2, a - Math.PI / 2 - k, a + Math.PI / 2 + k);
    p.closePath();
  } else {
    p.moveTo(s.x + ox + Math.cos(s.rot) * s.rx, s.y + oy + Math.sin(s.rot) * s.rx);
    p.ellipse(s.x + ox, s.y + oy, s.rx, s.ry, s.rot, 0, Math.PI * 2);
  }
}

export function pathOf(shapes, ox = 0, oy = 0) {
  const p = new Path2D();
  for (const s of shapes) addShape(p, s, ox, oy);
  return p;
}

// Inked union: outline (ow world units), shade fill, then the lit fill shifted toward the
// light and clipped to the silhouette, which leaves a shade crescent on the lower-right.
export function inkUnion(ctx, shapes, lit, shade, ow, lx = -0.8, ly = -0.9, ink = INK) {
  const p = pathOf(shapes);
  ctx.lineJoin = 'round';
  ctx.lineWidth = ow * 2;
  ctx.strokeStyle = ink;
  ctx.stroke(p);
  ctx.fillStyle = shade;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = lit;
  ctx.fill(pathOf(shapes, lx, ly));
  ctx.restore();
  return p;
}

export const circle = (x, y, r) => ({ t: 0, x, y, r });
export const capsule = (a, r1, b, r2) => ({ t: 1, x1: a.x, y1: a.y, r1, x2: b.x, y2: b.y, r2 });

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, t) => { const k = clamp((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
// exponential approach, frame-rate independent
export const approach = (v, t, rate, dt) => v + (t - v) * (1 - Math.exp(-rate * dt));

// Two-bone IK in the leg's forward/up plane. Returns the middle joint (f, l, z).
export function ik(rf, rl, rz, ff, fl, fz, a, b, sign, out) {
  let df = ff - rf, dl = fl - rl, dz = fz - rz;
  let d = Math.hypot(df, dl, dz);
  const dmax = (a + b) * 0.97;
  if (d > dmax) { const s = dmax / d; df *= s; dl *= s; dz *= s; d = dmax; out.ff = rf + df; out.fl = rl + dl; out.fz = rz + dz; }
  else { out.ff = ff; out.fl = fl; out.fz = fz; }
  d = Math.max(d, 1e-3);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const n = Math.hypot(df, dz) || 1;
  out.mf = rf + (df / d) * x + (-dz / n) * h * sign;
  out.ml = rl + (dl / d) * x;
  out.mz = rz + (dz / d) * x + (df / n) * h * sign;
  return out;
}
