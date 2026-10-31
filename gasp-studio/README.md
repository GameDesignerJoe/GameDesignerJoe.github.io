# GASP Studio

**G**ameplay · **A**nimatic · **S**cript · **P**roduction. The local half of Gate Ten: turns a production manifest into a voiced, captioned animatic, with SlapCut (the cutout compositor) for free stills and fal.ai for generated ones.

## Updating
`git pull` in this folder. Your `.env` and `work/` are ignored by git and survive updates.

A local, stills-first production pipeline for the JSON that Gate Ten exports
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
