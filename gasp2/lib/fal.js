// fal.ai calls: queue API, storage upload, download. GASP_DRY=1 replaces network calls with local placeholders.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export const ffmpeg = (args) => run("ffmpeg", ["-y", "-loglevel", "error", ...args], { windowsHide: true, maxBuffer: 1 << 26 });

export async function falRun(endpoint, input, onStatus) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("No fal key yet: add it in Settings (⚙).");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, { method: "POST", headers, body: JSON.stringify(input) });
  const sub = await submit.json().catch(() => ({}));
  if (!submit.ok || sub.detail) throw new Error(readable(sub, submit.status));
  const { request_id, status_url, response_url } = sub;
  for (let i = 0; i < 900; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const st = await fetch(status_url || `https://queue.fal.run/${endpoint}/requests/${request_id}/status`, { headers });
    const j = await st.json().catch(() => ({}));
    if (onStatus) onStatus(j.status, j.queue_position);
    if (j.status === "COMPLETED") {
      const res = await fetch(response_url || `https://queue.fal.run/${endpoint}/requests/${request_id}`, { headers });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out.detail) throw new Error(readable(out, res.status));
      return out;
    }
    if (j.status === "FAILED" || j.error) throw new Error(readable(j, 500));
  }
  throw new Error("fal took longer than 30 minutes; check fal.ai/dashboard for the request");
}

// fal's errors are JSON; turn the common ones into a sentence
function readable(o, status) {
  const t = JSON.stringify(o || {});
  if (/content_policy_violation/.test(t)) return "fal's content checker refused this (the keyframe or the prompt). Try another model or soften the prompt.";
  if (status === 401 || /Unauthorized|invalid.*key/i.test(t)) return "fal rejected the key. Check it in Settings (⚙).";
  if (/balance|credits|payment|exhausted/i.test(t)) return "fal says the account is out of credit. Top up at fal.ai/dashboard.";
  const d = o && o.detail; const msg = Array.isArray(d) ? d.map(x => `${(x.loc || []).slice(1).join(".")}: ${x.msg}`).join("; ") : (typeof d === "string" ? d : (o && (o.error || o.message)));
  return `fal error ${status}: ${String(msg || t).slice(0, 300)}`;
}

export async function falUpload(file) {
  const key = process.env.FAL_KEY;
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".mp4" ? "video/mp4" : ext === ".mp3" ? "audio/mpeg" : "image/jpeg";
  const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ content_type: type, file_name: path.basename(file) }) });
  if (!init.ok) throw new Error(`fal upload failed (${init.status}): ${(await init.text()).slice(0, 200)}`);
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": type }, body: buf });
  if (!put.ok) throw new Error(`fal upload failed (${put.status})`);
  return file_url;
}

export async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

const fmtDur = (m, d) => m.durFormat === "s" ? `${d}s` : m.durFormat === "number" ? d : String(d);

// Animate a keyframe. Returns { file, cost, seconds }.
export async function imageToVideo({ model, keyframe, prompt, seconds, outFile, onStatus }) {
  const d = model.durations.includes(seconds) ? seconds : (model.durations.find(x => x >= seconds) ?? model.durations[model.durations.length - 1]);
  const cost = +(model.pricePerSecond * d + (model.perRequest || 0)).toFixed(3);
  if (process.env.GASP_DRY) {
    // placeholder: a slow push-in on the keyframe, so the whole flow can be tried without spending
    await new Promise(r => setTimeout(r, 1500));
    await ffmpeg(["-loop", "1", "-i", keyframe, "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='min(zoom+0.0012,1.15)':d=1:s=720x1280:fps=24,format=yuv420p", "-t", String(d), "-c:v", "libx264", "-preset", "veryfast", outFile]);
    return { file: outFile, cost: 0, seconds: d, dry: true };
  }
  const url = await falUpload(keyframe);
  const out = await falRun(model.endpoint, { prompt: prompt || "subtle natural motion", [model.image]: url, duration: fmtDur(model, d), ...(model.extra || {}) }, onStatus);
  const v = out.video && out.video.url;
  if (!v) throw new Error("fal returned no video: " + JSON.stringify(out).slice(0, 200));
  await download(v, outFile);
  return { file: outFile, cost, seconds: d };
}

const DRY_SIZE = { "9:16": "720x1280", "16:9": "1280x720", "1:1": "1024x1024" };
const extOf = (url, type) => { const m = /\.(png|jpe?g|webp)(\?|$)/i.exec(url || ""); if (m) return "." + m[1].toLowerCase().replace("jpeg", "jpg"); return /jpe?g/.test(type || "") ? ".jpg" : /webp/.test(type || "") ? ".webp" : ".png"; };

// Make images from a prompt and reference images. outBase gets " 1", " 2"… and the right extension.
// Returns { files, cost }.
export async function generateImages({ model, prompt, refs = [], aspect = "9:16", count = 1, outBase, onStatus }) {
  const n = Math.max(1, Math.min(4, count | 0 || 1)); refs = refs.filter(f => f && fs.existsSync(f)).slice(0, model.maxRefs || 4);
  const name = i => outBase + (n > 1 ? ` ${i + 1}` : "");
  if (process.env.GASP_DRY) {
    // placeholder: the first reference (or a colour) at the right shape, tinted differently per take
    await new Promise(r => setTimeout(r, 1200)); const [w, h] = (DRY_SIZE[aspect] || DRY_SIZE["9:16"]).split("x"); const files = [];
    for (let i = 0; i < n; i++) { const f = name(i) + ".png"; const hue = Math.round(Math.random() * 360);
      if (refs[0]) await ffmpeg(["-i", refs[0], "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x2a2230,hue=h=${hue}`, "-frames:v", "1", f]);
      else await ffmpeg(["-f", "lavfi", "-i", `color=c=0x${(0x302040 + hue * 97).toString(16).slice(-6)}:s=${w}x${h}`, "-frames:v", "1", f]);
      files.push(f); }
    return { files, cost: 0, dry: true };
  }
  const input = { prompt, num_images: n, ...(model.extra || {}) };
  if (model.size === "image_size") input.image_size = (model.sizes || {})[aspect] || (model.sizes || {})["9:16"]; else input.aspect_ratio = aspect;
  if (refs.length) { input.image_urls = []; for (const f of refs) input.image_urls.push(await falUpload(f)); }
  const out = await falRun(refs.length ? model.endpoint : (model.textEndpoint || model.endpoint), input, onStatus);
  const imgs = out.images || (out.image ? [out.image] : []);
  if (!imgs.length) throw new Error("fal returned no image: " + JSON.stringify(out).slice(0, 200));
  const files = []; for (let i = 0; i < imgs.length; i++) { const f = name(i) + extOf(imgs[i].url, imgs[i].content_type); await download(imgs[i].url, f); files.push(f); }
  return { files, cost: +((model.pricePerImage || 0) * imgs.length).toFixed(3) };
}

// Background removal → a PNG with transparency.
export async function removeBackground({ tool, file, outFile, onStatus }) {
  if (process.env.GASP_DRY) { await new Promise(r => setTimeout(r, 800)); await ffmpeg(["-i", file, "-vf", "format=rgba,colorkey=0xFFFFFF:0.3:0.1", "-frames:v", "1", outFile]); return { file: outFile, cost: 0, dry: true }; }
  const image_url = await falUpload(file);
  const out = await falRun(tool.endpoint, { image_url, ...(tool.extra || {}) }, onStatus);
  const url = (out.image && out.image.url) || (out.images && out.images[0] && out.images[0].url);
  if (!url) throw new Error("fal returned no image: " + JSON.stringify(out).slice(0, 200));
  await download(url, outFile); return { file: outFile, cost: tool.pricePerImage || 0 };
}

// Sound effects or music → an mp3. kind "sfx" uses duration_seconds; "music" uses music_length_ms and stays instrumental.
export async function generateAudio({ model, kind, prompt, seconds, outFile, onStatus }) {
  const secs = Math.max(kind === "music" ? 3 : 0.5, Math.min(kind === "music" ? 600 : (model.maxSeconds || 22), +seconds || 5));
  const cost = kind === "music" ? +(Math.ceil(secs / 60) * (model.pricePerMinute || 0)).toFixed(3) : +(secs * (model.pricePerSecond || 0)).toFixed(3);
  if (process.env.GASP_DRY) {
    await new Promise(r => setTimeout(r, 900));
    const src = kind === "music" ? `sine=frequency=220:duration=${secs}` : `anoisesrc=color=pink:amplitude=0.08:duration=${secs}`;
    await ffmpeg(["-f", "lavfi", "-i", src, "-q:a", "6", outFile]); return { file: outFile, cost: 0, seconds: secs, dry: true };
  }
  const input = kind === "music" ? { prompt, music_length_ms: Math.round(secs * 1000), force_instrumental: true } : { text: prompt, duration_seconds: secs, prompt_influence: 0.5 };
  const out = await falRun(model.endpoint, input, onStatus);
  const url = out.audio && out.audio.url; if (!url) throw new Error("fal returned no audio: " + JSON.stringify(out).slice(0, 200));
  await download(url, outFile); return { file: outFile, cost, seconds: secs };
}
