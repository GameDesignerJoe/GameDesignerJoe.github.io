// Who this player is, until the database's sign-in replaces it (Multiplayer Test Prototype).
// A random ID kept on the device, so two browsers on one machine are two players. ?player=<id>
// forces one (handy for testing two players in two tabs of the same browser).
import { state } from '../state.js';

const KEY = 'naso_playerId';

function fresh() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

let id = state.params.get('player');
if (!id) {
  try { id = localStorage.getItem(KEY); } catch { id = null; }
  if (!id) {
    id = fresh();
    try { localStorage.setItem(KEY, id); } catch { /* private mode: a new player each visit */ }
  }
}

export const PLAYER = { id, short: id.slice(0, 6) };
state.net = { player: PLAYER, connected: false, lastSync: null };
