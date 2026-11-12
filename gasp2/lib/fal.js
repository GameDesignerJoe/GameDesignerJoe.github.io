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
