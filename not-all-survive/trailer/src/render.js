// Renders the trailer's shots from the real game, frame by frame, in headless Chrome over CDP
// (no dependencies; Node 22+ for the global WebSocket and fetch).
//
//   node render.js all|<id,id,...> [--every N] [--from F] [--to F] [--out DIR] [--q 92] [--server URL]
//
// For each shot: loads not-all-survive/?trailer&shot=<id>&<plan params>, awaits NAS.trailer.setup(),
// then for each frame calls NAS.trailer.frame(i) (the game steps exactly 1/30 s), waits for any
// map tiles still loading and redraws, and grabs a JPEG. Frames go to DIR/<id>/f_00000.jpg and the
// game's events to DIR/<id>/events.json (the sound pass keys the game's sfx to them).
// --every N keeps only every Nth frame (previews; the game still steps every frame).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const W = 1920, H = 1080;
const EVERY = +opt('every', 1), FROM = +opt('from', 0), TO = +opt('to', 1e9), Q = +opt('q', 92);
const OUT = path.resolve(opt('out', 'C:/Users/GameD/nas-tools/trailer_frames'));
const SERVER = opt('server', 'http://127.0.0.1:8765');
const SCALE = +opt('scale', 1);
const PROBE = opt('probe', null);   // an expression printed at each captured frame (debugging)
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// Deterministic Math.random for trailer pages (mulberry32, seeded per shot).
const SEEDED = `(() => { const q = new URLSearchParams(location.search); if (!q.has('trailer')) return;
  let s = (+q.get('seed') || 1) >>> 0;
  Math.random = function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.clear(); } catch {} })();`;

async function main() {
  const { PLAN } = await import(pathToFileURL(path.join(__dirname, '../../js/trailer/plan.js')).href);
  const which = args[0] && args[0] !== 'all' ? args[0].split(',') : PLAN.map(p => p.id);
  const port = 9300 + Math.floor(Math.random() * 500);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'nastrailer-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
    '--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio',
    `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  const shutdown = async () => {
    try { chrome.kill(); } catch {}
    await sleep(1500);
    for (let i = 0; i < 10; i++) { try { fs.rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(300); } }
  };
  try {
    let targets;
    for (let i = 0; i < 60; i++) {
      try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); }
    }
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let id = 0; const pending = {};
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning'))
        console.log('  [console.' + m.params.type + ']', m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
      if (m.method === 'Runtime.exceptionThrown') console.log('  [exception]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expression, awaitPromise = false) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(expression + ': ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
      return r.result?.result?.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: SEEDED });
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });

    for (const sid of which) {
      const p = PLAN.find(x => x.id === sid) || { id: sid, params: opt('params', 'day') };
      const dir = path.join(OUT, sid);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const url = `${SERVER}/not-all-survive/?trailer&autostart&quality=high&nohint&shot=${sid}&seed=${p.seed ?? hash(sid)}${p.params ? '&' + p.params : ''}${PLAN.includes(p) && opt('params') ? '&' + opt('params') : ''}`;
      console.log(`[${sid}] ${url}`);
      const t0 = Date.now();
      await send('Page.navigate', { url });
      for (let i = 0; i < 150; i++) {
        await sleep(200);
        try { if (await ev('!!(window.NAS && NAS.trailer && NAS.trailerStep)')) break; } catch {}
      }
      const info = await ev('NAS.trailer.setup()', true);
      const N = Math.min(info.frames, TO + 1);
      console.log(`  setup ${((Date.now() - t0) / 1000).toFixed(1)} s, ${info.frames} frames`);
      const t1 = Date.now();
      let n = 0;
      for (let f = 0; f < N; f++) {
        let tiles = await ev(`NAS.trailer.frame(${f})`);
        if (f < FROM || f % EVERY) continue;
        if (tiles) {
          for (let k = 0; k < 50 && tiles; k++) { await sleep(60); tiles = await ev('NAS.trailer.tiles()'); }
          await sleep(320);
          await ev('NAS.trailerRedraw()');
        }
        let r;
        for (let tries = 0; tries < 5; tries++) {
          r = await send('Page.captureScreenshot', { format: 'jpeg', quality: Q, optimizeForSpeed: true });
          if (r.result?.data) break;
          await sleep(300);
        }
        if (PROBE) console.log('  probe', f, JSON.stringify(await ev(PROBE)));
        fs.writeFileSync(path.join(dir, `f_${String(f).padStart(5, '0')}.jpg`), Buffer.from(r.result.data, 'base64'));
        n++;
      }
      const log = await ev('NAS.trailer.log');
      fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify(log));
      if (EVERY === 1 && FROM === 0 && N === info.frames) {   // a full render: keep its events for the score
        fs.mkdirSync(path.join(__dirname, 'events'), { recursive: true });
        fs.writeFileSync(path.join(__dirname, 'events', sid + '.json'), JSON.stringify(log));
      }
      const sec = (Date.now() - t1) / 1000;
      console.log(`  ${n} frames in ${sec.toFixed(1)} s (${(sec / Math.max(1, N) * 1000).toFixed(0)} ms/frame stepped)`);
    }
    await Promise.race([send('Browser.close'), sleep(1500)]);
    ws.close();
  } finally { await shutdown(); }
}
main().catch(e => { console.error(e); process.exit(1); });
