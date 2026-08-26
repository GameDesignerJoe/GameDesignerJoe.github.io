/* ============================================================
   FEEDBACK — three channels instead of one overloaded toast.

   v3 had a single 1400ms toast doing three unrelated jobs, sitting directly
   above the inventory bar: under the player's thumb, behind #dragGhost, in
   the one part of the screen their eyes are not on. A new message instantly
   clobbered the previous one with no queue. 39 call sites shared it.

     say()       real messages. Queued, never clobbered, reading time scales
                 with length, and moved up under the HUD where the eyes are.
     bump()      rejections. Shake the thing that said no and float a glyph
                 off it — announced where the player is already looking, with
                 nothing to read. The sentence is kept for the FIRST time each
                 rule is hit, so the game stays teachable.
     flyReward() rewards. A chip arcs from what you finished to the ⭐ in the
                 HUD, which pops. Teaches where stars accumulate.

   Imports: config, dom, state.
============================================================ */
import { T } from './config.js';
import { $, toastEl, shopBtn } from './dom.js';
import { G } from './state.js';

/* ============================================================
   Channel C — queued messages
============================================================ */
const queue = [];
let showing = null;
let timer = null;

export function say(text, { key = null, ms = null, priority = 0 } = {}) {
  if (!text) return;
  const k = key || text;
  if (showing?.k === k || queue.some(q => q.k === k)) return;   // dedupe
  const dur = ms ?? Math.min(T.toastMax, Math.max(T.toastMin, 900 + T.toastPerChar * text.length));
  const entry = { k, text, dur, priority };
  const at = queue.findIndex(q => q.priority < priority);
  if (at === -1) queue.push(entry); else queue.splice(at, 0, entry);
  if (!showing) drain();
}

function drain() {
  const next = queue.shift();
  if (!next) { showing = null; return; }
  showing = next;
  toastEl.textContent = next.text;
  toastEl.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(drain, T.toastGap);
  }, next.dur);
}

/* Drop anything queued — used when a run ends or a menu takes over. */
export function clearSay() {
  queue.length = 0;
  clearTimeout(timer);
  showing = null;
  toastEl.classList.remove("show");
}

/* ============================================================
   Channel A — diegetic rejection
============================================================ */
const fxLayer = (() => {
  const d = document.createElement("div");
  d.id = "fxLayer";
  document.body.appendChild(d);
  return d;
})();

/* Shake `el`, float `glyph` off it. If `rule` is given, the sentence is said
   the first time that rule is hit in this run and never again. */
export function bump(el, glyph, text = null, rule = null) {
  if (el) {
    el.classList.remove("fullhit");
    void el.offsetWidth;              // restart the animation
    el.classList.add("fullhit");
  }
  if (glyph) floatGlyph(el, glyph);
  if (text && rule && G.active && !G.taught.has(rule)) {
    G.taught.add(rule);
    say(text, { key: rule });
  } else if (text && !rule) {
    say(text);
  }
}

function floatGlyph(el, glyph) {
  const r = el?.getBoundingClientRect();
  const n = document.createElement("div");
  n.className = "fxglyph";
  n.textContent = glyph;
  n.style.left = (r ? r.left + r.width / 2 : innerWidth / 2) + "px";
  n.style.top  = (r ? r.top : innerHeight / 2) + "px";
  fxLayer.appendChild(n);
  setTimeout(() => n.remove(), 750);
}

/* ============================================================
   Channel B — reward flight
============================================================ */
export function flyReward(fromEl, text = "+1 ⭐", toEl = shopBtn) {
  const a = fromEl?.getBoundingClientRect();
  const b = toEl?.getBoundingClientRect();
  if (!a || !b) { return; }
  /* A hidden element still has a rect — an all-zero one. So a chip aimed at the
     ⭐ button while it was hidden did not silently do nothing: it flew to the
     top-left corner of the screen and faded there, once per completed row, for
     the whole of the early campaign. Refuse to fly at a target with no box. */
  if (!b.width && !b.height) return;
  const n = document.createElement("div");
  n.className = "fxchip";
  n.textContent = text;
  n.style.left = (a.left + a.width / 2) + "px";
  n.style.top  = (a.top + a.height / 2) + "px";
  fxLayer.appendChild(n);
  requestAnimationFrame(() => {
    n.style.transform = `translate(-50%,-50%) translate(${b.left + b.width/2 - (a.left + a.width/2)}px, ${b.top + b.height/2 - (a.top + a.height/2)}px) scale(.6)`;
    n.style.opacity = "0";
  });
  setTimeout(() => {
    n.remove();
    toEl.classList.remove("pop"); void toEl.offsetWidth; toEl.classList.add("pop");
  }, 620);
}

/* A ⭐ payout specifically. It used to be gated on `G.talents` so a level that
   had not "met stars yet" could suppress it — that flag is gone, because ⭐ is
   money now (js/home.js) and a currency you can earn but not see is worse than
   one you do not understand yet. Every payout still goes through this one
   function, which is what keeps the next rule about stars a one-line change. */
export function flyStar(fromEl, text = "+1 ⭐") {
  flyReward(fromEl, text);
}

/* ============================================================
   Channel D — A TALENT DOING SOMETHING, performed

   Tidy Hands, Me Too and Go to your Room all moved items by REPAINTING: the
   thing was on the floor, and the next frame it was not. There is no way to
   tell that from a talent you misunderstood, which is why all three read as
   nothing happening however loud their sound was.

   THE DATA MOVES FIRST AND THE PERFORMANCE IS A GHOST. Every caller mutates
   `loc` and repaints exactly as it always did, then hands us the screen point
   the item CAME FROM. So there is no half-moved state to hit-test against, no
   item you can tap in mid-air, and a flight interrupted by a room change, a
   reload or a win screen loses an animation rather than an item.

   Screen coordinates, not room percentages: #fxLayer is position:fixed and
   lives outside the camera, so it can neither read the room's transform nor
   inherit its font size. main.js measures both and passes them in — which is
   also why these work unchanged at any zoom.
============================================================ */
const FLY_IN_MS = 780;
const FLY_OUT_MS = 820;
/* A phone that asks for less motion gets none of this: the caller's callbacks
   still fire, on the same schedule, so the SOUNDS and the counts are identical
   and only the clone is missing. */
const stillness = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function flyClone(type, x, y, size) {
  const n = document.createElement("div");
  n.className = "fxfly";
  n.textContent = type;
  n.style.left = x + "px";
  n.style.top = y + "px";
  n.style.fontSize = size + "px";
  fxLayer.appendChild(n);
  return n;
}

/* INTO A PIECE OF FURNITURE — the item rises, hovers above the box, bumps,
   and is taken in. `onLand` fires as it goes in, which is where the caller
   puts its thump. */
export function flyToContainer(type, from, to, { size = 28, delay = 0, onLand = null } = {}) {
  const land = () => onLand && onLand();
  if (stillness()) { setTimeout(land, delay + FLY_IN_MS); return null; }
  const n = flyClone(type, from.x, from.y, size);
  /* The hover sits a glyph and a half above the target, so the pause reads as
     "over the box" rather than "on the box". */
  n.style.setProperty("--dx", (to.x - from.x) + "px");
  n.style.setProperty("--dy", (to.y - from.y - size * 1.5) + "px");
  n.style.setProperty("--tx", (to.x - from.x) + "px");
  n.style.setProperty("--ty", (to.y - from.y) + "px");
  n.style.animation = `fxtocont ${FLY_IN_MS}ms cubic-bezier(.3,.7,.4,1) ${delay}ms forwards`;
  setTimeout(land, delay + Math.round(FLY_IN_MS * 0.9));
  setTimeout(() => n.remove(), delay + FLY_IN_MS + 60);
  return n;
}

/* OUT OF THE ROOM — lift, swell, sail at the doorway, pop. `onPop` fires at
   the pop rather than at the end, because the sound is the pop. */
export function flyOut(type, from, to, { size = 28, delay = 0, onPop = null } = {}) {
  const pop = () => {
    if (onPop) onPop();
    if (stillness()) return;
    const ring = document.createElement("div");
    ring.className = "fxpop";
    ring.style.left = to.x + "px";
    ring.style.top = to.y + "px";
    fxLayer.appendChild(ring);
    setTimeout(() => ring.remove(), 420);
  };
  if (stillness()) { setTimeout(pop, delay + FLY_OUT_MS); return null; }
  const n = flyClone(type, from.x, from.y, size);
  n.style.setProperty("--tx", (to.x - from.x) + "px");
  n.style.setProperty("--ty", (to.y - from.y) + "px");
  n.style.animation = `fxexit ${FLY_OUT_MS}ms cubic-bezier(.35,.05,.5,1) ${delay}ms forwards`;
  setTimeout(pop, delay + Math.round(FLY_OUT_MS * 0.84));
  setTimeout(() => n.remove(), delay + FLY_OUT_MS + 60);
  return n;
}

/* A run ending mid-flight leaves clones sailing across the title screen. */
export function clearFlights() {
  fxLayer.querySelectorAll(".fxfly, .fxpop").forEach(n => n.remove());
}

/* ============================================================
   Room completion — the game's biggest moment.
   v3 marked it with a 1400ms toast.
============================================================ */
export function roomCompleteFX(roomEl) {
  if (!roomEl) return;
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const ring = document.createElement("div");
      ring.className = "ripple";
      roomEl.appendChild(ring);
      setTimeout(() => ring.remove(), T.ripple + 100);
    }, i * T.rippleStagger);
  }
  const floor = roomEl.querySelector(".floor");
  if (floor) {
    floor.classList.remove("wash"); void floor.offsetWidth; floor.classList.add("wash");
  }
  /* The relay is what makes it read as "the whole ROOM did it" rather than a
     generic effect: the gold visibly travels outward from the centre. */
  const furn = [...roomEl.querySelectorAll(".furn")];
  const cx = roomEl.clientWidth / 2, cy = roomEl.clientHeight / 2;
  furn
    .map(f => ({ f, d: Math.hypot(f.offsetLeft + f.offsetWidth / 2 - cx, f.offsetTop + f.offsetHeight / 2 - cy) }))
    .sort((a, b) => a.d - b.d)
    .forEach(({ f }, i) => setTimeout(() => {
      f.classList.remove("goldhit"); void f.offsetWidth; f.classList.add("goldhit");
    }, 120 + i * 90));

  const rn = $("#roomName");
  rn.classList.remove("pop"); void rn.offsetWidth; rn.classList.add("pop");
}
