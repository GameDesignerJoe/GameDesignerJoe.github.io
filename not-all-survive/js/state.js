// The single shared mutable object. Every module reads and writes it directly.
// World units are pixels of the painted map (assets/map-sharp.webp, 2464 x 1856).

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);

export const MAP_W = 2464;
export const MAP_H = 1856;

export const state = {
  params,
  debug: params.has('debug'),
  started: params.has('autostart') || params.has('demo'),

  time: 0,          // seconds since boot (scaled by params ?speed)
  dt: 0,
  timeScale: num('speed', 1),

  view: { w: 0, h: 0, dpr: 1 },   // CSS pixel size of the canvas
  cam: { x: num('x', 1360), y: num('y', 1560), zoom: num('zoom', 0), shakeX: 0, shakeY: 0 },

  // Input intent, normalised. input.js writes it; the explorer reads it.
  input: { x: 0, y: 0, active: false, pointer: null },

  player: {
    x: num('x', 1360), y: num('y', 1560),
    vx: 0, vy: 0,
    facing: Math.PI / 2,    // radians, 0 = east (+x), PI/2 = south (+y, toward camera)
    speed: 0,               // world px / s actually travelled this frame
    moving: false,
    terrain: 'snow',        // terrain under the feet (see terrain.js TERRAIN)
    lean: 0,                // 0..1, how hard they're pushing (explorer.js owns it)
    exposure: 0,            // 0..1, how exposed to wind they are (weather.js may read)
  },

  // weather.js owns these; everyone else reads them. It also adds weather.phase,
  // weather.ctl (console controls), weather.lastAvalanche, and writes cam.shakeX/Y.
  // weather.light dimming is applied by weather.js itself — don't dim again elsewhere.
  wind: { angle: num('windAngle', Math.PI * 0.08), speed: num('wind', 0.45), gust: 0 },
  weather: { whiteout: num('whiteout', 0), snowfall: num('snow', 0.5), light: 1 },

  // One-frame event bus. Push { type, x, y, ... } during update(); systems later in the
  // update order see it the same frame, then main.js clears it. Known types:
  //   step  { x, y, terrain, foot: 'L'|'R', weight }     (explorer -> footprints, audio)
  //   bark / howl / whine  { x, y }                       (camp dogs -> audio)
  //   penguin / bear       { x, y, kind }                 (wildlife -> audio)
  //   crack { x, y, strength }                            (thin ice -> audio)
  //   avalanche { x, y }                                  (weather -> audio)
  events: [],
};

window.NAS = state; // handy for the console and for automated captures
