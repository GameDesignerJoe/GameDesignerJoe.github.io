import { openGame, S } from './lib.mjs';
const seed = process.argv[2] || 4242;
const { browser, p } = await openGame(seed, { w: 800, h: 450, res: 200 });
const d = await p.evaluate(() => {
  const st = FP.story.map(s => ({ kind: s.kind, mem: s.mem, tiles: s.tiles, m: s.m, at: s.at }));
  return { W, H, tiles: tiles.map(r => r.map(v => v ? 1 : 0)), st, secret: [...secretTiles], objs: FP.objs.map(o => ({ k: o.kind, x: o.x, y: o.y })), exit, start, low: [...FP.low].map((v,i)=>v?i:-1).filter(i=>i>=0), dark: [...FP.dark].map((v,i)=>v?i:-1).filter(i=>i>=0), closets: FP.closets.map(c=>({k:c.k, x:c.x,y:c.y})), doors: FP.doors.map(q=>({k:q.k,x:q.x,y:q.y,open:q.open,axis:q.axis})), heartRoom: FP.heart && FP.heart.room, light: [...FP.light], sol: solutionPath.slice(0, 400), heartMaze: FP.heart && FP.heart.maze, doorK: FP.doors.map(q=>q.k??q.t??q.tile) , door0: FP.doors[0] };
});
import fs from 'fs'; fs.writeFileSync(`${S}/map_${seed}.json`, JSON.stringify(d));
// draw
const Z = 24;
const img = await p.evaluate(({ d, Z }) => {
  const c = document.createElement('canvas'); c.width = d.W * Z; c.height = d.H * Z; const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) if (d.tiles[y][x]) { const L = Math.min(1, d.light[y*d.W+x]||0); g.fillStyle = `rgb(${60+190*L},${60+190*L},${40+150*L})`; g.fillRect(x * Z, y * Z, Z - 1, Z - 1); }
  const col = { waiting: '#e9a', wall: '#ddf', heart: '#e33', memory: '#9d9' };
  for (const s of d.st) { g.fillStyle = col[s.kind]; for (const k of s.tiles) g.fillRect((k % d.W) * Z, ((k / d.W) | 0) * Z, Z - 1, Z - 1); }
  g.fillStyle = '#c8f'; for (const k of d.secret) { const [x, y] = k.split(',').map(Number); g.fillRect(x * Z, y * Z, Z - 1, Z - 1); }
  g.fillStyle = 'rgba(0,0,200,.5)'; for (const k of d.low) g.fillRect((k % d.W) * Z, ((k / d.W) | 0) * Z, Z - 1, Z - 1);
  g.fillStyle = 'rgba(0,0,0,.35)'; for (const k of d.dark) g.fillRect((k % d.W) * Z, ((k / d.W) | 0) * Z, Z - 1, Z - 1);
  g.font = '10px monospace'; g.fillStyle = '#000';
  for (const s of d.st) { const k = s.tiles[0]; g.fillText((s.mem || s.kind).slice(0, 6), (k % d.W) * Z, ((k / d.W) | 0) * Z + 10); }
  for (const o of d.objs) { g.fillStyle = '#f80'; g.fillRect(o.x * Z - 3, o.y * Z - 3, 6, 6); }
  for (const q of d.doors) { g.fillStyle = q.open ? '#0cc' : '#c0c'; if (q.axis==='x') g.fillRect(q.x*Z+Z-4,q.y*Z,6,Z); else g.fillRect(q.x*Z,q.y*Z+Z-4,Z,6); } for (const q of (d.doorsFull||[])) {}
  g.fillStyle = '#0a0'; g.fillRect(d.start.x * Z - 6, d.start.y * Z - 6, 12, 12); g.fillStyle = '#00f'; g.fillRect(d.exit.x * Z + 4, d.exit.y * Z + 4, 14, 14);
  g.fillStyle = '#f00'; g.font = '9px monospace';
  for (let x = 0; x < d.W; x += 2) g.fillText(x, x * Z + 2, 9); for (let y = 0; y < d.H; y += 2) g.fillText(y, 1, y * Z + 14);
  return c.toDataURL();
}, { d, Z });
fs.writeFileSync(`${S}/map_${seed}.png`, Buffer.from(img.split(',')[1], 'base64'));
console.log(JSON.stringify(d.door0), d.W, d.H, d.st.map(s => s.mem || s.kind).join(' '), 'secret', d.secret.length);
await browser.close();
