// The Maze — music presets
//
// One generative preset per self. When a preset lands it becomes the
// brief for a commissioned track.
//
// Loaded by maze-topdown.html before the engine, as a plain script. These
// are the same consts the game has always had, just in their own file.

// ── music: one preset per self. The composer below plays these forever without repeating itself. ──
// root: Hz · scale: semitones · bpm · density: chance a beat carries a note · motif: scale degrees played every few bars (null = none)
// inst: musicbox | pluck | organ | pad | bass | tick · rests: chance of a silent bar · drone: level of the shared bed
const MUSIC = {
  'The Child':          { root: 523.3, scale: [0,2,4,7,9],       bpm: 54, density: 0.35, motif: [0,2,4,2,0,-3],       motifEvery: 4, inst: 'musicbox', rests: 0.25, drone: 0.25, echo: 0.5 },
  'The Cartographer':   { root: 293.7, scale: [0,2,4,5,7,9,11],  bpm: 96, density: 0.6,  motif: [0,4,7,11,7,4],       motifEvery: 3, inst: 'pluck',    rests: 0.1,  drone: 0.3,  echo: 0.35, slip: 0.12 },
  'The Soldier':        { root: 110,   scale: [0,3,5,7,10],      bpm: 72, density: 0.3,  motif: [0,0,-5,0],           motifEvery: 2, inst: 'bass',     rests: 0.35, drone: 0.35, echo: 0.2, pulse: true },
  'The Archivist':      { root: 220,   scale: [0,2,3,5,7,8,10],  bpm: 84, density: 0.45, motif: null,                  motifEvery: 0, inst: 'tick',     rests: 0.15, drone: 0.2,  echo: 0.15 },
  'The Priest':         { root: 146.8, scale: [0,2,3,5,7,9,10],  bpm: 40, density: 0.5,  motif: [0,2,3,2,0,-2,0],     motifEvery: 2, inst: 'organ',    rests: 0.1,  drone: 0.55, echo: 0.7 },
  'The Criminal':       { root: 82.4,  scale: [0,1,3,6,7,10],    bpm: 60, density: 0.35, motif: [0,1,0,-6],            motifEvery: 3, inst: 'bass',     rests: 0.4,  drone: 0.4,  echo: 0.3, detune: 18, grit: true },
  'The One Who Stayed': { root: 220,   scale: [0,2,3,7,8],       bpm: 48, density: 0.3,  motif: [0,3,2,0],             motifEvery: 2, inst: 'pad',      rests: 0.2,  drone: 0.5,  echo: 0.6, exact: true },
  'You':                { root: 523.3, scale: [0,2,4,7,9],       bpm: 58, density: 0.4,  motif: [0,2,4,2,0,-3,0],     motifEvery: 3, inst: 'musicbox', rests: 0.15, drone: 0.25, echo: 0.5 },
  pool:                 { root: 261.6, scale: [0,4,7,11,14],     bpm: 44, density: 0.55, motif: [0,2,4,2],             motifEvery: 2, inst: 'pad',      rests: 0.05, drone: 0.15, echo: 0.8, bright: true },
};
