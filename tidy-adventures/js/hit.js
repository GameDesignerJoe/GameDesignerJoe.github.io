/* ============================================================
   HIT — which emoji did that tap actually land on?

   THE PROBLEM. A floor item is a <div> holding one emoji, and the browser
   hit-tests its BOX. That box is font-size (22px) plus --item-pad on every
   side (10px), so roughly 44x42 — about four times the area of the glyph
   inside it, and the glyph itself is round-ish, so most of the box is
   transparent. Items are scattered with deliberate overlap, and the top one
   wins every tap. The result is the note in the design doc: you put the
   cursor squarely on the thing you want, and pick up the thing next to it,
   because you were inside its invisible halo.

   THE FIX, in two passes:

     1. Ink. Of the items under the point, take the topmost whose actual
        opaque pixels are under it. This is the answer the player expects,
        because it is the one they can see.
     2. Halo. If no glyph's ink is under the point, fall back to the topmost
        box — exactly today's behaviour.

   Pass 2 is what keeps this safe. The padding is a deliberate fat-finger
   target (see css/base.css) and it still works for an item on its own; it
   just stops outranking a glyph you are pointing straight at. A tap that
   picked something up before still picks something up, so the worst case of
   a wrong mask is the behaviour we already ship.

   HOW THE MASK IS BUILT. Once per emoji, per rendered size: draw the glyph
   into a canvas laid out the way the DOM lays it out — same font, same size,
   baseline placed for `line-height: 1` — and record which pixels came out
   opaque. Then dilate it by a pixel or so, because a glyph edge is
   antialiased and nobody aims to sub-pixel precision.

   Masks are cached by emoji + font + box size, so a run of 250 items builds
   at most one canvas per distinct type (about 60) and the rest are lookups.
   Zoom does not invalidate anything: the query point is mapped back into the
   element's own coordinates first.

   The cache is never evicted, and does not need to be: the key space is the
   emoji taxonomy in rooms.json, which is about 314 types. A session that plays
   the entire campaign ends up holding roughly 2.5MB of masks and cannot hold
   more, because there is no more emoji to see.

   Imports: nothing. This module knows about DOM elements and pixels; it does
   not know that the game exists.
============================================================ */

/* A pixel counts as ink above this alpha. Emoji edges are antialiased, so the
   threshold only decides how much of the soft edge is "the glyph"; anything
   in this range behaves the same. */
const ALPHA = 32;
/* Supersample. Thin glyphs (a wrench, a ruler, a needle) are a couple of CSS
   pixels wide in places and vanish from a 1x mask. */
const SS = 2;
/* Grow the mask by this many CSS pixels. Forgiveness for an antialiased edge
   and for the difference between where a font paints a glyph and where canvas
   says it painted it. Bigger reads as "generous"; too big and the halo problem
   comes back. */
const GROW = 1.5;
/* A mask this empty means the glyph did not render — an unknown codepoint, a
   font that has not loaded, a browser that draws emoji some way canvas cannot
   see. Treat it as "no mask" and let the box answer, rather than making the
   item untappable. */
const MIN_INK = 0.02;

const masks = new Map();

/* Build the alpha mask for one glyph.
   The mask covers the element's WHOLE border box, padding included, not just
   the content box — with `line-height: 1` an emoji overflows its own line box
   by a couple of pixels at the bottom, and that overhang is painted, visible,
   and worth being able to tap. `box` is {w,h,padL,padT,contentW,contentH}.
   Returns {w,h,bits} in supersampled pixels, or null if it did not render. */
function buildMask(emoji, font, box) {
  const w = Math.max(1, Math.round(box.w * SS));
  const h = Math.max(1, Math.round(box.h * SS));
  let data;
  try {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.scale(SS, SS);
    g.font = font;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    /* Where the DOM puts the baseline. With `line-height: 1` the line box is
       exactly font-size tall, so the half-leading is (fontSize - (A+D))/2 —
       negative for most fonts, which is why the glyph slightly overflows its
       own line box — and the baseline sits half-leading + ascent below the
       top of the content box. Falling back to centring the em box is close
       enough for the fonts that don't report metrics. */
    const m = g.measureText(emoji);
    const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
    const half = (A >= 0 && D >= 0) ? (box.contentH + A - D) / 2 : box.contentH * 0.8;
    g.fillText(emoji, box.padL, box.padT + half);
    data = g.getImageData(0, 0, w, h).data;
  } catch (e) {
    /* A tainted or unavailable canvas is not worth breaking input over. */
    return null;
  }

  const raw = new Uint8Array(w * h);
  let ink = 0;
  for (let i = 0, p = 3; i < raw.length; i++, p += 4) {
    if (data[p] >= ALPHA) { raw[i] = 1; ink++; }
  }
  /* Measured against the CONTENT box, not the padded one, so the threshold
     means "did this glyph render" and does not drift if the padding changes. */
  if (ink / (box.contentW * box.contentH * SS * SS) < MIN_INK) return null;

  /* Dilate. Separable: a horizontal pass then a vertical one, which is the
     same result as a square kernel and an order of magnitude less work. */
  const r = Math.max(1, Math.round(GROW * SS));
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let d = -r; d <= r && !on; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < w && raw[y * w + xx]) on = 1;
      }
      tmp[y * w + x] = on;
    }
  }
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let d = -r; d <= r && !on; d++) {
        const yy = y + d;
        if (yy >= 0 && yy < h && tmp[yy * w + x]) on = 1;
      }
      bits[y * w + x] = on;
    }
  }
  return { w, h, bits };
}

function maskFor(emoji, font, box) {
  const key = `${emoji}|${font}|${Math.round(box.w)}x${Math.round(box.h)}`;
  if (!masks.has(key)) masks.set(key, buildMask(emoji, font, box));
  return masks.get(key);
}

/* Everything about an element that decides which mask it needs. Shared so that
   warming and hit-testing can never disagree about which mask an item uses —
   a warm pass that built the wrong key would look exactly like no warm pass
   at all, only slower. */
function measure(el, cs) {
  const w = el.offsetWidth, h = el.offsetHeight;
  const padL = parseFloat(cs.paddingLeft) || 0, padT = parseFloat(cs.paddingTop) || 0;
  const padR = parseFloat(cs.paddingRight) || 0, padB = parseFloat(cs.paddingBottom) || 0;
  const box = { w, h, padL, padT, contentW: w - padL - padR, contentH: h - padT - padB };
  if (box.contentW <= 0 || box.contentH <= 0) return null;
  return {
    box,
    font: cs.font || `${cs.fontSize} ${cs.fontFamily}`,
    glyph: (el.textContent || "").trim(),
  };
}

function ensureMask(el) {
  const m = measure(el, getComputedStyle(el));
  if (m && m.glyph) maskFor(m.glyph, m.font, m.box);
}

/* Rotation, in radians, from an element's own transform. Read off the computed
   matrix rather than the inline string so it stays right whatever writes the
   transform — the fling animation rewrites it mid-flight, and the pick-up lift
   is a transition, so the inline string and what is on screen disagree for
   120ms after every grab. */
function angleOf(cs) {
  const t = cs.transform;
  if (!t || t === "none") return 0;
  const n = t.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!n) return 0;
  const v = n[1].split(",").map(parseFloat);
  /* matrix(a,b,c,d,e,f) and matrix3d(m11,m12,...) both start [a,b] = the
     first column, whose angle is the rotation. */
  return Math.atan2(v[1], v[0]);
}

/* Is (clientX, clientY) on the painted part of this item's glyph?
   Unknown (no mask, degenerate geometry) counts as YES, so anything this
   cannot measure keeps the whole-box behaviour it has today. */
export function onInk(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h || !rect.width) return true;

  /* One style resolution for the whole function: getComputedStyle flushes
     layout, and this runs once per candidate under the finger. */
  const cs = getComputedStyle(el);
  const th = angleOf(cs);
  const cos = Math.cos(th), sin = Math.sin(th);
  /* The element's screen scale, without needing to know the camera's zoom or
     whether the item is lifted: an unrotated w x h box, rotated by th and
     scaled uniformly by S, has an axis-aligned width of
     S * (w|cos| + h|sin|), and that is exactly rect.width. */
  const denom = w * Math.abs(cos) + h * Math.abs(sin);
  if (denom <= 0) return true;
  const S = rect.width / denom;
  if (!(S > 0)) return true;

  /* Rotation and scale are both about the centre, and translate(-50%,-50%) is
     part of the same transform, so the rect's centre IS the element's centre
     however it has been moved. Undo the scale, then the rotation. */
  const dx = (clientX - (rect.left + rect.width / 2)) / S;
  const dy = (clientY - (rect.top + rect.height / 2)) / S;
  const lx = dx * cos + dy * sin + w / 2;
  const ly = -dx * sin + dy * cos + h / 2;

  const m = measure(el, cs);
  if (!m || !m.glyph) return true;
  const mask = maskFor(m.glyph, m.font, m.box);
  if (!mask) return true;

  const u = lx / w, v = ly / h;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  const mx = Math.min(mask.w - 1, (u * mask.w) | 0);
  const my = Math.min(mask.h - 1, (v * mask.h) | 0);
  return !!mask.bits[my * mask.w + mx];
}

/* The item under (clientX, clientY), preferring one you can actually see.
   `sel` is the selector for a pickable item.

   Searching a STACK rather than just the top element is what makes the ink
   test useful, and it is also the one way this could go wrong: a door paints
   over the floor at a higher z-index, and reaching past it would turn "walk
   through the door" into "pick up the thing behind it". So the walk stops at
   the first element that is painted on top of the items rather than being the
   thing that holds them: you may search THROUGH a container of items, never
   through something drawn over them. */
export function itemAt(clientX, clientY, sel = ".item") {
  let stack;
  try { stack = document.elementsFromPoint(clientX, clientY); }
  catch (e) { return null; }
  /* elementsFromPoint is in paint order, topmost first, and already respects
     pointer-events — so the first match of each pass is the right one. */
  let top = null;
  for (const node of stack) {
    const el = node.closest?.(sel);
    if (el) {
      if (!top) top = el;
      if (onInk(el, clientX, clientY)) return el;
      continue;
    }
    /* Not an item. Holding items means we are still descending the room;
       holding none means it is a lid, and the search is over. */
    if (!node.querySelector?.(sel)) break;
  }
  return top;
}

/* What is under the point that you could DROP on, ignoring loose clutter.

   Same shape of bug as itemAt, from the other end. Floor items paint above
   furniture, so an emoji lying on a chest made that part of the chest's face
   refuse a drop: elementFromPoint returned the item, .closest(".furn") on it
   returned null, and the drag ended with your item flung back onto the floor.
   Measured at 19.6% of the average container's face, and one chest was 94%
   dead. Clutter is exactly what you are trying to clear, so it must not be
   what stops you clearing it.

   `skip` is the clutter to see past. The walk still stops at the first real
   lid, so the inventory bar does not become a window onto the furniture
   behind it. */
export function underAt(clientX, clientY, sel, skip = ".item") {
  let stack;
  try { stack = document.elementsFromPoint(clientX, clientY); }
  catch (e) { return null; }
  for (const node of stack) {
    if (node.matches?.(skip)) continue;
    const el = node.closest?.(sel);
    if (el) return el;
    if (!node.querySelector?.(sel)) break;
  }
  return null;
}

/* Build the masks for everything in a freshly drawn room, during idle time.

   Without this the cost of measuring a glyph lands on the FIRST tap that
   touches one — a couple of milliseconds on a laptop, more on a phone, and
   always at the worst possible moment, which is the one time the player is
   waiting to see whether the tap worked. A room has fifteen or twenty distinct
   emoji in it and the browser has nothing else to do the moment after a
   render, so pay for them there instead. Chunked, because a room at Mega has
   more, and idle time is borrowed, not owned. */
export function warmMasks(root = document, sel = ".item") {
  const seen = new Set(), todo = [];
  for (const el of root.querySelectorAll(sel)) {
    const g = (el.textContent || "").trim();
    if (!g || seen.has(g)) continue;
    seen.add(g);
    todo.push(el);
  }
  if (!todo.length) return;
  const idle = window.requestIdleCallback
    || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 1));
  const step = deadline => {
    while (todo.length && deadline.timeRemaining() > 2) ensureMask(todo.pop());
    if (todo.length) idle(step);
  };
  idle(step);
}

/* Testing hook: how many glyphs have been measured, and how solid they are.
   A type whose mask is null renders as whole-box, which is worth being able
   to see rather than having to infer from a tap going somewhere odd. */
export function maskStats() {
  const out = [];
  for (const [key, m] of masks) {
    out.push({
      key,
      ok: !!m,
      ink: m ? +(m.bits.reduce((a, b) => a + b, 0) / m.bits.length).toFixed(3) : 0,
    });
  }
  return out;
}
