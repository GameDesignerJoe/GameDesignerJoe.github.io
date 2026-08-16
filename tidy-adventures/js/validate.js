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
        for (const line of [...(s.intro || []), ...(s.outro || []), s.teaser || "", s.replay || ""]) {
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
