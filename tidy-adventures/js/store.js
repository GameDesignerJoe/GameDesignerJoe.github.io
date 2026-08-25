/* ============================================================
   HOME — the wallet, the cast, and the shop you spend in.

   THE PROBLEM THIS EXISTS FOR: there was nothing past the room in front of
   you. A level handed out talents, the win screen took them away again
   (deliberately — see "talents do not survive a level"), and ⭐ was lifetime
   score that could not be spent on anything. Finishing a house was the whole
   reward for finishing a house.

   So ⭐ became money and this is where it goes. Two kinds of thing to buy:

     PERMANENT UPGRADES  (`home` in upgrades.json) — more hand slots, more
       talents per house, more ⭐ per room. Kept forever, applied at the start
       of every run.
     THE CAST            (`cost` in clients.json) — the campaign is NOT all
       there at the start. You get Mom and Marguerite; everybody else is a
       one-off purchase, priced by how far down the story they are.

   WHY IT IS ITS OWN MODULE: it owns three localStorage keys, a grid, and
   nothing else. main.js already holds four tiers in one file; this is the
   first thing in a while that could be lifted out cleanly, so it was.

   IT IS ALSO A LEAF ON PURPOSE. It never starts a level and never repaints a
   room — buying a client unlocks them, it does not play them, and the board
   does the playing. So this imports no render tier and nothing here can
   create a cycle. main.js reads homeLevel() / castHas() and applies them.

   Imports: config, dom, data, util, feedback, audio.
============================================================ */
import { STARS_KEY, HOME_KEY, CAST_KEY, HOME_IDS } from './config.js';
import { $, el } from './dom.js';
import { DATA, LOOKUP, maxLevel } from './data.js';
import { tokenise } from './util.js';
import { flyReward } from './feedback.js';
import { play as sfx } from './audio.js';

let onChange = () => {};
/* main.js repaints the title screen after a purchase (the Continue card and
   the board both read this state) and owns the "back to the title" transition.
   Handed in rather than imported, same shape as initTalents(). */
export function initHome({ change, back }) {
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
function readSet(k) {
  try { const a = JSON.parse(localStorage.getItem(k) || "[]"); return new Set(Array.isArray(a) ? a : []); }
  catch (e) { return new Set(); }
}

/* How many times a permanent upgrade has been bought. */
export const homeLevel = id => Math.max(0, Math.floor(readMap(HOME_KEY)[id] || 0));

/* Every home upgrade's level, for applying them all at run start. */
export const homeLevels = () =>
  Object.fromEntries(HOME_IDS.map(id => [id, homeLevel(id)]));

/* THE FREE TWO. A client with `cost: 0` needs no unlocking — that is how the
   campaign has an opening at all, and it is data rather than a hardcoded pair
   of ids so the prologue can be re-cast without touching this file. */
const freeCast = () => (DATA.clients?.clients || [])
  .filter(c => !(c.cost > 0)).map(c => c.id);

export function castUnlocked() {
  const s = readSet(CAST_KEY);
  for (const id of freeCast()) s.add(id);
  return s;
}
export const castHas = id => castUnlocked().has(id);

/* ============================================================
   PRICES

   Three multipliers, and the order matters only in that they compound:
     the client's own `cost`
     x REFERRED_OFF if you have met whoever refers them
     x the Business Cards discount

   THE REFERRAL DISCOUNT IS DOING REAL WORK. The chain is the only thing that
   makes eleven clients feel like one world — Mom hands you to Marguerite who
   hands you to Sam; a pizza box gets you the frat, who get you Unit 7, who
   give you as a reference to Dr. Ashworth; Zorb passes your name to Nettle;
   Boris takes your number off Captain's desk. In a shop where everything is
   buyable in any order, that chain has no teeth: nothing stops you starting
   with the gorilla.

   Gating on it was the other option and it was rejected — a shop that hides
   most of itself is a worse shop. So the chain PAYS instead of blocking:
   following it is cheaper, and a client bought cold gets a different opening
   line (`hookCold`) that does not mention somebody you have never met.
============================================================ */
const REFERRED_OFF = 0.6;

export function priceOf(client) {
  const base = client.cost || 0;
  if (!base) return 0;
  const referred = client.needs && castHas(client.needs);
  const cards = homeLevel("cards");
  const cardOff = Math.pow(0.8, cards);
  return Math.max(1, Math.round(base * (referred ? REFERRED_OFF : 1) * cardOff));
}

/* Has this client been referred to you by somebody you have actually worked
   for? Read by main.js to choose `hook` over `hookCold`. */
export const wasReferred = client => !!(client.needs && castHas(client.needs));

function upgradeCost(u) {
  const lvl = homeLevel(u.id);
  if (lvl >= maxLevel(u)) return null;                  /* maxed */
  return Array.isArray(u.cost) ? (u.cost[lvl] ?? u.cost[u.cost.length - 1]) : u.cost;
}

/* ============================================================
   BUYING
============================================================ */
function buyUpgrade(u) {
  const cost = upgradeCost(u);
  if (cost == null || !spend(cost)) return false;
  const m = readMap(HOME_KEY);
  m[u.id] = homeLevel(u.id) + 1;
  try { localStorage.setItem(HOME_KEY, JSON.stringify(m)); } catch (e) {}
  return true;
}

function buyClient(c) {
  if (castHas(c.id)) return false;
  if (!spend(priceOf(c))) return false;
  const s = readSet(CAST_KEY);
  s.add(c.id);
  try { localStorage.setItem(CAST_KEY, JSON.stringify([...s])); } catch (e) {}
  /* NEWLY HIRED GOES TO THE FRONT OF THE QUEUE. The board reads this to point
     `now` at their first job rather than at whatever was next by level order —
     you bought a person, so the game should hand you that person. Cleared the
     moment the board consumes it. */
  try { localStorage.setItem(CAST_KEY + ":new", c.id); } catch (e) {}
  return true;
}

/* PEEK AND CLEAR, not take-on-read.

   Two things went wrong with the obvious version. Consuming it inside
   progress() meant whichever of its four callers ran first ate the pointer, so
   the board — the one screen that needs it — pointed at whatever was next by
   level order. Consuming it when the board RENDERED meant the promise lasted
   one glance: close the board and reopen it and the person you had just paid
   for was no longer next.

   So it is cleared when it has been HONOURED — when that client's first job is
   finished — which is idempotent, so every progress() agrees and none of them
   has to be the one that spends it. */
export function peekNewHire() {
  try { return localStorage.getItem(CAST_KEY + ":new"); } catch (e) { return null; }
}
export function takeNewHire() {
  const id = peekNewHire();
  try { localStorage.removeItem(CAST_KEY + ":new"); } catch (e) {}
  return id;
}

/* ============================================================
   THE SHOP

   ONE GRID, TWO SECTIONS: the cast first, then the upgrades. The cast is
   first because it is the thing that changes what the game IS — a new person
   with three jobs and a voice — and the upgrades are numbers. A player with
   forty stars should be looking at a face.
============================================================ */
export function openHome() {
  render();
  $("#homeOverlay").classList.add("open");
}

function render() {
  const S = DATA.strings.home || {};
  const wallet = stars();
  $("#homeStars").textContent = wallet + " ⭐";
  $("#homeSub").textContent = tokenise(S.sub || "", {
    stars: wallet, ever: starsEarnedEver(),
  });

  /* ---------- the cast ---------- */
  const cast = $("#homeCast");
  cast.innerHTML = "";
  for (const arc of LOOKUP.arcs) {
    const c = arc.client;
    if (!(c.cost > 0)) continue;                  /* the free two aren't for sale */
    const owned = castHas(c.id);
    const price = priceOf(c);
    const b = el("button", "htile" + (owned ? " owned" : price <= wallet ? " afford" : " dear"));
    b.disabled = owned || price > wallet;
    /* THE FACE IS SHOWN EVEN WHEN LOCKED, which is the opposite of the job
       board's rule. On the board a client you cannot have yet is a silhouette,
       because the tease is meeting them. Here the face IS the price tag: you
       are being asked to want somebody specific, and "??? — 90 ⭐" is not an
       offer. What stays hidden is their arc; the tile says how many jobs, not
       what happens in them. */
    b.appendChild(el("span", "hface", c.emoji));
    b.appendChild(el("span", "hname", c.name));
    b.appendChild(el("span", "hjobs", arc.stages.length + (arc.stages.length === 1 ? " job" : " jobs")));
    if (owned) {
      b.appendChild(el("span", "hprice done", "✅ hired"));
    } else {
      const p = el("span", "hprice", price + " ⭐");
      if (wasReferred(c)) p.appendChild(el("em", "href", "referred"));
      b.appendChild(p);
    }
    if (!owned && price <= wallet) {
      b.addEventListener("click", () => {
        if (!buyClient(c)) return;
        sfx("talent");
        flyReward($("#homeStars"), "−" + price + " ⭐", $("#homeStars"));
        render();
        onChange();
      });
    }
    cast.appendChild(b);
  }

  /* ---------- the upgrades ---------- */
  const list = $("#homeUpgrades");
  list.innerHTML = "";
  for (const u of DATA.upgrades.home || []) {
    const lvl = homeLevel(u.id), max = maxLevel(u);
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
        flyReward(btn, "−" + cost + " ⭐", $("#homeStars"));
        render();
        onChange();
      });
    }
    row.appendChild(btn);
    list.appendChild(row);
  }
}

/* ---------- wiring ---------- */
$("#homeClose").addEventListener("click", () => {
  $("#homeOverlay").classList.remove("open");
  goBack();
});

/* Debug: wipe the meta layer. The parallel of "Relock all jobs" for the
   campaign — a 200-⭐ shop cannot be tested from a fresh save every time. */
export function clearHome() {
  for (const k of [STARS_KEY, STARS_KEY + ":ever", HOME_KEY, CAST_KEY, CAST_KEY + ":new"]) {
    try { localStorage.removeItem(k); } catch (e) {}
  }
  onChange();
}

/* Debug: give yourself money. */
export function grantStars(n) { return addStars(n); }

/* Debug: hire the whole cast, free. The shop's cast half cannot otherwise be
   tested past the first two or three purchases without playing the campaign
   that the purchases exist to open. Does NOT touch the wallet — "can I afford
   them" and "what does the board look like with everybody" are two different
   questions and conflating them costs you the ability to ask either. */
export function hireAll() {
  const all = (DATA.clients?.clients || []).map(c => c.id);
  try { localStorage.setItem(CAST_KEY, JSON.stringify(all)); } catch (e) {}
  onChange();
  return all.length;
}

/* Debug: every permanent upgrade at max, free. */
export function maxHome() {
  const m = {};
  for (const u of DATA.upgrades?.home || []) m[u.id] = maxLevel(u);
  try { localStorage.setItem(HOME_KEY, JSON.stringify(m)); } catch (e) {}
  onChange();
  return m;
}

/* What the gear prints. One call so the readout cannot drift from the state. */
export function homeSummary() {
  const bought = (DATA.upgrades?.home || [])
    .filter(u => homeLevel(u.id) > 0)
    .map(u => u.id + " " + homeLevel(u.id) + "/" + maxLevel(u));
  const hired = [...castUnlocked()].length;
  const total = (DATA.clients?.clients || []).length;
  return { stars: stars(), hired, total, bought };
}

export const homeState = () => ({
  stars: stars(), ever: starsEarnedEver(),
  upgrades: homeLevels(), cast: [...castUnlocked()],
});
