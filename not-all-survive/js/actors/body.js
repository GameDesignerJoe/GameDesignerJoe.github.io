// The explorer's body, and the expedition it belongs to. No bars, ever: the body and the
// screen carry it.
//
// state.body = { warmth, wet, energy, injury, food, water }, each 0..1 (wet and injury start
// at 0, the rest at 1). Only warmth is live so far; the others are hooks the later slices
// fill in (wet multiplies the warmth loss, food caps it, energy feeds the walking heat).
//   explorer.js        reads warmth for the cold poses (hug, hard shiver, stumble, kneel,
//                      collapse) and dulls the coat toward grey ochre
//   weather-screen.js  grows the frost with 1 - warmth
//   audio.js           plays the 'chatter' and 'heartbeat' events this module pushes, and
//                      muffles the world near the end
//   this module        draws the last of it in drawOverlay (desaturate, dim, the ink iris),
//                      runs the death -> next member hand-over and the sleep in the tent.
//
// body.phase: 'alive' | 'dying' (the collapse plays) | 'iris' (closes on the fallen body,
//   holds a beat, closes) | 'black' (the hand-over happens here) | 'open' (the iris opens on
//   the tent; the next member crawls out) | 'over' (all four dead) | 'sleep' (in the tent).
// body.t: seconds into the phase. body.sleepHold: 0..1 how long a press inside the tent has
//   been held (explorer.js writes it; camp.js turns the lamp down with it).
//
// Wet (slice 2): open water soaks the explorer (explorer.js reports state.player.water
// = { level: 0 land | 1 wading | 2 deep, depth, zW }). Wading drains warmth fast, deep water
// in ~25 s; wet clothes multiply the loss ~4x on land and slowly freeze into rime
// (body.frozen 0..1, never more than wet): stiff, white-crusted, still cold. The tent dries
// and thaws fast; out in the cold drying is slow (a little faster in calm sun).
// body.shock 0..1: the cold-water gasp, fading over ~20 s (ragged breath, the white flash).
//
// state.party = [{ name, alive, x, y }] x 4, state.member = index of the one playing now.
// Hooks: NAS.freeze(v?) (warmth to v, or 0.2 colder), NAS.warm(v = 1), NAS.kill(),
//        NAS.soak(v = 1), NAS.dry().
import { state } from '../state.js';
import { worldToScreen } from '../camera.js';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const INK = '#262626';
const TAU = Math.PI * 2;

// --- warmth --------------------------------------------------------------------------------------
// loss / s = LOSS x chill^1.5, chill = cold x (0.35 + 0.65 x wind exposure), then
//   x (1 + 0.3 night)  x (1 - 0.6 sheltered)  x (1 + 3 wet)  x hunger
// gain / s = HEAT x walking pace (the body makes heat while it works).
// Tuned (measured, see the report in docs/BRIEF.md) so a dry explorer standing in a full
// blizzard (cowering in the open) dies in ~3 min, a wet one in ~45 s, and a calm clear
// day is survivable on the move and only slowly dangerous standing about.
const LOSS = 0.0089;
const HEAT = 0.0019;
const INSIDE_GAIN = 1 / 22;       // in the tent: from near death back to full in ~20 s
// water (warmth / s on top of the air): wading with the legs in near-freezing sea, and
// swimming in it (~25 s to death); wet clothes dry or freeze (per s)
const WADE_LOSS = 1 / 120, DEEP_LOSS = 1 / 25;
const SOAK_WADE = 0.12, DRY_COLD = 1 / 600, DRY_SUN = 1 / 200, DRY_TENT = 1 / 12, THAW_TENT = 1 / 8, RIME = 1 / 90;

const NAMES = ['Halloran', 'Ashby', 'Teague', 'Marsh'];

const B = state.body = {
  warmth: 1, wet: 0, energy: 1, injury: 0, food: 1, water: 1,
  frozen: 0, shock: 0,
  phase: 'alive', t: 0, sleepHold: 0, rate: 0,
};
state.party = NAMES.map(name => ({ name, alive: true, x: null, y: null }));
state.member = 0;

// death sequence timing (s)
const IRIS_IN = 1.8, BEAT = 2.4, IRIS_OUT = 0.9, BLACK = 0.9, OPEN = 2.2;
const SLEEP_FADE = 0.9, SLEEP_HOLD = 1.1, SLEEP_WAKE = 1.6;

let chatT = 3, beatT = 0, throb = 0, irisFrom = 1, overT = 0, restartArmed = false, killed = false;
let lastTap = -1, lastAct = 0, slept = false, flash = 0;

export function init() {
  // (only while alive and playing: not mid-death, during the hand-over, asleep or after the end)
  state.freeze = v => { if (B.phase === 'alive') B.warmth = typeof v === 'number' ? clamp(v) : Math.max(0.02, B.warmth - 0.2); };
  state.warm = (v = 1) => { if (B.phase === 'alive' || B.phase === 'open') B.warmth = clamp(v); };
  state.kill = () => { if (B.phase === 'alive') { B.warmth = 0; killed = true; } };   // works from inside the tent too
  state.soak = (v = 1) => { B.wet = clamp(v); };
  state.dry = () => { B.wet = 0; B.frozen = 0; };
  if (state.params.has('warmth')) B.warmth = clamp(parseFloat(state.params.get('warmth')));
  if (state.params.has('wet')) B.wet = clamp(parseFloat(state.params.get('wet')));
  if (state.params.has('frozen')) B.frozen = Math.min(B.wet, clamp(parseFloat(state.params.get('frozen'))));
}

const P = state.player;
const outside = () => P.mode !== 'inside' && P.mode !== 'tent-in' && P.mode !== 'gone';

function warmthRate() {
  if (P.mode === 'inside') return INSIDE_GAIN;
  if (P.mode === 'tent-in' || P.mode === 'tent-out') return 0;
  const cold = clamp(state.weather.cold ?? 0.3);
  const wind = clamp(P.exposure || 0);
  const night = clamp(state.lighting?.night || 0);
  const chill = cold * (0.35 + 0.65 * wind);
  let loss = LOSS * Math.pow(chill, 1.5) * (1 + 0.3 * night);
  loss *= 1 - 0.6 * clamp(P.sheltered || 0);          // cowering, hunkered in the lee of rock
  loss *= 1 + 3 * clamp(B.wet);                        // wet: ~4x
  loss *= 1 + 0.5 * clamp((0.3 - B.food) / 0.3);       // hungry: up to +50% (slice 4)
  // in the water itself: the sea takes the heat straight out
  const lv = P.water?.level || 0;
  if (lv === 1) loss += WADE_LOSS * (0.6 + 0.4 * clamp((P.water.depth || 0) / 4));
  if (lv === 2) loss += DEEP_LOSS;
  const pace = P.mode === 'walk' && P.moving && !lv ? clamp(P.speed / 9) : P.mode === 'climb' ? 0.8 : 0;
  // wet clothes don't hold the heat of working
  const heat = HEAT * pace * (0.4 + 0.6 * clamp(B.energy)) * (1 - 0.65 * clamp(B.wet));
  return heat - loss;
}

function setPhase(p) { B.phase = p; B.t = 0; }

// Soaking, drying, freezing into rime. Frozen never exceeds wet; rime only forms in the cold.
function updateWet(dt) {
  const lv = P.water?.level || 0;
  if (lv === 2) { B.wet = Math.min(1, B.wet + 1.5 * dt); B.frozen = Math.max(0, B.frozen - dt * 0.5); }
  else if (lv === 1) {
    // wading soaks the legs and the coat hem: up to about half, deeper water more, slowly
    const cap = 0.35 + 0.25 * clamp((P.water.depth || 0) / 9);
    if (B.wet < cap) B.wet = Math.min(cap, B.wet + SOAK_WADE * dt);
    B.frozen = Math.max(0, B.frozen - dt * 0.3);
  }
  else if (P.mode === 'inside' || B.phase === 'sleep') {
    B.wet = Math.max(0, B.wet - DRY_TENT * dt); B.frozen = Math.max(0, B.frozen - THAW_TENT * dt);
  } else {
    const L = state.lighting, cold = clamp(state.weather.cold ?? 0.3);
    // calm sun on a bright day dries a little faster; otherwise it mostly freezes
    const sun = (1 - clamp(L.night || 0)) * clamp(L.bright || 0) * clamp(1 - (state.wind.speed || 0) * 1.5);
    B.wet = Math.max(0, B.wet - (DRY_COLD + DRY_SUN * sun) * dt * (1 - 0.6 * B.frozen));
    B.frozen = Math.min(B.wet, B.frozen + RIME * smooth(0.15, 0.6, cold) * B.wet * dt);
  }
  B.frozen = Math.min(B.frozen, B.wet);
  B.shock = Math.max(0, B.shock - dt / 20);
}
// Sleeping is only for the night, and only in the day/night cycle (a pinned clock has no morning).
export function canSleep() { const L = state.lighting; return L.mode === 'cycle' && L.night > 0.5 && L.clock >= 180; }

function handover() {
  const m = state.party[state.member];
  m.alive = false; m.x = P.x; m.y = P.y;
  // fallen.js keeps the body where it fell; the picture is taken now, before the swap
  // (lost at sea: no body, only fading rings where they went under)
  const lost = !!P.lostAtSea;
  state.events.push({ type: 'handover', x: P.x, y: P.y, facing: P.facing, member: state.member, name: m.name, lost, sprite: lost ? null : P.snapshot?.() });
  const next = state.party.findIndex(q => q.alive);
  Object.assign(B, { warmth: 1, wet: 0, frozen: 0, shock: 0, energy: 1, injury: 0, sleepHold: 0 });
  if (next < 0) {
    P.respawn?.(true);                                  // nobody left: the camera rests on the empty camp
    state.events.push({ type: 'expedition', over: true });
    setPhase('over'); overT = 0; restartArmed = false;
  } else {
    state.member = next;
    P.respawn?.(false);                                 // the next one crawls out of the tent
    setPhase('black');
  }
  state.cam.x = P.x; state.cam.y = P.y - 6;
}

export function update(dt) {
  B.t += dt;
  throb = Math.max(0, throb - dt * 5);
  // sleep only skips what's left of the night (explorer.js only offers it after dark)
  for (const e of state.events) if (e.type === 'tent' && e.action === 'sleep' && B.phase === 'alive' && canSleep()) setPhase('sleep');
  // into the water: the cold shock (explorer.js pushes plunge; audio gasps)
  for (const e of state.events) if (e.type === 'plunge') { B.shock = 1; flash = Math.max(flash, e.deep ? 1 : 0.7); }
  flash = Math.max(0, flash - dt * 1.8);
  if (B.phase !== 'over') updateWet(dt);

  switch (B.phase) {
    case 'alive': case 'open': {
      B.rate = killed ? 0 : warmthRate();
      B.warmth = clamp(B.warmth + B.rate * dt);
      if (B.phase === 'open' && B.t >= OPEN) setPhase('alive');
      if (B.phase === 'alive' && ((B.warmth <= 0 && outside()) || killed)) {
        killed = false; B.warmth = 0;
        irisFrom = irisAlive(0);
        setPhase('dying');
        state.events.push({ type: 'death', x: P.x, y: P.y, cause: P.water?.level ? 'water' : 'cold', member: state.member });
      }
      break;
    }
    case 'dying':
      // explorer.js plays the collapse and settles into 'dead'
      // (a climber torn off the wall falls first, so allow the time)
      if ((P.mode === 'dead' && B.t > 1.2) || B.t > 9) { irisFrom = irisAlive(0); setPhase('iris'); }
      break;
    case 'iris':
      if (B.t >= IRIS_IN + BEAT + IRIS_OUT) { handover(); }
      break;
    case 'black':
      if (B.t >= BLACK) { setPhase('open'); state.events.push({ type: 'gust', x: P.x, y: P.y, strength: 0.8 }); }
      break;
    case 'over':
      overT += dt;
      if (overT > 4) {
        // a fresh press after the text is up begins again
        const inp = state.input;
        if (!restartArmed) { restartArmed = true; lastTap = inp.tap?.t ?? -1; lastAct = inp.action || 0; }
        else if ((inp.tap && inp.tap.t !== lastTap) || (inp.action && inp.action !== lastAct)) location.reload();
      }
      break;
    case 'sleep':
      B.warmth = clamp(B.warmth + INSIDE_GAIN * dt);
      if (B.t >= SLEEP_FADE && !slept) {
        // the rest of the night passes: the clock jumps to the first light of the next day
        // (the same dawn the night would have reached; the director picks its forecast then)
        slept = true;
        const L = state.lighting;
        L.clock = 0; L.night = 0; L.nightTarget = 0;
        B.warmth = 1;
        state.events.push({ type: 'tent', action: 'wake', x: P.x, y: P.y });
      }
      if (B.t >= SLEEP_FADE + SLEEP_HOLD + SLEEP_WAKE) { slept = false; setPhase('alive'); }
      break;
  }

  // Sounds of the body: teeth chattering while it still fights the cold (it stops near the
  // end, as shivering does), and a slow heartbeat in the last of it.
  const w = B.warmth;
  if ((B.phase === 'alive' || B.phase === 'open') && outside()) {
    const ch = smooth(0.68, 0.4, w) * (1 - smooth(0.12, 0.05, w));
    chatT -= dt;
    if (ch > 0.03 && chatT <= 0) {
      chatT = lerp(8, 2.2, ch) * (0.7 + Math.random() * 0.6);
      state.events.push({ type: 'chatter', x: P.x, y: P.y, strength: 0.35 + 0.65 * ch, dur: 0.45 + Math.random() * 0.7 * ch + 0.2 * ch });
    }
  }
  const hb = B.phase === 'dying' ? (1 - smooth(1.5, 4.5, B.t)) : (B.phase === 'alive' || B.phase === 'open') && outside() ? smooth(0.3, 0.06, w) : 0;
  if (hb > 0.03) {
    beatT -= dt;
    if (beatT <= 0) {
      const bpm = B.phase === 'dying' ? 28 : lerp(36, 58, smooth(0.02, 0.3, w));
      beatT = 60 / bpm;
      throb = 1;
      state.events.push({ type: 'heartbeat', x: P.x, y: P.y, strength: hb });
    }
  } else beatT = 0;
}

// --- drawing: the end of the line ------------------------------------------------------------------
// The vision narrows only at the very end: the iris sits off the corners until warmth ~0.18,
// then closes to under half the screen by 0.02.
function irisAlive(w) { return lerp(0.42, 1.08, smooth(0.02, 0.2, w)); }   // x half-diagonal

// Before the iris: the edges of sight darken in ink, from warmth ~0.75, so the narrowing is
// gradual and still reads in a white-out. Not an airbrushed vignette: ink bleeding into damp
// paper — a wobbling inner edge, blotchy low-frequency density, and a scatter of stipple dots
// thickening outward. Built once (512 px, per pixel) and only its alpha changes per frame.
let vigCan = null;
function vignetteSprite() {
  if (vigCan) return vigCan;
  const S = 512, H = S / 2;
  vigCan = document.createElement('canvas');
  vigCan.width = vigCan.height = S;
  const g = vigCan.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  // value noise: hashed lattice, smooth-interpolated, three octaves
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };
  const fbm = (x, y) => 0.55 * vn(x, y) + 0.3 * vn(x * 2.1 + 5.2, y * 2.1 + 1.3) + 0.15 * vn(x * 4.3 + 9.1, y * 4.3 + 7.7);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - H) / H, dy = (y - H) / H, r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    // the inner edge wobbles like the hand-drawn death iris, and frays with the noise
    const wob = 1 + 0.05 * Math.sin(ang * 3 + 1.3) + 0.03 * Math.sin(ang * 7 + 0.4) + 0.015 * Math.sin(ang * 13 - 2);
    const n = fbm(x / 46, y / 46);
    const t = clamp((r * wob - 0.5 + (n - 0.5) * 0.22) / 0.42);
    let al = t * t * (3 - 2 * t) * (0.55 + 0.6 * n);           // blotchy density
    // stipple: dots, denser further out, as on the map's drift edges
    if (t > 0.02 && t < 0.9 && hash(x * 1.7, y * 2.3) < 0.035 * t) al = Math.max(al, 0.75 + 0.25 * t);
    al = Math.max(al, smooth(0.9, 0.99, r));                   // solid at the rim: no seam with the fill beyond
    const i = (y * S + x) * 4;
    d[i] = 38; d[i + 1] = 38; d[i + 2] = 38; d[i + 3] = Math.round(255 * clamp(al));
  }
  g.putImageData(img, 0, 0);
  return vigCan;
}

// An ink iris: everything outside a hand-drawn circle goes to ink, with a soft inner edge.
function drawIris(ctx, cx, cy, r, w, h) {
  const n = 72, t = state.time;
  ctx.beginPath();
  ctx.rect(-20, -20, w + 40, h + 40);
  if (r > 0.5) {
    for (let i = 0; i <= n; i++) {
      const a = -i / n * TAU;
      const rr = r * (1 + 0.012 * Math.sin(a * 3 + 1.3) + 0.007 * Math.sin(a * 7 + t * 0.4) + 0.004 * Math.sin(a * 13 - 2));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = INK;
  ctx.fill('evenodd');
  if (r > 0.5) {
    // the soft inner edge, as ink bleeding into damp paper
    // (out past the wobble of the edge, so no pale sliver is left between them)
    const g = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.03);
    g.addColorStop(0, 'rgba(38,38,38,0)');
    g.addColorStop(0.6, 'rgba(38,38,38,0.16)');
    g.addColorStop(0.88, 'rgba(38,38,38,0.6)');
    g.addColorStop(1, 'rgba(38,38,38,1)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.03, 0, TAU); ctx.fill();
  }
}

export function drawOverlay(ctx) {
  const { w, h } = state.view;
  const half = Math.hypot(w, h) / 2;
  const ph = B.phase;
  const live = ph === 'alive' || ph === 'open' || ph === 'sleep';
  // Dim a little as the cold takes hold (from warmth ~0.55; full through the death). No
  // desaturation: the world is already grey, and the signal yellow (tent, coat) must stay
  // findable; the coat's own dulling is the body cue.
  const k = live ? smooth(0.55, 0.04, B.warmth) * (outside() ? 1 : 0) : ph === 'over' ? 1 : ph === 'black' ? 0 : 1;
  if (k > 0.01) {
    ctx.globalAlpha = 0.12 * k;
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Cold shock: a brief white flash as the sea closes over the legs (or the head).
  if (flash > 0.01) {
    ctx.globalAlpha = 0.55 * flash * flash;
    ctx.fillStyle = '#f6f8fa'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // The iris: centred on the explorer (on the tent door as the next one comes out).
  const p = worldToScreen(P.x, P.y - 6);
  const z = state.cam.zoom || 1;
  // from ~0.75 down to 0.3 the edges of sight close in steadily (readable in a white-out,
  // where frost is already full and the figure is tiny)
  const vk = live && outside() ? Math.pow(clamp((0.77 - B.warmth) / 0.47), 0.85) : 0;
  if (vk > 0.01) {
    const R = half * lerp(1.3, 1.0, vk) * (1 - 0.012 * throb);
    ctx.globalAlpha = 0.85 * Math.pow(vk, 0.75);
    ctx.drawImage(vignetteSprite(), p.x - R, p.y - R, 2 * R, 2 * R);
    // past the sprite's edge it's solid ink
    ctx.fillStyle = INK;
    if (p.y - R > 0) ctx.fillRect(0, 0, w, p.y - R);
    if (p.y + R < h) ctx.fillRect(0, p.y + R, w, h - p.y - R);
    if (p.x - R > 0) ctx.fillRect(0, Math.max(0, p.y - R), p.x - R, 2 * R);
    if (p.x + R < w) ctx.fillRect(p.x + R, Math.max(0, p.y - R), w - p.x - R, 2 * R);
    ctx.globalAlpha = 1;
  }
  let r = -1;
  if (live && outside() && B.warmth < 0.2) {
    // the living iris is soft: ink feathered in from half its radius, no edge (the hard,
    // hand-drawn edge is kept for death)
    const ri = irisAlive(B.warmth) * half * (1 - 0.018 * throb * smooth(0.3, 0.05, B.warmth));
    const a = smooth(0.2, 0.12, B.warmth);
    const g = ctx.createRadialGradient(p.x, p.y, ri * 0.5, p.x, p.y, ri);
    g.addColorStop(0, 'rgba(38,38,38,0)');
    g.addColorStop(0.45, `rgba(38,38,38,${0.3 * a})`);
    g.addColorStop(0.8, `rgba(38,38,38,${0.75 * a})`);
    g.addColorStop(1, `rgba(38,38,38,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (ph === 'dying') r = irisFrom * half * (1 - 0.02 * throb);
  else if (ph === 'iris') {
    const beatR = Math.min(34 * z, Math.min(w, h) * 0.3);
    const tt = B.t;
    r = tt < IRIS_IN ? lerp(irisFrom * half, beatR, smooth(0, IRIS_IN, tt))
      : tt < IRIS_IN + BEAT ? beatR * (1 - 0.04 * smooth(IRIS_IN, IRIS_IN + BEAT, tt))
      : lerp(beatR * 0.96, 0, smooth(IRIS_IN + BEAT, IRIS_IN + BEAT + IRIS_OUT, tt));
  } else if (ph === 'black') r = 0;
  else if (ph === 'open') r = lerp(0, half * 1.1, smooth(0, OPEN, B.t));
  else if (ph === 'over') r = lerp(0, Math.min(w, h) * 0.3, smooth(0.5, 3.5, overT));
  if (r >= 0 && r < half * 1.06) drawIris(ctx, p.x, p.y, r, w, h);

  // Sleep: a quick fade to ink, the night passes, then morning.
  if (ph === 'sleep') {
    const tt = B.t, a = tt < SLEEP_FADE ? smooth(0, SLEEP_FADE, tt) : tt < SLEEP_FADE + SLEEP_HOLD ? 1 : 1 - smooth(SLEEP_FADE + SLEEP_HOLD, SLEEP_FADE + SLEEP_HOLD + SLEEP_WAKE, tt);
    if (a > 0.003) { ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }

  // The end of the expedition: the camp, empty, in a small circle of light. A few words.
  if (ph === 'over') {
    const a = smooth(2, 4, overT), rr = Math.min(w, h) * 0.3, s = Math.min(w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(233,233,231,${0.92 * a})`;
    ctx.font = `${Math.round(Math.max(22, s * 0.055))}px 'Playfair Display SC', Didot, Georgia, serif`;
    ctx.fillText('NONE CAME HOME', w / 2, Math.max(s * 0.09, p.y - rr - s * 0.07));
    ctx.font = `italic ${Math.round(Math.max(12, s * 0.022))}px Georgia, serif`;
    ctx.fillStyle = `rgba(233,233,231,${0.6 * a})`;
    ctx.fillText(state.party.map(q => q.name).join('  ·  '), w / 2, Math.max(s * 0.09, p.y - rr - s * 0.07) + s * 0.045);
    const b = smooth(4, 5.5, overT);
    ctx.fillStyle = `rgba(233,233,231,${0.5 * b})`;
    ctx.fillText('tap to begin again', w / 2, Math.min(h - s * 0.06, p.y + rr + s * 0.08));
  }
}

export function drawScreen(ctx) {
  if (!state.debug) return;
  ctx.fillStyle = '#000'; ctx.font = '12px monospace';
  ctx.fillText(`warmth ${B.warmth.toFixed(3)} rate ${(B.rate * 60).toFixed(3)}/min wet ${B.wet.toFixed(2)} rime ${B.frozen.toFixed(2)} ${B.phase} member ${state.member}`, 10, 34);
}
