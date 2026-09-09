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
  tilePx: 60,           // zoom: screen pixels per tile
  titleTilePx: 150,     // zoom while asleep on the title screen
  introSeconds: 2.8,    // zoom-out when you tap the sleeper
  viewRadius: 1.0,      // cells of visibility around you
  fogSoftness: 1.4,     // how many tiles the light takes to fade to black
  speed: 3.08,          // tiles per second while the stick is held
  pushHoldMs: 260,      // lean into a slider's edge this long before it moves
  turnBufferMs: 400,    // a perpendicular push is remembered this long and taken at the next opening
  turnForgiveness: 0.5, // how far off a tile center you can still take a turn (0.5 = anywhere in the tile)
  stickDeadzone: 0.22,  // fraction of stick travel that reads as "not pushing"
  playerSize: 0.46,     // fraction of a tile
  cameraLag: 0.14,      // 0 = locked on player, higher = floatier

  // maze shape
  branchiness: 0.35,    // 0 = long winding corridors (backtracker). 1 = many short branches and junctions (Prim-like). Play with this.
  braid: 0.0,           // 0 = perfect maze. 0.1 opens 10% of dead ends into loops
  rooms: 3,             // open spaces carved into the maze
  roomCells: [2, 3],    // room size range, in cells (2 = 3×3 tiles, 3 = 5×5 tiles)
  tunnels: 4,           // roofed corridor runs that hide the floor (you show through as a ghost)
  tunnelMinTiles: 5,    // shortest straight run that can become a tunnel
  sliders: [3, 4],      // shifting cells per maze (min, max). Push against the thick wall to slide the cell into a sealed pocket.
  sliderSeconds: 0.8,   // how long the slide takes
  sliderKeyChance: 0.5, // chance the key hides in a pocket instead of a dead end
  sliderOnPath: true,   // one slider sits on the solution route; the maze can't be finished without it
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
  pickupMax: 2,         // cap per type per maze
  mapScraps: 2,         // torn pieces of map, each revealing about a quarter of the maze around where it lay
  mapScrapShare: 0.2,
  pointerSeconds: 30,   // how long the pointer stays on after pickup
  pathSeconds: 15,      // how long the path stays on after pickup
  pickupExitBuffer: 6,  // dead ends within this many cells (walking) of the exit never hold pickups
  charcoalStart: 0,     // mapping pieces you begin with
  charcoalTiles: 50,    // floor tiles each piece adds to the map
  charcoalSpawnRate: 0.19, // fraction of dead ends holding charcoal — rare on purpose; no guaranteed spawn
  tutorials: true,      // pause and explain each kind of thing the first time you find it (remembered between visits)
  startRoomChalk: 1,
  crawlGaps: 3,         // low gaps in walls only the Child fits through (per medium-sized maze; scales with area)
  swings: 1,            // tiles that slide back and forth on their own
  swingSeconds: 4.5,    // how long a swing rests at each end
  squeezeSlow: 0.4,     // speed inside a crawl gap
  squeezeReach: 0.85,   // how far (tiles) from the gap's center the squeeze extends into each corridor
  figureSpots: 6,       // where the father stands in a Child maze (one is always just past the door)    // pieces of chalk lying in the start room
  darknessChance: 0.3,  // share of mazes that have any darkness
  darknessSizes: [0.25, 0.4, 0.6],   // when there is darkness, one of these shares of the floor, equally likely
  darkBufferTiles: 8,   // darkness never comes closer than this (walking) to the start-room door
  coneDeg: 70,          // lamp cone width
  coneTiles: 3.6,       // lamp cone reach
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

  colors: {
    bg:    '#0d0f10',
    wall:  '#1b1f21',
    tunnel:'#26292b',
    thick: '#1b1f21',
    shelf: '#a29d92',
    book:  '#ece7da',   // same as wall: the edge reads as a sliver of wall on the floor
    floor: '#6e6a62',
    grout: '#585450',
    player:'#ece7da',
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
