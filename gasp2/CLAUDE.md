# GASP 2 — brief for Claude

GASP 2 is Joe's local app for making AI vertical-drama clips: script → storyboard of keyframes → video → sound.
It replaces GASP 1.0 (`../gasp-studio/`), which grew too many fields. 2.0 is the "electric bike":
few fields, a storyboard grid as home, everything regenerable in place.

**Read first:**
- The design doc, *GASP 2.0 — The Electric Bike*: https://claude.ai/artifact/2EENXdgYTL7ZWc56Qjx8va (Claude Doc; read it
  with the Claude Docs connector if you have it, or ask Joe to paste it).
- `PLAN.md` in this folder: the milestone checklist. **Tick items off as you finish them and add a line to its
  log**, so whichever machine or session picks this up next can see exactly how far things got.

## Ground rules

- **Work on `main` and push to `main`** (repo-level CLAUDE.md). `git pull --rebase origin main` before pushing;
  Joe works from more than one machine.
- **Everything lives in `gasp2/`.** Don't change `gasp-studio/` (1.0) except to fix something Joe asks for.
  Borrow from it freely by copying: its fal adapter, launcher and stage editor are proven.
- **Keys never go to GitHub.** They live in `gasp2/.env` (git-ignored), written by the app's Settings. Missing
  keys fall back to `../gasp-studio/.env`. The repo is public: never commit `.env`, `settings.json` or art.
- **The library lives outside the repo**, default `C:\Users\<you>\GASP Library` (Settings can change it).
  Layout is in the design doc, "Folders on your PC". Rules: readable names; the in-use file sits at the top of
  a shot folder (`keyframe.png`, `video.mp4`), every version stays in `takes\`; deletes go to `_Trash\`; folder
  names follow titles and order (the app tracks shots by id, so renames are safe).
- **Every paid generation is logged** to `GASP Library\spend-log.csv` (when, story, episode, shot, kind,
  model, seconds, cost, file). The header shows the total; the Spend window compares models.
- **No dependencies beyond Node 18+ and ffmpeg.** Plain `node:http` server, single-file app
  (`app/index.html`). Keep it that way unless a step clearly needs more.
- **Joe's PC is Windows.** Give Windows paths and commands. He launches from the desktop shortcut (made by
  `Create desktop shortcut.bat`); `GASP 2 (with log).bat` shows the server log for troubleshooting.

## Layout

| Path | What |
| --- | --- |
| `server.js` | Local server on port 4848: API, library on disk, background jobs, spend log |
| `lib/fal.js` | fal queue API, storage upload, image-to-video, image generation with references, background removal, dry-run placeholders |
| `lib/chat.js` | Chat calls (fal LLM router or Groq, OpenAI format), the system prompt, ```gasp action blocks |
| `models.json` | Models on fal: video (endpoint, image field, lengths, $/s), image (edit + text endpoints, size field, max references, $/image), cutout (background removal). Add a model = add an entry |
| `app/index.html` | The whole UI |
| `app/script.js` | The shot format: parser and script edits, shared by app and server (one global, no build) |
| `gasp2-app.ps1` / `.vbs`, `*.bat` | Windows launchers (hidden server, app window, background `git pull`) |
| `PLAN.md` | Build checklist and log — keep it current |

## How to test

- `GASP_DRY=1 node server.js --port 4850 --noopen` runs with no network calls: video generation makes a
  placeholder push-in from the keyframe with ffmpeg, and the spend log records $0 "(dry run)".
- Drive it with Playwright (pre-installed in Claude's cloud sandbox) or by hand at http://localhost:4850.
- Real fal calls only work on Joe's PC with his key. When a step adds a new paid call, tell Joe what to try
  first and what it should cost.

## API sketch (server.js)

`GET /api/state` · `POST /api/settings` · `GET /api/spend` · `POST /api/story/new|rename` · `GET /api/story?id=` ·
`POST /api/episode/new|rename` · `POST /api/shot/new|update|move|duplicate|delete` · `POST /api/keyframe` ·
`POST /api/take/use|delete` · `GET /api/script` · `POST /api/script/save|sync` · `POST /api/gen/video` · `GET|POST /api/chat` · `POST /api/chat/act|clear` · `GET /api/update/check` · `POST /api/update|restart` · `GET /api/jobs` · `GET /api/events` (SSE `job`) ·
`GET /api/refs` · `POST /api/ref/new|update|delete` · `POST /api/ref/image/new|set|rename|delete` · `POST /api/ref/take/use|delete` · `POST /api/gen/keyframe|ref|refine|cutout` · `POST /api/ref/write|look` (Claude writes an image prompt or a Look, seeing the images) · `POST /api/shot/write` (Claude writes a shot's IMAGE or MOTION prompt from its references, keyframe and script beat) · `POST /api/story/art|style/add|style/delete` (world, art direction, style images) ·
`POST /api/reveal` (opens the folder in Explorer; story/ep/shot, a card, or the Reference folder) · `POST /api/update` (git pull) · `GET /lib/<path>` (library files).
Reference cards are `Reference\<Characters|Locations|Props>\<Name>\card.json` with the in-use image of each named image on top and every version in `takes\`; shots find cards by name (WHO: line, SHOT location, props in IMAGE). Story data is `story.json` in each story folder; each episode's script is `script.txt` in its episode folder. The app never stores story data in the browser.
Shot ↔ script links are `[[#<shot id>]]` tags at the end of SHOT lines; Shots edits are written back into the script only once it has linked shots.
