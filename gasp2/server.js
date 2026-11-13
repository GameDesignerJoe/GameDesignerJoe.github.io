// GASP 2.0 local server: serves the app, owns the library folder on disk, runs generations in the background.
// node server.js [--port 4848] [--noopen]      GASP_DRY=1 → no network calls, placeholder videos.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { imageToVideo } from "./lib/fal.js";
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
function settings() { let s = {}; try { s = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")); } catch {} return { library: s.library || path.join(os.homedir(), "GASP Library"), defaultVideo: s.defaultVideo || MODELS.defaultVideo, ...s, library: s.library || path.join(os.homedir(), "GASP Library") }; }
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
function storyForApp(s) { return { ...s, episodes: s.episodes.map(ep => ({ ...ep, shots: ep.shots.map(sh => ({ ...sh, media: shotMedia(s, ep, sh), job: Object.values(JOBS).find(j => j.shot === sh.id && j.status === "running") || null })) })) }; }

// ---------- scripts: one script.txt per episode folder; old versions kept in "script history" ----------
const scriptPath = (s, ep) => path.join(storiesDir(), s.dir, ep.dir, "script.txt");
function readScript(s, ep) { try { return fs.readFileSync(scriptPath(s, ep), "utf8").replace(/\r/g, ""); } catch { return ""; } }
const SNAP = {};
function writeScript(s, ep, text, snapshot) {
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
  ep.shots = result; text = SF.renumber(text); ep.aspect = p.aspect || ""; ep.style = p.style || "";
  return { text, created, updated, createdIds, orphans: orphanMode === "add" ? [] : orphans.map(o => ({ id: o.id, title: o.title })) };
}

function updateShot(s, ep, sh, f) {
  for (const k of ["title", "imagePrompt", "motionPrompt", "notes", "model", "seconds", "show"]) if (k in f) sh[k] = f[k];
  scriptEdit(s, ep, t => { if ("imagePrompt" in f) t = SF.setField(t, sh.id, "image", f.imagePrompt); if ("motionPrompt" in f) t = SF.setField(t, sh.id, "motion", f.motionPrompt); if ("notes" in f) t = SF.setField(t, sh.id, "note", f.notes); if ("title" in f || "seconds" in f) t = SF.setCallout(t, sh.id, { title: sh.title, seconds: sh.seconds || null }); return t; });
}

// ---------- chat: one conversation per story, kept in its folder ----------
const chatFile = s => path.join(storiesDir(), s.dir, "chat.json");
function readChat(s) { try { return JSON.parse(fs.readFileSync(chatFile(s), "utf8")); } catch { return { messages: [] }; } }
function writeChat(s, c) { fs.writeFileSync(chatFile(s), JSON.stringify(c, null, 1)); }
function chatSetting() { const st = settings(); if (st.chat && st.chat.model) return st.chat; return process.env.FAL_KEY || !process.env.GROQ_API_KEY ? { provider: "fal", model: CHAT_MODELS[0].model } : { provider: "groq", model: "openai/gpt-oss-120b" }; }
const chatForApp = c => ({ messages: c.messages.map((m, i) => ({ i, cutOff: m.cutOff, role: m.role, text: m.role === "assistant" ? splitActions(m.content).shown : m.content, actions: m.actions || [], at: m.at, model: m.model, cost: m.cost, error: m.error, ep: m.ep })) });
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
  "GET /api/state": () => { const s = settings(); const { own, old } = loadKeys(); return { chatModels: CHAT_MODELS, chat: chatSetting(), pid: process.pid, version: "2.0-step4", dry: !!process.env.GASP_DRY, library: s.library, defaultVideo: s.defaultVideo, keys: Object.fromEntries(KEY_NAMES.map(k => [k, own[k] ? "set" : old[k] ? "from 1.0" : ""])), models: MODELS.video, stories: listStories(), spend: readSpend().total }; },
  "POST /api/settings": async (req) => { const b = await body(req); if (b.keys) saveKeys(b.keys); const patch = {}; if (b.library) patch.library = path.resolve(String(b.library)); if (b.defaultVideo && MODELS.video[b.defaultVideo]) patch.defaultVideo = b.defaultVideo; if (b.chat && b.chat.model && ["fal", "groq"].includes(b.chat.provider)) patch.chat = { provider: b.chat.provider, model: String(b.chat.model).trim() }; if (Object.keys(patch).length) saveSettings(patch); ensureLibrary(); return { ok: true }; },
  "GET /api/spend": () => readSpend(),
  "POST /api/story/new": async (req) => { const b = await body(req); return storyForApp(createStory(b.title || "New story")); },
  "GET /api/story": (req, url) => { const s = loadStory(url.searchParams.get("id")); s.opened = Date.now(); const out = { ...s }; delete out.dir; fs.writeFileSync(path.join(storiesDir(), s.dir, "story.json"), JSON.stringify(out, null, 2)); return storyForApp(s); },
  "POST /api/story/rename": async (req) => { const b = await body(req); const s = loadStory(b.id); s.title = clean(b.title); return storyForApp(saveStory(s)); },
  "POST /api/episode/new": async (req) => { const b = await body(req); const s = loadStory(b.story); s.episodes.push({ id: newId(), title: b.title || `Episode ${s.episodes.length + 1}`, shots: [] }); return storyForApp(saveStory(s)); },
  "POST /api/episode/rename": async (req) => { const b = await body(req); const s = loadStory(b.story); epOf(s, b.ep).title = String(b.title || "").slice(0, 80); return storyForApp(saveStory(s)); },
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
  "GET /api/script": (req, url) => { const s = loadStory(url.searchParams.get("story")); const ep = epOf(s, url.searchParams.get("ep")); return { text: readScript(s, ep), path: scriptPath(s, ep) }; },
  "POST /api/script/save": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); writeScript(s, ep, String(b.text || "").replace(/\r/g, ""), false); return { ok: true }; },
  "POST /api/script/sync": async (req) => { const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const r = syncScript(s, ep, String(b.text ?? readScript(s, ep)).replace(/\r/g, ""), b.orphans); saveStory(s); writeScript(s, ep, r.text, true); return { story: storyForApp(s), text: r.text, created: r.created, updated: r.updated, orphans: r.orphans }; },
  "GET /api/chat": (req, url) => chatForApp(readChat(loadStory(url.searchParams.get("story")))),
  "POST /api/chat": async (req) => {
    const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const c = readChat(s);
    const msg = String(b.message || "").trim(); if (!msg) throw httpErr(400, "empty message");
    c.messages.push({ role: "user", content: msg, at: Date.now(), ep: ep.num }); writeChat(s, c);
    const app = storyForApp(s); const epA = app.episodes.find(e => e.id === ep.id); const script = readScript(s, ep);
    const sys = systemPrompt({ guide: SF.GUIDE, story: s, ep, script, shots: epA.shots, characters: SF.parse(script).characters });
    const hist = c.messages.slice(-24).map(m => ({ role: m.role, content: m.role === "assistant" && (m.actions || []).some(a => a.state) ? m.content + "\n\n(" + m.actions.map((a, k) => `card ${k + 1}: ${a.state || "not acted on"}`).join("; ") + ")" : m.content }));
    const cs = chatSetting(); let r;
    try { r = process.env.GASP_DRY ? { text: dryReply(msg, epA.shots), tokensIn: 0, tokensOut: 0, cost: 0, ms: 600 } : await chatCall({ provider: cs.provider, model: cs.model, messages: [{ role: "system", content: sys }, ...hist] }); }
    catch (e) { c.messages.push({ role: "assistant", content: "", error: String(e.message || e), at: Date.now(), ep: ep.num }); writeChat(s, c); return chatForApp(c); }
    const { actions } = splitActions(r.text);
    c.messages.push({ role: "assistant", cutOff: !!r.cutOff, content: r.text, actions: actions.map(a => ({ ...a, state: a.action === "unreadable" ? "unreadable" : null })), at: Date.now(), model: cs.model, cost: r.cost, tokens: r.tokensIn + r.tokensOut, ep: ep.num });
    writeChat(s, c);
    logSpend({ story: s.title, episode: ep.num, shot: "", kind: "chat", model: cs.model + (process.env.GASP_DRY ? " (dry run)" : ""), seconds: 0, cost: r.cost ?? 0, file: `${r.tokensIn} in / ${r.tokensOut} out tokens${r.cost == null ? " (cost not reported)" : ""}` });
    return chatForApp(c);
  },
  "POST /api/chat/act": async (req) => {
    const b = await body(req); const s = loadStory(b.story); const ep = epOf(s, b.ep); const c = readChat(s); const m = c.messages[b.msg]; const a = m && (m.actions || [])[b.action];
    if (!a) throw httpErr(404, "That card isn't there any more.");
    let note = "";
    if (b.op === "apply") { if (a.state === "applied") throw httpErr(409, "Already applied."); const r = applyAction(s, ep, a); Object.assign(a, { state: "applied", undo: r.undo, undoScript: r.undoScript, createdIds: r.createdIds, appliedEp: ep.id }); if (r.created != null) note = `${r.created} new shot${r.created === 1 ? "" : "s"}, ${r.updated} updated${r.orphans ? `, ${r.orphans} only in Shots` : ""}`; }
    else if (b.op === "dismiss") a.state = "dismissed";
    else if (b.op === "undo") {
      if (a.state !== "applied") throw httpErr(409, "Nothing to undo.");
      const ep2 = s.episodes.find(e => e.id === a.appliedEp) || ep;
      if (a.undo) { const sh = ep2.shots.find(x => x.id === a.shot); if (sh) updateShot(s, ep2, sh, a.undo); }
      if (a.undoScript != null) {
        // shots this card made go to _Trash (with anything generated for them since), then the old script comes back
        for (const id of a.createdIds || []) { const sh = ep2.shots.find(x => x.id === id); if (sh) { try { toTrash(shotPath(s, ep2, sh), `${s.title} - ${ep2.dir} - ${sh.dir}`); } catch {} ep2.shots = ep2.shots.filter(x => x !== sh); } }
        // an append is undone by taking its shots back out, so later edits survive; a full rewrite brings the old script back
        let back = a.undoScript; if (a.action === "append_script") { back = readScript(s, ep2); for (const id of a.createdIds || []) back = SF.removeBlock(back, id); }
        writeScript(s, ep2, back, true); const r = syncScript(s, ep2, back, "keep"); writeScript(s, ep2, r.text, false);
      }
      a.state = null; delete a.undo; delete a.undoScript; delete a.createdIds;
    }
    saveStory(s); writeChat(s, c); return { chat: chatForApp(c), story: storyForApp(s), note };
  },
  "POST /api/chat/clear": async (req) => { const b = await body(req); const s = loadStory(b.story); const c = readChat(s); if (c.messages.length) { const h = path.join(storiesDir(), s.dir, "chat history"); fs.mkdirSync(h, { recursive: true }); fs.writeFileSync(path.join(h, `${stamp()}.json`), JSON.stringify(c, null, 1)); } writeChat(s, { messages: [] }); return chatForApp({ messages: [] }); },
  "GET /api/jobs": () => Object.values(JOBS).filter(j => j.status === "running" || Date.now() - (j.finished || 0) < 10 * 60e3),
  "POST /api/reveal": async (req) => { const b = await body(req); const s = loadStory(b.story); let abs = path.join(storiesDir(), s.dir); if (b.ep) { const ep = epOf(s, b.ep); abs = path.join(abs, ep.dir); if (b.shot) abs = path.join(abs, shotOf(ep, b.shot).dir); }
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
