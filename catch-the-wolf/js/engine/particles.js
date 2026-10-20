// Lightweight particle system for juice: wool puffs, hearts, sparkles, dust.
// Each particle kind has a painter; particles live in world (CSS px) space.

import { sprite, blit } from './sprites.js';
import { cloud } from '../art/draw.js';
import { WOOL } from '../art/palette.js';
import { paintHeart } from '../art/icons.js';

const defCache = new Map();
function def(kind, pal, seed) {
  const k = `${kind}/${pal}/${seed}`;
  if (!defCache.has(k)) defCache.set(k, PAINTERS[kind](pal, seed));
  return defCache.get(k);
}

const PAINTERS = {
  wool: (pal, seed) => ({
    id: `fx/wool/${pal}/${seed}`,
    box: { x: -16, y: -16, w: 32, h: 32 },
    paint: (c) => cloud(c, { x: 0, y: 0, rx: 12, ry: 11, lobes: 6, lobeR: 5.5, seed }, WOOL[pal] || WOOL.cream, 2.2),
  }),
  heart: () => ({ id: 'fx/heart', box: { x: -14, y: -13, w: 28, h: 24 }, paint: (c) => paintHeart(c) }),
};

export class Particles {
  constructor() { this.list = []; }

  burstWool(x, y, pal, scale, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = (120 + Math.random() * 220) * scale;
      this.list.push({
        kind: 'wool', pal, seed: 1 + (i % 4), x: x + Math.cos(a) * 14 * scale, y: y + Math.sin(a) * 18 * scale,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * scale, drag: 3.2, g: 0,
        life: 0.75 + Math.random() * 0.35, age: 0, size: (0.8 + Math.random() * 0.9) * scale, spin: (Math.random() - 0.5) * 6, rot: 0,
      });
    }
  }

  hearts(x, y, scale, n = 3) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        kind: 'heart', x: x + (Math.random() - 0.5) * 30 * scale, y, vx: (Math.random() - 0.5) * 40, vy: -(70 + Math.random() * 60),
        drag: 0.8, g: 0, life: 1.1 + i * 0.15, age: -i * 0.12, size: (0.9 + Math.random() * 0.4) * scale, spin: 0, rot: (Math.random() - 0.5) * 0.5,
      });
    }
  }

  // Generic shapes drawn directly (no sprite): sparkles and z's.
  sparkle(x, y, scale, n = 10, color = '#fff6b0') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (80 + Math.random() * 160) * scale;
      this.list.push({ kind: 'spark', color, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 4, g: 0, life: 0.6 + Math.random() * 0.3, age: 0, size: (3 + Math.random() * 3) * scale, spin: 4, rot: 0 });
    }
  }

  zzz(x, y, scale) {
    this.list.push({ kind: 'z', x, y, vx: 14, vy: -26, drag: 0, g: 0, life: 2.2, age: 0, size: scale, spin: 0, rot: -0.2 });
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      if (p.age < 0) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  draw(ctx) {
    for (const p of this.list) {
      if (p.age < 0) continue;
      const t = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'spark') {
        const r = p.size * (1 - t * 0.6);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.35 : r;
          i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(rr, 0);
        }
        ctx.closePath(); ctx.fill();
      } else if (p.kind === 'z') {
        ctx.font = `800 ${Math.round(14 * p.size * (0.7 + t * 0.6))}px Nunito, system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#262a3b'; ctx.lineWidth = 3 * p.size;
        ctx.strokeText('z', 0, 0); ctx.fillText('z', 0, 0);
      } else {
        const d = def(p.kind, p.pal, p.seed);
        const s = p.size * (p.kind === 'wool' ? 1 - t * 0.35 : 1);
        ctx.scale(s, s);
        blit(ctx, sprite(d.id, d.box, p.size, d.paint));
      }
      ctx.restore();
    }
  }
}
