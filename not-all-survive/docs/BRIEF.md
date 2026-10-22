# Not All Will Survive — visual proof of concept

## The goal
No gameplay, no HUD. One question: **does the player feel like they are exploring one of
the most inhospitable places on earth?** A lone explorer, small against a vast, cold,
indifferent landscape; wind that you can see and hear; snow that fights you.
Runs in desktop and mobile browsers. Plain ES modules, no build step, no npm deps.

## Reference art (`not-all-survive/ref/`, not committed — look at these, often)
- `onepager.png` — Joe's one-page product vision. **The target.**
- `explorer.png` — the player character at in-game scale (512px crop). Hooded, long dark
  coat/cloak to the knees, dark trousers and boots, small and slightly hunched.
- `tent.png` — a camp: canvas ridge tent, guy lines, isometric snow island.
- `sled.png` — loaded freight sled and four sled dogs (huskies) in harness.
- `penguins.png`, `polarbear.png` — wildlife, in the same monochrome style.
- `map.png` — the world map (this *is* our world: `assets/map.webp`).

## Art direction — match the painting, don't invent a new style
- **Strictly monochrome.** Paper/snow white `#f2f2f0`–`#fafafa`; snow shadow and ice
  mid-greys `#c4c6c8`–`#dcdcdc`; rock `#5a5a5a`–`#8a8a8a`; ink `#262626`–`#3a3a3a`.
  No colour, with one deliberate exception: SIGNAL YELLOW (js/palette.js), Joe's
  attention colour. The explorer's coat and the tent wear it; later, anything the
  player should notice may too. Never use it decoratively.
- **Inked illustration.** Thin, slightly irregular dark outlines; flat grey fills with
  soft cel shading; stipple dots along snow edges; fine vertical hatching on cliffs.
- **Light from the upper-left**, cast shadows fall toward the lower-right, soft and grey
  (never black).
- **Oblique top-down camera**, the same as the map: we see the tops of things and the
  south faces of cliffs. Characters seen from about 50–60° above.
- **Scale.** 1 world unit = 1 pixel of the painted map. The explorer is about **16 world
  units tall**, which matches the figure in `explorer.png` against those cliffs. The
  camera shows about 190 world units across the short side of the screen.
- Anything new that you draw has to sit *in* the painting, not on top of it: same line
  weight at the current zoom, same greys, same shadow direction.

## Architecture (read `js/main.js`, `js/state.js` first)
- `js/state.js` — one shared mutable `state`; every module reads and writes it directly.
  `window.NAS === state` in the browser.
- `js/main.js` — boot and loop. Each system module exports some of
  `init()` (may return a Promise), `update(dt)`, `drawGround(ctx)` (world space, under actors),
  `drawables()` → `[{ x, y, draw(ctx) }]` (world space, depth-sorted with every other actor;
  give the FEET position as x, y and main.js keys it by terrain.sortKey so it layers
  correctly against cliffs and plateau heights; without x the plain y is used),
  `drawSky(ctx)` (world space, above actors), `drawScreen(ctx)` (screen space in CSS
  pixels, after the world). Each draw hook gets a `ctx.save()`/`restore()` around it.
- `state.events` — a one-frame event bus (types documented in `state.js`).
- `js/camera.js` — `worldToScreen`, `screenToWorld`, `visibleRect(margin)`; cull to it.
- **Each builder owns specific files. Never edit a file you don't own.** If you need a
  change in a shared file (`main.js`, `state.js`, `camera.js`, `input.js`, `map.js`), say so in
  your report and the lead will make it.
- Performance budget: 60fps on a mid-range phone. Canvas 2D. Cull to the visible rect.
  Cache expensive drawing in offscreen canvases. Keep offscreen canvases small (iOS
  Safari kills pages that use too much canvas memory — total under ~150 MB).

## URL parameters (for testing and automated captures)
- `?autostart` skip the title; `?demo=dir&a=<deg>` walk in a fixed direction (0 = east,
  90 = south/toward camera, 180 = west, 270 = north); `?demo=circle`; `?demo=still`.
- `?x=&y=` spawn point (world px); `?zoom=`; `?speed=` time scale.
- `?wind=0..1`, `?windAngle=<rad>`, `?whiteout=0..1`, `?snow=0..1` initial weather.
- `?only=explorer,weather` load only those systems (map, terrain and ground always load).
- Day/night cycles (3 min day, 2 min night). `?night` / `?day` pin it; the gear menu's Time button cycles cycle → day → night.
- Pack: press and hold the explorer (or hold C) to dig in it. Slots: compass (C or 1), snowshoes (2), ice axes (3), crampons (4). Climbing needs axes AND crampons. Hooks: `NAS.compassOpen()`, `NAS.packOpen()`, `NAS.gear(id, on)`.
- `?terrain=ice` forces `terrainAt()` to return that type everywhere (handy for animation tests).
- `?debug` lets modules draw debug overlays.
- `?warmth=0..1` starts the explorer that cold (body.js). Hooks: `NAS.body` (the values),
  `NAS.freeze(v?)` (warmth to v, or 0.2 colder), `NAS.warm(v = 1)`, `NAS.kill()`,
  `NAS.player.tent()` (walk to the tent and crawl in). The gear menu shows a body readout
  with Freeze me / Warm me / Kill buttons.

## Survival (man vs. environment) — no bars, no HUD
The plan lives in Joe's survival plan (slices 1–7). Slice 1 is built: the body, the cold,
the base camp tent, and death handing over to the next expedition member.

- **The body** (`js/actors/body.js`): `state.body = { warmth, wet, energy, injury, food, water }`,
  each 0–1, hidden. Only warmth is live; wet (×4 loss), food (hunger adds to the loss) and
  energy (feeds the walking heat) are hooked in for the later slices.
  Warmth loss = `LOSS × (cold × (0.35 + 0.65 × wind exposure))^1.5`, more at night, less
  sheltered (cowering, hunkered in the lee); walking makes heat. Measured (headless, sped up):
  a dry explorer standing in a full blizzard dies in ~2¾–3 min, a wet one in ~45 s; walking in
  the blizzard ~3½ min; a calm clear day takes ~55 min standing still and warms you on the
  move; a calm night ~9 min standing.
- **Reading the cold** (all driven by warmth, escalating):
  explorer (`explorer.js`) — hugs themselves even walking (< 0.7), shivers oftener then hard and
  near-constant (< 0.45), stumbles and slows (< 0.35), falters onto one knee and kneels when
  still (< 0.2), and stops shivering near the end (< 0.1); cowering in a storm they ball up
  tighter and shake the whole time. The coat's signal yellow drains toward a grey ochre (never
  fully: a trace stays findable). Screen — the edges of sight close in, in ink, steadily from
  ~0.75 to 0.3 (the pale cold vignette gives way to it: pale grey vanishes in a white-out);
  frost creeps further in (`weather-screen.js`); the image dims slightly (no desaturation —
  the tent and coat must stay yellow); below 0.2 a soft, feathered ink iris closes, throbbing
  with a slow heartbeat (`body.js drawOverlay`, after the night grade). The hard hand-drawn
  iris edge is only for death. Sound — teeth chattering, then a heartbeat, the world going
  dull and far away (`audio.js`).
- **The tent**: tap it (or Space/E by the door) → the explorer walks round to the door,
  kneels and crawls in (hidden behind the gable except through the doorway, sinking into its
  dark), and is hidden (`'inside'`). The tent, sled and skis are solid (`camp.js campBlocked`).
  The camera rests on the tent: the door slit glows signal yellow and the canvas breathes with
  the lamp (by day too), stove smoke leaves the ridge, the wind muffles, the stove roars and
  crackles, the frost melts and warmth comes back fast. Letting go of a press leaves (crawls
  out). After dark only, a press held ~1 s turns the lamp down and sleeps out the rest of the
  night: a fade to ink, the clock jumps to that dawn, fade back in. (No sleeping through a day
  storm.)
- **Death and the party**: warmth 0 → collapse (kneel, slump, lie face down) → the ink iris
  closes onto the body, holds a beat, closes → cut to base camp: the next of the four crawls
  out of the tent as the iris opens. The body stays where it fell for the run
  (`js/actors/fallen.js`: the explorer's own drawing at death, frosted, with snow settling on
  it and a drift building round it). Pairs of skis stuck in the snow by the tent door show
  who's left (`camp.js`), one pair fewer per death. All four dead: the iris opens a little on
  the empty camp, "None came home", the names, tap to begin again.

## Capturing frames (you can and should look at your own work)
A static server is already running at `http://localhost:8765/` (repo root). If it isn't:
`cd /c/Users/GameD/GameDesignerJoe.github.io && python -m http.server 8765` in the background.

```
cd /c/Users/GameD/nas-tools
node shoot.js "http://localhost:8765/not-all-survive/?autostart&demo=dir&a=0" shots/<name> \
     --w 1280 --h 720 --wait 3000 --frames 6 --interval 120 [--mobile] [--eval "js"]
```
Writes `shots/<name>_00.png …` and prints page console errors and exceptions. Use
`--w 390 --h 844 --mobile` for a phone. Open the PNGs with the Read tool to see them.
Use a unique `<name>` prefix per agent (e.g. `shots/explorer/…`). Headless Chrome renders
with SwiftShader, so the frame rate is low; judge the look, not the smoothness. For
animation, capture a burst of frames and inspect the sequence, or make a contact
sheet with Python and Pillow (`python -c "from PIL import Image ..."`).
Python 3.10 with Pillow and numpy is available for asset processing.
