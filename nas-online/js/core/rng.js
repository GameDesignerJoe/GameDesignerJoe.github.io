// Seeded random numbers and hashing that give the same answer on every machine.
//
// Anything that has to match between players (a generated hex, an edge between two hexes,
// where the world puts things) must come from here, never from Math.random, Math.sin, Math.exp
// and the like: JavaScript engines may round those differently, and a single different bit
// changes the ground. Everything below is 32-bit integer arithmetic (Math.imul, shifts) or plain
// + - * / and Math.floor on doubles, which the language defines exactly, so every engine agrees.
//
// API
//   hash32(...parts)        32-bit hash of integers and/or strings (order matters)
//   rng(seed)               a generator: next() -> uint32, float() -> [0, 1), int(lo, hi) -> lo..hi
//                           inclusive, pick(array), chance(p); same seed, same sequence
//   hexSeed(world, q, r)    the seed of hex (q, r) in a world
//   edgeSeed(world, a, b)   the seed of the edge between hexes a = {q, r} and b = {q, r}: the same
//                           whichever side asks, so both hexes generate the strip between them alike
//   checksum(bytes)         FNV-1a over a Uint8Array (or any array of 0..255): compare it between
//                           machines to prove they hold the same data
//   hex8(n)                 a uint32 as 8 hex digits, for the debug readout

const M = 0x9e3779b9;

function mix(h) {                       // murmur3's finaliser: spreads every input bit
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash32(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    if (typeof p === 'string') {
      for (let i = 0; i < p.length; i++) h = mix(h ^ p.charCodeAt(i)) + M | 0;
    } else {
      h = mix(h ^ (p | 0)) + M | 0;
    }
    h = mix(h ^ 0x27d4eb2f);            // a separator, so ('ab', 'c') differs from ('a', 'bc')
  }
  return h >>> 0;
}

// sfc32: small, fast, and passes the usual statistical tests; four 32-bit words of state
export function rng(seed) {
  let a = hash32(seed, 1), b = hash32(seed, 2), c = hash32(seed, 3), d = 1;
  const next = () => {
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    c = c + t | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next();  // stir
  return {
    next,
    float: () => next() / 4294967296,
    int: (lo, hi) => lo + Math.floor(next() / 4294967296 * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() / 4294967296 * arr.length)],
    chance: p => next() / 4294967296 < p,
  };
}

export const hexSeed = (world, q, r) => hash32('hex', world, q, r);

export function edgeSeed(world, a, b) {
  // order the two hexes so A|B and B|A are the same edge
  const first = a.q < b.q || (a.q === b.q && a.r <= b.r);
  const [p, s] = first ? [a, b] : [b, a];
  return hash32('edge', world, p.q, p.r, s.q, s.r);
}

export function checksum(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ (bytes[i] & 255), 0x01000193);
  return h >>> 0;
}

export const hex8 = n => (n >>> 0).toString(16).padStart(8, '0');
