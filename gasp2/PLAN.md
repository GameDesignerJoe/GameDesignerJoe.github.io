# GASP 2 build plan

The milestone checklist for GASP 2. **Whoever works on it ticks items as they land and adds a log line**, so any
machine or session can see how far it got. Design: *GASP 2.0 — The Electric Bike* (link in `CLAUDE.md`).

Status: **Steps 1–4 built (dry-run tested). Step 4 chat needs Joe's first real message to confirm fal's chat endpoint.**

## Step 1 — The shell and Settings
- [x] `gasp2/` folder: Node server (port 4848), single-file app, no dependencies
- [x] Windows launchers: hidden server + app window, background `git pull`, desktop shortcut, log-window variant
- [x] Library folder outside the repo (default `%USERPROFILE%\GASP Library`): Reference, Stories, `_Trash`
- [x] Story list in the header (most recent first), New story, one folder per story with `story.json` + `script.txt`
- [x] Settings ⚙: keys for fal, Groq, ElevenLabs, Anthropic, OpenAI (saved to git-ignored `.env`; falls back to 1.0's keys)
- [x] Settings: default video model, library folder, Check for updates
- [x] Spend: header total, `spend-log.csv` per generation, Spend window with per-model totals and real $/second
- [x] Updates from the app: checks GitHub on launch and every 30 min, **Update ready** button in the header, pulls with rebase (copes with a local commit), restarts itself and reloads
- [ ] Test buttons per connection (cheap call to prove a key works)
- [ ] Joe: first launch on Windows, desktop shortcut, keys picked up from 1.0

## Step 2 — Shots tab
- [x] Episodes: tabs, add, rename (renames the folder)
- [x] Storyboard grid, 9:16 tiles, number, title, image/video badge, hover plays video
- [x] Drop images on the grid → one new shot per image (sorted by file name); drop on a tile → new keyframe
- [x] Ctrl+V pastes a copied image into the selected shot
- [x] Reorder by dragging; insert before any tile; add at end; duplicate; delete to `_Trash` (folders renumber)
- [x] Details panel: title, hero (keyframe/video toggle), image prompt + Copy, motion prompt, notes
- [x] Generate video: model picker (6 fal models), length per model, cost estimate, background job with progress
- [x] History strip: every keyframe and video, viewer with Use / Download / Move to Trash
- [x] Show folder buttons (story, episode, shot) open Explorer
- [ ] Joe: first real video on each model he wants to compare (start with Kling 2.6 Pro, Veo 3.1 Fast, Seedance)
- [ ] Multi-select tiles → generate videos for all (moved to step 8 if not needed sooner)

## Step 3 — Script tab
- [x] One script per episode: `EpNN - Title\script.txt`, autosaved; old versions kept in `script history\`
- [x] Screenplay-style editor with colour for scenes, SHOT lines, fields, character names and dialogue
- [x] Tab on an empty line cycles `SHOT:` → `IMAGE:` → `MOTION:` → `SFX:` → `NOTE:`; Enter after SHOT gives IMAGE, after IMAGE gives MOTION; Ctrl+S saves
- [x] Tab completes a character name already used in the script (`WR` → `WREN: `)
- [x] Ghost suggestions: grey text at the end of a line guesses the next element (SCENE → SHOT → IMAGE → MOTION → a character → SFX → NOTE) or finishes a keyword/name; Tab or → accepts, Esc dismisses
- [x] Empty script shows a faint example page; an Example pane beside the page (format, how it reads, keys) replaces the pop-up guide
- [x] **Check format**: fixes what is certain (chat formatting, label case and synonyms like Camera → MOTION, SHOT line tidy-up, speaker names in caps), flags the rest by line (no SHOT lines, text above the first shot, missing IMAGE/MOTION, untitled shot, unknown labels, duplicate links, lengths over 15s); Ctrl+Z undoes
- [x] Spell check: the editor uses the app window's built-in spell check (red underline, right-click for suggestions)
- [ ] Names also auto-complete from the Reference tab (needs step 6)
- [x] Shot format + parser shared by app and server (`app/script.js`); format guide with Copy for Claude projects
- [x] **Sync to Shots**: new SHOTs become tiles, linked ones update (title, framing, location, length, prompts, dialogue, SFX); keyframes and videos untouched; the link is a `[[#id]]` tag on each SHOT line
- [x] Shots only in the grid after a sync: add them to the script, move them to Trash, or keep them
- [x] Edits in Shots write back: title/length → SHOT line, image/motion prompts and notes → their lines, reorder → blocks move, delete → block removed, new/duplicate shot → block inserted
- [x] Shot panel shows dialogue and SFX from the script, with Open in script
- [x] Copy for Claude: whole episode (guide + shot status + script), or one shot from its panel

## Step 4 — In-app chat
- [x] 💬 Chat drawer beside every tab; one conversation per story in `chat.json` (New chat archives to `chat history\`)
- [x] Calls fal's OpenAI-style chat endpoint (`openrouter/router/openai/v1/chat/completions`) or Groq's; model picked in Settings (Claude Sonnet 5 default, Opus 5.5, Sonnet 4.6, GPT-OSS 120B, Kimi K2, Llama 3.3, or any model id)
- [x] Each message carries the episode script, shot list with status, characters and the format guide (`lib/chat.js`)
- [x] Proposals come back as ```gasp blocks → cards: rewrite script, add to script, change a shot. Apply / Dismiss / Undo (an add is undone by removing its shots, so later edits survive; a rewrite brings the old script back)
- [x] Chat cost logged per message when the provider reports it (tokens always)
- [x] Joe's first real message worked on fal (Claude Sonnet 5, $0.06), but a 19-shot script hit the reply limit and its JSON proposal was cut off. Fixed: scripts are proposed in plain text (`replace_script` / `summary:` / `---` / script), reply limit raised to 16k tokens, a cut-off proposal shows a card with "Ask for it again, complete"
- [x] Episode header lines `FORMAT: 16:9` (or 9:16, 1:1) and `STYLE: …` above the first SHOT: tiles and previews follow the format, video models that take an aspect ratio get it, Copy prompt adds the style and format, the chat writes them
- [ ] Attach images and files to a chat message (Joe tried to attach a sample script and art in his first message)
- [ ] Compare Claude on fal with a Groq model for quality and cost; pick the default
- [ ] Image references in chat (paste a keyframe and ask about it): fal's endpoint accepts `image_urls`

## From the Grim-at-the-Fence comparison (Nov 13)
- [ ] **Clips**: group consecutive shots into one video generation for multi-shot models (Seedance 2.0 takes "Shot 1 (0–4 s) … Shot 2 …" in one prompt, up to 15 s). A `CLIP:` heading in the script; one Generate per clip in Shots
- [x] Model minimum lengths: Check format warns when a shot is shorter than the default video model makes; the chat sizes shots to that model's lengths
- [ ] The cut trims longer clips down to the shot length (Sound tab / export)
- [x] The method: the chat writes a brief above the first SHOT (FORMAT, STYLE, TONE, RULES, LIGHT, CAMERA, CAST, AUDIO), reuses CAST wording in every IMAGE, follows the light/palette progression and camera rules, stages violence so content filters pass (implied, victims and children off-frame or shielded, no gore words), and asks before writing when format/style/length/limits are missing. Guide, example page and Check format know the brief lines


- [ ] Image prompt + references (shot's characters, location, props, extras) + model picker + 1/2/4 results
- [ ] Results into the shot's History; Use / Download / Trash
- [ ] Optional Compose: 1.0's stage editor as a layout guide

## Step 6 — Reference tab
- [ ] Character cards: full-body cutout, face close-up, a cutout per outfit, voice (no emotion images)
- [ ] Location cards (empty-set images) and prop cards (transparent)
- [ ] Background removal for non-ChatGPT images, choice of tool
- [ ] Shared across stories in `GASP Library\Reference`; shots pick references by name

## Step 7 — Sound tab
- [ ] Timeline under the shots: Dialogue, Ambience, Effects, Music lanes
- [ ] Works on stills first (animatic), so timing is locked before video; shot length follows its sound
- [ ] Voices and lip-sync; ambience/effects/music generation; model pick per job in Settings
- [ ] Mixer row per lane, Play the whole cut, Export MP4 into the episode folder

## Step 8 — Batch and polish
- [ ] Multi-select generate; keyboard shortcuts; interactive choices back on (engine parked, not removed)

## Log
- 2026-11-13 — Compared GASP's first script with Joe's Taplot-made .md (~$50 video). Took the .md's method into how the chat writes every script; Joe will rerun the same prompt in a new story to compare.
- 2026-11-13 — First real chat: works on fal. Fixed cut-off proposals; added FORMAT/STYLE (Joe's first project is 16:9, 1980s cartoon style).
- 2026-11-12 — Step 4 chat built and dry-run tested (two cards applied, undo of the add removed its shot and kept the later shot edit). IMAGE prompts no longer use names: WHO: line added to the format, example and Check format.
- 2026-11-12 — Check format added. Joe expects to write mostly by talking to Claude, so no more time on the editor unless he asks.
- 2026-11-12 — One-click updates (Joe hit a "diverging branches" error from the old fast-forward-only pull).
- 2026-11-12 — Script tab helpers from Joe's first look: ghost suggestions, faint example page when empty, Example pane beside the editor.
- 2026-11-12 — Step 3 (Script tab) built and dry-run tested: paste a script → sync → 3 tiles; Tab/Enter helpers;
  prompt edit, reorder, delete and image drop in Shots all wrote back to `script.txt`; script history kept.
- 2026-11-12 — Steps 1 and 2 built in the cloud session and tested in dry-run mode (drop 3 images → 3 shots,
  generate video, reorder renames folders, history, Trash, Settings keys, spend log). Not yet run on Windows
  or against real fal.
