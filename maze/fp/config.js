// The Maze, first person — the knobs
//
// Defaults for every slider in the gear panel. What you set on the panel is remembered on the
// device (maze.fp.v1) and wins over these; "Reset" puts these back.
//
// fov, stepMs and eye come from the Labyrinth slider session (docs/labyrinth/03-technical-design.md):
// FOV 68 and a ~270ms glide were the values that session locked, so they are where this starts.

const FP_CONFIG = {
  fov: 68,          // degrees, left edge to right edge
  res: 180,         // pixels across the screen's short side the world is drawn at, before it is scaled up
  fog: 0.16,        // how fast things fade with distance, per tile. 0 = no fog at all
  eye: 0.5,         // eye height as a fraction of a wall. The walls are one tile tall
  stepMs: 270,      // one tile forward
  turnMs: 210,      // a quarter turn
  bob: 1.5,         // head bob, in drawn pixels, over one step
  gapH: 0.62,       // how high a crawl gap's opening is, as a fraction of a wall
  walk: 2.31,       // tiles a second at full stick — the top-down's own CONFIG.speed
  stickTurn: 150,   // degrees a second at full stick, sideways
  theme: 'office',  // a key of TEX.themes: 'office' | 'bleached' | 'dusk'
  stick: 'on',      // 'on' shows the stick; 'off' leaves taps and swipes only
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
  swipe: 'drag',    // 'drag': swipe left turns right, the way a finger drags the view. 'point': the other way
  map: 'off',       // 'off' | 'walked' | 'full' — a debug overlay, not the charcoal map
  sec: 'stick',     // which section of the ☰ panel is open
};

const FP_RANGES = {   // [min, max, step, label, panel section]
  fov:       [45, 110, 1, 'FOV', 'look'],
  res:       [90, 360, 10, 'Resolution', 'look'],
  fog:       [0, 0.5, 0.01, 'Fog', 'look'],
  eye:       [0.25, 0.75, 0.01, 'Eye height', 'look'],
  bob:       [0, 6, 0.5, 'Head bob', 'look'],
  gapH:      [0.4, 0.95, 0.01, 'Crawl gap', 'look'],
  walk:      [0.8, 4.5, 0.05, 'Walk speed', 'stick'],
  stickTurn: [50, 320, 5, 'Turn speed', 'stick'],
  accel:     [2, 30, 1, 'Walk snap', 'stick'],
  turnEase:  [2, 40, 1, 'Turn snap', 'stick'],
  deadzone:  [0, 0.6, 0.02, 'Deadzone', 'stick'],
  settle:    [0, 1, 0.05, 'Settle', 'glide'],
  settleDeg: [5, 60, 1, 'Settle angle', 'glide'],
  centre:    [0, 1, 0.05, 'Centre', 'glide'],
  slip:      [0, 1, 0.05, 'Corner slip', 'glide'],
  stepMs:    [100, 700, 10, 'Step ms', 'steps'],
  turnMs:    [80, 600, 10, 'Turn ms', 'steps'],
};
