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
- Pack: press and hold the explorer (or hold C) to dig in it; 10 slots (keys 1-9, 0; C takes out the compass). Climbing needs axes AND crampons. See "The pack, the sled and food" below. Hooks: `NAS.compassOpen()`, `NAS.packOpen()`, `NAS.gear(id, on)` (puts it in the pack first if need be), `NAS.give(id, n)`, `NAS.pack`, `NAS.sled`, `NAS.ground`, `NAS.openSled()`, `NAS.eat()`, `NAS.packUI()` (slot screen positions, for scripted taps via `NAS.uiPress(x, y)` / `NAS.uiRelease()`).
- `?kit=all` starts the first member with the compass, snowshoes, axes, crampons and 3 rations (the gear comes out of the sled). `?food=0..1` starts them that hungry; hooks `NAS.starve(v?)` (food to v, or 0.25 lower), `NAS.feed(v = 1)`, `NAS.fillPack()`; the gear menu has Starve me / Feed me / Fill pack and shows food, its rate, the pack and the sled.
- `?terrain=ice` forces `terrainAt()` to return that type everywhere (handy for animation tests).
- `?debug` lets modules draw debug overlays.
- `?wet=0..1`, `?frozen=0..1` start them soaked / rimed. Hooks `NAS.soak(v = 1)`, `NAS.dry()`;
  the gear menu has Soak me / Dry me and shows wet, rime and whether they're in the water.
- `?warmth=0..1` starts the explorer that cold (body.js). Hooks: `NAS.body` (the values),
  `NAS.freeze(v?)` (warmth to v, or 0.2 colder), `NAS.warm(v = 1)`, `NAS.kill()`,
  `NAS.player.tent()` (walk to the tent and crawl in). The gear menu shows a body readout
  with Freeze me / Warm me / Kill buttons.
- `?energy=0..1`, `?reserve=0..1` start them that worn out. Hooks `NAS.tire(v?)` (energy to v,
  or 0.25 lower), `NAS.rest()` (energy and reserve full); the gear menu has Tire me / Rest me
  and shows energy / its cap, the drain per minute and the reserve.

## Survival (man vs. environment) — no bars, no HUD
The plan lives in Joe's survival plan (slices 1–7). Slices 1–4 are built: the body, the cold,
the base camp tent, death handing over to the next expedition member; open water and wet;
exhaustion; the sled, the 10-slot pack, food and hunger.

- **The body** (`js/actors/body.js`): `state.body = { warmth, wet, energy, reserve, injury, food, water }`,
  each 0–1, hidden. Warmth, wet, energy/reserve and food are live; injury (caps energy) is
  hooked in for a later slice.
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
- **Open water** (slice 2). `terrain.isWater(x, y)` (dark thin-ice class: the sea and its leads;
  frozen lakes are ice class and stay safe; thin ice holds until slice 5) and
  `terrain.waterDepth(x, y)` (world px from land; floes are snow, so they count as land to hop
  between). The first `terrain.WADE_DEPTH` (9) px from land is a wading shelf, beyond is deep,
  with ±1.5 px of hysteresis at the drop-off. lakes.js darkens open water a step and paints the
  shelf paler (a soft edge, from the depth field read bilinearly) with ink stipple scattered
  along the drop-off, so the player can see where it gets deep. Floes ride a slight swell in
  place (no drift): their painted edge is the walkable edge. The bottom edge of the painting
  dissolves into drifting white (weather-haze.js); the camera may run a little past it on tall
  screens so the explorer isn't pinned low.
  (Known terrain-data issue: a path-class strip crosses the lead at y≈1738-1741, x≈1305-1345,
  so it's walkable and not water there; fix in the terrain editor.)
  - **The shore**: open water is a wall until committed. Walking into it (land → shelf, or
    shelf → deep) stops at the edge for ~0.9 s, head down, braking hard (even gliding on ice);
    pressing on after that, or pressing again right there within 4 s, commits to that level at
    that spot. Gusts, knockdowns, glides and routes never carry anyone in uncommitted. Holding on
    a point across water walks round it on dry ground if there's a way (planned on a coarse grid,
    re-planned only when the finger moves on, dropped after 1.5 s without headway); if not,
    straight to the shore and the beat there. Routes to the tent or a climb also go round water.
    The pack can't be opened in the water.
  - **Wading**: slow, high-stepping, arms out; the figure sinks into the painted surface (legs
    hidden below a lit waterline), rings spread from the legs and a wake trails. Each step
    splashes. Entering from land (once per entry): a white flash, a gasp, ragged breathing
    (body.shock). Wading soaks to about half (more the deeper), slowly; deep water soaks through.
  - **Deep**: swimming upright in a dark collar of water, face turned up to the camera, one arm
    flung up and out ending in a dark mitt, the other beating the surface; they swap every
    ~0.6 s in a burst of spray, weakening with the cold; slow headway; no breath clouds. ~23 s to death from
    full warmth. Dying in deep water: the body tips away from a raised arm, the hood goes under,
    and the open mitt is the last thing seen; the collar melts into dark rings, bubbles break and
    the other mitt floats off downwind (~16 s); no body — fallen.js keeps slow dark rings at the
    spot for ~25 s after the hand-over. Dying on the shelf: they fall face down
    at the water's edge and the body stays. The party hands over as usual.
  - **Wet**: ×4 warmth loss on land; the coat goes a deep wet ochre (still warm in hue, unlike the
    cold's grey); drips fall from the hem; boots leave darker prints; frost comes on faster.
    In the cold, wet clothes freeze into rime (body.frozen ≤ wet): white specks on the shoulders
    and hem, a crust along it, stiffer arms and ~20% slower; the coat creaks as they move.
    Drying out in the cold takes ~10 min (faster in calm sun) and mostly turns to rime first;
    the tent dries in ~12 s and thaws the rime.
  - Measured (headless, sped up): wading only (standing on the shelf, calm day) ~1¾ min;
    deep water ~23 s; wet on land in a blizzard ~42 s; wet on a calm day −0.08 warmth/min standing
    (~12 min) and −0.03/min walking (dry, walking warms you).
- **Exhaustion** (slice 3). `energy` is the short-term wind (minutes), `reserve` the day's
  fatigue: it caps how far energy comes back (`body.max = (0.35 + 0.65 × reserve) × (1 − 0.5 ×
  injury)`), wears down with the work (0.1 per full energy spent) and the hours outside (~0.075
  per minute: a day and a night out without sleep costs about half), eases back resting in the
  tent and is restored by sleeping the night there.
  - **Drain** (body.js `DRAIN`, × how hard they push, × up to 2.1 into a headwind with full
    exposure): deep snow ~90 s from full, ~4 min on snowshoes; plain snow ~6 min of walking to
    the stop-start stage; ice light (half again with crampons); a path costs nothing and slowly
    gives some back. Each axe strike on a climb costs 0.032 (`body.climbHalf`): a ~75 px cliff
    takes ~60% of full energy, the biggest (~110 px) nearly all of it. Wading is heavy (~2 min),
    swimming very heavy (~30 s). Shivering costs a little.
  - **Recovery** (not linear): standing still, 0 → 0.4 in ~15 s, → full in ~60 s in calm air; far
    slower cold, wet or in a gale; cowering a little less; in the tent ~15 s. The stops bent
    double on the way give back only about the breath they cost (×0.12): standing still on purpose
    is the real rest.
  - **The body** (`explorer.js`): below ~0.5 the stride shortens, the feet drag (lower lift),
    bent further over, head down, arms barely swinging, each step heavier and slower. Worn out,
    they stop by themselves on a legible ramp (never in the water, never with the bear within
    ~60): once as energy passes 0.2, again at 0.12 and 0.06, then every ~7 s of pushing (~5 s near
    the end): bent double, hands braced on the knees, the back heaving (input ignored ~2–2.7 s). Standing still worn out (< 0.3), they bend double of their own accord after
    ~1.5 s. At 0 they sit down in the snow huddled: knees drawn up together, arms wrapped round
    them inside the coat, the hood bowed onto the knees, the coat a rounded mound over it all with
    only the two grey boot soles peeking out at its front edge, a contact shadow under the seat
    and the rucksack lost in the coat (turning a little toward the camera as they go down, so it
    reads from any side). They stay down until energy is back
    to ~0.2, unless pushed on: then up onto hands and knees, crawling at a quarter pace (crawling
    neither costs nor gives back energy). The tent can be tapped from sat within ~15 units: they
    crawl to it. Sitting spent in the cold: no walking heat and +30% warmth loss (exhaustion feeds
    the cold; it never kills on its own). In the water there is no stopping and no sitting: at 0
    the wade or the swim is just weak and slow. Routes (to the tent, a climb) wait out the stops
    and their give-up clock runs at the pace they can manage.
  - **Climbing**: sized up first: refused if energy < 0.2 or < 1.15 × the wall's estimated cost
    (capped at 0.98, so the biggest walls stay possible fresh): axe strikes = (route length − 17,
    where the top-out takes over) / step × `climbHalf`, plus hanging between moves (`body.hang` ×
    moves × 1.5 s × tiredness^1.2, tiredness taken two-thirds of the way up). A climb allowed to
    start finishes (`refuse` reason `'tired'`: a long look up the wall, then
    the head drops and the shoulders sag). On the wall low energy slows every move, makes them
    hang between taps (up to ~1.5 s, taps wait) and shakes the arms; at 0 the arms shake hard for
    a second and the grip goes (the usual tear-off and fall), and they end up sat where they land.
    Swimming: the thrash weakens. A worn reserve shows standing about: sagging, head low, slow
    weight shifts.
  - **Panting**: one breathing clock (`explorer.js updatePant`, `player.pant` / `player.breathPh`)
    times the breath clouds (big, fast, one per breath, shown in any cold), the heaving chest and
    shoulders, the ragged breath sounds (`pant` events, a throaty rasp layer), and the screen.
  - **Screen** (`body.js`): never darkness (the cold owns the ink edge). The edges of sight go
    soft and faintly washed, swelling at the end of each breath out (the frame so far shrunk to
    1/6, never under 128 px a side, laid back outside a clear middle round the explorer; drawn in
    body.js drawScreen, so the night grade, the pack / compass UI, the frost and the cold's ink
    stay crisp). From ~0.4 energy, strong at 0. Only once they've stopped (bent double, sat
    spent, or standing still under 0.3), the view breathes too: up to 0.6% zoom on each breath in
    (`cam.pulse`, camera.js; `cam.dip` is left at 0). The gear menu's Reduce motion (saved on the
    device, `state.reduceMotion`) turns the pulse off. On a deliberate worn-out stop (sat spent,
    or stood still under 0.3 for over a second; not the brief stops on the way) the camera also
    eases in once by 18% and holds, easing back out after ~1.5 s of walking on (`cam.rest`, a
    multiplier on the follow zoom: the player's pinch zoom stands; crawling keeps it close; not
    with Reduce motion). UI pinned to the explorer uses
    `camera.worldToScreenUI`, which ignores the pulse.
  - **Footprints**: tired boots drag: in deep snow each hole is smeared back into a ploughed
    tail and joined to that boot's last print by a churned groove; on plain snow a short broken
    scuff runs on from the last toe (`step.drag`). Crawling leaves no boot prints.
  - **Sound**: ragged breaths at the panting rate, a heavy breath out on each stop bent double
    (`rest`), a long groaning one and a soft thump sitting down spent (`tired`).
  - Measured (headless, sped up, calm day, full reserve): deep snow 88 s of walking to empty
    (98 s with the stops); on snowshoes ~250 s; plain snow 259 s of walking to 0.25, then 0.25 → 0
    in ~2 min (128 s including the stops), ~6½ min in all; standing still 0 → 0.4 in 16 s, → full
    ~60 s (0.2 in 8 s); tent 15 s; spent in a blizzard (cowering) 0 → 0.2 in ~40 s, death by cold
    at ~157 s. A day and a night (300 s) walking about outside: reserve 1 → 0.51, energy cap 1 →
    0.68. Cliff at (1460, 1490), ~74 px: 58% of full, estimate 0.585, threshold 0.673 (started at
    0.68 it finished with 0.10 left); at (1490, 1500), ~110 px: 94% (estimate 0.93: only fresh,
    finishing with 0.06). Camera pulse at most 0.51% zoom (~6.5 px at the edge of a 2560 px
    screen), only when stopped; the rest zoom-in 18%.
- **The pack, the sled and food** (slice 4). `js/items.js` is the registry (`ITEMS`: id, name,
  stack, kind, icon, `use`, `blocked`; add an item there and the pack, sled and transfer take it)
  and the containers: `state.pack` (10 slots, everything counts, the compass and gear too; worn
  things stay in their slot, ring signal yellow), `state.sled` (the party's supply: 12 rations in
  stacks of 3, snowshoes, axes, crampons and a spare compass), `state.ground` (piles on the snow)
  and each fallen member's `pack`. Food stacks to 3 a slot, gear one. `player.gear` is a derived
  view (getters on the pack), so the explorer and body read it as before. The first member sets
  out with a compass and 2 rations; each one after a death starts empty bar a compass if the sled
  still has one, and must restock at the sled. The sled is all the food there is (hunting later).
  - **The pack UI** (`js/ui/pack.js`, the only UI, on demand): hold the explorer 2 s (a bar fills
    over the hood) and the 10 round slots open as two columns of five beside them, slot 1 where
    the compass slot always was (beside the hood), 1–5 down the near column, 6–0 down the far one;
    to the left, flipped to the right when a column wouldn't fit (and only then slid back on, so
    columns never stack). The slot radius is 5.5 world units but never under 13 px (18 px on a
    touch screen; hit radius +8 px). Empty slots are faint; a stack shows an ink pip each. Tap:
    wear / take off (that slot: one of a kind is worn), take out the compass, eat. Press and hold
    1 s (a white, ink-edged arc shows only from 0.3 s, so taps never see it): drop ONE on the snow
    beside the explorer (a small pile, the icons laid flat, snowing over with time; piles within
    6 units merge; nowhere walkable: refused). Anything worn that leaves the pack is taken off
    first (the gear event plays). The compass works only while there's one in the pack. Blocked
    uses, a full pack and "too full to eat" shake the slot (ring to ink, a muffled knock).
  - **Containers**: within reach of the sled (~20 units from its edge), a body (16) or a pile (12)
    a small signal-yellow glint twinkles on it (the sled's lashing, the body's pack, the pile),
    never under ~12 screen px across; fainter from twice the reach.
    Hold it and the explorer kneels low, turns to it (a little off straight-away from the camera)
    and digs; a press on one further off walks there (round water and camp) and digs on arrival;
    any input of the player's own cancels the walk. Its contents fan out in a block of square,
    crate-like slots beside it on the far side from the explorer (one faint empty slot first,
    nearest the pack, then the stacks), the round pack slots beside the explorer on the other
    side; faint dashed ink tethers join each block to its owner. Tap moves one across, hold 0.6 s
    moves the stack. Each move kicks up a puff of snow and jostles the sled's load; the load's
    bundles come off as the sled empties (camp.js, top sacks first). Walking away, an alerted bear
    within 60 units, or 14 s untouched closes it. Keyboard: hold Space / E close to one; 1–0 from
    the pack, Shift + 1–0 from the container. At death the pack goes with the body (fallen.js);
    the sea keeps what it takes.
  - **In the tent**: by day, press and hold the glowing door and the pack opens there (to eat; a
    quick tap on the door leaves, as a tap anywhere does). After dark the door is the bed: a hold
    there (or anywhere) sleeps, the dig bar filling over the door with it (~1 s). Going to sleep
    hungry (food < 0.75) eats a ration from the pack, if there is one.
  - **Hunger** (`body.js`): food runs down in ~15 min standing about (three days and nights),
    ~8 min walking at full push, ~9½ min standing shivering cold (warmth 0.35), ~25 min in the
    tent; sleeping the night costs 0.06. A new member after a death starts at 0.8. A ration: tap
    it, the explorer kneels with the pack open, turns half toward the camera, takes it out and
    eats for 3 s (mitts and a biscuit at the face, a chewing bob, crunching); +0.35 food, +0.04
    warmth; walking off (or a tap elsewhere) cancels it and keeps the ration (no eating above
    0.95). Below 0.3: energy comes back slower (to half), its cap drops (up to −35%), the reserve
    wears faster (×1.6) and the gait slows (up to −20% near 0). Below 0.1: warmth loss up to +60%
    and less heat from walking. At 0 it kills only through the cold and exhaustion.
    Cues, no UI: **lightheaded** episodes (`body.dizzy`, ~0.7 s) below 0.3, setting off after a
    stop (35–95%) and now and then walking on, with a cooldown of 25 s at 0.3 down to 7 s near 0:
    the frame doubles faintly, drifting, and dims (body.js drawScreen; distinct from the cold's ink
    edge and exhaustion's blur; Reduce motion keeps only the dim), and the explorer sways, staggers
    and slows. Below 0.2 a sway comes standing still too, and a growl every 6–15 s whatever
    they're doing. The first time food drops below 0.35 the explorer glances back and pats the
    pack, the once, while the first fifth of the dig bar flashes over them (teaching the hold,
    no words). Under ~0.35, standing
    about, a mitt to the stomach, hunched, every 6–15 s, with a low gurgling growl (now and then
    walking too); the wind ducks under the growl, so it's heard in a storm. The ice axes, carried
    but not in hand, show strapped on the back of the pack.
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
