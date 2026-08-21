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
   Used for upgrade descriptions, tip text, help copy, note copy and quips.

   IT ALSO SWALLOWS A DOUBLED ARTICLE, and that is not a flourish. Room and
   container names carry their own articles and they disagree: "Fridge" and
   "Kitchen" want a "the", while "The Dish Rack", "The Familiar's Roost" and
   "The Actual Bin" already have one. Copy that reads "anything that lives in
   the {container} goes back in the {container}" is correct English for two
   thirds of the containers in the game and renders as "in the The Dish Rack"
   for the rest — and there are fifty-nine such phrases across the note copy
   alone, every one of them authored, reviewed and shipped.

   docs/CLAUDE.md's rule stands and is stricter than this: a NEW sentence
   should hold these names in label position, and validate.js now errors on an
   article in front of {container}/{room}/{item} in quip copy. This is the
   repair for the sentences that already exist, applied once, at the only place
   every one of them passes through. It cannot fix the opposite mistake — "the
   Hydroponics", where the name takes no article at all — because nothing here
   knows which names those are. */
export function tokenise(str, values = {}) {
  return String(str).replace(/((?:\b(?:the|a|an)\s+)?)\{(\w+)(?:\|(\w+))?\}/gi,
    (all, lead, key, filter) => {
      if (!(key in values)) return all;       // left intact; validate.js flags it
      const v = values[key];
      if (filter === "sec") return lead + String(Math.round(v / 1000));
      let out = String(v);
      if (/^the\s+$/i.test(lead) && /^the\s+/i.test(out)) out = out.slice(4);
      return lead + out;
    });
}

/* Every {token} a string references, so validation can check them up front. */
export function tokensIn(str) {
  return [...String(str).matchAll(/\{(\w+)(?:\|\w+)?\}/g)].map(m => m[1]);
}

export const plural = (n, one, many) => (n === 1 ? one : many);

/* How many items a campaign config will actually put on the floor, on average.

   rooms x cont x types x rowLen is only an upper bound, and in a house it is a
   loose one: `cont` is capped by how many containers the room it lands in
   happens to have, and `types` by how many that container holds — the Closet
   has a two-emoji shoe rack, so asking it for five gets two. Non-house themes
   run five-of-five throughout and hit the bound exactly, which is precisely why
   the gap only shows up on the levels set in a house.

   Averaged over the room pool rather than sampled, because both callers need
   the same answer every time: js/data.js labels the job with it and
   js/validate.js warns when two jobs in a row come out the same size, and a
   warning that appears on some boots and not others is worse than none.

   PURE — the room defs are passed in, so validate.js can call it before the
   lookups it would otherwise need are built. */
export function expectedItems(cfg, roomDefs) {
  if (!roomDefs.length) return 0;
  const perRoom = roomDefs.map(r => {
    const cs = r.containers || [];
    if (!cs.length) return 0;
    const taken = Math.min(cfg.cont ?? cs.length, cs.length);
    const mean = cs.reduce((n, c) => n + Math.min(cfg.types ?? 99, (c.types || []).length), 0) / cs.length;
    return taken * mean;
  });
  const mean = perRoom.reduce((a, b) => a + b, 0) / perRoom.length;
  return Math.round((cfg.rooms || 1) * mean * (cfg.rowLen || 1));
}

/* How many of an anchor list can be used before two boxes of w x h overlap.

   A PREFIX, not a subset: generate() hands out anchors in order (AN[i % len]),
   so the answer to "how many containers fit in this room" is how far down the
   list you can walk cleanly. rect gives 6; soft gives 4, because its 5th and
   6th slots share the middle column with its 1st and 2nd. Both validate.js and
   generate.js need that number and neither may guess it — a free-play Mega
   house was putting five containers in the round Observatory and two of them
   overlapped by a quarter of their area. */
/* HOW MANY DISTINCT TYPES A THEME CAN PUT ON THE FLOOR with its n LARGEST
   rooms — the ceiling on `targetTypes`, and now also the thing free play sizes
   itself against.

   It has to be one function because three callers need the same answer and any
   two of them disagreeing is a bug you find 400 items into a run: validate.js
   refuses a config that asks for more than this, data.js builds every free-play
   house by working backwards from it, and generate.js has to be able to deliver
   what both of them promised. validate.js had the only copy and it was a local
   closure over its own `rooms` array.

   n LARGEST, not all of them: generate() takes the biggest rooms first once a
   quota is set, and a room only shows as many containers as it has clean
   anchors for — which is 6 in a rect room and 4 in a round or hex one, because
   the soft anchor list's 5th and 6th slots share a column with its 1st and 2nd.

   PURE — every input is passed in, so validate.js can call it before
   buildLookups() has run and data.js can call it after. */
export function themeTypeCap(theme, roomDefs, anchors, defaultSize, nRooms) {
  const fit = set => anchorPrefix(anchors?.[set] || [], defaultSize.w, defaultSize.h);
  const rectN = fit("rect"), softN = fit("soft");
  const soft = (theme?.shapes || []).some(s => s !== "rect");
  const per = (theme?.rooms || [])
    .map(rid => roomDefs.find(r => r.id === rid))
    .filter(Boolean)
    .map(r => {
      const cap = (r.shape || (soft ? "round" : "rect")) === "rect" ? rectN : softN;
      return (r.containers || []).map(c => (c.types || []).length)
        .sort((a, b) => b - a).slice(0, cap).reduce((m, n) => m + n, 0);
    })
    .sort((a, b) => b - a);
  return per.slice(0, nRooms).reduce((a, b) => a + b, 0);
}

export function anchorPrefix(list, w, h) {
  const hits = (a, b) =>
    Math.min(a.x + w, b.x + w) > Math.max(a.x, b.x) &&
    Math.min(a.y + h, b.y + h) > Math.max(a.y, b.y);
  for (let n = 1; n < list.length; n++) {
    for (let i = 0; i < n; i++) if (hits(list[i], list[n])) return n;
  }
  return list.length;
}
