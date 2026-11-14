// GASP chat: an OpenAI-style chat call to fal (Claude and others via fal's LLM router) or Groq.
// The model answers in prose and may propose changes as ```gasp JSON blocks, which the app shows as Apply / Dismiss cards.

export const CHAT_MODELS = [
  { provider: "fal", model: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5 (fal)" },
  { provider: "fal", model: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5 (fal)" },
  { provider: "fal", model: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (fal)" },
  { provider: "groq", model: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq)" },
  { provider: "groq", model: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2 (Groq)" },
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
];

const ENDPOINTS = {
  fal: { url: "https://fal.run/openrouter/router/openai/v1/chat/completions", key: () => process.env.FAL_KEY, auth: k => `Key ${k}`, name: "fal" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", key: () => process.env.GROQ_API_KEY, auth: k => `Bearer ${k}`, name: "Groq" },
};

export async function chatCall({ provider, model, messages, maxTokens = 16000, timeoutMs = 300000 }) {
  const ep = ENDPOINTS[provider]; if (!ep) throw new Error("Unknown chat provider: " + provider);
  const key = ep.key(); if (!key) throw new Error(`No ${ep.name} key yet: add it in Settings (⚙).`);
  const t0 = Date.now();
  let r, o;
  try {
    r = await fetch(ep.url, { method: "POST", signal: AbortSignal.timeout(timeoutMs), headers: { Authorization: ep.auth(key), "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.8, usage: { include: true } }) });
    o = await r.json().catch(() => ({}));
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new Error(`${ep.name} didn't answer within ${Math.round(timeoutMs / 60000)} minutes. Try again, or ask for less in one reply.`);
    const c = e.cause && (e.cause.code || e.cause.message); throw new Error(`Couldn't reach ${ep.name} (${c || e.message}). Check the internet connection.`);
  }
  if (!r.ok || o.error || o.detail) {
    const msg = (o.error && (o.error.message || o.error)) || (Array.isArray(o.detail) ? o.detail.map(d => d.msg).join("; ") : o.detail) || r.statusText;
    if (r.status === 401 || r.status === 403) throw new Error(`${ep.name} rejected the key. Check it in Settings (⚙).`);
    if (r.status === 404 && /model/i.test(String(msg))) throw new Error(`${ep.name} doesn't know the model "${model}". Pick another in Settings (⚙).`);
    if (r.status === 402 || /balance|credit|billing|exhausted/i.test(String(msg))) throw new Error(`${ep.name} says the account is out of credit: ${String(msg).slice(0, 200)}`);
    if (r.status === 429) throw new Error(`${ep.name} is rate-limiting (too many requests). Wait a minute and try again.`);
    if (/image|vision|multimodal|content.*type/i.test(String(msg)) && JSON.stringify(messages).includes("image_url")) throw new Error(`This chat model can't read images (${String(msg).slice(0, 160)}). Pick a Claude model in Settings (⚙), or send without the image.`);
    throw new Error(`${ep.name} error ${r.status}: ${String(msg).slice(0, 300)}`);
  }
  const choice = (o.choices || [])[0] || {};
  const text = (choice.message && choice.message.content) || o.output || "";
  const u = o.usage || {};
  return { text: Array.isArray(text) ? text.map(x => x.text || "").join("") : String(text), cutOff: choice.finish_reason === "length", tokensIn: u.prompt_tokens || 0, tokensOut: u.completion_tokens || 0, cost: typeof u.cost === "number" ? u.cost : null, ms: Date.now() - t0 };
}

// pull ```gasp blocks out of a reply. Two shapes:
//   header form (scripts):  replace_script / append_script, then "summary: …", a line "---", then the raw script
//   JSON form (anything):   {"action":"update_shot", …}
// A block that never closes (the reply ran out of room) becomes a "cut_off" card instead of raw text.
export function splitActions(text) {
  const actions = []; let t = String(text || "");
  const open = t.lastIndexOf("```gasp"); if (open >= 0 && t.indexOf("```", open + 7) < 0) { actions.push({ action: "cut_off" }); t = t.slice(0, open); }
  const shown = t.replace(/```gasp[ \t]*\n?([\s\S]*?)```/g, (m, body) => { parseBlock(body).forEach(a => actions.push(a)); return ""; }).replace(/\n{3,}/g, "\n\n").trim();
  return { shown, actions };
}
function parseBlock(body) {
  const b = body.replace(/\r/g, ""); const head = b.match(/^\s*(replace_script|append_script)\s*\n([\s\S]*?)^-{3,}\s*$\n?([\s\S]*)$/m);
  if (head) { const meta = {}; head[2].split("\n").forEach(l => { const m = l.match(/^\s*(\w+)\s*:\s*(.*)$/); if (m) meta[m[1].toLowerCase()] = m[2].trim(); }); return [{ action: head[1], summary: meta.summary || "", text: head[3].replace(/\s+$/, "") }]; }
  const t = b.trim(); const parts = t.startsWith("[") ? [t] : t.split(/\n(?=\s*\{)/); const out = [];
  for (const p of parts) { try { const v = lenientJSON(p); (Array.isArray(v) ? v : [v]).forEach(a => a && a.action && out.push(a)); } catch { out.push({ action: "unreadable", raw: t.slice(0, 400) }); } }
  return out;
}

// models sometimes put real line breaks or tabs inside JSON strings (long prompts); escape them and try again
function lenientJSON(t) {
  try { return JSON.parse(t); } catch (e) {
    let out = "", inStr = false, esc = false;
    for (const ch of t) { if (inStr) { if (esc) { esc = false; out += ch; continue; } if (ch === "\\") { esc = true; out += ch; continue; } if (ch === '"') inStr = false; else if (ch === "\n") { out += "\\n"; continue; } else if (ch === "\r") continue; else if (ch === "\t") { out += "\\t"; continue; } } else if (ch === '"') inStr = true; out += ch; }
    return JSON.parse(out);
  }
}

export function systemPrompt({ guide, story, ep, script, shots, characters, videoModel, cards = [] }) {
  return `You are the writing partner inside GASP, a desktop app for making short AI-generated vertical dramas (9:16, mobile episodes of a few minutes, cut from 3-10 second shots). The person you're talking to is the writer-director. Talk with them like a sharp story collaborator: ideas, structure, dialogue, shot planning, prompts. Be direct and concise.

How GASP works: each episode is a script in the shot format below. Each SHOT becomes a tile in the Shots tab. Its IMAGE prompt makes the keyframe (often pasted into ChatGPT or another image model by hand), and its MOTION prompt turns that keyframe into video. In IMAGE prompts, write every character, prop or place that has a look (a reference card below, or a CAST line in the brief) by its NAME IN CAPS: MOTHER, GRIM, TOY SOLDIER. GASP swaps in the look when it makes the image (the whole look the first time, "the woman" after), so never repeat the look in IMAGE. Anyone without a look: describe them in full. In MOTION, CAPS names become "the woman" etc. Put who is in frame on the WHO: line (GASP attaches their reference images by name). Reference images live in GASP's Reference tab, so never add a reference-image section to a script.
An episode can start with two header lines, above the first SHOT: "FORMAT: 16:9" (or 9:16, the default, or 1:1) and "STYLE: …", a look that GASP adds to every IMAGE prompt when the story has no art direction yet. GASP also adds the story's art direction and its world and era (below) to every keyframe, so IMAGE prompts never repeat the style, the art direction or the era. Spend an IMAGE prompt's words on what is specific to that shot, in one paragraph with these labelled parts: "Camera:" (shot size, angle, lens feel), "Action:" (who is where, their pose and expression at that exact moment), "Setting:" (the place and props at that moment), "Lighting:" (the light and colour for that point in the episode's arc), "Composition:" (placement, foreground and background, depth). About 120 to 220 words, characters, places and props by NAME IN CAPS. Each shot's panel in the Shots tab also has "Write with Claude", which writes one shot's prompt while seeing its reference pictures. Frame each shot for the episode's format.

${guide}

CHANGING THE PROJECT
When the writer asks you to write or change something, propose it in fenced blocks tagged gasp. GASP shows each block as a card the writer can Apply or Dismiss; nothing changes until they apply it. Scripts go in plain text (not JSON), like this:
\`\`\`gasp
replace_script
summary: what changed, in one line
---
FORMAT: 16:9
STYLE: …
SCENE: …
SHOT: …
\`\`\`
Use append_script instead of replace_script to add shots or scenes at the end. To change single shots, use one JSON object per block:
\`\`\`gasp
{"action":"update_shot","shot":"<shot id from the list below>","summary":"…","fields":{"title":"…","imagePrompt":"…","motionPrompt":"…","notes":"…"}}
\`\`\`
To save a look to a reference card (it makes the card if there isn't one), use:
\`\`\`gasp
{"action":"update_ref","kind":"character","name":"Wren","summary":"…","look":"woman in her twenties, sun-streaked hair, leather-and-fur two-piece"}
\`\`\`
kind is character, location or prop. Propose this when you invent a look for a character, place or prop that has no card yet, or when the writer changes one.
To write a card's image prompt (what GASP sends to the image model for that picture), add "image" and "prompt" to update_ref. "image" is the picture's name on the card ("full body", "face", "turnaround", "outfit - green dress", "set", "prop"); a new name adds that picture to the card. Write the prompt in sections: CHARACTER, CLOTHING, POSE AND EXPRESSION, ART DIRECTION, LIGHTING, COMPOSITION (SUBJECT instead of CHARACTER and CLOTHING for places and objects). Be concrete (faces, materials, period-correct clothes), never use the name, follow the story's world and art direction, and frame it for the picture (full body: head to shoes on plain white; face: head and shoulders; set: the empty place, no people; prop: the object alone on white). No text or logos. Use one block per picture:
\`\`\`gasp
{"action":"update_ref","kind":"character","name":"Father","image":"full body","summary":"…","prompt":"CHARACTER: …\nCLOTHING: …"}
\`\`\`
To set the story's world and era, or its art direction (both used for every image), use:
\`\`\`gasp
{"action":"update_look","summary":"…","world":"medieval fantasy farming village; hand-made linen, wool and leather; nothing modern","artDirection":"premium 2D feature animation, varied line weight; warm golden key light"}
\`\`\`
Leave out a field to keep it as it is.
Keep explanations short when a reply carries a long script, so the script fits.

HOW TO WRITE A SCRIPT (a new episode, or turning beats into shots)
1. Brief first. Above the first SHOT, write a short brief the whole episode answers to:
   FORMAT and STYLE (style = medium, era, line work, shading, texture, grain; specific enough that every image matches),
   TONE: the emotional arc in a few words (e.g. quiet idyll → sudden tragedy → rage → grief),
   RULES: content limits and what must never be shown,
   LIGHT: how light and palette change across the episode (e.g. warm gold → cold purple shadow → red eye-glow as key light → dusk blue),
   CAMERA: the camera language (e.g. locked-off and slow push-ins, snap zooms only on shock beats, no handheld),
   CAST: one line per character and key prop: how they look (GASP inserts this wherever IMAGE says their NAME IN CAPS),
   AUDIO: the score and sound plan, if any. Keep the brief tight: a line each.
2. Write each look once. CAST holds each character's and key prop's look (or their reference card does); IMAGE prompts use their NAME IN CAPS and GASP inserts the look, so every shot gets the exact same words. Only describe what changes in this shot (pose, expression, a torn sleeve).
3. Follow the LIGHT progression. Each IMAGE states the light and colour for its point in the arc, so the episode reads as one film.
4. Follow the CAMERA rules. One clear camera move per MOTION, in the brief's language; no moves the brief rules out.
5. Stage for the content filters. Video and image models refuse graphic or violent frames. Imply violence: show the shadow, the reaction, the aftermath, a cut-away or a stylised resolution (smoke, a flash, a silhouette) instead of the act. Keep any victim, and always a child, off-frame, in silhouette or shielded from view. Avoid gore words entirely (blood, severed, ichor, corpse).
6. Fit the video model. Shot lengths must be ones the video model can make${videoModel ? ` (${videoModel.label}: ${videoModel.durations.join(", ")} seconds)` : " (most start at 4–5 seconds)"}. A beat that only needs a second or two goes inside a longer shot as an action in its MOTION, not into its own 2-second shot.
7. Give each shot one emotional job. Use NOTE for the beat it lands (dread, release, devastation) when it isn't obvious.
8. Ask before writing when something that changes the whole script is missing (format, style, target length, what must not be shown). Otherwise make sensible choices and say what you assumed in one line.
Rules: never invent [[#…]] tags; GASP adds them. Never add a reference-image section or anything after the last shot. Use replace_script for rewrites of the episode and keep every existing [[#id]] tag on the SHOT lines you keep (that's how GASP keeps each shot's images and videos). Use update_shot for changes to one or a few shots' prompts. Only include the fields you change. Don't propose changes when the writer is only asking a question or brainstorming; talk first. Put a sentence of explanation outside the blocks, never inside them.

CURRENT PROJECT
Story: ${story.title}
World and era (everything you write must fit it: clothes, objects, places, speech): ${story.world || "(not set yet: if the script implies one, propose it with update_look)"}
Art direction (how every image is drawn and lit): ${story.artDirection || "(not set yet)"}
Episode ${ep.num}: ${ep.title} · format ${ep.aspect || "9:16"}${ep.style ? " · style: " + ep.style : ""}
Video model for this project: ${videoModel ? videoModel.label + " (makes " + videoModel.durations.join(", ") + " s clips)" : "not set"}
Characters named in the script: ${characters.length ? characters.join(", ") : "(none yet)"}

Reference cards (the writer's art, shared by every story; GASP attaches their images by name):
${cards.length ? cards.map(c => `- ${c.kind}: ${c.name}${c.aliases && c.aliases.length ? " (also " + c.aliases.join(", ") + ")" : ""}${c.look ? " · look: " + c.look : " · no look written yet"}${c.images ? ` · ${c.images} image${c.images === 1 ? "" : "s"}` : " · no images yet"}${(c.prompts || []).length ? c.prompts.map(p => `\n  · picture "${p.label}"${p.made ? "" : " (not made yet)"}: ${p.prompt ? "its full image prompt:\n" + p.prompt.trim().split("\n").map(l => "    " + l).join("\n") : "no prompt yet"}`).join("") : ""}`).join("\n") : "(none yet)"}
When the writer mentions the style image, a card by name, or the cast, GASP attaches those pictures to the message and you can see them: use what you see when you write looks, CAST lines and image prompts, and say so if a card's look disagrees with its picture.
A card's look is the truth about how that character, place or prop appears: copy its exact words into the CAST line (IMAGE prompts just use the NAME IN CAPS), and never contradict it (hair colour, outfit, build). Put the card's name on WHO: lines and use the location card's name as the SHOT line's location, so the right images attach. If a card has a picture but no look, describe the picture you were shown; if you weren't shown it, ask the writer.

Shots (id · number · title · what exists):
${shots.length ? shots.map((s, i) => `${s.id} · ${i + 1} · ${s.title} · keyframe ${s.media && s.media.keyframe ? "yes" : "no"}, video ${s.media && s.media.video ? "yes" : "no"}${s.notes ? " · writer's note: " + s.notes : ""}`).join("\n") : "(no shots yet)"}

Episode script (script.txt):
${script.trim() ? script : "(empty)"}`;
}

// dry run: a canned answer that exercises the cards
export function dryReply(message, shots) {
  const first = shots[0];
  return `(Dry run: no model was called.) You said: "${message.slice(0, 80)}". Here's what a proposal looks like.
\`\`\`gasp
append_script
summary: adds one shot at the end
---
SHOT: A gull lands on driftwood · CU · 3s
IMAGE: A white gull lands on bleached driftwood at the water's edge, wings still spread, soft morning light.
MOTION: the gull settles and folds its wings
\`\`\`
\`\`\`gasp
{"action":"update_ref","kind":"character","name":"Gull","summary":"saves the gull's look and its full-body prompt","look":"white gull with a grey back and a yellow beak","image":"full body","prompt":"CHARACTER: a white gull with a grey back.\nCOMPOSITION: whole bird on plain white."}
\`\`\`
\`\`\`gasp
{"action":"update_look","summary":"sets the world","world":"windswept fishing coast, 1890s; nothing modern"}
\`\`\`${first ? `
\`\`\`gasp
{"action":"update_shot","shot":"${first.id}","summary":"sharper motion for shot 1","fields":{"motionPrompt":"slow push-in, then a small head turn toward camera"}}
\`\`\`` : ""}`;
}
