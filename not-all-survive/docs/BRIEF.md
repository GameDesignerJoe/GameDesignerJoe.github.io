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
- The goal, first stab (js/goal/distress.js, js/audio/radio.js): a lost explorer from an earlier party lies half-buried somewhere 650-1150 px from camp (random each run, reachable on foot, inside the safe area; `?sos=x,y` forces it; the console logs where). Their beacon blinks signal yellow. The radio (in the first member's pack, switched on at the start; a spare on the sled) plays faint blips far off, quicker and louder nearer, turning into the SOS in morse within the last stretch: hot and cold, no arrow. Hold on the body to recover their pack (food, a splint, a recorder with their last words: rec_sos). Once found, the beacon stops blinking and the radio goes quiet. Then (js/goal/burden.js) wrap them, carry or drag them home; see "Bringing them home" below. The shovel and digging them out come later (hook: a 'dig' act before 'wrap' in burden.js ACTS.body).
- `?goal=wrapped` (or the gear menu's "Wrapped body here", or `NAS.goal.wrapped()`) wraps the lost explorer and sets the bundle down beside the explorer. Hooks: `NAS.goal.carry()` / `NAS.goal.drag()` (take it up at once; `(false)` plays the kneel), `NAS.goal.down()`, `NAS.goal.switchMode()`, `NAS.goal.wrap()` (start wrapping, if by the body), `NAS.goal.home()` (carry it to the tent: the ending card), `NAS.goal.state` (`state.burden`); `NAS.actMenu('body'|'bundle'|'self')` opens a row, `NAS.actUI()` gives its slot positions.
- Coats: each party member wears their own bright coat in the order they set out: yellow, orange, red, pink (palette.js COATS; explorer.js setCoat swaps it at the hand-over). The tents stay signal yellow.
- Audio recorders (js/recordings.js, js/audio/recorder.js): one item per recording; tap in the pack to play, again to stop. Ducks under bad weather, stops at death or if the recorder leaves the pack. A real file plays from assets/recordings/ if present, else the placeholder text is spoken by the browser voice under tape hiss. Carrying one is hidden hope: warmth loss and energy drain x0.9 (body.js HOPE). One (the leader's message) starts on the sled.
- Touch controls: the bottom half of the screen is a hidden thumbstick (centred wherever the thumb lands; drag to walk). Touches higher up are taps (cliff, tent, sled), not walks. A faint stick pulses only if a touch player who has never used it stands still 10 s (js/ui/stickhint.js); `?stick` forces stick mode with a mouse, `?stickhint` shows the hint.
- Terrain view (debug): gear menu "Terrain view", the T key, or `?terrainview` paints the editor's class colours over the game (js/ui/terrainview.js).
- Pack: press and hold the explorer (or hold C) to dig in it; 10 slots (keys 1-9, 0; C takes out the compass). Climbing needs axes AND crampons; if both are in the pack they go on by themselves at the foot of a wall (snowshoes come off). Rations grey out when full. See "The pack, the sled and food" below. Hooks: `NAS.compassOpen()`, `NAS.packOpen()`, `NAS.gear(id, on)` (puts it in the pack first if need be), `NAS.give(id, n)`, `NAS.pack`, `NAS.sled`, `NAS.ground`, `NAS.openSled()`, `NAS.eat()`, `NAS.packUI()` (slot screen positions, for scripted taps via `NAS.uiPress(x, y)` / `NAS.uiRelease()`; `.snow` is the snow slot under the feet, null when not shown).
- `?kit=all` starts the first member with the compass, snowshoes, axes, crampons and 3 rations (the gear comes out of the sled). `?food=0..1` starts them that hungry; hooks `NAS.starve(v?)` (food to v, or 0.25 lower), `NAS.feed(v = 1)`, `NAS.fillPack()`; the gear menu has Starve me / Feed me / Fill pack and shows food, its rate, the pack and the sled.
- `?terrain=ice` forces `terrainAt()` to return that type everywhere (handy for animation tests).
- `?debug` lets modules draw debug overlays.
- "Watch it play" (`js/sim/`): `?sim` (or the gear menu's "Watch it play") and the game plays itself through the player's own
  input (`state.demoInput`, presses via `NAS.uiPress` / `uiRelease` played between frames, world taps): it leaves the tent, hears the
  radio, packs at the sled, searches hot and cold by the blip rate only (never `state.distress.x/y` until the beacon is on screen
  and close), and decides as it goes (eat, drink, snow, splint, rest, snowshoes, climb or go round, camp or go on, the bear, carry
  or drag), each logged with its reason in a thoughts panel (top left) and `state.sim.log`. `?sim=loop` starts another run when one
  ends (home, all dead, or `SIM.maxRunMin`); `?speed=` and + / - set the pace, H hides the panel. Every number it decides by is in
  `js/sim/config.js` (`SIM`); `?simset=climb.energyK:20,camp.dusk:150` overrides any for a run. A summary per run (times to find
  and home, deaths and causes, rations, climbs, camps) goes to the console and `state.sim.runs` (kept across loop reloads); the gear
  menu's "Copy sim log" copies them. It changes nothing in the game: it only reads and drives.
- `?wet=0..1`, `?frozen=0..1` start them soaked / rimed. Hooks `NAS.soak(v = 1)`, `NAS.dry()`;
  the gear menu has Soak me / Dry me and shows wet, rime and whether they're in the water.
- `?warmth=0..1` starts the explorer that cold (body.js). Hooks: `NAS.body` (the values),
  `NAS.freeze(v?)` (warmth to v, or 0.2 colder), `NAS.warm(v = 1)`, `NAS.kill()`,
  `NAS.player.tent()` (walk to the tent and crawl in). The gear menu shows a body readout
  with Freeze me / Warm me / Kill buttons.
- `?energy=0..1`, `?reserve=0..1` start them that worn out. Hooks `NAS.tire(v?)` (energy to v,
  or 0.25 lower), `NAS.rest()` (energy and reserve full); the gear menu has Tire me / Rest me
  and shows energy / its cap, the drain per minute and the reserve.
- `?injury=0..1` starts them hurt. Hooks `NAS.hurt(v?)` (injury to v, or 0.25 worse, with the
  flinch), `NAS.heal()`, `NAS.splint()` (bind the leg with a splint from the pack), `NAS.breakIce()`
  (a hole in the ice at the explorer's feet: thin ice or a frozen lake), `NAS.holes`; the gear menu has Hurt me /
  Heal me / Break ice and shows the injury (splinted or not) and the ice stress underfoot (thin or lake).
- Pup tent: `NAS.pitch(now?)` (start pitching it beside the explorer, putting one in the pack if need be;
  `now` = true puts it up at once: the gear menu's "Pitch tent here"), `NAS.strike(now?)` (the menu's
  "Strike tent", at once), `NAS.pup` (`pitched`, `job`; `NAS.pup.force = true` makes the wind catch it at
  the next test), `NAS.player.tent('pup')` (walk to it and crawl in). The menu readout shows where it is.
- Thirst: `?water=0..1` starts them that dry. Hooks `NAS.parch(v?)` (water to v, or 0.25 lower), `NAS.quench()` (water and
  the flasks full), `NAS.drink()` (a pull from the first flask with a drink in it), `NAS.snowEat()` (a mittful of snow),
  `NAS.player.headache(d?)` (the headache gesture now), `NAS.thirst` (`mirage` 0..1 shown, `man` the Third Man's state,
  `show(on)` he comes at the next chance while walking / goes, `episode(on)` a mirage episode now at full strength). The
  gear menu has Parch me / Quench me and shows water, its rate, the drinks in each flask, the mirage and the Third Man.

- The bear (slice 7): `?bear=near` puts the bear close by the spawn, behaving as itself (it notices, stalks, may
  come). Hooks on the bear (`NAS.bear === state.bear`): `NAS.bear.charge(now?)` (fetched close if it's far; the
  warning then the charge, or `true`: straight to the charge), `NAS.bear.near()`, `NAS.bear.mood()` (state, aggro,
  its rate per s, distance, hp), `NAS.bear.setAggro(v)`, `NAS.bear.plunge()`, `NAS.bear.scare()`. The rifle and
  flare: `NAS.gun = { aim(), fire(), lower(), flare(), chance(), chanceAt(d, opts), target(kind), butcher() }`,
  `NAS.giveRifle()` (and five cartridges), `NAS.giveFlare()`, `NAS.hunt` (the state), `NAS.actMenu('carcass')`.
  Keys: R raises / lowers the rifle, Space fires, F strikes a flare. The gear menu: Bear charges / Give rifle /
  Give flare, and the readout shows the bear (state, aggro and its rate, distance, hp), the rifle and carcasses.

## Survival (man vs. environment) — no bars, no HUD
The plan lives in Joe's survival plan (slices 1–7). All seven are built: the body, the cold,
the base camp tent, death handing over to the next expedition member; open water and wet;
exhaustion; the sled, the 10-slot pack, food and hunger; falls, injury and thin ice; the pup tent
(no fire: Joe cut it; a tent's glow implies the stove); thirst; the polar bear's attack, the flare and the rifle.

- **The body** (`js/actors/body.js`): `state.body = { warmth, wet, energy, reserve, injury, food, water }`,
  each 0–1, hidden. All are live (water: the thirst slice).
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
  frozen lakes are ice class and hold far longer; pale thin ice holds a while, then breaks: slice 5) and
  `terrain.waterDepth(x, y)` (world px from land; floes are snow, so they count as land to hop
  between; a hole broken in thin ice or a lake is open water too, deep right to its edge). The first `terrain.WADE_DEPTH` (9) px from land is a wading shelf, beyond is deep,
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
  stacks of 3, snowshoes, axes, crampons, a spare compass, two splints, a canvas sheet and a rope, a rifle, ten cartridges and two flares; 24 slots), `state.ground` (piles on the snow)
  and each fallen member's `pack`. Food stacks to 3 a slot, splints 2, gear one. `player.gear` is a derived
  view (getters on the pack), so the explorer and body read it as before. The first member sets
  out with a compass and 2 rations; each one after a death starts empty bar a compass if the sled
  still has one, and must restock at the sled. The sled is all the food there is (hunting later).
  - **The pack UI** (`js/ui/pack.js`, the only UI, on demand): hold the explorer ~0.45 s (hover or press a slot to see its name), just long enough to
    be sure they mean it (a bar fills over the hood), and the 10 round slots open as two columns of five beside them, slot 1 where
    the compass slot always was (beside the hood), 1–5 down the near column, 6–0 down the far one;
    to the left, flipped to the right when a column wouldn't fit (and only then slid back on, so
    columns never stack). The slot radius is 5.5 world units but never under 13 px (18 px on a
    touch screen; hit radius +8 px). Empty slots are faint; a stack shows an ink pip each. Tap:
    wear / take off (that slot: one of a kind is worn), take out the compass, eat. Press and hold
    1 s (a white, ink-edged arc shows only from 0.3 s, so taps never see it): drop ONE on the snow
    beside the explorer (a small pile, the icons laid flat, snowing over with time; piles within
    6 units merge; nowhere walkable: refused). Anything worn that leaves the pack is taken off
    first (the gear event plays). The compass works only while there's one in the pack. Blocked
    uses, a full pack and "too full to eat" shake the slot (ring to ink, a muffled knock). In a gale
    (cowering, wind + gust over 0.85, the world's edge) the pack still opens: the compass and putting gear
    on or off are dimmed and refused; eating, splinting, pitching and moving things to and from a
    container go on (slice 6).
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
    within 60 units, or a tap off it closes it. Keyboard: hold Space / E close to one; 1–0 from
    the pack, Shift + 1–0 from the container. At death the pack goes with the body (fallen.js);
    the sea keeps what it takes.
  - **In the tent**: a tap brings up the tent menu, a row of round slots above the tent: leave,
    eat a ration, cook raw meat on the stove (slice 7), drink (from the flask, or a mug of snow melted on the stove: +0.35 water), sleep
    till dawn (after dark only; greyed by day), open the pack. Greyed when no use (full, no
    rations, daytime); names on hover / press. A tap off it closes it. Space still leaves (and a
    held Space after dark sleeps). Going to sleep hungry (food < 0.75) eats a ration from the
    pack, if there is one.
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
- **Falls and injury** (slice 5). `body.injury` is one number, shown as a hurt leg (`P.badLeg`, picked
  when a fresh injury comes).
  - **Sources** (explorer.js pushes `injury` / `impact`, body.js adds it up): torn off a wall (wind,
    energy gone, `P.blowOff()`), the drop is the height climbed, (s / L0) × the route's height:
    under 15 px only the knockdown; 15–50 px injury 0.2–0.7 (to 0.85 at 55), longer down and slower
    up; over 55 px fatal (below). A wind knockdown on ice, thin ice or rock: +0.03–0.08. A slip on
    ice: 1 in 20 of them, +0.05. Landing in deep water: swimming (a fatal one sinks: no body);
    landing on thin ice slams it (height / 40 of stress: a big drop goes through).
  - **Fair warning on a wall**: the first time a climb passes the fatal height they stop ~1 s and
    look down over a shoulder (`vertigo`: the wind rising, a sharp breath in). A gust no longer tears
    them off at once: it peels them (0.8 s, `peel`: swung out from the wall, the arms shaking hard),
    and a tap in that moment drives the axes back in (`replant`, two strikes' energy) and saves them;
    no tap and the grip goes. On screen (body.js, readable muted on a phone): the peel snaps a band of
    ink with a torn lower edge in along the top edge from the downwind corner, throbbing faster as the
    window runs out, and tugs the view sideways (not with Reduce motion); the look-down smears the
    left and right edges of the frame downward for ~1 s. Neither is the cold's steady soft edge.
  - **Effects**: a limp (from ~0.05, full by ~0.85): the step onto the bad leg cut short (its half of
    the cycle runs up to 1.9× faster), the hips dropping hard (0.9 units) and the body lurching over it, the bad leg
    swung through stiff and low with a shorter stride. Up to 40% slower (× injury; half that with a
    splint). Walking costs more energy (× (1 + 0.7 × injury)); the cap was already lowered
    (`body.max` × (1 − 0.5 × injury)). Climbing up refused above 0.5 (`refuse` reason `'hurt'`: the
    long look up the wall, then a hand to the bad thigh, bent over it, and away); climbing down is
    allowed, slower, so nobody is stranded on a plateau. Standing about above
    0.45, a mitt pressed on the front of the bad thigh, the weight off that leg.
  - **Healing**: never outside. In the tent ~0.1 a minute (1 → 0 in ~10 min); a night's sleep −0.3.
    The **splint & bandage** (`splint` item, stack 2, two on the sled; slot icon: a slat with a roll
    of bandage across it): tap it hurt, the explorer sits side-on to the camera, the bad leg straight
    out, the good knee drawn up, bent over it passing the roll round the shin for 4 s (the slot's arc
    fills; moving cancels it and keeps the splint). −0.25 at once and the limp costs half the pace
    until the next injury (`body.splint`), and evens the limp's rhythm out some; while it holds, a
    pale bandage shows bound round the bad shin. Dimmed (unusable) when not hurt or in the tent.
  - **Cues**: on impact a burst of snow thrown up, a dead thump, a sharp dry crack and a grunt
    knocked out of them (`impact` audio; no grunt or breath after a fatal one), a hard jolt of the
    view (a drop and shudder, ~0.5 s: `cam.dip` + shakeX, off with Reduce motion), and the **flinch**
    (body.js drawOverlay): an ink bite out of the bottom edge on the bad leg's side, as if the lens
    cracked there: a low, irregular jagged band hugging the edge out from the corner, a few long fine
    fracture lines running up and inward off it, a few flecks; flashing in over ~0.07 s and fading
    over ~0.7–1.15 s, bigger the harder the landing (a smaller one for a knock or a slip). The
    landing's snow burst is kept about the figure's width (weather-sky's big knockdown puff is
    skipped for a fall off a wall), so the body is seen as it lands. Unlike the cold's steady soft edge, the hunger's doubling, the exhaustion blur
    or the plunge's white flash. Badly hurt (> 0.5), rarely (cooldown 4.5–7.5 s), a faint, quick echo
    of it in time with a step on the bad leg. The steps go uneven: a light, quick one onto the bad leg
    with a scuff of the boot dragging in after it, a heavy one onto the good. Footprints: that boot's
    print is smeared back with a short broken scuff trailing off it to the outside, every bad step and
    only on that side (unlike the tired drag's continuous groove).
  - **A fatal fall** (> 55 px): they hit the snow and lie as they landed, crumpled (twisted half onto
    a side, one leg flung out, the other knee bent up, an arm thrown past the head, the other under
    them; laid side-on to the view so it reads), in a long hollow pressed into the snow with its lip
    thrown up and dark broken lumps about it (kept in the still fallen.js holds), and don't get up:
    `death` { cause: 'fall' }, 0.8 s longer on the body than a death of cold, then the iris and the
    hand-over as usual, the body left at the foot of the wall.
  - Measured (headless, real cliffs): the ~74 px wall at (1460, 1490): a fall from 10 px nothing;
    30 px → 0.42; 42 px → 0.58; 52.5 px → 0.78; from the last move before the top-out (56.6 px)
    fatal. The ~110 px wall at (1490, 1500): fatal from half way up (55 px). Limp at 0.85: 0.30 s on
    the bad leg, 0.68 s on the good.
- **Thin ice** (slice 5, `js/world/thinice.js`). Pale thin-ice class (lum ≥ 176), faintly mottled
  darker so a careful eye can tell it from safe lake ice, carries stress in a
  grid of 4 px cells, filled only where someone has stood: explorer.js loads it every frame they're
  on it (walking, standing, cowering, knocked flat) by how heavily (1 + 0.35 × pack slots used / 10;
  snowshoes × 0.35, which now stay on on thin ice; flat on it × 0.45) and how hard they move
  (standing 0.06 / s, plus 0.1 / s at the creep's walking pace, more at a crampon march), spread
  round the feet (σ 6 px), divided by the ice's strength (×1.5 at its edge down to ×0.85 in the
  middle, so it's thinner further out; a refrozen hole × 0.6, the weakest). Cells nobody is on ease back after 1.5 s (0.035 / s): backing
  off the way you came relieves it; walking straight across holds the stress under the feet at
  ~0.3 (creaks only), lingering or turning about on it builds it.
  - **Warnings**: from 0.18 creaks, oftener as it rises, each with a quick glance down and a hairline
    flickering under the boots; at 0.4 the first real crack: a sharp crack and two or three long
    fractures (20–30 px) shooting out well past the figure (`icecracks.fracturePatch`: few, long and
    decisive, white with a thin ink underside so they read on pale ice and on a phone), and the
    explorer stops dead 0.5 s looking down (once a spell on the ice, only when walking; no load builds
    during it, and pushing back the way they came ends it at once); more fractures at 0.55, then
    cross-cracks joining them round the feet at 0.7 and 0.85, louder cracks and single fractures
    between (a level's fracture isn't drawn again within ~7 px of one already showing, and the single
    ones only while fewer than five show round the feet, so pacing over a few px doesn't bury the feet
    in a nest); they stay ~40 s and fade over ~12 s.
  - **Micro-cracks** (both kinds of ice, Joe's "little micro cracks"): at stress 0.04, 0.13 and 0.22
    under the feet a tiny white hairline appears where they tread, a few px long (finer and far
    shorter than the first crack: a main kinked line with a branch or two off it, more and longer at
    each level), inked underneath, never under about a device pixel wide (so they stay white on a
    phone). The cells round share the level, so they come about a stride apart: a walk across a lake
    leaves a trail of them, going back over it thickens and lengthens them. Each fades as its cell's
    stress eases (half its level: gone), and stays healed. A fixed pool of 160 drawn as vector strokes
    batched by alpha (eight strokes a frame at most; ~0.03 ms CPU with 80 on screen and 18 fractures).
  - **Break** at 1: a crash of the slab breaking up and a shard burst, and they're in (the usual
    plunge: white flash, gasp, cold shock). The hole (`state.holes`; `terrain.isWater` / `waterDepth`
    read it: deep right to the edge and only over thin-ice class, so it never spreads onto land; the
    shore beat treats it as a wall and the bear and the penguins keep off it): water near ink-black
    in the middle inside a jagged rim of fractured ice, slabs and chips tipped up along the edge, a
    few flat grey shards afloat, fractures round it. It only breaks on thin ice and is never wider
    than the thin ice round it (its radius and the broken ring capped by the distance to the edge).
    Drawn over the footprints. It stays open 150 s, then skins over from the rim
    inward over 100 s (the shards caught where they float) into darker new ice, drawn for the run.
  - **Self-rescue**: in the hole they swim (deep-water cold, ~23 s from full warmth). A tap (or
    pushing at the edge) is one heave: to the edge, arms up onto the ice (with axes in the pack: they go on
    by themselves, swung up and driven in), a pull up and forward, the chest onto the ice. Without axes the edge breaks off
    40% of the time (the hole widens, they drop back and lose half the way they'd made) and each pull
    costs 0.09 energy; with axes 8% and 0.035. Each heave gets them further (0.34 bare / 0.48 axes ×
    their strength, ±20%) until one carries them out: belly-down onto the ice, wriggling flat away
    from the hole (hard work: energy drains, none comes back; the pack can't be opened), then up,
    soaked through (wet = 1): the race to the tent begins. Dying in the hole:
    they slip under the ice (the sea's sink, no body; fallen.js's dark rings at the hole).
  - **Frozen lakes** (ice class 2, the big pale lakes with their painted crack networks): the same
    stress, only far stronger: 3× the weakest thin ice (to 3.75× at the shore), and moving bears on it at
    0.35 of thin ice's rate (standing at the full rate), so going about on it is ~3.5× thin ice and
    standing ~3×. Snowshoes still spread the load (but come off on ice anyway: items.js) and creeping or
    crawling still eases it. Its cells ease back after 2 s at 0.01 / s (thin: 1.5 s, 0.035 / s; about the
    same pace relative to its strength). Walking straight across holds the stress under the feet at ~0.06
    (a creep ~0.09): a trail of micro-cracks, no creak, never near a crack. Going back over the same ice or
    standing about builds it to the same warnings as thin ice: creaks from 0.18, the first real crack and
    the 0.5 s freeze beat at 0.4 (not at micro-cracks; pushing back the way they came still ends it), more
    fractures, then the break at 1: the same hole (`cls` 2, clipped to the lake: `terrain.isWater` /
    `waterDepth` count it only over lake ice), plunge, heave and refreeze. A lake's fractures (drawn with a
    lighter ink underside, 0.5, so they read white on its paler ice) aren't timed: each is tied to the
    stress of the cell it broke from and fades as that eases (gone at half its level, and stays healed), so
    a crack still showing is ice still weak; at a break the ones round the hole go over to thin ice's
    timed fade. Knockdowns (0.12) and landing from a fall (height / 40) load lake ice too (a lake hardly
    feels a knock). For wildlife: `thinice.weigh(x, y, dt, w, k)` bears on the ice like the explorer's load
    without the freeze beat; the bear chasing over ice uses it (w 3: see "The polar bear attacks").
  - Where it is on the default map: one real patch, x ~776–880, y ~1730–1774 (about 100 × 40 px,
    with dark open-water spots in it), reachable on foot; a small strip at x 1268–1294, y 1834–1854
    on the bottom edge; the rest are specks of a few px. (Terrain is Joe's: paint more in the editor.)
  - Measured (headless, sped up, back and forth on an 18 px track at (835, 1758), light pack unless
    said; two runs each): first creak 1.2–1.8 s (snowshoes 5.3), first crack 2.7–4.9 s (snowshoes
    14–15); breaks: creeping (half push) 27–29 s, walking 13–15 s, a crampon march 9.4–11.5 s,
    walking with a full pack 6.6–6.9 s (crack to break ~4 s, the tightest window), snowshoes 28–38 s;
    standing still 13–24 s (by how thin it is there). Walking straight on across it holds the stress
    under the feet at ~0.3; backing off at the first crack gets them off it unbroken. Heaving out: axes, 3 pulls in 4.4 s (Monte Carlo of the rules with the
    cold and energy: 2 heaves 27%, 3 55%, 4+ 18%); bare hands, 12 pulls with 5 edge breaks in 16.6 s,
    out with energy spent and warmth 0.28 (Monte Carlo: mean ~7 heaves, ~84% out if they heave without
    a pause). Frame time on the ice with two holes and cracks in view (1440p storm): ~10 ms.
  - Measured on lake ice (headless, sped up, light pack; lakes at (1100, 1516), (1000, 1516), (1424, 1420);
    back and forth on an 18 px track): walking straight across the 390 px lake at y 1516 never breaks it:
    peak stress 0.06 walking, 0.09 creeping (half push), no creak. Pacing: first creak 7.2–7.7 s (thin
    1.2–1.8), first real crack 16.7–18.3 s (thin 2.7–4.9), break 39–60 s (thin 13–15). Standing still:
    51 s to break (crack at 20 s). Healing, from 0.62–0.72 stress and walking off: the fractures half gone
    at ~20 s, the real cracks gone by ~45 s, the last micro-cracks ~60–80 s; a straight walk's micro trail
    lasts ~5–8 s behind them. Heaving out of a lake hole works as on thin ice. Frame time (1440p storm,
    GPU, pacing on the lake): within noise of HEAD (22–24 ms on a loaded machine both).
- **The pup tent** (slice 6, `js/actors/puptent.js`). One in the world: on the sled (`puptent`, stack 1,
  slot icon a small yellow ridge tent with its door and guy lines). Heavy: walking with it in the pack
  costs 10% more energy (body.js `PUP_DRAIN`) and it weighs as two slots on thin ice. Pitched and left
  it stays for the run; a member who dies carrying it keeps it with the body (recover it there).
  - **Pitching**: tap it in the pack. Refused with a shake of the slot where the ground won't take it
    (ice, thin ice, water, rock, a slope's lip or a cliff: the footprint and a margin round it must be one
    walkable level of snow, deep snow or path), within 25 of base camp's door or the sled, over a fallen
    member or a pile, when spent, or with the bear alert or stalking within 60. The tent's back is to the
    wind, its door turned up to 35° toward the camera so the doorway shows. The site is beside the
    explorer: at a flank, or at a corner by a gable (beside it, not on it); off to one side on screen (a
    kneeling figure in front of a tent this low hides it), the side they face first. They kneel and work
    through three stages, ~2.7 s each: the canvas unrolled across the snow (a sweeping hand at a time),
    the poles stood up (a hand up on the pole; the sheet rises sagging), six stakes driven (a fist
    hammering, the guy lines going out one by one, the sag drawn out). Each stage is slower in deep snow
    (×1.45), hurt (×(1 + 0.6 × injury)), numb (×1.5 below warmth 0.4) and in a gale (up to ×1.6). It's
    work: energy and food go at about the rate of walking on snow (body.js `JOB_DRAIN`, `JOB_FOOD`), and no
    walking heat: the cold gets in as it does standing still. Moving off stops it and the tent stays in the
    pack. Cowering waits while they kneel at it, and so do the wind's knockdowns, except while it's down
    and they're up grabbing at it (knocked over then, the try is over).
  - **The wind**: once in each stage, at a random moment, a gust can catch it: chance
    `0.56 × smooth(0.5, 1.2, w)`, w = wind + 0.6 × gust (halved in the lee of rock). Caught, the canvas
    balloons (the lee side bellying furthest, its swell inked), the two poles go over downwind and lie on
    the snow, the sheet slaps down flat and flaps (1.5 s), and the explorer comes up off their knees, arms
    flung up after it; then they gather it up (0.55 s in a breeze, up to ~2.5 s in a blizzard) and go again
    by themselves. Lost: the canvas only re-spread from the first stage; from the second or third the poles
    must go up again (and 30% of the time the canvas half blows back into a bundle too). Sound: the cloth
    cracking and a run of flaps, two wooden knocks of the poles, the sheet slumping (`pitch` collapse); a
    rustle to spread, a pole's rattle, a thud for each stake.
    Measured (headless, sped up, pitching over and over beside base camp, starting warm and rested; 15–20
    runs each): calm, always first time, 8.2 s; a breeze (wind 0.5) always first time, 8.5 s; windy
    (0.6–0.78) 1.3 tries (up to 3), 12 s; a real `?forecast=blizzard` 3.7 tries (1–9; 3 of 20 first time),
    34 s, warmth −0.23 and energy −0.05 over it; the storm spell (`?weather=storm`) 3.9 tries, 37 s,
    warmth −0.22.
  - **The pitched tent**: a low ridge tent ~18 long (about 1.1 × the explorer lying down), ~12 across,
    ridge 6.6 (base camp's ~12), in base camp's ink and signal yellow: guy lines from the ridge ends and the
    eaves to stakes, a soft cast shadow, drift building on the windward skirt. The canvas ripples and
    strains in the wind (the windward side pressed in, the lee bellied, more the stormier; the guys thrum)
    and cracks now and then close by (`flap`). Solid (`pupBlocked`); tap it (or Space / E by its door) and
    the explorer walks round and crawls in through its door exactly as at base camp (`tent-in`, `inside`,
    `tent-out`; `player.shelter` is `PUP_SHELTER`). Inside: a tap leaves; after dark a hold sleeps; the
    door's hold opens the pack. Someone in it: the stove lit, the canvas warms (less than base camp's) and
    glows at night (a smaller, dimmer light, r 16–22, and dark when it's empty), the door slit lamp-lit
    signal yellow by day too (as base camp's), stove smoke off the ridge's door end as base camp's (a touch
    smaller); the storm still loud (it muffles 72% as much), a smaller stove. The bear still knows they're
    in there (canvas isn't bear-proof; slice 7) and walks round it (`wildlife.js`).
  - **Inside, against base camp** (body.js reads `player.shelter`: camp.js `CAMP_SHELTER` is all full
    rates; the pup tent's are fractions of them): warmth at 1/3 the stove's rate, falling a further 60% in
    a storm, and none from a starving body; 16% of the outside cold leaks through (more wet, more
    starving); drying and thawing rime at 1/3; energy back at 0.7× (slower hungry); injury heals at half;
    food drains at the open-air rate (base camp saves 40%). Sleep: the same after-dark hold, eating a
    ration if hungry; it brings warmth, reserve and energy only 75% of the way back (less again on an
    empty stomach) and takes 0.15 off the injury (base camp: all the way, 0.3). The skipped night is lived
    through: the cold that gets in over the hours left is counted (drying as it goes), and warmth after
    sleep is never more than that; a body losing to the cold dies in the night and is found in the morning.
    Warmth 0 in it kills (a leaky shelter). Dying in a tent (either) they stay in there: the tent goes dark
    and unlit, and a pair of boot soles shows in the doorway, snowing over (`fallen.js`); the pack is
    recovered there like any body's. Frost from the body's own cold stays on the screen in the pup tent
    (only the weather's melts).
    Measured per minute, base camp / pup tent (calm day; storm in brackets where it differs): warmth
    +2.73 / +0.89 (storm +0.17); drying 5.0 / 1.65; rime 7.5 / 2.5; energy 4.0 / 2.8; reserve 0.20 /
    0.14; injury −0.10 / −0.05; food −0.040 / −0.067. Two days and nights in the field in steady wind
    (0.6–0.78), out walking ~90 s each day, the rest in the pup tent, sleeping each night: fed (food 0.6
    and three rations, a ration eaten at each supper) they wake both mornings at full warmth, energy and
    reserve with food ~0.6; starting hungry (0.35) with no rations, food is gone by the first morning, the
    second day's walk leaves them worn out (energy 0.08–0.13, warmth 0.38–0.68 over two runs), the tent
    and the night bring back only part of it, and they die of the cold 150–190 s into the third day.
    Soaked, starving and at warmth 0.3 in the pup tent in a blizzard night, a sleep doesn't save them:
    they die in the night and are found inside in the morning.
    Frame time (1440p storm, GPU, beside base camp): no tent 14.0–14.3 ms (HEAD 13.8–14.5 at the same
    spot), pitched tent in view 14.3–15.1 ms, while being pitched 14.2–14.4, inside it 13.4 (drawn into a
    sprite at 15 Hz, 21 Hz while the work is on, its mesh arrays reused).
  - **Striking**: press and hold the pitched tent from right by it (within 5 of its edge; its glint, a
    signal-yellow catch on the near ridge end, shows within reach, faint from twice that; further off a
    press walks or taps in as anywhere). A tap crawls in; held 0.9 s (a white arc filling round the glint)
    the explorer kneels and pulls the stakes, the tent
    coming down in reverse over 4 s as the dig bar fills over them; let go and it stays up. Done: back
    into the pack (no free slot: the canvas jerks and the full-pack knock, `full`). Keyboard: hold Space / E
    close to it (a quick press crawls in). The sled, a body or a pile in reach come first, and Space / E at
    base camp's door is always base camp's.
- **Thirst** (after the pup tent; `body.js` water, `js/fx/thirst.js` the mind, `ui/pack.js` drinking). Joe's call: its own
  stat, not hunger's. Hunger hits the body (sway, dim and doubled image, growl); thirst hits the mind (headache, confusion,
  misperception, then hallucination).
  - **The clock**: full to empty in ~13 min standing about outside (`WATER_REST` 1/800), faster than food so it's met first;
    × (1 + 0.9 × push + 0.6 × panting) working (the breath carries the moisture off) and × (1 + 0.5 × cold × exposure) in a
    cold dry wind, all told never more than ×2.2 (`WATER_MAX`). Inside a tent the stove melts snow: water comes back at
    `shelter.water` (camp.js `CAMP_SHELTER.water` 1: empty → full in 25 s; puptent.js `PUP_SHELTER.water` 0.4: 62 s) and each
    flask in the pack fills a drink every 4 s at base camp (10 s in the pup tent). A night's sleep wakes them watered with the
    flasks full. A new member after a death starts at 0.8. `body.thirst` = (0.35 − water) / 0.35: energy comes back up to 25%
    slower and the reserve wears up to ×1.4 faster; below 0.15 (`body.parched`) the reserve up to ×2 and the energy cap drops up
    to −25%; below 0.1 they stumble now and then and every climbing move is slower (up to −30%); at 0 the cold gets in +25%, the
    rest is slower again and they won't start a climb up (`refuse` reason `'parched'`: the long look up, then a mitt to the
    temple). It never kills by itself.
  - **The flask** (`flask` item, one a slot, `slot.drinks` 0–3 shown as pips, drunk ones hollow; the drinks travel with it
    through every move, drop, body and pile): one in the first member's kit, one spare on the sled; after a death the next
    member takes the sled's if it's still there (`items.js restock`). Tap it: standing, half round to the camera, they unscrew
    the cap at the chest and tip it up to the mouth, head back, ~2 s (the slot's arc fills; cap ticks, wet gulps); +0.3
    water, a drink gone. Walking off cancels it, the drink kept. Refused (the slot shakes) above 0.97 water; dimmed empty
    or wading deep snow. **Freezing: skipped** (the snow already carries the cold-for-water trade, and a frost-rimmed icon that
    only thaws in a tent would be a second rule to learn for little play).
  - **Eating snow, anywhere**: opening the pack also shows one more round slot under the explorer's feet that isn't a pack
    slot and holds nothing: a little heap of snow with three inked flakes falling on it, in a dashed ring (no grey fill, so
    it doesn't read as an eleventh slot). Tap it (or Q) on snow, deep snow or a path: they kneel, bend right down and scoop a
    mittful, kneel up and eat it (2.6 s; scoop crunch, chewing): +0.12 water for −0.05 warmth, up to −0.10 when already cold
    (warmth 0.6 → 0.2). Dimmed off snow; not in a tent (the stove's melting it there), with a container open, or with the bear
    alert or stalking within 60 (rations neither). The pack hold is taught the first time water (or food) drops below 0.35:
    the glance and the pat at the pack.
  - **The Fata Morgana** (water < 0.25, building as it falls: (0.25 − water) / 0.2, ^0.8): the map just beyond the top of
    the view, to the north (never the frame on screen), read for its darks (rock and ink, thresholded) as a profile across;
    where they cluster are the features, the heaviest 3–6 (wide runs split; none: only the horizon gleam and the haze). Each
    becomes a mirage element in a thin band along the top (13–18% of the height by strength, never over 20%): a solid flat
    grey silhouette (no texture: one of two soft sprites, a flat-topped mesa with rounded corners or a tapering tower,
    feathered at the sides, fading toward the top) standing on a soft bright false horizon, stretched up; above it, across a
    thin pale gap, its mirror hanging upside down (the stacked Fata Morgana shape); now and then a third shelf above that,
    fading in and out (a split); a faint short reflection under the horizon. Pale sky haze under and over, so they read far
    off; between them only haze. Each its own width, height and offset (fixed by where it is on the map, so they hold still
    as the view creeps). They breathe slowly (the stretch grows and shrinks over several seconds) and drift a little;
    Reduce motion holds them still. Seen alpha ~0.35–0.6 grey; no yellow (nothing is copied from the frame), the tents
    feathered out. Episodic: 9–20 s episodes with gaps of 90 s at 0.25 down to 40 s at 0.05; below 0.05 long episodes (to
    45 s) and short gaps (to 8 s). Weather: × calm × clear × sun (bright 1, plain day 0.6, ×0.15 at night, × weather.light).
    On a blinding day the glare (bright.js, after it) washes the band as it does everything up there: the haze thins and
    the shapes are laid on twice, but they stay faint. A phone held upright looks as far across as a wide screen would (the
    source spans 1.6 × max(width, 0.8 × height)). Cost: the source (320 × 40) is redrawn from the map image and its features
    extracted only as the view moves on (at most ~7 Hz); the band is composed offscreen at 30 Hz from a few sprite draws.
  - **The Third Man** (water < 0.12): a faint grey figure, the explorer's own pose for pose (`explorer.js P.ghost`: greyed
    by a saturation fill, a touch paled, the ink outline kept, alpha 0.55–0.7; no shadow, breath or prints), walking
    parallel to them off to one side of the way they're going, near the edge of the view (never up in the mirage's band) and
    a little ahead, only as far out as open ground on their own level runs (no walking through rock or across the sea).
    Keeps pace. Comes only while they walk: about once in 80 s at 0.12, every ~12 s near 0, fading in over ~3 s, staying 9–18
    s. Turn toward him or let him drift toward the middle of the view and he breaks into horizontal slices sliding apart
    and is gone (~1 s, with a faint hush like a breath let go); stop walking and he fades. Never in a tent or busy with the
    pack. While he's there, now and then a faint second footstep a beat behind their own, from where he walks.
  - **Body**: thinner breath clouds (−32% size, −45% opacity, shorter-lived at full thirst); the headache standing about
    below 0.3 (every 6–16 s, oftener the drier, ~3 s): both mitts to the temples, out at the sides of the hood, elbows out,
    for the first ~1.1 s, then the one mitt stays and rubs slowly, the head tipped into it; never at the same time as the
    hunger's mitt on the stomach (they take turns, so each reads as itself).
  - **Sound**: the breath goes dry and rasping (a thin high hiss and a crackle over every breath, a little louder: × (1 +
    0.6 × thirst)), a dry swallow every 7–20 s below 0.3, a faint high ring in the ears (6–8.6 kHz, beating, swelling in and
    out over 3.5–9 s) below 0.25, near constant at 0, and a slow shaky breath out with the headache.
  - Measured (headless, sped up): standing on a calm day −0.076/min (13.1 min to empty); walking on snow −0.145/min (6.9 min:
    the mirage's 0.25 in ~5 min, the Third Man's 0.12 in ~6); cowering in a storm −0.10/min (9.9 min); worn out and walking
    in a blizzard (panting 0.9, exposure 0.94) −0.164/min (6.1 min, the cap). Base camp empty → full 25 s, flask 0 → 3 in
    12 s; pup tent 62.5 s, flask 30 s. Cost: the thirst module ~0.07 ms CPU a frame with the mirage up (0.3 on a frame that
    rebuilds the source); frame time (1440p storm, GPU) 14.0 ms new / 14.0 HEAD in a clean pair; later pairs on a loaded
    machine ran ~30 ms for both, new and HEAD within noise.
- **Bringing them home** (the goal, part 2: `js/goal/burden.js`; the rows drawn and routed by `ui/pack.js`).
  - **Items**: a canvas sheet (`sheet`, a folded square of canvas) and a rope (`rope`, a coil) on the sled, one
    of each. Wrapping takes both from the pack, so they have to be packed against the 10 slots.
  - **The rows**: once the lost explorer's pack has been opened, a press on them (or Space / E by them) brings up
    a row of round slots above them, the tent menu's kind: open their pack, wrap them (greyed without both, the
    tip saying what's missing). On the wrapped bundle: carry on your back, drag behind you. While carrying or
    dragging, a press on the explorer (or C) brings up a row over their head instead of the pack: set them down,
    switch to dragging / carrying, open the pack. Pressed from further off, the explorer walks there first; a
    tap off a row closes it, 1-n on the keyboard pick from it.
  - **Wrapping**: the explorer kneels at them and works 5 s (the dig bar fills over them; walking off stops it and
    nothing is used); the sheet comes over them and four rope bands are tied one after another; the raised arm is
    laid down. The body becomes a bundle (~13 long): a pale canvas shroud in the painting's ink, the neck pinched
    by a band, wide at the shoulders, tapering to the bound feet with the knot's tail, a shaded side, a soft
    shadow, snow settling on it lying out. What was left in their pack is left beside it in a pile; the site
    keeps the hollow they lay in and the dead beacon.
  - **Carry**: hoisted (a 1.4 s kneel) across the shoulders, both mitts up holding it, bent under it; turned a
    little across the back over one shoulder in a side view (end-on it read as a pole); the rucksack hidden under
    it. x0.5 pace (6.5 px/s on snow), x1.9 energy, and deep snow is no worse than plain snow (pace and drain), the
    advantage of carrying; on a path it costs half plain snow's drain (no rest). Doubled load on thin ice and lake
    ice. No climbing (`refuse` reason `'burden'`, at once: the long look up, the sag). The pack opens only to eat,
    drink, or play a recorder or the radio; no containers, no snow, no dropping.
  - **Drag**: a rope from the right shoulder (over it to both mitts at the chest, leaning into it) to the head of
    the bundle, 9 long. Slack, nothing moves; taut, the head is drawn after them and the feet follow the head's own
    track, like a sled. x0.75 pace on snow, a path and ice, x0.55 (of deep snow's own pace, ~3 px/s) in deep snow; x1.4
    energy. It ploughs a trench (a grey groove the bundle's width with a lit lip, a darker floor in deep snow,
    filling in like the footprints). Never onto rock: the head stops there (snag) and the explorer is held at the
    rope's length until they come back round. On thin ice and lake ice it bears its own weight where it lies
    (0.7 of the explorer's), while dragged. No climbing.
  - **Coming off**: set down from the row (carried: beside them; dragged: the rope let go where it lies); by itself
    at death (left where it is, beside the body), deep water (at the last dry footing), knocked down (carried),
    sat down spent, and crawling into a tent (at the door).
  - **Home**: carried or dragged within 40 of base camp's tent (once it's been out past 120: the real one always
    has), it's set down and a quiet card comes up in the ending's style: ink closing in from the edges, "THEY
    BROUGHT THEM HOME", the party lost on the way (or "None of the party was lost."), "tap to go on"; a press
    takes it away and play goes on. `goal { stage: 'home' }`. All in `drawOverlay` in burden.js, to replace.
  - Measured (headless, calm day, full energy, `?terrain=` forced): plain snow, walking 13.1 px/s and 0.167
    energy/min; carrying 6.5 px/s, 0.317/min (empty in ~3.2 min of walking); dragging 9.75 px/s, 0.233/min (~4.3
    min). Deep snow, walking 5.8 px/s, 0.667/min; carrying 5.7 px/s, 0.317/min; dragging 1.8 px/s, 0.933/min
    (~64 s). Frame time (1440p storm, GPU, dragging in view): 17.3 ms median, HEAD 16.8-17.0 at the same spot
    (the module ~0.08 ms CPU).
- **The polar bear attacks** (slice 7: `js/actors/wildlife-bear.js` the bear, `js/actors/hunt.js` the flare, the
  rifle, carcasses and butchering; items in `items.js`, the taps routed by `ui/pack.js`).
  - **Working itself up**: stalking, the bear builds `aggro` (0..1) at `BEAR.RATE` (0.022/s) × (0.25 + how near:
    smooth 150 → 40) × (1 + 1.5 weak (cold, worn out, hurt) + 0.7 standing still + 0.9 carrying or dragging the lost
    explorer + 0.8 night + 0.5 raw meat in the pack + 1.2 knocked down / cowering / sat spent + 0.8 hurrying off with
    their back to it). Its circle tightens as it builds (58 → 40 units) and it circles faster; a bear worked past 0.6
    doesn't wander off at the end of its stalk. Carrying or dragging the lost explorer, it notices from 1.35× further.
  - **Backing away**: walking away from a bear that's after them (within 110), the explorer backs off slowly, facing
    it, the stride run backwards (×0.55 pace; `player.backing`): its aggro falls (−0.075/s). Further off they turn and
    walk; the bear falls behind and gives up past 320.
  - **The warning** (at aggro 1, with a way to them, within 95; 2.6 s): stopped square on, head down low, the hard
    stare; both forepaws up and slammed on the snow (a puff of snow, a thump; on ice a jolt to it: `ICE.slam` 0.3);
    a deep growl (the wind ducks under it). Backing off now sheds it ×4 faster: under 0.8 at the end it's a bluff
    (back to stalking at 0.55). Then **the charge**: a roar, 30 units/s (strides lengthening up to 2.3×, the back
    bounding), snow spraying off the paws. **The maul** on contact (6.5): thrown flat away from it (lying stunned
    ~5 s), injury +0.5–0.8, the hardest jolt and the biggest ink flinch; a second maul for the same member, or one
    past ~0.95 injury, kills: `death` { cause: 'bear' }, laid out as a fatal fall leaves them, thrown just clear in
    front of its head (no gore: monochrome, the coat's colour only), the beat on the body 2.6 s before the iris,
    the bear nosing at it 6–9 s before it goes (cooled 120 s: the next one walks out safe). Not fatal: 55% it lumbers
    off, else it circles again at 0.45. In a tent: base camp's loses it (it gives up); in the pup tent it charges
    the canvas, rakes and tears at it (`rip`) and they scramble out, then the short warning and the charge.
  - **Ways out**: back away; a flare; the rifle; base camp's tent; and **thin ice and the frozen lakes**: chasing over
    ice it bears on it (`ICE.weigh`, w 3), and ice already cracked past 0.5 (the real fractures show there) won't take
    a charging bear: it goes through (the hole widened twice for its bulk), flounders side-on in it 4.5–7 s (sunk to
    the back, a dark collar of water, a broken lip of foam, rings, splashing), heaves out on the side away from the
    explorer and lopes off (cooled 120 s). The lure: crack the ice yourself, stand beyond it. (The bear keeps to
    its home's regions: on the default map that's the frozen inlet's lake ice, not the thin-ice patch.)
  - **The flare** (`flare`, stack 2, two on the sled; slot icon a paper tube with a signal-yellow striker cap): tap it,
    the explorer strikes it at the chest (0.9 s, a rasp and a rush) and holds it up high, out to the side: a fizzing
    signal-yellow fire (tongues, a white heart, a soft glow), sparks, a thin plume of smoke streaming off downwind,
    20 s. A bear within 80 of it flees (any state but swimming). By night it lights the snow round them (a warm pool,
    `state.lights`, with a core). Anything that needs both hands (the rifle, the pack, butchering), a knockdown or
    a tent: it's stuck upright in the snow where they stand, burning on there.
  - **The rifle** (`rifle`, one on the sled; `cartridges` stack 5, ten on the sled): tap it, the pack closes and it's
    raised (0.45 s), turned onto the nearest animal in front of them within 140 (else the nearest in range): a small
    inked bracket round it (four corners, ink with a pale halo, after the night grade; tightening as the aim settles,
    swaying by how unsteady the shot is). A tap anywhere fires; a tap on another animal switches; a tap on the
    explorer, the keys or the stick lower it (touch: a quick tap on the stick half fires, a drag lowers). A target
    shot dead isn't replaced by another on its own (no stray shot into the dogs behind it). Each shot: a cartridge,
    a hard crack with its echo coming back off the ice two or three times, the wind ducking, a muzzle flash, a
    puff of smoke, the aim kicked up, the bolt worked (1.25 s a shot); none left: a dry click. Hit chance
    (`hitChance`): 0.97 at 15 falling to ~0.3 at 140; ×(1 − 0.35 × the wind on them), ×(1 − 0.4 × cold hands: warmth
    0.65 → 0.15), ×(1 − 0.15 blown), ×(1 − 0.1 × injury), a snap shot ×0.75 (full after ~1.3 s on aim); a bear ×1.1
    (×0.8 charging flat out), a penguin ×0.85. A miss kicks up snow by the target. The bear takes 3 hits (each: a
    bellow and a jolt; wounded it flees, or comes on harder: 55% if already charging, 40% close in); a penguin or a
    dog 1. Every shot scatters the penguins within 220; the dogs whine and press flat (cowering) at the raised rifle
    within 90 and for 14 s after a shot; shooting one of them is allowed, and grim. A bear close that isn't hit:
    half the time it runs, else it's riled (+0.35). With the bear worked up within 60 the pack still opens, but only
    the rifle and the flares can be used (the rest dimmed).
  - **Carcasses** stay where they fell, the snow under them a shade darker: the bear rolled onto its side, legs out
    stiff; a dog the same; a penguin laid over on its side. Hold on one (Space / E by it): a round-slot row over it,
    Butcher (a knife): kneel at it 6 s (the bar fills; walking off stops it, nothing lost; not with the bear near):
    meat (penguin 1, dog 3, bear 6) into the pack as far as it goes, the rest left in a pile by it; the carcass is
    gone, its stain stays. **Raw meat** (`meat`, stack 3; a frozen grey-brown slab with a knuckle of bone): eaten from
    the pack +0.25 food, −0.035 warmth (frozen); cooked in a tent (the tent menu's Cook, a pan) +0.5 food, +0.05
    warmth. Carrying it, a bear works up faster.
  - Measured (headless, GPU): a healthy explorer standing still with the bear close: alert 3 s, stalking ~21 s
    (20.4 / 20.6 s two runs; 22–24 s on the inlet), the warning 2.6 s, the charge 1.5 s from ~44 units, the maul
    (injury 0.64–0.79). Backing away: aggro held at 0 while backing; never charged in 40 s. Hit chances (calm, warm,
    held): 20 / 40 / 60 / 80 / 100 / 120 / 140 units → bear 0.97 / 0.95 / 0.83 / 0.70 / 0.58 / 0.46 / 0.34; wind 0.6
    0.84 … 0.27; cold (warmth 0.3) 0.73 … 0.23; storm and cold 0.50 … 0.16; charging bear 0.85 … 0.27; penguin 0.83 …
    0.26; dog 0.97 … 0.31. Shots to kill the bear (Monte Carlo, standing): 3.1 / 3.2 / 3.6 / 4.3 / 5.2 / 6.6 / 8.9;
    in wind 0.6 and cold (0.4) 4.4 … 14. Raw meat +0.247 food, −0.036 warmth; cooked +0.498. Frame time (1440p storm,
    GPU, the bear close): 22.6–23.8 ms, HEAD 23.2–24.8 at the same spot; flare lit 14.6, aiming 17.0, mid-charge
    19.1 (a lighter scene).
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
