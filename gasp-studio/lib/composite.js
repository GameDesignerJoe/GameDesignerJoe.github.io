// Composites character cutouts over a location setting image to make a free animatic still.
// Cutouts may be real PNGs with alpha, or flat green / magenta backgrounds (keyed out here).
import fs from "node:fs";
import path from "node:path";
import { execFileP } from "./util.js";

const W = 1080, H = 1920;

// framing → how much of the full-body cutout to show and how tall the figure is relative to frame
// crop: fraction of a FULL-BODY cutout (from the top) that is visible; scale: visible height as a fraction of the frame height;
// chestScale: how tall a chest-up image is drawn relative to the frame; prefer: which cutout to use when both exist
const FRAMING = {
  // figures are pinned to the bottom edge of the frame, so (1 - scale) is the headroom above the figure
  "ECU":  { crop: 0.20, scale: 1.30, chestScale: 1.20, prefer: "chest" },
  "CU":   { crop: 0.28, scale: 1.02, chestScale: 0.95, prefer: "chest" },
  "MCU":  { crop: 0.40, scale: 0.86, chestScale: 0.78, prefer: "chest" },
  "OTS":  { crop: 0.40, scale: 0.86, chestScale: 0.78, prefer: "chest" },
  "MS":   { crop: 0.60, scale: 0.84, chestScale: 0.70, prefer: "full" },
  "insert (prop)": { crop: 0.30, scale: 1.0, chestScale: 0.85, prefer: "chest" },
  "2-shot (depth)": { crop: 0.80, scale: 0.80, chestScale: 0.60, prefer: "full" },
};

async function probe(file) {
  const { stdout } = await execFileP("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "csv=p=0", file]);
  const [w, h, pix] = stdout.trim().split(",");
  return { w: +w, h: +h, alpha: /a|rgba|ya/.test(pix || "") };
}

// Detect a flat key color by sampling the top-left pixel.
async function keyColor(file) {
  try {
    const { stdout } = await execFileP("ffmpeg", ["-v", "error", "-i", file, "-vf", "crop=4:4:0:0,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { encoding: "buffer", maxBuffer: 1 << 20 });
    const [r, g, b] = stdout;
    if (g > 180 && r < 120 && b < 120) return "0x00FF00";
    if (r > 180 && b > 180 && g < 120) return "0xFF00FF";
    if (r > 235 && g > 235 && b > 235) return "0xFFFFFF";
    return null;
  } catch { return null; }
}

// Returns an ffmpeg filter fragment that produces an RGBA cutout stream from input index `idx`.
// STUDIO_FIGURE_SCALE=0.9 shrinks every figure 10%; STUDIO_EDGE=2 erodes the matte by 2px (0 disables)
const FIGURE = parseFloat(process.env.STUDIO_FIGURE_SCALE || "1") || 1;
const EDGE = Math.max(0, Math.min(4, parseInt(process.env.STUDIO_EDGE || "2", 10) || 0));

// Shrinks the alpha matte a pixel or two and feathers it so fringe (white halo in hair, etc.) disappears.
function edgeClean(src) {
  if (!EDGE) return `${src}`;
  const erode = Array.from({ length: EDGE }, () => "erosion").join(",");
  return `${src},split[rgb][al];[al]alphaextract,${erode},gblur=sigma=1.0[a2];[rgb][a2]alphamerge`;
}
async function cutoutStream(file, idx) {
  const info = await probe(file);
  if (info.alpha) return { filter: edgeClean(`[${idx}:v]format=rgba`), info };
  const key = await keyColor(file);
  if (key) return { filter: edgeClean(`[${idx}:v]format=rgba,chromakey=${key}:0.18:0.08,despill=type=green`), info };
  return { filter: `[${idx}:v]format=rgba`, info };   // no alpha, no key: place as-is
}

/**
 * composeShot({ setting, cutouts:[{file, chest:bool}], frame, outFile, label })
 * setting: path to the location/setting image (or null → dark gradient)
 * cutouts: up to 2 character images, first = foreground
 */
export async function composeShot({ setting, cutouts = [], frame = "MCU", outFile }) {
  const F = FRAMING[frame] || FRAMING.MCU;
  const inputs = [];
  const filters = [];
  // background
  if (setting && fs.existsSync(setting)) { inputs.push("-i", setting); filters.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=${cutouts.length ? 1.6 : 0.3}[bg]`); }
  else { inputs.push("-f", "lavfi", "-i", `color=c=0x2a2230:s=${W}x${H}`); filters.push(`[0:v]format=rgb24[bg]`); }
  let last = "[bg]";
  const n = Math.min(2, cutouts.length);
  for (let k = 0; k < n; k++) {
    const c = cutouts[k];
    inputs.push("-i", c.file);
    const idx = k + 1;
    const { filter, info } = await cutoutStream(c.file, idx);
    // figure height: the visible portion (crop from top) scaled so that it spans `scale` × frame height
    const isChest = c.chest;
    const cropFrac = isChest ? 1 : F.crop;           // chest-up images are used whole
    const visH = Math.round(info.h * cropFrac);
    const depth = n === 2 ? (k === 0 ? 1 : 0.82) : 1;              // foreground figure larger in a two-shot
    const baseScale = n === 2 ? Math.min(isChest ? F.chestScale : F.scale, 0.85) : (isChest ? F.chestScale : F.scale);   // two faces never both fill the frame
    const targetH = Math.round(H * baseScale * depth * FIGURE);
    const sc = targetH / visH;
    const outW = Math.round(info.w * sc), outH = Math.round(visH * sc);
    // single → centered; two-shot → foreground right of center, background left and slightly higher (depth)
    const x = n === 1 ? `(W-w)/2` : k === 0 ? `W*0.62-w/2` : `W*0.34-w/2`;
    const y = n === 2 && k === 1 ? `H-h-${Math.round(H * 0.06)}` : `H-h`;   // every cutout is bottom-anchored so its crop line is the frame edge; the back figure in a two-shot sits a little higher
    filters.push(`${filter},crop=iw:${visH}:0:0,scale=${outW}:${outH}[c${k}]`);
    filters.push(`${last}[c${k}]overlay=x=${x}:y=${y}:format=auto[o${k}]`);
    last = `[o${k}]`;
  }
  // vignette + light grade so cutouts sit in the plate
  filters.push(`${last}vignette=PI/5,eq=contrast=1.05:saturation=1.05,format=rgb24[out]`);
  await execFileP("ffmpeg", ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-frames:v", "1", outFile]);
  return outFile;
}

/** Pick cutout files for a shot from the refs map written by `refs`. */
export function cutoutsForShot(shot, refs, manifest) {
  const F = FRAMING[shot.frame] || FRAMING.MCU;
  const want = (shot.costume || "").split(";").map(x => x.trim()).filter(Boolean).reduce((m, pair) => { const [n, st] = pair.split(":").map(x => x.trim()); if (n && st) m[n.toLowerCase()] = st; return m; }, {});
  const out = [];
  // characters in the shot, falling back to whoever speaks in it
  let names = [...(shot.characters || [])];
  if (!names.length) for (const l of shot.lines || []) if (l.speaker && !names.includes(l.speaker)) names.push(l.speaker);
  for (const name of names) {
    const key = name.toLowerCase().replace(/\s*\(.*\)\s*$/, "").trim();   // drop "(V.O.)" / "(CONT'D)"
    const first = key.split(" ")[0];
    const c = manifest.cast.find(x => x.name.toLowerCase() === key) || manifest.cast.find(x => x.name.toLowerCase().split(" ")[0] === first);
    if (!c) continue;
    const states = Object.keys(refs.cutouts[c.name.toLowerCase()] || {});
    if (!states.length) continue;
    const st = want[key] && states.find(s => s.toLowerCase() === want[key].toLowerCase()) || states[0];
    const cu = refs.cutouts[c.name.toLowerCase()][st];
    const file = (F.prefer === "chest" && cu.chest) ? cu.chest : (cu.full || cu.chest);
    if (file) out.push({ file, chest: file === cu.chest && F.prefer === "chest", name: c.name, state: st });
  }
  return out;
}
