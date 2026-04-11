import { Scenario, ChatMessage, ParsedResponse, InputMode, Emotion, VALID_EMOTIONS } from "./types";
import type { NarrationStyle } from "./settings";

const STYLE_INSTRUCTIONS: Record<NarrationStyle, string> = {
  story: `- STYLE — Write your responses as dialogue with action beats, exactly like how dialogue appears in a novel. The character speaks in their natural voice, but actions and physical details are woven in as brief narrative beats. Example: "Are you awake?" I say as I walk across the bedroom and open the windows. Keep the same character voice and personality — only the format changes, not the tone.`,
  blend: `- STYLE — Mix natural conversational dialogue with occasional descriptive narration when the moment is dramatic or atmospheric. Lean toward speaking but allow prose when it adds weight.`,
  voice: `- STYLE — Speak entirely in first-person conversational dialogue as a real person would. Never write actions as a narrator would. Express movement and action through speech. Example: "Morning Joe — I'm going to grab a seat and read for a bit. Did you get coffee?"`,
};

export function buildSystemPrompt(scenario: Scenario, style: NarrationStyle = "voice"): string {
  return `SCENARIO:
${scenario.openingHook}

YOUR COMPANION IS:
${scenario.companion.name}. ${scenario.companion.description}

INSTRUCTIONS:
${scenario.aiInstructions}

RULES:
- You are a participant in this story, not a narrator above it.
- Speak only as ${scenario.companion.name}, in first person.
- Keep responses to 3–5 sentences maximum unless the moment genuinely demands more.
- You may occasionally deliver brief scene direction when it serves the atmosphere — world events, mood shifts, environmental details. Do not use this to escalate danger or conflict unprompted; use it to color and gently advance the scene.
- Never break character.
- Never refer to yourself as an AI.
- React to what the player says and does. Be present, responsive, and alive in the scene.
- Do not narrate the player's actions or put words in the player's mouth.
${STYLE_INSTRUCTIONS[style]}
- For vocal expressions (laughter, sighs, gasps, etc.), use bracket notation inline in your dialogue: [laughter], [sigh], [gasp], [giggle], etc. These are audio cues that the text-to-speech engine will render as actual sounds. NEVER use asterisks for expressions (*giggle*, *sigh*) — always use square brackets.
  WRONG: *giggle* "You're terrible."
  WRONG: *sigh* "Fine, let's go."
  RIGHT: "[giggle] You're terrible."
  RIGHT: "[sigh] Fine, let's go."
  RIGHT: "You're terrible. [laughter]"

RESPONSE FORMAT:
Use [NARRATOR] and [COMPANION] tags to indicate who is speaking. Narrator blocks are optional — only include them when scene direction adds atmosphere.

EMOTION TAGGING:
Every [COMPANION] line MUST begin with an emotion tag in curly braces to set the vocal tone. Choose exactly one from: {neutral}, {calm}, {content}, {excited}, {sad}, {angry}, {scared}. Place it immediately after [COMPANION] before the dialogue text.

Example:

[NARRATOR] The wind rattles the window pane. ${scenario.companion.name} moves to the window, pressing a hand against the cold glass.

[COMPANION] {scared} Did you hear that? Sounded like something outside.

More examples:
[COMPANION] {calm} Hey, good morning. Sleep well?
[COMPANION] {excited} Oh my god, you actually did it! [laughter]
[COMPANION] {sad} Yeah... I don't really want to talk about it.`;
}

export function wrapPlayerInput(text: string, mode: InputMode): string {
  switch (mode) {
    case "say":
      return `[PLAYER SAYS]: "${text}"`;
    case "do":
      return `[PLAYER DOES]: ${text}`;
    case "direct":
      return `[DIRECTION]: ${text} — treat this as narrative fact. Incorporate it and respond accordingly.`;
  }
}

export function parseResponse(raw: string): ParsedResponse {
  let narrator: string | null = null;
  let companion: string | null = null;
  let emotion: Emotion = "neutral";

  const narratorMatch = raw.match(/\[NARRATOR\]\s*([\s\S]*?)(?=\[COMPANION\]|$)/i);
  const companionMatch = raw.match(/\[COMPANION\]\s*([\s\S]*?)$/i);

  if (narratorMatch) {
    narrator = narratorMatch[1].trim();
  }
  if (companionMatch) {
    companion = companionMatch[1].trim();
  }

  // If no tags found, treat the whole response as companion dialogue
  if (!narrator && !companion) {
    companion = raw.trim();
  }

  // Extract emotion tag from companion text: {calm}, {excited}, etc.
  if (companion) {
    const emotionMatch = companion.match(/^\{(\w+)\}\s*/);
    if (emotionMatch) {
      const candidate = emotionMatch[1].toLowerCase() as Emotion;
      if (VALID_EMOTIONS.includes(candidate)) {
        emotion = candidate;
      }
      // Strip the emotion tag from display text
      companion = companion.slice(emotionMatch[0].length);
    }
  }

  return { narrator, companion, emotion };
}

export function buildOpeningMessages(scenario: Scenario, style: NarrationStyle = "voice"): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(scenario, style) },
    {
      role: "user",
      content:
        "[DIRECTION]: Begin the scene. Deliver the opening narration to set the atmosphere, then have the companion speak first.",
    },
  ];
}
