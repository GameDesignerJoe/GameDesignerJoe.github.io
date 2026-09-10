# The Maze — data

Everything here is tuning and text. **No engine code.** Edit a file, refresh,
see the change. Nothing needs building.

| File | What's in it | You'd come here to… |
| --- | --- | --- |
| `config.js` | `SIZES`, `CONFIG` | change how the maze feels — light radius, speed, how branchy it is, how straight the halls run and how much of the grid they fill (`hallStraightness`, `hallFill`, `turnsPresets`), what the districts are made of (`clusters`, `clusterCells`, `clusterHearts`), how much chalk, how dark, how many doors |
| `phases.js` | `PHASES`, `STONES` | change which self gets which features, or the order of the seven stones |
| `text.js` | every line the player reads | rewrite the prose |
| `music.js` | `MUSIC` | change a generative preset |

## Editing on a phone

These load as plain `<script src>` before the engine, so they are the same
consts the game has always had — just in their own files. That means:

- **No build step**, no bundler, no Vite. Same as before.
- **Comments survive.** This is why they are `.js` and not `.json`: `CONFIG`
  carries 65 comments and they are the design intent, not decoration. JSON
  cannot hold them.
- **The game still opens straight off the filesystem**, no server needed.
- A syntax error breaks the whole file — the game will boot to a blank screen
  with the reason in the browser console. Missing commas and unbalanced quotes
  are the usual culprits.

## Prose in `text.js`

Strings are single-quoted or double-quoted JavaScript. An apostrophe inside a
double-quoted string is fine (`"i dont no this place."`); inside a
single-quoted one it needs a backslash (`'don\'t'`). Easiest rule: use double
quotes for anything with an apostrophe in it, which is what the existing lines
mostly do.

Voices matter and the game does not enforce them:

- **The Child** never speaks in an adult voice. Lowercase, misspelled, short.
- Everything is **first person, half-remembered** — the interior voice. No
  system voice anywhere the player reads.
- Helper cards (`TUTORIALS`) are the player recalling how a thing works, not
  instructions.

`docs/HANDOFF.md` §2 and §10 have the full rules.

## After changing something

`docs/HANDOFF.md` §9 says to verify. From the repo root:

```
python3 -m http.server 8765
node maze/tools/harness.mjs     # nothing about generation broke
node maze/tools/smoke.mjs       # it still boots, walks, marks, saves
```

Text-only edits can't break generation, but `config.js` and `phases.js` can —
the harness is there for exactly that.
