# Art Style Compass — Claude Code Build Spec
## Version 2.0: AI-Driven Interactive Style Discovery

**Status:** Claude Code project brief  
**Prototype:** `art-style-compass.html` (included — read it as the UX foundation, not the codebase)  
**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + fal.ai + Anthropic API  
**Deploy:** Vercel  

---

## What This Is

The HTML prototype is a 10-step form wizard that collects art direction choices and outputs AI image generation prompts. It works. But it's static — the user makes choices blindly and sees output only at the end.

This Claude Code project transforms it into an **interactive style discovery tool** where:
- Every meaningful choice triggers a live image preview
- A 2D quadrant map shows where the user's style sits in the space of all possible looks
- A binary convergence flow (Midjourney-style A/B picking) helps users who don't know what they want
- Natural language feedback ("too realistic," "more gritty," "painterly but darker") actively adjusts and regenerates
- The end output is the same pitch-deck prompt set — but the user arrives there having *seen* their style rather than described it

The core insight: **most people can't describe what they want, but everyone can say which of two options is closer.**

---

## Tech Stack Decisions

### Framework: Next.js 14 App Router
- App Router for nested layouts (wizard state persists across steps)
- Server Actions for API calls (no extra API route boilerplate for simple calls)
- Route handlers (`/api/...`) for streaming image generation responses

### Image Generation: fal.ai
**Why fal.ai over alternatives:**
- FLUX.1 [schnell] — 2–4s per image, cheap (~$0.003/image), good quality for iteration
- FLUX.1 [dev] — higher quality for final prompt generation confirmation images
- Simple REST API, works perfectly from Vercel Edge/Node functions
- No cold starts, reliable uptime
- `@fal-ai/client` npm package handles streaming and polling cleanly

Install: `npm install @fal-ai/client`  
Env var: `FAL_KEY`

```typescript
// lib/imageGen.ts
import { fal } from "@fal-ai/client";

export async function generateImage(prompt: string, quality: 'fast' | 'quality' = 'fast') {
  const model = quality === 'fast' 
    ? 'fal-ai/flux/schnell'
    : 'fal-ai/flux/dev';
  
  const result = await fal.subscribe(model, {
    input: {
      prompt,
      image_size: 'landscape_16_9',  // for envs
      num_inference_steps: quality === 'fast' ? 4 : 28,
    }
  });
  
  return result.data.images[0].url;
}

// Aspect ratio options: landscape_16_9, square_hd, portrait_4_3
// Map these to shot types:
const RATIO_MAP = {
  keyArt: 'portrait_4_3',
  environment: 'landscape_16_9',
  character: 'portrait_4_3',
  handsStudy: 'square_hd',
  enemyStudy: 'square_hd',
  propStudy: 'square_hd',
  actionBeat: 'landscape_16_9',
  titleLogo: 'landscape_16_9',  // crop to 4:1 in CSS
  uiMockup: 'landscape_16_9',
};
```

### AI Backbone: Anthropic Claude claude-sonnet-4-20250514
Two roles:
1. **Prompt builder** — takes wizard state → generates optimized image gen prompts (already handled in prototype JS, port to TypeScript)
2. **Feedback interpreter** — takes natural language feedback + current style state → returns updated style parameters + new prompt

```typescript
// lib/styleInterpreter.ts
// Claude interprets NL feedback and returns structured style adjustments
export async function interpretFeedback(
  feedback: string,
  currentStyle: StyleState,
  currentPrompt: string
): Promise<StyleAdjustment> {
  // Returns: { adjustments: {...}, newPrompt: string, explanation: string }
}
```

### State Management: Zustand
- Single wizard store (simpler than Redux, works with Next.js)
- Persisted to localStorage so users can resume
- `npm install zustand`

### Styling: Tailwind CSS + CSS custom properties
- The dark theme from the prototype uses CSS vars — keep them, map to Tailwind config
- shadcn/ui for dialog, slider, and any complex UI components

---

## Core Features (Build in This Order)

### Feature 1: Project Scaffold + State Port

Port the wizard state from the HTML prototype to a Zustand store.

```typescript
// store/wizardStore.ts
interface WizardState {
  // Identity
  gameTitle: string;
  genre: string;
  platform: string;
  cameraType: string;
  dimension: string;
  scope: string;
  
  // Tone
  tone: string;
  worldFeel: string;
  pacing: string;
  
  // DNA
  dna: string;
  dnaName: string;
  
  // Visual rules
  shapeLanguage: string;
  colorMood: string;
  lighting: string;
  detailDensity: string;
  
  // References
  referenceGames: string[];
  nonGame: string;
  antiRef: string;
  
  // Environments
  setting: string;
  archStyle: string;
  envDesc1: string;
  envDesc2: string;
  envDesc3: string;
  
  // Characters
  bodyProp: string;
  costumeComp: string;
  charDesc: string;
  handsDesc: string;
  
  // Enemies
  enemyNature: string;
  enemyDesc: string;
  
  // Equipment
  equipAesthetic: string;
  singleProp: string;
  
  // Title & UI
  fontStyle: string;
  uiStyle: string;
  uiDesc: string;
  
  // EXTENDED STATE (new in v2)
  quadrantPosition: { x: number; y: number }; // 0-100 on each axis
  convergenceHistory: ConvergenceRound[];
  generatedImages: Record<string, string>; // shotType → imageUrl
  styleConfirmed: boolean;
}
```

**Quadrant axes defined:**
- **X axis:** Abstract/Stylized (0) → Photorealistic (100)  
  Maps to: DNA spectrum position (Minimalist=0, Cinematic Realism=100)
- **Y axis:** Dark/Grim (0) → Bright/Vibrant (100)  
  Maps to: tone × colorMood combination

These two axes create four natural quadrant personalities:
- **Top-left (Bright + Abstract):** Journey, Gris, Cuphead, Monument Valley
- **Top-right (Bright + Realistic):** Outer Wilds, Kena, Ghost of Tsushima, Hi-Fi Rush
- **Bottom-left (Dark + Abstract):** Limbo, Inside, Transistor, Hades
- **Bottom-right (Dark + Realistic):** TLOU, God of War, Hellblade, Soma, Returnal

Plot these games as labeled dots on the quadrant. When user hovers, show a thumbnail.

---

### Feature 2: Live Image Preview Per Step

Every meaningful wizard step should trigger a background image generation showing the user what their choices look like.

**Implementation approach:**

```typescript
// hooks/useStepPreview.ts
// After each significant choice, fire a background generation
// Show a loading state, then fade in the result

export function useStepPreview(step: number, state: WizardState) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  useEffect(() => {
    if (!shouldPreviewStep(step, state)) return;
    
    const previewPrompt = buildStepPreviewPrompt(step, state);
    if (!previewPrompt) return;
    
    setIsGenerating(true);
    generateImage(previewPrompt, 'fast')
      .then(url => { setPreviewUrl(url); setIsGenerating(false); })
      .catch(() => setIsGenerating(false));
      
  }, [getStepTriggerKey(step, state)]); // Only regenerate when relevant values change
  
  return { previewUrl, isGenerating };
}
```

**Step preview triggers (what fires a generation):**

| Step | Trigger | Preview shows | Ratio |
|------|---------|---------------|-------|
| 3 — DNA | DNA selected | Atmospheric environment in that style | 16:9 |
| 4 — Visual Rules | Any rule card selected | Abstract texture/material in that style | 1:1 |
| 6 — Environments | envDesc1 typed (debounced 1.5s) | The described environment | 16:9 |
| 7 — Characters | charDesc typed (debounced 1.5s) | Character portrait | 2:3 |
| 8 — Enemies | enemyNature selected | Enemy type in that style | 1:1 |
| 9 — Props | singleProp typed (debounced 1.5s) | The described prop | 1:1 |

**DNA step preview prompt template:**
```typescript
function buildDNAPreviewPrompt(state: WizardState): string {
  return `${state.dna}, atmospheric game environment, moody lighting, no characters, 
    establishing wide shot, professional game concept art, ${state.colorMood || 'rich color palette'},
    no text, no watermark`;
}
```

**Layout:** Preview image appears in a persistent right-side panel (on desktop) or above the form (on mobile). Panel stays visible across steps. Previous step's image fades to 40% opacity while new one generates.

---

### Feature 3: The Style Quadrant Map

This is the visual centerpiece. It should be its own dedicated step — probably between DNA (Step 3) and Visual Rules (Step 4).

```typescript
// components/QuadrantMap.tsx
// A 400×400 (or full-width) interactive SVG/canvas
// X axis: Abstract → Realistic
// Y axis: Dark → Bright
// Content:
//   - Background gradient showing the quadrant zones
//   - Game reference dots (labeled, hoverable for thumbnail)
//   - User's current position (draggable)
//   - "Zone" label overlays (top-left corner = Journey Zone, etc.)
```

**The quadrant should:**

1. **Show game references as labeled dots**, positioned at their actual coordinates:
   ```typescript
   const GAME_POSITIONS: Record<string, [number, number]> = {
     // [x: abstract→realistic, y: dark→bright]
     'Journey':       [20, 75],
     'Gris':          [15, 70],
     'Limbo':         [25, 15],
     'Inside':        [30, 20],
     'Transistor':    [35, 45],
     'Hollow Knight': [40, 30],
     'Hades':         [45, 55],
     'Cuphead':       [30, 80],
     'Ori: Blind Forest': [35, 85],
     'Dead Cells':    [50, 35],
     'Disco Elysium': [55, 45],
     'Firewatch':     [65, 65],
     'Outer Wilds':   [70, 75],
     'Stray':         [75, 60],
     'Hi-Fi Rush':    [60, 82],
     'Kena':          [72, 78],
     'Dishonored 2':  [68, 45],
     'Hellblade':     [80, 20],
     'A Plague Tale': [75, 30],
     'God of War':    [85, 40],
     'Ghost of Tsushima': [88, 72],
     'The Last of Us II': [90, 25],
     'Returnal':      [82, 35],
   };
   ```

2. **Auto-position the user's dot** based on their DNA + tone choices. When user picks "Cinematic Realism" + "Dark/Gritty", the dot moves toward bottom-right.

3. **Be draggable** — user can override the auto-position by dragging their dot. Dragging updates the underlying style parameters and triggers regeneration.

4. **On hover over any game dot**, show a floating card with:
   - Game name
   - Scope tier badge (Indie/Mid/AAA)  
   - A small thumbnail (either a pre-cached screenshot URL or an AI-generated style reference)

5. **Zone overlay labels** (subtle, in corners):
   - Top-left: "Dreamlike / Whimsical"
   - Top-right: "Vibrant Realism"
   - Bottom-left: "Stark / Geometric"
   - Bottom-right: "Gritty Realism"

**Mapping user choices to quadrant position:**
```typescript
function calculateQuadrantPosition(state: WizardState): { x: number; y: number } {
  // X axis: Abstract → Realistic (maps to DNA index)
  const dnaIndex = DNA_SPECTRUM.findIndex(d => d.name === state.dnaName);
  const x = dnaIndex >= 0 ? (dnaIndex / 4) * 100 : 50;
  
  // Y axis: Dark → Bright (maps to tone + color)
  const darkTones = ['dark gritty', 'tense and urgent', 'eerie mysterious'];
  const brightTones = ['hopeful and bright', 'stylish confident', 'epic and grand'];
  const isDark = darkTones.some(t => state.tone.includes(t.split(' ')[0]));
  const isBright = brightTones.some(t => state.tone.includes(t.split(' ')[0]));
  const darkColors = ['dark moody', 'muted subtle'];
  const brightColors = ['bold vibrant', 'natural earthy', 'neon electric'];
  const isColorDark = darkColors.some(c => state.colorMood.includes(c.split(' ')[0]));
  const isColorBright = brightColors.some(c => state.colorMood.includes(c.split(' ')[0]));
  
  const toneScore = isDark ? 25 : isBright ? 75 : 50;
  const colorScore = isColorDark ? 25 : isColorBright ? 75 : 50;
  const y = (toneScore + colorScore) / 2;
  
  return { x, y };
}
```

---

### Feature 4: Binary Convergence Flow (Style Finder Mode)

An alternative entry path for users who don't know what they want. Accessible as **"I don't know yet — help me find it"** from the DNA step.

**Algorithm: Binary Search Through Style Space**

```
Round 1: Generate 2 images at opposite quadrant positions (e.g., [20,80] vs [80,20])
User picks A or B ("closer to what I want")
→ Eliminate the unchosen half of the quadrant

Round 2: Generate 2 images within the surviving half, spaced apart
User picks A or B
→ Narrow further

Round 3-4: Continue narrowing. By round 4, position is within ~12.5% of total space.

Round 5 (optional): Present final position, allow manual fine-tuning on quadrant
```

```typescript
// lib/convergence.ts

interface ConvergenceState {
  round: number;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  history: Array<{
    optionA: { position: [number, number]; imageUrl: string; prompt: string };
    optionB: { position: [number, number]; imageUrl: string; prompt: string };
    chosen: 'A' | 'B';
  }>;
}

function getNextCandidates(bounds: ConvergenceBounds): [[number,number], [number,number]] {
  // Generate two positions at 1/3 and 2/3 points within current bounds
  // This gives maximum discrimination per pick
  const xRange = bounds.xMax - bounds.xMin;
  const yRange = bounds.yMax - bounds.yMin;
  
  const posA: [number, number] = [
    bounds.xMin + xRange * 0.33,
    bounds.yMin + yRange * 0.33,
  ];
  const posB: [number, number] = [
    bounds.xMin + xRange * 0.67,
    bounds.yMin + yRange * 0.67,
  ];
  
  return [posA, posB];
}

function updateBounds(
  current: ConvergenceBounds,
  chosen: 'A' | 'B',
  posA: [number, number],
  posB: [number, number]
): ConvergenceBounds {
  // Chosen position becomes the new center; recalculate bounds
  const winner = chosen === 'A' ? posA : posB;
  const xRadius = (current.xMax - current.xMin) * 0.4;
  const yRadius = (current.yMax - current.yMin) * 0.4;
  
  return {
    xMin: Math.max(0, winner[0] - xRadius),
    xMax: Math.min(100, winner[0] + xRadius),
    yMin: Math.max(0, winner[1] - yRadius),
    yMax: Math.min(100, winner[1] + yRadius),
  };
}
```

**UI for convergence rounds:**

```
┌─────────────────────────────────────────────────────┐
│  Finding your style · Round 2 of 4                  │
│  ████████░░░░░░░░░░░░  narrowing...                 │
│                                                     │
│  Which is closer to what you want?                  │
│                                                     │
│  ┌──────────────┐    ┌──────────────┐              │
│  │              │    │              │              │
│  │   [IMAGE A]  │    │   [IMAGE B]  │              │
│  │              │    │              │              │
│  └──────────────┘    └──────────────┘              │
│                                                     │
│  [ This one — A ]      [ This one — B ]             │
│                                                     │
│  [ Neither feels right — show different options ]   │
│  [ Skip this — I'll describe it myself ]            │
└─────────────────────────────────────────────────────┘
```

Both images generate in parallel. Show loading skeletons until both arrive. Disable selection until both are loaded.

**Convergence prompt building:**
```typescript
function buildConvergencePrompt(position: [number, number], baseContext: WizardState): string {
  const [x, y] = position;
  
  // X maps to rendering style
  const renderStyle = x < 33 
    ? 'minimalist geometric flat design, abstract shapes, silhouette-driven'
    : x < 66
    ? 'stylized painterly game art, expressive brushstroke quality, concept art aesthetic'
    : 'photorealistic game art, physically-based rendering, cinematic realism, film quality';
  
  // Y maps to atmosphere
  const atmosphere = y < 33
    ? 'dark gritty moody, desaturated palette, heavy shadows, oppressive atmosphere'
    : y < 66
    ? 'balanced atmospheric tone, moderate saturation, dramatic lighting'
    : 'bright vibrant hopeful, saturated warm colors, uplifting atmosphere';
  
  // Base context from whatever wizard data exists
  const settingHint = baseContext.setting 
    ? `${baseContext.setting} game world` 
    : 'fantasy game world';
  
  return `game concept art environment, ${renderStyle}, ${atmosphere}, ${settingHint}, 
    wide establishing shot, no characters, no text, no watermark, game art style`;
}
```

---

### Feature 5: Natural Language Style Refinement

After any image generation, a refinement bar appears below the image.

**UI:**
```
[Generated image]

How does this feel?
┌────────────────────────────────────┐  ┌────────────┐
│ Like this, but more gritty...      │  │ Regenerate │
└────────────────────────────────────┘  └────────────┘

Quick tweaks:  [More gritty]  [More vibrant]  [More abstract]  
               [Darker]  [Brighter]  [More painterly]  [More realistic]
```

Quick tweak buttons are pre-built adjustments. The text field handles anything.

**The interpretation call:**
```typescript
// lib/styleInterpreter.ts

const STYLE_INTERPRETER_SYSTEM = `You are an art direction assistant for a game pitch deck tool.
The user has just seen a generated image and wants to adjust the style.
Given their feedback, return a JSON object with:
{
  "quadrantDelta": { "x": number, "y": number },  // how to move on the quadrant (-20 to +20)
  "promptModifications": {
    "add": ["phrase to add"],
    "remove": ["phrase to remove or tone down"]
  },
  "dnaShift": string | null,  // null or a new DNA name if feedback implies a shift
  "explanation": string  // one sentence explaining the adjustment
}

The quadrant axes are:
- X: 0=Minimalist/Abstract → 100=Cinematic/Photorealistic  
- Y: 0=Dark/Grim → 100=Bright/Vibrant

Common feedback mappings:
- "more gritty / darker / bleaker" → Y decreases
- "more vibrant / brighter / colorful" → Y increases  
- "more abstract / less realistic / too real" → X decreases
- "more realistic / more detail / photo-real" → X increases
- "more painterly / brushstroke" → X moves toward 30-50, add painterly terms
- "more stylized / cartoony / cel-shaded" → X decreases, DNA shifts to Graphic/Cel
- "flatter / more graphic / more like a comic" → X moves to 40-60, add cel-shaded terms
- "more hand-drawn / illustrated" → DNA shifts to Hand-Drawn
- "simpler / cleaner / less detail" → add sparse/minimal terms
- "richer / more detailed / busier" → add dense/layered terms`;

export async function interpretStyleFeedback(
  feedback: string,
  currentState: StyleState,
  currentPrompt: string
): Promise<StyleAdjustment> {
  const userMsg = `Current style state:
- DNA: ${currentState.dnaName}
- Quadrant position: X=${currentState.quadrantPosition.x}, Y=${currentState.quadrantPosition.y}
- Current prompt: ${currentPrompt}

User feedback: "${feedback}"

Return the JSON adjustment object.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: STYLE_INTERPRETER_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
```

**After interpretation:**
1. Apply `quadrantDelta` to current position (clamp 0-100)
2. Apply `promptModifications` to the current prompt
3. If `dnaShift` is not null, update DNA
4. Regenerate the image with the modified prompt
5. Show `explanation` as a small label: "Moving toward more painterly, brushstroke quality"

---

### Feature 6: Output Page (Same as Prototype, Enhanced)

Same 7-10 prompts as the prototype. Additions:
- **Generate all** button — fires all image generations in parallel, populates each prompt card with its result
- **Regenerate individual** button per card
- **Refinement bar** per card (same NL interface)
- **Export options:** 
  - Copy all prompts as a single text doc
  - Download all generated images as a ZIP
  - (Stretch) Export to a basic PPTX template with images and prompt text

---

## File Structure

```
art-style-compass-v2/
├── app/
│   ├── layout.tsx               # Root layout with sidebar
│   ├── page.tsx                 # Wizard entry (redirects to /wizard/1)
│   ├── wizard/
│   │   ├── layout.tsx           # Wizard shell: sidebar + progress + nav bar
│   │   ├── [step]/
│   │   │   └── page.tsx         # Dynamic step rendering
│   ├── output/
│   │   └── page.tsx             # Results page
│   ├── api/
│   │   ├── generate/
│   │   │   └── route.ts         # POST: { prompt, ratio } → { imageUrl }
│   │   ├── interpret-feedback/
│   │   │   └── route.ts         # POST: { feedback, state, prompt } → StyleAdjustment
│   │   └── build-prompts/
│   │       └── route.ts         # POST: { state } → { prompts[] }
├── components/
│   ├── wizard/
│   │   ├── StepWrapper.tsx      # Step chrome: number, title, subtitle
│   │   ├── CardGrid.tsx         # Reusable option card grid
│   │   ├── SpectrumSelector.tsx # DNA spectrum component
│   │   ├── GameChips.tsx        # Reference game chips (DNA-filtered)
│   │   ├── EnvBlock.tsx         # Numbered environment text area
│   │   └── steps/               # One file per step
│   │       ├── Step1Identity.tsx
│   │       ├── Step2Tone.tsx
│   │       ├── Step3DNA.tsx
│   │       ├── Step3bQuadrant.tsx   # NEW: quadrant map step
│   │       ├── Step4Rules.tsx
│   │       ├── Step5References.tsx
│   │       ├── Step6Environments.tsx
│   │       ├── Step7Characters.tsx
│   │       ├── Step8Enemies.tsx
│   │       ├── Step9Props.tsx
│   │       └── Step10TitleUI.tsx
│   ├── quadrant/
│   │   ├── QuadrantMap.tsx      # Main 2D map component
│   │   ├── GameDot.tsx          # Individual game reference dot
│   │   └── UserDot.tsx          # Draggable user position dot
│   ├── convergence/
│   │   ├── ConvergenceFlow.tsx  # Full A/B flow shell
│   │   ├── ConvergenceRound.tsx # Single round UI
│   │   └── ImageChoice.tsx      # One side of the A/B pair
│   ├── refinement/
│   │   ├── RefinementBar.tsx    # NL feedback input + quick buttons
│   │   └── QuickTweaks.tsx      # Pre-built adjustment chips
│   ├── preview/
│   │   ├── PreviewPanel.tsx     # Right-side live preview container
│   │   ├── PreviewImage.tsx     # Single image with loading state
│   │   └── PreviewSkeleton.tsx  # Loading placeholder
│   └── output/
│       ├── PromptCard.tsx       # Individual prompt with generate + refine
│       ├── ArtBible.tsx         # Summary card at top of output
│       └── ExportActions.tsx    # Copy/download/export buttons
├── lib/
│   ├── imageGen.ts              # fal.ai wrapper
│   ├── promptBuilder.ts         # Wizard state → image prompts (ported from prototype)
│   ├── styleInterpreter.ts      # NL feedback → style adjustments via Claude
│   ├── convergence.ts           # Binary search algorithm
│   ├── quadrantUtils.ts         # Position calculations, game coordinates
│   └── dnaData.ts               # DNA spectrum, game references, coherence notes
├── store/
│   └── wizardStore.ts           # Zustand store
├── types/
│   └── index.ts                 # WizardState, StyleAdjustment, ConvergenceState, etc.
├── public/
│   └── game-thumbnails/         # Pre-cached game reference thumbnails (optional)
└── .env.local
    # FAL_KEY=...
    # ANTHROPIC_API_KEY=...
```

---

## API Routes

### POST `/api/generate`
```typescript
// Request
{ prompt: string; ratio: 'landscape_16_9' | 'square_hd' | 'portrait_4_3'; quality?: 'fast' | 'quality' }

// Response
{ imageUrl: string; }

// Notes:
// - Rate limit: 10 req/min per IP (use upstash/ratelimit if deploying publicly)
// - Cache: generated image URLs in Redis/KV for 24h keyed by prompt hash
// - Error handling: on fal.ai failure, return { error: string, fallback: null }
```

### POST `/api/interpret-feedback`
```typescript
// Request
{ feedback: string; state: StyleState; currentPrompt: string; }

// Response
{ quadrantDelta: {x: number, y: number}; promptModifications: {...}; dnaShift: string | null; explanation: string; }
```

### POST `/api/build-prompts`
```typescript
// Request
{ state: WizardState; }

// Response
{ prompts: Array<{ id: string; name: string; description: string; prompt: string; ratio: string; badge: string; }> }
```

---

## UX Flow (User Journey)

### Path A: Guided Discovery (knows what they want)
```
Step 1: Identity (genre, camera, scope, dimension)
Step 2: Tone
Step 3: DNA Spectrum → LIVE PREVIEW fires
Step 3b: Quadrant Map (auto-positioned, can drag)
Step 4: Visual Rules → LIVE PREVIEW updates with each selection
Step 5: References (DNA-filtered)
Step 6: Environments → LIVE PREVIEW per env description
Step 7: Characters → LIVE PREVIEW
Step 8: Enemies
Step 9: Props
Step 10: Title & UI
→ Output: 7-10 prompts, generate all, refine each
```

### Path B: Style Finder (doesn't know what they want)
```
Step 1: Identity (minimal — just genre and maybe tone)
→ [I don't know what look I want — help me find it]
Convergence Flow: 4-5 rounds of A/B image picking
→ Quadrant Map: shows landing position, allow drag fine-tuning
→ NL Refinement: show current image, allow feedback, regenerate
→ [Lock in this style]
→ Continue with remaining wizard steps (environments, characters, etc.)
→ Output: 7-10 prompts pre-populated with confirmed style
```

### Path C: Quick Mode (power user, skips to output)
```
[Not yet required — possible future feature]
Fill all steps fast, go straight to output and generate all images
```

---

## Implementation Priority Order

Build in this sequence. Each phase should be shippable/testable independently.

### Phase 1: Foundation (1-2 sessions)
- [ ] Next.js project scaffold with TypeScript + Tailwind
- [ ] Port wizard state to Zustand store
- [ ] Port all 10 step components from HTML prototype
- [ ] Port `promptBuilder.ts` from prototype JS
- [ ] Basic navigation (prev/next, progress bar)
- [ ] `/api/generate` route working with fal.ai
- [ ] Output page with prompt cards (no image generation yet)
- **Test:** Can complete the full wizard and see prompt output

### Phase 2: Live Previews (1 session)
- [ ] `useStepPreview` hook
- [ ] `PreviewPanel` component (right sidebar on desktop)
- [ ] Wire up DNA step → preview
- [ ] Wire up environment description → preview (debounced)
- [ ] Wire up character description → preview
- **Test:** Changing DNA fires a generation and shows result

### Phase 3: Quadrant Map (1 session)
- [ ] `QuadrantMap` SVG component
- [ ] Game reference dots with positions
- [ ] Auto-position calculation from wizard state
- [ ] User dot (display only first, drag later)
- [ ] Insert as Step 3b in wizard
- **Test:** DNA + tone choices move the user dot correctly

### Phase 4: Convergence Flow (1-2 sessions)
- [ ] `convergence.ts` algorithm
- [ ] `ConvergenceFlow`, `ConvergenceRound`, `ImageChoice` components
- [ ] Parallel image generation for A/B pairs
- [ ] State update on user pick
- [ ] 4 rounds → quadrant position locked
- [ ] "I don't know yet" entry point on DNA step
- **Test:** Can complete 4 rounds and arrive at a quadrant position

### Phase 5: NL Refinement (1 session)
- [ ] `/api/interpret-feedback` route
- [ ] `styleInterpreter.ts` with Claude call
- [ ] `RefinementBar` component
- [ ] Wire to convergence final image and output page images
- **Test:** "More gritty" moves dot down on Y axis and regenerates

### Phase 6: Output Enhancement (1 session)
- [ ] Generate all images in parallel on output page
- [ ] Individual regenerate per card
- [ ] Refinement bar per card
- [ ] Copy all prompts
- [ ] (Stretch) Export ZIP of images

---

## Key Data: DNA Spectrum

The prototype's DNA data should be extracted to `lib/dnaData.ts`. The five DNA options with their quadrant X positions:

```typescript
export const DNA_SPECTRUM = [
  { name: 'Minimalist / Design-Forward', quadrantX: 10, ... },
  { name: 'Hand-Drawn / Illustrated',    quadrantX: 30, ... },
  { name: 'Graphic / Cel-Shaded',        quadrantX: 50, ... },
  { name: 'Stylized Painterly',          quadrantX: 70, ... },
  { name: 'Cinematic Realism',           quadrantX: 90, ... },
];
```

---

## Prompt Engineering Notes

### For live step previews, keep prompts fast and simple:
```
[DNA phrase], [color/lighting], [setting hint if available], game concept art, 
wide establishing shot, no characters, no text, no watermark
```

### For convergence rounds, use environment shots (neutral, no character bias):
```
game concept art environment, [renderStyle from X], [atmosphere from Y],
[genre hint], wide shot, atmospheric, professional game art, no text
```

### For final output prompts, use the full `buildPrompts()` function from the prototype, translated to TypeScript.

### Token budget for Claude feedback interpretation:
- System prompt: ~400 tokens
- User message: ~200 tokens  
- Response: ~150 tokens
- Total per refinement call: ~750 tokens (~$0.003 at current Sonnet pricing)

---

## Environment Variables

```bash
# .env.local
FAL_KEY=your_fal_api_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional for Phase 6+
UPSTASH_REDIS_REST_URL=   # for rate limiting + image URL caching
UPSTASH_REDIS_REST_TOKEN=
```

---

## Notes on the HTML Prototype

The file `art-style-compass.html` is included as a living spec document, not as code to port directly. Read it to understand:
- The exact copy for every step (labels, placeholder text, hints)
- The card grid option data (values, icons, descriptions)
- The DNA spectrum data and detail card content
- The game reference data organized by DNA cluster and scope tier
- The `buildPrompts()` function for generating the final output prompts
- The CSS variable naming convention for the color system

Translate the JS logic to TypeScript. Use the CSS variables as the foundation for your Tailwind config. Do not use the HTML file's CSS classes — rewrite in Tailwind.

---

## Acceptance Criteria

The v2 build is complete when a user can:

1. Start the wizard, pick genre + camera + DNA
2. See a live image preview appear within 5 seconds of picking DNA
3. View the quadrant map with their position plotted and recognizable game names around them
4. Either proceed through the wizard OR switch to convergence mode
5. In convergence: pick 4 rounds of A/B images and arrive at a confirmed style position
6. Type "too dark, more painterly" and see a new image that reflects that adjustment
7. Complete the wizard and reach the output page
8. Hit "Generate all images" and see all pitch deck shots populate within 30 seconds
9. Type feedback on any output image and regenerate that specific shot
10. Copy all prompts as text

---

## Stretch Goals (Not In Scope For v1)

- **Side-by-side DNA comparison:** Run same answers through 2 DNA choices simultaneously → compare outputs
- **Session persistence:** User can return to a session in progress
- **Team sharing:** Share a style session URL with a collaborator (read-only view)
- **PPTX export:** Generate a skeleton pitch deck with images placed in template slides
- **Prompt history:** Per-shot generation history with ability to revert
- **Style profiles:** Save a named style ("Endeavor v3 direction") and reload it

