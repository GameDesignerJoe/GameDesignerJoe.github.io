// The world's scale and the shared world clock (Multiplayer Design v2, Movement and Scale Reference).
//
// Distance and time are compressed by the same factor (SCALE), so walking pace stays a real pace:
// at 1:25 coast to pole is ~54 km in game and a game day lasts 86400 / 25 s = 57.6 real minutes.
// Nothing else should assume 1:25: read it from here, so a 1:10 world stays a settings change.
//
// URL overrides for testing: ?scale=25  ?hexkm=1.5  ?world=<name>
//
// API
//   WORLD                   { name, scale, hexKm, unitM, hexUnits, daySec }
//   worldClock(now?)        the shared clock, the same for every player at the same moment:
//                           { gameSec, day, hour, minute, label } (day 1 starts at WORLD_EPOCH)
import { state } from '../state.js';

const p = state.params;
const num = (k, d) => (p.has(k) && isFinite(parseFloat(p.get(k))) ? parseFloat(p.get(k)) : d);

// The moment the world's day 1 began (UTC). Any fixed instant works; it must never change once
// players are in a world, or everyone's clock jumps together.
const WORLD_EPOCH = Date.UTC(2026, 9, 1);    // 1 October 2026, for the test world

const scale = num('scale', 25);
const hexKm = num('hexkm', 1.5);
const unitM = 1.75 / 16;                     // the explorer is 16 units tall, taken as 1.75 m

export const WORLD = {
  name: p.get('world') || 'test',
  scale,
  hexKm,
  unitM,
  hexUnits: Math.round(hexKm * 1000 / unitM),   // ~13,700 at 1.5 km
  daySec: 86400 / scale,                       // real seconds per game day
};

export function worldClock(now = Date.now()) {
  const gameSec = Math.floor((now - WORLD_EPOCH) / 1000 * WORLD.scale);
  const day = Math.floor(gameSec / 86400) + 1;
  const s = ((gameSec % 86400) + 86400) % 86400;
  const hour = Math.floor(s / 3600), minute = Math.floor(s / 60) % 60;
  return { gameSec, day, hour, minute, label: `day ${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

state.world = WORLD;
