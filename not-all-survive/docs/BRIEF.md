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
  No colour. (A barely perceptible cold tint in the fog is allowed if a critic agrees.)
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
  `drawables()` → `[{ y, draw(ctx) }]` (world space, y-sorted with every other actor),
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
- `?terrain=ice` forces `terrainAt()` to return that type everywhere (handy for animation tests).
- `?debug` lets modules draw debug overlays.

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
