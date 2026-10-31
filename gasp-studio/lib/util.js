import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const execFileP = promisify(execFile);

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
export function shotDir(manifest, root, ep, shot) {
  return ensure(path.join(epDir(manifest, root, ep), `shot-${pad2(shot.index)}`));
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
