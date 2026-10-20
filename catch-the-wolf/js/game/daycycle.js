// The farm's day/night clock. A full day takes CYCLE seconds of real time and
// is keyed to the wall clock, so it carries on between visits. Each keyframe
// is a multiply colour (white = untouched daylight) plus a vignette.

export const CYCLE = 240; // seconds per farm day

const KEYS = [
  { at: 0.00, color: '#ffffff', vig: 0.00, name: 'Day', icon: '☀️' },
  { at: 0.50, color: '#ffffff', vig: 0.00, name: 'Day', icon: '☀️' },
  { at: 0.58, color: '#ffbf8a', vig: 0.18, name: 'Sunset', icon: '🌇' },
  { at: 0.66, color: '#6b78b8', vig: 0.45, name: 'Night', icon: '🌙' },
  { at: 0.88, color: '#6b78b8', vig: 0.45, name: 'Night', icon: '🌙' },
  { at: 0.95, color: '#f4cfc4', vig: 0.08, name: 'Dawn', icon: '🌅' },
  { at: 1.00, color: '#ffffff', vig: 0.00, name: 'Day', icon: '☀️' },
];

function lerpHex(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + [c(16), c(8), c(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function farmPhase(now = Date.now()) {
  return ((now / 1000) % CYCLE) / CYCLE;
}

// { light, name, icon, night (0..1 how dark), isNight }
export function farmLight(phase = farmPhase()) {
  let i = 0;
  while (i < KEYS.length - 2 && phase >= KEYS[i + 1].at) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = (phase - a.at) / Math.max(1e-6, b.at - a.at);
  const vig = a.vig + (b.vig - a.vig) * t;
  const label = t < 0.5 ? a : b;
  const night = Math.min(1, vig / 0.45);
  return {
    light: { mode: 'multiply', color: lerpHex(a.color, b.color, t), alpha: 1, vignette: vig },
    name: label.name, icon: label.icon, night, isNight: night > 0.6,
  };
}
