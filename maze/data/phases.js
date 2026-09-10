// The Maze — progression
//
// Which self you are, what their maze allows, and the seven stones. See
// docs/PROGRESSION.md for why each stone holds down the knob it does.
//
// Loaded by maze-topdown.html before the engine, as a plain script. These
// are the same consts the game has always had, just in their own file.

// ── phases: what the maze allows and what you carry, per self ──
// features: which existing systems are switched on. burden lifts are applied by count of stones put down (SAVE.stones).
const PHASES = [
  { who: 'The Child',          size: 'sm', bodyScale: 0.68, f: { signs: false, charcoal: false, compass: false, thread: false, scraps: false, lamp: false, darkness: false, gate: false, tunnels: false, pockets: false, pathSlider: false, braid: 0, rooms: 1.4, crawl: 5, swing: 3, figure: true, hopscotch: true } },
  { who: 'The Cartographer',   size: 'md', f: { signs: false, charcoal: true,  compass: false, thread: false, scraps: false, lamp: false, darkness: false, gate: false, tunnels: false, pockets: true,  pathSlider: false, doors: 1, braid: 0.06 } },
  { who: 'The Soldier',        size: 'md', f: { signs: true,  charcoal: true,  compass: true,  thread: false, scraps: false, lamp: false, darkness: false, gate: false, tunnels: true,  pockets: true,  pathSlider: true,  doors: 2, braid: 0.06 } },
  { who: 'The Archivist',      size: 'lg', f: { signs: true,  charcoal: true,  compass: true,  thread: false, scraps: true,  lamp: false, darkness: false, gate: false, tunnels: true,  pockets: true,  pathSlider: true,  doors: 2, braid: 0.06, rooms: 1.6 } },
  { who: 'The Priest',         size: 'lg', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: [0.25], gate: false, tunnels: true, pockets: true, pathSlider: true, doors: 3, braid: 0.06 } },
  { who: 'The Criminal',       size: 'lg', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: [0.25, 0.4, 0.6], gate: true, tunnels: true, pockets: true, pathSlider: true, doors: 3, braid: 0.06 } },
  { who: 'The One Who Stayed', size: 'xl', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: [0.25, 0.4, 0.6], gate: false, tunnels: true, pockets: true, pathSlider: true, doors: 3, braid: 0.06 } },
  { who: 'You',                size: 'sm', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: false, gate: false, tunnels: true, pockets: true, pathSlider: false, doors: 1, braid: 0.06 } },
];

// the seven stones, in the order they are put down; each lifts one restriction a little, for good
const STONES = ['Sight', 'Pace', 'Memory', 'Fear', 'Direction', 'Shame', 'Scale'];
