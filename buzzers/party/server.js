// Buzzers room server: a Cloudflare Worker + one Durable Object per room code.
// The Durable Object owns the game state, runs the reducer (../game.js), and sends each phone
// its own redacted copy. Phones connect to  wss://<host>/parties/main/<ROOM>.
//
// Sockets use the Hibernation API (ctx.acceptWebSocket): an idle room is evicted from memory and costs
// nothing, even with phones connected. Cloudflare bills a plain ws.accept() socket for every second it's
// open, which blew the free tier's daily duration limit on 2026-11-09. On wake, the constructor reloads
// the game from storage, and each socket's own state (pid / observer / replaced) rides on its attachment.
//
// Messages in:  hello {pid, key, name, color} | hello {observer:true} | action {action} | ping {t0}
// Messages out: state {now, S} | you {pid, color} | err {msg} | pong {t0, ts}

import { DurableObject } from 'cloudflare:workers';
import { createGame, viewFor, newId, freshState, CONFIG } from '../game.js';

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/budget') return env.Budget.get(env.Budget.idFromName('global')).fetch(request);
    const m = new URL(request.url).pathname.match(/^\/parties\/main\/([A-Za-z0-9]{1,12})\/?$/);
    if (!m) return new Response('Buzzers room server', { status: 404 });
    const room = m[1].toUpperCase();
    return env.Main.get(env.Main.idFromName(room)).fetch(request);
  },
};

export class BuzzersRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.saveTimer = null;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('state');
      this.lastActive = (await ctx.storage.get('lastActive')) || 0; // 0 = a room from before this existed: treat as stale
      this.game = createGame({ state: saved || undefined, onChange: () => this.changed() });
      if (saved) this.game.resume();
    });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const { 0: client, 1: ws } = new WebSocketPair();
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({});
    return new Response(null, { status: 101, webSocket: client });
  }

  // A "conn" is the socket plus its attachment. setState writes the attachment back so it survives hibernation.
  conn(ws) { return { ws, state: ws.deserializeAttachment() || {} }; }
  setState(conn, state) { conn.state = state; try { conn.ws.serializeAttachment(state); } catch {} }
  get conns() { return this.ctx.getWebSockets().map(ws => this.conn(ws)).filter(c => !c.state.gone); }

  webSocketMessage(ws, raw) { this.onMessage(typeof raw === 'string' ? raw : new TextDecoder().decode(raw), this.conn(ws)); }
  webSocketClose(ws, code) { this.bye(ws); try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch {} }
  webSocketError(ws) { this.bye(ws); }
  bye(ws) {
    const conn = this.conn(ws); if (conn.state.gone) return;
    const was = conn.state; this.setState(conn, { ...was, gone: true });
    this.left({ ws, state: was });
  }

  changed() {
    const now = Date.now();
    for (const conn of this.conns) this.sendState(conn, now);
    if (this.anyoneHere()) this.lastActive = now;
    if (!this.saveTimer) this.saveTimer = setTimeout(() => { this.saveTimer = null; this.ctx.storage.put({ state: this.game.state, lastActive: this.lastActive }); }, 250);
  }

  anyoneHere(except) { for (const c of this.conns) if (c.ws !== except?.ws && c.state.pid) return true; return false; }

  // Old rooms: if nobody has been in the room for roomIdleResetMs, the next person in gets a fresh
  // lobby instead of a half-finished game full of empty seats. The room's memory (clues and
  // categories it has used) survives, so a group reusing its code still doesn't get repeats.
  resetIfStale(conn) {
    const S = this.game.state;
    if (!S.players.length || this.anyoneHere(conn)) return;
    const idle = Date.now() - this.lastActive;
    if (idle < CONFIG.roomIdleResetMs) return;
    this.game.stop();
    const fresh = freshState({ memory: S.memory });
    fresh.log = [{ t: Date.now(), msg: this.lastActive ? `room reset · empty for ${Math.round(idle / 60000)} min` : 'room reset · left over from an older version' }];
    this.game = createGame({ state: fresh, onChange: () => this.changed() });
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
    if (m.observer) { this.setState(conn, { observer: true }); return this.sendState(conn); }
    const S = this.game.state;
    const name = String(m.name ?? '').trim().toLowerCase();
    let pid = String(m.pid ?? '').slice(0, 40) || newId('p');
    if (!S.players.some(p => p.id === pid)) {
      const seat = S.players.find(p => p.name.toLowerCase() === name && (!p.connected || (m.key && p.key === m.key)));
      if (seat) pid = seat.id;
    }
    // Same seat already open in another connection (old tab, half-dead iPhone socket): this one wins.
    for (const other of this.conns) {
      if (other.ws !== conn.ws && other.state.pid === pid) { this.setState(other, { replaced: true }); try { other.ws.close(4000, 'replaced'); } catch {} }
    }
    this.resetIfStale(conn);
    this.setState(conn, { pid });
    const r = this.game.dispatch({ type: 'join', by: pid, name: m.name, color: m.color, key: m.key, settings: m.settings });
    if (r?.error) { this.setState(conn, {}); return this.send(conn, { type: 'err', msg: r.error, fatal: true }); }
    this.send(conn, { type: 'you', pid, color: r?.color });
    this.sendState(conn);
  }

  left(conn) {
    const pid = conn.state.pid; if (!pid || conn.state.replaced) return;
    for (const other of this.conns) if (other.ws !== conn.ws && other.state.pid === pid) return;
    this.lastActive = Date.now();
    this.game.dispatch({ type: 'presence', by: pid, connected: false });
  }
}

// One global counter that /api/generate asks before every Groq call, so a script hammering the
// endpoint can only burn one day's budget. POST /budget {ip} → {ok, search, why?}.
//  search: true while the day's web-search budget lasts; after that clues come from memory (cheaper).
//  ok: false once the day's total or this IP's share is used up. Counts reset at 00:00 UTC.
// The caller's IP comes from Vercel and isn't authenticated, so someone could post here directly and
// use up the day's budget. That blocks clue writing for a day but costs nothing.
export const BUDGET = { searchPerDay: 300, totalPerDay: 600, perIpPerDay: 60 };

export class BuzzersBudget extends DurableObject {
  async fetch(request) {
    if (request.method !== 'POST') return Response.json({ budget: BUDGET });
    const { ip = '?' } = await request.json().catch(() => ({}));
    const day = new Date().toISOString().slice(0, 10);
    let d = await this.ctx.storage.get('day');
    if (!d || d.day !== day) d = { day, total: 0, search: 0, ips: {} };
    const key = String(ip).slice(0, 64), mine = d.ips[key] || 0;
    let out;
    if (d.total >= BUDGET.totalPerDay) out = { ok: false, why: 'daily limit reached for everyone' };
    else if (mine >= BUDGET.perIpPerDay) out = { ok: false, why: 'daily limit reached for this network' };
    else {
      const search = d.search < BUDGET.searchPerDay;
      d.total++; if (search) d.search++; d.ips[key] = mine + 1;
      await this.ctx.storage.put('day', d);
      out = { ok: true, search, used: d.total };
    }
    return Response.json(out);
  }
}
