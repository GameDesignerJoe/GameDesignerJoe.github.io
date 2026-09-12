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
  // Joe: "for now, let's make the default camera the same as the all the way zoomed in debug slider.
  // I really like how immersive that feels." That was 60px a tile at the slider's old 2.5x, so 150
  // is the new 1x and the slider is rebased around it — 0.2x still pulls back further than the old
  // default ever did.
  tilePx: 150,          // zoom: screen pixels per tile
  titleTilePx: 210,     // zoom while asleep on the title screen: still closer than play, so waking pulls back
  introSeconds: 2.8,    // zoom-out when you tap the sleeper
  // Joe: "with the level of zoom I'm looking at for the character right now, I'm noticing we can't
  // see the chapter titles. I suggest we move them up to be just below the mat." At 150px a tile
  // 1.42 tiles put it most of the way down a phone screen, where the vignette had it. The mat's
  // own bottom edge is 0.40 tiles below him, so this sits just clear of it.
  chapterDrop: 0.62,    // tiles below him the chapter is set into the floor; the fog takes its bottom edge
  chapterHoldSec: 1.4,  // and it holds that long into the zoom-out, so you can read it, before
  chapterFadeSec: 0.9,  // fading over this — the name above him goes at 0.9s flat
  // waking one burden lighter, in two beats. You are still in the old dark when you tap: first a
  // band of him goes pale with a breath of a sound, then the light is cut out to its new size all
  // at once and the camera goes with it. Slowly fading into it said nothing at all.
  liftBandSec: 2.4,     // the band of him going pale, before anything else happens. Long, because it
                        // is the one beat that says a burden came off, and it was over before it read
  liftBurstSec: 0.45,   // and the light opening out. Short on purpose: this is the beat that reads
  liftGlowFrom: 0.55,   // the old light, as a fraction of the one you now have
  viewRadius: 1.0,      // cells of visibility around you
  fogFadeTiles: 1.4,    // how many tiles past the lit core still counts as seen, for anything that
                        // has to ask whether a thing is in view. The fog itself is drawn in screen
                        // terms now, so this is about placement and tutorials, not about the drawing
  fogCore: 0.86,        // how much of the way to the nearest screen edge stays fully lit, at most
  fogEdge: 1.12,        // and how far past the far corner the fade runs. Together: a vignette, dark
                        // only where the screen ends, rather than a spotlight with an edge you see
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
  faceMinStep: 0.25,    // tiles a second: move slower than this and he keeps the angle he had, rather
                        // than spinning on the last scraps of a stop
  faceTurnRate: 11,     // how fast he swings round to it. Lower is smoother and laggier; 18 was the
                        // old snap-to-four-directions rate, which had less far to turn
  // Joe: "the speed the character automatically walks off of the mat needs to be half of the
  // players normal speed. They're currently walking off the mat too quickly." Half of the *walk
  // off the mat*, he clarified, not half of the player's walk — "so if it's .35 or something you
  // can make it .17." Hence 0.175. It is also a fraction of the configured walk rather than of
  // B.speed(), which the debug Speed slider multiplies: this is a scripted beat and has no
  // business inheriting a debug knob, and at 1.8x the slider used to run it at 1.95 tiles/s.
  introWalkSpeed: 0.175, // walking himself off the mat, as a fraction of CONFIG.speed (not B.speed())
  moveEase: 0.11,       // seconds to lean into a walk, and out of it again. A person has legs to get
                        // going; a go-kart does not, which is what Joe heard in the old instant start
  pushHoldMs: 260,      // lean into a slider's edge this long before it moves
  turnBufferMs: 400,    // a perpendicular push is remembered this long and taken at the next opening
  turnForgiveness: 0.5, // how far off a tile center you can still take a turn (0.5 = anywhere in the tile)
  cornerEase: 0.7,      // how much of a frame's movement the slide back onto the centreline may take
                        // while you are walking. The rest goes forward, so a corner is a rounded arc
                        // at walking speed rather than a diagonal sprint across it
  stickDeadzone: 0.22,  // fraction of stick travel that reads as "not pushing"
  playerSize: 0.46,     // fraction of a tile
  playerOutline: 0.13,  // a pale edge round the body, as a fraction of its radius. Carrying every
                        // stone he is nearly black, and on a dark floor the outline is the only
                        // thing that keeps him findable. 0 = none, and he starts truly invisible
  cameraLag: 0.14,      // 0 = locked on player, higher = floatier

  // prototypes: small purpose-built levels, from the Prototype dropdown in the debug menu
  // the labyrinth prototype (docs/LABYRINTH.md): ground cut into sections that own their edges,
  // halls through the dead seams between them, one landmark at the heart of each
  labySize: [20, 28],   // cells across x down. Big, because the whole point is having room to be lost in
  labySection: [5, 9],  // a section is between this many cells across and down
  labyStopSplit: 0.3,   // chance a section small enough to stand is left alone rather than cut again
  labyLoops: 0,         // links beyond the tree. 0 = exactly one way between any two sections
  labyHallRun: [1, 4],  // how far a hall travels along the seam before it turns in, in cells
  labyStraightHall: 0.85,   // a hall section keeps going straight this often
  labyStraightWarren: 0.25, // a warren hardly ever does
  labyBraidWarren: 0.16,    // loops inside a warren: being lost in one is the point
  labyBraidCourt: 0.07,
  labyBraidHall: 0.02,
  labyHeart: 3,        // the open room at the heart of every section, in cells. A landmark in a corridor
                        // is decoration; a landmark in a room is a place you can name
  labyChalk: 8,         // sticks of chalk on the floor, because the point is whether you reach for it
  protoSize: [7, 9],    // the island grid, in cells
  galleryBay: 5,        // cells square, for each room in the gallery prototype
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
  // Joe: "I haven't seen any of the special rooms inside the soldier's mazes." They were there — two
  // to a medium maze, which you can walk a whole run without meeting. Rooms are what the maze is
  // navigated by now, so there are more of them.
  rooms: 5,             // open spaces carved into the maze
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
  secretGlow: 0.125,    // the breathing light in the floor: peak alpha of its halo. A quarter of what
                        // it was — it was reading as a lamp, and it is meant to be barely there
  secretGlowTiles: 0.38,// and how far that halo reaches, in tiles: half what it was
  secretGlowCore: 0.25, // and the pinprick at the middle of it, as a share of its old brightness
  secretSwitchIn: 2,    // how far into the room the switch sits, in tiles from the squeeze. Not on the
                        // way in: you have to be inside the dark before there is anything to see
  exitGauntletSwings: 2,// cells of the gauntlet's trunk that slide out of the way on a clock, so the
                        // right branch has to be timed as well as found. Nothing is carved for them:
                        // the alcove they step into stays wall until the tile gets there
  swings: 1,            // tiles that slide back and forth on their own
  swingSeconds: 2.25,   // how long a swing rests at each end
  squeezeSlow: 0.4,     // speed inside a crawl gap
  squeezeReach: 0.85,   // how far (tiles) from the gap's center the squeeze extends into each corridor
  // A squeeze pinches him rather than shrinking him. Joe: "instead of shrinking the character so
  // much when going through a squeeze, is it possible to pinch the back parts of the arrow to
  // squeeze them together... so it looks like it's squeezing?" The arrow is drawn along the way he
  // is facing, so its back corners are exactly the width the channel has to take.
  squeezeShrink: 1,     // he draws full size in a squeeze now — the pinch does all of the work
  squeezePinch: 0.55,   // and the back corners come right in, so the squeezing is the thing you see
  squeezeChannel: 0.28, // how wide the cut through the wall is, as a fraction of a tile. The drawing
                        // and the hold on your footing both read this, so they cannot drift apart
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
  poolGateInset: 0.34,  // how far back from the room's wall the gate sits, in tiles. Flush with it
                        // read as part of the wall rather than as a thing standing in the doorway
  // the way out, shimmering. Joe: "something that gives it an otherworldly quality"
  exitArcs: 7,          // the ring is this many short arcs, not one circle
  exitWarp: 0.035,      // and each one's radius breathes by this much of a tile
  exitShimmerHz: 0.32,  // slowly
  // the rooms that are a place rather than an ornament
  keyDoorMinTiles: 24,  // a key is never nearer its own door than this many tiles of walking...
  keyDoorMinApart: 9,   // ...nor this many tiles as the crow flies, so the two are never in one view
  keyDoorFloor: 4,      // and below this, the door is dropped rather than shipped with its key beside it
  vaultCells: 7,        // the key vault is this many cells square — bigger than any room on purpose
  roomLandmarkChance: 0.85,  // how often an ordinary maze's room is a place rather than an empty box
  spiralSpinHz: 0.022,  // turns a second for the spiral room. Slow enough to doubt, fast enough to see
  spiralFollow: 1.6,    // and how hard walking round it drags it: 1 is exactly the angle you sweep
                        // about the middle of the room, above that it over-answers and reads as
                        // something you are turning rather than something you are walking past
  spiralFollowFade: 1.5,// but the pull fades to nothing within this many tiles of the eye, where a
                        // step of nothing is most of a turn and it would spin on the spot
  spiralFollowMax: 0.22,// and no single frame may turn it more than this many radians, or crossing
                        // the middle at a run whips the whole thing round
  columnLightTiles: 2.6,// how near you have to be for a column to catch light, in tiles
  ballPitReach: 0.9,    // how near a ball has to be before you move it at all, in tiles
  ballPitPush: 0.45,    // and how much of that gap it gives up. High enough and you plough a circle
                        // through the pit instead of wading through it
  ballPitSettle: 0.28,  // and how long it takes to roll back once you are past, in seconds
  exitOval: 0.3,        // how far from round it is pulled, in and out
  exitSpinHz: 0.055,    // and how fast the axis it is pulled along wanders round
  gateSwingSeconds: 1.1,  // how long any other gate takes to swing its leaves back
  poolDoorSeconds: 4.8, // how long the pool room's gate takes to grind aside once you have shoved it
                        // with the stone. It is stone and it is heavy: 0.65s read as a shutter, and
                        // 2.4s still read as a door rather than a weight
  stoneSlow: 0.7,       // how fast you walk with a stone in your arms. It is a burden; it should cost
  keyGate: true,        // allow the locked exit at all
  keyChance: 0.5,       // share of mazes whose exit is actually locked

  journalHoldSec: 9,    // how long a found journal page stays readable

  // narrator
  narratorEverySec: 120,// seconds between lines
  narratorFirstSec: 2.5,// first line arrives just after the fade
  narratorHoldSec: 6,   // how long a line stays readable (plus fades)

  // The Soldier and the Criminal are written on a bass, low enough that a phone speaker cannot
  // sound their fundamental at all — so their melodies were inaudible while everyone else's came
  // through. Each bass note is doubled an octave and two octaves up at this share of its volume,
  // which puts the tune in the band a phone can reproduce without turning the bass into a lead.
  // 0 = back to fundamental only, and back to being unhearable on a phone.
  bassLift: 0.5,        // how loud the octave-up voices under a bass note are, relative to it
  bassCarrierHz: 200,   // and how high they climb: the note is doubled up in octaves until it
                        // clears this, so the tune lands in the band a phone can sound however low
                        // the fundamental goes. The Criminal's floor is 41Hz, which needs three
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
    shelf: '#a29d92',
    book:  '#ece7da',   // same as wall: the edge reads as a sliver of wall on the floor
    floor: '#6e6a62',
    grout: '#585450',
    player:'#ece7da',
    playerEdge:'#ece7da',       // the edge that keeps him findable, and it is white now at every
                                // stage. It was a dull grey — pale enough to see against the floor
                                // in theory, and in practice barely a shade off it. Joe: "I think
                                // we're gonna have to have a white border on the character at all
                                // times, otherwise they will blend and disappear into the
                                // background." It reads as drawn-on rather than lit, and that is
                                // the trade he asked for: findable beats subtle
    playerLifting: '#7d786d',   // halfway. A band goes black, then grey, then pale — three stops, so
                                // there is something to watch. Straight to pale was a flicker of white
    playerBurdened:'#2c2a26',   // what he is before a stone is put down. Each one lights another
                                // band of him, tail to nose, until he is the pale colour above
    exit:  '#a89f8c',
    gate:  '#d8b36a',
    poolGate: '#e8e3d6',        // the pool room's gate: white, and heavy
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
