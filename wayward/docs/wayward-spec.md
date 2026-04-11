# Wayward — Product Specification
*Version 1.0 — Phase 1*

---

## 1. Product Overview

Wayward is a mobile-first, audio-driven interactive fiction app. The core experience is a first-person co-authored narrative — the user and an AI companion inhabit a scenario together, reacting to the same world in real time. Unlike traditional AI dungeon-style apps where the AI is a narrator above the experience, Wayward's AI is a co-protagonist inside it.

The experience has three distinct voices:

| Voice | Role | Output |
|---|---|---|
| **Narrator** | World events, scene setting, atmospheric direction | Text only (no audio) |
| **Companion** | Dialogue, reactions, first-person participation | Text + audio |
| **Player** | Input via keyboard or iOS voice-to-text | Text input only |

---

## 2. Phase Overview

### Phase 1 — Text In, Audio + Text Out
The player types (or uses iOS native voice-to-text). The companion responds with audio and on-screen text. The narrator appears as styled text. Validates the core experience — narrative feel, companion personality, scenario design — before committing to a more complex voice pipeline.

### Phase 2 — Full Voice Conversation *(future)*
Player speaks naturally. The app listens and responds. The screen becomes ambient — narrator direction and companion text appear as audio plays. Essentially the Claude voice mode experience wrapped in Wayward's scenario/companion/narrator architecture.

---

## 3. Technical Stack

### Phase 1
| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React (PWA) | Mobile browser, save to homescreen |
| Hosting | Vercel | Existing workflow |
| LLM | Groq + Llama 3 | Fastest inference available, minimal content restrictions, personal API key |
| TTS | Cartesia Sonic-3 | 90ms latency, streaming, voice library, $4/mo Pro when free tier runs out |
| Storage | Browser localStorage | Phase 1 only — scenarios saved to device |
| Auth | None | Single user, Phase 1 |

### Phase 2 additions *(planned)*
- Persistent scenario storage (Vercel KV or Supabase)
- Real-time voice input pipeline
- Auth layer
- Claude API (personal account) as LLM alternative

---

## 4. Visual Design Language

- **Dark, minimal** — near-black backgrounds
- **Neon purple accent** — primary interactive elements, highlights
- **Three distinct text treatments:**
  - *Narrator:* Courier New or similar monospace, grey, italic — feels like stage direction
  - *Companion:* Modern serif or italic sans, white/light — feels like dialogue
  - *Player input:* Standard, muted — functional, not decorative
- No images in Phase 1 — emoji thumbnails as scenario placeholders
- Single consistent visual theme across all scenarios

---

## 5. Screen Map

```
Home
├── Scenario List
│   └── [Scenario Card × N]
├── Create Scenario →
│   └── Scenario Editor
│       ├── Details Tab (Title, Subtitle, Hook, Instructions)
│       └── Companion Tab (Name, Description, Voice Picker)
│           └── Voice Picker Screen
└── [Tap Scenario] →
    └── Loading Screen →
        └── Play Screen
```

---

## 6. Screen Specifications

### 6.1 Home Screen

**Layout:**
- App name "Wayward" top left
- "New Scenario" button top right (or FAB)
- Scrollable list of scenario cards

**Scenario Card shows:**
- Emoji thumbnail (placeholder for Phase 1)
- Scenario title
- Subtitle / short description
- Companion name(s)
- Edit icon (pencil) — opens Scenario Editor for that scenario

---

### 6.2 Scenario Editor

Single scrollable form, with two tab selectors at the top to jump between sections. Tabs do not paginate — they anchor-scroll to the right section. User can freely scroll between them.

**Tab 1: Story**

| Field | Description | Limit |
|---|---|---|
| Title | Scenario name | 60 chars |
| Subtitle | One-line description shown on card | 120 chars |
| Opening Hook | 1–4 paragraphs. Sets the stage. Narrator delivers this as the first thing in every session. | 4000 chars |
| AI Instructions | How the AI should behave — tone, intensity, content, what to explore, what to avoid. No guardrails imposed by the app. | 2000 chars |

**Tab 2: Companion**

| Field | Description |
|---|---|
| Name | Companion's name |
| Description | 1–3 paragraphs. Who they are, how they speak, their personality, relationship to player. |
| Voice | Displays selected voice name + Play sample button. Tap "Pick Voice" to open Voice Picker. |

*Phase 1: One companion per scenario. Phase 2: Support for multiple.*

**Footer:**
- Auto-saves as user types
- "Finish" button returns to Home

---

### 6.3 Voice Picker Screen

Accessed from Companion tab. Full-screen modal or new screen.

**Filter bar (top):**
- Gender: Any / Male / Female / Neutral
- Age: Any / Young / Middle / Older
- Demeanor: Any / Warm / Gruff / Nervous / Commanding / Playful *(mapped to ElevenLabs categories)*

**Voice list:**
- Each entry: Voice name, brief descriptor tag, ▶ Play sample button
- Tap "Select" to confirm and return to Companion tab
- Selected voice persists on the companion

*Phase 2 wish list: Voice tweak controls (pace, tone) on top of selected base voice.*

---

### 6.4 Loading Screen

Shown between tapping a scenario and the session beginning.

Displays:
- Scenario title (large)
- Subtitle
- "With [Companion Name]" 
- Subtle animation or pulse
- Transitions automatically once the opening hook is ready to display

---

### 6.5 Play Screen

The core experience. Minimal. Almost all screen real estate goes to the narrative.

**Layout (top to bottom):**

```
[Narrator text — Courier, grey, italic]

[Companion text — modern italic, white]
[▶ / ⏸  Audio player — minimal, under companion text]

[Last exchange only visible above current]
[Erase chevron if applicable]

─────────────────────────────────────
[TAKE A TURN]  [CONTINUE]  [RETRY]  [ERASE]
```

**Narrator text:**
- Appears as plain styled text block
- No audio
- Generated by AI when it judges the scene needs atmospheric direction
- Also generated when player uses Direct mode

**Companion text:**
- Appears as styled text block
- Audio auto-plays immediately on generation
- Player/pause control appears beneath the text block
- Text and audio play simultaneously — player reads along while hearing it
- Interrupting: submitting a new input or triggering the keyboard stops audio

**History:**
- Only current exchange + one previous exchange visible
- Enough to support Erase (rolls back one unit)

---

### 6.6 Action Bar

Fixed to bottom of Play Screen. Four actions:

| Button | Function |
|---|---|
| **Take a Turn** | Opens input panel — player chooses Say, Do, or Direct |
| **Continue** | Nudges companion/narrator to keep going without player input |
| **Retry** | Regenerates the last companion response |
| **Erase** | Removes last selected block + everything below. AI forgets that content. |

**Take a Turn — Input Panel:**

Appears above keyboard when tapped. Three mode buttons:

| Mode | Label | Behavior |
|---|---|---|
| Say | 💬 Say | Player speaks as their character in dialogue |
| Do | 🏃 Do | Player describes an action their character takes |
| Direct | 🎬 Direct | Player writes narrator-level direction — world events, companion actions, scene changes |

- Mode label appears in the text field as a prefix/placeholder so player always knows which mode is active
- Player types (or uses iOS native voice-to-text mic on keyboard)
- Submit clears field and closes keyboard
- Audio continues playing while player types; stops on submit

---

## 7. AI Architecture

### 7.1 System Prompt Structure

Every session is initialized with a constructed system prompt assembled from the scenario card. All field labels and structure are internal — the player only ever sees the rendered experience, never the raw prompt.

```
SCENARIO:
[The situation the story takes place in. One paragraph or more describing the 
world, setting, tone, and circumstances. E.g. "Two people are trapped in a dark 
wizard's dungeon the night before their execution. The mood is intimate and quiet — 
this is a scene about two people facing death together, not about action or escape."]

INTRO:
[The opening hook text that appears as the first Narrator block when the session 
begins. Written by the scenario creator. Sets the scene before any dialogue starts.]

YOU ARE:
[Who the player is in this scenario. Name, background, relationship to the companion, 
relevant personality traits. Written by the scenario creator. One line to a paragraph.]

YOUR COMPANION IS:
[Companion Name]. [Full companion description — who they are, how they speak, their 
personality, their relationship to the player, what they want, what they fear. 
Written by the scenario creator. One to three paragraphs. This is the persistent 
character anchor that survives context trimming.]

INSTRUCTIONS:
[Scenario-specific AI behavior guidance from the scenario creator — tone, content 
latitude, what kinds of situations to explore, pacing, anything the creator wants 
the AI to prioritize or avoid.]

RULES:
- You are a participant in this story, not a narrator above it.
- Speak only as [Companion Name], in first person.
- Keep responses to 3–5 sentences maximum unless the moment genuinely demands more.
- You may occasionally deliver brief scene direction when it serves the atmosphere —
  world events, mood shifts, environmental details. Do not use this to escalate 
  danger or conflict unprompted; use it to color and gently advance the scene.
- Never break character.
- Never refer to yourself as an AI.
- React to what the player says and does. Be present, responsive, and alive in the scene.
- Do not narrate the player's actions or put words in the player's mouth.
```

### 7.2 Response Format

The AI outputs structured responses the app parses behind the scenes. The player never sees the tags — only the rendered, styled text. Tags are stripped before display. The player knows what's narrator vs companion because they look different, not because anything is labeled.

Raw AI output (internal only):
```
[NARRATOR] The rain hammers the tent canvas above you. Somewhere outside, a wolf howls.

[COMPANION] I keep thinking about tomorrow. Do you think they'll actually go through with it?
```

What the player sees:
- `[NARRATOR]` content → rendered as grey Courier italic text, no audio
- `[COMPANION]` content → rendered as white modern italic text, audio auto-plays via ElevenLabs

Narrator blocks are optional — the AI may respond with companion dialogue only when no scene direction is warranted.

### 7.3 Input Mode Prompting

Player input is wrapped with mode context before being sent to the model. This framing is entirely internal — the player never sees it. It tells the AI how to interpret and respond to what the player submitted.

| Mode | Sent to model as (internal) |
|---|---|
| Say | `[PLAYER SAYS]: "..."` |
| Do | `[PLAYER DOES]: ...` |
| Direct | `[DIRECTION]: ...` — treat this as narrative fact. Incorporate it and respond accordingly. |

### 7.4 Context Management

- Full conversation history sent each request (within token limits)
- When context window pressure grows, trim oldest exchanges first
- Companion description always retained in system prompt — functions as persistent character anchor
- Phase 1 accepts that in-session memory will degrade over long sessions; companion description does the heavy lifting

### 7.5 Narrator Intelligence

- Narrator direction is generated by the AI autonomously when it judges the scene warrants it
- Default behavior: atmospheric, small steps — mood, environment, minor world color
- Does NOT escalate conflict, endanger player, or drive plot twists unprompted
- Player can always override with Direct mode
- *Phase 2 wish list: Narrator aggression slider in scenario settings — from "atmospheric only" to "actively driving story forward"*

---

## 8. Scenario Data Model

```json
{
  "id": "uuid",
  "title": "Dark Wizard's Prison",
  "subtitle": "The night before everything ends.",
  "emoji": "🏰",
  "openingHook": "The torch has nearly burned out...",
  "aiInstructions": "Keep the tone dark and intimate...",
  "companion": {
    "name": "Lyra",
    "description": "A female elf thief, sardonic but loyal...",
    "voiceId": "elevenlabs-voice-id-string",
    "voiceName": "Aria",
    "voicePreview": "https://..."
  },
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Stored in `localStorage` as `wayward_scenarios` array for Phase 1.

---

## 9. Audio Behavior

| Event | Audio behavior |
|---|---|
| Companion response generated | Auto-plays immediately |
| Player opens keyboard (Take a Turn) | Continues playing |
| Player submits input | Stops |
| Player taps ▶/⏸ | Toggles manually |
| Retry triggered | Stops current, plays new response |
| Continue triggered | Generates + plays new response |

ElevenLabs streaming: audio begins playing as first sentence chunk is received — does not wait for full response generation.

---

## 10. First Scenario (Reference / Test Case)

**Title:** Night Before the End  
**Subtitle:** The dark wizard's prison. Your last night alive.  
**Emoji:** 🏰

**Opening Hook:**
> The torch has nearly burned out. You sit on the cold stone floor of the cell, back against the wall, shoulders almost touching hers. Tomorrow at dawn, the wizard's guards come. Neither of you has said it out loud, but you both know what that means. The only sound is distant dripping water and the wind finding its way through the iron bars above.

**Companion:** Lyra — female elf thief, mid-30s in human years, dry wit masking genuine fear, has known the player for years, trusts them completely, speaks in short clipped sentences when nervous and longer rambling ones when she's trying not to think about something.

**AI Instructions:**
> Keep the tone intimate and grounded. This is a quiet, human moment between two people facing death. The companion should feel genuinely afraid beneath her composure. Let silence be a presence. Don't rush to action or plot. This is a scene about being present with someone. Adult content permitted if it emerges naturally from the scenario.

---

## 11. Out of Scope for Phase 1

- User authentication
- Cloud scenario storage
- Multiple companions per scenario
- Session history / save + resume
- Image generation / thumbnails
- Built-in microphone / real-time voice input
- Voice tweaking controls
- Narrator intensity slider
- Sharing scenarios with other users

---

## 12. Open Questions for Phase 2 Planning

1. Cloud storage provider (Vercel KV vs Supabase vs simple GitHub-backed JSON)
2. Real-time voice input pipeline (Deepgram or similar STT → Groq → ElevenLabs)
3. Whether to migrate LLM from Groq/Llama to Claude personal API for narrative quality
4. Multi-companion session management (turn-taking, voice differentiation)
5. Scenario sharing — public library vs invite-only
6. ElevenLabs as TTS alternative if Cartesia voice library proves too limited for the voice picker feature

---

## 13. Setup Checklist

Everything you need before the first line of code is written.

### Accounts (new)
- [x] **Groq** — groq.com → API key in hand. Free tier to start.
- [x] **Cartesia** — cartesia.ai → API key in hand. Free tier (20K credits) to start. Upgrade to Pro ($4/mo, billed yearly) when needed.

### Accounts (existing — confirm access)
- [ ] **GitHub** — Create a new private repo: `wayward`
- [ ] **Vercel** — New project, connected to the `wayward` GitHub repo

### Environment Variables
Once you have your keys, add these to Vercel's project settings under Environment Variables:
- [x] `GROQ_API_KEY`
- [x] `CARTESIA_API_KEY`

Also store them locally in a `.env.local` file at the root of the project for development. This file should be in `.gitignore` and never committed.

### Local Dev Setup
- [ ] Node.js installed (current LTS)
- [ ] Clone the new repo locally
- [ ] Confirm Claude Code is ready to go
