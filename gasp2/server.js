// GASP 2.0 local server: serves the app, owns the library folder on disk, runs generations in the background.
// node server.js [--port 4848] [--noopen]      GASP_DRY=1 → no network calls, placeholder videos.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { imageToVideo, generateImages, removeBackground, ffmpeg } from "./lib/fal.js";
import { chatCall, splitActions, systemPrompt, dryReply, CHAT_MODELS } from "./lib/chat.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const PORT = +(argv[argv.indexOf("--port") + 1] || 0) || 4848;
const MODELS = JSON.parse(fs.readFileSync(path.join(ROOT, "models.json"), "utf8"));
// the script format is shared with the app (app/script.js defines one global)
const SF = new Function(fs.readFileSync(path.join(ROOT, "app", "script.js"), "utf8") + "\nreturn GASPScript;")();

// ---------- keys and settings ----------
// Keys: gasp2/.env first; anything missing is borrowed from GASP 1.0's .env so existing keys just work.
const KEY_NAMES = ["FAL_KEY", "GROQ_API_KEY", "ELEVENLABS_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"];
function readEnv(f) { const o = {}; try { for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {} return o; }
function loadKeys() { const own = readEnv(path.join(ROOT, ".env")), old = readEnv(path.join(ROOT, "..", "gasp-studio", ".env")); for (const k of KEY_NAMES) { const v = own[k] || old[k]; if (v) process.env[k] = v; } return { own, old }; }
loadKeys();
function saveKeys(updates) {
  const f = path.join(ROOT, ".env"); const cur = readEnv(f);
  for (const [k, v] of Object.entries(updates || {})) { if (!KEY_NAMES.includes(k)) continue; if (v === null || v === "") { delete cur[k]; delete process.env[k]; } else { cur[k] = String(v).trim(); process.env[k] = cur[k]; } }
  fs.writeFileSync(f, "# GASP 2 keys. This file is git-ignored: it never goes to GitHub.\n" + Object.entries(cur).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  loadKeys();
}
const SETTINGS_FILE = path.join(ROOT, "settings.json");
function settings() { let s = {}; try { s = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")); } catch {} return { ...s, library: s.library || path.join(os.homedir(), "GASP Library"), defaultVideo: MODELS.video[s.defaultVideo] ? s.defaultVideo : MODELS.defaultVideo, defaultImage: MODELS.image[s.defaultImage] ? s.defaultImage : MODELS.defaultImage, defaultCutout: MODELS.cutout[s.defaultCutout] ? s.defaultCutout : MODELS.defaultCutout }; }
function saveSettings(patch) { const s = { ...settings(), ...patch }; fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); return s; }
const LIB = () => settings().library;

// ---------- library on disk ----------
// GASP Library\Reference\..., Stories\<Story>\story.json + script.txt, Stories\<Story>\EpNN - Title\Shot NN - Title\{keyframe.*, video.mp4, takes\}, _Trash\, spend-log.csv
const clean = (s, max = 60) => String(s || "").replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max).replace(/[. ]+$/, "") || "Untitled";
const pad = n => String(n).padStart(2, "0");
const newId = () => crypto.randomBytes(5).toString("hex");
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; };
const storiesDir = () => path.join(LIB(), "Stories");
function ensureLibrary() { for (const d of ["Reference/Characters", "Reference/Locations", "Reference/Props", "Stories", "_Trash"]) fs.mkdirSync(path.join(LIB(), d), { recursive: true }); }

function listStories() {
  ensureLibrary(); const out = [];
  for (const d of fs.readdirSync(storiesDir(), { withFileTypes: true })) { if (!d.isDirectory()) continue; const f = path.join(storiesDir(), d.name, "story.json"); try { const s = JSON.parse(fs.readFileSync(f, "utf8")); out.push({ id: s.id, title: s.title, dir: d.name, updated: s.updated || 0, opened: s.opened || 0, episodes: (s.episodes || []).length, shots: (s.episodes || []).reduce((a, e) => a + e.shots.length, 0) }); } catch {} }
  return out.sort((a, b) => Math.max(b.opened, b.updated) - Math.max(a.opened, a.updated));
}
function findStoryDir(id) { for (const d of fs.readdirSync(storiesDir(), { withFileTypes: true })) { if (!d.isDirectory()) continue; try { const s = JSON.parse(fs.readFileSync(path.join(storiesDir(), d.name, "story.json"), "utf8")); if (s.id === id) return d.name; } catch {} } return null; }
function loadStory(id) { const dir = findStoryDir(id); if (!dir) throw httpErr(404, "story not found"); const s = JSON.parse(fs.readFileSync(path.join(storiesDir(), dir, "story.json"), "utf8")); s.dir = dir; return s; }
// Writes story.json, renaming folders to match titles and order. Each episode/shot remembers its folder name, so renames are safe.
function saveStory(s) {
  s.updated = Date.now();
  const want = clean(s.title);
  if (s.dir !== want && !fs.existsSync(path.join(storiesDir(), want))) { if (tryRename(path.join(storiesDir(), s.dir), path.join(storiesDir(), want))) s.dir = want; }
  const sd = path.join(storiesDir(), s.dir);
  s.episodes.forEach((ep, i) => {
    ep.num = i + 1; const epWant = `Ep${pad(ep.num)} - ${clean(ep.title || "Episode " + ep.num)}`;
    if (!ep.dir) { ep.dir = epWant; fs.mkdirSync(path.join(sd, ep.dir), { recursive: true }); }
    else if (ep.dir !== epWant) renameSafe(sd, ep, epWant);
    const ed = path.join(sd, ep.dir);
    // two passes so swapping Shot 02 and Shot 03 never collides
    ep.shots.forEach((sh, j) => { const w = `Shot ${pad(j + 1)} - ${clean(sh.title || "Untitled")}`; if (sh.dir && sh.dir !== w && fs.existsSync(path.join(ed, sh.dir))) { const tmp = `~${sh.id}`; if (tryRename(path.join(ed, sh.dir), path.join(ed, tmp))) sh.dir = tmp; } });
    ep.shots.forEach((sh, j) => { const w = `Shot ${pad(j + 1)} - ${clean(sh.title || "Untitled")}`; if (!sh.dir || !fs.existsSync(path.join(ed, sh.dir))) { sh.dir = w; fs.mkdirSync(path.join(ed, w, "takes"), { recursive: true }); } else if (sh.dir !== w && !fs.existsSync(path.join(ed, w))) { if (tryRename(path.join(ed, sh.dir), path.join(ed, w))) sh.dir = w; } fs.mkdirSync(path.join(ed, sh.dir, "takes"), { recursive: true }); });
  });
  const out = { ...s }; delete out.dir;
  fs.writeFileSync(path.join(sd, "story.json"), JSON.stringify(out, null, 2));
  return s;
}
function renameSafe(parent, obj, want) { let w = want, k = 2; while (fs.existsSync(path.join(parent, w)) && w !== obj.dir) w = `${want} (${k++})`; if (!fs.existsSync(path.join(parent, obj.dir)) || tryRename(path.join(parent, obj.dir), path.join(parent, w))) obj.dir = w; }
// Windows refuses to rename a folder while a file in it is open (a video playing, Explorer previewing): keep the old name and try again on the next save
function tryRename(a, b) { try { fs.renameSync(a, b); return true; } catch (e) { console.log(`rename later: ${path.basename(a)} → ${path.basename(b)} (${e.code})`); return false; } }
function createStory(title) {
  ensureLibrary(); let dir = clean(title), k = 2; while (fs.existsSync(path.join(storiesDir(), dir))) dir = `${clean(title)} (${k++})`;
  fs.mkdirSync(path.join(storiesDir(), dir), { recursive: true });
  const s = { id: newId(), title: dir, created: Date.now(), opened: Date.now(), dir, episodes: [{ id: newId(), title: "Episode 1", shots: [] }] };
  return saveStory(s);
}
const epOf = (s, epId) => { const e = s.episodes.find(x => x.id === epId); if (!e) throw httpErr(404, "episode not found"); return e; };
const shotOf = (ep, id) => { const x = ep.shots.find(q => q.id === id); if (!x) throw httpErr(404, "shot not found"); return x; };
const shotPath = (s, ep, sh) => path.join(storiesDir(), s.dir, ep.dir, sh.dir);
const rel = abs => path.relative(LIB(), abs).split(path.sep).join("/");
const fileUrl = abs => "/lib/" + rel(abs).split("/").map(encodeURIComponent).join("/") + "?v=" + Math.round(fs.statSync(abs).mtimeMs).toString(36);

// what a shot has made, for the app: in-use files plus every take, newest first
function shotMedia(s, ep, sh) {
  const d = shotPath(s, ep, sh); const takesDir = path.join(d, "takes"); let takes = [];
  try { takes = fs.readdirSync(takesDir).filter(f => /\.(png|jpe?g|webp|mp4)$/i.test(f)).map(f => { const abs = path.join(takesDir, f); return { file: f, kind: /\.mp4$/i.test(f) ? "video" : "keyframe", url: fileUrl(abs), at: fs.statSync(abs).mtimeMs, inUse: f === sh.keyframeTake || f === sh.videoTake }; }).sort((a, b) => b.at - a.at); } catch {}
  const kf = sh.keyframeTake && fs.existsSync(path.join(takesDir, sh.keyframeTake)) ? fileUrl(path.join(takesDir, sh.keyframeTake)) : null;
  const vid = sh.videoTake && fs.existsSync(path.join(takesDir, sh.videoTake)) ? fileUrl(path.join(takesDir, sh.videoTake)) : null;
  return { keyframe: kf, video: vid, takes };
}
function storyForApp(s) { return { ...s, styleImages: (s.styleRefs || []).filter(f => fs.existsSync(path.join(storiesDir(), s.dir, "Style", f))).map(f => ({ file: f, url: fileUrl(path.join(storiesDir(), s.dir, "Style", f)) })), episodes: s.episodes.map(ep => ({ ...ep, shots: ep.shots.map(sh => ({ ...sh, media: shotMedia(s, ep, sh), job: Object.values(JOBS).find(j => j.shot === sh.id && j.status === "running") || null })) })) }; }

// ---------- scripts: one script.txt per episode folder; old versions kept in "script history" ----------
const scriptPath = (s, ep) => path.join(storiesDir(), s.dir, ep.dir, "script.txt");
function readScript(s, ep) { try { return fs.readFileSync(scriptPath(s, ep), "utf8").replace(/\r/g, ""); } catch { return ""; } }
const SNAP = {};
function writeScript(s, ep, text, snapshot) {
  text = SF.withHeader(text, s.title, ep.num, ep.title);
  const f = scriptPath(s, ep); const old = readScript(s, ep); if (old === text) return;
  const key = s.id + ep.id; if (old.trim() && (snapshot || Date.now() - (SNAP[key] || 0) > 10 * 60e3)) { const h = path.join(path.dirname(f), "script history"); fs.mkdirSync(h, { recursive: true }); fs.writeFileSync(path.join(h, `${stamp()}.txt`), old.replace(/\n/g, "\r\n")); SNAP[key] = Date.now(); }
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text.replace(/\r?\n/g, "\r\n"));
}
// keep the script in step with edits made in Shots (only once the script has linked shots)
function scriptEdit(s, ep, fn) { const t = readScript(s, ep); if (!/\[\[#[a-z0-9]+\]\]/i.test(t)) return; const n = fn(t); if (n !== t) writeScript(s, ep, n, false); }
function syncScript(s, ep, text, orphanMode) {
  const p = SF.parse(text); const byId = Object.fromEntries(ep.shots.map(x => [x.id, x])); const seen = new Set(); let created = 0, updated = 0; const createdIds = [];
  const ordered = [];
  for (const b of p.blocks) {
    let sh = b.id && byId[b.id] && !seen.has(b.id) ? byId[b.id] : null;
    if (!sh) { sh = { id: newId(), show: "keyframe", notes: "" }; text = SF.stampId(text, b, sh.id); created++; createdIds.push(sh.id); } else updated++;
    seen.add(sh.id);
    Object.assign(sh, { title: b.title, frame: b.frame, location: b.location, scene: b.scene, imagePrompt: b.image, motionPrompt: b.motion, who: b.who, lines: b.lines, sfx: b.sfx, action: b.action });
    if (b.notes) sh.notes = b.notes; if (b.seconds) sh.seconds = b.seconds;
    ordered.push(sh);
  }
  let orphans = ep.shots.filter(x => !seen.has(x.id));
  if (orphanMode === "trash") { for (const o of orphans) { try { toTrash(shotPath(s, ep, o), `${s.title} - ${ep.dir} - ${o.dir}`); } catch {} } orphans = []; }
  // grid-only shots keep their place relative to their neighbours
  const result = [...ordered];
  for (const o of orphans) { const orig = ep.shots.indexOf(o); let prev = null; for (let k = orig - 1; k >= 0; k--) if (result.includes(ep.shots[k])) { prev = ep.shots[k]; break; } result.splice(prev ? result.indexOf(prev) + 1 : 0, 0, o); if (orphanMode === "add") text = SF.insertBlock(text, prev ? prev.id : null, o); }
  ep.shots = result; text = SF.renumber(text); ep.aspect = p.aspect || ""; ep.style = p.style || ""; ep.cast = SF.castOf(text);
  return { text, created, updated, createdIds, orphans: orphanMode === "add" ? [] : orphans.map(o => ({ id: o.id, title: o.title })) };
}

function updateShot(s, ep, sh, f) {
  for (const k of ["title", "imagePrompt", "motionPrompt", "notes", "model", "seconds", "show", "imageModel", "imageCount", "refPick"]) if (k in f) sh[k] = f[k];
  scriptEdit(s, ep, t => { if ("imagePrompt" in f) t = SF.setField(t, sh.id, "image", f.imagePrompt); if ("motionPrompt" in f) t = SF.setField(t, sh.id, "motion", f.motionPrompt); if ("notes" in f) t = SF.setField(t, sh.id, "note", f.notes); if ("title" in f || "seconds" in f) t = SF.setCallout(t, sh.id, { title: sh.title, seconds: sh.seconds || null }); return t; });
}

// ---------- chat: one conversation per story, kept in its folder ----------
const chatFile = s => path.join(storiesDir(), s.dir, "chat.json");
function readChat(s) { try { return JSON.parse(fs.readFileSync(chatFile(s), "utf8")); } catch { return { messages: [] }; } }
function writeChat(s, c) { fs.writeFileSync(chatFile(s), JSON.stringify(c, null, 1)); }
function chatSetting() { const st = settings(); if (st.chat && st.chat.model) return st.chat; return process.env.FAL_KEY || !process.env.GROQ_API_KEY ? { provider: "fal", model: CHAT_MODELS[0].model } : { provider: "groq", model: "openai/gpt-oss-120b" }; }
const chatForApp = (c, s) => ({ messages: c.messages.map((m, i) => ({ i, cutOff: m.cutOff, role: m.role, text: m.role === "assistant" ? splitActions(m.content).shown : m.content, attachments: (m.attachments || []).map(x => ({ ...x, url: x.file && s ? fileUrl(path.join(chatFilesDir(s), x.file)) : null })), actions: m.actions || [], at: m.at, model: m.model, cost: m.cost, error: m.error, ep: m.ep })) });
function applyAction(s, ep, a) {
  if (a.action === "update_shot") {
    const sh = ep.shots.find(x => x.id === a.shot); if (!sh) throw httpErr(404, "That shot isn't in this episode any more.");
    const f = {}; for (const k of ["title", "imagePrompt", "motionPrompt", "notes"]) if (a.fields && k in a.fields) f[k] = String(a.fields[k]);
    const undo = Object.fromEntries(Object.keys(f).map(k => [k, sh[k] || ""])); updateShot(s, ep, sh, f); return { undo };
  }
  if (a.action === "replace_script" || a.action === "append_script") {
    const old = readScript(s, ep); const add = String(a.text || "").replace(/\r/g, "");
    const text = a.action === "replace_script" ? add : (old.trim() ? old.replace(/\s+$/, "") + "\n\n" + add : add);
    writeScript(s, ep, text, true); const r = syncScript(s, ep, text, "keep"); writeScript(s, ep, r.text, false);
    return { undoScript: old, createdIds: r.createdIds, created: r.created, updated: r.updated, orphans: r.orphans.length };
  }
  if (a.action === "update_ref") {
    const kind = KINDS[a.kind] ? a.kind : "character"; const name = clean(a.name || ""); if (!a.name) throw httpErr(400, "The card has no name.");
    const nm = name.toLowerCase(); let c = readCards().find(x => x.kind === kind && (x.name.toLowerCase() === nm || (x.aliases || []).some(y => y.toLowerCase() === nm)));
    let created = false; if (!c) { c = createCard(kind, name); created = true; }
    const undo = { card: c.id, created }; if ("look" in a && a.look != null) { undo.look = c.look || ""; c.look = String(a.look); }
    if (a.prompt) { const want = String(a.image || "").trim().toLowerCase(); let im = (want && c.images.find(x => !x.art && x.label.toLowerCase() === want)) || (!want && c.images.find(x => !x.art));
      if (!im) { im = { id: newId(), label: clean(a.image || FIRST_IMAGE[kind], 40), takes: [], take: null }; c.images.push(im); undo.newImage = im.id; }
      undo.image = im.id; undo.prompt = im.prompt; im.prompt = String(a.prompt); }
    saveCard(c); return { undoRef: undo };
  }
  if (a.action === "update_look") {
    const undoLook = { world: s.world || "", artDirection: s.artDirection || "" };
    if (a.world != null) s.world = String(a.world); if (a.artDirection != null) s.artDirection = String(a.artDirection); saveStory(s); return { undoLook };
  }
  throw httpErr(400, "GASP can't apply that kind of change.");
}

// The take in use is also copied to the top of the shot folder (keyframe.png / video.mp4), so browsing in Explorer shows it first.
function setInUse(s, ep, sh, take) {
  const d = shotPath(s, ep, sh); const src = path.join(d, "takes", take); if (!fs.existsSync(src)) throw httpErr(404, "take not found");
  if (/\.mp4$/i.test(take)) { sh.videoTake = take; fs.copyFileSync(src, path.join(d, "video.mp4")); sh.show = "video"; }
  else { sh.keyframeTake = take; for (const f of fs.readdirSync(d)) if (/^keyframe\.(png|jpe?g|webp)$/i.test(f)) fs.unlinkSync(path.join(d, f)); fs.copyFileSync(src, path.join(d, "keyframe" + path.extname(take).toLowerCase())); if (!sh.videoTake) sh.show = "keyframe"; }
}
function toTrash(abs, label) {
  const t = path.join(LIB(), "_Trash", `${stamp()} ${clean(label, 150)}`); fs.mkdirSync(path.dirname(t), { recursive: true });
  try { fs.renameSync(abs, t); } catch { fs.cpSync(abs, t, { recursive: true }); fs.rmSync(abs, { recursive: true, force: true }); }
  return t;
}


// ---------- reference cards: Reference\<Characters|Locations|Props>\<Name>\ card.json, "<image label>.png" in use, takes\ ----------
// A card = a name, a look (the exact words prompts reuse), a voice, and images ("full body", "face", "outfit - …", "night"…).
// Each image keeps every version in takes\; the one in use is copied to the top of the card folder so Explorer shows it.
const KINDS = { character: "Characters", location: "Locations", prop: "Props" };
const FIRST_IMAGE = { character: "full body", location: "set", prop: "prop" };
const IMG = /\.(png|jpe?g|webp)$/i;
const kindDir = k => path.join(LIB(), "Reference", KINDS[k]);
const cardPath = c => path.join(kindDir(c.kind), c.dir);
function readCards() {
  ensureLibrary(); const out = [];
  for (const kind of Object.keys(KINDS)) for (const d of fs.readdirSync(kindDir(kind), { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === "takes") continue; const abs = path.join(kindDir(kind), d.name); let c = null, dirty = false;
    try { c = JSON.parse(fs.readFileSync(path.join(abs, "card.json"), "utf8")); } catch { c = { id: newId(), name: d.name, aliases: [], look: "", voice: "", images: [], created: Date.now() }; dirty = true; }
    c.kind = kind; c.dir = d.name; c.images = c.images || [];
    // images put in the folder by hand (from Explorer or ChatGPT downloads) become images on the card
    const inUse = new Set(c.images.map(im => im.take && topName(im)));
    for (const f of fs.readdirSync(abs)) { if (!IMG.test(f) || inUse.has(f)) continue; fs.mkdirSync(path.join(abs, "takes"), { recursive: true }); const take = `${stamp()} ${clean(f.replace(IMG, ""))} - dropped in${path.extname(f).toLowerCase()}`; fs.renameSync(path.join(abs, f), path.join(abs, "takes", take)); const im = { id: newId(), label: clean(f.replace(IMG, ""), 40), takes: [take], take: null }; c.images.push(im); setImageInUse(c, im, take, abs); dirty = true; }
    if (dirty) writeCard(c);
    out.push(c);
  }
  return out;
}
const topName = im => `${clean(im.label || "image", 50)}${path.extname(im.take || ".png").toLowerCase()}`;
function writeCard(c) { const abs = cardPath(c); fs.mkdirSync(path.join(abs, "takes"), { recursive: true }); const o = { ...c }; delete o.kind; delete o.dir; fs.writeFileSync(path.join(abs, "card.json"), JSON.stringify(o, null, 2)); }
function findCard(id) { const c = readCards().find(x => x.id === id); if (!c) throw httpErr(404, "That reference card isn't there any more."); return c; }
const imageOf = (c, id) => { const im = c.images.find(x => x.id === id); if (!im) throw httpErr(404, "That image isn't on the card any more."); return im; };
function setImageInUse(c, im, take, abs = cardPath(c)) {
  if (im.take) { const old = path.join(abs, topName(im)); try { fs.unlinkSync(old); } catch {} }
  im.take = take; if (take) fs.copyFileSync(path.join(abs, "takes", take), path.join(abs, topName(im)));
}
function saveCard(c) {
  const want = clean(c.name);
  if (c.dir !== want && !fs.existsSync(path.join(kindDir(c.kind), want)) && tryRename(cardPath(c), path.join(kindDir(c.kind), want))) c.dir = want;
  writeCard(c); return c;
}
function createCard(kind, name) {
  if (!KINDS[kind]) throw httpErr(400, "kind must be character, location or prop"); ensureLibrary();
  let dir = clean(name), k = 2; while (fs.existsSync(path.join(kindDir(kind), dir))) dir = `${clean(name)} (${k++})`;
  const c = { id: newId(), kind, dir, name: dir, aliases: [], look: "", voice: "", images: [{ id: newId(), label: FIRST_IMAGE[kind], takes: [], take: null }], created: Date.now() };
  fs.mkdirSync(path.join(kindDir(kind), dir, "takes"), { recursive: true }); writeCard(c); return c;
}
function addCardTake(c, im, buf, ext, source) {
  const take = `${stamp()} ${clean(im.label, 40)} - ${clean(source || "upload", 40)}.${ext}`; fs.writeFileSync(path.join(cardPath(c), "takes", take), buf);
  im.takes.push(take); return take;
}
function cardForApp(c) {
  const abs = cardPath(c);
  return { id: c.id, kind: c.kind, name: c.name, aliases: c.aliases || [], look: c.look || "", voice: c.voice || "",
    images: c.images.map(im => ({ id: im.id, label: im.label, prompt: im.prompt, framing: im.framing, notes: im.notes, change: im.change, xrefs: im.xrefs || [], thread: (im.thread || []).map(t => ({ ...t, extraUrls: (t.extras || []).map(f => fileUrl(path.join(abs, "takes", "extras", f))) })), art: !!(im.art || /^my art\b/i.test(im.label)), url: im.take && fs.existsSync(path.join(abs, "takes", im.take)) ? fileUrl(path.join(abs, "takes", im.take)) : null,
      takes: im.takes.filter(t => fs.existsSync(path.join(abs, "takes", t))).map(t => ({ file: t, url: fileUrl(path.join(abs, "takes", t)), inUse: t === im.take, kind: "image" })).reverse() })) };
}
const refsForApp = () => readCards().map(cardForApp).sort((a, b) => a.name.localeCompare(b.name));
// reference picks → image files, in order. A pick is {card, image} or {shot} (another shot's keyframe in this episode)
function resolveRefs(picks, s, ep) {
  const cards = picks && picks.length ? readCards() : []; const out = [];
  for (const p of picks || []) {
    if (p.style && p.story) { try { const st = loadStory(p.story); const f = path.join(storiesDir(), st.dir, "Style", path.basename(p.style)); if (fs.existsSync(f)) out.push({ file: f, kind: "style" }); } catch {} continue; }
    if (p.shot && s && ep) { const sh = ep.shots.find(x => x.id === p.shot); if (sh && sh.keyframeTake) out.push({ file: path.join(shotPath(s, ep, sh), "takes", sh.keyframeTake), kind: "shot" }); continue; }
    const c = cards.find(x => x.id === p.card); if (!c) continue;
    if (p.extra) { const f = path.join(cardPath(c), "takes", "extras", path.basename(p.extra)); if (fs.existsSync(f)) out.push({ file: f, kind: "extra" }); continue; }
    const im = c.images.find(x => x.id === p.image) || c.images.find(x => x.take);
    const take = im && (p.take && im.takes.includes(path.basename(p.take)) ? path.basename(p.take) : im.take);
    if (take) out.push({ file: path.join(cardPath(c), "takes", take), kind: p.asStyle ? "style" : c.kind, look: c.look, label: im.label });
  }
  return out;
}
// what each reference image is for, so the model knows which picture to copy what from (names never go in: image models don't know them)
function refLegend(refs, sameSubject, edit) {
  if (!refs.length) return "";
  if (edit) return "Reference images: image 1 is the image to change: keep everything the instructions don't mention (the person, pose, framing, background)" + (refs.length > 1 ? "; " + refs.slice(1).map((r, k) => `image ${k + 2} ${r.kind === "extra" ? "is an extra picture the instructions refer to: take from it only what they say" : r.kind === "style" ? "is a style reference: redraw image 1 in its drawing, colouring and lighting style, without copying who or what is in it" : "shows the same subject, for its look"}`).join("; ") : "") + ".";
  const what = r => r.kind === "style" ? "a style reference: copy only how it's drawn, coloured and lit, not who or what is in it" : sameSubject ? "the same subject: keep who or what it is (face, hair and build for a person; shape and design for a place or object)"
    : r.kind === "character" ? `a character${r.look ? ` (${r.look})` : ""}: keep this person's face, hair, build and outfit exactly`
    : r.kind === "location" ? "the location: match this place, its layout and its key details"
    : r.kind === "prop" ? `a prop${r.look ? ` (${r.look})` : ""}: match it exactly`
    : "the previous shot: match its lighting, palette and rendering style";
  return "Reference images: " + refs.map((r, i) => `image ${i + 1} is ${what(r)}`).join("; ") + ".";
}


// ---------- chat attachments: images, text (PDF text is pulled out in the app), and links found in the message ----------
const chatFilesDir = s => path.join(storiesDir(), s.dir, "chat files");
const MAX_TEXT = 60000;
function saveAttachment(s, a) {
  const dir = chatFilesDir(s); fs.mkdirSync(dir, { recursive: true }); const nm = clean(String(a.name || "attachment").replace(/\.[a-z0-9]+$/i, ""), 60);
  if (a.data && /^data:image\//.test(a.data)) { const { ext, buf } = dataUri(a.data); const f = `${stamp()} ${nm}.${ext}`; fs.writeFileSync(path.join(dir, f), buf); return { kind: "image", name: a.name || f, file: f }; }
  if (typeof a.text === "string") { const f = `${stamp()} ${nm}.txt`; const t = a.text.slice(0, MAX_TEXT); fs.writeFileSync(path.join(dir, f), t); return { kind: "text", name: a.name || f, file: f, chars: t.length, cut: a.text.length > MAX_TEXT, from: a.from || "file" }; }
  throw httpErr(400, `GASP can't read ${a.name || "that file"} yet: attach images, PDFs or text files.`);
}
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/g;
async function fetchLink(url) {
  let u = url, label = "Web page"; const g = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);
  if (g) { label = { document: "Google Doc", spreadsheets: "Google Sheet", presentation: "Google Slides" }[g[1]]; u = `https://docs.google.com/${g[1]}/d/${g[2]}/export?format=${g[1] === "spreadsheets" ? "csv" : "txt"}`; if (g[1] === "presentation") u = `https://docs.google.com/presentation/d/${g[2]}/export/txt`; }
  else if (/drive\.google\.com\/file\/d\//.test(url)) return { kind: "link", name: url, label: "Google Drive file", error: "GASP can't open Drive files from a link. Download it and attach it instead (📎)." };
  if (process.env.GASP_DRY) return { kind: "link", name: url, label, text: `(dry run: ${label} not fetched)` };
  let r; try { r = await fetch(u, { signal: AbortSignal.timeout(20000), redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 GASP" } }); } catch (e) { return { kind: "link", name: url, label, error: `Couldn't open the link (${(e.cause && e.cause.code) || e.message}).` }; }
  if (/accounts\.google\.com|ServiceLogin/.test(r.url) || (g && /text\/html/.test(r.headers.get("content-type") || ""))) return { kind: "link", name: url, label, error: `That ${label} isn't shared with "Anyone with the link", so GASP can't read it. Share it that way, or download it as a PDF and attach it.` };
  if (!r.ok) return { kind: "link", name: url, label, error: `The link answered ${r.status} ${r.statusText}.` };
  const type = r.headers.get("content-type") || ""; if (/pdf|image|octet-stream|zip/.test(type)) return { kind: "link", name: url, label, error: "That link is a file, not a page. Download it and attach it instead (📎)." };
  let t = await r.text(); let title = "";
  if (/html/.test(type)) { title = ((t.match(/<title[^>]*>([^<]*)/i) || [])[1] || "").trim(); t = t.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*/g, "\n\n").trim(); }
  return { kind: "link", name: url, label, title, text: t };
}
async function linkAttachments(s, msg) {
  const urls = [...new Set(msg.match(URL_RE) || [])].slice(0, 4); const out = [];
  for (const url of urls) { const r = await fetchLink(url); if (r.text != null) { const a = saveAttachment(s, { name: r.title || r.label, text: r.text, from: url }); out.push({ ...a, kind: "link", label: r.label, url }); } else out.push({ kind: "link", name: url, label: r.label, url, error: r.error }); }
  return out;
}
// smaller copies of images for the model (long side 1568px, JPEG), made once
async function modelImage(s, file) {
  const src = path.join(chatFilesDir(s), file), small = path.join(chatFilesDir(s), ".small", file.replace(/\.[a-z]+$/i, ".jpg"));
  if (!fs.existsSync(small)) { fs.mkdirSync(path.dirname(small), { recursive: true }); try { await ffmpeg(["-i", src, "-vf", "scale='min(1568,iw)':'min(1568,ih)':force_original_aspect_ratio=decrease", "-q:v", "3", "-frames:v", "1", small]); } catch { fs.copyFileSync(src, small); } }
  return "data:image/jpeg;base64," + fs.readFileSync(small).toString("base64");
}
// one user turn for the model: its text, the text of its attachments, and (for recent turns) its images
async function userContent(s, m, withImages) {
  const atts = m.attachments || []; if (!atts.length) return m.content;
  let text = m.content;
  for (const a of atts) {
    if (a.kind === "image") { if (!withImages) text += `\n\n(An image was attached earlier: ${a.name}.)`; continue; }
    if (a.error) { text += `\n\n(The link ${a.url} couldn't be read: ${a.error})`; continue; }
    let body = ""; try { body = fs.readFileSync(path.join(chatFilesDir(s), a.file), "utf8"); } catch {}
    text += `\n\n--- Attached ${a.kind === "link" ? (a.label || "page") + " " + a.url : "file " + a.name}${a.cut ? " (cut to the first " + MAX_TEXT + " characters)" : ""} ---\n${body}\n--- end of ${a.name} ---`;
  }
  const imgs = withImages ? atts.filter(a => a.kind === "image") : []; if (!imgs.length) return text;
  const parts = [{ type: "text", text }]; for (const a of imgs) { try { parts.push({ type: "image_url", image_url: { url: await modelImage(s, a.file) } }); } catch {} }
  return parts;
}


// cards the story's scripts seem to need: names on WHO: lines and speakers, CAST entries in the brief, SHOT-line locations.
// Nothing is made until the writer clicks Add.
const FRAMING = /\b(E?CU|M?CU|MS|WS|E?LS|LA|HA|OTS|POV|two[- ]shot|insert|silhouette|tracking|cutaway|close[- ]?up|wide|medium|low[- ]angle|high[- ]angle|overhead|aerial|dolly|pan|tilt|establishing)\b/i;
const TIME = /^(late |early |mid[- ]?)?(morning|noon|midday|afternoon|evening|dusk|dawn|sunset|sunrise|night|midnight|day|twilight|golden hour)$/i;
function placeOf(loc) { const parts = String(loc || "").split(/\s*,\s*/).map(x => x.trim()).filter(x => x && !FRAMING.test(x) && !TIME.test(x) && !/^\d+s$/.test(x)); return parts[0] || ""; }
const PERSON = /\b(man|woman|boy|girl|child|kid|baby|person|people|creature|figure|monster|he|she|his|her|old|young|teen|thirties|twenties|forties|years|elderly|lady|guy|reaper|beast|animal|dog|cat|horse|bird)\b/i;
function suggestRefs(s) {
  const cards = readCards(), have = (kind, n) => { const l = n.toLowerCase(); return cards.some(c => c.kind === kind && [c.name].concat(c.aliases || []).some(a => a.toLowerCase() === l || (kind === "location" && l.includes(a.toLowerCase())))); };
  const chars = new Map(), places = new Map(), cast = new Map();
  const bump = (m, k, ep, extra) => { const key = k.toLowerCase(); const o = m.get(key) || { name: k, shots: 0, eps: new Set(), ...extra }; o.shots++; o.eps.add(ep); m.set(key, o); };
  for (const ep of s.episodes) {
    const t = readScript(s, ep).replace(/\r/g, ""); if (!t.trim()) continue; const p = SF.parse(t);
    for (const b of p.blocks) {
      const names = new Set(String(b.who || "").split(/\s*,\s*|\s+and\s+|\s*&\s*|\s*\/\s*/).map(x => x.trim()).filter(Boolean));
      for (const l of b.lines || []) if (l.who) names.add(l.who.replace(/\s*\(.*\)$/, "").trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
      for (const n of names) if (n.length < 40 && !/REFERENCE/i.test(n)) bump(chars, n, ep.num);
      const pl = placeOf(b.location); if (pl) bump(places, pl, ep.num);
    }
    // CAST: Name — description. (several per line allowed)
    for (const line of t.split("\n")) { const m = line.match(/^\s*CAST\s*:\s*(.+)$/i); if (!m) continue;
      for (const e of m[1].split(/(?<=[.;])\s+(?=[A-Z][\w'’ .-]{0,30}?\s+[—–-]\s)/)) { const x = e.match(/^\s*([A-Z][\w'’ .-]{0,30}?)\s+[—–-]\s+(.+?)\s*[.;]?\s*$/); if (x && !cast.has(x[1].toLowerCase())) cast.set(x[1].toLowerCase(), { name: x[1].trim(), look: x[2].trim() }); } }
  }
  const out = [];
  for (const [k, c] of cast) { if (!chars.has(k) && !PERSON.test(c.look)) { if (!have("prop", c.name)) out.push({ kind: "prop", name: c.name, look: c.look, shots: 0, eps: [] }); } else if (!chars.has(k)) chars.set(k, { name: c.name, shots: 0, eps: new Set() }); }
  for (const [k, c] of chars) if (!have("character", c.name)) out.push({ kind: "character", name: c.name, look: (cast.get(k) || {}).look || "", shots: c.shots, eps: [...c.eps] });
  for (const [, c] of places) if (!have("location", c.name)) out.push({ kind: "location", name: c.name, look: "", shots: c.shots, eps: [...c.eps] });
  return out.sort((a, b) => b.shots - a.shots);
}


// ---------- Claude writes image prompts (it can see the reference images and the last result) ----------
async function smallImage(abs) {
  const small = path.join(path.dirname(abs), ".small", path.basename(abs).replace(/\.[a-z]+$/i, ".jpg"));
  if (!fs.existsSync(small)) { fs.mkdirSync(path.dirname(small), { recursive: true }); try { await ffmpeg(["-i", abs, "-vf", "scale='min(1024,iw)':'min(1024,ih)':force_original_aspect_ratio=decrease", "-q:v", "3", "-frames:v", "1", small]); } catch { fs.copyFileSync(abs, small); } }
  return "data:image/jpeg;base64," + fs.readFileSync(small).toString("base64");
}
const PROMPT_WRITER_WORLD = `
WORLD AND ERA: when the story's world is given, everything you write must belong to it: clothes, materials, hairstyles, tools, buildings. Nothing from another era or from modern life (no jeans, zips, sneakers, plastic, printed logos) unless the world says so. Name the period-correct version ("hand-woven linen tunic", "leather lace-up boots") rather than leaving it vague, and add one line to the prompt saying what to avoid.
STYLE IMAGES: images marked as style references show how the story is drawn. Describe their drawing, colouring and lighting in ART DIRECTION and LIGHTING; never copy who or what is in them.`;
const PROMPT_WRITER = `You write prompts for AI image models (Seedream, Nano Banana, FLUX) inside GASP, an app for AI-made animated shorts.
Write ONE complete image prompt in plain text, in these sections, each a short paragraph: CHARACTER, CLOTHING, POSE AND EXPRESSION, ART DIRECTION, LIGHTING, COMPOSITION. (For a place or an object, use SUBJECT instead of CHARACTER and CLOTHING.)
How to write it:
- Be concrete and visual. Describe faces precisely (eye shape and colour, brows, jaw, nose, proportions, how stylised) so the model doesn't fall back on a generic face.
- When reference images are attached, describe what they show in words: hair, face, build, colours, costume, and their art style. Leave out anything the writer says to drop (say so plainly: "no helmet"), and change what they ask to change.
- Never use the character's name: image models don't know it.
- Art direction: say exactly how it's drawn (2D or 3D, line weight, shading, colour) and what to avoid. If the story's art direction is given, follow it.
- Composition: follow the image type (full body: head to shoes all in frame, plain white background; face: head and shoulders; turnaround: front, three-quarter, side and back views side by side; location: the empty set, no people; prop: the object alone on white). No text, no logos.
- Never contradict yourself (one expression, one outfit, one art style).
- When you're asked to change an existing prompt, keep everything the writer didn't ask to change. When a result image is attached, it's what the current prompt produced: use it to see what went wrong.
Reply with the prompt only: no preamble, no quotes, no markdown fences.`;
async function writeImagePrompt({ card, im, ask, prompt, refFiles, styleFiles = [], resultFile, story }) {
  const cs = chatSetting();
  const intro = [`Image type: ${im.label} (${card.kind}).`, card.look ? `The card's look: ${card.look}` : "", story && story.world ? `The story's world and era:\n${story.world}` : "", story && story.artDirection ? `The story's art direction:\n${story.artDirection}` : "", story && story.styleLine ? `The story's style line: ${story.styleLine}` : "",
    prompt && prompt.trim() ? `Current prompt:\n${prompt}` : "There's no prompt yet: write one.", refFiles.length ? `Attached first: ${refFiles.length} reference image${refFiles.length === 1 ? "" : "s"} of this ${card.kind}.` : "No reference images of this " + card.kind + ".", styleFiles.length ? `Attached next: ${styleFiles.length} style reference image${styleFiles.length === 1 ? "" : "s"} (how the story is drawn; ignore who or what is in them).` : "", resultFile ? "Attached last: the latest result from the current prompt." : "",
    `The writer says: ${ask && ask.trim() ? ask : (prompt && prompt.trim() ? "Improve this prompt." : "Write the prompt.")}`].filter(Boolean).join("\n\n");
  if (process.env.GASP_DRY) return { prompt: `CHARACTER:\n(dry run) ${card.look || "a character"} — ${ask || "first draft"}.\n\nART DIRECTION:\n2D animated feature style.\n\nCOMPOSITION:\n${im.label}, plain white background, no text.`, cost: 0 };
  const parts = [{ type: "text", text: intro }]; for (const f of refFiles.concat(styleFiles)) parts.push({ type: "image_url", image_url: { url: await smallImage(f) } }); if (resultFile) parts.push({ type: "image_url", image_url: { url: await smallImage(resultFile) } });
  const r = await chatCall({ provider: cs.provider, model: cs.model, messages: [{ role: "system", content: PROMPT_WRITER + PROMPT_WRITER_WORLD }, { role: "user", content: parts }], maxTokens: 1800, timeoutMs: 120000 });
  return { prompt: r.text.replace(/^```\w*\n?|```$/g, "").trim(), cost: r.cost };
}


// Style pictures never go to the image model: shown a picture of Mother as "style only", models draw Mother.
// Instead Claude looks at them and describes just the style in words, and that text joins the prompt. Cached per set of pictures.
const STYLE_CACHE = () => path.join(LIB(), ".style-descriptions.json");
const isStylePick = p => !!(p && (p.style || p.asStyle));
async function styleText(picks) {
  const refs = resolveRefs(picks.filter(isStylePick), null, null); if (!refs.length) return "";
  const key = refs.map(r => { let m = 0; try { m = fs.statSync(r.file).mtimeMs | 0; } catch {} return path.basename(r.file) + ":" + m; }).sort().join("|");
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(STYLE_CACHE(), "utf8")); } catch {} if (cache[key]) return cache[key];
  let text;
  if (process.env.GASP_DRY) text = "(dry run) bold 2D cel style, clean ink outlines, warm rim light.";
  else { const cs = chatSetting(); const parts = [{ type: "text", text: `Describe ONLY the art style of ${refs.length === 1 ? "this image" : "these images"}, so a different character or place can be drawn in exactly the same style: line work and outlines, shading method, how light and shadow are rendered, texture or grain, how realistic or stylised the proportions and faces are, 2D or 3D, and the overall saturation and contrast. Don't name specific colours of anything in the picture (no "green dress", "purple hair"): colours belong to the subject, not the style. 3 to 5 sentences. Never mention who or what is in ${refs.length === 1 ? "it" : "them"}: no people, clothes, hair, creatures or objects. Reply with the description only.` }];
    for (const r of refs.slice(0, 4)) parts.push({ type: "image_url", image_url: { url: await smallImage(r.file) } });
    const r = await chatCall({ provider: cs.provider, model: cs.model, maxTokens: 400, timeoutMs: 90000, messages: [{ role: "user", content: parts }] }); text = r.text.trim();
    logSpend({ story: "Reference", episode: "", shot: "style description", kind: "prompt", model: cs.model, seconds: 0, cost: r.cost || 0, file: "" }); }
  cache[key] = text; try { fs.writeFileSync(STYLE_CACHE(), JSON.stringify(cache, null, 1)); } catch {} return text;
}

// ---------- spend log ----------
const spendFile = () => path.join(LIB(), "spend-log.csv");
const csv = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
function logSpend(row) { ensureLibrary(); const f = spendFile(); if (!fs.existsSync(f)) fs.writeFileSync(f, "when,story,episode,shot,kind,model,seconds,cost_usd,file\n"); fs.appendFileSync(f, [new Date().toISOString(), row.story, row.episode, row.shot, row.kind, row.model, row.seconds, row.cost, row.file].map(csv).join(",") + "\n"); }
function readSpend() {
  let rows = []; try { const lines = fs.readFileSync(spendFile(), "utf8").trim().split(/\r?\n/).slice(1); rows = lines.map(l => { const c = []; l.replace(/"((?:[^"]|"")*)"|([^,]+)/g, (m, q, p) => { c.push(q != null ? q.replace(/""/g, '"') : p); return ""; }); return { when: c[0], story: c[1], episode: c[2], shot: c[3], kind: c[4], model: c[5], seconds: +c[6] || 0, cost: +c[7] || 0, file: c[8] }; }); } catch {}
  const byModel = {}; for (const r of rows) { const m = byModel[r.model] || (byModel[r.model] = { model: r.model, runs: 0, seconds: 0, cost: 0 }); m.runs++; m.seconds += r.seconds; m.cost += r.cost; }
  return { total: rows.reduce((a, r) => a + r.cost, 0), byModel: Object.values(byModel).sort((a, b) => b.cost - a.cost), recent: rows.slice(-200).reverse() };
}

// ---------- background jobs ----------
const JOBS = {};
const clients = new Set();
const emit = (type, data) => { const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) c.write(msg); };
async function runVideoJob({ storyId, epId, shotId, modelKey, prompt, seconds }) {
  const s = loadStory(storyId); const ep = epOf(s, epId); const sh = shotOf(ep, shotId);
  const model = MODELS.video[modelKey]; if (!model) throw httpErr(400, "unknown video model");
  if (!sh.keyframeTake) throw httpErr(400, "this shot needs a keyframe first");
  const job = { id: newId(), shot: sh.id, story: s.id, kind: "video", model: modelKey, status: "running", phase: "starting", started: Date.now() }; JOBS[job.id] = job; emit("job", job);
  (async () => {
    try {
      const d = shotPath(s, ep, sh); const out = path.join(d, "takes", `${stamp()} video - ${modelKey}.mp4`);
      const mdl = model.extra && "aspect_ratio" in model.extra && ep.aspect ? { ...model, extra: { ...model.extra, aspect_ratio: ep.aspect } } : model;
      const r = await imageToVideo({ model: mdl, keyframe: path.join(d, "takes", sh.keyframeTake), prompt, seconds, outFile: out, onStatus: (st, q) => { job.phase = st === "IN_QUEUE" ? `in fal's queue${q != null ? " (#" + (q + 1) + ")" : ""}` : st === "IN_PROGRESS" ? "generating" : String(st || "").toLowerCase(); emit("job", job); } });
      const s2 = loadStory(storyId); const ep2 = epOf(s2, epId); const sh2 = shotOf(ep2, shotId); setInUse(s2, ep2, sh2, path.basename(r.file)); saveStory(s2);
      logSpend({ story: s2.title, episode: ep2.num, shot: ep2.shots.indexOf(sh2) + 1, kind: "video", model: modelKey + (r.dry ? " (dry run)" : ""), seconds: r.seconds, cost: r.cost, file: rel(r.file) });
      Object.assign(job, { status: "done", phase: "done", cost: r.cost, take: path.basename(r.file), finished: Date.now() });
    } catch (e) { Object.assign(job, { status: "error", phase: "failed", error: String(e.message || e), finished: Date.now() }); }
    emit("job", job);
  })();
  return job;
}


// keyframes for a shot, or images for a reference card. Every result is kept as a take; the first is put in use only if nothing is.
function runImageJob({ target, modelKey, prompt, picks, count, sameSubject, edit }) {
  const model = MODELS.image[modelKey]; if (!model) throw httpErr(400, "unknown image model");
  let s, ep, sh, c, im, aspect = "9:16", base, label;
  if (target.shot) { s = loadStory(target.story); ep = epOf(s, target.ep); sh = shotOf(ep, target.shot); aspect = ep.aspect || "9:16"; base = path.join(shotPath(s, ep, sh), "takes", `${stamp()} keyframe - ${modelKey}`); label = "keyframe"; }
  else { c = findCard(target.card); im = imageOf(c, target.image); aspect = target.aspect || (c.kind === "location" ? "16:9" : c.kind === "prop" ? "1:1" : "9:16"); base = path.join(cardPath(c), "takes", `${stamp()} ${clean(im.label, 40)} - ${modelKey}`); label = "reference"; }
  if (!String(prompt || "").trim()) throw httpErr(400, "Write a prompt first.");
  const refs = resolveRefs(picks, s, ep).slice(0, model.maxRefs || 4);
  const full = [sh && ep.style ? `Style: ${ep.style}.` : "", String(prompt).trim(), refLegend(refs, sameSubject, edit), `${aspect} ${aspect === "9:16" ? "vertical" : aspect === "16:9" ? "widescreen" : "square"} frame.`].filter(Boolean).join("\n\n");
  const job = { id: newId(), kind: label, shot: sh ? sh.id : null, story: s ? s.id : null, card: c ? c.id : null, image: im ? im.id : null, thread: target.thread || undefined, model: modelKey, count: count || 1, refs: refs.length, prompt: full, status: "running", phase: "starting", started: Date.now() }; JOBS[job.id] = job; emit("job", job);
  (async () => {
    try {
      const r = await generateImages({ model, prompt: full, refs: refs.map(x => x.file), aspect, count, outBase: base, onStatus: (st, q) => { job.phase = st === "IN_QUEUE" ? `in fal's queue${q != null ? " (#" + (q + 1) + ")" : ""}` : st === "IN_PROGRESS" ? "generating" : String(st || "").toLowerCase(); emit("job", job); } });
      const takes = r.files.map(f => path.basename(f));
      if (sh) { const s2 = loadStory(s.id); const ep2 = epOf(s2, ep.id); const sh2 = shotOf(ep2, sh.id); if (!sh2.keyframeTake) setInUse(s2, ep2, sh2, takes[0]); saveStory(s2); logSpend({ story: s2.title, episode: ep2.num, shot: ep2.shots.indexOf(sh2) + 1, kind: "keyframe", model: modelKey + (r.dry ? " (dry run)" : ""), seconds: 0, cost: r.cost, file: r.files.map(rel).join(" | ") }); }
      else {
        logSpend({ story: "Reference", episode: "", shot: `${c.name} · ${im.label}`, kind: "reference", model: modelKey + (r.dry ? " (dry run)" : ""), seconds: 0, cost: r.cost, file: r.files.map(rel).join(" | ") });
        const tool = target.cutout && MODELS.cutout[settings().defaultCutout];
        if (tool) { job.phase = "removing the background"; emit("job", job); const cuts = [];
          for (const f of r.files) { const out = f.replace(/\.[a-z]+$/i, "") + ` - cutout ${settings().defaultCutout}.png`; try { const x = await removeBackground({ tool, file: f, outFile: out }); cuts.push(path.basename(out)); r.cost += x.cost; logSpend({ story: "Reference", episode: "", shot: `${c.name} · ${im.label}`, kind: "cutout", model: settings().defaultCutout + (x.dry ? " (dry run)" : ""), seconds: 0, cost: x.cost, file: rel(out) }); } catch (e) { job.cutoutError = String(e.message || e); } }
          takes.push(...cuts); }
        const c2 = findCard(c.id); const im2 = imageOf(c2, im.id); im2.takes.push(...takes); if (!im2.take) setImageInUse(c2, im2, takes.find(t => / - cutout /.test(t)) || takes[0]);
        if (target.thread) im2.thread = (im2.thread || []).concat({ ask: target.thread.ask, base: target.thread.base, extras: target.thread.extras && target.thread.extras.length ? target.thread.extras : undefined, result: takes.find(t => / - cutout /.test(t)) || takes[0], model: modelKey, at: Date.now() });
        writeCard(c2);
      }
      Object.assign(job, { status: "done", phase: "done", cost: r.cost, takes, finished: Date.now() });
    } catch (e) { Object.assign(job, { status: "error", phase: "failed", error: String(e.message || e), finished: Date.now() }); }
    emit("job", job);
  })();
  return job;
}
function runCutoutJob({ cardId, imageId, toolKey, take }) {
  const tool = MODELS.cutout[toolKey]; if (!tool) throw httpErr(400, "unknown background-removal tool");
  const c = findCard(cardId); const im = imageOf(c, imageId); const src = take && im.takes.includes(path.basename(take)) ? path.basename(take) : im.take; if (!src) throw httpErr(400, "This image is empty: add or generate one first.");
  const job = { id: newId(), kind: "cutout", card: c.id, image: im.id, model: toolKey, status: "running", phase: "starting", started: Date.now() }; JOBS[job.id] = job; emit("job", job);
  (async () => {
    try {
      const out = path.join(cardPath(c), "takes", `${stamp()} ${clean(im.label, 40)} - cutout ${toolKey}.png`);
      const r = await removeBackground({ tool, file: path.join(cardPath(c), "takes", src), outFile: out, onStatus: st => { job.phase = st === "IN_PROGRESS" ? "removing the background" : String(st || "").toLowerCase().replace("_", " "); emit("job", job); } });
      const c2 = findCard(c.id); const im2 = imageOf(c2, im.id); const take = path.basename(r.file); im2.takes.push(take); if (!im2.take || im2.take === src) setImageInUse(c2, im2, take); writeCard(c2);
      logSpend({ story: "Reference", episode: "", shot: `${c2.name} · ${im2.label}`, kind: "cutout", model: toolKey + (r.dry ? " (dry run)" : ""), seconds: 0, cost: r.cost, file: rel(r.file) });
      Object.assign(job, { status: "done", phase: "done", cost: r.cost, takes: [take], finished: Date.now() });
    } catch (e) { Object.assign(job, { status: "error", phase: "failed", error: String(e.message || e), finished: Date.now() }); }
    emit("job", job);
  })();
  return job;
}

// ---------- git ----------
const git = args => new Promise((ok, no) => execFile("git", args, { cwd: ROOT, windowsHide: true }, (e, out, err) => e ? no(Object.assign(e, { stderr: String(err || "") })) : ok(String(out))));
function friendlyGit(e) { const t = String(e.stderr || e.message || ""); if (/not a git repository/i.test(t)) return "This copy of GASP 2 isn't inside the git repo, so it can't update itself."; if (/could not resolve host|unable to access|network/i.test(t)) return "Couldn't reach GitHub. Check the internet connection and try again."; if (/conflict/i.test(t)) return "Your copy has a local change that clashes with the update. Nothing was changed; ask Claude to sort it out."; if (/no upstream|no tracking/i.test(t)) return "This copy isn't tracking GitHub's main branch."; return "Update failed: " + t.split(/\r?\n/).filter(l => l && !/^hint:/.test(l)).slice(0, 2).join(" ").slice(0, 200); }

// ---------- http ----------
function httpErr(code, msg) { const e = new Error(msg); e.code = code; return e; }
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".txt": "text/plain; charset=utf-8", ".csv": "text/csv" };
function sendFile(req, res, abs) {
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { res.writeHead(404); return res.end("not found"); }
  const size = fs.statSync(abs).size; const type = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream"; const range = req.headers.range;
  if (range) { const [a, b] = range.replace(/bytes=/, "").split("-"); const start = +a, end = b ? +b : size - 1; res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-cache" }); return fs.createReadStream(abs, { start, end }).pipe(res); }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" }); fs.createReadStream(abs).pipe(res);
}
const body = req => new Promise((ok, no) => { const ch = []; req.on("data", c => ch.push(c)); req.on("end", () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch).toString("utf8")) : {}); } catch (e) { no(httpErr(400, "bad json")); } }); req.on("error", no); });
const json = (res, o, code = 200) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(o)); };
const dataUri = (u) => { const m = /^data:image\/(png|jpe?g|webp);base64,/.exec(u || ""); if (!m) throw httpErr(400, "expected an image"); return { ext: m[1] === "jpeg" ? "jpg" : m[1], buf: Buffer.from(u.slice(m[0].length), "base64") }; };

const routes = {
  "GET /api/state": () => { const s = settings(); const { own, old } = loadKeys(); return { chatModels: CHAT_MODELS, chat: chatSetting(), pid: process.pid, version: "2.0-step6", dry: !!process.env.GASP_DRY, library: s.library, defaultVideo: s.defaultVideo, defaultImage: s.defaultImage, defaultCutout: s.defaultCutout, imageModels: MODELS.image, cutoutTools: MODELS.cutout, keys: Object.fromEntries(KEY_NAMES.map(k => [k, own[k] ? "set" : old[k] ? "from 1.0" : ""])), models: MODELS.video, stories: listStories(), spend: readSpend().total }; },
  "POST /api/settings": async (req) => { const b = await body(req); if (b.keys) saveKeys(b.keys); const patch = {}; if (b.library) patch.library = path.resolve(String(b.library)); if (b.defaultVideo && MODELS.video[b.defaultVideo]) patch.defaultVideo = b.defaultVideo; if (b.defaultImage && MODELS.image[b.defaultImage]) patch.defaultImage = b.defaultImage; if (b.defaultCutout && MODELS.cutout[b.defaultCutout]) patch.defaultCutout = b.defaultCutout; if (b.chat && b.chat.model && ["fal", "groq"].includes(b.chat.provider)) patch.chat = { provider: b.chat.provider, model: String(b.chat.model).trim() }; if (Object.keys(patch).length) saveSettings(patch); ensureLibrary(); return { ok: true }; },
  "GET /api/spend": () => readSpend(),
  "POST /api/story/new": async (req) => { const b = await body(req); return storyForApp(createStory(b.title || "New story")); },
  "GET /api/story": (req, url) => { const s = loadStory(url.searchParams.get("id")); s.opened = Date.now(); const out = { ...s }; delete out.dir; fs.writeFileSync(path.join(storiesDir(), s.dir, "story.json"), JSON.stringify(out, null, 2)); return storyForApp(s); },
  "POST /api/story/rename": async (req) => { const b = await body(req); const s = loadStory(b.id); s.title = clean(b.title); saveStory(s); for (const ep of s.episodes) { const t = readScript(s, ep); if (t.trim()) writeScript(s, ep, t, false); } return storyForApp(s); },
  "POST /api/episode/new": async (req) => { const b = await body(req); const s = loadStory(b.story); s.episodes.push({ id: newId(), title: b.title || `Episode ${s.episodes.length + 1}`, shots: [] }); return storyForApp(saveStory(s)); },
  "POST /api/episode/rename": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); ep.title = String(b.title || "").slice(0, 80); saveStory(s); const t = readScript(s, ep); if (t.trim()) writeScript(s, ep, t, false); return storyForApp(s); },
  "POST /api/shot/new": async (req) => {
    const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep);
    const sh = { id: newId(), title: b.title || "New shot", imagePrompt: "", motionPrompt: "", seconds: null, model: null, notes: "", show: "keyframe" };
    const at = b.after ? ep.shots.findIndex(x => x.id === b.after) + 1 : b.before ? ep.shots.findIndex(x => x.id === b.before) : ep.shots.length; ep.shots.splice(Math.max(0, at), 0, sh);
    saveStory(s); const prev = ep.shots[ep.shots.indexOf(sh) - 1]; scriptEdit(s, ep, t => SF.insertBlock(t, prev ? prev.id : null, sh));
    if (b.image) { const { ext, buf } = dataUri(b.image); const take = `${stamp()} keyframe - ${clean(b.source || "upload")}.${ext}`; fs.writeFileSync(path.join(shotPath(s, ep, sh), "takes", take), buf); setInUse(s, ep, sh, take); saveStory(s); }
    return { story: storyForApp(s), shot: sh.id };
  },
  "POST /api/shot/update": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); updateShot(s, ep, shotOf(ep, b.shot), b.fields || {}); return storyForApp(saveStory(s)); },
  "POST /api/shot/move": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const byId = Object.fromEntries(ep.shots.map(x => [x.id, x])); if (!Array.isArray(b.order) || b.order.length !== ep.shots.length || b.order.some(id => !byId[id])) throw httpErr(400, "order must list every shot"); ep.shots = b.order.map(id => byId[id]); scriptEdit(s, ep, t => SF.reorder(t, b.order)); return storyForApp(saveStory(s)); },
  "POST /api/shot/duplicate": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const src = shotOf(ep, b.shot); const sh = { ...src, id: newId(), dir: null, title: src.title + " copy" }; ep.shots.splice(ep.shots.indexOf(src) + 1, 0, sh); saveStory(s); scriptEdit(s, ep, t => SF.insertBlock(t, src.id, sh)); fs.cpSync(path.join(shotPath(s, ep, src), "takes"), path.join(shotPath(s, ep, sh), "takes"), { recursive: true }); if (sh.keyframeTake) setInUse(s, ep, sh, sh.keyframeTake); if (sh.videoTake) setInUse(s, ep, sh, sh.videoTake); sh.show = src.show; return { story: storyForApp(saveStory(s)), shot: sh.id }; },
  "POST /api/shot/delete": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const sh = shotOf(ep, b.shot); if (Object.values(JOBS).some(j => j.shot === sh.id && j.status === "running")) throw httpErr(409, "a generation is still running for this shot"); toTrash(shotPath(s, ep, sh), `${s.title} - ${ep.dir} - ${sh.dir}`); ep.shots = ep.shots.filter(x => x !== sh); scriptEdit(s, ep, t => SF.removeBlock(t, sh.id)); return storyForApp(saveStory(s)); },
  "POST /api/keyframe": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const sh = shotOf(ep, b.shot); const { ext, buf } = dataUri(b.image); const take = `${stamp()} keyframe - ${clean(b.source || "upload")}.${ext}`; fs.writeFileSync(path.join(shotPath(s, ep, sh), "takes", take), buf); setInUse(s, ep, sh, take); sh.show = "keyframe"; return storyForApp(saveStory(s)); },
  "POST /api/take/use": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const sh = shotOf(ep, b.shot); setInUse(s, ep, sh, path.basename(b.take)); return storyForApp(saveStory(s)); },
  "POST /api/take/delete": async (req) => {
    const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const sh = shotOf(ep, b.shot); const take = path.basename(b.take); const abs = path.join(shotPath(s, ep, sh), "takes", take);
    if (!fs.existsSync(abs)) throw httpErr(404, "take not found"); toTrash(abs, `${s.title} - ${sh.dir} - ${take}`);
    const d = shotPath(s, ep, sh);
    if (sh.videoTake === take) { sh.videoTake = null; try { fs.unlinkSync(path.join(d, "video.mp4")); } catch {} const next = fs.readdirSync(path.join(d, "takes")).filter(f => /\.mp4$/i.test(f)).sort().pop(); if (next) setInUse(s, ep, sh, next); else sh.show = "keyframe"; }
    if (sh.keyframeTake === take) { sh.keyframeTake = null; for (const f of fs.readdirSync(d)) if (/^keyframe\./i.test(f)) fs.unlinkSync(path.join(d, f)); const next = fs.readdirSync(path.join(d, "takes")).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort().pop(); if (next) setInUse(s, ep, sh, next); }
    return storyForApp(saveStory(s));
  },
  "POST /api/gen/video": async (req) => { const b = await body(req); return await runVideoJob({ storyId: b.story, epId: b.ep, shotId: b.shot, modelKey: b.model || settings().defaultVideo, prompt: b.prompt, seconds: +b.seconds || 5 }); },
  "GET /api/refs": () => refsForApp(),
  "GET /api/refs/suggest": (req, url) => suggestRefs(loadStory(url.searchParams.get("story"))),
  "POST /api/ref/new": async (req) => { const b = await body(req); const c = createCard(b.kind, b.name || "New " + b.kind); if (b.look) { c.look = String(b.look); writeCard(c); } if (b.image) { const { ext, buf } = dataUri(b.image); const im = c.images[0]; setImageInUse(c, im, addCardTake(c, im, buf, ext, b.source)); writeCard(c); } return { refs: refsForApp(), card: c.id }; },
  "POST /api/ref/update": async (req) => { const b = await body(req); const c = findCard(b.card); const f = b.fields || {};
    if ("name" in f && String(f.name).trim()) c.name = clean(f.name); if ("look" in f) c.look = String(f.look); if ("voice" in f) c.voice = String(f.voice); if ("aliases" in f) c.aliases = (Array.isArray(f.aliases) ? f.aliases : String(f.aliases).split(",")).map(x => String(x).trim()).filter(Boolean);
    saveCard(c); return refsForApp(); },
  "POST /api/ref/delete": async (req) => { const b = await body(req); const c = findCard(b.card); if (Object.values(JOBS).some(j => j.card === c.id && j.status === "running")) throw httpErr(409, "a generation is still running for this card"); toTrash(cardPath(c), `Reference - ${KINDS[c.kind]} - ${c.dir}`); return refsForApp(); },
  "POST /api/ref/image/new": async (req) => { const b = await body(req); const c = findCard(b.card); const im = { id: newId(), label: clean(b.label || "image " + (c.images.length + 1), 40), takes: [], take: null, art: !!b.art || undefined }; c.images.push(im);
    if (b.image) { const { ext, buf } = dataUri(b.image); setImageInUse(c, im, addCardTake(c, im, buf, ext, b.source)); } writeCard(c); return { refs: refsForApp(), image: im.id }; },
  "POST /api/ref/image/set": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image); const { ext, buf } = dataUri(b.image64); setImageInUse(c, im, addCardTake(c, im, buf, ext, b.source)); writeCard(c); return refsForApp(); },
  "POST /api/ref/image/rename": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image); if ("framing" in b || "notes" in b || "change" in b || "prompt" in b || "xrefs" in b) { if ("prompt" in b) im.prompt = String(b.prompt || ""); if ("xrefs" in b) im.xrefs = (b.xrefs || []).filter(x => x && x.card && x.image).slice(0, 6); if ("framing" in b) im.framing = String(b.framing || ""); if ("notes" in b) im.notes = String(b.notes || ""); if ("change" in b) im.change = String(b.change || ""); writeCard(c); if (!("label" in b)) return refsForApp(); }
    const old = im.take ? path.join(cardPath(c), topName(im)) : null; im.label = clean(b.label, 40); if (old && fs.existsSync(old)) { try { fs.renameSync(old, path.join(cardPath(c), topName(im))); } catch {} } writeCard(c); return refsForApp(); },
  "POST /api/ref/image/delete": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image);
    for (const t of im.takes) { const abs = path.join(cardPath(c), "takes", t); if (fs.existsSync(abs)) toTrash(abs, `Reference - ${c.name} - ${t}`); } if (im.take) { try { fs.unlinkSync(path.join(cardPath(c), topName(im))); } catch {} }
    c.images = c.images.filter(x => x !== im); writeCard(c); return refsForApp(); },
  "POST /api/ref/take/use": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image); const t = path.basename(b.take); if (!im.takes.includes(t)) throw httpErr(404, "take not found"); setImageInUse(c, im, t); writeCard(c); return refsForApp(); },
  "POST /api/ref/take/delete": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image); const t = path.basename(b.take); const abs = path.join(cardPath(c), "takes", t);
    if (fs.existsSync(abs)) toTrash(abs, `Reference - ${c.name} - ${t}`); im.takes = im.takes.filter(x => x !== t);
    if (im.take === t) { const next = im.takes.filter(x => fs.existsSync(path.join(cardPath(c), "takes", x))).pop() || null; try { fs.unlinkSync(path.join(cardPath(c), topName(im))); } catch {} im.take = null; if (next) setImageInUse(c, im, next); }
    writeCard(c); return refsForApp(); },
  "POST /api/gen/keyframe": async (req) => { const b = await body(req); return runImageJob({ target: { story: b.story, ep: b.ep, shot: b.shot }, modelKey: b.model || settings().defaultImage, prompt: b.prompt, picks: b.refs, count: +b.count || 1 }); },
  "POST /api/gen/ref": async (req) => { const b = await body(req); const picks = b.refs || [], st = await styleText(picks);
    const prompt = st ? `${String(b.prompt || "").trim()}\n\nDraw it in this art style: ${st}` : b.prompt;
    return runImageJob({ target: { card: b.card, image: b.image, aspect: b.aspect, cutout: !!b.cutout }, modelKey: b.model || settings().defaultImage, prompt, picks: picks.filter(p => !isStylePick(p)), count: +b.count || 1, sameSubject: true, edit: !!b.edit }); },
  // one turn of a Refine thread: edit a picture (the latest result by default) and keep the earlier asks that led to it
  "POST /api/gen/refine": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image); const th = im.thread || [];
    const want = b.base && path.basename(b.base), base = want && im.takes.includes(want) ? want : th.length ? th[th.length - 1].result : im.take;
    if (!base) throw httpErr(400, "Add or generate an image first."); const ask = String(b.ask || "").trim(); if (!ask) throw httpErr(400, "Say what to change.");
    const chain = []; let cur = base; for (let k = th.length - 1; k >= 0; k--) if (th[k].result === cur) { chain.unshift(th[k].ask.replace(/\.?\s*$/, "")); cur = th[k].base; }
    const who = c.kind === "character" ? (c.look ? SF.lookNoun(c.look) || "character" : "character") : c.kind, styleDesc = await styleText((b.style || []).slice(0, 4)), extras = [];
    for (const x of (b.extra || []).slice(0, 4)) { const { ext, buf } = dataUri(x.data); const dir = path.join(cardPath(c), "takes", "extras"); fs.mkdirSync(dir, { recursive: true }); const f = `${stamp()} ${clean(String(x.name || "picture").replace(/\.[a-z0-9]+$/i, ""), 40)}-${extras.length + 1}.${ext}`; fs.writeFileSync(path.join(dir, f), buf); extras.push(f); }
    const prompt = `Change image 1: ${ask.replace(/\.?\s*$/, ".")}${chain.length ? ` Earlier changes, keep them: ${chain.join("; ")}.` : ""} Keep everything else exactly the same: the same ${who} (it must still be this ${who}, not anyone else), the pose, the framing${styleDesc ? "" : ", the art style"} and the background.${styleDesc ? ` Redraw it in this art style, keeping who it is: ${styleDesc} Take only the drawing technique from that style (line work, shading, rendering, how stylised it is). Keep image 1's own colours exactly: hair, skin, eyes, clothes and accessories stay the colours they are now.` : ""}${extras.length ? ` ${extras.length === 1 ? "An extra picture is" : "Extra pictures are"} attached: use ${extras.length === 1 ? "it" : "them"} only as the change asks.` : ""}`;
    return runImageJob({ target: { card: c.id, image: im.id, aspect: b.aspect, cutout: !!b.cutout, thread: { ask, base, extras } }, modelKey: b.model || settings().defaultImage, prompt, picks: [{ card: c.id, image: im.id, take: base }].concat(extras.map(f => ({ card: c.id, extra: f }))), count: 1, sameSubject: true, edit: true }); },
  "POST /api/ref/write": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image);
    const refFiles = (b.refs || []).map(id => { const x = c.images.find(y => y.id === id); return x && x.take ? path.join(cardPath(c), "takes", x.take) : null; }).filter(Boolean).slice(0, 6);
    const resultFile = b.withResult && im.take ? path.join(cardPath(c), "takes", im.take) : null;
    let story = null; if (b.story) { try { const s = loadStory(b.story); const ep = b.ep ? s.episodes.find(e => e.id === b.ep) : null; story = { world: s.world || "", artDirection: s.artDirection || "", styleLine: ep && ep.style || "" }; } catch {} }
    const styleFiles = resolveRefs(b.style || [], null, null).map(x => x.file).slice(0, 4);
    const r = await writeImagePrompt({ card: c, im, ask: b.ask, prompt: b.prompt, refFiles, styleFiles, resultFile, story });
    im.prompt = r.prompt; writeCard(c); logSpend({ story: "Reference", episode: "", shot: `${c.name} · ${im.label}`, kind: "prompt", model: chatSetting().model + (process.env.GASP_DRY ? " (dry run)" : ""), seconds: 0, cost: r.cost || 0, file: "" });
    return { prompt: r.prompt, cost: r.cost, refs: refsForApp() }; },
  "POST /api/story/art": async (req) => { const b = await body(req); const s = loadStory(b.story); if ("text" in b) s.artDirection = String(b.text || ""); if ("world" in b) s.world = String(b.world || ""); saveStory(s); return storyForApp(s); },
  "POST /api/story/style/add": async (req) => { const b = await body(req); const s = loadStory(b.story); const dir = path.join(storiesDir(), s.dir, "Style"); fs.mkdirSync(dir, { recursive: true });
    const { ext, buf } = dataUri(b.image); const f = `${stamp()} ${clean(String(b.name || "style").replace(/\.[a-z0-9]+$/i, ""), 50)}.${ext}`; fs.writeFileSync(path.join(dir, f), buf); s.styleRefs = (s.styleRefs || []).concat(f); saveStory(s); return storyForApp(s); },
  "POST /api/story/style/delete": async (req) => { const b = await body(req); const s = loadStory(b.story); const f = path.basename(b.file); const abs = path.join(storiesDir(), s.dir, "Style", f); if (fs.existsSync(abs)) toTrash(abs, `${s.dir} - Style - ${f}`); s.styleRefs = (s.styleRefs || []).filter(x => x !== f); saveStory(s); return storyForApp(s); },
  // Claude writes a card's Look (one line) from its picture
  "POST /api/ref/look": async (req) => { const b = await body(req); const c = findCard(b.card); const im = c.images.find(x => x.id === b.image && x.take) || c.images.find(x => !x.art && x.take && /full/i.test(x.label)) || c.images.find(x => !x.art && x.take) || c.images.find(x => x.take);
    if (!im) throw httpErr(400, "Add or generate an image of this card first."); let world = ""; if (b.story) { try { world = loadStory(b.story).world || ""; } catch {} }
    let look; if (process.env.GASP_DRY) look = `(dry run) ${c.kind} as seen in ${im.label}`;
    else { const cs = chatSetting(); const r = await chatCall({ provider: cs.provider, model: cs.model, maxTokens: 200, timeoutMs: 60000, messages: [{ role: "user", content: [{ type: "text", text: `Describe this ${c.kind} in ONE line of comma-separated phrases, for reuse in image prompts: ${c.kind === "character" ? "who they are (age, build), face, hair, and what they're wearing" : "what it is, its shape, materials and colours"}. Start with a plain noun (${c.kind === "character" ? "woman, man, girl, old farmer…" : "stone well, hunting knife…"}). No name, no art style, no lighting, no background. ${world ? "The world: " + world + "." : ""} Reply with the line only.` }, { type: "image_url", image_url: { url: await smallImage(path.join(cardPath(c), "takes", im.take)) } }] }] }); look = r.text.trim().replace(/^["'`]+|["'`]+$/g, "").split("\n")[0]; logSpend({ story: "Reference", episode: "", shot: `${c.name} · look`, kind: "prompt", model: cs.model, seconds: 0, cost: r.cost || 0, file: "" }); }
    c.look = look; writeCard(c); return { look, refs: refsForApp() }; },
  "POST /api/ref/thread/clear": async (req) => { const b = await body(req); const c = findCard(b.card); const im = imageOf(c, b.image); im.thread = []; writeCard(c); return refsForApp(); },
  "POST /api/gen/cutout": async (req) => { const b = await body(req); return runCutoutJob({ cardId: b.card, imageId: b.image, toolKey: b.tool || settings().defaultCutout, take: b.take }); },
  "GET /api/script": (req, url) => { const s = loadStory(url.searchParams.get("story")); const ep = epOf(s, url.searchParams.get("ep")); const t = readScript(s, ep), h = SF.withHeader(t, s.title, ep.num, ep.title); if (h !== t) writeScript(s, ep, h, false); return { text: h, path: scriptPath(s, ep) }; },
  "POST /api/script/save": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); writeScript(s, ep, String(b.text || "").replace(/\r/g, ""), false); return { ok: true }; },
  "POST /api/script/sync": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const r = syncScript(s, ep, String(b.text ?? readScript(s, ep)).replace(/\r/g, ""), b.orphans); saveStory(s); writeScript(s, ep, r.text, true); return { story: storyForApp(s), text: r.text, created: r.created, updated: r.updated, orphans: r.orphans }; },
  "GET /api/chat": (req, url) => { const s = loadStory(url.searchParams.get("story")); return chatForApp(readChat(s), s); },
  "POST /api/chat": async (req) => {
    const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const c = readChat(s);
    const msg = String(b.message || "").trim(); if (!msg && !(b.attachments || []).length) throw httpErr(400, "empty message");
    const attachments = (b.attachments || []).map(a => saveAttachment(s, a)).concat(await linkAttachments(s, msg));
    c.messages.push({ role: "user", content: msg || "(see the attachments)", attachments: attachments.length ? attachments : undefined, at: Date.now(), ep: ep.num }); writeChat(s, c);
    const app = storyForApp(s); const epA = app.episodes.find(e => e.id === ep.id); const script = readScript(s, ep);
    const sys = systemPrompt({ guide: SF.GUIDE, story: s, ep, script, shots: epA.shots, characters: SF.parse(script).characters, videoModel: MODELS.video[settings().defaultVideo], cards: readCards().map(c => ({ kind: c.kind, name: c.name, aliases: c.aliases, look: c.look, images: c.images.filter(i => i.take).length, prompts: c.images.filter(i => !i.art).map(i => ({ label: i.label, made: !!i.take, prompt: i.prompt || "" })) })) });
    const recent = c.messages.slice(-24).filter(m => !m.error), imgTurns = new Set(recent.filter(m => m.role === "user" && (m.attachments || []).some(a => a.kind === "image")).slice(-3));
    const hist = []; for (const m of recent) hist.push({ role: m.role, content: m.role === "user" ? await userContent(s, m, imgTurns.has(m)) : (m.actions || []).some(a => a.state) ? m.content + "\n\n(" + m.actions.map((a, k) => `card ${k + 1}: ${a.state || "not acted on"}`).join("; ") + ")" : m.content });
    const cs = chatSetting(); let r;
    try { r = process.env.GASP_DRY ? { text: dryReply(msg, epA.shots), tokensIn: 0, tokensOut: 0, cost: 0, ms: 600 } : await chatCall({ provider: cs.provider, model: cs.model, messages: [{ role: "system", content: sys }, ...hist] }); }
    catch (e) { c.messages.push({ role: "assistant", content: "", error: String(e.message || e), at: Date.now(), ep: ep.num }); writeChat(s, c); return chatForApp(c, s); }
    const { actions } = splitActions(r.text);
    c.messages.push({ role: "assistant", cutOff: !!r.cutOff, content: r.text, actions: actions.map(a => ({ ...a, state: a.action === "unreadable" ? "unreadable" : null })), at: Date.now(), model: cs.model, cost: r.cost, tokens: r.tokensIn + r.tokensOut, ep: ep.num });
    writeChat(s, c);
    logSpend({ story: s.title, episode: ep.num, shot: "", kind: "chat", model: cs.model + (process.env.GASP_DRY ? " (dry run)" : ""), seconds: 0, cost: r.cost ?? 0, file: `${r.tokensIn} in / ${r.tokensOut} out tokens${r.cost == null ? " (cost not reported)" : ""}` });
    return chatForApp(c, s);
  },
  "POST /api/chat/test": async () => {
    const cs = chatSetting(); const t0 = Date.now();
    if (process.env.GASP_DRY) return { ok: true, ms: 5, provider: cs.provider, model: cs.model, dry: true };
    try { await chatCall({ provider: cs.provider, model: cs.model, messages: [{ role: "user", content: "Reply with the word OK." }], maxTokens: 5, timeoutMs: 30000 }); return { ok: true, ms: Date.now() - t0, provider: cs.provider, model: cs.model }; }
    catch (e) { return { ok: false, error: String(e.message || e), provider: cs.provider, model: cs.model }; }
  },
  "POST /api/chat/act": async (req) => {
    const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const c = readChat(s); const m = c.messages[b.msg]; const a = m && (m.actions || [])[b.action];
    if (!a) throw httpErr(404, "That card isn't there any more.");
    let note = "";
    if (b.op === "apply") { if (a.state === "applied") throw httpErr(409, "Already applied."); const r = applyAction(s, ep, a); Object.assign(a, { state: "applied", undo: r.undo, undoScript: r.undoScript, undoRef: r.undoRef, undoLook: r.undoLook, createdIds: r.createdIds, appliedEp: ep.id }); if (r.undoRef) note = r.undoRef.created ? `new ${a.kind || "character"} card in Reference` : a.prompt ? "prompt saved to the card" : "look saved to the card"; if (r.undoLook) note = "saved to the look of the story"; if (r.created != null) note = `${r.created} new shot${r.created === 1 ? "" : "s"}, ${r.updated} updated${r.orphans ? `, ${r.orphans} only in Shots` : ""}`; }
    else if (b.op === "dismiss") a.state = "dismissed";
    else if (b.op === "undo") {
      if (a.state !== "applied") throw httpErr(409, "Nothing to undo.");
      const ep2 = s.episodes.find(e => e.id === a.appliedEp) || ep;
      if (a.undo) { const sh = ep2.shots.find(x => x.id === a.shot); if (sh) updateShot(s, ep2, sh, a.undo); }
      if (a.undoRef) { const u = a.undoRef, c = readCards().find(x => x.id === u.card); if (c) { if (u.created && !c.images.some(i => i.take)) toTrash(cardPath(c), `Reference - ${KINDS[c.kind]} - ${c.dir}`); else {
        if ("look" in u) c.look = u.look || ""; const im = u.image && c.images.find(x => x.id === u.image);
        if (im) { if (u.newImage === im.id && !im.take) c.images = c.images.filter(x => x !== im); else im.prompt = u.prompt; } saveCard(c); } } }
      if (a.undoLook) { s.world = a.undoLook.world; s.artDirection = a.undoLook.artDirection; saveStory(s); }
      if (a.undoScript != null) {
        // shots this card made go to _Trash (with anything generated for them since), then the old script comes back
        for (const id of a.createdIds || []) { const sh = ep2.shots.find(x => x.id === id); if (sh) { try { toTrash(shotPath(s, ep2, sh), `${s.title} - ${ep2.dir} - ${sh.dir}`); } catch {} ep2.shots = ep2.shots.filter(x => x !== sh); } }
        // an append is undone by taking its shots back out, so later edits survive; a full rewrite brings the old script back
        let back = a.undoScript; if (a.action === "append_script") { back = readScript(s, ep2); for (const id of a.createdIds || []) back = SF.removeBlock(back, id); }
        writeScript(s, ep2, back, true); const r = syncScript(s, ep2, back, "keep"); writeScript(s, ep2, r.text, false);
      }
      a.state = null; delete a.undo; delete a.undoScript; delete a.undoRef; delete a.undoLook; delete a.createdIds;
    }
    saveStory(s); writeChat(s, c); return { chat: chatForApp(c, s), story: storyForApp(s), note };
  },
  "POST /api/chat/clear": async (req) => { const b = await body(req); const s = loadStory(b.story); const c = readChat(s); if (c.messages.length) { const h = path.join(storiesDir(), s.dir, "chat history"); fs.mkdirSync(h, { recursive: true }); fs.writeFileSync(path.join(h, `${stamp()}.json`), JSON.stringify(c, null, 1)); } writeChat(s, { messages: [] }); return chatForApp({ messages: [] }); },
  "GET /api/jobs": () => Object.values(JOBS).filter(j => j.status === "running" || Date.now() - (j.finished || 0) < 10 * 60e3),
  "POST /api/reveal": async (req) => { const b = await body(req); let abs;
    if (b.card) abs = cardPath(findCard(b.card)); else if (b.reference) { ensureLibrary(); abs = b.kind && KINDS[b.kind] ? kindDir(b.kind) : path.join(LIB(), "Reference"); }
    else { const s = loadStory(b.story); abs = path.join(storiesDir(), s.dir); if (b.ep) { const ep = epOf(s, b.ep); abs = path.join(abs, ep.dir); if (b.shot) abs = path.join(abs, shotOf(ep, b.shot).dir); } }
    if (process.platform === "win32") spawn("explorer.exe", [abs], { detached: true, stdio: "ignore" }).unref(); else if (process.platform === "darwin") spawn("open", [abs], { detached: true, stdio: "ignore" }).unref(); return { ok: true, path: abs }; },
  // updates: fetch, see if there's anything new, then pull with rebase (copes with a local commit) and restart in place
  "GET /api/update/check": async () => { try { await git(["fetch", "--quiet"]); const n = +(await git(["rev-list", "--count", "HEAD..@{u}"])).trim() || 0; const files = n ? (await git(["diff", "--name-only", "HEAD", "@{u}", "--", "."])).trim().split(/\r?\n/).filter(Boolean) : []; return { behind: n, gasp2: files.length > 0 }; } catch (e) { return { behind: 0, error: friendlyGit(e) }; } },
  "POST /api/update": async () => {
    try { const before = (await git(["rev-parse", "HEAD"])).trim(); await git(["pull", "--rebase", "--autostash", "--quiet"]); const after = (await git(["rev-parse", "HEAD"])).trim(); return { ok: true, changed: before !== after }; }
    catch (e) { try { await git(["rebase", "--abort"]); } catch {} return { error: friendlyGit(e) }; }
  },
  "POST /api/restart": (req, url, res) => { setTimeout(() => { try { server.close(); server.closeAllConnections && server.closeAllConnections(); } catch {} spawn(process.execPath, [path.join(ROOT, "server.js"), "--noopen", "--port", String(PORT)], { cwd: ROOT, detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, GASP_RESTART: "1" } }).unref(); setTimeout(() => process.exit(0), 300); }, 150); return { ok: true }; },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/api/events") { res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }); res.write(": hi\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return; }
    const h = routes[`${req.method} ${url.pathname}`];
    if (h) return json(res, await h(req, url));
    if (url.pathname.startsWith("/lib/")) { const abs = path.resolve(LIB(), decodeURIComponent(url.pathname.slice(5))); if (!abs.startsWith(path.resolve(LIB()) + path.sep)) { res.writeHead(403); return res.end(); } return sendFile(req, res, abs); }
    const f = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const abs = path.resolve(ROOT, "app", f); if (!abs.startsWith(path.join(ROOT, "app"))) { res.writeHead(403); return res.end(); }
    return sendFile(req, res, abs);
  } catch (e) { json(res, { error: String(e.message || e) }, e.code && e.code >= 400 && e.code < 600 ? e.code : 500); }
});
let tries = 0;
server.on("error", e => { if (e.code === "EADDRINUSE" && process.env.GASP_RESTART && tries++ < 40) { setTimeout(() => server.listen(PORT, "127.0.0.1"), 250); return; } if (e.code === "EADDRINUSE") { console.log(`GASP 2 is already running at http://localhost:${PORT}`); process.exit(0); } throw e; });
server.listen(PORT, "127.0.0.1", () => {
  ensureLibrary();
  console.log(`GASP 2 running at http://localhost:${PORT}${process.env.GASP_DRY ? "  (dry run: no fal calls)" : ""}\nLibrary: ${LIB()}`);
  if (!argv.includes("--noopen")) { const u = `http://localhost:${PORT}`; if (process.platform === "win32") spawn("cmd", ["/c", "start", "", u], { detached: true, stdio: "ignore", windowsHide: true }).unref(); else if (process.platform === "darwin") spawn("open", [u]).unref(); }
});
