# Art Style Compass v2

Interactive AI art-direction tool for game pitch decks. Phase 1 build (foundation):
the full 10-step wizard ported from the prototype, plus a working `/api/generate`
route backed by fal.ai. Image previews, the quadrant map, convergence, and NL
refinement land in later phases.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Zustand for wizard state (persisted to `localStorage` under `art-style-compass-v2`)
- `@fal-ai/client` for image generation
- `@anthropic-ai/sdk` installed for Phase 5 (NL refinement) — not exercised yet

## Setup

```bash
cd artdirector
npm install
cp .env.local.example .env.local
# fill in FAL_KEY (required for /api/generate) and ANTHROPIC_API_KEY (Phase 5)
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/wizard/1`.

## What works in Phase 1

- All 10 wizard steps render, save state to localStorage, and round-trip across navigation
- Step 1 → 10 → "Generate prompts" lands on `/output` with the same prompt set the prototype produced
- Conditional behavior matches the prototype:
  - First-person camera swaps the character step for a hands-study field and changes the key-art / action-beat prompts
  - "No enemies" hides the enemy-description field and changes the action-beat prompt
  - "No weapons" changes the hands study and action beat
  - Reference chips are filtered by selected DNA and grouped by production scope
- The art-direction sidebar updates live as choices are made
- `POST /api/generate` accepts `{ prompt, ratio, quality }` and returns `{ imageUrl }`. Test it with curl once `FAL_KEY` is set

## What works in Phase 2

- Live image previews via fal.ai, gated behind an explicit **Generate preview** button (no automatic debounced fires — keeps the bill predictable)
- Right-side panel on `lg+` viewports, collapses to an above-form card on smaller screens
- In-memory cache keyed by `(ratio, prompt)` — navigating between steps doesn't re-bill identical prompts. Cache is per-session (clears on reload)
- Per-step preview prompts in [lib/previewPrompts.ts](lib/previewPrompts.ts):
  - **Step 3 (DNA)**: atmospheric environment in the chosen DNA — 16:9
  - **Step 4 (Visual Rules)**: material / surface study — 1:1
  - **Step 6 (Environments)**: the primary environment description — 16:9
  - **Step 7 (Characters)**: character portrait or first-person hands study — 2:3 / 1:1
  - **Step 8 (Enemies)**: enemy figure study — 1:1 (hidden when "No enemies")
  - **Step 9 (Props)**: prop study — 1:1
- "View prompt" disclosure under each preview shows the exact text being sent to fal.ai
- Error state surfaces fal.ai errors inline; loading shows a skeleton at the correct aspect ratio

## What's NOT wired up yet (deferred to later phases)

- Quadrant map step (Phase 3)
- Binary convergence A/B flow (Phase 4)
- Natural-language refinement bar (Phase 5)
- Output-page "Generate all" + per-card regeneration (Phase 6)

## Project layout

```
artdirector/
  app/
    layout.tsx                root layout
    page.tsx                  redirects to /wizard/1
    globals.css               CSS variables + theme + utility classes
    wizard/
      layout.tsx              wizard shell (sidebar + main + preview panel)
      [step]/page.tsx         dynamic step renderer
    output/
      page.tsx                output page
    api/generate/route.ts     POST -> fal.ai
  components/
    HydrationGate.tsx         defers persisted-store reads until after mount
    wizard/                   shared wizard UI + 10 step components
    preview/                  PreviewPanel + PreviewImage + PreviewSkeleton
    output/                   ArtBible + PromptCard
  hooks/
    useImageGen.ts            calls /api/generate, manages loading/error/cache
  lib/
    dnaData.ts                DNA spectrum, GAMES_BY_DNA, coherence notes
    wizardData.ts             option cards for every step
    promptBuilder.ts          buildPrompts(state) — ported from prototype JS
    previewPrompts.ts         buildPreviewPrompt(step, state) for the panel
    imageCache.ts             in-memory cache, keyed by (ratio, prompt)
    imageGen.ts               fal.ai wrapper (server-side)
  store/wizardStore.ts        Zustand store + derived helpers (isFP, noEnemies, …)
  types/index.ts              shared types
  reference/                  original HTML prototype + spec (untouched)
```

## Testing the API route

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"atmospheric sci-fi corridor concept art","ratio":"landscape_16_9","quality":"fast"}'
```

## Resetting the wizard

State is persisted to `localStorage`. Clear via:

- "Start over" button on the output page
- DevTools → Application → Local Storage → delete `art-style-compass-v2`

## Notes for the next phase

The store schema already carries `quadrantPosition`, `generatedImages`, and
`styleConfirmed` so Phase 2/3 don't need a migration. `RATIO_MAP` in
`lib/promptBuilder.ts` is the canonical shot-type → image-ratio mapping for the
Phase 6 "Generate all" pass.
