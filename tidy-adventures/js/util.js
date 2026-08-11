/* ============================================================
   UTIL — tiny pure helpers. Imports: none.
============================================================ */
export const rnd = n => Math.floor(Math.random() * n);

export const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const pick = a => a[rnd(a.length)];

/* Resolve {token} and {token|sec} against a values object.
   Used for upgrade descriptions, tip text, and help copy. */
export function tokenise(str, values = {}) {
  return String(str).replace(/\{(\w+)(?:\|(\w+))?\}/g, (all, key, filter) => {
    if (!(key in values)) return all;         // left intact; validate.js flags it
    const v = values[key];
    if (filter === "sec") return String(Math.round(v / 1000));
    return String(v);
  });
}

/* Every {token} a string references, so validation can check them up front. */
export function tokensIn(str) {
  return [...String(str).matchAll(/\{(\w+)(?:\|\w+)?\}/g)].map(m => m[1]);
}

export const plural = (n, one, many) => (n === 1 ? one : many);
