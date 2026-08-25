/* ============================================================
   HOME — the wallet and the shop you spend it in.

   THE PROBLEM THIS EXISTS FOR: there was nothing past the room in front of
   you. A level handed out talents, the win screen took them away again
   (deliberately — see "talents do not survive a level"), and ⭐ was lifetime
   score that could not be spent on anything. Finishing a house was the whole
   reward for finishing a house.

   So ⭐ became money and this is where it goes. ONE kind of thing to buy:
   PERMANENT UPGRADES (`home` in upgrades.json) — kept forever, applied at the
   start of every run.

   THE CAST USED TO BE SOLD HERE AND IS NOT ANY MORE. Nine of the eleven
   clients were one-off purchases priced by narrative distance, and it was the
   wrong shape: it made ⭐ buy both POWER and CONTENT out of one wallet, and
   content always wins that fight. You were spending a performance currency for
   permission to play levels that already existed, so every star spent on an
   upgrade read as a deliberately delayed campaign — and the player who
   correctly bought all the content first arrived at a shop with nothing left
   to want. The campaign is linear again; `cost: 0` on every client is what
   says so. Do not put them back without solving that.

   WHY IT IS ITS OWN MODULE: it owns three localStorage keys, a grid, and
   nothing else. main.js already holds four tiers in one file; this is the
   first thing in a while that could be lifted out cleanly, so it was.

   IT IS ALSO A LEAF ON PURPOSE. It never starts a level and never repaints a
   room. So this imports no render tier and nothing here can create a cycle.
   main.js reads storeLevel() and applies it.

   Imports: config, dom, data, util, feedback, audio.
============================================================ */
import { STARS_KEY, STORE_KEY, CAST_KEY, STORE_IDS } from './config.js';
/* CAST_KEY is imported for one reason: clearStore() still purges it, so a save
   made while the cast was for sale does not keep a stale set forever. */
import { $, el } from './dom.js';
import { DATA, maxLevel } from './data.js';
import { tokenise } from './util.js';
import { flyReward } from './feedback.js';
import { play as sfx } from './audio.js';

let onChange = () => {};
/* main.js repaints the title screen after a purchase (the Continue card and
   the board both read this state) and owns the "back to the title" transition.
   Handed in rather than imported, same shape as initTalents(). */
export function initStore({ change, back }) {
  onChange = change || (() => {});
  goBack = back || (() => {});
}
let goBack = () => {};

/* ============================================================
   THE WALLET

   A BALANCE, not a total. `stars` goes down when you spend, which is the
   reversal this whole feature turns on — the old model was lifetime score and
   upgrades.json had its price list deleted on the grounds that nothing would
   ever read it.

   `earned` is kept alongside, never spent, purely so the shop can say "you
   have earned N in total" without that number being the one you shop with.
   Two numbers because one of them has to be able to go down and the other
   must not: a lifetime total that decreases is not a lifetime total.
============================================================ */
const readNum = (k, d = 0) => {
  try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; }
  catch (e) { return d; }
};
const write = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };

export const stars = () => Math.max(0, Math.floor(readNum(STARS_KEY)));
export const starsEarnedEver = () => Math.max(0, Math.floor(readNum(STARS_KEY + ":ever")));

/* Bank stars as they are earned rather than at the win screen, so quitting
   half way through a house keeps what you did. The alternative punishes the
   player for a phone call. */
export function addStars(n) {
  if (!(n > 0)) return stars();
  write(STARS_KEY, stars() + n);
  write(STARS_KEY + ":ever", starsEarnedEver() + n);
  onChange();
  return stars();
}

function spend(n) {
  if (n > stars()) return false;
  write(STARS_KEY, stars() - n);
  return true;
}

/* ============================================================
   WHAT YOU OWN
============================================================ */
function readMap(k) {
  try { const o = JSON.parse(localStorage.getItem(k) || "{}"); return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
/* How many times a permanent upgrade has been bought. */
export const storeLevel = id => Math.max(0, Math.floor(readMap(STORE_KEY)[id] || 0));

/* Every home upgrade's level, for applying them all at run start. */
export const storeLevels = () =>
  Object.fromEntries(STORE_IDS.map(id => [id, storeLevel(id)]));

/* ============================================================
   PRICES

   One number now. The referral chain used to set a 40% discount here, which
   was the only teeth it had; with the cast free the chain is just the story
   again, which is what it was always better at.
============================================================ */
function upgradeCost(u) {
  const lvl = storeLevel(u.id);
  if (lvl >= maxLevel(u)) return null;                  /* maxed */
  return Array.isArray(u.cost) ? (u.cost[lvl] ?? u.cost[u.cost.length - 1]) : u.cost;
}

/* ============================================================
   BUYING
============================================================ */
/* WHAT YOU HAVE SUNK INTO THE STORE — every level of everything, at what it
   cost when you bought it. */
export function spentTotal() {
  let n = 0;
  for (const u of DATA.upgrades.store || []) {
    const lvl = storeLevel(u.id);
    for (let i = 0; i < lvl; i++) {
      n += Array.isArray(u.cost) ? (u.cost[i] ?? u.cost[u.cost.length - 1]) : (u.cost || 0);
    }
  }
  return n;
}

/* TAKE IT ALL BACK, FREE.

   A campaign pays its ⭐ ONCE — a finished level is worth nothing on replay —
   so a lifetime budget is a fixed number and there is no way to earn your way
   out of a purchase you regret. The old notes said "replaying campaign levels
   is the way out of a corner"; that is gone, and without a refund a wrong buy
   would be permanent in a game with no fail state anywhere else in it.

   Free, and deliberately not a "respec cost": charging for it just means the
   corner is smaller, not that it is escapable, and this game does not need
   punishment in its menus.

   `starsEarnedEver` MUST NOT MOVE. The refund writes the balance directly
   instead of going through addStars(), because a lifetime total that grows when
   you undo something is not a lifetime total — the same reason the two numbers
   are separate at all. */
export function respec() {
  const back = spentTotal();
  if (!back) return 0;
  write(STARS_KEY, stars() + back);
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  onChange();
  return back;
}

function buyUpgrade(u) {
  const cost = upgradeCost(u);
  if (cost == null || !spend(cost)) return false;
  const m = readMap(STORE_KEY);
  m[u.id] = storeLevel(u.id) + 1;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(m)); } catch (e) {}
  return true;
}

/* ============================================================
   THE SHOP

   ONE LIST now. It used to be two sections — the cast first, then the
   upgrades, on the grounds that a player with forty stars should be looking at
   a face. The faces are not for sale any more, so what is left is the numbers,
   and they are honest about being numbers.
============================================================ */
/* WHERE BACK GOES, per opening. The store used to have exactly one door — the
   title screen — so "Back" could always mean "the title screen" and did. There
   is a second door now, on the win screen, and from there the title is the
   wrong answer: it throws away the next-job card the player was looking at,
   which is the whole reason the win screen exists.

   So an opener may say where Back goes. One-shot, cleared on use, defaulting to
   whatever initStore() was given — a stale override is worse than none, because
   it would send the NEXT visit somewhere the player did not come from. */
let backOnce = null;
export function openStore(onBack = null) {
  backOnce = onBack;
  render();
  $("#storeOverlay").classList.add("open");
}

function render() {
  const S = DATA.strings.store || {};
  const wallet = stars();
  $("#storeStars").textContent = wallet + " ⭐";
  $("#storeSub").textContent = tokenise(S.sub || "", {
    stars: wallet, ever: starsEarnedEver(),
  });

  /* ---------- the upgrades ---------- */
  const list = $("#storeUpgrades");
  list.innerHTML = "";
  for (const u of DATA.upgrades.store || []) {
    const lvl = storeLevel(u.id), max = maxLevel(u);
    const cost = upgradeCost(u);
    const row = el("div", "shoprow" + (cost == null ? " maxed" : ""));
    const info = el("div", "sinfo");
    const name = el("div", "sname");
    name.textContent = `${u.icon || ""} ${u.name}`;
    if (max > 1) name.appendChild(el("span", "slvl", ` lv ${lvl}/${max}`));
    info.appendChild(name);
    info.appendChild(el("div", "sdesc", tokenise(u.desc, u.params || {})));
    row.appendChild(info);
    const btn = el("button", null, cost == null ? "Maxed" : cost + " ⭐");
    btn.disabled = cost == null || cost > wallet;
    if (cost != null && cost <= wallet) {
      btn.addEventListener("click", () => {
        if (!buyUpgrade(u)) return;
        sfx("talent");
        flyReward(btn, "−" + cost + " ⭐", $("#storeStars"));
        render();
        onChange();
      });
    }
    row.appendChild(btn);
    list.appendChild(row);
  }

  /* THE WAY OUT OF A CORNER. Only rendered when there is something to give
     back, so a fresh save is not offered an undo for nothing. */
  const spent = spentTotal();
  if (spent) {
    const row = el("div", "shoprow refund");
    const info = el("div", "sinfo");
    info.appendChild(el("div", "sname", "↩️ Start over"));
    info.appendChild(el("div", "sdesc",
      "Hand everything back and get all " + spent + " ⭐ returned. Spend it differently."));
    row.appendChild(info);
    const btn = el("button", "ghost", "Refund");
    btn.addEventListener("click", () => {
      const back = respec();
      if (!back) return;
      sfx("talent");
      flyReward(btn, "+" + back + " ⭐", $("#storeStars"));
      render();
      onChange();
    });
    row.appendChild(btn);
    list.appendChild(row);
  }
}

/* ---------- wiring ---------- */
$("#storeClose").addEventListener("click", () => {
  $("#storeOverlay").classList.remove("open");
  const once = backOnce;
  backOnce = null;
  (once || goBack)();
});

/* Debug: wipe the meta layer. The parallel of "Relock all jobs" for the
   campaign — a 200-⭐ shop cannot be tested from a fresh save every time. */
export function clearStore() {
  for (const k of [STARS_KEY, STARS_KEY + ":ever", STORE_KEY, CAST_KEY, CAST_KEY + ":new"]) {
    try { localStorage.removeItem(k); } catch (e) {}
  }
  onChange();
}

/* Debug: give yourself money. */
export function grantStars(n) { return addStars(n); }

/* Debug: every permanent upgrade at max, free. */
export function maxStore() {
  const m = {};
  for (const u of DATA.upgrades?.store || []) m[u.id] = maxLevel(u);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(m)); } catch (e) {}
  onChange();
  return m;
}

/* What the gear prints. One call so the readout cannot drift from the state. */
export function storeSummary() {
  const bought = (DATA.upgrades?.store || [])
    .filter(u => storeLevel(u.id) > 0)
    .map(u => u.id + " " + storeLevel(u.id) + "/" + maxLevel(u));
  return { stars: stars(), bought };
}

export const storeState = () => ({
  stars: stars(), ever: starsEarnedEver(), upgrades: storeLevels(),
});
