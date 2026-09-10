// The Maze — tuning
//
// Edit a value, refresh, get a different maze. The comments are design
// intent — read them before changing anything.
//
// Loaded by maze-topdown.html before the engine, as a plain script. These
// are the same consts the game has always had, just in their own file.

// ───────────────────────────────────────────────────────────────
// CONFIG — edit these, refresh, get a different feel.
// Joystick: push a direction; the block glides and takes the turn at the
// next opening in that direction. Tap the block (or the chalk counter) to spend
// Tap the chalk, pick a sign, and it goes on the floor where you stand. Marks are permanent.
// Refresh = new maze. Add ?seed=1234 to the URL to replay a specific one.
// Gear (top-left) = debug options + "Update app" (hard refresh).
// ───────────────────────────────────────────────────────────────
const SIZES = { xs: [7, 10], sm: [10, 14], md: [14, 20], lg: [20, 28], xl: [28, 40] };   // cells across × down; each step doubles the area

const CONFIG = {
  size: 'md',           // sm | md | lg | xl  (debug menu)
  cols: 14,             // set from size at generation
  rows: 20,
  // the debug menu's Full map view: tap a spot to stand there, pinch or scroll to zoom
  debugMapMinZoom: 0.6, // how far below the fitted scale you may zoom out, as a multiple of it
  debugMapMaxZoom: 64,  // how far in you may zoom, in screen pixels per tile
  debugTapSlop: 10,     // a press that travels less than this many pixels is a tap, not a drag
  debugTapReach: 2,     // tap a wall and it takes the nearest floor within this many tiles
  tilePx: 60,           // zoom: screen pixels per tile
  titleTilePx: 150,     // zoom while asleep on the title screen
  introSeconds: 2.8,    // zoom-out when you tap the sleeper
  // waking one burden lighter, in two beats. You are still in the old dark when you tap: first a
  // band of him goes pale with a breath of a sound, then the light is cut out to its new size all
  // at once and the camera goes with it. Slowly fading into it said nothing at all.
  liftBandSec: 1.1,     // the band of him going pale, before anything else happens
  liftBurstSec: 0.45,   // and the light opening out. Short on purpose: this is the beat that reads
  liftGlowFrom: 0.55,   // the old light, as a fraction of the one you now have
  viewRadius: 1.0,      // cells of visibility around you
  fogSoftness: 1.4,     // how many tiles the light takes to fade to black
  // texture: an overlay to age the concrete. The Texture debug menu picks one; off by default,
  // because which one the maze wants is a look to be chosen by eye, not a value to tune.
  // the floor itself: the room the Child grew up in. Not a screen effect — these are marks in
  // the concrete, in the same place every time you come back, because he has always lived here.
  floorWorn: 0.55,      // how much the floor polishes along the ways people actually walk. 0 = off
  floorWearReach: 7,    // how many tiles either side of the main route still show that traffic
  floorGrime: 0.6,      // how much dirt gathers along the wall edges and in the corners. 0 = off
  floorLights: 0.55,    // ceiling fixtures pooling light on the floor. 0 = off
  floorLightSpacing: 6, // cells between them
  floorLightBad: 0.5,   // share of them with something wrong, that stutter and drop out
  textureAmount: 0.55,  // how strongly Damp and Dust are laid over the picture
  textureGrain: 0.28,   // Grain has its own, at half: it covers every pixel, so it counts double
  textureDamp: 26,      // blotches per maze in Damp mode, placed from the seed so they hold still
  textureMotes: 46,     // drifting motes in Dust mode
  markGhostAlpha: 0,    // how brightly your own chalk shows through the fog. 0 = not at all, which is
                        // the point of fog. 0.35 was the old 'a mark is a beacon you left yourself'
  speed: 2.31,          // tiles per second while the stick is held
  pushHoldMs: 260,      // lean into a slider's edge this long before it moves
  turnBufferMs: 400,    // a perpendicular push is remembered this long and taken at the next opening
  turnForgiveness: 0.5, // how far off a tile center you can still take a turn (0.5 = anywhere in the tile)
  stickDeadzone: 0.22,  // fraction of stick travel that reads as "not pushing"
  playerSize: 0.46,     // fraction of a tile
  playerOutline: 0.13,  // a pale edge round the body, as a fraction of its radius. Carrying every
                        // stone he is nearly black, and on a dark floor the outline is the only
                        // thing that keeps him findable. 0 = none, and he starts truly invisible
  cameraLag: 0.14,      // 0 = locked on player, higher = floatier

  // prototypes: small purpose-built levels, from the Prototype dropdown in the debug menu
  protoSize: [7, 9],    // the island grid, in cells
  protoPath: 9,         // how many islands the way out runs through
  protoDecoyChance: 0.8,// chance a block on that way also offers one that goes nowhere
  protoStraightBias: 1, // of those, how often it goes straight through (up/down, left/right)
                        // rather than round an elbow, when there is room for either. Straight needs
                        // the square behind the block to be free and often it is not, so at 1 they
                        // still only come out about a third of the two-way blocks
  protoTries: 60,       // layouts to try before settling for one that is merely finishable

  // maze shape
  branchiness: 0.35,    // 0 = long winding corridors (backtracker). 1 = many short branches and junctions (Prim-like). Play with this.
  braid: 0.0,           // 0 = perfect maze. 0.1 opens 10% of dead ends into loops
  hallStraightness: 0,  // when carving, chance of carrying straight on rather than turning. 0 = today's snaking.
                        // 0.9 = long straight halls that only turn when they must
  hallFill: 1.0,        // share of the grid the maze is allowed to use. 1 = fill every cell (today).
                        // 0.55 = carve, then prune dead-end branches back until only 55% is corridor —
                        // the rest is solid wall. Fewer branches, longer runs, real dead space
  turnsPresets: {       // the Turns debug menu. Each may also set branch, used when Branching is Auto
    fewer:  { straight: 0.85, fill: 1.0,  branch: 0.05 },
    sparse: { straight: 0.65, fill: 0.65, branch: 0.10 },   // Least's dead space, but the halls bend twice as often and run half as far
    least:  { straight: 0.95, fill: 0.55, branch: 0.02 },
  },
  // districts: patches of maze with a character of their own, stamped over the halls once
  // they and the rooms are carved. Inside one, the links are re-cut to a "heart"; every link
  // to the world outside is left alone, so a district can only add connections, never cut one.
  clusters: 1,          // how many per medium maze. Scales with area: xl gets 4, lg 2, sm none. 0 = off
  clusterCells: [4, 7], // district size range, in cells, drawn separately for width and height
  clusterLiveShare: 0.4,// skip a patch unless this share of it is already corridor — no districts adrift in dead space
  clusterHearts: ['rings', 'thicket', 'comb', 'lattice', 'squeeze', 'shifting'],
                        // rings: nested loops, so you keep coming round to where you were
                        // thicket: short branching paths, a knot of junctions
                        // comb: a spine with long dead-end teeth off alternating sides
                        // lattice: every link open — a field of pillars with no landmarks at all
                        // squeeze: sparse halls, and most of the walls between them are crawl gaps
                        // shifting: a dense double comb where nearly every stub is a moving block
  clusterCrawlGaps: 8,  // extra crawl gaps allowed inside each squeeze district
  clusterSliders: 8,    // extra sliders allowed inside each shifting district
  rooms: 3,             // open spaces carved into the maze
  roomCells: [2, 3],    // room size range, in cells (2 = 3×3 tiles, 3 = 5×5 tiles)
  tunnels: 4,           // roofed corridor runs that hide the floor (you show through as a ghost)
  tunnelMinTiles: 5,    // shortest straight run that can become a tunnel
  sliders: [3, 4],      // shifting cells per maze (min, max). Push against the thick wall to slide the cell into a sealed pocket.
  sliderSeconds: 0.8,   // how long the slide takes
  sliderKeyChance: 0.5, // chance the key hides in a pocket instead of a dead end
  sliderOnPath: true,   // one slider sits on the solution route; the maze can't be finished without it
  exitPushTail: 0.4,    // the share of the route counted as "the end of it", where they go first
  exitPushBlocks: 3,    // and the way out of a phase that pushes blocks is guarded by a run of them,
                        // each one load-bearing, clustered near the exit: the Child squeezes its way
                        // out, so everyone who pushes should have to push their way out
  sliderAtStart: true,  // you begin sealed in a small room; pushing its wall is the first thing you learn
  startRoomCells: 3,    // size of the sealed start room, in cells (3 = 5×5 tiles)
  hintIdleSec: 2.5,     // stand still this long and the first slider's edge starts to shimmer
  hintColor: '#c9b98a',

  // pickups (dead ends only)
  chalkStart: 0,        // chalk you begin with (none: the first piece you find teaches it)
  chalkPerPickup: 2,    // marks each found piece is worth
  chalkSpawnRate: 0.055,// fraction of dead ends holding a piece of chalk
  pointerSpawnRate: 0.15,// fraction of dead ends holding a pointer (arrow to the exit). At least 1, at most pickupMax.
  pathSpawnRate: 0.15,  // fraction of dead ends holding a path reveal
  pickupMax: 2,         // cap per type per maze, scaled by area
  pointerMax: 1,        // pointers are the exception: one per maze whatever the size
  mapScraps: 2,         // torn pieces of map, each revealing a patch of the maze around where it lay
  mapScrapShare: 0.2,   // share of the floor one scrap charts, at medium. Divided by the map's area
                        // multiplier, so X-Large gets a patch rather than a fifth of the whole maze
  mapScrapMinShare: 0.06,// however big the maze, a scrap is always worth at least this much of it
  pointerSeconds: 30,   // how long the pointer stays on after pickup
  pathSeconds: 15,      // how long the path stays on after pickup
  pickupExitBuffer: 6,  // dead ends within this many cells (walking) of the exit never hold pickups
  charcoalStart: 0,     // mapping pieces you begin with
  charcoalTiles: 60,    // floor tiles each piece adds to the map
  charcoalSpawnRate: 0.19, // fraction of dead ends holding charcoal — rare on purpose; no guaranteed spawn
  tutorials: true,      // pause and explain each kind of thing the first time you find it (remembered between visits)
  startRoomChalk: 1,
  crawlGaps: 3,         // low gaps in walls only the Child fits through (per medium-sized maze; scales with area)
  crawlOnPath: 2,       // squeezes on the way out that cannot be walked round. Child phases only
  // the last stretch before the way out: a tree of squeezes, sealed off but for one mouth, where
  // the only question is which branch goes on. The final struggle of the map. 0 = off. Child only
  exitGauntlet: 12,      // cells of the way out that the tree covers, counting back from the exit
  exitGauntletBranch: 16,     // biggest wrong branch it will take in whole. Bigger than this and the
                        // branch is really more maze, so it is left outside and the tree keeps its shape
  exitGauntletMaxCells: 44,   // and the whole tree stops here, trunk included
  exitGauntletTunnel: 0.6,    // share of the pass-through cells drawn as tunnel rather than a room you
                        // step into, so some of it is just crawling, elbows and all
  secretRooms: 1,       // a room sealed off behind a squeeze, covered in someone else's chalk. Child only
  secretRoomChalk: 0.5, // how thickly that room is drawn on: chance per floor tile
  secretRoomCells: 3,   // the kid's room, carved whole out of dead wall: 3 cells is 5x5 tiles of
                        // open floor with nothing in the middle of it, which is what a room is
  secretMinTiles: 9,   // how small a chunk of maze will do as a hiding place, in tiles
  secretMaxTiles: 64,   // and how big before it is really just more maze
  secretDark: true,     // it stays unlit until you find the switch on its floor and stand on it
  secretLightSec: 1.3,  // how long the lights take to stutter on once you do
  swings: 1,            // tiles that slide back and forth on their own
  swingSeconds: 2.25,   // how long a swing rests at each end
  squeezeSlow: 0.4,     // speed inside a crawl gap
  squeezeReach: 0.85,   // how far (tiles) from the gap's center the squeeze extends into each corridor
  squeezeBump: 0.09,    // the camera's kick going into and out of a squeeze, in tiles. It is a shoulder
                        // catching a wall, not a collision — 0.18 read as being hit
  journalFloat: 0.05,   // how far a book lifts and settles, as a fraction of a tile. 0 = still
  journalFloatSec: 2.6, // one rise and fall
  figureLingerSec: 2.5, // how long the father stands there once you have seen him, before he leaves
  figureWalkSpeed: 1.6, // tiles per second he walks away at. Straight away from you, wall or no wall —
                        // he is a memory of someone leaving, not a thing in the maze
  figureWalkSec: 1.6,   // and how long he takes to fade out while doing it
  figureSpots: 6,       // where the father stands in a Child maze (one is always just past the door).
                        // Only ever one of them is visible at a time — a crowd is not abandonment
  darknessChance: 0.3,  // share of mazes that have any darkness
  darknessSizes: [0.25, 0.4, 0.6],   // when there is darkness, one of these shares of the floor, equally likely
  darkBufferTiles: 8,   // darkness never comes closer than this (walking) to the start-room door
  coneDeg: 70,          // lamp cone width
  coneTiles: 3.6,       // lamp cone reach
  poolDoorSeconds: 2.4, // how long the pool room's gate takes to grind aside. It is stone and it
                        // is heavy, and 0.65s read as a shutter
  keyGate: true,        // allow the locked exit at all
  keyChance: 0.5,       // share of mazes whose exit is actually locked

  journalHoldSec: 9,    // how long a found journal page stays readable

  // narrator
  narratorEverySec: 120,// seconds between lines
  narratorFirstSec: 2.5,// first line arrives just after the fade
  narratorHoldSec: 6,   // how long a line stays readable (plus fades)

  sound: true,          // ambient drone + effects (toggle in the gear panel)
  musicVolume: 0.35,
  sfxVolume: 0.8,
  sfxNearTiles: 2,      // a thing in the world this close sounds at full volume
  sfxRangeTiles: 9,     // and fades to nothing by here — measured in tiles walked, not line of sight,
                        // so a swing on the far side of a wall is as distant as the walk around it

  colors: {
    bg:    '#0d0f10',
    wall:  '#1b1f21',
    tunnel:'#26292b',
    thick: '#1b1f21',
    block: '#827d71',           // the face of a push block: a whole tile of slab, a shade paler
                                // than the floor it sits on. It never says which way it goes
    shelf: '#a29d92',
    book:  '#ece7da',   // same as wall: the edge reads as a sliver of wall on the floor
    floor: '#6e6a62',
    grout: '#585450',
    player:'#ece7da',
    playerEdge:'#8b867a',       // the edge that keeps him findable while he is still dark. Pale enough
                                // to see, dull enough not to look freshly painted
    playerBurdened:'#2c2a26',   // what he is before a stone is put down. Each one lights another
                                // band of him, tail to nose, until he is the pale colour above
    exit:  '#a89f8c',
    gate:  '#d8b36a',
    start: '#4a4741',
    mark:  '#ece7da',
    path:  '#8f8a7e',
    arrow: '#c9b98a',
    chalk: '#ece7da',
    pointerPickup: '#c9b98a',
    pathPickup: '#b9b4a8',
    key:   '#e0c98a',
    lamp:  '#e8d9a0',
    charcoal: '#3a3d3f',
    mapFloor: '#5a5750',
    mapWall: '#23262a',
    journal:'#b8b0a0',
  },
};
