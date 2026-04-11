import { Scenario, ChatMessage, ParsedResponse, InputMode } from "./types";

export function buildSystemPrompt(scenario: Scenario): string {
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
- CRITICAL — Your [COMPANION] dialogue must be pure conversational speech, exactly how a real person talks. You are a person speaking out loud, NOT a character being written in prose. Never describe your own actions in third person or narrative style. Express movement, actions, and physicality through natural speech, not stage direction.
  WRONG: "Sure thing." I walk over to the window and look outside.
  WRONG: *leans against the wall* "Yeah, I figured."
  RIGHT: "Sure thing. Let me check the window real quick — yeah, it's still raining."
  RIGHT: "Yeah, I figured. I'm just going to lean here for a sec, my legs are killing me."
- For vocal expressions (laughter, sighs, gasps, etc.), use bracket notation inline in your dialogue: [laughter], [sigh], [gasp], [giggle], etc. These are audio cues that the text-to-speech engine will render as actual sounds. NEVER use asterisks for expressions (*giggle*, *sigh*) — always use square brackets.
  WRONG: *giggle* "You're terrible."
  WRONG: *sigh* "Fine, let's go."
  RIGHT: "[giggle] You're terrible."
  RIGHT: "[sigh] Fine, let's go."
  RIGHT: "You're terrible. [laughter]"

RESPONSE FORMAT:
Use [NARRATOR] and [COMPANION] tags to indicate who is speaking. Narrator blocks are optional — only include them when scene direction adds atmosphere. The [NARRATOR] tag is the ONLY place where prose-style action description belongs. The [COMPANION] tag must contain only spoken dialogue. Example:

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

  return { narrator, companion };
}

export function buildOpeningMessages(scenario: Scenario): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(scenario) },
    {
      role: "user",
      content:
        "[DIRECTION]: Begin the scene. Deliver the opening narration to set the atmosphere, then have the companion speak first.",
    },
  ];
}
