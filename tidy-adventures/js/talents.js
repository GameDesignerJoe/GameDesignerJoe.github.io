/* ============================================================
   TALENTS — a pick-one-of-three draft, replacing the shop.

   WHY THE SHOP WENT. A currency with four items in it, spent inside a
   four-minute level, whose button was visible from level 1-1 showing "⭐ 0"
   over an all-unaffordable list, is a fake economy. Mostly it taught players
   to ignore a HUD button. So the economy is replaced, not rebalanced:

     ⭐ is lifetime score and is never spent.
     Crossing a threshold in upgrades.json grants a draft.
     The draft is a forced single choice between three cards.
     The ⭐ button becomes "what you've learned", not a store.

   WHEN IT FIRES. On a threshold crossing, deferred to a safe moment — never
   mid-drag, never over an open container. Deferral is what makes it read as
   a celebration rather than an interruption of the flow state the game is
   actually good at. Deliberately NOT on level complete, where it would
   compete with the win screen.

   Imports: config, dom, data, state, util, feedback.
============================================================ */
import { $, el, setHidden, shopBtn } from './dom.js';
import { isSpeaking } from './client.js';
import { DATA, LOOKUP, costFor, maxLevel, upgradeParam } from './data.js';
import { G } from './state.js';
import { rnd, shuffle, tokenise } from './util.js';
import { say, flyReward } from './feedback.js';

let onGrant = () => {};
/* main.js owns rendering; it hands us a callback so this module never has to
   import the render tier (which would be a cycle). */
export function initTalents({ grant }) { onGrant = grant; }

const steps = () => DATA.upgrades.draftSteps;

/* How many drafts the player's lifetime ⭐ has earned in total. */
function draftsEarnedFor(stars) {
  return steps().filter(s => stars >= s).length;
}

/* Call after ⭐ changes. Queues a draft if a threshold was just crossed. */
export function checkDraftThreshold() {
  const earned = draftsEarnedFor(G.starsEarned);
  const owed = earned - G.draftsTaken - G.pendingDrafts;
  if (owed > 0) {
    G.pendingDrafts += owed;
    /* The shop button appears the exact moment it means something — no
       per-level "show upgrades" flag needed. */
    setHidden(shopBtn, false);
  }
}

export function nextThreshold() {
  const taken = G.draftsTaken;
  return steps()[taken] ?? null;
}

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
    /* Nothing left to choose. Never open a modal with no decision in it —
       just pay out and move on. */
    G.pendingDrafts--;
    G.draftsTaken++;
    G.points += 3; G.starsEarned += 3;
    flyReward(shopBtn, "+3 ⭐");
    onGrant(null);
    return;
  }

  const wrap = $("#draftOverlay");
  const grid = $("#draftCards");
  grid.innerHTML = "";
  $("#draftSub").textContent =
    `${G.points} ⭐ earned — pick one.`;

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

  for (const other of grid.children) {
    if (other === cardEl) other.classList.add("chosen");
    else other.classList.add("dismissed");
  }

  G.pendingDrafts--;
  G.draftsTaken++;

  if (c.kind === "upgrade") {
    G.up[c.id] = (G.up[c.id] || 0) + 1;
    if (c.id === "hands") G.inv.push(null);
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

function applyConsumable(c) {
  switch (c.effect) {
    case "stars":     G.points += c.amount; G.starsEarned += c.amount; break;
    case "freeWhirl": G.freeWhirls = (G.freeWhirls || 0) + 1; break;
    case "xray":      G.xrayUntil = Date.now() + (c.durationMs || 20000); break;
  }
}

/* ============================================================
   The ⭐ button: what you've learned, not a store
============================================================ */
export function renderTalents() {
  const list = $("#shopList");
  list.innerHTML = "";
  const owned = DATA.upgrades.upgrades.filter(u => G.up[u.id] > 0);

  $("#shopPts").textContent = owned.length
    ? `${G.points} ⭐ earned.`
    : `${G.points} ⭐ earned. Finish rows to earn more.`;

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
  if (undiscovered.length) {
    const row = el("div", "shoprow ghostrow");
    const info = el("div", "sinfo");
    info.appendChild(el("div", "sname", "？".repeat(Math.min(3, undiscovered.length))));
    const next = nextThreshold();
    info.appendChild(el("div", "sdesc",
      next != null
        ? `${undiscovered.length} more to learn. Next at ${next} ⭐.`
        : `${undiscovered.length} more to learn.`));
    row.appendChild(info);
    list.appendChild(row);
  } else if (!owned.length) {
    list.appendChild(el("div", "sdesc", "Nothing learned yet."));
  }
}
