/* ============================================================
   VALIDATE — catch bad data edits at boot, with a message that says
   which file, what's wrong, and why it matters.

   The point of this module: data/*.json is meant to be hand-edited. A typo
   there must never turn into a silent gameplay bug discovered 400 items into
   a run. Errors stop boot behind an on-screen panel (readable on a phone,
   where there is no console). Warnings log and carry on.

   Imports: none. This is a leaf.
============================================================ */
import { MAX_ROOMS } from './config.js';
import { tokensIn } from './util.js';

export class DataError extends Error {}

/* ---------- helpers ---------- */
const at = (file, msg, why) => `data/${file} — ${msg}${why ? "\n    " + why : ""}`;

/* Class selectors actually present in the loaded stylesheets. Used to catch
   the "renamed .k-steel in CSS but not in JSON" drift that pure data-vs-data
   checking can't see. */
function declaredClasses() {
  const out = new Set();
  let scanned = 0;
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }   // cross-origin sheet
    if (!rules) continue;
    for (const r of rules) {
      if (!r.selectorText) continue;
      scanned++;
      for (const m of r.selectorText.matchAll(/\.([A-Za-z0-9_-]+)/g)) out.add(m[1]);
    }
  }
  return { classes: out, scanned };
}

/* ============================================================
   The checks
============================================================ */
export function validateData(D) {
  const errors = [];
  const warnings = [];
  const { classes, scanned } = declaredClasses();
  const cssKnown = scanned > 0;
  if (!cssKnown) {
    warnings.push("Stylesheets could not be read, so CSS-class checks were skipped.");
  }

  /* ---------- rooms.json: shape ---------- */
  if (!Array.isArray(D.rooms?.rooms) || !D.rooms.rooms.length) {
    errors.push(at("rooms.json", "no `rooms` array.", "The game has nowhere to put anything."));
    return { errors, warnings };   // nothing else can be checked
  }
  const rooms = D.rooms.rooms;
  const kinds  = D.furniture?.kinds  || {};
  const floors = new Set(D.furniture?.floors || []);
  const anchorCount = Math.min(
    (D.furniture?.anchors?.rect || []).length,
    (D.furniture?.anchors?.soft || []).length
  );

  /* ---------- 1. an emoji has exactly one home ---------- */
  const claims = new Map();
  for (const room of rooms) {
    for (const c of room.containers || []) {
      for (const e of c.types || []) {
        if (!claims.has(e)) claims.set(e, []);
        claims.get(e).push(`${room.id}/${c.id}`);
      }
    }
  }
  for (const [emoji, owners] of claims) {
    if (owners.length > 1) {
      errors.push(at("rooms.json",
        `emoji "${emoji}" is claimed by ${owners.length} containers: ${owners.join(", ")}.`,
        "Every emoji must have exactly one home, or items can never all be filed and the run becomes unwinnable."));
    }
  }

  /* ---------- 2. tokens are not sortable ---------- */
  for (const [id, tok] of Object.entries(D.furniture?.tokens || {})) {
    if (claims.has(tok.emoji)) {
      errors.push(at("rooms.json",
        `"${tok.emoji}" is the ${id} token but is also listed as a sortable type in ${claims.get(tok.emoji).join(", ")}.`,
        "Keys and coins are tools. Remove it from that container's types."));
    }
  }

  /* ---------- 3. every emoji has a name ---------- */
  const names = D.names?.names || {};
  const unnamed = [...claims.keys()].filter(e => !names[e]);
  if (unnamed.length) {
    errors.push(at("names.json",
      `${unnamed.length} emoji used in rooms.json have no name: ${unnamed.join(" ")}`,
      "They would show a blank label in the loupe and hand bar."));
  }
  const usedNames = new Set([...claims.keys(), ...Object.values(D.furniture?.tokens || {}).map(t => t.emoji)]);
  const orphanNames = Object.keys(names).filter(e => !usedNames.has(e));
  if (orphanNames.length) {
    warnings.push(at("names.json", `${orphanNames.length} names are unused: ${orphanNames.join(" ")}`));
  }

  /* ---------- 4. kinds and floors resolve, in data AND in CSS ---------- */
  for (const room of rooms) {
    if (!floors.has(room.floor)) {
      errors.push(at("rooms.json",
        `room "${room.id}" declares floor "${room.floor}", which is not in furniture.json floors.`,
        `Known floors: ${[...floors].join(", ")}`));
    } else if (cssKnown && !classes.has("floor-" + room.floor)) {
      errors.push(at("rooms.json",
        `room "${room.id}" declares floor "${room.floor}", but css/room.css has no rule for ".floor-${room.floor}".`,
        "The room would render with no floor pattern."));
    }
    for (const c of room.containers || []) {
      if (!kinds[c.kind]) {
        errors.push(at("rooms.json",
          `container "${room.id}/${c.id}" declares kind "${c.kind}", which is not in furniture.json kinds.`,
          `Known kinds: ${Object.keys(kinds).join(", ")}`));
      } else if (cssKnown && !classes.has("k-" + c.kind)) {
        errors.push(at("rooms.json",
          `container "${room.id}/${c.id}" declares kind "${c.kind}", but css/furniture.css has no rule for ".k-${c.kind}".`,
          "The furniture would render untextured."));
      }
      if (!c.types?.length) {
        errors.push(at("rooms.json", `container "${room.id}/${c.id}" has no types.`,
          "An empty container can never be completed."));
      }
    }
    /* ---------- 5. containers fit the anchors ---------- */
    const n = (room.containers || []).length;
    if (anchorCount && n > anchorCount) {
      errors.push(at("rooms.json",
        `room "${room.id}" has ${n} containers but furniture.json only defines ${anchorCount} anchors.`,
        "Containers past the last anchor would stack on top of the first one."));
    }
  }

  /* ---------- 6. themes point at real rooms ---------- */
  const roomIds = new Set(rooms.map(r => r.id));
  const themes = D.themes?.themes || {};
  for (const [tid, t] of Object.entries(themes)) {
    for (const rid of t.rooms || []) {
      if (!roomIds.has(rid)) {
        errors.push(at("themes.json", `theme "${tid}" lists room "${rid}", which is not in rooms.json.`));
      }
    }
  }

  /* ---------- 7. run configs are satisfiable ---------- */
  const typesPerRoom = tid => (themes[tid]?.rooms || [])
    .map(rid => rooms.find(r => r.id === rid))
    .filter(Boolean)
    .map(r => (r.containers || []).reduce((m, c) => m + c.types.length, 0));

  const typesInTheme = tid => typesPerRoom(tid).reduce((a, b) => a + b, 0);

  /* generate() takes the largest rooms first when a quota is set, so the
     achievable ceiling for n rooms is the n LARGEST — anything above that is
     genuinely impossible and the run would silently come up short. */
  const bestCaseTypes = (tid, n) =>
    typesPerRoom(tid).sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);

  const checkCfg = (file, cfg, label) => {
    const theme = cfg.theme || D.themes?.defaultTheme || "house";
    if (!themes[theme]) {
      errors.push(at(file, `"${label}" uses theme "${theme}", which is not in themes.json.`));
      return;
    }
    if (cfg.rooms > MAX_ROOMS) {
      errors.push(at(file, `"${label}" asks for ${cfg.rooms} rooms; the layout grid holds ${MAX_ROOMS}.`));
    }
    if (cfg.rooms > (themes[theme].rooms || []).length) {
      errors.push(at(file,
        `"${label}" asks for ${cfg.rooms} rooms but theme "${theme}" only defines ${themes[theme].rooms.length}.`,
        "Add more rooms to the theme, or lower the count."));
    }
    if (cfg.targetTypes && cfg.targetTypes > typesInTheme(theme)) {
      errors.push(at(file,
        `"${label}" asks for ${cfg.targetTypes} types but theme "${theme}" only has ${typesInTheme(theme)}.`,
        "The generator would silently under-deliver."));
    } else if (cfg.targetTypes && cfg.rooms) {
      const best = bestCaseTypes(theme, cfg.rooms);
      if (cfg.targetTypes > best) {
        errors.push(at(file,
          `"${label}" asks for ${cfg.targetTypes} types from ${cfg.rooms} rooms, but the ` +
          `${cfg.rooms} largest rooms in theme "${theme}" only hold ${best} between them.`,
          `The run would silently produce fewer items than the menu promises. ` +
          `Lower targetTypes to ${best}, or raise rooms.`));
      }
    }
    if (cfg.doorLocks > 0 && !(cfg.doorKeys > 0)) {
      errors.push(at(file, `"${label}" has doorLocks but doorKeys is 0.`,
        "The door could never be opened."));
    }
    if (cfg.contLocks > 0 && !(cfg.contKeys > 0)) {
      errors.push(at(file, `"${label}" has contLocks but contKeys is 0.`,
        "The container could never be opened."));
    }
    if (cfg.doorLocks > 0 && cfg.rooms < 2) {
      warnings.push(at(file, `"${label}" has a door lock but only ${cfg.rooms} room — it will be ignored.`));
    }
    if (!(cfg.rowLen > 0)) {
      errors.push(at(file, `"${label}" has rowLen ${cfg.rowLen}; it must be at least 1.`));
    }
  };

  for (const s of D.sizes?.sizes || []) checkCfg("sizes.json", s, s.id);
  for (const l of D.levels?.levels || []) checkCfg("levels.json", l, l.id);

  /* ---------- 8. tips are well formed ---------- */
  const TARGETS = new Set(["item","furn","door","lock","open","zoom","pan","shop","lastEl"]);
  const TIP_TEXT_TOKENS = new Set(["container","room","item","handSlots","rowLen"]);
  for (const l of D.levels?.levels || []) {
    const seen = new Set();
    for (const t of l.tips || []) {
      if (!t.kind) {
        errors.push(at("levels.json", `level ${l.id} has a tip with no kind.`));
        continue;
      }
      if (seen.has(t.kind)) {
        errors.push(at("levels.json", `level ${l.id} has two tips with kind "${t.kind}".`,
          "Kinds are the save key, so the second would be treated as already learned."));
      }
      seen.add(t.kind);
      const target = t.target || t.kind;
      if (!TARGETS.has(target)) {
        errors.push(at("levels.json",
          `level ${l.id} tip "${t.kind}" has target "${target}", which nothing can anchor to.`,
          `Valid targets: ${[...TARGETS].join(", ")}`));
      }
      for (const tok of tokensIn(t.text || "")) {
        if (!TIP_TEXT_TOKENS.has(tok)) {
          errors.push(at("levels.json",
            `level ${l.id} tip "${t.kind}" uses {${tok}}, which is never filled in.`,
            `Available: ${[...TIP_TEXT_TOKENS].map(s => "{" + s + "}").join(" ")}`));
        }
      }
    }
  }

  /* ---------- 9. upgrades ---------- */
  for (const u of D.upgrades?.upgrades || []) {
    if (!Array.isArray(u.costs) || !u.costs.length) {
      errors.push(at("upgrades.json", `"${u.id}" has no costs array.`,
        "The array length is the max level, so an empty one means the talent can never be taken."));
    } else if (u.costs.some(c => !(Number.isFinite(c) && c > 0))) {
      errors.push(at("upgrades.json", `"${u.id}" has a cost that is not a positive number: [${u.costs}]`));
    }
    for (const tok of tokensIn(u.desc || "")) {
      if (!(u.params && tok in u.params)) {
        errors.push(at("upgrades.json",
          `"${u.id}" description uses {${tok}} but params has no "${tok}".`,
          "The raw token would be shown to the player."));
      }
    }
  }
  const steps = D.upgrades?.draftSteps;
  if (!Array.isArray(steps) || !steps.length) {
    errors.push(at("upgrades.json", "draftSteps must be a non-empty array of ⭐ thresholds."));
  } else if (steps.some((v, i) => i && v <= steps[i - 1])) {
    errors.push(at("upgrades.json", `draftSteps must increase: [${steps}]`));
  }

  return { errors, warnings };
}

/* ============================================================
   Boot error panel — deliberately not an .overlay, so it shows even
   if the stylesheets are what's broken.
============================================================ */
export function showBootError(errors) {
  const wrap = document.createElement("div");
  wrap.id = "bootError";
  wrap.setAttribute("style", [
    "position:fixed", "inset:0", "z-index:9999", "overflow:auto",
    "background:#211a12", "color:#f3e9d8", "padding:28px 22px",
    "font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
  ].join(";"));

  const h = document.createElement("h1");
  h.textContent = "Tidy Adventures can't start";
  h.setAttribute("style", "font-size:20px;margin-bottom:6px;color:#f5c542");
  wrap.appendChild(h);

  const sub = document.createElement("p");
  sub.textContent = `${errors.length} problem${errors.length === 1 ? "" : "s"} in the data files. Fix and reload.`;
  sub.setAttribute("style", "color:#b9a88d;margin-bottom:18px");
  wrap.appendChild(sub);

  for (const e of errors) {
    const pre = document.createElement("pre");
    pre.textContent = e;
    pre.setAttribute("style", [
      "white-space:pre-wrap", "word-break:break-word",
      "background:#2c2317", "border-left:3px solid #f5c542",
      "padding:10px 12px", "border-radius:6px", "margin-bottom:10px",
    ].join(";"));
    wrap.appendChild(pre);
  }
  document.body.appendChild(wrap);
}
