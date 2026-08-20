/* ============================================================
   VALIDATE — catch bad data edits at boot, with a message that says
   which file, what's wrong, and why it matters.

   The point of this module: data/*.json is meant to be hand-edited. A typo
   there must never turn into a silent gameplay bug discovered 400 items into
   a run. Errors stop boot behind an on-screen panel (readable on a phone,
   where there is no console). Warnings log and carry on.

   Imports: none. This is a leaf.
============================================================ */
import { MAX_ROOMS, TALENT_IDS, CONSUMABLE_EFFECTS } from './config.js';
import { tokensIn, anchorPrefix, expectedItems } from './util.js';

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

  /* Every emoji anywhere in the file, and which containers list it. Used by
     the token and name checks below, which are genuinely global — a key must
     not be sortable in ANY room, and an emoji needs a name wherever it lives. */
  const claims = new Map();
  for (const room of rooms) {
    for (const c of room.containers || []) {
      for (const e of c.types || []) {
        if (!claims.has(e)) claims.set(e, []);
        claims.get(e).push(`${room.id}/${c.id}`);
      }
    }
  }

  /* ---------- 1. an emoji has exactly one home WITHIN A THEME ----------

     This used to be a single global check across the whole file, which was
     stricter than the actual rule and it blocked themed content: a run only
     ever draws rooms from ONE theme (generate.js takes its pool from
     themeRooms), so two homes only make a run unwinnable when both rooms can
     turn up together. Globally unique meant a space theme could not use 🪐 or
     🔭 because the house's Observatory had already spoken for them — the exact
     emoji it most wants. Per theme, both may claim them; they never share a
     run. Within one theme it is still an error, for the original reason. */
  const themeDefs = D.themes?.themes || {};
  const listedBy = new Map();                 // room id -> [theme ids]
  for (const [tid, t] of Object.entries(themeDefs)) {
    for (const rid of t.rooms || []) {
      if (!listedBy.has(rid)) listedBy.set(rid, []);
      listedBy.get(rid).push(tid);
    }
  }
  for (const [tid, t] of Object.entries(themeDefs)) {
    const inTheme = new Map();
    for (const rid of t.rooms || []) {
      const room = rooms.find(r => r.id === rid);
      if (!room) continue;                    /* check 6 names the bad id */
      for (const c of room.containers || []) {
        for (const e of c.types || []) {
          if (!inTheme.has(e)) inTheme.set(e, []);
          inTheme.get(e).push(`${room.id}/${c.id}`);
        }
      }
    }
    for (const [emoji, owners] of inTheme) {
      if (owners.length > 1) {
        errors.push(at("rooms.json",
          `emoji "${emoji}" is claimed by ${owners.length} containers in theme "${tid}": ${owners.join(", ")}.`,
          "Within one theme an emoji must have exactly one home, or a run that draws both rooms can never file it. " +
          "Two different themes may each claim the same emoji — they never share a run."));
      }
    }
  }
  /* A room nothing lists is dead content: it can never be drawn, and the
     per-theme check above never sees it either. */
  for (const room of rooms) {
    if (!listedBy.has(room.id)) {
      warnings.push(at("rooms.json",
        `room "${room.id}" is listed in no theme, so no run can ever draw it.`,
        "Add its id to a theme in themes.json, or delete the room."));
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

  /* ---------- 4. kinds, floors and shapes resolve, in data AND in CSS ---------- */
  const SHAPES = new Set(["rect", "round", "hex"]);
  for (const room of rooms) {
    if (room.shape && !SHAPES.has(room.shape)) {
      errors.push(at("rooms.json",
        `room "${room.id}" declares shape "${room.shape}".`,
        `Valid shapes: ${[...SHAPES].join(", ")}. inShape() in js/geometry.js would ` +
        `treat it as a rectangle while css/room.css drew nothing, so items would ` +
        `scatter outside the walls.`));
    }
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
  /* A room delivers only as many containers as it has clean anchors for, so its
     type count is its LARGEST few containers, not all of them — see check 7b.
     Costed on the worst shape the theme can deal it, matching generate(). */
  const anchorSize = D.furniture?.defaultSize || { w: 34, h: 16 };
  const anchorFit = set => anchorPrefix(D.furniture?.anchors?.[set] || [], anchorSize.w, anchorSize.h);
  const roomCap = (tid, r) => {
    const shape = r.shape || ((themes[tid]?.shapes || []).some(s => s !== "rect") ? "round" : "rect");
    return anchorFit(shape === "rect" ? "rect" : "soft");
  };
  const typesPerRoom = tid => (themes[tid]?.rooms || [])
    .map(rid => rooms.find(r => r.id === rid))
    .filter(Boolean)
    .map(r => (r.containers || []).map(c => c.types.length)
      .sort((a, b) => b - a).slice(0, roomCap(tid, r)).reduce((m, n) => m + n, 0));

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

  /* ---------- 7b. a room can only show as many containers as it has anchors ----
     generate() hands out anchors in list order, so the real ceiling is the
     non-overlapping PREFIX of the list — 6 for a rect room, 4 for a round or
     hex one, whose 5th and 6th soft slots share the middle column with the 1st
     and 2nd. That is not obvious from furniture.json, which reads as six of
     each: a level asking for five containers in the tower rendered two pieces
     of furniture a quarter on top of each other, and the only symptom was a
     screenshot. Free play is capped in generate() instead, because it takes
     however many containers its type quota needs rather than a stated number.

     A theme is judged on every shape it can DEAL, plus any shape its rooms pin
     for themselves — the house theme is rect-only and still contains a round
     Observatory and a hex Wine Cellar. */
  {
    const size = D.furniture?.defaultSize || { w: 34, h: 16 };
    const prefix = set => anchorPrefix(D.furniture?.anchors?.[set] || [], size.w, size.h);
    const capOf = tid => {
      const t = themes[tid] || {};
      const shapes = new Set(t.shapes || []);
      for (const rid of t.rooms || []) {
        const pinned = rooms.find(r => r.id === rid)?.shape;
        if (pinned) shapes.add(pinned);
      }
      const soft = shapes.has("round") || shapes.has("hex");
      return soft ? Math.min(prefix("rect"), prefix("soft")) : prefix("rect");
    };
    for (const l of D.levels?.levels || []) {
      const tid = l.theme || D.themes?.defaultTheme || "house";
      if (!themes[tid]) continue;                       // already reported above
      const cap = capOf(tid);
      if (l.cont > cap) {
        errors.push(at("levels.json",
          `"${l.id}" asks for ${l.cont} containers per room, but theme "${tid}" can only place ${cap} without furniture overlapping.`,
          `A round or hex room fits ${prefix("soft")}; a rect-only theme fits ${prefix("rect")}. ` +
          "Lower cont, or add non-overlapping anchors to data/furniture.json."));
      }
    }
  }

  /* ---------- 7c. the job-size bands are usable ----------
     A malformed band list does not crash anything; it silently mislabels every
     job on the board and the win screen, which is worse. */
  {
     const bands = D.strings?.jobSize?.bands;
     if (!Array.isArray(bands) || !bands.length) {
       warnings.push(at("strings.json", "no jobSize.bands, so no job will say how big it is.",
         "The next-job card and the board tiles just omit the label."));
     } else {
       bands.forEach((b, i) => {
         const last = i === bands.length - 1;
         if (!b.label) errors.push(at("strings.json", `jobSize band ${i + 1} has no label.`));
         if (last && b.upTo != null) {
           errors.push(at("strings.json", `the last jobSize band has upTo: ${b.upTo}, so the biggest jobs fall through it and get no label.`,
             "The last band is the catch-all and must omit upTo."));
         }
         if (!last && !(b.upTo > 0)) {
           errors.push(at("strings.json", `jobSize band "${b.label}" needs an upTo; only the last one may omit it.`));
         }
         if (!last && bands[i + 1].upTo != null && bands[i + 1].upTo <= b.upTo) {
           errors.push(at("strings.json", `jobSize bands are out of order: "${b.label}" ends at ${b.upTo} but "${bands[i + 1].label}" ends at ${bands[i + 1].upTo}.`,
             "They are matched in order, smallest first, so a later band that ends earlier can never be reached."));
         }
       });
     }
  }

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
      /* A level with no stars can never fire talentEarned, so a tip waiting on
         it waits forever — and the one tip that does is the ONLY thing in the
         game that explains the ⭐ button. Silent if unchecked: the level plays
         fine and the player is simply never told. */
      if (l.talents === false && (t.when === "talentEarned" || target === "shop")) {
        errors.push(at("levels.json",
          `level ${l.id} has "talents": false but its tip "${t.kind}" teaches talents.`,
          "That level hands out no stars, so the tip can never appear. Either give " +
          "the level talents, or move the tip to the first level that has them."));
      }
    }
  }
  /* ---------- 8b. talents, once on, stay on ---------- */
  {
    const ls = D.levels?.levels || [];
    for (const l of ls) {
      if ("talents" in l && typeof l.talents !== "boolean") {
        errors.push(at("levels.json",
          `level ${l.id} has "talents": ${JSON.stringify(l.talents)}, which is not true or false.`,
          "Omit it for the normal behaviour (stars on)."));
      }
    }
    const on = ls.findIndex(l => l.talents !== false);
    if (on === -1) {
      warnings.push(at("levels.json", "every level has \"talents\": false, so the talent draft is dead code.",
        "Some level has to be the one that introduces ⭐."));
    } else {
      const relapse = ls.slice(on).filter(l => l.talents === false).map(l => l.id);
      if (relapse.length) {
        warnings.push(at("levels.json",
          `${ls[on].id} turns talents on, but ${relapse.join(", ")} later turn them back off.`,
          "A reward the player has already been taught should not vanish again. " +
          "This is a warning, not an error, in case it is a deliberate quiet level."));
      }
    }
  }

  /* ---------- 9. upgrades ----------
     THE IMPORTANT CHECK HERE IS THE LAST ONE. A talent is half data and half
     code, and only the data half shows: a talent listed here with nothing
     reading its id gives you a draft card that animates, says its name, raises
     a level and does nothing at all. Two consumables shipped in exactly that
     state — Second Wind and X-Ray Eyes both set a field on the run that
     nothing ever read — and neither looked broken, because a talent that does
     nothing looks exactly like a talent you misunderstood. So the ids the code
     implements are declared in js/config.js and compared here, both ways. */
  const seenUp = new Set();
  for (const u of D.upgrades?.upgrades || []) {
    if (!u.id) { errors.push(at("upgrades.json", "an upgrade has no id.")); continue; }
    if (seenUp.has(u.id)) {
      errors.push(at("upgrades.json", `two upgrades share the id "${u.id}".`,
        "G.up is keyed by id, so the second would silently share the first's level."));
    }
    seenUp.add(u.id);
    if (!(Number.isInteger(u.levels) && u.levels > 0)) {
      errors.push(at("upgrades.json",
        `"${u.id}" has levels: ${JSON.stringify(u.levels)}, which is not a positive whole number.`,
        "levels is how many times the talent can be taken; 0 means it can never be taken."));
    }
    for (const tok of tokensIn(u.desc || "")) {
      if (!(u.params && tok in u.params)) {
        errors.push(at("upgrades.json",
          `"${u.id}" description uses {${tok}} but params has no "${tok}".`,
          "The raw token would be shown to the player."));
      }
    }
    if (!TALENT_IDS.includes(u.id)) {
      errors.push(at("upgrades.json",
        `talent "${u.id}" is not implemented — no code reads it.`,
        "Add it to TALENT_IDS in js/config.js and write the code that reads " +
        "G.up." + u.id + ", or remove it here. A talent with no code still " +
        "draws a card, plays the sound and raises a level; it just does nothing."));
    }
  }
  for (const id of TALENT_IDS) {
    if (!seenUp.has(id)) {
      errors.push(at("upgrades.json",
        `TALENT_IDS lists "${id}" but upgrades.json has no such talent.`,
        "The code reads G.up." + id + ", which will be undefined forever. " +
        "Either add the talent here or drop it from js/config.js."));
    }
  }
  const seenCon = new Set();
  for (const c of D.upgrades?.consumables || []) {
    if (seenCon.has(c.id)) {
      errors.push(at("upgrades.json", `two consumables share the id "${c.id}".`));
    }
    seenCon.add(c.id);
    if (!CONSUMABLE_EFFECTS.includes(c.effect)) {
      errors.push(at("upgrades.json",
        `consumable "${c.id}" has effect "${c.effect}", which nothing implements.`,
        `Known effects: ${CONSUMABLE_EFFECTS.join(", ")}. Add a case to ` +
        "applyConsumable() in js/talents.js and the name to CONSUMABLE_EFFECTS " +
        "in js/config.js, or the card is a reward that does nothing."));
    }
  }
  /* The draft back-fills with consumables when the talent pool runs dry, so
     there has to be enough of both to fill a grid. */
  const cards = D.upgrades?.draftCards ?? 3;
  const supply = (D.upgrades?.upgrades || []).length + (D.upgrades?.consumables || []).length;
  if (supply < cards) {
    warnings.push(at("upgrades.json",
      `${supply} things to offer but draftCards is ${cards}, so a draft can never fill its grid.`,
      "Add a talent or a consumable, or lower draftCards."));
  }
  const steps = D.upgrades?.draftSteps;
  if (!Array.isArray(steps) || !steps.length) {
    errors.push(at("upgrades.json", "draftSteps must be a non-empty array of ⭐ thresholds."));
  } else if (steps.some((v, i) => i && v <= steps[i - 1])) {
    errors.push(at("upgrades.json", `draftSteps must increase: [${steps}]`));
  }

  /* ---------- 10. clients.json: every level is exactly one client's job ----------
     Same shape of rule as "every emoji has exactly one home", and for the same
     reason: a level claimed twice appears twice on the board and its note
     arrives in two voices, and a level claimed by nobody opens with no one
     there and can never be found.
     This builds its OWN index of level ids — buildLookups() runs after this
     function, so LOOKUP is still empty here. */
  const levels = D.levels?.levels || [];
  const CLIENT_TEXT_TOKENS = new Set(["handSlots", "rowLen", "name", "level"]);
  const CLIENT_NOTE_TOKENS = new Set(["container", "room", "handSlots", "rowLen", "name"]);

  /* Level ids must be unique before anything can be claimed by one: the id ->
     index map is a plain object, so a duplicate silently drops one of them. */
  const seenLevel = new Map();
  levels.forEach((lv, i) => {
    if (seenLevel.has(lv.id)) {
      errors.push(at("levels.json",
        `two levels share the id "${lv.id}" (indexes ${seenLevel.get(lv.id)} and ${i}).`,
        "The id is how clients.json claims a level and how the win screen names it, so the second copy could never be hired for."));
    } else seenLevel.set(lv.id, i);
  });

  const clients = D.clients?.clients;
  if (!Array.isArray(clients) || !clients.length) {
    errors.push(at("clients.json", "no `clients` array.",
      "Nobody hires you: the job board would be empty and the campaign unreachable."));
  } else if (levels.length) {
    const claims = new Map();      // level id -> ["clientId#stageNo", ...]
    const seenClient = new Set();

    for (const c of clients) {
      if (seenClient.has(c.id)) {
        errors.push(at("clients.json", `two clients share the id "${c.id}".`,
          "The id is how a job is looked up; the second client would be unreachable."));
      }
      seenClient.add(c.id);

      if (!c.emoji) {
        errors.push(at("clients.json", `client "${c.id}" has no emoji.`,
          "The job board row, the character who walks in and the win screen are all drawn from it."));
      }

      /* Their own theme tune, if they have one. A typo here would otherwise
         fall back to the default track silently, and "why is this client
         playing the wrong music" is a miserable thing to chase. */
      if (c.music && !(D.audio?.music || {})[c.music]) {
        errors.push(at("clients.json", `client "${c.id}" asks for music "${c.music}", which is not in audio.json.`,
          `Known tracks: ${Object.keys(D.audio?.music || {}).join(", ") || "(none)"}`));
      }

      const stages = c.stages || [];
      if (!stages.length) {
        if (!c.soon) {
          errors.push(at("clients.json", `client "${c.id}" has no stages.`,
            'A client with no jobs and no promise of one can never appear. Give them stages, or "soon": true to show them as a silhouette.'));
        }
        continue;
      }

      let prev = -1;
      stages.forEach((s, n) => {
        const where = `client "${c.id}" stage ${n + 1}`;
        const idx = seenLevel.get(s.level);
        if (idx === undefined) {
          errors.push(at("clients.json", `${where} claims level "${s.level}", which is not in levels.json.`,
            `Known level ids: ${levels.map(l => l.id).join(", ")}`));
          return;
        }
        if (!claims.has(s.level)) claims.set(s.level, []);
        claims.get(s.level).push(`${c.id}#${n + 1}`);

        if (idx < prev) {
          errors.push(at("clients.json",
            `${where} ("${s.level}") comes before the stage above it in levels.json.`,
            "Stages are listed in play order. Out of order, the pips fill in backwards and the story arrives out of sequence."));
        }
        prev = idx;

        if (!s.intro?.length) {
          errors.push(at("clients.json", `${where} ("${s.level}") has no intro lines.`,
            "The client turns up at the start of the job with nothing to say."));
        }
        if (!s.outro?.length) {
          errors.push(at("clients.json", `${where} ("${s.level}") has no outro lines.`,
            "The whole point of a client is that they come back and thank you."));
        }
        /* hook and teaser are the two lines on the win screen's next-job card.
           teaser was validated here for a long time while NOTHING rendered it —
           the only reader asked for a client-level field that does not exist —
           so it was thirty-four authored lines the player never saw. Both are
           shown now, and a stage missing its hook falls back to the level blurb
           rather than leaving a gap. */
        if (!s.hook) {
          warnings.push(at("clients.json",
            `${where} ("${s.level}") has no \`hook\`, so the next-job card falls back to the level blurb.`,
            "The hook is the line that carries the through-line — how this client found you, or why they are calling again."));
        }
        for (const line of [...(s.intro || []), ...(s.outro || []), s.teaser || "", s.replay || "", s.hook || ""]) {
          for (const tok of tokensIn(line)) {
            if (!CLIENT_TEXT_TOKENS.has(tok)) {
              errors.push(at("clients.json", `${where} uses {${tok}}, which is never filled in.`,
                `Available here: ${[...CLIENT_TEXT_TOKENS].map(t => "{" + t + "}").join(" ")} ` +
                "— {container} and {room} exist only in note copy, where a room is known."));
            }
          }
        }

        (s.note || []).forEach((b, bi) => {
          if (b.text && !b.reply) {
            errors.push(at("clients.json", `${where} note ${bi + 1} has text but no reply.`,
              "The reply is what arrives when the note is finished; the payout would land in silence."));
          }
          for (const tok of tokensIn((b.text || "") + " " + (b.reply || ""))) {
            if (!CLIENT_NOTE_TOKENS.has(tok)) {
              errors.push(at("clients.json", `${where} note ${bi + 1} uses {${tok}}, which is never filled in.`,
                `Available in note copy: ${[...CLIENT_NOTE_TOKENS].map(t => "{" + t + "}").join(" ")}`));
            }
          }
        });

        /* A note only drops when a container finishes while another still holds
           loose items, so a one-container level never leaves one. */
        const lv = levels[idx];
        if ((s.note || []).length && lv.cont === 1) {
          warnings.push(at("clients.json",
            `${where} writes notes for level "${s.level}", which has cont: 1 and can never drop one. Put those words in the intro.`));
        }
        if ((s.note || []).length > (lv.rooms || 1)) {
          warnings.push(at("clients.json",
            `${where} has ${s.note.length} notes but level "${s.level}" only has ${lv.rooms} rooms, so the last ones can never be read.`));
        }
      });

      /* Two is legal because of Mom: a prologue whose whole job is to teach the
         verbs and hand you to a real client. Three to five is the shape of an
         arc that has somewhere to go. */
      if (stages.length < 2 || stages.length > 5) {
        warnings.push(at("clients.json", `client "${c.id}" has ${stages.length} stages; arcs are meant to be 3-5 (2 for a prologue).`));
      }
    }

    for (const [id, owners] of claims) {
      if (owners.length > 1) {
        errors.push(at("clients.json", `level "${id}" is claimed by ${owners.length} stages: ${owners.join(", ")}.`,
          "Every level is exactly one client's job, or it shows twice on the board and its note arrives in two voices."));
      }
    }
    for (const lv of levels) {
      if (!claims.has(lv.id)) {
        errors.push(at("clients.json", `level "${lv.id}" has no client.`,
          "Every campaign level is somebody's job: this one would open with nobody there, end with no thank-you, and never appear on the job board at all."));
      }
    }
  }

  /* ---------- 11. THE SIZE CURVE ----------
     Two warnings, not errors: both of these are design shape rather than
     correctness, and a level that breaks them still plays.

     (a) A CLIENT'S ARC CLIMBS. A first job is a look-in, a second is the real
         work, a third is everything they have — that is the whole reason the
         same house does not feel like the same house twice, and it lives in
         two files at once (the numbers here, the voice in clients.json), so
         nothing but a check keeps them agreeing.

     (b) NO TWO JOBS IN A ROW FEEL THE SAME SIZE. The complaint that produced
         all of this was "all the levels feel the same size", and the cause was
         arithmetic: twenty-six consecutive levels sat between 3 and 6 rooms
         with cont 3-4, types 5 and rowLen 5, so consecutive jobs differed by a
         few per cent and the arcs' shape was invisible. Adjacent levels have
         to differ by more than a fifth or the player cannot feel the swing.
         The tutorial is exempt: the first jobs are a ramp on purpose. */
  {
    /* What the level will actually DELIVER, not what it asks for. The two
       differ by up to a fifth on a house level, which is exactly the size of
       the gap this check is looking for — measuring the ask flagged two pairs
       that are a clear quarter apart in play. */
    const askOf = l => expectedItems(l, (themes[l.theme || D.themes?.defaultTheme]?.rooms || [])
      .map(rid => rooms.find(r => r.id === rid)).filter(Boolean));
    const idxOf = new Map(levels.map((l, i) => [l.id, i]));
    for (const c of (Array.isArray(clients) ? clients : [])) {
      const st = (c.stages || []).filter(s => idxOf.has(s.level));
      for (let i = 1; i < st.length; i++) {
        const a = levels[idxOf.get(st[i - 1].level)], b = levels[idxOf.get(st[i].level)];
        if (askOf(b) < askOf(a)) {
          warnings.push(at("levels.json",
            `client "${c.id}" gets SMALLER: "${a.id}" asks for ${askOf(a)} items and the next job for them, "${b.id}", asks for ${askOf(b)}.`,
            "An arc is meant to grow — a look-in, then the real work, then everything they have."));
        }
      }
    }
    /* The first job with talents on is where the ramp ends and the swing starts. */
    const rampEnds = levels.findIndex(l => l.talents !== false);
    for (let i = Math.max(1, rampEnds + 1); i < levels.length; i++) {
      const a = askOf(levels[i - 1]), b = askOf(levels[i]);
      const r = b / a;
      if (r > 0.8 && r < 1.25) {
        warnings.push(at("levels.json",
          `"${levels[i - 1].id}" (${a} items) and "${levels[i].id}" (${b}) are the same size, back to back.`,
          "Consecutive jobs need to differ by more than a fifth, or the size swing is invisible and every level feels like the last one."));
      }
    }
  }

  if (!D.quests?.signature) {
    warnings.push(at("quests.json", "no `signature`. Free-play notes would arrive unsigned.",
      "Campaign notes are signed by the client who hired you; this is the hand a house writes in when nobody did."));
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
