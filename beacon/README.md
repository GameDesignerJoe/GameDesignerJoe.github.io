# Beacon (working title)

A little drone, a big quiet island, and ten radio stations still playing to nobody. Hot/cold
song hunting in full 3D, in the browser, on desktop and phone.

Live: https://gamedesignerjoe.github.io/beacon/

## What's in it

- One file, `index.html`, Three.js from a CDN, no build step. Everything tunable is in
  the `CONFIG` block at the top of the script.
- A lost Earth. An area about 3.2 km across, generated from a seed: hills, a river,
  ring mountains, dirt trails, forests, rocks, grass and flower patches.
- Sky and weather: a full day/night cycle (12 real minutes), clear / overcast / rain /
  fog drifting on their own, cloud shadows, gusts that roll through the grass, a
  headlamp at night.
- The drone hovers a couple of metres off the ground and moves through the space. It
  can't fly. Steep ground slows it to a crawl; trunks, big rocks and masts stop it.
  It chirps to itself, and its lights pulse with whatever song is playing.
- The hunt: ten radio stations, each still broadcasting one song. Ping paints a cone
  on the ground around the drone pointing roughly at the nearest one; the cone narrows
  as you get closer. Near a station its song bleeds through as thin radio and you can
  see its red light. Hold to scan and the song plays.
- Ping has a recharge and the paint only lasts a few seconds. Each song found upgrades
  one, then the other, back and forth (`pingCooldown` and `pingShow` in CONFIG).
- Find all ten and the drone is beamed up, you get the list of songs, and you can drop
  into a new area: a new seed, ten more songs. Songs don't repeat until all have played.
- Songs live in `songs/`. The list is the `SONGS` array near the top of the script:
  add a file, add a line.

## Controls

Desktop: WASD, mouse look, Shift boost, Space / C for a little hop or dip, Q ping,
hold E scan, X stops the song. T jumps time 3 hours, 1-4 pick weather, 0 hands
weather back.

Phone (landscape): left thumb moves, right thumb looks. Ping and Scan buttons on the
right. Tap the clock or the weather label to change them.

## URL switches (for looking at conditions)

`?t=18` hour, `?w=clear|overcast|rain|fog`, `?at=2` start beside station 2,
`?seed=123` a particular area, `?reset` start over from area 1, `?demo` skip the title.

## How it maps to "Making Collectibles Count"

| Rule                    | Now                         | Open |
|---|---|---|
| Consistent location     | Always a mast on a hilltop  | Second collectible type with its own rule |
| Discoverability         | Ping cone on the ground, song bleed, mast light | A rabbit hole: chain one find into the next |
| Fictional justification | Dead transmitters still repeating | Fallen Earth where radio stations continued to broadcast even as humanity disappeared... what happened there anyways? |
| World building          | A new song, played at every mast/station | A different song per mast/station |
| Character attachment    | None yet | What does the drone want? | Is the drone powered by music? Does it just love music... lol, maybe it's a discoball trying to find music that can bounce off of it and have fun lighting and spins.
| Skillful mechanic       | Reading terrain for high ground | Scan could ask something of you |
| Appropriate reward      | The song, plus a better ping each time | Something the drone itself gains |
| Responsible quantity    | 10 | Sets per region |

## Not done

No real shadows, no Blender assets yet. Ran great on a real phone at 1.6 km; 3.2 km
with four times the trees is untested on a phone. The hover and the new loop have only
been run in an automated test browser.
