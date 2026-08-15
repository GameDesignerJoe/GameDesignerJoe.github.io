#!/usr/bin/env node
// Capture a square screenshot of an app for the portfolio grid on index.html.
//
// Local app (serves the repo root on a throwaway port, then shoots it):
//   node .claude/skills/add-portfolio-entry/capture.mjs --path tidy-adventures --out art/tidy-adventures.png
//
// Externally hosted app:
//   node .claude/skills/add-portfolio-entry/capture.mjs --url https://myflickpick.vercel.app/ --out art/flickpick.png
//
// Options:
//   --size 1024     square viewport in px (the grid tile is 1:1, so shoot square)
//   --wait 3000     ms of virtual time to let the page settle before the shot
//   --chrome PATH   override Chrome auto-detection

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import {
  createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync,
} from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

const MIME = {
  '.html': 'text/html', '.htm': 'text/html',
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.jsx': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.map': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.txt': 'text/plain', '.md': 'text/markdown',
};

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith('--')) die(`unexpected argument: ${key}`);
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

// Minimal static file server so ES modules and fetch() work (file:// breaks both).
function startServer(root) {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = join(root, normalize(urlPath).replace(/^[/\\]+/, ''));
    if (!resolve(filePath).startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      // Without the trailing slash the page's relative asset paths resolve
      // against the parent directory, so it renders unstyled.
      if (!urlPath.endsWith('/')) {
        res.writeHead(301, { Location: `${urlPath}/` }).end();
        return;
      }
      filePath = join(filePath, 'index.html');
    }
    if (!existsSync(filePath)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function findChrome(override) {
  if (override) {
    if (!existsSync(override)) die(`no browser at ${override}`);
    return override;
  }
  const found = CHROME_CANDIDATES.find((p) => p && existsSync(p));
  if (!found) die('no Chrome or Edge found — pass --chrome "C:/path/to/chrome.exe"');
  return found;
}

function shoot(chrome, url, outFile, size, wait) {
  const profile = mkdtempSync(join(tmpdir(), 'portfolio-shot-'));
  const flags = [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--window-size=${size},${size}`,
    `--virtual-time-budget=${wait}`,
    `--screenshot=${outFile}`,
    url,
  ];
  return new Promise((ok) => {
    const proc = spawn(chrome, flags, { stdio: 'ignore' });
    proc.on('exit', (code) => {
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
      ok(code);
    });
  });
}

// Width and height live at bytes 16-24 of any PNG.
function pngSize(file) {
  const head = readFileSync(file).subarray(0, 24);
  return `${head.readUInt32BE(16)}x${head.readUInt32BE(20)}`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.out) die('--out is required (e.g. --out art/my-app.png)');
if (Boolean(args.url) === Boolean(args.path)) die('pass exactly one of --url or --path');

const size = Number(args.size || 1024);
const wait = Number(args.wait || 3000);
const outFile = resolve(REPO_ROOT, args.out);
const chrome = findChrome(args.chrome);

let server = null;
let url = args.url;
if (args.path) {
  const target = resolve(REPO_ROOT, args.path);
  if (!existsSync(target)) die(`no such path in the repo: ${args.path}`);
  server = await startServer(REPO_ROOT);
  let rel = args.path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (statSync(target).isDirectory() && !rel.endsWith('/')) rel += '/';
  url = `http://127.0.0.1:${server.address().port}/${rel}`;
}

console.log(`shooting ${url}`);
const code = await shoot(chrome, url, outFile, size, wait);
if (server) server.close();

if (!existsSync(outFile)) die(`Chrome exited ${code} without writing ${args.out}`);
const bytes = statSync(outFile).size;
console.log(`wrote ${args.out} — ${pngSize(outFile)}, ${(bytes / 1024).toFixed(0)} KB`);
if (bytes < 8000) console.log('warning: tiny file — the page may have rendered blank');
