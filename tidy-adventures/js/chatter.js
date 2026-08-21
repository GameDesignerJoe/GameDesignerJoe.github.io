/* ============================================================
   CHATTER — the client leaning in, mid-job.

   The fourth feedback channel, and the reason it exists: every real thing that
   happened in a room used to be announced by `say()`, which slides a grey strip
   out from under the HUD for a second and a half. That strip is where the
   player is not looking — their eyes are on the thing they just tapped — so
   "The door creaks open", "Kitchen is all tidy" and "The chest clicks open"
   were all being missed. Worse, they were being missed in the NARRATOR's
   voice, in a game whose whole personality is the person who hired you.

   So: the same events, said by the client, with their face on it.

     say()      still exists, and now carries only RECEIPTS — the level id,
                "+3 put away", the debug buttons. Mechanical, skippable,
                and correctly boring.
     chatter()  narrative. A small bubble with a face, bottom-left, that
                auto-dismisses. Never blocks input, never needs a tap.

   WHY NOT showClient()? That one is a full-height figure with a viewport-wide
   input catcher and it waits for a tap. Correct for an arrival and a
   thank-you; ruinous three times a room. This is the same voice at a volume
   you can play through.

   ONE AT A TIME, AND RANKED. Finishing a container can also finish the row,
   the room, the quest and the run inside one millisecond — the exact pile-up
   the celebration queue in main.js was built for. Two rules keep this channel
   out of that: the queue is serial (one bubble, then a gap, then the next),
   and a higher-RANK line evicts everything still waiting. A room being clear
   outranks a chest opening, so the chest's line does not make the player wait
   through it to hear the better one.

   A LEAF: dom and audio only. It does not import client.js even though the
   full-figure client outranks it, because client.js has to be able to clear
   THIS channel when it takes the screen — importing both ways is a cycle. The
   precedence is injected instead, by setChatterGate() from main.js, which also
   lets one predicate cover the overlays (a menu, the win screen, the talent
   draft) without this module learning what an overlay is.

   Imports: dom, audio.
============================================================ */
import { $ } from './dom.js';
import { play as sfx } from './audio.js';

/* ---------- ranks ----------
   Higher wins. Keyed by the SITUATION, using the same names as `quips` in
   data/clients.json, so the pecking order is one readable table rather than
   six magic numbers spread across the call sites. */
export const CHAT = {
  misfile: 1,   /* you filed something wrong and its real home is in this room */
  nothing: 1,   /* you tried to file an armful in a room none of it lives in */
  door:    2,   /* a locked door gave way */
  cache:   2,   /* a coin box burst open */
  unlock:  2,   /* a locked container gave way */
  cont:    3,   /* a container finished — the default */
  note:    4,   /* the reply to a note they left you */
  room:    5,   /* a whole room is clear */
  nudge:   6,   /* you came back to a job you left half done */
};

/* Set by main.js. True means "somebody more important owns the screen": the
   full client is mid-sentence, or an overlay is up. */
let gate = () => false;
export function setChatterGate(fn) { gate = fn || (() => false); }

const layer  = $("#chatterLayer");
const bubble = $("#chatterBubble");
const lineEl = $("#chatterLine");
const faceEl = $("#chatterFace");

/* Reading time, same shape as say()'s but slower: this is a voice rather than
   a status line, and it is competing with a room the player is looking at. */
const MIN = 1600, MAX = 4200, PER_CHAR = 46;
const GAP = 260;                       /* between two bubbles, so they read as two */
const HELD = 240;                      /* re-check delay while a full client has the floor */

const queue = [];
let showing = null;
let hideTimer = null;
let nextTimer = null;

export const chatterBusy = () => !!showing || queue.length > 0;

/* character: "👩" or {emoji}. text: one line — this channel is deliberately
   incapable of a monologue; a monologue is showClient()'s job.
   opts.rank: a CHAT.* value. opts.key: dedupe key, defaults to the text. */
export function chatter(character, text, { rank = CHAT.cont, key = null } = {}) {
  if (!text) return;
  const line = String(text).trim();
  if (!line) return;
  const k = key || line;

  /* Already on screen or already waiting? Once is a voice, twice is a stutter.
     One Trip at level 2 can finish four rows in a single put-away. */
  if (showing?.k === k || queue.some(q => q.k === k)) return;

  const face = typeof character === "string" ? character : (character?.emoji || "🙂");
  const ms = Math.min(MAX, Math.max(MIN, 700 + PER_CHAR * line.length));
  const entry = { k, face, line, ms, rank };

  /* THE EVICTION RULE. A better line arriving means the waiting ones are no
     longer worth the player's time — a chest creaking open is not something
     you want to sit through on the way to hearing the room is finished. What
     is already ON SCREEN is left alone: yanking a sentence out from under
     someone mid-read is the bug this whole module is fixing. */
  if (queue.length && rank > Math.max(...queue.map(q => q.rank))) queue.length = 0;
  queue.push(entry);
  queue.sort((a, b) => b.rank - a.rank);
  /* Two deep. Anything past that is a backlog the moment has already outrun. */
  queue.length = Math.min(queue.length, 2);

  if (!showing) drain();
}

function drain() {
  clearTimeout(nextTimer);
  /* Somebody more important has the screen — the client standing in the room,
     or a menu. HOLD the queue rather than dropping it: a line earned by the
     gesture that triggered the speech is still worth saying once they have
     walked off. clearChatter() is what discards it for good, and endCeremony()
     is what calls that. */
  if (gate()) { nextTimer = setTimeout(drain, HELD); return; }

  const next = queue.shift();
  if (!next) { showing = null; return; }
  showing = next;

  faceEl.textContent = next.face;
  lineEl.textContent = next.line;
  /* Restart the entry keyframe the way the rest of the codebase does. */
  layer.classList.remove("up");
  void layer.offsetWidth;
  layer.classList.add("up");
  sfx("uiTap");

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    layer.classList.remove("up");
    showing = null;
    nextTimer = setTimeout(drain, GAP);
  }, next.ms);
}

/* Drop everything, on screen and queued. Called by endCeremony() and before a
   win screen or a menu takes over — a bubble still fading over the title
   screen is the same class of bug as a client mid-sentence under it. */
export function clearChatter() {
  queue.length = 0;
  clearTimeout(hideTimer);
  clearTimeout(nextTimer);
  showing = null;
  layer.classList.remove("up");
}

/* A tap on the bubble dismisses it early and lets the next one in. The layer
   itself is pointer-events:none; only the bubble accepts a tap, so this cannot
   eat a tap meant for the floor. Nothing in the game REQUIRES this — it is for
   the player who reads faster than PER_CHAR assumes. */
bubble.addEventListener("pointerup", e => {
  e.stopPropagation();
  if (!showing) return;
  clearTimeout(hideTimer);
  layer.classList.remove("up");
  showing = null;
  clearTimeout(nextTimer);
  nextTimer = setTimeout(drain, GAP);
});

/* Not gameplay — a handle for eyeballing the channel in isolation, hung off
   window.tidy by main.js the way saveGame and checkDraftThreshold are. */
export const chatterState = () => ({ showing, queued: queue.map(q => q.k) });
