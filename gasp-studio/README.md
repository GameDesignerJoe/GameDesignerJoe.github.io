# GASP Studio

**G**ameplay · **A**nimatic · **S**cript · **P**roduction. Turns a production manifest into a voiced, captioned animatic, with SlapCut (the cutout compositor) for free stills and fal.ai for generated ones.

## One app
Run `Create desktop shortcut.bat` once: it puts a **GASP Studio** icon on your Desktop. That icon starts the server silently and opens GASP in its own app window (no browser chrome, its own taskbar icon); closing the window stops the server. Updates are pulled on every launch. `GASP.bat` still works if you want the plain version with a visible log.

Double-click `GASP.bat` (or run `node studio.js serve`). It opens http://localhost:4747: the writing tabs (Premise, Season, Gameplay, episodes) with a **Render** tab in the same page.

- Stories are saved as files in `stories/` on this machine (git-ignored). To bring a story over from the claude.ai version: there, Import / backup → *Save all stories as file*; here, Import / backup → *Load file*.
- Claude features in the writing tabs need `ANTHROPIC_API_KEY` in `.env`, next to the fal and ElevenLabs keys.
- **Export → Send to Render** hands the current story to the Render tab; no files to move. Exports you save land in `exports/`.
- Episode tabs are a vertical flow editor: shot cards with their lines, choices fanning into branch lanes. Select a card to edit it and render just that shot (Composite / Still / Voice / Motion / Preview) in the side panel.
- Play tab: the interactive player over the rendered segments — choices branch, gems and flags are tracked.
- Make assets in the app: Generate portrait, Generate plate, cutouts with background removal, a 12-expression facial library per character; Auto-cast missing voices.
- Shot cards have a Simple mode (who, where, what happens, lines, emotion) and Advanced (framing, weather, render plan, audio, costume, prompts). New shots inherit from the one above.
- Cast → Browse: pick ElevenLabs voices (yours and the public library) with previews.
- The header shows what the story has spent so far, with links to top up.
- Render tab: pick episode and scope (whole episode, a block range, or one shot), a path through the choices, tick the steps, press Render. The log streams in, the cut plays in the page; click a shot to pick a take, play its clips, or re-render just that shot.

## Updating
`git pull` in this folder. Your `.env` and `work/` are ignored by git and survive updates.

A local, stills-first production pipeline for the JSON that the app exports
(Export → Production manifest JSON). It runs on your machine with your own
provider keys. Nothing here talks to Claude.

What it does today:

1. **plan**   – reads a manifest, prints the shot list, render plan and an estimated cost.
2. **stills** – generates one still per shot (fal.ai image model, with the
   character / location / item reference images attached), several takes if you ask,
   into `work/<story>/ep<N>/shot-<i>/`.
3. **vo**     – generates one audio clip per dialogue line with the character's
   voice (ElevenLabs, or fal MiniMax speech) and measures its real duration.
4. **animatic** – assembles the approved stills, the VO, captions, ambience and
   music into `ep<N>-animatic.mp4` (9:16, 1080×1920) with ffmpeg. Stills get a
   slow push by default. Interaction blocks become title cards.
5. **animate** (optional, later) – sends approved stills to an image-to-video
   model for the shots whose render plan says `animate` or `lipsync`, then the
   animatic step uses the clips instead of the stills.

Approve at the still. Animate only what earns it.

## Setup

```
cd studio
npm install            # no dependencies; this just registers the bin
cp .env.example .env   # add your keys
node studio.js plan   path/to/Story-production.json
node studio.js stills path/to/Story-production.json --ep 1 --takes 2
# look at work/<story>/ep1/shot-*/take-*.png, then pick:
node studio.js approve path/to/Story-production.json --ep 1 --shot 3 --take 2
node studio.js vo      path/to/Story-production.json --ep 1
node studio.js animatic path/to/Story-production.json --ep 1
```

`ffmpeg` must be on your PATH.

## Providers

Endpoints and prices live in `providers/registry.json`; edit them as models
change. The defaults point at fal.ai queue endpoints and ElevenLabs. If you
set `STUDIO_DRY_RUN=1`, every provider call is replaced by a placeholder
(gray card with the shot text, a silent audio clip of the right length), so
you can test the whole pipeline for free.

## Output

```
work/<story>/
  ep1/
    shot-01/ take-1.png take-2.png approved.png (copy) prompt.txt
    line-02.mp3  (VO, named by block index)
    ep1-animatic.mp4
    ep1-cost.json
```

## Compositing knobs
- `STUDIO_FIGURE_SCALE=0.9` — shrink (or grow) every composited figure by that factor. Default 1.
- `STUDIO_EDGE=2` — erode the cutout matte by N pixels and feather it, to kill white fringe in hair. 0 disables. Default 2.
- Figures are pinned to the bottom of the frame; ECU/CU/MCU/OTS use the chest-up cutout when one exists, MS and two-shots use full body.

## Timing
- `STUDIO_LEAD=0.6` — seconds of picture before a shot's first line. The remainder of the shot's action beat plays after the last line. Set to a large number to restore "whole beat first, then dialogue".
