# GASP 2 build plan

The milestone checklist for GASP 2. **Whoever works on it ticks items as they land and adds a log line**, so any
machine or session can see how far it got. Design: *GASP 2.0 — The Electric Bike* (link in `CLAUDE.md`).

Status: **Steps 1 and 2 built (dry-run tested). Waiting on Joe's first real run on Windows.**

## Step 1 — The shell and Settings
- [x] `gasp2/` folder: Node server (port 4848), single-file app, no dependencies
- [x] Windows launchers: hidden server + app window, background `git pull`, desktop shortcut, log-window variant
- [x] Library folder outside the repo (default `%USERPROFILE%\GASP Library`): Reference, Stories, `_Trash`
- [x] Story list in the header (most recent first), New story, one folder per story with `story.json` + `script.txt`
- [x] Settings ⚙: keys for fal, Groq, ElevenLabs, Anthropic, OpenAI (saved to git-ignored `.env`; falls back to 1.0's keys)
- [x] Settings: default video model, library folder, Check for updates
- [x] Spend: header total, `spend-log.csv` per generation, Spend window with per-model totals and real $/second
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
- [ ] Screenplay-style editor: Enter/Tab step through scene, shot, action, character, dialogue, sound cue
- [ ] Character and location names auto-complete from Reference
- [ ] Shot callout format (see the design doc, "Chat") and **Sync to Shots**: creates/updates tiles, keeps generated media
- [ ] Shot prompt edits in the panel write back to the script
- [ ] Copy for Claude (whole script + status, or one shot)

## Step 4 — In-app chat
- [ ] Test Claude via fal's LLM router (`openrouter/router`, model e.g. `anthropic/claude-sonnet-...`): quality, speed, cost per session
- [ ] Test Groq (e.g. `openai/gpt-oss-120b`) as the fast option; pick defaults in Settings
- [ ] Chat panel beside every tab; reads script, cards and shots; proposes edits as accept/undo cards
- [ ] Chat cost goes in the spend log

## Step 5 — Keyframe generation
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
- 2026-11-12 — Steps 1 and 2 built in the cloud session and tested in dry-run mode (drop 3 images → 3 shots,
  generate video, reorder renames folders, history, Trash, Settings keys, spend log). Not yet run on Windows
  or against real fal.
