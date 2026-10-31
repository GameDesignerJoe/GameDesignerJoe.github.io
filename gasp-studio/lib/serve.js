// GASP control panel: `node studio.js serve` → http://localhost:4747
// A local page that lists manifests, renders a cut with one click, streams the log, and plays the result.
// Each step runs `node studio.js <cmd> …` as a child process, so the CLI stays the single source of truth.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { slug, readJSON } from "./util.js";

const MIME = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".json": "application/json", ".txt": "text/plain" };

export async function serve({ root, port = 4747, open = true }) {
  const clients = new Set();
  let job = null;          // { child, steps, i, cancelled }
  const history = [];      // last 400 log lines, replayed to new clients

  const emit = (type, data) => {
    const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    if (type === "log") { history.push(data); if (history.length > 400) history.shift(); }
    for (const c of clients) c.write(line);
  };

  const manifests = () => fs.readdirSync(root).filter(f => f.endsWith(".json")).map(f => {
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

  const outputFor = (file, ep) => {
    const m = readJSON(path.join(root, file)); const dir = path.join(root, "work", slug(m.story?.title), `ep${ep}`);
    const video = path.join(dir, `ep${ep}-animatic.mp4`); const cost = path.join(dir, `ep${ep}-cost.json`);
    const shots = fs.existsSync(dir) ? fs.readdirSync(dir).filter(d => /^shot-\d+$/.test(d)).sort().map(d => {
      const sd = path.join(dir, d); const approved = path.join(sd, "approved.png"); const takes = fs.readdirSync(sd).filter(f => /^take-\d+\.png$/.test(f));
      return { shot: +d.slice(5), approved: fs.existsSync(approved) ? `/work/${slug(m.story?.title)}/ep${ep}/${d}/approved.png?t=${fs.statSync(approved).mtimeMs}` : null, takes: takes.length, clip: fs.existsSync(path.join(sd, "clip-lipsync.mp4")) || fs.existsSync(path.join(sd, "clip.mp4")) };
    }) : [];
    return { video: fs.existsSync(video) ? `/work/${slug(m.story?.title)}/ep${ep}/ep${ep}-animatic.mp4?t=${fs.statSync(video).mtimeMs}` : null, cost: fs.existsSync(cost) ? readJSON(cost).total : 0, shots };
  };

  function runSteps({ file, ep, until, from, shot, steps, dry, force, thenAssemble, path: choicePath }) {
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
      if (step === "stills") argv.push("--auto");
      emit("log", `\n▶ ${step}${from || until ? " (blocks " + (from || 1) + "–" + ((until || 0) - 1 || "end") + ")" : " (whole episode)"}`);
      emit("status", { running: true, step });
      const child = spawn(process.execPath, argv, { cwd: root, env: { ...process.env, STUDIO_DRY_RUN: dry ? "1" : "" } });
      job.child = child;
      const pipe = s => { let buf = ""; s.on("data", d => { buf += d.toString(); const parts = buf.split(/\r?\n/); buf = parts.pop(); for (const p of parts) if (p.trim()) emit("log", p); }); s.on("end", () => { if (buf.trim()) emit("log", buf); }); };
      pipe(child.stdout); pipe(child.stderr);
      child.on("close", code => { if (code !== 0 && !job?.cancelled) { emit("log", `✖ ${step} failed (exit ${code})`); job.cancelled = true; } next(); });
    };
    next();
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Private-Network": "true" };
    const json = (o, code = 200) => { res.writeHead(code, { "Content-Type": "application/json", ...cors }); res.end(JSON.stringify(o)); };
    const body = () => new Promise(r => { let b = ""; req.on("data", d => b += d); req.on("end", () => { try { r(JSON.parse(b || "{}")); } catch { r({}); } }); });
    try {
      if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
      if (url.pathname === "/") { res.writeHead(200, { "Content-Type": MIME[".html"] }); return res.end(PANEL); }
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
      if (url.pathname === "/api/approve" && req.method === "POST") { const b = await body(); const m = readJSON(path.join(root, b.file)); const sd = path.join(root, "work", slug(m.story?.title), `ep${b.ep}`, `shot-${String(b.shot).padStart(2, "0")}`); const src = path.join(sd, b.take === "composite" ? "composite.png" : `take-${b.take}.png`); if (!fs.existsSync(src)) return json({ error: "no such take" }, 404); fs.copyFileSync(src, path.join(sd, "approved.png")); return json({ ok: true }); }
      if (url.pathname === "/api/takes") { const m = readJSON(path.join(root, url.searchParams.get("file"))); const s = slug(m.story?.title); const ep = url.searchParams.get("ep"); const sd = path.join(root, "work", s, `ep${ep}`, `shot-${String(url.searchParams.get("shot")).padStart(2, "0")}`); const files = fs.existsSync(sd) ? fs.readdirSync(sd).filter(f => f === "composite.png" || /^take-\d+\.png$/.test(f)) : []; const segf = path.join(root, "work", s, `ep${ep}`, `seg-${String(url.searchParams.get("shot")).padStart(2, "0")}.mp4`); const ap = path.join(sd, "approved.png"); let approved = null; if (fs.existsSync(ap)) { const a = fs.readFileSync(ap); for (const f of files) if (fs.readFileSync(path.join(sd, f)).equals(a)) { approved = f === "composite.png" ? "composite" : f.match(/\d+/)[0]; break; } }
        const clips = ["clip-lipsync.mp4", "clip.mp4"].filter(f => fs.existsSync(path.join(sd, f))).map(f => ({ name: f === "clip.mp4" ? "generated clip (no lip-sync)" : "lip-synced clip", url: `/work/${s}/ep${ep}/shot-${String(url.searchParams.get("shot")).padStart(2, "0")}/${f}?t=${fs.statSync(path.join(sd, f)).mtimeMs}` }));
        return json({ approved, clips, segment: fs.existsSync(segf) ? `/work/${s}/ep${ep}/seg-${String(url.searchParams.get("shot")).padStart(2, "0")}.mp4?t=${fs.statSync(segf).mtimeMs}` : null, takes: files.map(f => ({ id: f === "composite.png" ? "composite" : f.match(/\d+/)[0], url: `/work/${s}/ep${ep}/shot-${String(url.searchParams.get("shot")).padStart(2, "0")}/${f}?t=${fs.statSync(path.join(sd, f)).mtimeMs}` })) }); }
      if (url.pathname === "/api/manifest" && req.method === "POST") {
        // "Send to GASP" from Gate Ten: { name, manifest }
        const b = await body(); const m = b.manifest; if (!m || m.format !== "gate-ten-production") return json({ error: "not a production manifest" }, 400);
        const name = (b.name || `${slug(m.story?.title)}-production`).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/\.json$/, "") + ".json";
        fs.writeFileSync(path.join(root, name), JSON.stringify(m)); emit("log", `📥 received ${name} from Gate Ten`); emit("manifest", { file: name }); return json({ ok: true, file: name });
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
  const ok = await new Promise(r => { server.once("error", e => r(e.code === "EADDRINUSE" ? false : (() => { throw e; })())); server.listen(port, "127.0.0.1", () => r(true)); });
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
  <label class="f">Story / manifest<select id="file"></select></label><div class="meta" id="folder" style="margin:-6px 0 0;word-break:break-all"></div>
  <label class="f">Episode<select id="ep"></select></label>
  <div class="f">Scope
    <label class="row" style="gap:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--ink)"><input type="radio" name="scope" value="all" checked> Whole episode</label>
    <label class="row" style="gap:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--ink)"><input type="radio" name="scope" value="range"> A range of blocks</label>
    <div class="range"><span>from</span><select id="from"></select><span>to</span><select id="to"></select></div>
    <label class="row" style="gap:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--ink)"><input type="radio" name="scope" value="one"> Just one shot</label>
    <div class="range"><span></span><select id="one"></select></div>
  </div>
  <div class="f" id="pathbox" style="display:none">Path through the choices<div id="path" class="range" style="margin-left:0;grid-template-columns:44px 1fr"></div><span class="meta" style="margin:0;text-transform:none;letter-spacing:0">Shots and lines that depend on a choice follow this path; the others are left out of the cut.</span></div>
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
  <div class="row"><label class="btn ghost" style="cursor:pointer;white-space:nowrap">Import manifest…<input type="file" id="import" accept=".json" hidden></label><span class="meta" id="importinfo" style="margin:0"></span></div>
  <button class="btn" id="render">Render</button>
  <div class="row"><button class="btn ghost" id="stop" disabled>Stop</button><span class="spacer"></span><button class="btn ghost" id="refresh">Refresh</button></div>
  <div class="meta" id="castinfo"></div>
  <div class="meta">In Gate Ten: Export → Production manifest JSON → <b>Save file</b>, then <b>Import manifest…</b> here (or drop the file anywhere on this page). Manifests live in this folder.</div>
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
async function load(){DATA=await (await fetch('/api/manifests')).json();const fs=$('#file');const keep=fs.value;fs.innerHTML=DATA.manifests.map(m=>'<option value="'+m.file+'">'+m.title+' — '+m.file+'</option>').join('')||'<option value="">(no production manifests in this folder)</option>';if(keep&&[...fs.options].some(o=>o.value===keep))fs.value=keep;$('#folder').textContent='in '+DATA.root;$('#keys').innerHTML='<span class="pill '+(DATA.keys.elevenlabs?'on':'off')+'">ElevenLabs key</span> <span class="pill '+(DATA.keys.fal?'on':'off')+'">fal key</span> ';if(DATA.dryDefault)$('#dry').checked=true;onFile()}
function m(){return DATA.manifests.find(x=>x.file===$('#file').value)}
function onFile(){const mm=m();const es=$('#ep');es.innerHTML=mm?mm.episodes.map(e=>'<option value="'+e.number+'">Ep '+e.number+(e.title?' — '+e.title:'')+'</option>').join(''):'';$('#castinfo').innerHTML=mm?'<b>Cast:</b> '+mm.cast.map(c=>c.name+(c.voice?' 🎙':' <span style="color:var(--warn)">no voice</span>')+(c.cutouts?' ✂'+c.cutouts:'')).join(' · '):'';onEp()}
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
async function importFile(f){if(!f)return;try{const m=JSON.parse(await f.text());const r=await (await fetch('/api/manifest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.name.replace(/\.json$/,''),manifest:m})})).json();if(r.error)throw new Error(r.error);log('📥 imported '+r.file+' — '+(m.story?.title||'')+', '+(m.episodes||[]).length+' episode(s)');$('#importinfo').textContent='saved '+r.file+' into '+DATA.root+' ('+new Date().toLocaleTimeString()+')'}catch(e){alert('Not a Gate Ten production manifest: '+e.message)}}
$('#import').onchange=e=>importFile(e.target.files[0]);document.addEventListener('dragover',e=>{e.preventDefault()});document.addEventListener('drop',e=>{e.preventDefault();importFile(e.dataTransfer.files[0])});
$('#file').onchange=onFile;$('#ep').onchange=onEp;$('#refresh').onclick=load;
$('#render').onclick=async()=>{const steps=[...document.querySelectorAll('#steps input:checked')].map(i=>i.dataset.step);if(!steps.length)return alert('Pick at least one step.');if(!$('#dry').checked&&steps.some(s=>s==='stills'||s==='animate')&&!confirm('Stills / image-to-video spend real money on fal. Continue?'))return;$('#log').textContent='';const r=await (await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({file:cur.file,ep:cur.ep,steps,dry:$('#dry').checked,force:$('#force').checked,path:pathArg()},scope()))})).json();if(r.error)alert(r.error)};
$('#stop').onclick=()=>fetch('/api/stop',{method:'POST'});
const es=new EventSource('/api/events');es.addEventListener('log',e=>log(JSON.parse(e.data)));es.addEventListener('status',e=>{const s=JSON.parse(e.data);$('#status').textContent=s.running?'running: '+s.step:'idle';$('#status').className='status'+(s.running?' run':'');$('#render').disabled=s.running;$('#stop').disabled=!s.running});es.addEventListener('done',e=>{const d=JSON.parse(e.data);log(d.ok?'✔ done':'■ stopped');output()});es.addEventListener('manifest',async e=>{await load();$('#file').value=JSON.parse(e.data).file;onFile()});
load();
</script></body></html>`;
