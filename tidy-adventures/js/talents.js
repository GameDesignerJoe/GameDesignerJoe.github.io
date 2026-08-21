/* ============================================================
   TALENTS — a pick-one-of-three draft, granted by the LEVEL.

   WHAT CHANGED AND WHY. Drafts used to be granted by crossing lifetime-⭐
   thresholds (`draftSteps: [4,10,18,28,40,55,72]`). That put the reward rate
   entirely outside a level's control: how many talents a house handed out fell
   out of how many rows it happened to contain, and nothing could say "this is
   a small job, it teaches you nothing" or "this is everything they have, take
   five". The first threshold was crossed on the LAST ITEM OF 1-2, which is why
   every level up to 5-1 carried `"talents": false` — a per-level override
   invented to work around having no per-level control.

   So a level authors `rewards: N` and grants a pick on each of its first N
   ROOM completions. Room completion because it is already the biggest moment
   the game has (gold ripple, its own celebration beat) and because a level's
   room count is its main size lever, so "mega house, five talents" is close to
   one per room. N is clamped to rooms-1: the last room finishing IS the level
   finishing, and a draft must not land on the ending.

   ⭐ LEFT THIS MODULE ENTIRELY. It is money now, spent at home (js/home.js) on
   things that persist. Nothing here reads it, and `draftSteps`,
   `draftsEarnedFor` and `nextThreshold` are gone rather than left dead.

   WHEN A PICK FIRES. Deferred to a safe moment — never mid-drag, never over an
   open container, never on top of a client mid-sentence. Deferral is what makes
   it read as a celebration rather than an interruption of the flow state the
   game is actually good at.

   Imports: config, dom, data, state, util, feedback, audio, client.
============================================================ */
import { $, el, setHidden, shopBtn } from './dom.js';
import { isSpeaking } from './client.js';
import { CONSUMABLE_EFFECTS } from './config.js';
import { DATA, maxLevel } from './data.js';
import { G } from './state.js';
import { shuffle, tokenise } from './util.js';
import { say, flyReward } from './feedback.js';
import { play as sfx } from './audio.js';

let onGrant = () => {};
let onFileHands = () => 0;
let onSkeleton = () => {};
/* main.js owns rendering AND the rules; it hands us callbacks so this module
   never has to import either tier (which would be a cycle). A consumable that
   moves items has to reach the rules, so it reaches them through here — and so
   does Skeleton Key, which is the one talent that acts on the world the moment
   it is learned rather than changing a rule that is read later. */
export function initTalents({ grant, fileHands, skeleton }) {
  onGrant = grant;
  onFileHands = fileHands;
  onSkeleton = skeleton || (() => {});
}

/* A ROOM IS FINISHED — is that worth a talent?

   Called from afterMutation's room-complete branch, which is already the one
   place that knows a room has just come clean and already fires exactly once
   per room (`G.roomFxDone` guards it). So this needs no guard of its own: it
   is called once per room per run, and it hands out a pick while the level has
   any left to give.

   `G.picksMax` is the level's authored `rewards`, plus the Reputation upgrade,
   clamped to rooms-1 — computed once at run start by main.js, because it
   depends on the home layer and this module must not import it. */
export function roomFinished() {
  if (G.picksTaken + G.pendingDrafts >= G.picksMax) return;
  G.pendingDrafts++;
  /* The ⭐ button appears the exact moment it means something. */
  setHidden(shopBtn, false);
}

/* How many picks this level still owes, for the HUD and the win screen. */
export const picksLeft = () => Math.max(0, G.picksMax - G.picksTaken);

/* Is now a safe moment to interrupt? */
export function drainDrafts(isBusy) {
  if (!G.active || G.pendingDrafts <= 0 || isBusy()) return false;
  /* A client mid-sentence is a modal in everything but the backdrop, and
     deliberately doesn't carry .overlay — so ask for them by name. A draft
     landing on top of someone talking is the exact interruption this whole
     deferral mechanism exists to prevent. */
  if (document.querySelector(".overlay.open") || isSpeaking()) return false;
  openDraft();
  return true;
}

/* ============================================================
   Building the three cards
============================================================ */
function pool() {
  const avail = DATA.upgrades.upgrades.filter(u => G.up[u.id] < maxLevel(u));
  /* Weight the unowned so early drafts feel varied rather than showing the
     same talent at successive levels. */
  const weighted = [];
  for (const u of avail) {
    const times = G.up[u.id] === 0 ? 3 : 1;
    for (let i = 0; i < times; i++) weighted.push(u);
  }
  const picked = [];
  const seen = new Set();
  shuffle(weighted);
  for (const u of weighted) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    picked.push(cardForUpgrade(u));
    if (picked.length >= DATA.upgrades.draftCards) break;
  }
  /* Fewer than three talents left? Back-fill with consumables that reuse
     code that already exists, rather than showing a degraded one-card grid. */
  if (picked.length < DATA.upgrades.draftCards) {
    for (const c of shuffle([...DATA.upgrades.consumables])) {
      if (picked.length >= DATA.upgrades.draftCards) break;
      picked.push({ ...c, kind: "consumable", sub: "One-off" });
    }
  }
  return picked;
}

function cardForUpgrade(u) {
  const lvl = G.up[u.id];
  const max = maxLevel(u);
  return {
    kind: "upgrade", id: u.id, name: u.name, icon: u.icon,
    desc: tokenise(u.desc, u.params || {}),
    sub: max > 1 ? `Level ${lvl + 1} of ${max}` : (lvl ? "Owned" : "New talent"),
    lvl, max,
  };
}

/* ============================================================
   The overlay
============================================================ */
export function openDraft() {
  const cards = pool();
  if (!cards.length) {
    /* Nothing left to choose — every talent maxed. Never open a modal with no
       decision in it; pay out in the currency that still means something and
       move on. `onGrant(null)` is what banks it, because ⭐ is a wallet in
       js/home.js now and this module deliberately cannot see it. */
    G.pendingDrafts--;
    G.picksTaken++;
    G.points += 3; G.starsEarned += 3;
    onGrant({ kind: "consumable", effect: "stars", amount: 3, icon: "⭐", name: "Lucky Find" });
    flyReward(shopBtn, "+3 ⭐");
    return;
  }

  const wrap = $("#draftOverlay");
  const grid = $("#draftCards");
  grid.innerHTML = "";
  /* "1 of 4" rather than a ⭐ count: the level decides how many of these you
     get now, so the useful number is how far through its offer you are. */
  $("#draftSub").textContent =
    `Talent ${G.picksTaken + 1} of ${G.picksMax} — pick one.`;

  /* Hides the always-on-top gear for the duration — see css/layout.css. */
  document.body.classList.add("drafting");

  for (const c of cards) {
    const card = el("button", "dcard");
    card.appendChild(el("div", "dicon", c.icon || "✨"));
    card.appendChild(el("div", "dname", c.name));
    card.appendChild(el("div", "dsub", c.sub));
    card.appendChild(el("div", "ddesc", c.desc));
    if (c.kind === "upgrade" && c.max > 1) {
      const pips = el("div", "dpips");
      for (let i = 0; i < c.max; i++) {
        const p = el("i");
        if (i <= c.lvl) p.classList.add("full");
        pips.appendChild(p);
      }
      card.appendChild(pips);
    }
    card.addEventListener("click", () => choose(c, card, grid));
    grid.appendChild(card);
  }
  wrap.classList.add("open");
}

function choose(c, cardEl, grid) {
  if (grid.dataset.done) return;
  grid.dataset.done = "1";

  /* The one choice the game insists on, and it was silent. */
  sfx("talent");
  for (const other of grid.children) {
    if (other === cardEl) other.classList.add("chosen");
    else other.classList.add("dismissed");
  }

  G.pendingDrafts--;
  G.picksTaken++;

  if (c.kind === "upgrade") {
    G.up[c.id] = (G.up[c.id] || 0) + 1;
    /* `hands` used to be handled here; it is a HOME upgrade now and is applied
       once at run start instead. Every talent left in this list is read where
       it is used, so there is nothing to do at grant time except two that fire
       immediately rather than changing a rule: */
    if (c.id === "skeleton") onSkeleton();
  } else {
    applyConsumable(c);
  }

  setTimeout(() => {
    $("#draftOverlay").classList.remove("open");
    document.body.classList.remove("drafting");
    grid.dataset.done = "";
    flyReward(cardEl, c.icon || "✨");
    say(c.name + " ✨", { priority: 2 });
    onGrant(c);
  }, 620);
}

/* EVERY case here must appear in CONSUMABLE_EFFECTS (js/config.js), and every
   name in that list must appear here. Boot validation checks the data against
   the list; this comment is the other half. Two consumables used to ship with
   an effect that fell straight through this switch — drafted, animated, named,
   and doing nothing at all. */
function applyConsumable(c) {
  switch (c.effect) {
    case "stars":     G.points += c.amount; G.starsEarned += c.amount; break;
    case "fileHands": onFileHands(); break;
    default:
      /* Unreachable if validation ran, which is exactly why it is worth saying
         out loud rather than shrugging. */
      console.error("[Tidy Adventures] consumable effect with no handler:", c.effect);
  }
}

/* ============================================================
   The ⭐ button: what you've learned, not a store
============================================================ */
export function renderTalents() {
  const list = $("#shopList");
  list.innerHTML = "";
  const owned = DATA.upgrades.upgrades.filter(u => G.up[u.id] > 0);

  const left = picksLeft();
  $("#shopPts").textContent = G.picksMax
    ? `${G.picksTaken} of ${G.picksMax} learned in this house` +
      (left ? ` — ${left} more to come.` : ".")
    : "This job doesn't teach you anything. Some of them don't.";

  for (const u of owned) {
    const max = maxLevel(u);
    const row = el("div", "shoprow");
    const info = el("div", "sinfo");
    const name = el("div", "sname");
    name.textContent = `${u.icon || ""} ${u.name}`;
    if (max > 1) {
      const lv = el("span", "slvl", ` lv ${G.up[u.id]}/${max}`);
      name.appendChild(lv);
    }
    info.appendChild(name);
    info.appendChild(el("div", "sdesc", tokenise(u.desc, u.params || {})));
    row.appendChild(info);
    list.appendChild(row);
  }

  /* Silhouettes for what's still out there — a reason to keep earning,
     without spoiling what it is. */
  const undiscovered = DATA.upgrades.upgrades.filter(u => G.up[u.id] === 0);
  if (undiscovered.length && G.picksMax) {
    const row = el("div", "shoprow ghostrow");
    const info = el("div", "sinfo");
    info.appendChild(el("div", "sname", "？".repeat(Math.min(3, undiscovered.length))));
    info.appendChild(el("div", "sdesc", left
      ? `${undiscovered.length} more out there. Finish a room to learn one.`
      : `${undiscovered.length} more out there — but not in this house.`));
    row.appendChild(info);
    list.appendChild(row);
  } else if (!owned.length) {
    list.appendChild(el("div", "sdesc", "Nothing learned yet."));
  }
}
