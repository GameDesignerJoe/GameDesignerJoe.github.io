// Buzzers room server: a Cloudflare Worker + one Durable Object per room code.
// The Durable Object owns the game state, runs the reducer (../game.js), and sends each phone
// its own redacted copy. Phones connect to  wss://<host>/parties/main/<ROOM>.
//
// Sockets use the Hibernation API (ctx.acceptWebSocket): an idle room is evicted from memory and costs
// nothing, even with phones connected. Cloudflare bills a plain ws.accept() socket for every second it's
// open, which blew the free tier's daily duration limit on 2026-11-09. On wake, the constructor reloads
// the game from storage, and each socket's own state (pid / observer / replaced) rides on its attachment.
//
// Clues: when a category is added, this room writes its clues (../clues.js → Groq) and dispatches
// 'generated' itself. The Groq key is a Cloudflare secret (GROQ_API_KEY) and answers only ever leave
// here through viewFor, so no phone sees an answer early. Phones can't send 'generated' / 'genFailed'.
//
// Messages in:  hello {pid, key, name, color} | hello {observer:true} | action {action} | ping {t0}
// Messages out: state {now, S} | you {pid, color} | err {msg} | pong {t0, ts} | genFail {name, reason}

import { DurableObject } from 'cloudflare:workers';
import { createGame, viewFor, newId, freshState, CONFIG } from '../game.js';
import { writeClues, BANK, bankName, failReason } from '../clues.js';

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    // Read-only: today's generation counts and the limits.
    if (path === '/budget') return env.Budget.get(env.Budget.idFromName('global')).fetch(request);
    const m = path.match(/^\/parties\/main\/([A-Za-z0-9]{1,12})\/?$/);
    if (!m) return new Response('Buzzers room server', { status: 404 });
    const room = m[1].toUpperCase();
    return env.Main.get(env.Main.idFromName(room)).fetch(request);
  },
};

export class BuzzersRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.saveTimer = null;
    this.generating = new Set(); // category ids with a Groq call in flight in this instance
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('state');
      this.room = (await ctx.storage.get('room')) || null;
      this.lastActive = (await ctx.storage.get('lastActive')) || 0; // 0 = a room from before this existed: treat as stale
      this.game = createGame({ state: saved || undefined, onChange: () => this.changed() });
      if (saved) this.game.resume();
    });
  }

  async fetch(request) {
    const code = new URL(request.url).pathname.split('/').filter(Boolean).pop()?.toUpperCase();
    if (code && code !== this.room) { this.room = code; this.ctx.storage.put('room', code); }
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

  // Returns (and so waits on) any clue writing the message started, so the room stays awake for it.
  async webSocketMessage(ws, raw) { this.onMessage(typeof raw === 'string' ? raw : new TextDecoder().decode(raw), this.conn(ws)); await this.writeAll(); }
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
      if (['join', 'presence', 'generated', 'genFailed'].includes(m.action.type)) return; // only the server sends these
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

  // Start clue writing for every category still 'generating' that nobody here is working on. This also
  // picks up a category whose Groq call was cut off because the room was evicted from memory.
  writeAll() {
    const todo = this.game.state.categories.filter(c => c.status === 'generating' && !this.generating.has(c.id));
    return Promise.all(todo.map(c => this.write(c)));
  }

  async write(cat) {
    this.generating.add(cat.id);
    try {
      const S = this.game.state, lower = cat.name.toLowerCase();
      const avoid = S.memory.used.filter(id => id.startsWith(lower + '|')).map(id => id.slice(lower.length + 1));
      let r;
      const key = this.env.GROQ_API_KEY;
      if (!key && this.env.DEV_PLACEHOLDERS === '1') r = { ok: true, clues: placeholders(cat.name), model: 'placeholder', mode: 'dev' };
      else if (!key) r = { ok: false, error: 'no Groq key on the room server (wrangler secret put GROQ_API_KEY)' };
      else {
        const budget = await this.env.Budget.get(this.env.Budget.idFromName('global')).take(this.roomCode());
        r = budget.ok ? await writeClues(key, cat.name, avoid, { search: budget.search }) : { ok: false, error: budget.error };
      }
      // Our own categories fall back to their checked clues.
      const own = bankName(cat.name);
      if (!r.ok && own) r = { ok: true, clues: BANK[own], model: 'canned', mode: 'built-in', note: `live failed: ${r.error}` };
      if (r.ok) {
        const note = [r.mode, r.tokens ? `${r.tokens} tokens` : '', r.ms ? `${Math.round(r.ms / 1000)} s` : '', r.note || ''].filter(Boolean).join(' · ');
        this.game.dispatch({ type: 'generated', catId: cat.id, by: cat.by, clues: r.clues, source: String(r.model || '').split('/').pop(), note });
      } else {
        const had = () => this.game.state.categories.some(c => c.id === cat.id);
        if (!had()) return; // removed while we were writing
        this.game.dispatch({ type: 'genFailed', catId: cat.id, by: cat.by, reason: r.error });
        if (had()) return; // game moved on; nothing to tell
        for (const c of this.conns) if (c.state.pid === cat.by) this.send(c, { type: 'genFail', name: cat.name, reason: failReason(r.error) });
      }
    } finally { this.generating.delete(cat.id); }
  }

  // The room code this object serves (set on the first socket, kept in storage for the budget's per-room count).
  roomCode() { return this.room || '?'; }

  left(conn) {
    const pid = conn.state.pid; if (!pid || conn.state.replaced) return;
    for (const other of this.conns) if (other.ws !== conn.ws && other.state.pid === pid) return;
    this.lastActive = Date.now();
    this.game.dispatch({ type: 'presence', by: pid, connected: false });
  }
}

function placeholders(name) {
  return CONFIG.values.map((v, i) => ({ clue: `A ${['easy', 'gentle', 'medium', 'tough', 'brutal'][i]} placeholder clue about ${name}?`, answer: `${name} answer ${i + 1}`, alts: [] }));
}

// One global counter every room asks before a Groq call (take, over RPC), so nobody can run up the
// Groq bill: past the search budget clues come from memory (cheaper); past the total, or past one
// room's share, new categories are refused until 00:00 UTC. Built-in categories keep working.
// GET /budget shows the limits and today's counts.
export const BUDGET = { searchPerDay: 300, totalPerDay: 600, perRoomPerDay: 40 };

export class BuzzersBudget extends DurableObject {
  async today() {
    const day = new Date().toISOString().slice(0, 10);
    const d = await this.ctx.storage.get('day');
    return d && d.day === day && d.rooms ? d : { day, total: 0, search: 0, rooms: {} };
  }
  async take(room) {
    const d = await this.today();
    const key = String(room).slice(0, 12), mine = d.rooms[key] || 0;
    if (d.total >= BUDGET.totalPerDay) return { ok: false, error: 'DAILY_LIMIT: daily limit reached for everyone' };
    if (mine >= BUDGET.perRoomPerDay) return { ok: false, error: 'ROOM_LIMIT: daily limit reached for this room' };
    const search = d.search < BUDGET.searchPerDay;
    d.total++; if (search) d.search++; d.rooms[key] = mine + 1;
    await this.ctx.storage.put('day', d);
    return { ok: true, search };
  }
  async fetch() {
    const d = await this.today();
    return Response.json({ budget: BUDGET, today: { day: d.day, total: d.total, search: d.search, rooms: Object.keys(d.rooms).length } });
  }
}
