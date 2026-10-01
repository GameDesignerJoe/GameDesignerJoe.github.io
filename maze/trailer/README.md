# The Maze — 30-second trailer

`trailer.mp4` — 1920×1080, 30 fps, 35.6 s, no voice-over (the second cut: longer act-one shots and exit, title line "THE ONLY WAY OUT IS THROUGH."). Every frame of game footage is the real
first-person game (`../maze-fp.html`, seed 4242) driven through its debug handle (`window.FP`) under a
frozen clock, so camera moves are smooth and every event (the turn, the being, the father, the lies,
the heart, the way out) is the engine's own. The score is synthesized in Web Audio from the game's
own music presets (the Child's music-box motif, the Turn's scale, the heart's tune) at 96 BPM; every
cut and hit in the edit is on that grid.

## Rebuilding

Needs Chromium via Playwright and ffmpeg (both preinstalled in Claude Code on the web). Big
intermediates go in `work/` (git-ignored; ~300 MB of frames).

```sh
# 1. the game, served from the repo root
python3 -m http.server 8765 --bind 127.0.0.1 &        # from the repo root
# 2. footage: one folder of frames per shot (see src/shots.mjs)
cd maze/trailer/src
node shoot.mjs wake2 hall3 waiting wallroom kid page cards fire turn roomdark being hide lies heart exit
node map.mjs 4242 && cp ../work/map_4242.json map.json   # the plan the fly-over is drawn from
# 3. the score → work/score.wav
node rendermusic.mjs
# 4. the edit: compositor page + WebGL post, piped to ffmpeg
(cd .. && python3 -m http.server 8766 --bind 127.0.0.1 &)
node comp.mjs --all                                      # → work/trailer.mp4
node comp.mjs --stills 150,450,840                       # spot-check frames → work/stills/
```

| File | What it is |
| --- | --- |
| `src/shots.mjs` | every shot: where the camera goes and which game events fire when |
| `src/shoot.mjs`, `src/lib.mjs` | open the game under Playwright's fake clock and capture a shot frame by frame |
| `src/music.js` | the score, as a Web Audio `OfflineAudioContext` render |
| `src/comp.html` | the edit (EDL), kinetic type, the 3D fly-over of the maze plan, and the post shader |
| `src/comp.mjs` | renders `comp.html` frame by frame into ffmpeg with the score |

Fonts: Anton, Space Mono, Cormorant Garamond (SIL OFL, Google Fonts) and the game's own Caveat.
