#!/usr/bin/env node
// Drive a page in headless Chrome over the DevTools protocol: load it, run a
// list of steps (tap, wait, eval, screenshot), and save PNGs. Used for art
// review and for playing both the old and new game in automated checks.
//
//   node catch-the-wolf/tools/shoot.mjs --path catch-the-wolf/gallery.html --out shots/gallery.png
//   node catch-the-wolf/tools/shoot.mjs --path catch-the-wolf/ --w 430 --h 932 --steps steps.json
//
// steps.json is an array, each entry one of:
//   { "wait": 500 }                       ms of real time
//   { "tap": [x, y] }                     mouse press+release at CSS px
//   { "eval": "js expression" }           result is printed
//   { "shot": "shots/name.png" }          screenshot (repo-relative path)
//
// Options: --w 1024 --h 1024 --dpr 1 --wait 1500 (before steps) --out (final shot)

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2',
};
const CHROMES = [
  process.env.CHROME, // e.g. CHROME=/usr/bin/chromium on Linux
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];

const W = Number(args.w || 1024), H = Number(args.h || 1024), DPR = Number(args.dpr || 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(REPO, normalize(urlPath).replace(/^[/\\]+/, ''));
    if (!resolve(file).startsWith(REPO)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!urlPath.endsWith('/')) return res.writeHead(301, { Location: urlPath + '/' }).end();
      file = join(file, 'index.html');
    }
    if (!existsSync(file)) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function main() {
  const chrome = CHROMES.find((p) => p && existsSync(p));
  if (!chrome) throw new Error('no Chrome/Edge found');
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const url = args.url || base + (args.path || '').replace(/\\/g, '/');
  const profile = mkdtempSync(join(tmpdir(), 'ctw-shot-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), // Chrome refuses to sandbox as root (CI containers)
    'about:blank',
  ], { stdio: 'ignore' });

  let ws;
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(150);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        target = list.find((t) => t.type === 'page');
      } catch { /* not up yet */ }
    }
    if (!target) throw new Error('Chrome did not expose a page target');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
    let id = 0;
    const pending = new Map();
    const logs = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      if (msg.method === 'Runtime.consoleAPICalled') logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description).join(' '));
      if (msg.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    };
    const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
    await send('Page.navigate', { url });
    await sleep(Number(args.wait || 1500));

    const shot = async (out) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      const file = resolve(REPO, out);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      console.log('wrote', out);
    };
    const steps = args.steps ? JSON.parse(readFileSync(resolve(REPO, args.steps), 'utf8')) : [];
    for (const s of steps) {
      if (s.wait) await sleep(s.wait);
      if (s.tap) {
        const [x, y] = s.tap;
        for (const type of ['mousePressed', 'mouseReleased']) {
          await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
          await sleep(40);
        }
      }
      if (s.eval) {
        const r = await send('Runtime.evaluate', { expression: s.eval, returnByValue: true, awaitPromise: true });
        console.log('eval:', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.text));
      }
      if (s.shot) await shot(s.shot);
    }
    if (args.out) await shot(args.out);
    if (logs.length) console.log(logs.slice(0, 40).join('\n'));
  } finally {
    try { ws?.close(); } catch { /* ignore */ }
    proc.kill();
    server.close();
    await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

main().catch((e) => { console.error('error:', e.message); process.exit(1); });
