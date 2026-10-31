// Builds the animatic: approved stills (or clips) + VO + captions + ambience + music → MP4 9:16.
import fs from "node:fs";
import path from "node:path";
import { execFileP, audioDuration, pad2, exists, log, fontArg } from "./util.js";

const W = 1080, H = 1920, FPS = 24;
const LEAD = Math.max(0, parseFloat(process.env.STUDIO_LEAD ?? "0.6") || 0);   // seconds of picture before the first line of a shot

function escText(t) {
  return String(t || "").replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%").replace(/\n/g, " ");
}
function wrap(t, n = 34) {
  const words = String(t || "").split(/\s+/); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim()); return lines.join("\n");
}
let TXT = 0; let TXTDIR = "";
function drawtext(text, opts = {}) {
  const font = fontArg();
  const size = opts.size || 44, y = opts.y || "h-th-220", box = opts.box !== false;
  const f = path.join(TXTDIR, `cap-${++TXT}.txt`); fs.writeFileSync(f, wrap(text, opts.wrap || 34));
  return `drawtext=${font}textfile='${f.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'")}':fontcolor=white:fontsize=${size}:line_spacing=10:x=(w-text_w)/2:y=${y}${box ? ":box=1:boxcolor=black@0.55:boxborderw=18" : ""}${opts.enable ? `:enable='${opts.enable}'` : ""}`;
}

// A segment is one shot (or interaction card) rendered to its own mp4 with its own audio track.
async function renderShotSegment({ shot, still, clip, voFiles, outFile, captions = true, sfxFile }) {
  // The shot's picture runs for the shot's own duration plus its lines (lines are spoken over the picture).
  const total = +(shot.duration + (shot.lines || []).reduce((a, l) => a + (l.measured || l.duration || 0), 0)).toFixed(2);
  const vf = [];
  let inputs = [];
  if (clip && exists(clip)) {
    inputs = ["-i", clip];
    vf.push(`scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},tpad=stop_mode=clone:stop_duration=${Math.max(0, total - 0.01)}`);
  } else {
    inputs = ["-loop", "1", "-framerate", String(FPS), "-i", still];
    // slow push: zoompan over the segment
    const frames = Math.round(total * FPS);
    const push = shot.renderPlan === "still" ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}` :
      `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='min(1.0+0.0009*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`;
    vf.push(push);
  }
  // captions: each line enabled during its window inside the segment.
  // Dialogue starts after a short lead-in (STUDIO_LEAD, default 0.6s), not after the whole action beat; the rest of the beat plays out after the last line.
  const lead = (shot.lines || []).length ? Math.min(shot.duration, LEAD) : shot.duration;
  let t = lead;
  for (const l of shot.lines || []) {
    const d = l.measured || l.duration || 2;
    if (captions && l.text) vf.push(drawtext(`${l.speaker ? l.speaker.toUpperCase() + ": " : ""}${l.text}`, { enable: `between(t,${t.toFixed(2)},${(t + d).toFixed(2)})` }));
    t += d;
  }
  if (shot.interaction) {
    const ix = shot.interaction;
    const opts = (ix.options || []).map((o, j) => `${j + 1}) ${o.label}${o.cost === "free" || !o.cost ? "" : " \u25c6 " + (o.amt || 0) + " " + o.cost}`).join("   ");
    vf.push(drawtext(`\u25c6 ${ix.template.toUpperCase()}${ix.type ? " / " + ix.type : ""}`, { size: 40, y: "h/2-260", box: false }));
    vf.push(drawtext(ix.prompt || "", { size: 46, y: "h/2-120", wrap: 30 }));
    vf.push(drawtext(opts, { size: 36, y: "h/2+120", wrap: 36 }));
  }
  // audio: concat silence(shot.duration) + each VO in order; mix a sfx if present
  const afilters = [];
  const aInputs = [];
  let idx = 1;
  const parts = [];
  parts.push(`anullsrc=r=44100:cl=stereo:d=${Math.max(0.05, lead).toFixed(2)}[s0]`);
  let chain = "[s0]";
  for (const vo of voFiles) {
    aInputs.push("-i", vo);
    parts.push(`[${idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[v${idx}]`);
    chain += `[v${idx}]`; idx++;
  }
  parts.push(`${chain}concat=n=${1 + voFiles.length}:v=0:a=1,apad=whole_dur=${total}[voice]`);
  let aout = "[voice]";
  if (sfxFile && exists(sfxFile)) {
    aInputs.push("-i", sfxFile);
    parts.push(`[${idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.8[sfx]`);
    parts.push(`[voice][sfx]amix=inputs=2:duration=first:dropout_transition=0[mix]`);
    aout = "[mix]"; idx++;
  }
  const filter = `[0:v]${vf.join(",")}[vout];${parts.join(";")}`;
  const args = ["-y", ...inputs, ...aInputs, "-filter_complex", filter, "-map", "[vout]", "-map", aout, "-t", String(total), "-r", String(FPS), "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", outFile];
  await execFileP("ffmpeg", args);
  return { file: outFile, seconds: total };
}

export async function assembleEpisode({ manifest, ep, dir, getStill, getClip, getVO, ambienceFile, musicFile, captions = true, onProgress }) {
  TXTDIR = path.join(dir, "captions"); fs.mkdirSync(TXTDIR, { recursive: true }); TXT = 0;
  const segs = [];
  for (const shot of ep.shots) {
    const out = path.join(dir, `seg-${pad2(shot.index)}.mp4`);
    if (shot.interaction) {
      const card = path.join(dir, `seg-${pad2(shot.index)}-card.png`);
      await execFileP("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=0x17121a:s=${W}x${H}`, "-frames:v", "1", card]);
      await renderShotSegment({ shot: { ...shot, renderPlan: "still", lines: [] }, still: card, voFiles: [], outFile: out, captions });
      segs.push(out); onProgress?.(shot, "card"); continue;
    }
    if (shot.orphanLine || (!shot.location && !shot.action)) {
      // a line or sfx with no shot before it: carry on the previous picture if any, else a black card
      const prev = segs.length ? null : null;
      const card = path.join(dir, `seg-${pad2(shot.index)}-card.png`);
      await execFileP("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}`, "-frames:v", "1", card]);
      const vo = [];
      for (const l of shot.lines || []) { const f = await getVO(l); if (f) { l.measured = await audioDuration(f); vo.push(f); } }
      await renderShotSegment({ shot: { ...shot, duration: 0.2, renderPlan: "still" }, still: card, voFiles: vo, outFile: out, captions });
      segs.push(out); continue;
    }
    const still = await getStill(shot);
    const clip = getClip ? await getClip(shot) : null;
    const vo = [];
    for (const l of shot.lines || []) { const f = await getVO(l); if (f) { l.measured = await audioDuration(f); vo.push(f); } }
    await renderShotSegment({ shot, still, clip, voFiles: vo, outFile: out, captions });
    segs.push(out); onProgress?.(shot, clip ? "clip" : "still");
  }
  // concat segments
  const list = path.join(dir, "segments.txt");
  fs.writeFileSync(list, segs.map(s => `file '${path.resolve(s).replace(/'/g, "'\\''")}'`).join("\n"));
  const joined = path.join(dir, `ep${ep.number}-cut.mp4`);
  await execFileP("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  // bed: ambience + music under the cut
  const final = path.join(dir, `ep${ep.number}-animatic.mp4`);
  const beds = [ambienceFile, musicFile].filter(f => f && exists(f));
  if (!beds.length) { fs.copyFileSync(joined, final); return final; }
  const total = await audioDuration(joined);
  const inputs = ["-i", joined]; const parts = []; let chain = "[0:a]"; let i = 1;
  for (const b of beds) { inputs.push("-stream_loop", "-1", "-i", b); parts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${b === musicFile ? 0.18 : 0.35}[b${i}]`); chain += `[b${i}]`; i++; }
  parts.push(`${chain}amix=inputs=${beds.length + 1}:duration=first:dropout_transition=0[a]`);
  await execFileP("ffmpeg", ["-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[a]", "-t", String(total), "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", final]);
  return final;
}
