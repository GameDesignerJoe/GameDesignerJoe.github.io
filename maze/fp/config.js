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
  map: 'off',       // 'off' | 'walked' | 'full' — a debug overlay, not the charcoal map
};

const FP_RANGES = {   // [min, max, step, label]
  fov:    [45, 110, 1, 'FOV'],
  res:    [90, 360, 10, 'Resolution'],
  fog:    [0, 0.5, 0.01, 'Fog'],
  eye:    [0.25, 0.75, 0.01, 'Eye height'],
  stepMs: [100, 700, 10, 'Step ms'],
  turnMs: [80, 600, 10, 'Turn ms'],
  bob:    [0, 6, 0.5, 'Head bob'],
  gapH:   [0.4, 0.95, 0.01, 'Crawl gap'],
};
