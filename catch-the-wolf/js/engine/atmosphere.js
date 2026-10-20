// Time-of-day light and weather, drawn over the play field each frame.
//   light:   multiply/screen colour wash + optional vignette (from data/world.json)
//   weather: 'clear' | 'wind' | 'rain' | 'fog' | 'snow'
// Season tints the particles (petals in spring, leaves in fall, snow in winter).

const LEAF = { spring: ['#ffd1e3', '#ffffff'], summer: ['#e8dc8a', '#cfe08a'], fall: ['#e0672b', '#f2a73a', '#c8452a'], winter: ['#ffffff'] };

export class Atmosphere {
  constructor({ light = null, weather = 'clear', season = 'spring' } = {}) {
    this.light = light;
    this.weather = weather;
    this.season = season;
    this.w = 0; this.h = 0;
    this.parts = [];
    this.fog = [];
    this.t = 0;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    const area = w * h;
    this.parts = [];
    this.fog = [];
    const n = this.weather === 'rain' ? Math.round(area / 2600) : this.weather === 'snow' ? Math.round(area / 3800)
      : this.weather === 'wind' ? Math.round(area / 9000) : 0;
    for (let i = 0; i < n; i++) this.parts.push(this.spawn(true));
    if (this.weather === 'fog') {
      for (let i = 0; i < Math.max(6, Math.round(area / 45000)); i++) {
        this.fog.push({ x: Math.random() * w, y: Math.random() * h, r: 90 + Math.random() * 140, vx: 8 + Math.random() * 14, a: 0.32 + Math.random() * 0.25, ph: Math.random() * 6 });
      }
    }
  }

  spawn(anywhere) {
    const { w, h } = this;
    if (this.weather === 'rain') return { x: Math.random() * (w + 200) - 100, y: anywhere ? Math.random() * h : -20, v: 700 + Math.random() * 300, len: 14 + Math.random() * 10 };
    if (this.weather === 'snow') return { x: Math.random() * w, y: anywhere ? Math.random() * h : -10, v: 30 + Math.random() * 40, r: 1.4 + Math.random() * 2.6, ph: Math.random() * 6 };
    // wind: streaks + drifting petals/leaves
    const cols = LEAF[this.season] || LEAF.spring;
    return { x: anywhere ? Math.random() * w : -30, y: Math.random() * h, v: 160 + Math.random() * 200, streak: Math.random() < 0.5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 8, col: cols[Math.floor(Math.random() * cols.length)], ph: Math.random() * 6 };
  }

  update(dt) {
    this.t += dt;
    const { w, h } = this;
    for (const p of this.parts) {
      if (this.weather === 'rain') { p.y += p.v * dt; p.x += p.v * 0.18 * dt; if (p.y > h + 20) Object.assign(p, this.spawn(false)); }
      else if (this.weather === 'snow') { p.y += p.v * dt; p.x += Math.sin(this.t * 1.3 + p.ph) * 18 * dt + 10 * dt; if (p.y > h + 10) Object.assign(p, this.spawn(false)); }
      else { p.x += p.v * dt; p.y += Math.sin(this.t * 2 + p.ph) * 30 * dt; p.rot += p.spin * dt; if (p.x > w + 40) Object.assign(p, this.spawn(false)); }
    }
    for (const f of this.fog) { f.x += f.vx * dt; if (f.x - f.r > w) f.x = -f.r; }
  }

  // Weather that sits over the sheep (rain, snow, wind, fog), then the light.
  draw(ctx) {
    const { w, h } = this;
    if (this.weather === 'rain') {
      ctx.fillStyle = 'rgba(60,80,110,0.12)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(210,225,245,0.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const p of this.parts) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.len * 0.18, p.y + p.len); }
      ctx.stroke();
    } else if (this.weather === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const p of this.parts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    } else if (this.weather === 'wind') {
      for (const p of this.parts) {
        if (p.streak) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 20, p.y - 4, p.x + 44, p.y); ctx.stroke();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(3.4, 0, 0, 4); ctx.quadraticCurveTo(-3.4, 0, 0, -4); ctx.fill();
          ctx.restore();
        }
      }
    } else if (this.weather === 'fog') {
      ctx.fillStyle = 'rgba(235,240,245,0.14)'; ctx.fillRect(0, 0, w, h);
      for (const f of this.fog) {
        const a = f.a * (0.8 + Math.sin(this.t * 0.4 + f.ph) * 0.2);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(240,244,248,${a})`); g.addColorStop(1, 'rgba(240,244,248,0)');
        ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      }
    }
    this.drawLight(ctx);
  }

  drawLight(ctx) {
    const L = this.light;
    if (!L) return;
    const { w, h } = this;
    ctx.save();
    ctx.globalCompositeOperation = L.mode || 'multiply';
    ctx.globalAlpha = L.alpha ?? 1;
    ctx.fillStyle = L.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    if (L.vignette) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(10,14,40,0)'); g.addColorStop(1, `rgba(10,14,40,${L.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
}
