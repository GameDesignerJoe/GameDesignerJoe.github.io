/* ============================================================
   QUESTS — the note loop.

   The ask was "a quest system, or maybe a conversation pop-out". A talking
   character is the expensive, fragile version: a dialogue tree with a
   portrait costs an order of magnitude more, it interrupts the meditative
   loop the game is genuinely good at, and a badly-written NPC actively
   damages the tone. A handwritten note is the cheap version of the same
   thing — no art, no voice, no tree — and it still gives the house someone
   living in it.

   Flow: finish the first container in a room -> a 📝 lands on the floor ->
   pick it up -> a card, one or two sentences, asking for three specific
   things -> a pinned objective strip -> file them -> gold ripple, ⭐, and a
   reply that answers back.

   No new systems: it reads typeHome, watches afterMutation, and reuses the
   completion FX. Data lives in data/quests.json.

   Imports: dom, data, state, util, geometry, feedback, chatter, audio.
============================================================ */
import { $, el } from './dom.js';
import { DATA, LOOKUP, nameOf, jobAt, freeJobAt } from './data.js';
import { G } from './state.js';
import { tokenise, shuffle } from './util.js';
import { findFloorSpot, spin } from './geometry.js';
import { chatter, CHAT } from './chatter.js';
import { play as sfx } from './audio.js';

const NOTE = "📝";
let onChange = () => {};
export function initQuests({ change }) { onChange = change; }

/* ============================================================
   Spawning
============================================================ */
/* Called when a container completes. The first one finished in a room drops
   a note and breaks the seal on that room's quest container. */
export function maybeDropNote(room, justFinished) {
  if (!G.active) return false;
  if (G.quests.dropped.includes(room.id)) return false;

  const target = questContainer(room);
  /* Finishing the quest container itself doesn't trigger it. */
  if (target && justFinished && target.id === justFinished.id) return false;

  const q = questFor(room, target);
  if (!q) return false;

  /* Break the seal — this is the payoff for finishing the first container. */
  if (target && target.lock?.quest) target.lock.open = true;

  G.quests.dropped.push(room.id);
  const id = "q" + room.id;
  G.quests.notes[id] = { id, room: room.id, cont: target ? target.id : null, ...q, state: "onFloor" };

  /* A real item on the floor, so picking it up uses the code the player
     already knows. It goes through the same spot search as everything else:
     a note that lands in a doorway is painted over by the door and can't be
     tapped, and this one is the only copy. */
  const iid = Math.max(-1, ...Object.keys(G.items).map(Number)) + 1;
  const spot = findFloorSpot(room, { margin: 10, span: 78, avoidCaches: true });
  G.items[iid] = {
    id: iid, type: NOTE, isNote: true, noteId: id, judged: true,
    loc: { kind: "floor", room: room.id, x: spot.x, y: spot.y, rot: spin(12) },
  };
  return true;
}

export const questContainer = room =>
  room.questCont == null ? null : room.containers[room.questCont];

/* Is every item of this type already filed where it belongs? */
function alreadyDone(e) {
  const h = G.typeHome[e];
  if (!h) return false;
  const c = G.rooms[h.room]?.containers[h.cont];
  if (!c) return false;
  const want = Object.values(G.items).filter(o => o.type === e).length;
  let have = 0;
  for (const rowIds of c.cells) for (const id of rowIds) {
    if (id !== null && G.items[id].type === e) have++;
  }
  return want > 0 && have >= want;
}

/* Whose hand is this note in? A campaign level is somebody's job, so it is
   theirs. A free-play house is nobody's, and writes in the house's own hand —
   which is what "— M" now means. */
/* WHO IS ON THIS JOB — campaign or free play. Free play used to have nobody
   in it, which is what "— M" in quests.json means: the hand a house writes in
   when nobody hired you. Every free-play house belongs to one of the cast now,
   so the note is signed by them and the reply arrives in their voice, and the
   generic hand is left for a legacy save with no house id. */
function voice() {
  const job = G.mode === "campaign" ? jobAt(G.levelIdx) : freeJobAt(G.freeId);
  if (!job) return { sign: DATA.quests.signature || "", beats: [] };
  return {
    sign: job.client.sign || ("— " + job.client.name),
    /* A FREE-PLAY HOUSE HAS NO STAGE, so no stage-authored note copy — the
       optional chain is load-bearing, not defensive. What it gets instead is
       the room's own copy from quests.json signed in their hand, which is the
       right split: the words are about the room and the signature is about who
       asked. Authoring free-play note copy per house would be 235 x 3 lines. */
    beats: job.stage?.note || [],
  };
}

/* Build the quest. Prefer the room's sealed container — its contents are
   guaranteed to still be loose, so the note can never ask for something
   you've already put away. */
function questFor(room, target) {
  const data = DATA.quests;
  const v = voice();
  /* One note per room, in the order rooms are FINISHED, so the stage's beats
     are consumed in that order too. dropped[] is pushed after this returns,
     so its length is this note's index. */
  const beat = v.beats[G.quests.dropped.length] || null;

  const typesOf = c => Object.entries(G.typeHome)
    .filter(([, h]) => h.room === room.id && h.cont === c.id)
    .map(([e]) => e);

  if (target) {
    const need = shuffle(typesOf(target)).slice(0, 3);
    if (need.length) {
      const vars = { container: target.name, room: room.name };
      const authored = data.rooms[room.defId];
      /* Authored copy only fits if it names this container's contents. */
      const fits = authored && authored.need.every(e => need.includes(e));
      /* Three tiers, client first: what THIS job's client wrote, else the
         room's own authored copy, else the generic line. One voice per job is
         the rule, so a stage that writes its own beat wins — otherwise the
         frat house would start quoting a note about milk and eggs. Either
         way it is signed by whoever hired you. */
      const copy = beat || (fits ? authored : data.sealed);
      return {
        need,
        text: tokenise(copy.text, vars),
        reply: tokenise(copy.reply, vars),
        sign: v.sign,
        authored: !!fits,
      };
    }
  }

  /* No sealed container in this room — fall back to an open one, but only
     ask for types that aren't already filed. */
  const c = room.containers.find(c => !c.lock || c.lock.open);
  if (!c) return null;
  const need = shuffle(typesOf(c).filter(e => !alreadyDone(e))).slice(0, 3);
  if (!need.length) return null;
  const vars = { container: c.name, room: room.name };
  const copy = beat || data.fallback;
  return {
    need,
    text: tokenise(copy.text, vars),
    reply: tokenise(copy.reply, vars),
    sign: v.sign,
    authored: false,
  };
}

/* ============================================================
   Reading and tracking
============================================================ */
export function openNote(noteId) {
  const q = G.quests.notes[noteId];
  if (!q) return;
  q.state = "active";
  G.quests.active = noteId;

  $("#noteText").textContent = q.text;
  /* Baked into the note when it dropped, not read live: the note keeps the
     voice of whoever left it even if the run moves on. */
  $("#noteSign").textContent = q.sign || DATA.quests.signature || "";
  const row = $("#noteNeed");
  row.innerHTML = "";
  for (const e of q.need) {
    const s = el("span", "nreq", e);
    s.title = nameOf(e);
    row.appendChild(s);
  }
  $("#noteOverlay").classList.add("open");
  renderObjective();
}

/* How many of the required types are home. */
function progress(q) {
  let done = 0;
  for (const e of q.need) if (typeIsHome(e)) done++;
  return done;
}
function typeIsHome(e) {
  const h = G.typeHome[e];
  if (!h) return false;
  const c = G.rooms[h.room]?.containers[h.cont];
  if (!c) return false;
  /* Every item of this type must be in the right container. */
  const want = Object.values(G.items).filter(o => o.type === e).length;
  let have = 0;
  for (const rowIds of c.cells) for (const id of rowIds) {
    if (id !== null && G.items[id].type === e) have++;
  }
  return want > 0 && have >= want;
}

/* The pinned strip under the HUD. */
export function renderObjective() {
  const bar = $("#objective");
  const q = G.quests.active && G.quests.notes[G.quests.active];
  if (!q || q.state !== "active") { bar.hidden = true; bar.classList.add("is-hidden"); return; }
  bar.hidden = false; bar.classList.remove("is-hidden");
  bar.innerHTML = "";
  bar.appendChild(el("span", "onote", NOTE));
  for (const e of q.need) {
    const s = el("span", "oreq" + (typeIsHome(e) ? " done" : ""), e);
    s.title = nameOf(e);
    bar.appendChild(s);
  }
}

/* Called from afterMutation. Returns the finished quest, if one just finished. */
export function checkQuests() {
  const id = G.quests.active;
  const q = id && G.quests.notes[id];
  if (!q || q.state !== "active") return null;
  if (progress(q) < q.need.length) { renderObjective(); return null; }

  q.state = "done";
  G.quests.active = null;
  G.quests.completed.push(id);
  renderObjective();
  return q;
}

export function completeQuest(q) {
  /* NO ⭐ FOR AN ERRAND. It paid 1 and, like the coin cache, never called
     addStars() — so the chip that flew at the wallet was decorative and the
     wallet never moved. ⭐ comes from finishing ROOMS now, full stop, and the
     reward for an errand is the client answering you back, which is the part
     that was worth having.

     The sound stays: finishing someone's errand was the one reward in the game
     that made no noise at all, and that was the actual complaint. */
  sfx("star");
  /* The reply used to be a say() with the signature stapled onto the end of it,
     which is a note read out by the narrator and then attributed. It is the
     client answering you back, so they say it — and once their FACE is on the
     bubble the signature is redundant, which is the whole argument for the
     chatter channel in one line. The face is looked up the same way voice()
     resolves the signature, so a note and its reply can never disagree about
     who left it. */
  chatter(replyFace(), q.reply, { rank: CHAT.note, key: "reply:" + q.id });
  onChange();
}

/* Who answers. A note is signed when it DROPS and keeps that hand for the rest
   of the run (see the comment on q.sign), but the reply arrives live, so this
   asks the run who is on the job right now — and falls back to the house the
   same way speaker() in main.js does. */
function replyFace() {
  const job = G.mode === "campaign" ? jobAt(G.levelIdx) : freeJobAt(G.freeId);
  if (job) return job.client.emoji;
  const hv = DATA.strings.houseVoice || {};
  return DATA.themes.themes[G.theme]?.icon || hv.face || DATA.strings.icon || "🏠";
}

export function blankQuests() {
  return { notes: {}, dropped: [], completed: [], active: null };
}
