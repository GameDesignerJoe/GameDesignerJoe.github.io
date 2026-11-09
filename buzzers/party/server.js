// Buzzers room server: a Cloudflare Worker + one Durable Object per room code.
// The Durable Object owns the game state, runs the reducer (../game.js), and sends each phone
// its own redacted copy. Phones connect to  wss://<host>/parties/main/<ROOM>.
//
// Messages in:  hello {pid, key, name, color} | hello {observer:true} | action {action} | ping {t0}
// Messages out: state {now, S} | you {pid, color} | err {msg} | pong {t0, ts}

import { DurableObject } from 'cloudflare:workers';
import { createGame, viewFor, newId } from '../game.js';

export default {
  fetch(request, env) {
    const m = new URL(request.url).pathname.match(/^\/parties\/main\/([A-Za-z0-9]{1,12})\/?$/);
    if (!m) return new Response('Buzzers room server', { status: 404 });
    const room = m[1].toUpperCase();
    return env.Main.get(env.Main.idFromName(room)).fetch(request);
  },
};

export class BuzzersRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.conns = new Set();   // { ws, state }
    this.saveTimer = null;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('state');
      this.game = createGame({ state: saved || undefined, onChange: () => this.changed() });
      if (saved) this.game.resume();
    });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const { 0: client, 1: ws } = new WebSocketPair();
    ws.accept();
    const conn = { ws, state: {}, gone: false };
    this.conns.add(conn);
    ws.addEventListener('message', e => this.onMessage(e.data, conn));
    const bye = () => { if (conn.gone) return; conn.gone = true; this.conns.delete(conn); this.left(conn); };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  changed() {
    const now = Date.now();
    for (const conn of this.conns) this.sendState(conn, now);
    if (!this.saveTimer) this.saveTimer = setTimeout(() => { this.saveTimer = null; this.ctx.storage.put('state', this.game.state); }, 250);
  }

  send(conn, msg) { try { conn.ws.send(JSON.stringify(msg)); } catch {} }

  sendState(conn, now = Date.now()) {
    if (!conn.state.pid && !conn.state.observer) return;
    this.send(conn, { type: 'state', now, S: viewFor(this.game.state, conn.state.pid ?? null) });
  }

  onMessage(raw, conn) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'ping') return this.send(conn, { type: 'pong', t0: m.t0, ts: Date.now() });
    if (m.type === 'hello') return this.hello(m, conn);
    if (m.type === 'action' && m.action && typeof m.action.type === 'string') {
      const pid = conn.state.pid; if (!pid) return;
      if (['join', 'presence'].includes(m.action.type)) return; // only the server sends these
      const r = this.game.dispatch({ ...m.action, by: pid });
      if (r?.error) this.send(conn, { type: 'err', msg: r.error });
    }
  }

  // Seat matching: same pid (this tab, after a refresh) → same seat. Otherwise same name AND
  // (the seat is empty, or it's the same device) → take that seat back. Otherwise a new seat.
  hello(m, conn) {
    if (m.observer) { conn.state = { observer: true }; return this.sendState(conn); }
    const S = this.game.state;
    const name = String(m.name ?? '').trim().toLowerCase();
    let pid = String(m.pid ?? '').slice(0, 40) || newId('p');
    if (!S.players.some(p => p.id === pid)) {
      const seat = S.players.find(p => p.name.toLowerCase() === name && (!p.connected || (m.key && p.key === m.key)));
      if (seat) pid = seat.id;
    }
    // Same seat already open in another connection (old tab, half-dead iPhone socket): this one wins.
    for (const other of this.conns) {
      if (other !== conn && other.state.pid === pid) { other.state = { replaced: true }; try { other.ws.close(4000, 'replaced'); } catch {} }
    }
    conn.state = { pid };
    const r = this.game.dispatch({ type: 'join', by: pid, name: m.name, color: m.color, key: m.key });
    if (r?.error) { conn.state = {}; return this.send(conn, { type: 'err', msg: r.error, fatal: true }); }
    this.send(conn, { type: 'you', pid, color: r?.color });
    this.sendState(conn);
  }

  left(conn) {
    const pid = conn.state.pid; if (!pid || conn.state.replaced) return;
    for (const other of this.conns) if (other.state.pid === pid) return;
    this.game.dispatch({ type: 'presence', by: pid, connected: false });
  }
}
