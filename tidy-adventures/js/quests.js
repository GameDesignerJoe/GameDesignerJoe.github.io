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

   Imports: dom, data, state, util, feedback.
============================================================ */
import { $, el, host } from './dom.js';
import { DATA, LOOKUP, nameOf } from './data.js';
import { G } from './state.js';
import { tokenise, shuffle } from './util.js';
import { say, flyReward } from './feedback.js';

const NOTE = "📝";
let onChange = () => {};
export function initQuests({ change }) { onChange = change; }

/* ============================================================
   Spawning
============================================================ */
/* Called when a container completes. The first one in a room drops a note. */
export function maybeDropNote(room) {
  if (!G.active) return false;
  if (G.quests.dropped.includes(room.id)) return false;
  const q = questFor(room);
  if (!q) return false;

  G.quests.dropped.push(room.id);
  const id = "q" + room.id;
  G.quests.notes[id] = { id, room: room.id, ...q, state: "onFloor" };

  /* A real item on the floor, so picking it up uses the code the player
     already knows. */
  const iid = Math.max(-1, ...Object.keys(G.items).map(Number)) + 1;
  G.items[iid] = {
    id: iid, type: NOTE, isNote: true, noteId: id, judged: true,
    loc: { kind: "floor", room: room.id, x: 12 + Math.random() * 76, y: 20 + Math.random() * 60, rot: Math.random() * 24 - 12 },
  };
  return true;
}

/* Build a quest for this room: the authored one if its items are in play,
   otherwise one generated from whatever the room actually holds. */
function questFor(room) {
  const data = DATA.quests;
  const authored = data.rooms[room.defId];
  const present = e => {
    const h = G.typeHome[e];
    return h && h.room === room.id;
  };

  if (authored && authored.need.every(present)) {
    return { need: [...authored.need], text: authored.text, reply: authored.reply, authored: true };
  }

  /* Fallback: pick a container in this room and ask for a few of its types. */
  const c = room.containers.find(c => !c.lock || c.lock.open);
  if (!c) return null;
  const types = shuffle(Object.entries(G.typeHome)
    .filter(([, h]) => h.room === room.id && h.cont === c.id)
    .map(([e]) => e));
  if (!types.length) return null;
  const need = types.slice(0, Math.min(3, types.length));
  const vars = { container: c.short || c.name, room: room.name };
  return {
    need,
    text: tokenise(data.fallback.text, vars),
    reply: tokenise(data.fallback.reply, vars),
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
  $("#noteSign").textContent = DATA.quests.signature || "";
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
  G.points++; G.starsEarned++;
  const room = G.rooms[q.room];
  const fe = host.querySelector(".furn");
  flyReward(fe || host, "+1 ⭐");
  say(q.reply + "  " + (DATA.quests.signature || ""), { priority: 2, ms: 4200 });
  onChange();
}

export function blankQuests() {
  return { notes: {}, dropped: [], completed: [], active: null };
}
