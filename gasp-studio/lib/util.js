import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileRaw = promisify(execFile);
// windowsHide: no console window pops up for ffmpeg / git on Windows
export const execFileP = (cmd, args, opts = {}) => execFileRaw(cmd, args, { windowsHide: true, ...opts });

export function loadEnv(dir) {
  const p = path.join(dir, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const slug = s => String(s || "story").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const pad2 = n => String(n).padStart(2, "0");
export const ensure = d => { fs.mkdirSync(d, { recursive: true }); return d; };
export const readJSON = p => JSON.parse(fs.readFileSync(p, "utf8"));
export const writeJSON = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2));
export const exists = p => fs.existsSync(p);

export function dataUriToFile(uri, file) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(uri || "");
  if (!m) return null;
  fs.writeFileSync(file, Buffer.from(m[2], "base64"));
  return file;
}

export function workDir(manifest, root) {
  return ensure(path.join(root, "work", slug(manifest.story.title)));
}
export function epDir(manifest, root, ep) {
  return ensure(path.join(workDir(manifest, root), `ep${ep.number}`));
}
// ---- per-shot media: stills (take-N.png), composites (composite.png + composite-<v>.png), motion (clip*.mp4)
// use.json says what the cut uses: { kind: "still" } → approved.png, or { kind: "clip", clip: "<file>" }
export const isClipFile = f => /^clip[A-Za-z0-9_-]*\.mp4$/.test(f);
export const isStillFile = f => f === "composite.png" || /^composite-[a-z0-9]+\.png$/.test(f) || /^take-\d+\.png$/.test(f);
export function readUse(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, "use.json"), "utf8")); } catch { return {}; } }
export function writeUse(dir, o) { fs.writeFileSync(path.join(dir, "use.json"), JSON.stringify(o)); }
// the clip the cut plays, or null when the shot uses its still
export function clipInUse(dir) {
  if (!fs.existsSync(dir)) return null; const use = readUse(dir); if (use.kind === "still") return null;
  const files = fs.readdirSync(dir).filter(isClipFile); if (!files.length) return null;
  if (use.clip && files.includes(use.clip)) return path.join(dir, use.clip);
  for (const f of ["clip-lipsync.mp4", "clip.mp4"]) if (files.includes(f)) return path.join(dir, f);
  const newest = files.filter(f => !/-loop\.mp4$/.test(f)).sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)[0];
  return newest ? path.join(dir, newest) : null;
}
// keep the previous composite as history before a new one is written
export function archiveComposite(dir) { const f = path.join(dir, "composite.png"); if (fs.existsSync(f)) { try { fs.renameSync(f, path.join(dir, `composite-${Math.round(fs.statSync(f).mtimeMs).toString(36)}.png`)); } catch {} } }
export const shotKey = s => s.id ? String(s.id).replace(/[^a-zA-Z0-9_-]/g, "") : pad2(s.index);
export function shotDir(manifest, root, ep, shot) {
  return ensure(path.join(epDir(manifest, root, ep), `shot-${shotKey(shot)}`));
}

export function pickEpisodes(manifest, args) {
  const want = args.ep ? String(args.ep).split(",").map(Number) : null;
  return manifest.episodes.filter(e => !want || want.includes(e.number));
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

export async function audioDuration(file) {
  try {
    const { stdout } = await execFileP("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
}

export function log(...a) { console.log(...a); }
export function warn(...a) { console.warn("!", ...a); }

// Font for ffmpeg drawtext. Windows has no fontconfig default, so pick a system font there.
export function fontArg() {
  const f = process.env.STUDIO_FONT || (process.platform === "win32" ? "C:/Windows/Fonts/arial.ttf" : process.platform === "darwin" ? "/System/Library/Fonts/Supplemental/Arial.ttf" : "");
  if (!f || !fs.existsSync(f)) return "";
  return `fontfile='${f.replace(/\\/g, "/").replace(/:/g, "\\:")}':`;
}
