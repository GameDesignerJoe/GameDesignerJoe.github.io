// node nas-online/tests/rng.test.mjs  — the seeded generator must give fixed, known values.
// If a change to js/core/rng.js alters these, every generated world changes: update them only on purpose.
import { hash32, rng, hexSeed, edgeSeed, checksum, hex8 } from '../js/core/rng.js';
import assert from 'node:assert/strict';

const PIN_SEED = 'cbb1216d';
const PIN_DRAWS = ['161ce299', '95542c6c', '6baf082d'];

const r = rng(hexSeed('test', 0, 0));
const first = [r.next(), r.next(), r.next()].map(hex8);
console.log('hexSeed(test,0,0) =', hex8(hexSeed('test', 0, 0)), ' first draws', first.join(' '));

// same seed, same sequence
const a = rng(42), b = rng(42);
for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
// different seeds differ
assert.notEqual(rng(1).next(), rng(2).next());
// edges are the same from either side, and differ between edges
const A = { q: 0, r: 0 }, B = { q: 1, r: 0 }, C = { q: 0, r: 1 };
assert.equal(edgeSeed('w', A, B), edgeSeed('w', B, A));
assert.notEqual(edgeSeed('w', A, B), edgeSeed('w', A, C));
// strings are separated
assert.notEqual(hash32('ab', 'c'), hash32('a', 'bc'));
// ranges
const g = rng(7);
for (let i = 0; i < 10000; i++) { const f = g.float(); assert.ok(f >= 0 && f < 1); const k = g.int(3, 5); assert.ok(k >= 3 && k <= 5); }
// FNV-1a reference value for "a"
assert.equal(checksum([97]), 0xe40c292c);
// pinned values: these must never change silently
assert.equal(hex8(hexSeed('test', 0, 0)), PIN_SEED);
assert.deepEqual(first, PIN_DRAWS);
console.log('rng: all checks pass');
