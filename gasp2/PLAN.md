# GASP 2 build plan

The milestone checklist for GASP 2. **Whoever works on it ticks items as they land and adds a log line**, so any
machine or session can see how far it got. Design: *GASP 2.0 — The Electric Bike* (link in `CLAUDE.md`).

Status: **Steps 1–6 built (dry-run tested). Steps 5–6 need Joe's first real keyframe and background removal on fal.**

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
- [x] Names also auto-complete from the Reference tab (character cards and their "also called" names)
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
- [x] Attach to a chat message: 📎, paste or drop images, PDFs (text pulled out by pdf.js, bundled in `app/vendor`), text files; links in a message are read (Google Docs/Sheets/Slides shared as "Anyone with the link", web pages). Saved in the story's `chat files\`; images go to the model for the last 3 turns that had them
- [x] Chat drawer: drag its left edge to resize (double-click resets), the message box grows as you type, a status line under the title (connected / checking / the error) with Test, clear messages for no key, no credit, rate limits, timeouts and a model that can't read images
- [ ] Compare Claude on fal with a Groq model for quality and cost; pick the default
- [x] Image references in chat (paste a keyframe and ask about it)

## From the Grim-at-the-Fence comparison (Nov 13)
- [ ] **Clips**: group consecutive shots into one video generation for multi-shot models (Seedance 2.0 takes "Shot 1 (0–4 s) … Shot 2 …" in one prompt, up to 15 s). A `CLIP:` heading in the script; one Generate per clip in Shots
- [x] Model minimum lengths: Check format warns when a shot is shorter than the default video model makes; the chat sizes shots to that model's lengths
- [ ] The cut trims longer clips down to the shot length (Sound tab / export)
- [x] The method: the chat writes a brief above the first SHOT (FORMAT, STYLE, TONE, RULES, LIGHT, CAMERA, CAST, AUDIO), reuses CAST wording in every IMAGE, follows the light/palette progression and camera rules, stages violence so content filters pass (implied, victims and children off-frame or shielded, no gore words), and asks before writing when format/style/length/limits are missing. Guide, example page and Check format know the brief lines
## Step 5 — Keyframe generation
- [x] Shot panel: image prompt + references + image model + 1/2/4 results + Generate keyframe, cost estimate, background job
- [x] References picked by name: WHO: characters (or their "also called" names), the SHOT line's location, props named in the image prompt; each is a chip to switch off, with a choice of which of the card's images; + Add for other cards or the previous shot's keyframe; "+ X card" for names with no card yet. Picks are saved per shot
- [x] The prompt sent = STYLE + image prompt + a line saying what each reference image is for (never names) + the frame shape; "What was sent" shows it
- [x] Results land in History marked "new"; the first is used only if the shot had no keyframe; spend logged per run
- [x] Image models in `models.json`: Seedream 4.5 (default, $0.04), Nano Banana Pro ($0.15, looser content setting), Nano Banana ($0.039), FLUX Kontext Max ($0.08), Seedream 4.0 ($0.03). Default in Settings
- [ ] Joe: first real keyframe with references (try Seedream 4.5, then Nano Banana Pro on the same shot)
- [ ] Optional Compose: 1.0's stage editor as a layout guide (step 8)

## Step 6 — Reference tab
- [x] Three rows of cards: Characters, Locations, Props. A card = name, "also called" names, a look (the words prompts reuse), a voice (characters), and named images
- [x] Character starts with "full body"; + Face, + Outfit, + Image. Location starts with "set", prop with "prop"
- [x] Each image: drop / paste / choose a file, or Generate (prompt written from the look and the label, the card's other images as references so it stays the same person, the story's STYLE optional, 1/2/4 results); every version kept in `takes\`; click to view, Use, Download, Trash
- [x] Remove background (BiRefNet v2 default, Bria RMBG 2.0; pick in Settings): the cutout becomes a new take, the original stays
- [x] Shared across stories in `GASP Library\Reference\<Kind>\<Name>\` (`card.json`, the in-use image on top, `takes\`); images dropped into a card folder from Explorer are picked up as new images; a new folder becomes a card
- [x] The chat reads every card's look, copies it into CAST and IMAGE, and can propose `update_ref` (save a look, or make a card); Apply / Undo
- [x] Suggested cards from the script (not real until Add)
- [ ] Joe: make the Grim cast's cards from his art, write their looks, rerun the script prompt and see if the cast stops drifting

## Step 7 — Sound tab
- [ ] Timeline under the shots: Dialogue, Ambience, Effects, Music lanes
- [ ] Works on stills first (animatic), so timing is locked before video; shot length follows its sound
- [ ] Voices and lip-sync; ambience/effects/music generation; model pick per job in Settings
- [ ] Mixer row per lane, Play the whole cut, Export MP4 into the episode folder

## Step 8 — Batch and polish
- [ ] Multi-select generate; keyboard shortcuts; interactive choices back on (engine parked, not removed)

## Log
- 2026-11-13 — Joe's UI rules, applied app-wide: no boxes he has to resize (text boxes fit their text) and no visible scrollbars. Details panels in Shots, Reference and Script resize by dragging their left edge like the chat (double-click resets, remembered per tab, the main area keeps 280px). Reference cards in tabs (Character, Images, Voice); his own art is references-only.
- 2026-11-13 — Looks written once: IMAGE prompts say MOTHER (caps) and GASP swaps in the look from the Reference card, or the episode's CAST line if there's no card (whole look on first mention, "the woman" after; MOTION gets just "the woman"). "What gets sent" under the image prompt; Copy prompt sends the swapped text; caps names also attach the character's references. Chat, guide, example and Check format teach caps names. Reference: stronger full-body framing, + Turnaround (16:9 four-view sheet), reference chips in Generate (switch each off) and "+ Your own image" (added to the card as "my art N"), the Generate panel stays open after a run.
- 2026-11-13 — Reference from Joe's first look: suggested cards from the story's scripts (WHO names and speakers, CAST entries with their looks, SHOT-line locations; Add, Add all, or ✕ to hide); the Generate panel shows the prompt as STYLE + Look + framing with "What gets sent", opens by itself on an empty image, saves the framing per image, and can remove the background right after (on by default for characters and props); Generate is pink. Shots: amber warning when a shot's characters or place have no reference images.
- 2026-11-13 — Joe's quality-of-life list (Google Doc "GASP 2"): chat attachments and links, resizable chat with a growing message box and a connection status line; Script tab: STORY/EPISODE header kept by GASP, "Episode 1" tabs (double-click to rename; title box removed), text size A−/A+, side panel can hide (Update Shots moves to the toolbar), "Sync to Shots" renamed "Update Shots" with a line saying what it would change, "Copy Script for Claude", editor fills the width with no scroll bar, example page shows STORY/EPISODE/FORMAT/STYLE and hides itself when there's no room.
- 2026-11-13 — Steps 5 and 6 built and dry-run tested together (cards from files, generate face from full body, background removal, keyframes x2 with Mother + Farm Yard references matched from the script, "Mom" alias, previous-shot reference, chat card saving a look then undone, name completion from cards).
- 2026-11-13 — Joe's second script (new method): brief, consistent cast, light arc, safe strikes, all shots 5s+ (~$7 of Kling vs $50). Fixed what it exposed: invented `[[#1]]` tags are dropped (only GASP's real link is kept), a `---` or REFERENCE IMAGES section after the last shot no longer joins that shot, the chat is told not to write either, and the "IMAGE names X" check ignores role words used as description ("a small child").
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
