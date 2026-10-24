// "Watch it play" (?sim): every number the simulated explorer decides by, in one place, so the
// play can be tuned by watching it. Times are game seconds, distances world px, the body's
// values 0..1 as in body.js. The sim only reads the game and drives it through the player's own
// input; changing these never changes the game itself.
export const SIM = {
  // speed control: ?sim&speed=4, or the + / - keys step through these
  speeds: [1, 2, 4, 6, 8, 12, 16],
  think: 0.2,                     // s between decisions
  ui: { beat: 0.35 },             // a pause between taps on the pack, so it can be followed

  // the radio: it's heard as how quick the blips come (radio.js: gap 0.25 + 2.95 x (1 - near)^1.4 s);
  // a little noise on each listen, as an ear would have
  radio: { noise: 0.003, every: 0.5 },

  // hot and cold: walk a leg, compare the blips at its end with its start
  search: {
    legFar: 160, legNear: 70,     // leg length far off (near 0) .. close (near 1)
    eps: 0.005,                   // a change in the signal smaller than this is "no change" (~8 px)
    turnMin: 90, turnMax: 180,    // colder: turn this many degrees (random side)
    sameTurn: 90,                 // no change: try across
    jitter: 15,                   // warmer: keep on, give or take this
    lost: 0.045,                  // this much below the best spot so far: go back to it
    zone: 0.998,                  // the SOS clear and loud: within ~120 px, no more gradient to follow
    zoneCross: 280,               // how far to walk across the loud zone looking for its edge
    listen: 2,                    // s standing still listening at the start
    maxRatio: 1.8,                // a leg whose way round is longer than this x straight: try another way
    plateau: 200,                 // s with no better signal: the straight way is barred, take long legs the long way round
  },
  // seeing the beacon blink: within this, on screen (less in a white-out, a little more at night)
  spot: { range: 75, whiteoutK: 0.6, nightK: 1.2 },

  // eating, drinking, the splint
  eat: { food: 0.3, water: 0.3, snowWarmth: 0.5, splint: 0.3, tentFood: 0.6, tentWater: 0.75, resupply: 0.4 },   // resupply: no food left in the pack: back to the sled   // tent*: topping up by the stove
  // stopping to get the wind back (energy); and the cap (reserve) low enough to want a sleep
  rest: { below: 0.22, burdenBelow: 0.3, until: 0.75, maxWait: 80, sleepMax: 0.45 },
  // snowshoes: put on when this share of the next stretch is deep snow; off with ice just ahead
  // (as the numbers stand they're quicker and cheaper on plain snow too: snowAhead puts them on for that)
  shoes: { deepAhead: 0.2, snowAhead: 0.7, look: 70, iceLook: 24, backOn: 25 },   // backOn: s after coming off before they go back on for plain snow

  // climb or go round: only when the way round is this much longer than straight
  climb: {
    detourRatio: 1.35, detourMin: 70,
    margin: 0.08,                 // energy to spare over what the wall will take (the game refuses under 1.15 x)
    energyK: 90,                  // s of walking one whole energy is worth, comparing climb and detour (~a minute's rest + the day's wear)
    tapEvery: 0.3,                // s between taps on the wall
    look: 260,                    // how far along the straight line to look for a wall
  },

  // the path planner: per-px weight of each kind of ground, by how they're going (walk / shoes in the
  // pack / carrying / dragging). Deep snow on foot ~2.3x the time and ~9x the energy of snow.
  cost: {
    walk:  { snow: 1, deep: 3.2, ice: 1.4, thin: 14, path: 0.75, edge: 15 },   // edge: the frontier storm's band (it kills)
    shoes: { snow: 0.9, deep: 1.5, ice: 1.4, thin: 14, path: 0.75, edge: 15 },
    carry: { snow: 1, deep: 1.1, ice: 2.2, thin: 40, path: 0.8, edge: 15 },
    drag:  { snow: 1, deep: 5, ice: 1.2, thin: 40, path: 0.8, edge: 15 },
    bear: { r: 140, k: 3 },        // a wide berth round where the bear was last seen
  },
  // carry or drag (burden.js, measured): pace px/s and energy per minute, by ground
  burden: {
    carry: { snow: [6.5, 0.317], deep: [5.7, 0.317], ice: [6, 0.4], path: [7.5, 0.16] },
    drag: { snow: [9.75, 0.233], deep: [1.8, 0.933], ice: [8, 0.2], path: [10.5, 0.12] },
    energyK: 200,                 // s one whole energy is worth in the comparison
    recheck: 12,                  // s between looks at the ground ahead (switch?)
    dwell: 40,                    // s at least in one way before switching
    switchGain: 0.3,              // switch only if the other way is this much better ahead
    ahead: 160,
  },

  // camp: night, storms, the cold
  camp: {
    dusk: 168,                    // clock (day is 0-180, night 180-300): time to decide about the night
    baseNear: 280,                // base camp this close (straight line): go there rather than pitch
    goOnWarmth: 0.7, goOnMax: 0.6, // keep going through the night only this warm and this rested
    stormWind: 0.82,              // the sustained wind over this, or a storm spell: shelter
    shelterWarmth: 0.4,           // this cold: shelter
    wetShelter: 0.3,              // this wet (through the ice, wading): shelter at once, out again dry
    leaveWarmth: 0.85,            // ...out again once this warm
    calmWind: 0.6,                // storm over once the wind is under this
    pitchTries: 3,
    pupWalk: 250,                 // a pup tent left standing this near: walk back to it rather than base camp
    fallenFetch: 600,             // a fallen member this near with a tent or snowshoes the sled no longer has: fetch them
  },
  // the bear
  // wary: back off from a hunting bear this close (explorer.js backs off facing it only within 110); clear: done
  // once it's this far; memory: s it's still 'there' after slipping out of view
  bear: { wary: 110, clear: 140, flare: 75, raise: 90, shoot: 60, memory: 8 },

  // packing at the sled: in this order until the 10 slots are full; a pair only if both fit
  pack: [
    { id: 'food', n: 6, why: 'the sled is all the food there is' },
    { id: 'snowshoes', why: 'deep snow out there: quicker and a third of the drain' },
    { id: 'puptent', why: 'for a night or a storm far from base' },
    { id: 'sheet', learned: 'wrap', why: 'to wrap the body' },
    { id: 'rope', learned: 'wrap', why: 'to tie the wrapping' },
    { id: 'flare', n: 1, why: 'scares a bear off' },
    { id: 'axes', pair: 'crampons', why: 'climb a cliff instead of going round' },
    { id: 'crampons', needs: 'axes', why: 'the axes need them' },
    { id: 'rifle', pair: 'cartridges', why: 'if the bear charges' },
    { id: 'cartridges', n: 5, needs: 'rifle', why: 'for the rifle' },
  ],
  leave: [{ id: 'compass', why: 'the radio does the finding' }],
  knowsWrap: false,               // true: packs the sheet and rope from the start (else learned at the body)
  rememberLearned: true,          // what one run learns (the sheet and rope) the next ?sim=loop run knows
  loot: ['food', 'splint', 'rec_sos', 'radio', 'flask'],   // taken from a body's pack, if there's room
  fallenLoot: ['radio', 'food', 'snowshoes', 'puptent', 'flare', 'flask', 'sheet', 'rope'],   // ...and from a fallen member's

  stuck: { window: 4, minGain: 2, giveUp: 7, watchdog: 150 },
  maxRunMin: 90,                  // game minutes before a run is called off
  loopDelay: 4,                   // real s before ?sim=loop starts the next run
  showPath: true,                 // the planned path and the best spot drawn faintly in the world
};

// ?simset=climb.energyK:20,camp.dusk:150 sets any of these from the URL for a run (numbers, true/false).
for (const kv of (new URLSearchParams(location.search).get('simset') || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split(':'), path = k.split('.');
  let o = SIM;
  for (const p of path.slice(0, -1)) o = o?.[p];
  const last = path[path.length - 1];
  if (o && last in o) o[last] = v === 'true' ? true : v === 'false' ? false : Number.isFinite(+v) ? +v : v;
  else console.warn('[sim] simset: no such setting', k);
}

// The sim's shared state (state.sim): the log, the summary, what it's doing.
export const S = {
  on: false, goal: '', recent: [], log: [], runs: [], stats: null, path: null, best: null,
  pressed: false, shore: 0, lastRefuse: null, member: 0,
};
