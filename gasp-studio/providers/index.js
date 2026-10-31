// Provider adapters. Every call goes through here, so swapping models is a registry edit.
// STUDIO_DRY_RUN=1 replaces every network call with a local placeholder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileP, readJSON, fontArg } from "../lib/util.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const registry = readJSON(path.join(here, "registry.json"));
export const DRY = !!process.env.STUDIO_DRY_RUN;

function pick(kind, name) {
  const r = registry[kind];
  const key = name && r[name] ? name : r.default;
  return { key, ...r[key] };
}

// ---------- fal.ai queue API ----------
async function falRun(endpoint, input) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY missing (set it in .env, or STUDIO_DRY_RUN=1)");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${await submit.text()}`);
  const { request_id, status_url, response_url } = await submit.json();
  for (let i = 0; i < 600; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const st = await fetch(status_url || `https://queue.fal.run/${endpoint}/requests/${request_id}/status`, { headers });
    const j = await st.json();
    if (j.status === "COMPLETED") {
      const res = await fetch(response_url || `https://queue.fal.run/${endpoint}/requests/${request_id}`, { headers });
      return await res.json();
    }
    if (j.status === "FAILED" || j.error) throw new Error(`fal failed: ${JSON.stringify(j).slice(0, 400)}`);
  }
  throw new Error("fal timeout");
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

// Upload a local file to fal storage so it can be used as a reference image.
async function falUpload(file) {
  const key = process.env.FAL_KEY;
  const buf = fs.readFileSync(file);
  const type = file.endsWith(".png") ? "image/png" : "image/jpeg";
  const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ content_type: type, file_name: path.basename(file) }) });
  if (!init.ok) throw new Error(`fal upload init ${init.status}: ${await init.text()}`);
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": type }, body: buf });
  if (!put.ok) throw new Error(`fal upload put ${put.status}`);
  return file_url;
}

// ---------- placeholders ----------
async function placeholderImage(file, text, w = 1080, h = 1920, refs = [], label = "") {
  // Dry-run still: the first reference image (portrait or setting) scaled to fill, darkened at the bottom, with the shot text over it.
  const wrap = (t, n) => { const words = String(t || "").split(/\s+/); const lines = []; let cur = ""; for (const x of words) { if ((cur + " " + x).trim().length > n) { lines.push(cur.trim()); cur = x; } else cur += " " + x; } if (cur.trim()) lines.push(cur.trim()); return lines.slice(0, 8).join("\n"); };
  const txt = file.replace(/\.png$/, "-text.txt"); fs.writeFileSync(txt, (label ? label + "\n\n" : "") + wrap(text, 30));
  const tf = `textfile='${txt.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;
  const draw = `drawtext=${fontArg()}${tf}:fontcolor=white:fontsize=40:line_spacing=12:x=(w-text_w)/2:y=h*0.62:box=1:boxcolor=black@0.5:boxborderw=24`;
  const ref = refs.find(f => f && fs.existsSync(f));
  if (ref) {
    await execFileP("ffmpeg", ["-y", "-i", ref, "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=1.2,eq=brightness=-0.08,${draw}`, "-frames:v", "1", file]);
  } else {
    await execFileP("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=0x3a2d36:s=${w}x${h}`, "-vf", draw, "-frames:v", "1", file]);
  }
  return file;
}
async function placeholderAudio(file, seconds) {
  await execFileP("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(Math.max(0.5, seconds)), "-q:a", "9", "-acodec", "libmp3lame", file]);
  return file;
}
async function placeholderVideo(file, still, seconds) {
  await execFileP("ffmpeg", ["-y", "-loop", "1", "-i", still, "-t", String(seconds), "-vf", "scale=1080:1920", "-r", "24", "-pix_fmt", "yuv420p", file]);
  return file;
}

// ---------- public API ----------
export async function generateStill({ prompt, refs = [], outFile, provider, aspect = "9:16", label, labelTitle }) {
  const p = pick("image", provider);
  if (DRY) return { file: await placeholderImage(outFile, label || prompt.slice(0, 160), 1080, 1920, refs, labelTitle || ""), cost: 0, provider: p.key };
  const input = { prompt, aspect_ratio: aspect, image_size: { width: 1080, height: 1920 }, num_images: 1 };
  if (p.supportsRefs && refs.length) {
    const urls = [];
    for (const f of refs.slice(0, 4)) urls.push(await falUpload(f));
    input.image_urls = urls;
  }
  const out = await falRun(p.endpoint, input);
  const url = out.images?.[0]?.url || out.image?.url;
  if (!url) throw new Error("no image in response: " + JSON.stringify(out).slice(0, 300));
  await download(url, outFile);
  return { file: outFile, cost: p.pricePerImage || 0, provider: p.key };
}

export async function generateVideo({ prompt, still, seconds, outFile, provider }) {
  const p = pick("video", provider);
  const dur = Math.min(seconds, p.maxSeconds || 10);
  if (DRY) return { file: await placeholderVideo(outFile, still, dur), cost: 0, provider: p.key };
  const image_url = await falUpload(still);
  const out = await falRun(p.endpoint, { prompt, image_url, duration: String(Math.round(dur)), aspect_ratio: "9:16" });
  const url = out.video?.url;
  if (!url) throw new Error("no video in response: " + JSON.stringify(out).slice(0, 300));
  await download(url, outFile);
  return { file: outFile, cost: (p.pricePerSecond || 0) * dur, provider: p.key };
}

export async function lipsync({ video, audio, outFile, provider }) {
  const p = pick("lipsync", provider);
  if (DRY) { fs.copyFileSync(video, outFile); return { file: outFile, cost: 0, provider: p.key }; }
  const video_url = await falUpload(video); const audio_url = await falUpload(audio);
  const out = await falRun(p.endpoint, { video_url, audio_url });
  const url = out.video?.url; if (!url) throw new Error("no video in lipsync response");
  await download(url, outFile);
  return { file: outFile, cost: p.pricePerSecond || 0, provider: p.key };
}

export async function tts({ text, voice = {}, outFile, provider }) {
  const chosen = provider || (voice.provider?.toLowerCase().includes("minimax") ? "fal-minimax" : voice.provider?.toLowerCase().includes("eleven") ? "elevenlabs" : null);
  const p = pick("tts", chosen);
  const est = Math.max(1.2, text.split(/\s+/).length / 2.6 + 0.5);
  if (DRY) return { file: await placeholderAudio(outFile, est), cost: 0, provider: p.key };
  if (p.key === "elevenlabs") {
    const key = process.env.ELEVENLABS_API_KEY; if (!key) throw new Error("ELEVENLABS_API_KEY missing");
    const voiceId = voice.id; if (!voiceId) throw new Error(`no ElevenLabs voice ID on this line${voice.speaker ? " (" + voice.speaker + ")" : ""} — set it on the character in Gate Ten → Cast, re-export the manifest`);
    const settings = parseSettings(voice.settings);
    const r = await fetch(p.api.replace("{voiceId}", voiceId), { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: settings.stability ?? 0.5, similarity_boost: 0.8, style: settings.style ?? 0.3, speed: settings.speed ?? 1.0 } }) });
    if (!r.ok) throw new Error(`elevenlabs ${r.status}: ${await r.text()}`);
    fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    return { file: outFile, cost: (p.pricePer1kChars || 0) * text.length / 1000, provider: p.key };
  }
  const out = await falRun(p.endpoint, { text, voice_setting: { voice_id: voice.id || "Wise_Woman", speed: parseSettings(voice.settings).speed ?? 1 } });
  const url = out.audio?.url || out.audio_url; if (!url) throw new Error("no audio in tts response");
  await download(url, outFile);
  return { file: outFile, cost: (p.pricePer1kChars || 0) * text.length / 1000, provider: p.key };
}

export async function music({ prompt, seconds, outFile, provider }) {
  const p = pick("music", provider);
  if (DRY) return { file: await placeholderAudio(outFile, seconds), cost: 0, provider: p.key };
  if (p.key === "elevenlabs-music") {
    const key = process.env.ELEVENLABS_API_KEY; if (!key) throw new Error("ELEVENLABS_API_KEY missing");
    const ms = Math.round(Math.min(300, Math.max(10, seconds)) * 1000);
    const r = await fetch(p.api, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ prompt: `${prompt}. Instrumental, no vocals, loopable underscore for a short-form drama.`, music_length_ms: ms }) });
    if (!r.ok) throw new Error(`elevenlabs music ${r.status}: ${await r.text()}`);
    fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    return { file: outFile, cost: p.pricePerTrack || 0, provider: p.key };
  }
  const out = await falRun(p.endpoint, { prompt, duration: Math.round(seconds) });
  const url = out.audio?.url || out.audio_url; if (!url) throw new Error("no audio in music response");
  await download(url, outFile);
  return { file: outFile, cost: p.pricePerTrack || 0, provider: p.key };
}

export async function sfx({ prompt, seconds, outFile, provider }) {
  const p = pick("sfx", provider);
  if (DRY) return { file: await placeholderAudio(outFile, seconds), cost: 0, provider: p.key };
  const key = process.env.ELEVENLABS_API_KEY; if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  const r = await fetch(p.api, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ text: prompt, duration_seconds: Math.min(22, Math.max(0.5, seconds)) }) });
  if (!r.ok) throw new Error(`elevenlabs sfx ${r.status}: ${await r.text()}`);
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
  return { file: outFile, cost: p.pricePerClip || 0, provider: p.key };
}

function parseSettings(s) {
  const o = {};
  for (const m of String(s || "").matchAll(/(stability|style|speed)\s*[:=]?\s*([0-9.]+)/gi)) o[m[1].toLowerCase()] = parseFloat(m[2]);
  return o;
}

export function estimate(manifest, eps) {
  const img = pick("image"), vid = pick("video"), lip = pick("lipsync"), tt = pick("tts"), mu = pick("music");
  const rows = [];
  for (const ep of eps) {
    let stills = 0, videoSec = 0, lipSec = 0, chars = 0;
    for (const s of ep.shots) {
      if (!s.location && !s.action) continue;
      stills += 2;
      if (s.renderPlan === "animate") videoSec += s.duration;
      if (s.renderPlan === "lipsync") { videoSec += s.duration; lipSec += s.duration; }
      for (const l of s.lines || []) chars += (l.text || "").length;
    }
    const cost = stills * (img.pricePerImage || 0) + videoSec * (vid.pricePerSecond || 0) + lipSec * (lip.pricePerSecond || 0) + chars / 1000 * (tt.pricePer1kChars || 0) + (mu.pricePerTrack || 0);
    rows.push({ episode: ep.number, stills, videoSeconds: +videoSec.toFixed(1), lipsyncSeconds: +lipSec.toFixed(1), voChars: chars, animaticOnly: +(stills * (img.pricePerImage || 0) + chars / 1000 * (tt.pricePer1kChars || 0) + (mu.pricePerTrack || 0)).toFixed(2), withVideo: +cost.toFixed(2) });
  }
  return rows;
}
