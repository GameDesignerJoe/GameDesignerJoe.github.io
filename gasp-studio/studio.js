#!/usr/bin/env node
// GASP Studio — stills-first production pipeline for GASP production manifests.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, parseArgs, readJSON, writeJSON, exists, pad2, shotKey, dataUriToFile, workDir, epDir, shotDir, pickEpisodes, audioDuration, log, warn, fontArg } from "./lib/util.js";
import { generateStill, generateVideo, lipsync, tts, music, sfx, estimate, registry, DRY } from "./providers/index.js";
import { assembleEpisode } from "./lib/assemble.js";
import { composeShot, cutoutsForShot } from "./lib/composite.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadEnv(ROOT);
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const file = args._[1];

const HELP = `GASP Studio — Gameplay · Animatic · Script · Production  (SlapCut compositor inside)
  studio serve                                     open the control panel in your browser (no more commands)
  studio plan      <manifest.json> [--ep 1,2]
  studio refs      <manifest.json>                 write reference images to work/<story>/refs/
  studio composite <manifest.json> --ep 1 [--force]  cutouts over setting images → approved stills, no AI, free
  studio stills    <manifest.json> --ep 1 [--takes 2] [--shot 3] [--image fal-seedream]
  studio approve   <manifest.json> --ep 1 --shot 3 --take 2
  studio vo        <manifest.json> --ep 1 [--tts elevenlabs|fal-minimax]
  studio beds      <manifest.json> --ep 1          ambience + music for the episode
  studio animate   <manifest.json> --ep 1 [--shot 3] [--video fal-kling]   image→video for animate/lipsync shots
  studio animatic  <manifest.json> --ep 1 [--no-captions]
  studio all       <manifest.json> --ep 1          stills (1 take, auto-approved) → vo → beds → animatic
Filters: --shot 1,3,5 (block numbers, as shown by plan)   --from 6 --until 13 (blocks 6–12 only; the cut contains just that range)
       --path 5=2,16=1  take option 2 at the choice at block 5, option 1 at block 16 (default: option 1 everywhere); conditional shots/lines follow that path
Env: FAL_KEY, ELEVENLABS_API_KEY, STUDIO_DRY_RUN=1 (placeholders, no network), STUDIO_FONT=/path/to/font.ttf`;

if (cmd === "serve") { const { serve } = await import("./lib/serve.js"); await serve({ root: ROOT, port: +args.port || 4747, open: !args.noopen }); await new Promise(() => {}); }
if (!cmd || !file || args.help) { console.log(HELP); process.exit(0); }
const manifest = readJSON(path.isAbsolute(file) ? file : path.resolve(process.cwd(), file));
if (manifest.format !== "gate-ten-production") { warn("Not a GASP production manifest (format field missing). Continuing anyway."); }
const eps = pickEpisodes(manifest, args);
// --shot 3  or  --shot 1,3,5   limits work to those block indexes;  --until 12  stops before block 12 (e.g. the first choice)
const shotFilter = args.shot ? String(args.shot).split(",").map(Number) : null;
// --path 5=1,16=2  → at the choice at block 5 take option 1, at block 16 take option 2 (1-based). Unlisted choices take option 1.
// Conditional shots/lines (cond: FLAG, !FLAG, A and B, Meter>=N) are kept or dropped along that path; meter tests are assumed true.
const pathChoice = Object.fromEntries(String(args.path || "").split(",").filter(Boolean).map(p => p.split("=").map(Number)));
function applyPath(ep) {
  const flags = new Set();
  const holds = c => String(c || "").split(/\s*(?:,|&&|\band\b)\s*/).filter(Boolean).every(t => { t = t.trim(); if (/[<>=]/.test(t)) return true; return t.startsWith("!") ? !flags.has(t.slice(1).trim()) : flags.has(t); });
  const out = [];
  for (const s of ep.shots) {
    if (s.interaction) {
      const n = pathChoice[s.index] || 1; const opt = (s.interaction.options || [])[n - 1];
      s.interaction.chosen = n;
      if (opt) { for (const f of [opt.flag, opt.setFlag, opt.set]) if (f) String(f).split(/[,\s]+/).forEach(x => x && flags.add(x.trim())); for (const m of String(opt.outcome || "").matchAll(/(?:sets?|set branch|branch)\s+([A-Z][A-Z0-9_]+)/g)) flags.add(m[1]); }
      out.push(s); continue;
    }
    if (!holds(s.cond)) continue;
    s.lines = (s.lines || []).filter(l => holds(l.cond));
    out.push(s);
  }
  ep.shots = out; ep.pathFlags = [...flags];
}
for (const ep of eps) applyPath(ep);
const until = args.until ? +args.until : null;   // stop before this block
const from = args.from ? +args.from : null;      // start at this block
const wanted = s => (!shotFilter || shotFilter.includes(s.index)) && (!until || s.index < until) && (!from || s.index >= from);
for (const ep of eps) if (until || from) ep.shots = ep.shots.filter(s => (!until || s.index < until) && (!from || s.index >= from));
const costFile = ep => path.join(epDir(manifest, ROOT, ep), `ep${ep.number}-cost.json`);
const addCost = (ep, kind, amt, note) => { const f = costFile(ep); const c = exists(f) ? readJSON(f) : { items: [], total: 0 }; c.items.push({ kind, amt: +amt.toFixed(4), note, at: new Date().toISOString() }); c.total = +(c.total + amt).toFixed(4); writeJSON(f, c); };

// ---------- refs ----------
function writeRefs() {
  const dir = path.join(workDir(manifest, ROOT), "refs"); fs.mkdirSync(dir, { recursive: true });
  const map = { cast: {}, locations: {}, settings: {}, items: {}, cutouts: {}, faces: {} };
  const put = (uri, name) => { if (!uri || !uri.startsWith("data:")) return null; const ext = /^data:image\/png/.test(uri) ? ".png" : ".jpg"; const f = path.join(dir, name.replace(/\.(jpg|png)$/, "") + ext); return dataUriToFile(uri, f); };
  for (const c of manifest.cast) { const f = put(c.portrait, `cast-${slugify(c.name)}.jpg`); if (f) map.cast[c.name.toLowerCase()] = f; (c.gallery || []).forEach((g, i) => put(g, `cast-${slugify(c.name)}-${i + 1}.jpg`));
    for (const [ex, uri] of Object.entries(c.faces || {})) { const f = put(uri, `face-${slugify(c.name)}-${slugify(ex)}.jpg`); if (f) (map.faces[c.name.toLowerCase()] = map.faces[c.name.toLowerCase()] || {})[ex.toLowerCase()] = f; }
    for (const [st, cu] of Object.entries(c.cutouts || {})) { const full = put(cu.full, `cut-${slugify(c.name)}-${slugify(st)}-full.png`); const chest = put(cu.chest, `cut-${slugify(c.name)}-${slugify(st)}-chest.png`); if (full || chest) { (map.cutouts[c.name.toLowerCase()] = map.cutouts[c.name.toLowerCase()] || {})[st] = { full, chest }; } } }
  for (const l of manifest.locations) { const f = put(l.reference, `loc-${slugify(l.name)}.jpg`); if (f) map.locations[l.name.toLowerCase()] = f; for (const st of l.settings || []) { const sf = put(st.reference, `loc-${slugify(l.name)}-${slugify(st.key)}.jpg`); if (sf) map.settings[`${l.name.toLowerCase()}|${st.key}`] = sf; } }
  for (const it of manifest.items) { const f = put(it.reference, `item-${slugify(it.name)}.jpg`); if (f) map.items[it.name.toLowerCase()] = f; }
  writeJSON(path.join(dir, "refs.json"), map);
  return map;
}
const slugify = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function loadRefs() { return writeRefs(); }   // always rebuilt from the manifest so new cutouts are never missed
function refsForShot(shot, refs) {
  const out = [];
  for (const n of shot.characters || []) {
    const key = n.toLowerCase(); const fullKey = Object.keys(refs.cast).find(k => k === key || k.split(" ")[0] === key.split(" ")[0]) || key;
    const ex = (shot.expressions || {})[n] || Object.entries(shot.expressions || {}).find(([k]) => k.toLowerCase().split(" ")[0] === key.split(" ")[0])?.[1];
    const face = ex && refs.faces?.[fullKey]?.[String(ex).toLowerCase()]; if (face) out.push(face);   // expression reference first: it carries the mood
    const f = refs.cast[fullKey]; if (f) out.push(f);
  }
  const loc = (shot.locationRef || shot.location || "").toLowerCase();
  const st = refs.settings[`${loc}|${shot.settingKey}`]; if (st) out.push(st); else if (refs.locations[loc]) out.push(refs.locations[loc]);
  for (const [name, f] of Object.entries(refs.items)) if ((shot.action || "").toLowerCase().includes(name.replace(/^the /, ""))) out.push(f);
  return out;
}

// ---------- commands ----------
const isPicture = s => !s.interaction && !s.orphanLine && (s.location || s.action);

async function cmdPlan() {
  log(`${manifest.story.title} — ${manifest.cast.length} cast, ${manifest.locations.length} locations, ${manifest.items.length} items. DRY_RUN=${DRY ? "on" : "off"}`);
  for (const ep of eps) {
    log(`\nEp ${ep.number} ${ep.title || ""} ${ep.gate ? "[" + ep.gate + "]" : ""} · ${ep.runningTime}s · music: ${ep.music || "—"}${ep.pathFlags?.length ? " · path flags: " + ep.pathFlags.join(", ") : ""}`);
    for (const s of ep.shots) {
      if (!wanted(s)) continue;
      if (s.interaction) log(`  #${pad2(s.index)} ◆ ${s.interaction.template}${s.interaction.type ? "/" + s.interaction.type : ""}  ${s.interaction.prompt || ""}`);
      else if (isPicture(s)) log(`  #${pad2(s.index)} ${s.frame || "?"} ${s.location}${s.time ? ", " + s.time : ""}${s.weather ? ", " + s.weather : ""} · ${s.duration}s · ${s.renderPlan} · ${(s.lines || []).length} line(s) · ${(s.characters || []).join(", ")}`);
    }
  }
  log("\nEstimate (two stills per shot; video only where the plan says animate/lipsync):");
  for (const r of estimate(manifest, eps)) log(`  Ep ${r.episode}: animatic ≈ $${r.animaticOnly} · with video ≈ $${r.withVideo} (${r.videoSeconds}s video, ${r.lipsyncSeconds}s lip-sync, ${r.voChars} VO chars)`);
  log(`Providers: image=${registry.image.default} video=${registry.video.default} tts=${registry.tts.default}`);
}

function settingFileFor(s, refs) { const loc = (s.locationRef || s.location || "").toLowerCase(); return refs.settings[`${loc}|${s.settingKey}`] || refs.locations[loc] || null; }
async function cmdComposite() {
  const refs = loadRefs(); let n = 0;
  for (const ep of eps) for (const s of ep.shots) {
    if (!isPicture(s) || !wanted(s)) continue;
    const dir = shotDir(manifest, ROOT, ep, s); const out = path.join(dir, "composite.png");
    const cuts = cutoutsForShot(s, refs, manifest); const setting = settingFileFor(s, refs);
    if (exists(path.join(dir, "staged.json")) && exists(out)) { if (!exists(path.join(dir, "approved.png"))) fs.copyFileSync(out, path.join(dir, "approved.png")); log(`Ep ${ep.number} shot #${pad2(s.index)} composite staged by hand in the app; kept`); n++; continue; }
    if (!cuts.length && !setting) { warn(`shot #${pad2(s.index)}: no cutouts or setting image; skipped`); continue; }
    if (!cuts.length) { const have = Object.keys(refs.cutouts || {}); warn(`shot #${pad2(s.index)}: no character cutouts matched. Shot characters: [${(s.characters || []).join(", ") || "none detected"}] · cutouts exist for: [${have.join(", ") || "nobody — add them under Cast → Cutouts for compositing, then re-export"}]`); }
    await composeShot({ setting, cutouts: cuts, frame: s.frame, outFile: out });
    if (!exists(path.join(dir, "approved.png")) || args.force) fs.copyFileSync(out, path.join(dir, "approved.png"));
    log(`Ep ${ep.number} shot #${pad2(s.index)} composite: ${cuts.map(c => c.name + " (" + c.state + (c.chest ? ", chest" : ", full") + ")").join(" + ") || "setting only"}${setting ? " over " + path.basename(setting) : ""}`); n++;
  }
  log(`${n} composites. Approved automatically unless an approved.png already existed (use --force to replace).`);
}
async function cmdStills() {
  const refs = loadRefs(); const takes = +(args.takes || 1);
  for (const ep of eps) for (const s of ep.shots) {
    if (!isPicture(s) || !wanted(s)) continue;
    const dir = shotDir(manifest, ROOT, ep, s);
    if (!args.approveLatest && exists(path.join(dir, "staged.json")) && (s.renderPlan === "composite" || s.renderOverride === "composite")) { if (!exists(path.join(dir, "approved.png"))) fs.copyFileSync(path.join(dir, "composite.png"), path.join(dir, "approved.png")); continue; }
    if (!args.approveLatest && (s.renderPlan === "composite" || s.renderOverride === "composite")) { const cuts = cutoutsForShot(s, refs, manifest); const setting = settingFileFor(s, refs); if (cuts.length || setting) { const out = path.join(dir, "composite.png"); await composeShot({ setting, cutouts: cuts, frame: s.frame, outFile: out }); if (!exists(path.join(dir, "approved.png"))) fs.copyFileSync(out, path.join(dir, "approved.png")); log(`Ep ${ep.number} shot #${pad2(s.index)} composite (no generation)`); continue; } }
    const prompt = stillPrompt(s);
    fs.writeFileSync(path.join(dir, "prompt.txt"), prompt);
    const existing = fs.readdirSync(dir).filter(f => /^take-\d+\.png$/.test(f)).length;
    for (let t = 1; t <= takes; t++) {
      const out = path.join(dir, `take-${existing + t}.png`);
      const compRef = exists(path.join(dir, "composite.png")) ? [path.join(dir, "composite.png")] : [];
      const r = await generateStill({ prompt: prompt + (compRef.length ? " The first reference image is the blocking guide: keep its framing, pose and placement exactly; the other references give the face, wardrobe and set." : ""), refs: [...compRef, ...refsForShot(s, refs)], outFile: out, provider: args.image, label: s.action, labelTitle: `#${pad2(s.index)} ${s.frame || ""} · ${s.location}${s.time ? ", " + s.time : ""}${s.weather ? ", " + s.weather : ""}` });
      addCost(ep, "still", r.cost, `shot ${s.index} take ${existing + t} ${r.provider}`);
      log(`Ep ${ep.number} shot #${pad2(s.index)} take ${existing + t} → ${path.relative(ROOT, out)}`);
      if (args.approveLatest || (!exists(path.join(dir, "approved.png")) && (args.auto || takes === 1))) fs.copyFileSync(out, path.join(dir, "approved.png"));
    }
  }
}
function stillPrompt(s) {
  // A still is the first frame of the shot: drop the motion/lip-sync language, keep the look.
  return s.videoPrompt.replace(/^Vertical 9:16 cinematic video, [^.]*\./, "Vertical 9:16 cinematic film still, photoreal, soap-opera drama lighting.")
    .replace(/Camera: [^.]*\./, "Composition: face in the upper two-thirds, lower third clear for captions.")
    .replace(/Lip sync: [^.]*\./, "").replace(/No dialogue; silent reaction shot\./, "")
    + (s.expressions && Object.keys(s.expressions).length ? ` Expressions: ${Object.entries(s.expressions).map(([k, v]) => `${k} shows ${v}, matching that character's expression reference image`).join("; ")}.` : "")
    + ` ${FRAME_WORDS[s.frame] || ""} ONE single full-bleed 9:16 frame only: no split screen, no collage, no grid, no panels, no borders, no text.`;
}
const FRAME_WORDS = { "ECU": "Extreme close-up: eyes and mouth fill the frame.", "CU": "Close-up: head and shoulders fill the frame, face large.", "MCU": "Medium close-up: chest up.", "MS": "Medium shot: waist up.", "OTS": "Over-the-shoulder close-up.", "2-shot (depth)": "Two-shot with depth: one figure near, one further back.", "insert (prop)": "Insert: the object fills the frame, shallow focus." };

function cmdApprove() {
  const ep = eps[0]; const s = ep.shots.find(x => x.index === +args.shot); if (!s) throw new Error("shot not found");
  const dir = shotDir(manifest, ROOT, ep, s); const src = path.join(dir, `take-${args.take}.png`); if (!exists(src)) throw new Error("take not found: " + src);
  fs.copyFileSync(src, path.join(dir, "approved.png")); log(`approved shot #${pad2(s.index)} take ${args.take}`);
}

async function cmdVO() {
  for (const ep of eps) { const dir = epDir(manifest, ROOT, ep);
    for (const s of ep.shots) for (const l of s.lines || []) {
      if (!wanted(s)) continue;
      const out = path.join(dir, `line-${shotKey(l)}.mp3`); const sig = path.join(dir, `line-${shotKey(l)}.txt`);
      const want = `${l.speaker}|${l.voice?.provider || ""}|${l.voice?.id || ""}|${l.text}`;
      if (exists(out) && !args.force && exists(sig) && fs.readFileSync(sig, "utf8") === want) continue;   // unchanged line: keep the take
      const r = await tts({ text: l.text, voice: { ...(l.voice || {}), speaker: l.speaker }, outFile: out, provider: args.tts });
      fs.writeFileSync(sig, want);
      addCost(ep, "vo", r.cost, `line ${l.index} ${l.speaker} ${r.provider}`);
      log(`Ep ${ep.number} line #${pad2(l.index)} ${l.speaker}: ${(await audioDuration(out)).toFixed(1)}s`);
    } }
}

async function cmdBeds() {
  for (const ep of eps) { const dir = epDir(manifest, ROOT, ep);
    const amb = ep.ambience || ep.shots.find(s => s.ambience)?.ambience;
    if (amb) { const out = path.join(dir, "ambience.mp3"); if (!exists(out) || args.force) { const r = await sfx({ prompt: `looping ambience bed: ${amb}`, seconds: 20, outFile: out }); addCost(ep, "ambience", r.cost, amb); log(`Ep ${ep.number} ambience: ${amb}`); } }
    if (ep.music) { const out = path.join(dir, "music.mp3"); if (!exists(out) || args.force) { const r = await music({ prompt: `${ep.music}. Instrumental, vertical drama score, no vocals.`, seconds: Math.max(30, ep.runningTime), outFile: out }); addCost(ep, "music", r.cost, ep.music); log(`Ep ${ep.number} music: ${ep.music}`); } }
    for (const s of ep.shots) if (s.audio && isPicture(s) && wanted(s)) { const out = path.join(shotDir(manifest, ROOT, ep, s), "sfx.mp3"); if (!exists(out) || args.force) { const r = await sfx({ prompt: s.audio, seconds: s.duration, outFile: out }); addCost(ep, "sfx", r.cost, `shot ${s.index} ${s.audio}`); } }
  }
}

async function cmdAnimate() {
  for (const ep of eps) for (const s of ep.shots) {
    if (!isPicture(s) || !["animate", "lipsync"].includes(s.renderPlan) || !wanted(s)) continue;
    const dir = shotDir(manifest, ROOT, ep, s); const still = path.join(dir, "approved.png"); if (!exists(still)) { warn(`shot #${s.index}: no approved still; run stills/approve first`); continue; }
    const secs = s.duration + (s.lines || []).reduce((a, l) => a + (l.duration || 0), 0);
    const clip = path.join(dir, "clip.mp4");
    const r = await generateVideo({ prompt: s.videoPrompt, still, seconds: secs, outFile: clip, provider: args.video });
    addCost(ep, "video", r.cost, `shot ${s.index} ${r.provider} ${secs}s`); log(`Ep ${ep.number} shot #${pad2(s.index)} clip (${r.provider})`);
    if (s.renderPlan === "lipsync" && (s.lines || []).length) {
      const vo = path.join(epDir(manifest, ROOT, ep), `line-${shotKey(s.lines[0])}.mp3`);
      if (exists(vo)) { const r2 = await lipsync({ video: clip, audio: vo, outFile: path.join(dir, "clip-lipsync.mp4") }); addCost(ep, "lipsync", r2.cost, `shot ${s.index}`); log(`  lip-synced to line #${pad2(s.lines[0].index)}`); }
      else warn(`shot #${s.index}: no VO for lip-sync yet (run vo)`);
    }
  }
}

async function cmdAnimatic() {
  for (const ep of eps) { const dir = epDir(manifest, ROOT, ep);
    const final = await assembleEpisode({ manifest, ep, dir, captions: !args["no-captions"], segmentsOnly: !!args.segonly,
      getStill: async s => { const d = shotDir(manifest, ROOT, ep, s); const a = path.join(d, "approved.png"); if (exists(a)) return a; warn(`shot #${s.index}: no approved still, using placeholder`); const ph = path.join(d, "placeholder.png"); await generateStillPlaceholder(ph, s); return ph; },
      getClip: async s => { const d = shotDir(manifest, ROOT, ep, s); for (const f of ["clip-lipsync.mp4", "clip.mp4"]) if (exists(path.join(d, f))) return path.join(d, f); return null; },
      getVO: async l => { const f = path.join(dir, `line-${shotKey(l)}.mp3`); if (exists(f)) return f; const ph = path.join(dir, `line-${shotKey(l)}-silent.mp3`); await silent(ph, l.duration || 2); return ph; },
      ambienceFile: path.join(dir, "ambience.mp3"), musicFile: path.join(dir, "music.mp3"),
      onProgress: (s, kind) => log(`  seg #${pad2(s.index)} ${kind}`) });
    if (!final) { log(`Ep ${ep.number}: segment(s) refreshed`); continue; }
    log(`Ep ${ep.number} → ${path.relative(ROOT, final)}`);
    const c = costFile(ep); if (exists(c)) log(`  spend so far: $${readJSON(c).total}`);
  }
}
async function generateStillPlaceholder(f, s) { const refs = loadRefs(); { const cuts = cutoutsForShot(s, refs, manifest); const setting = settingFileFor(s, refs); if (cuts.length || setting) { await composeShot({ setting, cutouts: cuts, frame: s.frame, outFile: f }); return; } } const { placeholderStill } = await import("./providers/index.js"); await placeholderStill(f, s.action || s.videoPrompt || "", refsForShot(s, refs), `#${pad2(s.index)} ${s.frame || ""} · ${s.location}`); }
async function silent(f, sec) { const { execFileP } = await import("./lib/util.js"); await execFileP("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(sec), "-q:a", "9", "-acodec", "libmp3lame", f]); }

const run = { plan: cmdPlan, composite: cmdComposite, refs: async () => { const m = writeRefs(); log(`refs: ${Object.keys(m.cast).length} cast, ${Object.values(m.cutouts || {}).reduce((a, c) => a + Object.keys(c).length, 0)} cutouts, ${Object.keys(m.locations).length} locations, ${Object.keys(m.settings).length} settings, ${Object.keys(m.items).length} items`); }, stills: cmdStills, approve: cmdApprove, vo: cmdVO, beds: cmdBeds, animate: cmdAnimate, animatic: cmdAnimatic,
  all: async () => { args.takes = args.takes || 1; args.auto = true; if (DRY) { args.force = true; await cmdComposite(); } else await cmdStills(); await cmdVO(); await cmdBeds(); await cmdAnimatic(); } };
if (!run[cmd]) { console.log(HELP); process.exit(1); }
run[cmd]().catch(e => { console.error("error:", e.message); process.exit(1); });
