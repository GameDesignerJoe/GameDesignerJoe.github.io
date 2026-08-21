/* ============================================================
   VALIDATE — catch bad data edits at boot, with a message that says
   which file, what's wrong, and why it matters.

   The point of this module: data/*.json is meant to be hand-edited. A typo
   there must never turn into a silent gameplay bug discovered 400 items into
   a run. Errors stop boot behind an on-screen panel (readable on a phone,
   where there is no console). Warnings log and carry on.

   Imports: none. This is a leaf.
============================================================ */
import { MAX_ROOMS, TALENT_IDS, HOME_IDS, CONSUMABLE_EFFECTS } from './config.js';
import { tokensIn, anchorPrefix, expectedItems, themeTypeCap } from './util.js';

export class DataError extends Error {}

/* ---------- helpers ---------- */
const at = (file, msg, why) => `data/${file} — ${msg}${why ? "\n    " + why : ""}`;

/* ---------- NO ARTICLE MAY GO NEAR A NAME TOKEN ----------

   docs/CLAUDE.md has carried this rule for room names since "You left off in
   the {room}" shipped as "in the the Familiar's Roost" and "in the
   Hydroponics" on the same build. It is exactly as true of {container} and
   {item}, and the moment `quips` started embedding them in prose it broke the
   same way: "The {container} gives" rendered as "The The Locked Case gives."

   The names supply their own articles and they disagree. Containers: "Fridge"
   and "Pantry" want "the", "The Locked Case" and "The Actual Bin" already have
   one, and "Not Bananas", "Do Not Open", "Growing" and "Things We Don't
   Discuss" take none at all. Items are worse — they are capitalised, because
   every other reader of names.json is a LABEL (the loupe, the hand bar,
   senseSuffix), so "The Salt goes" is wrong twice over.

   So a name token goes in LABEL POSITION: after a dash, a colon or a full
   stop, where nothing implies an article and nothing implies lower case. This
   catches the article; the position is a writing habit the copy demonstrates.

   Returns a list of offending "the {container}"-shaped substrings. */
const ARTICLE_BEFORE = /\b(the|a|an|The|A|An)\s+\{(container|room|item)\}/g;
const articleSlips = str => [...String(str).matchAll(ARTICLE_BEFORE)].map(m => m[0]);

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

    /* ---------- 5b. NO TWO CONTAINERS IN A ROOM SHARE A SKIN ----------

       A kind is the only thing telling two pieces of furniture apart at a
       glance, and a room is where the player is doing the comparing. The
       bathroom shipped with "Under the Sink" and "The Bath Toys Box" both as
       `plastic`, and the frat kitchen's "The Sink" wore the FRIDGE skin —
       so the answer to "which of these grey boxes is the sink" was to read
       the name plate, which is exactly the job the drawn furniture exists to
       take off the player. Twelve shape kinds were added to make this
       satisfiable everywhere; see _shapeKindsNote in furniture.json. */
    const bySkin = new Map();
    for (const c of room.containers || []) {
      if (!bySkin.has(c.kind)) bySkin.set(c.kind, []);
      bySkin.get(c.kind).push(c.id);
    }
    for (const [kind, ids] of bySkin) {
      if (ids.length > 1) {
        warnings.push(at("rooms.json",
          `room "${room.id}" draws ${ids.length} containers with the same kind "${kind}": ${ids.join(", ")}.`,
          "Two identical silhouettes in one room means the name plate is the only way to tell them apart. " +
          `Spare kinds: ${Object.keys(kinds).filter(k => !bySkin.has(k)).join(", ") || "none"}.`));
      }
    }
  }

  /* ---------- 5c. NAME BAIT — a container advertising what it won't take ----

     The taxonomy rule in rooms.json says confusable emoji share a container
     and the container's NAME is the test. This is the failure mode of that
     rule that no amount of care catches by eye, because it needs two files
     open at once: a container whose NAME contains the name of an item that
     lives in a DIFFERENT container in the SAME ROOM.

     Three shipped. "Minerals & Salts" sat beside the salt. "Mirrors & Lenses"
     sat beside the mirror. "Supplements & Salts", again the salt. Every one of
     them is a container asking out loud for something it is coded to reject —
     which is worse than an unguessable home, because the player is not
     guessing, they are reading, and the game is lying to them.

     Word-stem matching, both sides authored (container names here, item names
     in names.json), which is what keeps it precise rather than a heuristic
     that cries wolf. `"baitOk": true` on a container opts out, for the one
     case where the bait IS the joke: the Banana Vault's "Not Bananas". */
  {
    /* Furniture words. These are what a container is, never what it holds, so
       matching on them says nothing — and "The Box Shelf" beside a box would
       be flagged forever. */
    const CARCASS = new Set(("the a an and or of in on under my not it its at out for to with " +
      "box boxes bin bins bag bags rack racks shelf shelves case cases drawer drawers " +
      "cabinet corner pile heap stack stand tin trunk chest crate basket bowl cup tower " +
      "store station room wall hook hooks peg pegs rail tray trays locker cupboard " +
      "things thing stuff other actual one clean ish do don discuss which have been " +
      "since arrival cannot place grown fond apparatus units objects").split(" "));

    const stem = w =>
      w.endsWith("ies") && w.length > 4 ? w.slice(0, -3) + "y" :
      w.endsWith("es")  && w.length > 4 ? w.slice(0, -2) :
      w.endsWith("s")   && w.length > 3 ? w.slice(0, -1) : w;
    const keywords = s => new Set(
      String(s || "").toLowerCase().split(/[^a-z]+/)
        .filter(w => w && !CARCASS.has(w)).map(stem));

    const names = D.names?.names || {};
    for (const room of rooms) {
      const cs = room.containers || [];
      for (const c of cs) {
        if (c.baitOk) continue;
        const want = keywords(c.name);
        if (!want.size) continue;
        for (const other of cs) {
          if (other === c) continue;
          for (const e of other.types || []) {
            const shared = [...keywords(names[e])].filter(w => want.has(w));
            if (!shared.length) continue;
            warnings.push(at("rooms.json",
              `room "${room.id}": container "${c.name}" reads as the home of ${e} ${names[e]}, ` +
              `which actually lives in "${other.name}" one piece of furniture away.`,
              `Both names claim "${shared.join(", ")}". Move the emoji, rename the container, or ` +
              `set "baitOk": true if the bait is deliberate.`));
          }
        }
      }
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

  /* ---------- 7c. THE FREE PLAY BOARD IS BUILDABLE ----------

     sizes.json used to be nine ready-made configs and checkCfg() could read
     each one straight off. A band carries no theme and no type count now — it
     is an item target that data.js resolves per world — so the thing to check
     is not the band, it is every house the band produces: eleven characters
     times five bands times five houses, and every one of them a config
     generate() has to be able to satisfy.

     Cheap to be exhaustive here (a few hundred arithmetic checks at boot) and
     the alternative is finding out four hundred items into a run. */
  {
    const SZ = D.sizes || {};
    const bands = Array.isArray(SZ.bands) ? SZ.bands : null;
    const clients = Array.isArray(D.clients?.clients) ? D.clients.clients : [];
    const per = SZ.housesPerBand;

    if (!bands || !bands.length) {
      errors.push(at("sizes.json", "no `bands` array.",
        "Free play is size bands crossed with the cast in clients.json. With none there is no free play at all."));
    }
    if (!(per >= 1)) {
      errors.push(at("sizes.json", `housesPerBand is ${per}.`,
        "How many houses each character offers per band. It also has to match the length of every client's `places`."));
    }

    const seenBand = new Set();
    for (const b of bands || []) {
      if (!b.id) {
        errors.push(at("sizes.json", "a band has no `id`.", "The id goes into every house id and into every save."));
      } else if (seenBand.has(b.id)) {
        errors.push(at("sizes.json", `two bands share the id "${b.id}".`,
          "House ids are built from it, so duplicates collide in FREE_KEY and two bands share one set of ticks."));
      } else seenBand.add(b.id);
      if (!b.label) warnings.push(at("sizes.json", `band "${b.id}" has no \`label\`, so its board heading is blank.`));
      if (!(b.rooms >= 1)) errors.push(at("sizes.json", `band "${b.id}" has rooms: ${b.rooms}.`));
      else if (b.rooms > MAX_ROOMS) {
        errors.push(at("sizes.json", `band "${b.id}" asks for ${b.rooms} rooms; the layout grid holds ${MAX_ROOMS}.`));
      }
      if (!(b.items >= 1)) {
        errors.push(at("sizes.json", `band "${b.id}" has items: ${b.items}.`,
          "`items` is the only size number authored anywhere — targetTypes and rowLen are derived from it per world."));
      }
    }
    /* Smallest first, or the board's headings are a shuffled list. */
    for (let i = 1; i < (bands || []).length; i++) {
      if (!(bands[i].items > bands[i - 1].items)) {
        warnings.push(at("sizes.json",
          `band "${bands[i].id}" (${bands[i].items} items) is not bigger than "${bands[i - 1].id}" (${bands[i - 1].items}).`,
          "The board renders in this order and the headings read as a size ramp."));
      }
    }

    /* ---------- every house, derived exactly as data.js derives it ---------- */
    const rowMin = SZ.rowLen?.min ?? 4, rowMax = SZ.rowLen?.max ?? 8;
    const reach = SZ.reach ?? 0.85;
    const fill = SZ.typeFill ?? 1;
    if (!(fill > 0 && fill <= 1)) {
      errors.push(at("sizes.json", `typeFill is ${fill}.`,
        "The fraction of a world's type pool one run may use. Above 1 would ask for types that do not exist; " +
        "at 1 every run of a small world is the same run."));
    }
    if (!(rowMin >= 1 && rowMax >= rowMin)) {
      errors.push(at("sizes.json", `rowLen is {min:${rowMin}, max:${rowMax}}.`,
        "rowLen is how many of each emoji exist: min at least 1, max at least min."));
    }
    let pairs = 0, filled = 0;
    for (const c of clients) {
      if (!c.world) {
        errors.push(at("clients.json", `client "${c.id}" has no \`world\`.`,
          "Free play is these people too, and a house has to draw its rooms from somewhere. It is authored rather " +
          "than inferred from their campaign stages, because inferring it gets Zorb wrong: his first job is a house."));
        continue;
      }
      if (!themes[c.world]) {
        errors.push(at("clients.json", `client "${c.id}" has world "${c.world}", which is not in themes.json.`,
          `Known worlds: ${Object.keys(themes).join(", ")}`));
        continue;
      }
      const places = c.places || [];
      if (per >= 1 && places.length !== per) {
        errors.push(at("clients.json",
          `client "${c.id}" has ${places.length} \`places\` but housesPerBand is ${per}.`,
          "One place name per house. Short and the last tiles fall back to \"House 4\"; over and the extras never render."));
      }
      places.forEach((place, i) => {
        if (!String(place || "").trim()) {
          errors.push(at("clients.json", `client "${c.id}" place ${i + 1} is empty.`));
        }
      });
      /* Two people may share a world (Captain and Boris both run the zoo) but
         not a place name inside it, or two tiles in one band read identically. */
      const dup = places.filter((p, i) => places.indexOf(p) !== i);
      if (dup.length) {
        warnings.push(at("clients.json", `client "${c.id}" repeats a place name: ${[...new Set(dup)].join(", ")}.`));
      }

      for (const b of bands || []) {
        pairs++;
        const nRooms = Math.min(b.rooms, (themes[c.world].rooms || []).length);
        const cap = themeTypeCap(themes[c.world], rooms, D.furniture?.anchors, anchorSize, nRooms);
        if (!cap) {
          errors.push(at("themes.json", `world "${c.world}" has no rooms with any container types.`,
            "Nothing can be generated in it, so every one of its free-play houses would be empty."));
          continue;
        }
        const usable = Math.floor(cap * fill);
        const first = Math.max(rowMin, Math.min(rowMax, Math.round(b.items / (usable || 1))));
        const types = Math.max(1, Math.min(usable || 1, Math.round(b.items / first)));
        /* Same second pass as buildFreeBoard() — see the comment there. */
        const rowLen = Math.max(rowMin, Math.min(rowMax, Math.round(b.items / types)));
        const got = types * rowLen;
        /* Under `reach` means the band is NOT OFFERED for this world — a
           deliberate absence, not a fault. The Dream is four rooms and 58
           types; it cannot honestly be an 1,800-item house and is left out of
           the big bands rather than shrunk into them. */
        if (got < b.items * reach) continue;
        filled++;
        /* The one derivation that would actually break a run. It clamps to
           `cap`, so this can only fire if buildFreeBoard() in js/data.js and
           this loop have drifted apart — which is the whole reason both go
           through themeTypeCap() rather than each doing their own sums. */
        if (types > usable) {
          errors.push(at("sizes.json",
            `free-play houses "fp:${c.id}:${b.id}:*" want ${types} types but ${nRooms} rooms of ` +
            `world "${c.world}" offer ${usable} (of ${cap}, at typeFill ${fill}).`,
            "buildFreeBoard() in js/data.js and this check must derive the same numbers."));
        }
      }
    }
    if (bands?.length && clients.length && !filled) {
      errors.push(at("sizes.json", "no world can fill any band, so the free-play board is empty.",
        `Every combination came out under \`reach\` (${reach}). Lower it, or lower the bands' item counts.`));
    }
    /* Worth SAYING how much board there is. Nobody authored it, so nobody would
       otherwise notice a retuned band quietly halving free play. */
    if (filled && per >= 1) {
      warnings.push(at("sizes.json",
        `free play offers ${filled * per} houses — ${filled} of ${pairs} character-and-band pairs, ${per} houses each.`,
        "Informational. A pair is left out when the world cannot honestly reach that band's item count."));
    }
  }
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
      if (!(l.rewards > 0) && (t.when === "talentEarned" || target === "shop")) {
        errors.push(at("levels.json",
          `level ${l.id} has rewards: ${l.rewards} but its tip "${t.kind}" teaches talents.`,
          "That level teaches no talents, so talentEarned can never fire and the tip waits " +
          "forever. Give the level a reward, or move the tip to the first level that has one."));
      }
    }
  }
  /* ---------- 8b. HOW MANY TALENTS EACH LEVEL TEACHES ----------

     `rewards` replaced a boolean `talents` flag, which replaced lifetime-⭐
     thresholds. The rule that matters is the CAP: a pick is granted on a room
     completion, and the last room completing is the level completing, so a
     level may promise at most rooms-1 or its final pick lands on the ending —
     on top of the client's outro and the win screen, which is exactly the
     pile-up the celebration queue exists to stop.

     An over-promise is silent without this check: the extra pick is simply
     never granted, so the level quietly hands out fewer talents than authored
     and nothing anywhere says so. */
  {
    const ls = D.levels?.levels || [];
    for (const l of ls) {
      if ("talents" in l) {
        errors.push(at("levels.json",
          `level ${l.id} still has "talents": ${JSON.stringify(l.talents)}.`,
          "That flag is gone — a level says how many talents it teaches with `rewards: N`. " +
          "See the header of js/talents.js."));
      }
      if (!(Number.isInteger(l.rewards) && l.rewards >= 0)) {
        errors.push(at("levels.json",
          `level ${l.id} has rewards: ${JSON.stringify(l.rewards)}, which is not a whole number ≥ 0.`,
          "How many talents this house teaches. 0 is legal and normal — the tutorial teaches none."));
        continue;
      }
      const cap = Math.max(0, (l.rooms || 1) - 1);
      if (l.rewards > cap) {
        errors.push(at("levels.json",
          `level ${l.id} promises ${l.rewards} talents but has ${l.rooms} rooms, so at most ${cap} can be granted.`,
          "Picks are granted on room completions and the LAST room completing is the level " +
          "completing. Lower rewards or add a room; the extra is silently never handed out."));
      }
    }
    const on = ls.findIndex(l => l.rewards > 0);
    if (on === -1) {
      warnings.push(at("levels.json", "no level teaches any talents, so the draft is dead code.",
        "Some level has to be the one that introduces them."));
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
  if ("draftSteps" in (D.upgrades || {})) {
    errors.push(at("upgrades.json", "`draftSteps` is still here and nothing reads it.",
      "Drafts are granted by a level's `rewards` count on room completions now. " +
      "Delete it rather than leaving a tuning knob that does nothing — this file " +
      "already carries two war stories about exactly that."));
  }

  /* ---------- 9b. HOME: the permanent half ----------
     Same both-ways check as the talents, and it matters MORE here: an
     unimplemented talent draws a card that does nothing, and an unimplemented
     home upgrade does nothing AND takes the player's money. */
  {
    const home = D.upgrades?.home;
    if (!Array.isArray(home) || !home.length) {
      errors.push(at("upgrades.json", "no `home` array.",
        "The permanent upgrades bought with ⭐. Without them the Home screen is empty and " +
        "⭐ has nothing to be spent on, which is the fake-economy problem the old shop had."));
    }
    const seenHome = new Set();
    for (const u of home || []) {
      if (!u.id) { errors.push(at("upgrades.json", "a home upgrade has no id.")); continue; }
      if (seenHome.has(u.id)) {
        errors.push(at("upgrades.json", `two home upgrades share the id "${u.id}".`,
          "HOME_KEY is keyed by id, so the second would share the first's level."));
      }
      seenHome.add(u.id);
      if (!HOME_IDS.includes(u.id)) {
        errors.push(at("upgrades.json",
          `home upgrade "${u.id}" is not implemented — no code reads it.`,
          "Add it to HOME_IDS in js/config.js and write the code that reads homeLevel(\"" +
          u.id + "\"). Unimplemented, it charges the player and does nothing."));
      }
      if (!(Number.isInteger(u.levels) && u.levels > 0)) {
        errors.push(at("upgrades.json", `home upgrade "${u.id}" has levels: ${JSON.stringify(u.levels)}.`));
      }
      /* Prices are READ now. A missing or non-increasing one is a free upgrade
         or a cheaper second level, and both look like generosity rather than a
         bug until somebody notices the economy has no floor. */
      const cost = u.cost;
      const arr = Array.isArray(cost) ? cost : (cost == null ? null : [cost]);
      if (!arr || !arr.length || arr.some(v => !(Number.isFinite(v) && v > 0))) {
        errors.push(at("upgrades.json",
          `home upgrade "${u.id}" has cost: ${JSON.stringify(cost)}.`,
          "A positive number, or one per level. ⭐ is money now — an upgrade with no price is free."));
      } else {
        if (Array.isArray(cost) && cost.length !== u.levels) {
          warnings.push(at("upgrades.json",
            `home upgrade "${u.id}" has ${cost.length} prices for ${u.levels} levels; the last one repeats.`));
        }
        if (arr.some((v, i) => i && v <= arr[i - 1])) {
          warnings.push(at("upgrades.json",
            `home upgrade "${u.id}" prices do not increase: [${arr}].`,
            "A later level costing the same or less makes the earlier one the bad deal."));
        }
      }
      for (const tok of tokensIn(u.desc || "")) {
        if (!(u.params && tok in u.params)) {
          errors.push(at("upgrades.json",
            `home upgrade "${u.id}" description uses {${tok}} but params has no "${tok}".`));
        }
      }
    }
    for (const id of HOME_IDS) {
      if (!seenHome.has(id)) {
        errors.push(at("upgrades.json",
          `HOME_IDS lists "${id}" but upgrades.json has no such home upgrade.`,
          "The code reads homeLevel(\"" + id + "\"), which will be 0 forever."));
      }
    }
    /* An id cannot be in both lists: G.up and HOME_KEY are separate records and
       the same id in both would be two different levels of the same name. */
    for (const id of TALENT_IDS) {
      if (HOME_IDS.includes(id)) {
        errors.push(at("upgrades.json", `"${id}" is in both TALENT_IDS and HOME_IDS.`,
          "A thing is either learned inside a house and forgotten, or bought once and kept. " +
          "Being both means two separate levels under one name."));
      }
    }
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
  /* The chatter channel always knows which item and which container the moment
     was about, which note copy never does. */
  const QUIP_TOKENS = new Set(["container", "room", "item", "handSlots", "rowLen", "name"]);
  /* The six situations js/chatter.js carries, and what the house calls them in
     strings.json. Listed here rather than derived from the data, so adding a
     seventh to chatter.js and forgetting to author it is a named warning rather
     than a bubble that silently never appears — the exact failure `teaser`
     shipped with for thirty-four stages. */
  const QUIP_KINDS = ["door", "cache", "unlock", "room", "misfile", "nothing"];

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
        /* The nudge is what Continue says. It has to work COLD — read by
           somebody who last played a week ago and has forgotten the intro —
           so a stage without one falls back to the house's generic line,
           which names nothing and is the "Welcome back" problem again. */
        if (!s.nudge) {
          warnings.push(at("clients.json",
            `${where} ("${s.level}") has no \`nudge\`, so coming back to it mid-job says the house's generic line.`,
            "One sentence restating what is at stake in THIS job, in their voice, read by a player who has forgotten the intro."));
        }
        for (const line of [...(s.intro || []), ...(s.outro || []), s.teaser || "", s.replay || "", s.hook || "", s.hookCold || "", s.nudge || ""]) {
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
          /* NOTE COPY IS DELIBERATELY NOT CHECKED for the article rule, and
             this is the interesting half of that rule. Fifty-nine authored
             note phrases read "the {container}", every one of them shipped and
             reviewed, and warning about all of them each boot would teach a
             reader to skip warnings — which costs more than the bug. They are
             repaired at the point of substitution instead (see tokenise() in
             js/util.js, which eats the doubled article), and the strict check
             applies only to the copy written after the rule existed: quips and
             houseVoice, where it is an ERROR. */
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

      /* ---------- quips: the same voice, mid-job ----------
         Every one of these was a narrator sentence in say() before it was a
         client sentence in a bubble. A client missing one is not broken — the
         house's copy in strings.json covers it — but it is a client with
         nothing to say about the best moment in a room, which wastes the only
         cast this game has. */
      const quips = c.quips || {};
      for (const kind of QUIP_KINDS) {
        const pool = quips[kind];
        if (pool != null && !Array.isArray(pool)) {
          errors.push(at("clients.json", `client "${c.id}" quips.${kind} is not an array.`,
            "One line or several, and the game picks at random. A bare string would be read a character at a time."));
          continue;
        }
        if (!pool?.length) {
          warnings.push(at("clients.json",
            `client "${c.id}" has no \`quips.${kind}\`, so that moment is said in the house's generic voice.`));
          continue;
        }
        for (const line of pool) {
          for (const tok of tokensIn(line)) {
            if (!QUIP_TOKENS.has(tok)) {
              errors.push(at("clients.json", `client "${c.id}" quips.${kind} uses {${tok}}, which is never filled in.`,
                `Available in quips: ${[...QUIP_TOKENS].map(t => "{" + t + "}").join(" ")}`));
            }
          }
          for (const slip of articleSlips(line)) {
            errors.push(at("clients.json",
              `client "${c.id}" quips.${kind} writes "${slip}".`,
              "Container, room and item names supply their own articles and they disagree — " +
              "\"the Fridge\" is right and \"the The Locked Case\" is what that renders as. " +
              "Put the token after a dash, a colon or a full stop instead."));
          }
          /* THE ONE QUIP WITH A JOB TO DO. Every other line is flavour; this
             one is the answer to "then where DOES it go", and a misfile quip
             that names neither the item nor the container is a client being
             charming at the exact moment the player is stuck. See
             misfileHint() in main.js. */
          if (kind === "misfile") {
            const has = new Set(tokensIn(line));
            if (!has.has("item") || !has.has("container")) {
              errors.push(at("clients.json",
                `client "${c.id}" has a misfile quip that does not use both {item} and {container}: "${line}"`,
                "This is the line that tells the player where the thing actually goes. Without both tokens it is sympathy, not an answer."));
            }
          }
        }
      }

      /* ---------- can this person be hired, and does their opening make sense ----
         The campaign is bought a client at a time, so `cost` decides whether
         somebody is part of the opening (0) or something to save up for.

         `hookCold` is the interesting one. Every first-stage hook is a
         REFERRAL — Mom hands you to Marguerite who hands you to Sam, a pizza
         box gets you the frat who get you Unit 7 who give you as a reference to
         Dr. Ashworth — and in a shop where anything is buyable in any order,
         that line can arrive before the person it names. So a client whose
         `needs` points at somebody BUYABLE must also carry a cold opening. A
         client whose referrer is part of the free opening can never be missing
         one, and authoring an unreachable line there is dead copy. */
      if (!(typeof c.cost === "number" && c.cost >= 0)) {
        errors.push(at("clients.json", `client "${c.id}" has cost: ${JSON.stringify(c.cost)}.`,
          "⭐ to hire them. 0 means they are part of the opening and never appear in the shop."));
      }
      if (c.needs !== null && c.needs !== undefined) {
        const ref = (clients || []).find(x => x.id === c.needs);
        if (!ref) {
          errors.push(at("clients.json", `client "${c.id}" needs "${c.needs}", who does not exist.`,
            "`needs` is who refers you — it sets the referral discount and picks warm vs cold copy."));
        } else {
          if (ref.id === c.id) {
            errors.push(at("clients.json", `client "${c.id}" refers themselves.`));
          }
          const buyable = ref.cost > 0;
          const cold = stages[0]?.hookCold;
          if (buyable && !cold) {
            errors.push(at("clients.json",
              `client "${c.id}" is referred by "${ref.id}", who can be locked, but has no \`hookCold\`.`,
              `Their opening line names somebody the player may never have met. Write the version ` +
              `for finding them another way, on their first stage.`));
          }
          if (!buyable && cold) {
            warnings.push(at("clients.json",
              `client "${c.id}" has a \`hookCold\` but is referred by "${ref.id}", who is never locked.`,
              "That line can never be shown. Dead copy."));
          }
        }
      } else if (stages[0]?.hookCold) {
        warnings.push(at("clients.json", `client "${c.id}" has a \`hookCold\` but no \`needs\`.`,
          "With no referrer their warm hook is already the cold one, so this never shows."));
      }
      /* Somebody has to be free or there is no way to start. */
      if (!(clients || []).some(x => !(x.cost > 0))) {
        errors.push(at("clients.json", "every client costs ⭐, so a fresh save has nobody to work for.",
          "At least one client needs cost: 0."));
      }

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
    /* The first job that TEACHES ANYTHING is where the ramp ends and the swing
       starts. This used to read `l.talents !== false`; that flag is gone and
       with it went the check's own start point — reading the new field keeps
       the tutorial exempt, which is the whole point of it (the first jobs are a
       deliberate ramp, so "no two in a row the same size" must not apply). */
    const rampEnds = levels.findIndex(l => l.rewards > 0);
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

  /* ---------- 12. the house can cover for anybody ----------
     houseVoice is BOTH the free-play voice and the fallback for a client with
     a gap, so a missing situation here is real silence rather than a downgrade
     — the one place in this feature where nothing at all would happen. */
  {
    const hv = D.strings?.houseVoice;
    if (!hv) {
      errors.push(at("strings.json", "no `houseVoice`.",
        "Free play has no client, and this is also the fallback for a campaign client missing a quip. Without it those moments are silent."));
    } else {
      for (const kind of [...QUIP_KINDS, "nudge"]) {
        if (!hv[kind]?.length) {
          errors.push(at("strings.json", `houseVoice has no \`${kind}\` lines.`,
            "This is the floor: a client with no quip for this situation falls through to here, so an empty one is silence."));
        }
      }
      for (const [kind, pool] of Object.entries(hv)) {
        if (!Array.isArray(pool)) continue;          /* `face` is a string */
        for (const line of pool) {
          for (const tok of tokensIn(line)) {
            if (!QUIP_TOKENS.has(tok)) {
              errors.push(at("strings.json", `houseVoice.${kind} uses {${tok}}, which is never filled in.`,
                `Available: ${[...QUIP_TOKENS].map(t => "{" + t + "}").join(" ")}`));
            }
          }
          for (const slip of articleSlips(line)) {
            errors.push(at("strings.json", `houseVoice.${kind} writes "${slip}".`,
              "Same rule as anywhere else these tokens appear: the names carry their own articles."));
          }
        }
      }
      for (const line of hv.misfile || []) {
        const has = new Set(tokensIn(line));
        if (!has.has("item") || !has.has("container")) {
          errors.push(at("strings.json",
            `houseVoice.misfile does not use both {item} and {container}: "${line}"`,
            "Same rule as a client's: this line exists to name where the thing actually goes."));
        }
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
