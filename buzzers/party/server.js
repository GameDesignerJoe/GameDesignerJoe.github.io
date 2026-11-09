// PartyKit room server. One instance per room code; it owns the game state and runs the reducer.
// Phones send { type:'action', action }, and get back their own redacted copy of the state.
//
// Messages in:  hello {pid, key, name, color} | hello {observer:true} | action {action} | ping {t0}
// Messages out: state {now, S} | you {pid, color} | err {msg} | pong {t0, ts}

import { createGame, viewFor, newId } from '../game.js';

export default class BuzzersRoom {
  constructor(room) {
    this.room = room;
    this.game = null;
    this.saveTimer = null;
  }

  async onStart() {
    const saved = await this.room.storage.get('state');
    this.game = createGame({ state: saved || undefined, onChange: () => this.changed() });
    if (saved) this.game.resume();
  }

  changed() {
    const now = Date.now();
    for (const conn of this.room.getConnections()) this.sendState(conn, now);
    if (!this.saveTimer) this.saveTimer = setTimeout(() => { this.saveTimer = null; this.room.storage.put('state', this.game.state); }, 250);
  }

  sendState(conn, now = Date.now()) {
    if (!conn.state?.pid && !conn.state?.observer) return;
    conn.send(JSON.stringify({ type: 'state', now, room: this.room.id, S: viewFor(this.game.state, conn.state.pid ?? null) }));
  }

  send(conn, msg) { conn.send(JSON.stringify(msg)); }

  onMessage(raw, conn) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'ping') return this.send(conn, { type: 'pong', t0: m.t0, ts: Date.now() });
    if (m.type === 'hello') return this.hello(m, conn);
    if (m.type === 'action' && m.action && typeof m.action.type === 'string') {
      const pid = conn.state?.pid; if (!pid) return;
      if (['join', 'presence'].includes(m.action.type)) return; // only the server sends these
      const r = this.game.dispatch({ ...m.action, by: pid });
      if (r?.error) this.send(conn, { type: 'err', msg: r.error });
    }
  }

  // Seat matching: same pid (this tab, after a refresh) → same seat. Otherwise same name AND
  // (the seat is empty, or it's the same device) → take that seat back. Otherwise a new seat.
  hello(m, conn) {
    if (m.observer) { conn.setState({ observer: true }); return this.sendState(conn); }
    const S = this.game.state;
    const name = String(m.name ?? '').trim().toLowerCase();
    let pid = String(m.pid ?? '').slice(0, 40) || newId('p');
    if (!S.players.some(p => p.id === pid)) {
      const seat = S.players.find(p => p.name.toLowerCase() === name && (!p.connected || (m.key && p.key === m.key)));
      if (seat) pid = seat.id;
    }
    // Same seat already open in another connection (old tab, half-dead iPhone socket): this one wins.
    for (const other of this.room.getConnections()) {
      if (other !== conn && other.state?.pid === pid) { other.setState({ replaced: true }); try { other.close(4000, 'replaced'); } catch {} }
    }
    conn.setState({ pid });
    const r = this.game.dispatch({ type: 'join', by: pid, name: m.name, color: m.color, key: m.key });
    if (r?.error) { conn.setState({}); return this.send(conn, { type: 'err', msg: r.error, fatal: true }); }
    this.send(conn, { type: 'you', pid, color: r?.color });
    this.sendState(conn);
  }

  onClose(conn) { this.left(conn); }
  onError(conn) { this.left(conn); }

  left(conn) {
    const pid = conn.state?.pid; if (!pid || conn.state?.replaced) return;
    for (const other of this.room.getConnections()) if (other !== conn && other.state?.pid === pid) return;
    this.game.dispatch({ type: 'presence', by: pid, connected: false });
  }
}
