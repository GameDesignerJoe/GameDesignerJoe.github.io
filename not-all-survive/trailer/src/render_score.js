// Renders the score (score.html / score.js) in headless Chrome and writes score_raw.wav, then
// normalises it to about -14 LUFS (true peak -1.5 dB) as score.wav with ffmpeg's loudnorm (two passes).
//   node render_score.js [--server http://127.0.0.1:8765]
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SERVER = opt('server', 'http://127.0.0.1:8765');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = 'C:/Users/GameD/AppData/Roaming/Python/Python310/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const port = 9300 + Math.floor(Math.random() * 500);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'nasscore-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  try {
    let targets;
    for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let id = 0; const pend = {};
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
      if (m.method === 'Runtime.consoleAPICalled') console.log('  [page]', m.params.args.map(a => a.value ?? a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') console.log('  [exception]', JSON.stringify(m.params.exceptionDetails).slice(0, 600)); };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable');
    await send('Page.navigate', { url: `${SERVER}/not-all-survive/trailer/src/score.html` });
    for (let i = 0; i < 100; i++) { await sleep(200); const r = await send('Runtime.evaluate', { expression: '!!window.ready', returnByValue: true }); if (r.result?.result?.value) break; }
    const t0 = Date.now();
    const r = await send('Runtime.evaluate', { expression: 'go()', awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800));
    const { b64, peak } = r.result.result.value;
    const raw = path.join(__dirname, 'score_raw.wav');
    fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
    console.log(`rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s, peak ${peak.toFixed(3)} -> ${raw}`);
    ws.close();
  } finally { chrome.kill(); await sleep(1000); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} }
  // loudness: measure, then normalise to -14 LUFS / -1.5 dBTP
  const raw = path.join(__dirname, 'score_raw.wav'), out = path.join(__dirname, 'score.wav');
  const res = spawnSyncStderr([ '-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=14:print_format=json', '-f', 'null', '-']);
  const j = JSON.parse(res.slice(res.lastIndexOf('{'), res.lastIndexOf('}') + 1));
  console.log('measured', j.input_i, 'LUFS, TP', j.input_tp, 'LRA', j.input_lra);
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af',
    `loudnorm=I=-14:TP=-1.5:LRA=14:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=0.83:attack=1:release=60:level=false`,
    '-ar', '48000', out]);
  const res2 = spawnSyncStderr(['-hide_banner', '-i', out, '-af', 'loudnorm=I=-14:TP=-1.5:print_format=json', '-f', 'null', '-']);
  const j2 = JSON.parse(res2.slice(res2.lastIndexOf('{'), res2.lastIndexOf('}') + 1));
  console.log('final', j2.input_i, 'LUFS, TP', j2.input_tp, '->', out);
})().catch(e => { console.error(e); process.exit(1); });
function spawnSyncStderr(a) { return require('child_process').spawnSync(FFMPEG, a, { encoding: 'utf8' }).stderr; }
