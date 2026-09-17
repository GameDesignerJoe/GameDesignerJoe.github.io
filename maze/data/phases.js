// The Maze — progression
//
// Which self you are, what their maze allows, and the seven stones. See
// docs/PROGRESSION.md for why each stone holds down the knob it does.
//
// Loaded by maze-topdown.html before the engine, as a plain script. These
// are the same consts the game has always had, just in their own file.

// ── phases: what the maze allows and what you carry, per self ──
// features: which existing systems are switched on. burden lifts are applied by count of stones put down (SAVE.stones).
// shrines: whose statues stand in this chapter's maze — one person to a chapter, both statues theirs.
// Joe: "child chapter has statues of the father. The mom gets another one, and the friend and so on
// to the Teen getting the last one." Each person has four exchanges and a maze holds two statues,
// so a person needs two chapters to be heard out: father, mother, spouse get both; friend and the
// Teen get one each, the Teen last, in the chapter where the make-believe is stripped away. Change
// a word here to move them. The ids are PEOPLE's in data/text.js.
const PHASES = [
  { who: 'The Child',          size: 'md', bodyScale: 0.68, f: { turns: 'sparse', shrines: 'father', signs: false, charcoal: false, compass: false, thread: false, scraps: false, lamp: false, darkness: false, gate: false, tunnels: false, pockets: false, pathSlider: false, braid: 0, rooms: 1.4, crawl: 5, swing: 3, figure: true, hopscotch: true } },
  { who: 'The Cartographer',   size: 'md', f: { signs: false, charcoal: true,  compass: false, thread: false, scraps: false, lamp: false, darkness: false, gate: false, tunnels: false, pockets: true,  pathSlider: false, doors: 1, shrines: 'mother', braid: 0.06 } },
  { who: 'The Soldier',        size: 'md', f: { signs: true,  charcoal: true,  compass: true,  thread: false, scraps: false, lamp: false, darkness: false, gate: false, tunnels: true,  pockets: true,  pathSlider: true,  doors: 2, shrines: 'friend', braid: 0.06 } },
  { who: 'The Archivist',      size: 'lg', f: { signs: true,  charcoal: true,  compass: true,  thread: false, scraps: true,  lamp: false, darkness: false, gate: false, tunnels: true,  pockets: true,  pathSlider: true,  doors: 2, shrines: 'spouse', braid: 0.06, rooms: 1.6 } },
  { who: 'The Priest',         size: 'lg', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: [0.25], gate: false, tunnels: true, pockets: true, pathSlider: true, doors: 2, shrines: 'father', braid: 0.06 } },
  { who: 'The Criminal',       size: 'lg', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: [0.25, 0.4, 0.6], gate: true, tunnels: true, pockets: true, pathSlider: true, doors: 2, shrines: 'mother', braid: 0.06 } },
  { who: 'The One Who Stayed', size: 'xl', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: [0.25, 0.4, 0.6], gate: false, tunnels: true, pockets: true, pathSlider: true, doors: 2, shrines: 'spouse', braid: 0.06 } },
  { who: 'You',                size: 'sm', f: { signs: true,  charcoal: true,  compass: true,  thread: true,  scraps: true,  lamp: true,  darkness: false, gate: false, tunnels: true, pockets: true, pathSlider: false, doors: 1, shrines: 'teen', braid: 0.06 } },
];

// ── the contract: what each chapter's maze must HOLD ──
//
// `f` above says what is switched on. This says what the maze has to deliver,
// which is a different question and the one that kept going unanswered: the
// vault code, the gauntlet code and the door code all existed, and a maze could
// ship without using any of them because nothing insisted. See docs/QUALITY.md
// for the measurement that found it — from The Soldier on, 0–3% of mazes had
// all their keys buried, and no self but The Child had anything guarding its
// exit at all.
//
// Every clause is a FLOOR, not a target: `roomGap: 18` means no two rooms
// closer than 18 tiles apart. A clause a chapter does not name is not checked,
// so a chapter with no doors is not failing to bury its keys.
//
//   keysVaulted  'all', or how many keys must lie in a nest rather than a hall
//   exitGuard    tiles of squeeze gauntlet standing between you and the way out
//   keyDetour    tiles the keys must add to the walk, over going straight out
//   roomGap      tiles between the two closest rooms
//   thresholds   places the maze divides in two (a 15% split, see contract.js)
//
// These numbers are Joe's, and meant to be argued with — `tuner.html` shows
// what a block of mazes does against them and redraws as they change. The value
// the game manages today is in the comment beside each, from QUALITY.md at
// v0.93.0. Where today's value already clears the clause, the clause is there
// to stop it drifting back.
//
// A clause the generator cannot reach stays red however many builds it tries;
// that is the point of writing it down rather than arguing about it. It never
// stalls the game — generate() takes the best maze it found and says it fell
// short. `thresholds` is the known one: nothing in the current generator
// reaches 2, which is the structural work QUALITY.md ends on.
// How these first numbers were picked, so they can be argued with properly:
//
//   keysVaulted  'all'. Not a stretch — a statement. 0–3% of mazes manage it.
//   keyDetour    set just under the worst maze the generator makes today, so it
//                holds a line rather than chasing one. The keys are ALREADY the
//                best thing in the game at lengthening a route: they add 36–93%
//                to the optimal walk (QUALITY.md). Nothing here needs the walk
//                longer; the clause is to stop it shortening.
//   roomGap      set to reject roughly the worst quarter, so the retry loop has
//                something it can actually chase.
//   exitGuard    nothing but The Child HAS a gauntlet, so these stay red until
//                one is built for the other selves. That is the point of writing
//                it down: the red is the missing feature, not a bad seed.
//   thresholds   1 is out of reach for every self but The Child, at any setting
//                of any knob. Left in and left red on purpose — it is the
//                structural work QUALITY.md ends on, and the tuner is where it
//                should be visible rather than in an argument.
//
// "today" below is the median over nine mazes, with the range, from tuner.html
// at v0.93.0.
const MUST = {
  'The Child':          {                     exitGuard: 12,                 roomGap: 10, thresholds: 1 },
  //                    today: no keys       ·  16 tiles  ·  no doors       ·  14 (4–40) ·  1 (0–2)
  'The Cartographer':   { keysVaulted: 'all', exitGuard: 8,  keyDetour: 40, roomGap: 14, thresholds: 1 },
  //                    today: 93% of mazes  ·  0 tiles   ·  54 (38–96)     ·  24 (6–44) ·  0 (0–2)
  'The Soldier':        { keysVaulted: 'all', exitGuard: 8,  keyDetour: 45, roomGap: 12, thresholds: 1 },
  //                    today: 3%            ·  0         ·  60 (40–128)    ·  18 (6–36) ·  0 (0–1)
  'The Archivist':      { keysVaulted: 'all', exitGuard: 10, keyDetour: 65, roomGap: 8,  thresholds: 1 },
  //                    today: 0%            ·  0         ·  88 (60–136)    ·  6 (2–8)   ·  0 (0–2)
  //                    Its rooms knob is the highest in the game, and 11 rooms in a lg maze is why
  //                    its gap is the worst in the game. v0.102.0 added the spread rule
  //                    (roomSpreadTries): min 0→8, median 8→10 over 60 seeds. Fewer rooms is
  //                    the lever left, and it is Joe's.
  'The Priest':         { keysVaulted: 'all', exitGuard: 10, keyDetour: 45, roomGap: 10, thresholds: 1 },
  //                    today: 3%            ·  0         ·  60 (40–154)    ·  10 (8–20) ·  0 (0–1)
  'The Criminal':       { keysVaulted: 'all', exitGuard: 12, keyDetour: 55, roomGap: 10, thresholds: 1 },
  //                    today: 0%            ·  0         ·  90 (40–140)    ·  10 (8–16) ·  0 (0–0)
  'The One Who Stayed': { keysVaulted: 'all', exitGuard: 12, keyDetour: 60, roomGap: 10, thresholds: 1 },
  //                    today: 0%            ·  0         ·  72 (56–102)    ·  10 (6–16) ·  0 (0–0)
  'You':                { keysVaulted: 'all', exitGuard: 8,  keyDetour: 15, roomGap: 10, thresholds: 1 },
  //                    today: 77%           ·  0         ·  24 (4–56)      ·  under two rooms · 1 (0–1)
};

// ── the giant: every feature the game has, in one maze ten X-Larges big ──
// Joe: "I want to make a prototype of the biggest map we could possibly make. 10 times the size of
// our biggest map... with all the features we have to put in it." This is the feature row for it,
// used in place of the phase's own when the Prototype menu says `giant`. Everything on, and the
// numbers that are counts sit at the top of their range: three doors, the Child's squeezes and
// swings, the full ladder of darkness with a lamp to find, statues, a figure, hopscotch.
// It is a prototype: no contract row and no rebuild for a better deal — one maze, however it comes.
const GIANT_F = { signs: true, charcoal: true, compass: true, thread: true, scraps: true, lamp: true, darkness: [0.25, 0.4, 0.6],
  gate: true, tunnels: true, pockets: true, pathSlider: true, doors: 3, shrines: 'father', braid: 0.06, rooms: 1.6,
  crawl: 12, swing: 4, figure: true, hopscotch: true };

// the seven stones, in the order they are put down; each lifts one restriction a little, for good
const STONES = ['Sight', 'Pace', 'Memory', 'Fear', 'Direction', 'Shame', 'Scale'];
