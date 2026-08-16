/* ============================================================
   THE CLIENT — the person who hired you, on screen.

   The roadmap called the note "the cheapest possible NPC" and said: if the
   writing lands, THEN give the voice a face. This is the face. It slides in
   over the room rather than opening a modal, because the whole point is that
   you can see the mess behind them while they explain it.

   PURE PRESENTATION. It is handed a character and some lines; it knows nothing
   about clients, levels or runs. That keeps it a leaf (config/dom/feedback/
   audio only), so the render tier and the talent tier can both import it with
   no cycle.

   Imports: config, dom, feedback, audio.
============================================================ */
import { T } from './config.js';
import { $ } from './dom.js';
import { clearSay } from './feedback.js';
import { play as sfx } from './audio.js';

const layer  = $("#clientLayer");
const fig    = $("#clientFig");
const bubble = $("#clientBubble");
const lineEl = $("#clientLine");
const faceEl = $("#clientFace");
const moreEl = $("#clientMore");

/* Long enough to swallow the tail of the gesture that got here. The pointer
   that finished the winning move is CAPTURED by #roomHost (main.js's
   setPointerCapture), and capture beats z-index: its pointerup is delivered to
   the room no matter what is painted on top, then bubbles here. Without this
   the first line gets eaten by the tap that started the speech. Same reasoning
   as PANEL_GRACE in main.js. */
const GRACE = 300;

/* The global prefers-reduced-motion rule flattens CSS durations, but a JS
   timer keeps waiting the full slide time with nobody on screen. */
const slideMs = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : T.slide;

let epoch = 0;          /* bumped by every cancel; stale timers check it */
let lines = [];
let at = 0;
let shownAt = 0;
let onDoneFn = null;
let resolveFn = null;

/* Derived from the DOM, never a module flag, so it can't disagree with what is
   actually on screen. */
export const isSpeaking = () => layer.classList.contains("speaking");

/* ============================================================
   Showing
============================================================ */
/* character: "👩" or {emoji, name}
   text:      "one line" or ["one", "two"]
   opts.side: "left" (default) | "right"
   opts.onDone: called once they are actually off screen again — never on cancel.

   Resolves true if the player read to the end, false if the run ended
   underneath them. Never rejects, so a caller may ignore it safely. */
export function showClient(character, text, { side = "left", onDone = null } = {}) {
  hideClient();                       /* whatever was up, it isn't now */

  const mine = ++epoch;
  /* DATA is deep-frozen, so copy rather than touching the caller's array. */
  lines = (Array.isArray(text) ? text : [text]).filter(s => s && String(s).trim());
  at = 0;
  onDoneFn = onDone;

  return new Promise(resolve => {
    resolveFn = resolve;

    /* Nothing to say is legal — free play has no client, and a stage may have
       an intro and no outro. Settle ASYNCHRONOUSLY: a synchronous callback
       from inside a celebration beat would re-enter the beat queue from within
       the beat that is currently running. */
    if (!lines.length) {
      setTimeout(() => { if (epoch === mine) settle(true); }, 0);
      return;
    }

    faceEl.textContent = typeof character === "string" ? character : (character?.emoji || "🙂");
    moreEl.textContent = lines.length > 1 ? "▾ tap" : "▾ tap to begin";
    lineEl.textContent = lines[0];

    layer.classList.remove("from-left", "from-right");
    layer.classList.add(side === "right" ? "from-right" : "from-left", "speaking");

    /* They are the authority while they are up: a message strip sliding out
       from under the HUD mid-sentence is exactly the "everything at once"
       problem the celebration queue was built to fix. */
    clearSay();

    /* Park off screen, then let the stylesheet's transition bring them in.
       Same two-rAF idiom as slideTo() in main.js. The distance is
       width-relative, so a one-word bubble and a three-line one both land
       their trailing edge just off screen. */
    const off = side === "right" ? "calc(100% + 24px)" : "calc(-100% - 24px)";
    fig.style.transition = "none";
    fig.style.transform = `translateX(${off})`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (epoch !== mine) return;
      fig.style.transition = "";
      fig.style.transform = "";
      shownAt = Date.now();
    }));
    shownAt = Date.now();
    sfx("uiTap");
  });
}

/* Cancel. Settles false and does NOT call onDone — an outro that chains the
   win screen must not fire it over the title screen. */
export function hideClient() {
  if (!isSpeaking() && !resolveFn) return;
  epoch++;
  layer.classList.remove("speaking", "from-left", "from-right");
  fig.style.transition = "";
  fig.style.transform = "";
  lines = [];
  onDoneFn = null;
  const r = resolveFn; resolveFn = null;
  if (r) r(false);
}

/* ============================================================
   Advancing
============================================================ */
function advance() {
  if (!isSpeaking()) return;
  if (Date.now() - shownAt < GRACE) return;
  if (at < lines.length - 1) {
    at++;
    lineEl.textContent = lines[at];
    if (at === lines.length - 1) moreEl.textContent = "▾ tap";
    /* Restart the keyframe the way the rest of the codebase does. */
    bubble.classList.remove("swap");
    void bubble.offsetWidth;
    bubble.classList.add("swap");
    shownAt = Date.now();
    sfx("uiTap");
    return;
  }
  leave();
}

/* Slide out, THEN settle — the win screen should not land on top of someone
   who is still walking off. isSpeaking() stays true for the whole exit, so the
   gates keep holding and taps keep being swallowed. */
function leave() {
  const mine = epoch;
  const off = layer.classList.contains("from-right")
    ? "calc(100% + 24px)" : "calc(-100% - 24px)";
  fig.style.transform = `translateX(${off})`;
  sfx("uiTap");
  setTimeout(() => { if (epoch === mine) settle(true); }, slideMs() + 20);
}

function settle(ok) {
  layer.classList.remove("speaking", "from-left", "from-right");
  fig.style.transition = "";
  fig.style.transform = "";
  const done = onDoneFn, r = resolveFn;
  onDoneFn = null; resolveFn = null;
  if (r) r(ok);
  if (ok && done) done();
}

/* Tap anywhere. pointerup rather than click, to match the rest of the game. */
layer.addEventListener("pointerup", advance);
/* While someone is speaking this module owns the keyboard; main.js's handler
   returns early on isSpeaking(). */
window.addEventListener("keydown", e => {
  if (!isSpeaking()) return;
  if (e.key === " " || e.key === "Enter" || e.key === "Escape") {
    e.preventDefault();
    advance();
  }
});
