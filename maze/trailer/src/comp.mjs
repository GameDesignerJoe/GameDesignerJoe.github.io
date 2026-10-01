// node comp.mjs --stills 0,75,160   → stills/NNNN.png      node comp.mjs --all → trailer/trailer.mp4
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const S = process.env.WORK || new URL('../work', import.meta.url).pathname;
const argv = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERR', String(e))); p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await p.goto('http://127.0.0.1:8766/src/comp.html'); await p.evaluate(() => window.ready);
const grab = async (i) => { await p.evaluate((i) => renderFrame(i), i); const d = await p.evaluate(() => document.getElementById('out').toDataURL('image/png')); return Buffer.from(d.split(',')[1], 'base64'); };
if (argv[0] === '--stills') {
  fs.mkdirSync(`${S}/${process.env.SD || 'stills'}`, { recursive: true });
  for (const i of argv[1].split(',').map(Number)) fs.writeFileSync(`${S}/${process.env.SD || 'stills'}/${String(i).padStart(4, '0')}.png`, await grab(i));
} else {
  const N = Math.ceil(35.625 * 30), out = argv[1] || `${S}/trailer.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-', '-i', `${S}/score.wav`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-t', '35.625', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) { const b = await grab(i); if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r)); if (i % 60 === 0) console.log('frame', i, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); console.log('wrote', out);
}
await browser.close();
