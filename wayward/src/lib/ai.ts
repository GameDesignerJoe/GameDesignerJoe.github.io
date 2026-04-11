import { Scenario, ChatMessage, ParsedResponse, InputMode } from "./types";
import type { NarrationStyle } from "./settings";

const STYLE_INSTRUCTIONS: Record<NarrationStyle, string> = {
  story: `- STYLE — Write your responses as dialogue with action beats, exactly like how dialogue appears in a novel. The character speaks in their natural voice, but actions and physical details are woven in as brief narrative beats. Example: "Are you awake?" I say as I walk across the bedroom and open the windows. Keep the same character voice and personality — only the format changes, not the tone.`,
  blend: `- STYLE — Mix natural conversational dialogue with occasional descriptive narration when the moment is dramatic or atmospheric. Lean toward speaking but allow prose when it adds weight.`,
  voice: `- STYLE — Speak entirely in first-person conversational dialogue as a real person would. Never write actions as a narrator would. Express movement and action through speech. Example: "Morning Joe — I'm going to grab a seat and read for a bit. Did you get coffee?"`,
};

export function buildSystemPrompt(scenario: Scenario, style: NarrationStyle = "voice"): string {
  return `SCENARIO:
${scenario.scenario}

INTRO:
${scenario.openingHook}

YOU ARE:
${scenario.playerCharacter}

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
- Square brackets in [COMPANION] dialogue are ONLY for sounds that come out of a person's body — vocal noises, breathing, mouth sounds. NEVER actions, movements, gestures, or descriptions. Common tags: [laughing], [giggling], [sigh], [groaning], [whispering], [gasps], [crying], [sobbing], [yawning], [moaning], [screaming], [coughing], [retching]. You can also describe specific sounds naturally: [guttural choking sound], [sharp intake of breath], [breathy moan], [quiet whimper], [nervous laughter], [retching noise], [stifled sob]. The TTS engine will interpret these. If it's not a sound the body produces, it does NOT go in brackets — it goes in [NARRATOR] or is expressed through speech.
  RIGHT: "[sigh] I guess you're right."
  RIGHT: "[laughing] You're terrible."
  RIGHT: "[guttural choking sound] Oh god... I'm... [retching noise]"
  RIGHT: "[sharp intake of breath] You scared me."
  RIGHT: "[whispering] Do you hear that?"
  WRONG: "[I lean against the wall] Yeah, I figured."
  WRONG: "[she runs her hand through her hair] Whatever."
  WRONG: "[slowly] I don't think so."

RESPONSE FORMAT:
Use [NARRATOR] and [COMPANION] tags to indicate who is speaking. Narrator blocks are optional — only include them when scene direction adds atmosphere.

Example:

[NARRATOR] The wind rattles the window pane. ${scenario.companion.name} moves to the window, pressing a hand against the cold glass.

[COMPANION] Did you hear that? Sounded like something outside.`;
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

  // Strip any leftover {emotion} tags from companion text
  if (companion) {
    companion = companion.replace(/^\{\w+\}\s*/, "");
  }

  return { narrator, companion, emotion: "neutral" };
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
