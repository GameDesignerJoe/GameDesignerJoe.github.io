// GASP control panel: `node studio.js serve` → http://localhost:4747
// A local page that lists manifests, renders a cut with one click, streams the log, and plays the result.
// Each step runs `node studio.js <cmd> …` as a child process, so the CLI stays the single source of truth.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { slug, readJSON, dataUriToFile } from "./util.js";
import { generateStill, removeBackground } from "../providers/index.js";
import { execFileP } from "./util.js";

const STARTED = Date.now();
const MIME = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".json": "application/json", ".txt": "text/plain" };

export async function serve({ root, port = 4747, open = true }) {
  const clients = new Set();
  let job = null;          // { child, steps, i, cancelled }
  const history = [];      // last 400 log lines, replayed to new clients

  const emit = (type, data) => {
    const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    if (type === "log") { history.push(data); if (history.length > 400) history.shift(); }
    for (const c of clients) c.write(line);
  };

  const manifestFiles = () => {
    const out = fs.readdirSync(root).filter(f => f.endsWith(".json"));   // legacy: loose files in the folder
    const wd = path.join(root, "work"); if (fs.existsSync(wd)) for (const d of fs.readdirSync(wd)) { const md = path.join(wd, d, "manifests"); if (fs.existsSync(md)) for (const f of fs.readdirSync(md).filter(f => f.endsWith(".json"))) out.push(path.join("work", d, "manifests", f)); }
    return out;
  };
  const manifests = () => manifestFiles().map(f => {
    try {
      const m = readJSON(path.join(root, f));
      if (m.format !== "gate-ten-production") return null;
      return {
        file: f, title: m.story?.title || f, slug: slug(m.story?.title), mtime: fs.statSync(path.join(root, f)).mtimeMs,
        cast: (m.cast || []).map(c => ({ name: c.name, voice: !!c.voice?.id, cutouts: Object.values(c.cutouts || {}).filter(x => x.full || x.chest).length })),
        episodes: (m.episodes || []).map(e => ({
          number: e.number, title: e.title || "", runningTime: e.runningTime,
          blocks: (e.shots || []).map(s => ({ index: s.index, kind: s.interaction ? "ix" : (s.location || s.action) ? "shot" : "line", options: s.interaction ? (s.interaction.options || []).map(o => o.label + (o.cost && o.cost !== "free" ? " (" + (o.amt || 0) + " " + o.cost + ")" : "")) : undefined, cond: s.cond || "", label: s.interaction ? `◆ ${s.interaction.template}${s.interaction.type ? "/" + s.interaction.type : ""} — ${s.interaction.prompt || ""}` : `${s.frame || ""} ${s.location || ""}${s.characters?.length ? " · " + s.characters.join(", ") : ""}`.trim(), lines: (s.lines || []).length }))
        }))
      };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => b.mtime - a.mtime);


  // Work folder scan. Folders are keyed by block id (new) or block number (old renders); the manifest maps ids to numbers.
  const scanEp = (s, ep, manifestFile) => {
    const dir = path.join(root, "work", s, `ep${ep}`); const shots = {}; const segments = {};
    if (!fs.existsSync(dir)) return { shots, segments, dir };
    for (const d of fs.readdirSync(dir).filter(d => /^shot-/.test(d))) {
      const sd = path.join(dir, d); const key = d.slice(5); const u = f => `/work/${s}/ep${ep}/${d}/${f}?t=${fs.statSync(path.join(sd, f)).mtimeMs}`;
      const files = fs.readdirSync(sd); const ap = files.includes("approved.png") ? fs.readFileSync(path.join(sd, "approved.png")) : null; let approvedId = null;
      const takes = files.filter(f => f === "composite.png" || /^take-\d+\.png$/.test(f)).map(f => { const id = f === "composite.png" ? "composite" : f.match(/\d+/)[0]; if (ap && fs.readFileSync(path.join(sd, f)).equals(ap)) approvedId = id; return { id, url: u(f) }; });
      const clips = ["clip-lipsync.mp4", "clip.mp4", "clip-loop.mp4", "clip-lipsync-loop.mp4"].filter(f => files.includes(f)).map(f => ({ name: f === "clip.mp4" ? "generated clip (no lip-sync)" : f === "clip-lipsync.mp4" ? "lip-synced clip" : "seamless loop", url: u(f) }));
      const segf = path.join(dir, `seg-${key}.mp4`);
      shots[/^\d+$/.test(key) ? +key : key] = { key, approved: ap ? u("approved.png") : null, approvedId, takes, clips, clip: clips.length > 0, segment: fs.existsSync(segf) ? `/work/${s}/ep${ep}/seg-${key}.mp4?t=${fs.statSync(segf).mtimeMs}` : null };
    }
    for (const f of fs.readdirSync(dir)) { const m = f.match(/^seg-([A-Za-z0-9_-]+)\.mp4$/); if (m) segments[/^\d+$/.test(m[1]) ? +m[1] : m[1]] = `/work/${s}/ep${ep}/${f}?t=${fs.statSync(path.join(dir, f)).mtimeMs}`; }
    // map ids → block numbers when a manifest is given (for the Render tab's numbered strip)
    if (manifestFile && fs.existsSync(manifestFile)) { try { const m = readJSON(manifestFile); const e = (m.episodes || []).find(x => String(x.number) === String(ep)); for (const sh of e?.shots || []) { if (sh.id && shots[sh.id] && !shots[sh.index]) shots[sh.index] = shots[sh.id]; if (sh.id && segments[sh.id] && !segments[sh.index]) segments[sh.index] = segments[sh.id]; } } catch {} }
    return { shots, segments, dir };
  };

  const safe = f => { const p = path.resolve(root, String(f || "")); if (!p.startsWith(root)) throw new Error("bad path"); return p; };
  const outputFor = (file, ep) => {
    const m = readJSON(safe(file)); const sl = slug(m.story?.title); const dir = path.join(root, "work", sl, `ep${ep}`);
    const video = path.join(dir, `ep${ep}-animatic.mp4`); const cost = path.join(dir, `ep${ep}-cost.json`);
    const scan = scanEp(sl, ep, safe(file)); const e = (m.episodes || []).find(x => String(x.number) === String(ep));
    const shots = (e?.shots || []).filter(x => !x.interaction && (x.location || x.action)).map(x => { const i = scan.shots[x.id] || scan.shots[x.index] || {}; return { shot: x.index, approved: i.approved || null, takes: (i.takes || []).filter(t => t.id !== "composite").length, clip: !!i.clip }; });
    return { video: fs.existsSync(video) ? `/work/${sl}/ep${ep}/ep${ep}-animatic.mp4?t=${fs.statSync(video).mtimeMs}` : null, cost: fs.existsSync(cost) ? readJSON(cost).total : 0, shots };
  };

  function runSteps({ file, ep, until, from, shot, steps, dry, force, thenAssemble, path: choicePath, approveLatest, segmentsOnly, takes }) {
    if (job) throw new Error("a render is already running");
    if (thenAssemble) steps = [...steps, "animatic"];
    job = { steps, i: 0, cancelled: false };
    emit("status", { running: true, step: steps[0] });
    const next = () => {
      if (job.cancelled || job.i >= steps.length) { const ok = !job.cancelled; job = null; emit("status", { running: false }); emit("done", { ok, file, ep }); return; }
      const step = steps[job.i++];
      const argv = [path.join(root, "studio.js"), step, file, "--ep", String(ep)];
      if (until) argv.push("--until", String(until));
      if (from) argv.push("--from", String(from));
      if (choicePath) argv.push("--path", String(choicePath));
      if (shot && step !== "animatic") argv.push("--shot", String(shot));
      if (step === "composite" || (force && (step === "vo" || step === "beds"))) argv.push("--force");
      if (step === "stills") { argv.push("--auto"); if (approveLatest) argv.push("--approveLatest"); if (takes && +takes > 1) argv.push("--takes", String(+takes)); }
      if (step === "animatic" && (segmentsOnly || (thenAssemble && shot))) argv.push("--segonly");
      emit("log", `\n▶ ${step}${from || until ? " (blocks " + (from || 1) + "–" + ((until || 0) - 1 || "end") + ")" : " (whole episode)"}`);
      emit("status", { running: true, step });
      const child = spawn(process.execPath, argv, { cwd: root, windowsHide: true, env: { ...process.env, STUDIO_DRY_RUN: dry || process.env.STUDIO_DRY_FORCE ? "1" : "" } });
      job.child = child;
      const pipe = s => { let buf = ""; s.on("data", d => { buf += d.toString(); const parts = buf.split(/\r?\n/); buf = parts.pop(); for (const p of parts) if (p.trim()) emit("log", p); }); s.on("end", () => { if (buf.trim()) emit("log", buf); }); };
      pipe(child.stdout); pipe(child.stderr);
      child.on("close", code => { if (code !== 0 && !job?.cancelled) { emit("log", `✖ ${step} failed (exit ${code})`); job.cancelled = true; } next(); });
    };
    next();
  }


  const genJobs = new Map();
  const jobsDir = path.join(root, "work", "_jobs"); fs.mkdirSync(jobsDir, { recursive: true });
  for (const f of fs.readdirSync(jobsDir).filter(f => f.endsWith(".json"))) { try { const j = readJSON(path.join(jobsDir, f)); if (j.status === "running") j.status = "lost"; genJobs.set(j.id, j); } catch {} }
  const jobSave = j => { try { fs.writeFileSync(path.join(jobsDir, j.id + ".json"), JSON.stringify(j)); } catch {} };
  const jobDrop = id => { genJobs.delete(id); try { fs.unlinkSync(path.join(jobsDir, id + ".json")); } catch {} };
  // ---- per-story asset library: work/<slug>/assets/<folder>/ (cover, characters/<name>, locations/<name>, items)
  const storyDir = sl => path.join(root, "work", String(sl || "assets").replace(/[^a-z0-9-]/g, "") || "assets");
  const assetsDir = sl => path.join(storyDir(sl), "assets");
  const cleanFolder = f => String(f || "").split(/[\\/]+/).map(x => x.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")).filter(Boolean).slice(0, 3).join("/");
  const idxFile = sl => path.join(assetsDir(sl), ".index.json");
  const idxRead = sl => { try { return readJSON(idxFile(sl)); } catch { return {}; } };
  const idxAdd = (sl, entries) => { const i = idxRead(sl); Object.assign(i, entries); fs.mkdirSync(assetsDir(sl), { recursive: true }); fs.writeFileSync(idxFile(sl), JSON.stringify(i)); };
  const sha = s => crypto.createHash("sha1").update(s).digest("hex");
  const IMG = /\.(png|jpe?g|webp)$/i;
  function assetList(sl, folder) {
    const base = assetsDir(sl); const folders = {}; const files = [];
    const walk = (d, rel) => { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) { if (e.name.startsWith(".") || e.name.startsWith("_")) continue; const r = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) { walk(path.join(d, e.name), r); continue; }
        if (!IMG.test(e.name) || /-ref\d+\.|-small\./.test(e.name)) continue;
        folders[rel] = (folders[rel] || 0) + 1;
        if (folder == null || folder === "*" || rel === folder || rel.startsWith(folder + "/")) { const st = fs.statSync(path.join(d, e.name)); files.push({ rel: r, folder: rel, name: e.name, at: st.mtimeMs, url: "/work/" + path.relative(path.join(root, "work"), path.join(d, e.name)).split(path.sep).map(encodeURIComponent).join("/") }); } } };
    walk(base, ""); files.sort((a, b) => b.at - a.at);
    return { folders: Object.entries(folders).map(([f, n]) => ({ folder: f, count: n })).sort((a, b) => a.folder.localeCompare(b.folder)), files };
  }
  async function genRun(b) {
        const dir = path.join(assetsDir(b.slug), cleanFolder(b.folder)); fs.mkdirSync(dir, { recursive: true });
        const tmp = path.join(assetsDir(b.slug), "_work"); fs.mkdirSync(tmp, { recursive: true });
        const stamp = Date.now().toString(36); const stem = `${String(b.kind || "img").replace(/[^a-z0-9-]/g, "")}-${String(b.name || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}`; const base = path.join(dir, stem); const tbase = path.join(tmp, stem);
        const refs = []; (b.refs || []).slice(0, 3).forEach((u, i) => { const f = dataUriToFile(u, `${tbase}-ref${i}.${/^data:image\/png/.test(u) ? "png" : "jpg"}`); if (f) refs.push(f); });
        const idx = {};
        const dims = { "9:16": { width: 1080, height: 1920 }, "3:4": { width: 896, height: 1200 }, "1:1": { width: 1024, height: 1024 }, "2:3": { width: 832, height: 1248 } };
        const aspect = dims[b.aspect] ? b.aspect : "3:4";
        let cost = 0; const count = Math.max(1, Math.min(4, +b.count || 1)); const results = [];
          for (let k = 0; k < count; k++) {
          const g = await generateStill({ prompt: b.prompt + (refs.length ? " Match the face and look of the reference image exactly." : ""), refs, outFile: `${base}-${k}.jpg`, aspect, size: dims[aspect], label: b.prompt.slice(0, 80), labelTitle: b.kind || "", provider: b.provider }); cost += g.cost;
          let file = g.file;
          if (b.rembg) { const raw = file; const r = await removeBackground({ file, outFile: `${base}-${k}-cut.png` }); cost += r.cost; file = r.file; try { fs.renameSync(raw, `${tbase}-${k}-raw.jpg`); } catch {} }
          // downscale for storage in the story (keeps alpha for png)
          const max = Math.max(256, Math.min(1400, +b.max || 1000)); const isPng = file.endsWith(".png"); const small = `${tbase}-${k}` + (isPng ? "-small.png" : "-small.jpg");
          await execFileP("ffmpeg", ["-y", "-i", file, "-vf", `scale='min(${max},iw)':-2`, ...(isPng ? [] : ["-q:v", "4"]), small]);
          const buf = fs.readFileSync(small); const du = `data:image/${isPng ? "png" : "jpeg"};base64,` + buf.toString("base64"); results.push(du); idx[sha(du)] = path.relative(assetsDir(b.slug), file).split(path.sep).join("/");
          }
          const dataUri = results[0]; try { idxAdd(b.slug, idx); } catch {}
          // log the spend against the story
          if (cost) { const cf = path.join(root, "work", String(b.slug || "assets").replace(/[^a-z0-9-]/g, "") || "assets", "ep0", "ep0-cost.json"); fs.mkdirSync(path.dirname(cf), { recursive: true }); const c = fs.existsSync(cf) ? readJSON(cf) : { items: [], total: 0 }; c.items.push({ kind: b.kind || "asset", amt: +cost.toFixed(4), note: b.name || "", at: new Date().toISOString() }); c.total = +(c.total + cost).toFixed(4); fs.writeFileSync(cf, JSON.stringify(c, null, 2)); }
          emit("log", `🖼 ${b.kind || "image"} for ${b.name || "?"} ($${cost.toFixed(2)})`);
          return { dataUri, results, cost };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Private-Network": "true" };
    const json = (o, code = 200) => { res.writeHead(code, { "Content-Type": "application/json", ...cors }); res.end(JSON.stringify(o)); };
    const body = () => new Promise(r => { let b = ""; req.on("data", d => b += d); req.on("end", () => { try { r(JSON.parse(b || "{}")); } catch { r({}); } }); });
    try {
      if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
      if (url.pathname === "/" || url.pathname === "/index.html") { const app = path.join(root, "app", "index.html"); if (fs.existsSync(app)) { res.writeHead(200, { "Content-Type": MIME[".html"] }); return fs.createReadStream(app).pipe(res); } res.writeHead(200, { "Content-Type": MIME[".html"] }); return res.end(PANEL); }
      if (url.pathname === "/render") { res.writeHead(200, { "Content-Type": MIME[".html"] }); return res.end(url.searchParams.get("embed") ? PANEL.replace("<header>", "<header style=\"display:none\">").replace("height:calc(100vh - 50px)", "height:100vh") : PANEL); }
      if (/^\/(icon-\d+|favicon-\d+|logo)\.(png|jpg)$/.test(url.pathname)) { const f = path.join(root, "app", url.pathname.slice(1)); if (fs.existsSync(f)) { res.writeHead(200, { "Content-Type": MIME[path.extname(f)] }); return fs.createReadStream(f).pipe(res); } }
      if (url.pathname === "/favicon.ico") { const f = path.join(root, "app", "favicon-32.png"); if (fs.existsSync(f)) { res.writeHead(200, { "Content-Type": "image/png" }); return fs.createReadStream(f).pipe(res); } }
      if (url.pathname === "/gasp-shim.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return fs.createReadStream(path.join(root, "app", "gasp-shim.js")).pipe(res); }
      const shotFolder = (sl, ep, shot, file) => { const scan = scanEp(sl, ep, file ? safe(file) : null); const i = scan.shots[shot] || scan.shots[+shot]; return i ? path.join(scan.dir, `shot-${i.key}`) : path.join(scan.dir, `shot-${String(shot).padStart(2, "0")}`); };
      // ---- in-app asset generation: { prompt, refs:[dataURI], aspect:"3:4"|"9:16"|"1:1", rembg:bool, max:px, slug, kind, name }
      if (url.pathname === "/api/providers") { const { registry } = await import("../providers/index.js"); const list = Object.entries(registry.image).filter(([k]) => k !== "default").map(([k, v]) => ({ key: k, note: v.note || "", price: v.pricePerImage || 0, refs: !!v.supportsRefs, isDefault: registry.image.default === k, available: k.startsWith("openai") ? !!process.env.OPENAI_API_KEY : (!!process.env.FAL_KEY || !!process.env.STUDIO_DRY_RUN) })); return json({ image: list }); }
      if (url.pathname === "/api/assets" && req.method === "GET") { const f = url.searchParams.get("folder"); return json(assetList(url.searchParams.get("slug"), f == null ? "*" : cleanFolder(f))); }
      if (url.pathname === "/api/assets/have" && req.method === "POST") { const b = await body(); const i = idxRead(b.slug); return json({ missing: (b.hashes || []).filter(h => !i[h]) }); }
      if (url.pathname === "/api/assets/keep" && req.method === "POST") {
        const b = await body(); const out = []; const add = {};
        for (const it of (b.items || [])) { const m = /^data:image\/(png|jpe?g|webp);base64,/.exec(it.dataUri || ""); if (!m) continue; const h = it.hash || sha(it.dataUri);
          if (idxRead(b.slug)[h]) continue; const dir = path.join(assetsDir(b.slug), cleanFolder(it.folder)); fs.mkdirSync(dir, { recursive: true });
          const f = path.join(dir, `${String(it.name || "image").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "image"}-${h.slice(0, 8)}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
          if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(it.dataUri.slice(m[0].length), "base64"));
          add[h] = path.relative(assetsDir(b.slug), f).split(path.sep).join("/"); out.push(add[h]); }
        if (out.length) idxAdd(b.slug, add); return json({ kept: out });
      }
      if (url.pathname === "/api/gen/jobs/remove" && req.method === "POST") { const b = await body(); const j = genJobs.get(b.id); if (j && j.results) { j.results.splice(+b.index, 1); if (!j.results.length) jobDrop(b.id); else jobSave(j); } return json({ ok: true }); }
      if (url.pathname === "/api/gen/jobs") { if (req.method === "DELETE") { const b = await body(); jobDrop(b.id); return json({ ok: true }); } return json({ jobs: [...genJobs.values()].sort((a, b) => a.at - b.at).map(j => ({ id: j.id, status: j.status, kind: j.kind, name: j.name, title: j.title, prompt: j.prompt, at: j.at, cost: j.cost, error: j.error, target: j.target, slug: j.slug, results: j.status === "done" ? j.results : undefined, count: j.count })) }); }
      if (url.pathname === "/api/gen/image" && req.method === "POST") {
        const b = await body(); if (!b.prompt) return json({ error: "prompt required" }, 400);
        if (!process.env.STUDIO_DRY_RUN && !(String(b.provider || "").startsWith("openai") ? process.env.OPENAI_API_KEY : process.env.FAL_KEY)) return json({ error: (String(b.provider || "").startsWith("openai") ? "OPENAI_API_KEY" : "FAL_KEY") + " missing in .env" }, 401);
        if (b.async) { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); const job = { id, status: "running", kind: b.kind, name: b.name, title: b.title || "", prompt: b.prompt, at: Date.now(), count: +b.count || 1, cost: 0 }; job.target = b.target || null; job.slug = b.slug || ""; genJobs.set(id, job); jobSave(job); emit("gen", { id, status: "running", title: job.title }); genRun(b).then(r => { Object.assign(job, { status: "done", results: r.results, cost: r.cost }); jobSave(job); emit("gen", { id, status: "done", title: job.title }); }).catch(e => { Object.assign(job, { status: "failed", error: e.message }); jobSave(job); emit("gen", { id, status: "failed", title: job.title, error: e.message }); }); return json({ jobId: id }); }
        try { return json(await genRun(b)); } catch (e) { return json({ error: e.message }, 500); }
      }
      if (url.pathname === "/api/voices/cast" && req.method === "POST") {
        const key = process.env.ELEVENLABS_API_KEY; if (!key) return json({ error: "ELEVENLABS_API_KEY missing in .env" }, 401); const b = await body(); const H = { "xi-api-key": key };
        const txt = `${b.look || ""} ${b.direction || ""} ${b.name || ""}`.toLowerCase();
        const gender = /\b(she|her|woman|girl|female|actress|mother|sister|wife|daughter)\b/.test(txt) ? "female" : /\b(he|him|man|guy|male|father|brother|husband|son)\b/.test(txt) ? "male" : b.role === "FL" ? "female" : b.role === "ML" || b.role === "villain" ? "male" : "";
        const age = /\b(teen|young|20s|twenties|girl|boy)\b/.test(txt) ? "young" : /\b(old|elderly|grandmother|grandfather|60s|70s)\b/.test(txt) ? "old" : "middle_aged";
        const words = String(b.direction || "").split(/[^a-z]+/i).filter(w => w.length > 3).slice(0, 2).join(" ");
        const tryQ = async (q) => { const p = new URLSearchParams({ page_size: "20" }); if (gender) p.set("gender", gender); if (age) p.set("age", age); if (q) p.set("search", q); const r = await fetch("https://api.elevenlabs.io/v1/shared-voices?" + p, { headers: H }).then(r => r.json()).catch(() => ({})); return (r.voices || []).filter(v => v.preview_url); };
        let list = words ? await tryQ(words) : []; if (!list.length) list = await tryQ(""); if (!list.length) return json({ error: "no voice found for " + (gender || "any") + "/" + age }, 404);
        const v = list[Math.floor(Math.random() * Math.min(5, list.length))];
        const add = await fetch(`https://api.elevenlabs.io/v1/voices/add/${v.public_owner_id}/${v.voice_id}`, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ new_name: `${b.name || v.name} (${v.name})` }) }).then(r => r.json()).catch(() => ({}));
        return json({ voice_id: add.voice_id || v.voice_id, name: v.name, gender, age, preview_url: v.preview_url });
      }
      if (url.pathname === "/api/voices") {
        const key = process.env.ELEVENLABS_API_KEY; if (!key) return json({ error: "ELEVENLABS_API_KEY missing in .env" }, 401);
        const q = (url.searchParams.get("q") || "").toLowerCase(); const H = { "xi-api-key": key };
        const mine = await fetch("https://api.elevenlabs.io/v1/voices", { headers: H }).then(r => r.json()).catch(() => ({}));
        const p = new URLSearchParams({ page_size: "60" }); for (const k of ["gender", "age", "accent"]) if (url.searchParams.get(k)) p.set(k, url.searchParams.get(k)); if (q) p.set("search", q);
        const lib = await fetch("https://api.elevenlabs.io/v1/shared-voices?" + p, { headers: H }).then(r => r.json()).catch(() => ({}));
        const norm = (v, source) => ({ voice_id: v.voice_id, name: v.name, preview_url: v.preview_url, description: v.description || "", gender: v.labels?.gender || v.gender || "", age: v.labels?.age || v.age || "", accent: v.labels?.accent || v.accent || "", public_owner_id: v.public_owner_id, source });
        const m = (mine.voices || []).map(v => norm(v, "mine")).filter(v => !q || (v.name + " " + v.description).toLowerCase().includes(q));
        const l = (lib.voices || []).map(v => norm(v, "library")).filter(v => !m.some(x => x.voice_id === v.voice_id));
        return json({ voices: [...m, ...l] });
      }
      if (url.pathname === "/api/voices/add" && req.method === "POST") {
        const key = process.env.ELEVENLABS_API_KEY; if (!key) return json({ error: "ELEVENLABS_API_KEY missing" }, 401); const b = await body();
        const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${b.public_owner_id}/${b.voice_id}`, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ new_name: b.name }) });
        const o = await r.json().catch(() => ({})); if (!r.ok) return json({ error: o.detail?.message || o.detail || r.statusText }, r.status); return json({ voice_id: o.voice_id || b.voice_id });
      }
      if (url.pathname === "/api/loop" && req.method === "POST") { const b = await body(); const sl = String(b.slug || "").replace(/[^a-z0-9-]/g, ""); const sd = shotFolder(sl, b.ep, b.shot, null); const src = path.join(sd, b.file === "clip-lipsync.mp4" ? "clip-lipsync.mp4" : "clip.mp4"); if (!fs.existsSync(src)) return json({ error: "no clip to loop" }, 404); const out = src.replace(/\.mp4$/, "-loop.mp4");
        // ping-pong: forward then reversed, trimmed a few frames at the turn so the reversal doesn't stutter
        try { await execFileP("ffmpeg", ["-y", "-i", src, "-filter_complex", "[0:v]split[a][b];[b]reverse,trim=start_frame=2[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]", "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", out]); emit("log", `↻ loop made for shot ${b.shot}`); return json({ ok: true }); } catch (e) { return json({ error: e.message }, 500); } }
      if (url.pathname === "/api/take" && req.method === "DELETE") { const b = await body(); const sl = String(b.slug || "").replace(/[^a-z0-9-]/g, ""); const sd = shotFolder(sl, b.ep, b.shot, null); const f = path.join(sd, b.take === "composite" ? "composite.png" : `take-${String(b.take).replace(/\D/g, "")}.png`); if (fs.existsSync(f)) { const ap = path.join(sd, "approved.png"); const wasApproved = fs.existsSync(ap) && fs.readFileSync(ap).equals(fs.readFileSync(f)); fs.unlinkSync(f); if (wasApproved) { const rest = fs.readdirSync(sd).filter(x => x === "composite.png" || /^take-\d+\.png$/.test(x)).sort(); if (rest.length) fs.copyFileSync(path.join(sd, rest[rest.length - 1]), ap); else fs.unlinkSync(ap); } } return json({ ok: true }); }
      if (url.pathname === "/api/cost") { const sl = String(url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/g, ""); const dir = path.join(root, "work", sl); const episodes = []; let total = 0; if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir).filter(d => /^ep\d+$/.test(d))) { const f = path.join(dir, d, `${d}-cost.json`); if (fs.existsSync(f)) { const t = readJSON(f).total || 0; episodes.push({ episode: +d.slice(2), total: t }); total += t; } } return json({ total: +total.toFixed(2), episodes }); }
      // restart in place after an update: hand the port to a fresh copy of the server, then step aside
      if (url.pathname === "/api/restart" && req.method === "POST") {
        json({ ok: true, pid: process.pid });
        setTimeout(() => { try { server.close(); server.closeAllConnections && server.closeAllConnections(); } catch {}
          spawn(process.execPath, [path.join(root, "studio.js"), "serve", "--noopen", "--port", String(port)], { cwd: root, detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, GASP_RESTART: "1" } }).unref();
          setTimeout(() => process.exit(0), 300); }, 150);
        return;
      }
      if (url.pathname === "/api/update" && req.method === "POST") {
        try { const before = (await execFileP("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim(); const pull = await execFileP("git", ["pull", "--ff-only"], { cwd: root }); const after = (await execFileP("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
          if (before === after) return json({ changed: false }); const files = (await execFileP("git", ["diff", "--name-only", before, after], { cwd: root })).stdout.split("\n").filter(Boolean);
          const needsRestart = files.some(f => f.includes("gasp-studio/") && !f.includes("gasp-studio/app/")); emit("log", `⬆ updated ${before.slice(0, 7)} → ${after.slice(0, 7)} (${files.length} files)`); return json({ changed: true, needsRestart, files }); }
        catch (e) { return json({ error: (e.stderr || e.message || "").toString().trim().split("\n").pop() }, 500); }
      }
      if (url.pathname === "/api/info") return json({ pid: process.pid, started: STARTED, anthropic: !!process.env.ANTHROPIC_API_KEY, fal: !!process.env.FAL_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY, root });
      // ---- story storage: /api/db?path=stories/<id>  → stories/<path>.json
      if (url.pathname === "/api/db") {
        const rel = String(url.searchParams.get("path") || (req.method === "POST" ? (await (async () => { const b = await body(); req._b = b; return b.path; })()) : "")).replace(/[^a-zA-Z0-9_\-\/]/g, "");
        if (!rel) return json({ error: "path required" }, 400);
        const f = path.join(root, "stories", rel + ".json");
        if (req.method === "GET") return json({ data: fs.existsSync(f) ? readJSON(f) : null });
        if (req.method === "POST") { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(req._b.data)); return json({ ok: true }); }
        if (req.method === "DELETE") { if (fs.existsSync(f)) fs.unlinkSync(f); return json({ ok: true }); }
      }
      // ---- Claude proxy (key stays in .env)
      if (url.pathname === "/api/claude" && req.method === "POST") {
        const key = process.env.ANTHROPIC_API_KEY; if (!key) return json({ error: "ANTHROPIC_API_KEY missing in .env", code: "not_granted" }, 401);
        const b = await body(); const model = b.tier === "quick" ? (process.env.CLAUDE_QUICK_MODEL || "claude-haiku-5-5") : (process.env.CLAUDE_MODEL || "claude-sonnet-5-5");
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 4000, messages: b.messages }) });
        const o = await r.json().catch(() => ({}));
        if (!r.ok) return json({ error: o.error?.message || r.statusText, code: r.status === 401 ? "not_granted" : r.status === 429 ? "rate_limited" : "upstream_error" }, r.status);
        return json({ text: (o.content || []).map(c => c.text || "").join("") });
      }
      // ---- exports → exports/<filename>
      if (url.pathname === "/api/export" && req.method === "POST") { const b = await body(); const name = String(b.filename || "export.txt").replace(/[^a-zA-Z0-9._-]+/g, "-"); const dir = path.join(root, "exports"); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), b.data || ""); emit("log", `💾 exported ${name} → exports\\${name}`); return json({ ok: true, file: path.join(dir, name) }); }
      if (url.pathname === "/api/manifests") return json({ root, manifests: manifests(), running: !!job, dryDefault: !!process.env.STUDIO_DRY_RUN, keys: { fal: !!process.env.FAL_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY } });
      if (url.pathname === "/api/output") return json(outputFor(url.searchParams.get("file"), url.searchParams.get("ep")));
      if (url.pathname === "/api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...cors });
        for (const h of history) res.write(`event: log\ndata: ${JSON.stringify(h)}\n\n`);
        res.write(`event: status\ndata: ${JSON.stringify({ running: !!job, step: job ? job.steps[job.i - 1] : null })}\n\n`);
        clients.add(res); req.on("close", () => clients.delete(res)); return;
      }
      if (url.pathname === "/api/run" && req.method === "POST") { const b = await body(); try { runSteps(b); return json({ ok: true }); } catch (e) { return json({ error: e.message }, 409); } }
      if (url.pathname === "/api/stop" && req.method === "POST") { if (job) { job.cancelled = true; job.child?.kill(); } return json({ ok: true }); }
      if (url.pathname === "/api/shots") { const sl = String(url.searchParams.get("slug") || "").replace(/[^a-z0-9-]/g, ""); const ep = String(+url.searchParams.get("ep") || 1); const { shots, segments } = scanEp(sl, ep, null); return json({ shots, segments }); }
      // hand-staged composite from the app's stage editor: becomes composite.png (and the image in use); studio won't overwrite it
      if (url.pathname === "/api/stage" && req.method === "POST") {
        const b = await body(); const sl = String(b.slug || "").replace(/[^a-z0-9-]/g, ""); const m = /^data:image\/png;base64,/.exec(b.png || "");
        if (!sl || !m) return json({ error: "slug and png required" }, 400);
        const sd = path.join(root, "work", sl, `ep${+b.ep || 1}`, `shot-${String(b.shot).replace(/[^A-Za-z0-9_-]/g, "")}`); fs.mkdirSync(sd, { recursive: true });
        if (b.clear) { try { fs.unlinkSync(path.join(sd, "staged.json")); } catch {} return json({ ok: true }); }
        fs.writeFileSync(path.join(sd, "composite.png"), Buffer.from(b.png.slice(m[0].length), "base64"));
        fs.copyFileSync(path.join(sd, "composite.png"), path.join(sd, "approved.png"));
        fs.writeFileSync(path.join(sd, "staged.json"), JSON.stringify({ at: new Date().toISOString(), layers: b.layers || [] }, null, 1));
        emit("log", `🎬 staged composite saved for shot ${b.shot}`); return json({ ok: true });
      }
      if (url.pathname === "/api/approve" && req.method === "POST") { const b = await body(); const sl = b.slug ? String(b.slug).replace(/[^a-z0-9-]/g, "") : slug(readJSON(safe(b.file)).story?.title); const sd = shotFolder(sl, b.ep, b.shot, b.file); const src = path.join(sd, b.take === "composite" ? "composite.png" : `take-${b.take}.png`); if (!fs.existsSync(src)) return json({ error: "no such take" }, 404); fs.copyFileSync(src, path.join(sd, "approved.png")); return json({ ok: true }); }
      if (url.pathname === "/api/takes") { const file = url.searchParams.get("file"); const m = readJSON(safe(file)); const sl = slug(m.story?.title); const ep = url.searchParams.get("ep"); const scan = scanEp(sl, ep, safe(file)); const i = scan.shots[+url.searchParams.get("shot")] || {}; return json({ approved: i.approvedId || null, clips: i.clips || [], segment: i.segment || null, takes: i.takes || [] }); }
      if (url.pathname === "/api/manifest" && req.method === "POST") {
        // "Send to GASP" from the Write tabs: { name, manifest }
        const b = await body(); const m = b.manifest; if (!m || m.format !== "gate-ten-production") return json({ error: "not a production manifest" }, 400);
        const name = (b.name || `${slug(m.story?.title)}-production`).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/\.json$/, "") + ".json";
        const mdir = path.join(root, "work", slug(m.story?.title), "manifests"); fs.mkdirSync(mdir, { recursive: true }); const rel = path.join("work", slug(m.story?.title), "manifests", name);
        fs.writeFileSync(path.join(root, rel), JSON.stringify(m)); emit("log", `📥 ${name} → ${path.dirname(rel)}`); emit("manifest", { file: rel }); return json({ ok: true, file: rel });
      }
      if (url.pathname.startsWith("/work/")) {
        const f = path.join(root, decodeURIComponent(url.pathname)); if (!f.startsWith(path.join(root, "work")) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
        const ext = path.extname(f); const stat = fs.statSync(f);
        // range support so the <video> can seek
        const range = req.headers.range; if (range && ext === ".mp4") { const [a, b] = range.replace("bytes=", "").split("-").map(Number); const start = a || 0, end = b || stat.size - 1; res.writeHead(206, { "Content-Type": MIME[ext], "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 }); return fs.createReadStream(f, { start, end }).pipe(res); }
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": stat.size, "Accept-Ranges": "bytes" }); return fs.createReadStream(f).pipe(res);
      }
      res.writeHead(404); res.end("not found");
    } catch (e) { json({ error: e.message }, 500); }
  });
  const addr = `http://localhost:${port}`;
  const openBrowser = () => { if (!open) return; const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", addr]] : process.platform === "darwin" ? ["open", [addr]] : ["xdg-open", [addr]]; try { spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref(); } catch {} };
  const tryListen = () => new Promise(r => { server.once("error", e => r(e.code === "EADDRINUSE" ? false : (() => { throw e; })())); server.listen(port, "127.0.0.1", () => r(true)); });
  let ok = await tryListen();
  // a restart hands the port over: wait for the old copy to let go
  for (let i = 0; !ok && process.env.GASP_RESTART && i < 40; i++) { await new Promise(r => setTimeout(r, 250)); ok = await tryListen(); }
  if (!ok) { console.log(`GASP Studio is already running (another window has it). Opening the panel: ${addr}`); openBrowser(); await new Promise(r => setTimeout(r, 1500)); process.exit(0); }
  console.log(`GASP Studio panel: ${addr}   (leave this window open; Ctrl+C to stop)`);
  openBrowser();
}

const PANEL = `<!doctype html><html><head><meta charset="utf-8"><title>GASP Studio</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#141118;--panel:#1d1823;--line:#2e2735;--ink:#f1e9ee;--mute:#9a8fa3;--accent:#ff4d6d;--ok:#6ee7b7;--warn:#fbbf24}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,Segoe UI,sans-serif}
header{display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--line)}header h1{font-size:17px;margin:0;letter-spacing:.3px}header h1 span{color:var(--accent)}header .sub{color:var(--mute);font-size:12px}
main{display:grid;grid-template-columns:380px 1fr;gap:0;height:calc(100vh - 50px)}
aside{border-right:1px solid var(--line);padding:16px;overflow:auto;display:flex;flex-direction:column;gap:14px;scrollbar-width:none}aside::-webkit-scrollbar{display:none}
.range{display:grid;grid-template-columns:34px 1fr;gap:6px 8px;align-items:center;margin-left:22px;font-size:12px;color:var(--mute);text-transform:none;letter-spacing:0}.range select{width:100%;padding:5px 8px;font-size:12px}
section.right{display:grid;grid-template-rows:auto 1fr;overflow:hidden}
label.f{display:flex;flex-direction:column;gap:4px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mute)}
select,input[type=number]{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit}
.steps{display:flex;flex-direction:column;gap:6px}.steps label{display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer}.steps small{color:var(--mute)}
.btn{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:12px;font:600 15px system-ui;cursor:pointer}.btn[disabled]{opacity:.45;cursor:default}.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink);font-weight:500;padding:8px}
.row{display:flex;gap:8px;align-items:center}.spacer{flex:1}
.stage{display:grid;grid-template-columns:minmax(260px,34vh) 1fr;gap:16px;padding:16px;border-bottom:1px solid var(--line);align-items:start}
video{width:100%;aspect-ratio:9/16;background:#000;border-radius:14px;border:1px solid var(--line)}
.strip{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start}.strip .th{width:72px;aspect-ratio:9/16;border-radius:8px;overflow:hidden;border:1px solid var(--line);position:relative;background:var(--panel);cursor:pointer}.strip .th img{width:100%;height:100%;object-fit:cover;display:block}.strip .th b{position:absolute;left:4px;bottom:3px;font-size:10px;background:#0008;padding:1px 5px;border-radius:5px}.strip .th.ix{display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:20px}
.meta{color:var(--mute);font-size:12px;margin-top:6px}.meta b{color:var(--ink)}
pre#log{margin:0;padding:14px 18px;overflow:auto;font:12px/1.5 Consolas,ui-monospace,monospace;color:#d8cfdd;white-space:pre-wrap;background:#100d13}
.pill{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--mute)}.pill.on{border-color:var(--ok);color:var(--ok)}.pill.off{border-color:var(--warn);color:var(--warn)}
.status{font-size:12px;color:var(--mute)}.status.run{color:var(--ok)}
.takes{position:fixed;inset:0;background:#000c;display:none;align-items:center;justify-content:center;gap:14px;padding:30px;flex-wrap:wrap;overflow:auto}.takes.open{display:flex}.takes .t{width:220px;cursor:pointer;text-align:center;color:var(--mute);font-size:12px}.takes .t img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:10px;border:2px solid transparent}.takes .t.cur img{border-color:var(--ok)}
@media(max-width:860px){main{grid-template-columns:1fr;height:auto}aside{border-right:0;border-bottom:1px solid var(--line)}.stage{grid-template-columns:1fr}}
</style></head><body>
<header><h1><span>GASP</span> Studio</h1><span class="sub">Gameplay · Animatic · Script · Production</span><span class="spacer"></span><span id="keys"></span><span id="status" class="status">idle</span></header>
<main>
<aside>
  <label class="f">Story / manifest<select id="file"></select></label><div class="row" style="gap:8px;margin-top:-6px"><label class="btn ghost" style="cursor:pointer;white-space:nowrap;padding:5px 9px;font-size:12px">Import manifest…<input type="file" id="import" accept=".json" hidden></label><span class="meta" id="mdate" style="margin:0"></span></div><div class="meta" id="folder" style="margin:0;word-break:break-all"></div>
  <label class="f">Episode<select id="ep"></select></label>
  <div class="f">Scope
    <label class="row" style="gap:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--ink)"><input type="radio" name="scope" value="all" checked> Whole episode</label>
    <label class="row" style="gap:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--ink)"><input type="radio" name="scope" value="range"> A range of blocks</label>
    <div class="range"><span>from</span><select id="from"></select><span>to</span><select id="to"></select></div>
    <label class="row" style="gap:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--ink)"><input type="radio" name="scope" value="one"> Just one shot</label>
    <div class="range"><span></span><select id="one"></select></div>
  </div>
  <div class="f" id="pathbox" style="display:none">Path through the choices<div id="path" class="range" style="margin-left:0;grid-template-columns:44px 1fr"></div><span class="meta" style="margin:0;text-transform:none;letter-spacing:0">Shots and lines that depend on a choice follow this path; the others are left out of the cut.</span></div>
  <label class="f">Preset<select id="preset"><option value="">custom</option><option value="free">Free animatic — composites, voices, beds, cut</option><option value="stills">Stills pass — generate stills, cut ($)</option><option value="motion">Motion pass — image-to-video + lip-sync, cut ($$)</option><option value="full">Everything ($$$)</option><option value="cut">Just re-cut</option></select></label>
  <div class="steps" id="steps">
    <label><input type="checkbox" data-step="composite" checked> Composite cutouts <small>free</small></label>
    <label><input type="checkbox" data-step="stills"> Generate stills <small>fal · ~$0.05–0.08 a shot</small></label>
    <label><input type="checkbox" data-step="vo" checked> Voices <small>ElevenLabs · only changed lines</small></label>
    <label><input type="checkbox" data-step="beds" checked> Ambience, SFX, music <small>ElevenLabs</small></label>
    <label><input type="checkbox" data-step="animate"> Image-to-video <small>fal · $ per second</small></label>
    <label><input type="checkbox" data-step="animatic" checked> Assemble the cut <small>free</small></label>
  </div>
  <div class="row"><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="dry"> Dry run (no network, placeholders)</label></div>
  <div class="row"><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="force"> Redo voices &amp; beds even if unchanged</label></div>
  <span class="meta" id="importinfo" style="margin:0"></span>
  <button class="btn" id="render">Render</button>
  <div class="row"><button class="btn ghost" id="stop" disabled>Stop</button><span class="spacer"></span><button class="btn ghost" id="refresh">Refresh</button></div>
  <div class="meta" id="castinfo"></div>
  <div class="meta" id="howto">From the writing tabs: Export → Production manifest JSON → <b>Save file</b>, then <b>Import manifest…</b> here (or drop the file anywhere on this page). Manifests live in this folder.</div>
</aside>
<section class="right">
  <div class="stage">
    <div><video id="video" controls playsinline></video><div class="meta" id="outmeta">No cut yet.</div></div>
    <div><div class="meta" style="margin:0 0 8px">Shots in this cut — click one to pick a take</div><div class="strip" id="strip"></div></div>
  </div>
  <pre id="log"></pre>
</section>
</main>
<div class="takes" id="takes"></div>
<script>
const $=s=>document.querySelector(s);let DATA={manifests:[]};let cur={file:null,ep:null};
const Q=new URLSearchParams(location.search);const ONLY=Q.get('slug')||'';
async function load(){DATA=await (await fetch('/api/manifests')).json();if(ONLY)DATA.manifests=DATA.manifests.filter(m=>m.slug===ONLY);const fs=$('#file');const keep=fs.value;fs.innerHTML=DATA.manifests.map(m=>'<option value="'+m.file+'">'+m.title+' — '+m.file.split(/[\\/]/).pop()+'</option>').join('')||'<option value="">'+(ONLY?'(nothing rendered for “'+(Q.get('title')||ONLY)+'” yet — use Export → Send to Render)':'(no production manifests in this folder)')+'</option>';if(keep&&[...fs.options].some(o=>o.value===keep))fs.value=keep;$('#folder').textContent='in '+DATA.root;$('#keys').innerHTML='<span class="pill '+(DATA.keys.elevenlabs?'on':'off')+'">ElevenLabs key</span> <span class="pill '+(DATA.keys.fal?'on':'off')+'">fal key</span> ';if(DATA.dryDefault)$('#dry').checked=true;onFile()}
function m(){return DATA.manifests.find(x=>x.file===$('#file').value)}
function onFile(){const mm=m();$('#mdate').textContent=mm?'manifest from '+new Date(mm.mtime).toLocaleString():'';if(!mm){$('#ep').innerHTML='';$('#strip').innerHTML='';$('#outmeta').textContent='';const v=$('#video');v.removeAttribute('src');v.dataset.src='';$('#castinfo').innerHTML='';cur={file:null,ep:null};return}const es=$('#ep');es.innerHTML=mm?mm.episodes.map(e=>'<option value="'+e.number+'">Ep '+e.number+(e.title?' — '+e.title:'')+'</option>').join(''):'';$('#castinfo').innerHTML=mm?'<b>Cast:</b> '+mm.cast.map(c=>c.name+(c.voice?' 🎙':' <span style="color:var(--warn)">no voice</span>')+(c.cutouts?' ✂'+c.cutouts:'')).join(' · '):'';onEp()}
function onEp(){const mm=m();if(!mm)return;const e=mm.episodes.find(x=>x.number==$('#ep').value);const blocks=e.blocks;const short=b=>b.kind==='ix'?'◆ choice':b.kind==='line'?'line':(b.label.split(' · ')[0].split(' ')[0]+(b.label.includes(' · ')?' · '+b.label.split(' · ')[1]:''));const opt=b=>'<option value="'+b.index+'">#'+b.index+'  '+short(b).slice(0,34)+'</option>';$('#from').innerHTML=blocks.map(opt).join('');$('#to').innerHTML=blocks.map(opt).join('');$('#to').value=blocks[blocks.length-1].index;$('#one').innerHTML=blocks.filter(b=>b.kind==='shot').map(opt).join('');const ixs=blocks.filter(b=>b.kind==='ix');$('#pathbox').style.display=ixs.length?'':'none';$('#path').innerHTML=ixs.map(b=>'<span>#'+b.index+'</span><select data-ix="'+b.index+'" title="'+b.label.replace(/"/g,'&quot;')+'">'+(b.options||[]).map((o,j)=>'<option value="'+(j+1)+'">'+(j+1)+') '+o+'</option>').join('')+'</select>').join('');cur={file:mm.file,ep:e.number};output()}
function pathArg(){return [...document.querySelectorAll('#path select')].map(s=>s.dataset.ix+'='+s.value).join(',')}
function scope(){const sc=document.querySelector('[name=scope]:checked').value;if(sc==='range'){const a=+$('#from').value,b=+$('#to').value;return{from:Math.min(a,b),until:Math.max(a,b)+1}}if(sc==='one'){const n=+$('#one').value;return{shot:n,from:n,until:n+2}}return{}}
document.querySelectorAll('#from,#to,#one').forEach(el=>el.onfocus=()=>{document.querySelector('[name=scope][value='+(el.id==='one'?'one':'range')+']').checked=true});
async function output(){if(!cur.file)return;const o=await (await fetch('/api/output?file='+encodeURIComponent(cur.file)+'&ep='+cur.ep)).json();const v=$('#video');if(o.video&&v.dataset.src!==o.video){v.src=o.video;v.dataset.src=o.video}if(!o.video){v.removeAttribute('src');v.dataset.src=''}$('#outmeta').innerHTML=o.video?'<b>ep'+cur.ep+'-animatic.mp4</b> · spend so far $'+(o.cost||0).toFixed(2):'No cut yet for this episode.';const mm=m();const e=mm.episodes.find(x=>x.number==cur.ep);$('#strip').innerHTML=e.blocks.filter(b=>b.kind!=='line').map(b=>{if(b.kind==='ix')return'<div class="th ix" title="'+b.label.replace(/"/g,'&quot;')+'">◆</div>';const s=o.shots.find(x=>x.shot===b.index);return'<div class="th" data-shot="'+b.index+'" title="'+b.label.replace(/"/g,'&quot;')+'">'+(s&&s.approved?'<img src="'+s.approved+'">':'')+'<b>#'+b.index+(s&&s.takes?' ·'+s.takes:'')+(s&&s.clip?' 🎬':'')+'</b></div>'}).join('');document.querySelectorAll('.th[data-shot]').forEach(t=>t.onclick=()=>takes(+t.dataset.shot))}
async function takes(shot){const r=await (await fetch('/api/takes?file='+encodeURIComponent(cur.file)+'&ep='+cur.ep+'&shot='+shot)).json();const box=$('#takes');if(!r.takes.length){alert('No takes for shot #'+shot+' yet.');return}const vid=(u,label)=>'<div class="t" style="width:260px;cursor:default"><video src="'+u+'" controls playsinline style="width:100%;aspect-ratio:9/16;border-radius:10px;background:#000"></video><div>'+label+'</div></div>';const seg=(r.clips||[]).map(c=>vid(c.url,c.name)).join('')+(r.segment?vid(r.segment,'this shot in the cut'):'');box.innerHTML='<div style="width:100%;color:#fff;font-size:15px">Shot #'+shot+' — click a take to make it the approved still. <button class="btn ghost" id="reshot" style="margin-left:12px">Re-render this shot</button> <button class="btn ghost" id="rebuild">Rebuild the cut with the approved takes</button> <span style="color:var(--mute)">(Esc to close)</span></div>'+seg+r.takes.map(t=>'<div class="t" data-id="'+t.id+'"><img src="'+t.url+'"><div>'+(t.id==='composite'?'composite (free)':'take '+t.id)+'</div></div>').join('');box.classList.add('open');const mark=()=>box.querySelectorAll('.t[data-id]').forEach(t=>{t.classList.toggle('cur',t.dataset.id===r.approved);const lab=t.querySelector('div');lab.textContent=(t.dataset.id==='composite'?'composite (free)':'take '+t.dataset.id)+(t.dataset.id===r.approved?' ✔ approved':'')});mark();
box.querySelectorAll('.t[data-id]').forEach(el=>el.onclick=async()=>{await fetch('/api/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:cur.file,ep:cur.ep,shot,take:el.dataset.id})});r.approved=el.dataset.id;mark();log('approved shot #'+shot+' → '+el.dataset.id);output()});
box.querySelector('#rebuild').onclick=async()=>{box.classList.remove('open');$('#log').textContent='';await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({file:cur.file,ep:cur.ep,steps:['animatic'],dry:$('#dry').checked,path:pathArg()},scope()))})};box.querySelector('#reshot').onclick=async()=>{box.classList.remove('open');$('#log').textContent='';const dry=$('#dry').checked;const r2=await (await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({file:cur.file,ep:cur.ep,steps:['composite','vo','beds'],dry,force:true,thenAssemble:true,path:pathArg()},scope(),{shot}))})).json();if(r2.error)alert(r2.error)};box.onclick=e=>{if(e.target===box)box.classList.remove('open')}}
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#takes').classList.remove('open')});
function log(s){const el=$('#log');el.textContent+=s+'\\n';el.scrollTop=el.scrollHeight}
async function importFile(f){if(!f)return;try{const m=JSON.parse(await f.text());const r=await (await fetch('/api/manifest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.name.replace(/\.json$/,''),manifest:m})})).json();if(r.error)throw new Error(r.error);log('📥 imported '+r.file+' — '+(m.story?.title||'')+', '+(m.episodes||[]).length+' episode(s)');$('#importinfo').textContent='saved '+r.file+' into '+DATA.root+' ('+new Date().toLocaleTimeString()+')'}catch(e){alert('Not a GASP production manifest: '+e.message)}}
$('#import').onchange=e=>importFile(e.target.files[0]);document.addEventListener('dragover',e=>{e.preventDefault()});document.addEventListener('drop',e=>{e.preventDefault();importFile(e.dataTransfer.files[0])});
const PRESETS={free:['composite','vo','beds','animatic'],stills:['stills','vo','beds','animatic'],motion:['animate','animatic'],full:['composite','stills','vo','beds','animate','animatic'],cut:['animatic']};
$('#preset').onchange=()=>{const v=$('#preset').value;if(!PRESETS[v])return;document.querySelectorAll('#steps input').forEach(i=>i.checked=PRESETS[v].includes(i.dataset.step))};document.querySelectorAll('#steps input').forEach(i=>i.onchange=()=>{$('#preset').value=''});
$('#file').onchange=onFile;$('#ep').onchange=onEp;$('#refresh').onclick=load;
$('#render').onclick=async()=>{const steps=[...document.querySelectorAll('#steps input:checked')].map(i=>i.dataset.step);if(!steps.length)return alert('Pick at least one step.');if(!$('#dry').checked&&steps.some(s=>s==='stills'||s==='animate')&&!confirm('Stills / image-to-video spend real money on fal. Continue?'))return;$('#log').textContent='';const r=await (await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({file:cur.file,ep:cur.ep,steps,dry:$('#dry').checked,force:$('#force').checked,path:pathArg()},scope()))})).json();if(r.error)alert(r.error)};
$('#stop').onclick=()=>fetch('/api/stop',{method:'POST'});
const es=new EventSource('/api/events');es.addEventListener('log',e=>log(JSON.parse(e.data)));es.addEventListener('status',e=>{const s=JSON.parse(e.data);$('#status').textContent=s.running?'running: '+s.step:'idle';$('#status').className='status'+(s.running?' run':'');$('#render').disabled=s.running;$('#stop').disabled=!s.running});es.addEventListener('done',e=>{const d=JSON.parse(e.data);log(d.ok?'✔ done':'■ stopped');output()});es.addEventListener('manifest',async e=>{await load();$('#file').value=JSON.parse(e.data).file;onFile()});
if(location.search.includes('embed')){$('#howto').innerHTML='From any writing tab: <b>Export → Send to Render</b> hands the current story to this tab. Import is only for manifests saved elsewhere.'}
load();
</script></body></html>`;
