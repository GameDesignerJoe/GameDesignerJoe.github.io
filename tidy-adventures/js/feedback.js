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
