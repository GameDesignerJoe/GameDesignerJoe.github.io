# Beacon (working title)

A little drone, a big quiet island, and five transmitters still repeating. Hot/cold
signal hunting in full 3D, in the browser, on desktop and phone.

Live: https://gamedesignerjoe.github.io/beacon/

## What's in this first pass

- One file, `index.html`, Three.js from a CDN, no build step. Everything tunable is in
  the `CONFIG` block at the top of the script.
- An island about 1.6 km across, generated from a seed: hills, a river, ring mountains,
  dirt trails, forests, rocks, grass and flower patches that follow the camera.
- Sky and weather: a full day/night cycle (12 real minutes), clear / overcast / rain /
  fog drifting on their own, cloud shadows, gusts that roll through the grass, a
  headlamp at night.
- The drone: procedural model after the reference sheet, chase camera, fly where you look.
- The hunt: a signal meter and ticks that speed up as you close in (hot/cold), a ping
  that gives a rough bearing which tightens as you get nearer, a blinking mast light
  for the last stretch, hold to scan, then the recording plays.
- Sound is all generated (wind, rain, drone, ticks) except `transmission.mp3`.

## Controls

Desktop: WASD, mouse look, Space / C up and down, Shift boost, Q ping, hold E scan,
X stops the recording. T jumps time 3 hours, 1-4 pick weather, 0 hands weather back.

Phone (landscape): left thumb flies, right thumb looks. Ping and Scan buttons on the
right. Tap the clock or the weather label to change them.

## URL switches (for looking at conditions)

`?t=18` hour, `?w=clear|overcast|rain|fog`, `?at=2` start beside transmitter 2,
`?alt=30` extra height, `?reset` forget found transmitters, `?demo` skip the title.

## How it maps to "Making Collectibles Count"

| Rule | Now | Open |
|---|---|---|
| Consistent location | Always a mast on a hilltop | Second collectible type with its own rule |
| Discoverability | Signal + ping + mast light, three ranges | A rabbit hole: chain one find into the next |
| Fictional justification | Dead transmitters still repeating | Pick the fiction: fallen Earth or alien survey |
| World building | One recording, played at every mast | A different voice per mast |
| Character attachment | None yet | What does the drone want? |
| Skillful mechanic | Reading terrain for high ground | Scan could ask something of you |
| Appropriate reward | The recording | Something the drone gains per find |
| Responsible quantity | Five | Sets per region |

## Not done

No collisions with trees, no real shadows, one recording for all five masts, no
Blender assets yet. Never run on a real phone: frame rate there is unknown.
