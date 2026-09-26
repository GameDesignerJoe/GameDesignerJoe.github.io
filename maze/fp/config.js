// The Maze, first person — the knobs
//
// Defaults for every slider in the gear panel. What you set on the panel is remembered on the
// device (maze.fp.v1) and wins over these; "Reset" puts these back.
//
// stepMs and eye come from the Labyrinth slider session (docs/labyrinth/03-technical-design.md).
// fov 75, res 360, fog 0.11, walk 1.2, the half-width squeeze and the lighting (shadow 1, reach 2, darkHalls
// 0.8, darkLevel 0.1, squeezeSlow 0.35) are Joe's, from playing this on his phone.

const FP_CONFIG = {
  fov: 75,          // degrees, left edge to right edge
  res: 360,         // pixels across the screen's short side the world is drawn at, before it is scaled up
  fog: 0.11,        // how fast things fade with distance, per tile. 0 = no fog at all
  bright: 1,        // overall brightness: 1 is as drawn, lower is darker, fog included
  eye: 0.5,         // eye height as a fraction of a wall. The walls are one tile tall
  stepMs: 270,      // one tile forward
  turnMs: 210,      // a quarter turn
  bob: 1.5,         // head bob, in drawn pixels, over one step
  gapW: 0.23,       // how wide a squeeze's slot is, as a fraction of a tile. You are 0.4 across; at a squeeze you narrow to fit
  walk: 1.2,        // tiles a second at full stick (the top-down's CONFIG.speed is 2.31; Joe set 1.2 for this view)
  stickTurn: 150,   // degrees a second at full stick, sideways
  theme: 'office',  // a key of TEX.themes: 'office' | 'bleached' | 'dusk'
  bends: true,      // rails only: holding forward at a bend with only one way on takes you round it
  move: 'glide',    // the stick: 'glide' (free, with quiet help), 'rails' in halls (buffered quarter turns, like the top-down), or 'free'
  // glide's three helps, each 0 (off) to 1 (strong)
  settle: 0.6,      // ease off the turn roughly facing an open way, and the view drifts square to it
  settleDeg: 35,    // how far off an open way (degrees, either side) settling will still take you
  centre: 0.6,      // in a one-wide hall, walking drifts you to its middle
  slip: 0.6,        // a feeler ahead touching a corner slides you sideways past it
  // the stick's own feel
  deadzone: 0.22,   // fraction of the stick's travel that reads as not pushing — the top-down's CONFIG.stickDeadzone
  accel: 10,        // how quickly walking speed catches up with the stick. Higher is snappier
  turnEase: 14,     // how quickly turning catches up with the stick. Higher is snappier, lower is floatier
  words: 3,         // dead ends a maze with words written on their far wall (WALL_WORDS in data/text.js)
  chalkInf: false,  // debug: chalk never runs out
  showPath: false,  // debug: the way out, marked on the floor in gold
  showArrow: false, // debug: an arrow that points at the way out
  // debug: the top-down's own maze knobs, applied in memory only (never to the top-down's save)
  dbgLevel: 'save', dbgStones: 'level',
  dbg_proto: 'off', dbg_size: 'auto', dbg_branch: 'auto', dbg_turns: 'auto', dbg_clusters: 'auto', dbg_braid: 'auto',
  doorRoom: 0.75,   // the chance a room's mouth has a door in it
  doorHall: 0.07,   // and any other one-wide passage between two cells
  doorsOpen: 0.2,   // how many of them are standing open when you arrive. Joe: "about 20%"
  closets: 3,       // closets a maze: narrow doors you can step into and look out of
  father: 2,        // times a maze the father is glimpsed crossing ahead of you. Joe: "once or twice a maze"
  // lighting
  shadow: 1,        // how much the lighting shows: 0 is flat, 1 is full-strength pools and shadow
  reach: 2,         // how far a ceiling lamp's light carries, in tiles, through open floor
  darkHalls: 0.8,   // the chance any straight hall of three or more tiles is one of this view's dark ones
  darkLevel: 0.1,   // how dark a dark hall is: Joe asked for very dim, not black
  squeezeDim: 0.45, // a squeeze is this bright, times the light around it
  squeezeSlow: 0.35, // and you walk through it at this fraction of your speed
  squeezeVeil: 0.72, // how hard it is to see past a squeeze: 1 is black, 0 is clear. Joe: "much more difficult to see into it, but not completely black"
  sound: true,      // music and sound
  music: 'auto',    // which self's track plays: 'auto' follows the maze (as the top-down does), or a key of MUSIC in data/music.js
  sfxVol: 0.9,      // how loud the room is: steps, hum, doors, the squeeze. The music keeps the top-down's own level
  map: 'off',       // 'off' | 'walked' | 'full' — a debug overlay, not the charcoal map
  sec: 'stick',     // which section of the ☰ panel is open
};

const FP_RANGES = {   // [min, max, step, label, panel section]
  fov:       [45, 110, 1, 'FOV', 'look'],
  res:       [90, 360, 10, 'Resolution', 'look'],
  fog:       [0, 0.5, 0.01, 'Fog', 'look'],
  bright:    [0.2, 1.8, 0.05, 'Brightness', 'look'],
  eye:       [0.25, 0.75, 0.01, 'Eye height', 'look'],
  bob:       [0, 6, 0.5, 'Head bob', 'look'],
  gapW:      [0.12, 0.9, 0.01, 'Squeeze width', 'look'],
  walk:      [0.8, 4.5, 0.05, 'Walk speed', 'stick'],
  stickTurn: [50, 320, 5, 'Turn speed', 'stick'],
  accel:     [2, 30, 1, 'Walk snap', 'stick'],
  turnEase:  [2, 40, 1, 'Turn snap', 'stick'],
  deadzone:  [0, 0.6, 0.02, 'Deadzone', 'stick'],
  settle:    [0, 1, 0.05, 'Settle', 'glide'],
  settleDeg: [5, 60, 1, 'Settle angle', 'glide'],
  centre:    [0, 1, 0.05, 'Centre', 'glide'],
  slip:      [0, 1, 0.05, 'Corner slip', 'glide'],
  shadow:    [0, 1, 0.05, 'Shadow', 'light'],
  reach:     [1.5, 10, 0.5, 'Lamp reach', 'light'],
  darkHalls: [0, 1, 0.05, 'Dark halls', 'light'],
  darkLevel: [0, 0.6, 0.02, 'Dark level', 'light'],
  squeezeDim:[0.05, 1, 0.05, 'Squeeze dim', 'light'],
  squeezeSlow:[0.2, 1, 0.05, 'Squeeze slow', 'light'],
  squeezeVeil:[0, 1, 0.02, 'Squeeze veil', 'light'],
  turnMs:    [80, 600, 10, 'Rails turn ms', 'stick'],
  sfxVol:    [0, 1.6, 0.05, 'Room volume', 'sound'],
  words:     [0, 8, 1, 'Wall words', 'debug'],
  doorRoom:  [0, 1, 0.05, 'Room doors', 'debug'],
  doorHall:  [0, 0.5, 0.01, 'Hall doors', 'debug'],
  doorsOpen: [0, 1, 0.05, 'Doors open', 'debug'],
  closets:   [0, 10, 1, 'Closets', 'debug'],
  father:    [0, 6, 1, 'Father', 'debug'],
};
