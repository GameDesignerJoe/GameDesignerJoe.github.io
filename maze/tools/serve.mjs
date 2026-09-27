// The suites need the site served at 127.0.0.1:<port> (the repo root, so /maze/... resolves). If nothing is answering
// there — a fresh container, a server that died — start one for the run and stop it after, rather than failing every
// check on "connection refused". A server that's already up is left alone.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const up = async (port) => { try { const r = await fetch(`http://127.0.0.1:${port}/maze/maze-fp.html`, { method: 'HEAD' }); return r.ok; } catch (e) { return false; } };

export async function ensureServer(port) {
  if (await up(port)) return () => {};
  const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up(port)); i++) await new Promise((r) => setTimeout(r, 100));
  if (!(await up(port))) { child.kill(); throw new Error(`could not start a server on ${port}`); }
  console.log(`  (started a server on ${port} for this run)`);
  return () => child.kill();
}
