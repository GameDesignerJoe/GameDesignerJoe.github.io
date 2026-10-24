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
  // pulse (zoom fraction) and dip (screen px): body.js makes the view breathe when exhausted;
  // rest (zoom multiplier, eased): body.js closes in on a worn-out stop (camera.js applies it)
  // (camera.worldToScreenUI ignores them; menu.js sets state.reduceMotion to switch it off)
  cam: { x: num('x', 1360), y: num('y', 1560), zoom: num('zoom', 0), shakeX: 0, shakeY: 0, pulse: 0, dip: 0 },

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
    // 'collapse' / 'dead' (died of cold, or a fatal fall: crumpled) | 'swim' (out of their depth
    // in open water, or in a hole in the ice, heaving at its edge) | 'crawlout' (heaved out of a
    // hole: belly-down away from it) | 'sink' (died in the water: slips under, no body) |
    // 'gone' (the expedition is over). tent-in / inside / tent-out are the same for either tent: explorer.js
    // sets shelter (below) to the one they're in.
    mode: 'walk',
    // explorer.js also adds water = { level: 0 land | 1 wading | 2 deep, depth, zW } and
    // lostAtSea (true once they've gone under)
    // what's worn: items.js replaces this with getters on state.pack (worn there); setting one
    // wears it / takes it off. explorer.js and body.js read it.
    gear: { snowshoes: false, axes: false, crampons: false },
    sheltered: 0,           // 0..1, hunkered in the lee of rock — weather/audio soften for it
    // explorer.js also writes, for body.js / audio: push (0..1, pushing on and getting somewhere
    // this frame), headwind (0..1, how much of it into the wind), pant (0..1, how blown) and
    // breathPh (0..1, the panting clock: breath in from 0, out from 0.5), resting (stopped bent
    // double), spent (energy gone: sat in the snow) and crawl (spent but crawling on),
    // badLeg (1 right / -1 left: the hurt one) and iceStress (stress of the ice under the feet, thin or a lake; 1 breaks),
    // shelter: the tent they're in or making for (camp.js CAMP_SHELTER / puptent.js PUP_SHELTER: kind
    // 'camp' | 'pup' and how good it is: warm, dry, rest, heal, sleep, storm, leak, food, hunger, muffle, water;
    // body.js and audio.js read it) and door() (that tent's door: ui/pack.js)
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

  // items.js adds the things carried: state.pack = { slots: [{ id, n, worn? } | null] x 10 } (the
  // explorer's pack: everything counts, food stacks to 3), state.sled (the party's supply at base
  // camp, 20 slots) and state.ground = [{ x, y, slots }] (piles dropped on the snow); ITEMS is the
  // registry. ui/pack.js adds state.compass = { phase: 'idle'|'rummage'|'slot'|'out'|'transfer'|
  // 'eat', target: { kind: 'sled'|'fallen'|'ground', x, y } | null, t, ... } (the pack UI; the
  // name is history), which explorer.js reads for the rummage / kneel / eat poses.
  // body.js adds state.body = { warmth, wet, energy, reserve, injury, food, water } (0..1; hidden,
  // no bars; reserve is the day's fatigue and caps energy at body.max), drain (energy / s), frozen (rime on wet clothes, <= wet) and shock (cold-water gasp),
  // splint (the hurt leg is bound: the limp costs half the pace until the next injury),
  // hunger (0..1 below food 0.3), foodRate (food / s) and dizzy (0..1, a lightheaded moment), plus body.phase ('alive' | 'dying' | 'iris' | 'black' | 'open' | 'over' | 'sleep') and
  // body.sleepHold; state.party = [{ name, alive, x, y }] x 4 and state.member (who's playing).
  // Thirst: body.thirst (0..1 below water 0.35), body.parched (0..1 below 0.15), body.waterRate (water / s).
  // A flask's slot carries drinks (0..3). ui/pack.js adds compass.phase 'drink' | 'snow'.
  // fx/thirst.js adds state.thirst = { mirage (0..1 shown), man (the Third Man: x, y, vis, slip...), show(on), episode(on) }.
  // wildlife.js adds state.bear (the polar bear: x, y, ...).
  // fallen.js adds state.fallen = [{ x, y, facing, name, snow, pack }]: the dead, where they lie,
  // with the pack they died with (pack = { slots }; none if the sea took them).
  // puptent.js adds state.pup = { pitched: { x, y, yaw, t, snow } | null, job: { kind: 'pitch'|'strike',
  // x, y, yaw, t, prog 0..3, coll: { t, from, to } | null, tries, ... } | null, nope, press } (the pup tent:
  // where it stands, the work on it; explorer.js kneels to the job and grabs at a collapse).
  // thinice.js adds state.holes = [{ x, y, r, ro, age, freeze, cls, ... }]: holes broken through thin
  // ice or a frozen lake (ro the open radius, shrinking to 0 as it refreezes; cls the terrain class it
  // broke in, 3 or 2); terrain.isWater / waterDepth read it (only over that class).

  // One-frame event bus. Push { type, x, y, ... } during update(); systems later in the
  // update order see it the same frame, then main.js clears it. Known types:
  //   step  { x, y, terrain, foot: 'L'|'R', weight }     (explorer -> footprints, audio)
  //   bark / howl / whine  { x, y }                       (camp dogs -> audio)
  //   penguin / bear       { x, y, kind }                 (wildlife -> audio)
  //   crack { x, y, strength, stress? }  ice (thin or a lake) cracking under a weight (stress: the stress
  //                                   under the feet), or a hole's edge breaking off (thinice -> audio)
  //   creak { x, y, strength }        ice starting to bear the weight (thinice -> audio)
  //   breakthrough { x, y, r }        the ice gave way: a hole (thinice -> audio; the plunge follows)
  //   heave { x, y, stage: 'pull'|'break'|'slip'|'out', axes }   heaving out of a hole: a pull (costs
  //                                   energy), the edge breaking off, sliding back, out onto the ice
  //                                   (explorer -> body, audio)
  //   avalanche { x, y }                                  (weather -> audio)
  //   axe  { x, y, hand: 'L'|'R' }    ice axe strike while climbing   (explorer -> audio)
  //   kick { x, y, foot: 'L'|'R' }    crampon kick into the ice face  (explorer -> audio)
  //   fall { x, y, strength, drop, fatal }   knocked off the feet by wind, or off a wall (drop: px
  //                                   fallen) (explorer -> audio, weather)
  //   impact { x, y, height, severity, fatal }   landed hard from a wall (15+ px): the jolt, the
  //                                   flinch, the crack and grunt; fatal (55+ px) kills (explorer -> body, audio)
  //   injury { x, y, amount, cause: 'fall'|'knock'|'slip', quiet }   hurt (explorer -> body, audio)
  //   splint { x, y, stage: 'start'|'wrap'|'done'|'stop' }   binding the hurt leg (pack -> audio)
  //   vertigo { x, y }                on a wall, past the height that kills: a look down (explorer -> audio)
  //   peel / replant { x, y }         a gust peeling them off the wall / a tap driving the axes back in (explorer -> audio)
  //   shove { x, y, strength }        staggered back by a gust        (explorer -> audio)
  //   gear { item, on, auto }         e.g. snowshoes strapped on / off (pack -> explorer, audio)
  //   rummage { x, y, target? }       started digging in the pack (or the sled / a body / a pile) (pack)
  //   compass / stow { x, y }         the compass taken out / put away (pack)
  //   transfer { id, n, to, x, y }    moved between the pack and the sled / a body (pack -> audio)
  //   pickup / drop { id, n, x, y }   from / onto a pile on the snow (pack -> audio)
  //   full { x, y }                   refused: no room in the pack (or the sled); the slot shakes (pack -> audio)
  //   eat { x, y, stage: 'start'|'chew'|'done'|'stop' }   eating a ration; stop = walked off, not eaten (pack -> audio)
  //   growl { x, y, strength }        an empty stomach (explorer -> audio, which ducks the wind under it)
  //   drink { x, y, stage: 'start'|'gulp'|'done'|'stop', left? }   a pull from the flask (pack -> audio)
  //   snowEat { x, y, stage: 'start'|'scoop'|'chew'|'done'|'stop' }   a mittful of snow (pack -> audio)
  //   thirst { x, y, stage: 'ring'|'swallow'|'head', strength, dur? }   the tinnitus, a dry swallow (body), the
  //                                   headache gesture (explorer) -> audio
  //   mirage { stage: 'start'|'end', strength }   a Fata Morgana episode (fx/thirst)
  //   thirdman { x, y, stage: 'in'|'out'|'step', dissolved?, terrain?, strength? }   the Third Man comes, goes
  //                                   (dissolved: looked at), his faint footstep (fx/thirst -> audio)
  //   dizzy { x, y, strength }        a lightheaded moment from hunger (body)
  //   arrive { x, y }                 walked to the container a press sent them to (explorer -> pack)
  //   tent { action: 'in'|'out'|'sleep'|'wake', x, y, shelter: 'camp'|'pup' }   crawled in / out, held
  //                                   to sleep, morning (explorer -> body; body pushes 'wake')
  //   pitch { x, y, stage: 'start'|'spread'|'poles'|'stake'|'collapse'|'done'|'stop', strength?, tries?,
  //                                   collapses? }   pitching the pup tent: the canvas spread, a pole up, a
  //                                   stake in, the wind bringing it down (strength 0..1), up at last, given up
  //                                   (puptent -> audio)
  //   strike { x, y, stage: 'start'|'pull'|'done'|'stop' }   taking the pup tent down (a stake pulled; done:
  //                                   back in the pack; stop: let go, it stays up) (puptent -> audio)
  //   flap { x, y, strength, inside }  a pitched pup tent's canvas cracking in the wind, close by (puptent -> audio)
  //   death { x, y, cause: 'cold'|'water'|'fall', member }   the body gave out (body -> anyone)
  //   handover { x, y, facing, member, name, sprite, pack }    the next member takes over; sprite is the
  //                                   still of the body left behind, pack its slots (null: lost at sea) (body -> fallen)
  //   expedition { over: true }       all four are dead (body)
  //   chatter { x, y, strength, dur } teeth chattering in the cold (body -> audio)
  //   heartbeat { x, y, strength }    one slow beat near the end (body -> audio)
  //   gust { x, y, strength }         a gust as the next member's iris opens (body -> audio)
  //   shore { x, y, level }           stopped at the edge of open water, looking down (explorer)
  //   plunge { x, y, deep }           into the sea: cold shock (explorer -> body, audio)
  //   splash { x, y, strength, swim? } a wading step or swimming stroke (explorer -> audio)
  //   drip { x, y }                   water dripping off wet clothes (explorer -> audio)
  //   step.wet                        0..1 on step events: soaked boots leave darker prints
  //   step.drag                       0..1 on step events: worn-out boots drag between prints
  //   step.limp, step.bad             0..1, and true on the hurt leg's steps: it drags, prints smear
  //   refuse { x, y, reason }         won't start a climb: 'wind' | 'gear' | 'tired' | 'hurt' | 'parched' (explorer)
  //   rest  { x, y }                  worn out: stopped, hands on knees, a heavy breath out (explorer -> audio)
  //   tired { x, y }                  energy gone: sat down in the snow until it comes back (explorer -> audio)
  //   pant  { x, y, inhale, len, strength }   one ragged breath while blown (explorer -> audio)
  events: [],
};

window.NAS = state; // handy for the console and for automated captures
