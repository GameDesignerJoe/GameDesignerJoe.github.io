// ElevenLabs, called directly with Joe's own key (ELEVENLABS_API_KEY): voices, sound effects, music, speech.
// Used instead of fal whenever the key is set; usage is billed in ElevenLabs credits on his plan.
// GASP_DRY=1 replaces every call with a local placeholder.
import fs from "node:fs";
import { ffmpeg, checkCancel } from "./fal.js";

const API = "https://api.elevenlabs.io";
export const hasEleven = () => !!process.env.ELEVENLABS_API_KEY;

function readable(status, text) {
  let j = {}; try { j = JSON.parse(text); } catch {}
  const d = j.detail || j; const msg = typeof d === "string" ? d : d.message || d.msg || (Array.isArray(d) ? d.map(x => x.msg).join("; ") : "");
  const code = d && (d.status || d.code) || "";
  if (status === 401 || /invalid_api_key|unauthorized/i.test(code + msg)) return "ElevenLabs rejected the key. Check it in Settings (⚙).";
  if (/quota_exceeded|insufficient|credits/i.test(code + msg)) return "Your ElevenLabs plan is out of credits for this. Top up at elevenlabs.io, or remove the key in Settings to use fal instead.";
  if (/voice_not_found/i.test(code + msg)) return "ElevenLabs can't find that voice any more. Pick another one on the character's Voice tab.";
  if (/missing_permissions|permission/i.test(code + msg)) return "Your ElevenLabs key doesn't have permission for this. Give the key access to " + (msg.match(/'([a-z_]+)'/) || [, "this feature"])[1] + " in ElevenLabs › API keys.";
  return `ElevenLabs error ${status}: ${String(msg || text).slice(0, 300)}`;
}

// one request; ctl (a job) can cancel it while it's running
async function call(pathname, { method = "GET", query, body, binary, ctl } = {}) {
  const key = process.env.ELEVENLABS_API_KEY; if (!key) throw new Error("No ElevenLabs key: add it in Settings (⚙).");
  checkCancel(ctl);
  const url = new URL(API + pathname);
  for (const [k, v] of Object.entries(query || {})) if (v != null && v !== "") url.searchParams.set(k, String(v));
  const ac = new AbortController(); const watch = ctl ? setInterval(() => { if (ctl.cancel) ac.abort(); }, 250) : null;
  try {
    const r = await fetch(url, { method, signal: ac.signal, headers: { "xi-api-key": key, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(readable(r.status, await r.text()));
    return binary ? { buf: Buffer.from(await r.arrayBuffer()), headers: r.headers } : await r.json();
  } catch (e) { if (ctl && ctl.cancel) checkCancel(ctl); throw e; }
  finally { if (watch) clearInterval(watch); }
}

// credits used: the response header when ElevenLabs sends one, otherwise the change in the plan's count
async function creditsUsed() { try { const s = await call("/v1/user/subscription"); return s.character_count; } catch { return null; } }
async function metered(fn) {
  const before = await creditsUsed(); const r = await fn();
  const head = +(r.headers && r.headers.get("character-cost")) || 0;
  const after = head ? null : await creditsUsed();
  return { ...r, credits: head || (before != null && after != null ? Math.max(0, after - before) : null) };
}

export async function plan() {
  if (process.env.GASP_DRY) return { tier: "dry run", used: 1200, limit: 100000, resets: null };
  const s = await call("/v1/user/subscription");
  return { tier: s.tier, used: s.character_count, limit: s.character_limit, resets: s.next_character_count_reset_unix || null };
}

export async function soundEffect({ model, prompt, seconds, outFile, ctl }) {
  const secs = Math.max(0.5, Math.min(model.maxSeconds || 30, +seconds || 5));
  if (process.env.GASP_DRY) { await dry(900, ctl); await ffmpeg(["-f", "lavfi", "-i", `anoisesrc=color=pink:amplitude=0.08:duration=${secs}`, "-q:a", "6", outFile]); return { file: outFile, credits: 0, seconds: secs, dry: true }; }
  const r = await metered(() => call("/v1/sound-generation", { method: "POST", binary: true, ctl, query: { output_format: "mp3_44100_128" }, body: { text: prompt, duration_seconds: secs, prompt_influence: 0.5, model_id: model.modelId } }));
  fs.writeFileSync(outFile, r.buf); return { file: outFile, credits: r.credits, seconds: secs };
}

export async function music({ model, prompt, seconds, outFile, ctl }) {
  const secs = Math.max(3, Math.min(600, Math.ceil(+seconds || 30)));
  if (process.env.GASP_DRY) { await dry(900, ctl); await ffmpeg(["-f", "lavfi", "-i", `sine=frequency=220:duration=${secs}`, "-q:a", "6", outFile]); return { file: outFile, credits: 0, seconds: secs, dry: true }; }
  const r = await metered(() => call("/v1/music", { method: "POST", binary: true, ctl, body: { prompt, music_length_ms: secs * 1000, model_id: model.modelId, force_instrumental: true } }));
  fs.writeFileSync(outFile, r.buf); return { file: outFile, credits: r.credits, seconds: secs };
}

export async function speak({ voiceId, text, modelId, outFile }) {
  if (process.env.GASP_DRY) { await dry(600); await ffmpeg(["-f", "lavfi", "-i", `sine=frequency=330:duration=${Math.min(8, 1 + text.length / 15)}`, "-q:a", "6", outFile]); return { file: outFile, credits: 0, dry: true }; }
  const r = await metered(() => call(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, { method: "POST", binary: true, query: { output_format: "mp3_44100_128" }, body: { text, model_id: modelId } }));
  fs.writeFileSync(outFile, r.buf); return { file: outFile, credits: r.credits };
}

// Voices: "mine" = the voices in Joe's ElevenLabs account (his own, saved and the defaults); "library" = the shared Voice Library
const pick = v => ({ id: v.voice_id, name: v.name, owner: v.public_owner_id || null, preview: v.preview_url || null, category: v.category || "",
  gender: v.gender || (v.labels || {}).gender || "", age: v.age || (v.labels || {}).age || "", accent: v.accent || (v.labels || {}).accent || "",
  language: v.language || (v.labels || {}).language || "", useCase: v.use_case || (v.labels || {}).use_case || "", descriptive: v.descriptive || (v.labels || {}).descriptive || (v.labels || {}).description || "",
  description: String(v.description || "").slice(0, 400), uses: v.cloned_by_count || v.usage_character_count_1y || null });
export async function voices({ src = "mine", search, gender, age, accent, language, useCase, page = 0, token }) {
  if (process.env.GASP_DRY) {
    const all = [["Rachel", "female", "young", "american", "calm, warm"], ["Brian", "male", "middle_aged", "american", "deep, resonant"], ["Lily", "female", "middle_aged", "british", "soft, gentle"], ["Callum", "male", "middle_aged", "scottish", "gravelly, intense"], ["Pip", "neutral", "young", "irish", "bright, playful child"], ["Old Tom", "male", "old", "british", "weathered storyteller"]]
      .map(([n, g, a, ac, d], i) => ({ id: (src === "library" ? "lib" : "my") + i, name: n + (src === "library" ? " (library)" : ""), owner: src === "library" ? "owner" + i : null, preview: null, category: src === "library" ? "professional" : "premade", gender: g, age: a, accent: ac, language: "en", useCase: "characters_animation", descriptive: d, description: `${d} (dry run)`, uses: 100 * i }))
      .filter(v => (!search || (v.name + v.description + v.accent).toLowerCase().includes(String(search).toLowerCase())) && (!gender || v.gender === gender) && (!age || v.age === age) && (!accent || v.accent === accent));
    return { voices: all, more: false };
  }
  if (src === "library") {
    const r = await call("/v1/shared-voices", { query: { page_size: 30, page, search, gender, age, accent, language, use_cases: useCase } });
    return { voices: (r.voices || []).map(pick), more: !!r.has_more, page: page + 1 };
  }
  const r = await call("/v2/voices", { query: { page_size: 50, search, gender, age, accent, language, use_cases: useCase, next_page_token: token, include_total_count: false, sort: "name", sort_direction: "asc" } });
  return { voices: (r.voices || []).map(pick), more: !!r.has_more, token: r.next_page_token || null };
}
// a Voice Library voice has to be added to the account before it can speak
export async function addShared({ owner, id, name }) {
  if (process.env.GASP_DRY) return { id: "added-" + id };
  const r = await call(`/v1/voices/add/${encodeURIComponent(owner)}/${encodeURIComponent(id)}`, { method: "POST", body: { new_name: name } });
  return { id: r.voice_id };
}

const dry = async (ms, ctl) => { for (let t = 0; t < ms; t += 100) { checkCancel(ctl); await new Promise(r => setTimeout(r, 100)); } };
