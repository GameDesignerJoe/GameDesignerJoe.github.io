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
  input: { x: 0, y: 0, active: false, pointer: null, tap: null, action: 0 },

  player: {
    x: num('x', 1360), y: num('y', 1560),
    vx: 0, vy: 0,
    facing: Math.PI / 2,    // radians, 0 = east (+x), PI/2 = south (+y, toward camera)
    speed: 0,               // world px / s actually travelled this frame
    moving: false,
    terrain: 'snow',        // terrain under the feet (see terrain.js TERRAIN)
    lean: 0,                // 0..1, how hard they're pushing (explorer.js owns it)
    exposure: 0,            // 0..1, how exposed to wind they are (weather.js may read)
    // explorer.js owns it: 'walk' | 'approach' (walking to a climb or the tent door) | 'climb' |
    // 'refuse' | 'down' (knocked over) | 'cower' | 'tent-in' / 'inside' (hidden) / 'tent-out' |
    // 'collapse' / 'dead' (died of cold) | 'gone' (the expedition is over: no explorer)
    mode: 'walk',
    gear: { snowshoes: false, axes: false, crampons: false },   // equipped items (the pack in ui/compass.js toggles them)
    sheltered: 0,           // 0..1, hunkered in the lee of rock — weather/audio soften for it
  },

  // weather.js owns these; everyone else reads them. It also adds weather.phase,
  // weather.ctl (console controls), weather.lastAvalanche, and writes cam.shakeX/Y.
  // weather.light dimming is applied by weather.js itself — don't dim again elsewhere.
  wind: { angle: num('windAngle', Math.PI * 0.08), speed: num('wind', 0.45), gust: 0 },
  weather: { whiteout: num('whiteout', 0), snowfall: num('snow', 0.5), light: 1,
    // temp in degrees C and cold 0..1 (0 = a mild -10, 1 = a deadly -45 with wind chill).
    // The weather director owns them; frost, breath, shivering and the snow squeak read them.
    temp: -18, cold: 0.3,
    // Today's forecast, chosen once per day/night cycle by the weather director, e.g.
    // { id: 'clear'|'bright'|'breezy'|'overcast'|'eveningStorm'|'blizzard', ... }.
    forecast: null },

  // Lighting. night eases toward nightTarget (0 = day, 1 = full night). night.js runs a
  // day/night cycle (3 min day, 2 min night) unless lighting.mode is pinned to 'day' or
  // 'night' (gear menu, ?day, ?night). Actors push
  // warm light sources into lights each frame: { x, y, r (world px), intensity 0..1 }.
  // night.js clears the list after drawing.
  lighting: { night: params.has('night') ? 1 : 0, nightTarget: params.has('night') ? 1 : 0,
    // bright: a blinding clear day (glare, washed-out detail). Eases toward brightTarget;
    // ?bright and the gear menu set it. Only shows by day.
    bright: params.has('bright') ? 1 : 0, brightTarget: params.has('bright') ? 1 : 0,
    // null = the weather director decides; true/false = pinned by the gear menu or ?bright.
    brightForced: params.has('bright') ? true : null },
  lights: [],

  // frontier.js adds state.frontier = { amount 0..1, inX, inY }: how deep into the
  // world-edge storm border the explorer is, and which way is back toward the interior.

  // body.js adds state.body = { warmth, wet, energy, injury, food, water } (0..1; hidden, no
  // bars), plus body.phase ('alive' | 'dying' | 'iris' | 'black' | 'open' | 'over' | 'sleep') and
  // body.sleepHold; state.party = [{ name, alive, x, y }] x 4 and state.member (who's playing).
  // fallen.js adds state.fallen = [{ x, y, facing, name, snow }]: the dead, where they lie.

  // One-frame event bus. Push { type, x, y, ... } during update(); systems later in the
  // update order see it the same frame, then main.js clears it. Known types:
  //   step  { x, y, terrain, foot: 'L'|'R', weight }     (explorer -> footprints, audio)
  //   bark / howl / whine  { x, y }                       (camp dogs -> audio)
  //   penguin / bear       { x, y, kind }                 (wildlife -> audio)
  //   crack { x, y, strength }                            (thin ice -> audio)
  //   avalanche { x, y }                                  (weather -> audio)
  //   axe  { x, y, hand: 'L'|'R' }    ice axe strike while climbing   (explorer -> audio)
  //   kick { x, y, foot: 'L'|'R' }    crampon kick into the ice face  (explorer -> audio)
  //   fall { x, y, strength }         knocked off the feet by wind    (explorer -> audio, weather)
  //   shove { x, y, strength }        staggered back by a gust        (explorer -> audio)
  //   gear { item, on, auto }         e.g. snowshoes strapped on / off (pack -> explorer, audio)
  //   tent { action: 'in'|'out'|'sleep'|'wake', x, y }   crawled in / out, held to sleep, morning
  //                                   (explorer -> body; body pushes 'wake')
  //   death { x, y, cause: 'cold', member }               the body gave out (body -> anyone)
  //   handover { x, y, facing, member, name, sprite }    the next member takes over; sprite is the
  //                                   still of the body left behind (body -> fallen)
  //   expedition { over: true }       all four are dead (body)
  //   chatter { x, y, strength, dur } teeth chattering in the cold (body -> audio)
  //   heartbeat { x, y, strength }    one slow beat near the end (body -> audio)
  events: [],
};

window.NAS = state; // handy for the console and for automated captures
