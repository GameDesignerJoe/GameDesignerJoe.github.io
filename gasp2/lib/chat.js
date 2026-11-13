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

export async function chatCall({ provider, model, messages, maxTokens = 6000 }) {
  const ep = ENDPOINTS[provider]; if (!ep) throw new Error("Unknown chat provider: " + provider);
  const key = ep.key(); if (!key) throw new Error(`No ${ep.name} key yet: add it in Settings (⚙).`);
  const t0 = Date.now();
  let r, o;
  try {
    r = await fetch(ep.url, { method: "POST", headers: { Authorization: ep.auth(key), "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.8, usage: { include: true } }) });
    o = await r.json().catch(() => ({}));
  } catch (e) { throw new Error(`Couldn't reach ${ep.name}: ${e.message}`); }
  if (!r.ok || o.error || o.detail) {
    const msg = (o.error && (o.error.message || o.error)) || (Array.isArray(o.detail) ? o.detail.map(d => d.msg).join("; ") : o.detail) || r.statusText;
    if (r.status === 401 || r.status === 403) throw new Error(`${ep.name} rejected the key. Check it in Settings (⚙).`);
    if (r.status === 404 && /model/i.test(String(msg))) throw new Error(`${ep.name} doesn't know the model "${model}". Pick another in Settings (⚙).`);
    throw new Error(`${ep.name} error ${r.status}: ${String(msg).slice(0, 300)}`);
  }
  const choice = (o.choices || [])[0] || {};
  const text = (choice.message && choice.message.content) || o.output || "";
  const u = o.usage || {};
  return { text: Array.isArray(text) ? text.map(x => x.text || "").join("") : String(text), tokensIn: u.prompt_tokens || 0, tokensOut: u.completion_tokens || 0, cost: typeof u.cost === "number" ? u.cost : null, ms: Date.now() - t0 };
}

// pull ```gasp {...}``` blocks out of a reply
export function splitActions(text) {
  const actions = []; const shown = String(text || "").replace(/```gasp\s*([\s\S]*?)```/g, (m, body) => {
    const t = body.trim(); const parts = t.startsWith("[") ? [t] : t.split(/\n(?=\s*\{)/);
    for (const p of parts) { try { const v = JSON.parse(p); (Array.isArray(v) ? v : [v]).forEach(a => a && a.action && actions.push(a)); } catch { actions.push({ action: "unreadable", raw: t.slice(0, 400) }); } }
    return "";
  }).replace(/\n{3,}/g, "\n\n").trim();
  return { shown, actions };
}

export function systemPrompt({ guide, story, ep, script, shots, characters }) {
  return `You are the writing partner inside GASP, a desktop app for making short AI-generated vertical dramas (9:16, mobile episodes of a few minutes, cut from 3-10 second shots). The person you're talking to is the writer-director. Talk with them like a sharp story collaborator: ideas, structure, dialogue, shot planning, prompts. Be direct and concise.

How GASP works: each episode is a script in the shot format below. Each SHOT becomes a tile in the Shots tab. Its IMAGE prompt makes the keyframe (often pasted into ChatGPT or another image model by hand), and its MOTION prompt turns that keyframe into video. So IMAGE prompts must stand on their own in any image model: describe people by how they look, never by name, and name them on the WHO: line instead (GASP attaches their reference images by name). Write for vertical 9:16 framing.

${guide}

CHANGING THE PROJECT
When the writer asks you to write or change something, propose it with one or more fenced blocks tagged gasp. Each block is one JSON object. GASP shows each as a card the writer can Apply or Dismiss; nothing changes until they apply it. Available actions:
\`\`\`gasp
{"action":"replace_script","summary":"what changed, in one line","text":"<the whole episode script, in the shot format>"}
\`\`\`
\`\`\`gasp
{"action":"append_script","summary":"…","text":"<new shots or scenes to add at the end>"}
\`\`\`
\`\`\`gasp
{"action":"update_shot","shot":"<shot id from the list below>","summary":"…","fields":{"title":"…","imagePrompt":"…","motionPrompt":"…","notes":"…"}}
\`\`\`
Rules: use replace_script for rewrites of the episode and keep every existing [[#id]] tag on the SHOT lines you keep (that's how GASP keeps each shot's images and videos). Use update_shot for changes to one or a few shots' prompts. Only include the fields you change. Don't propose changes when the writer is only asking a question or brainstorming; talk first. Put a sentence of explanation outside the blocks, never inside them.

CURRENT PROJECT
Story: ${story.title}
Episode ${ep.num}: ${ep.title}
Characters named in the script: ${characters.length ? characters.join(", ") : "(none yet)"}

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
{"action":"append_script","summary":"adds one shot at the end","text":"SHOT: A gull lands on driftwood · CU · 3s\\nIMAGE: A white gull lands on bleached driftwood at the water's edge, wings still spread, soft morning light, vertical frame.\\nMOTION: the gull settles and folds its wings"}
\`\`\`${first ? `
\`\`\`gasp
{"action":"update_shot","shot":"${first.id}","summary":"sharper motion for shot 1","fields":{"motionPrompt":"slow push-in, then a small head turn toward camera"}}
\`\`\`` : ""}`;
}
