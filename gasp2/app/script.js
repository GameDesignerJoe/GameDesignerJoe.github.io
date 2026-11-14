// GASP 2 script format: parser and edit operations, shared by the app (browser) and the server (Node).
// Kept as a plain script that defines one global, so both can load it without a build step.
//
//   SCENE / INT. / EXT. lines      scene headings (optional)
//   SHOT: Wren on the rock · MS · Beach Rock · 5s      starts a shot; the rest of the block belongs to it
//   IMAGE: ...   MOTION: ...   SFX: ...   NOTE: ...   WHO: ...   fields (a field can run on over following lines)
//   WREN: "You can stop pretending."     dialogue, or a cue line  WREN  followed by the line
//   anything else                          action, kept with the shot
//   [[#a1b2c3d4e5]]                        the link GASP adds to a SHOT line after Sync. Leave it alone.
var GASPScript = (function () {
  var FIELDS = { IMAGE: "image", MOTION: "motion", SFX: "sfx", SOUND: "sfx", NOTE: "notes", NOTES: "notes", WHO: "who", FRAME: "frame", LOCATION: "location", LENGTH: "seconds" };
  var FRAMES = /^(EWS|WS|LS|FS|MS|MWS|MCU|CU|ECU|OTS|POV|2-?SHOT|TWO-?SHOT|INSERT|AERIAL|TRACKING|LOW ANGLE|HIGH ANGLE|DUTCH)$/i;
  var reShot = /^\s*SHOT\b\s*#?\d*\s*[:.\-–—·]?\s*(.*)$/i;
  var reScene = /^\s*(INT\.|EXT\.|INT\/EXT|I\/E\.|SCENE\b)/i;
  var reField = /^\s*(IMAGE|MOTION|SFX|SOUND|NOTES?|WHO|FRAME|LOCATION|LENGTH)\s*:\s*(.*)$/i;
  var reDialog = /^\s*([A-Z][A-Z0-9 .'\-]{0,28}[A-Z0-9.'])\s*(\([^)]*\))?\s*:\s*(.+)$/;
  var reCue = /^\s*([A-Z][A-Z0-9 .'\-]{0,28}[A-Z0-9.'])\s*(\([^)]*\))?\s*$/;
  var reId = /\s*\[\[#([a-z0-9]{6,16})\]\]\s*$/i;
  var NOT_NAMES = /^(INT|EXT|SCENE|SHOT|CUT TO|FADE IN|FADE OUT|THE END|END|CONTINUED|TITLE|STORY|EPISODE|STYLE|FORMAT|TONE|RULES|LIGHT|PALETTE|CAMERA|CAST|AUDIO|MUSIC|BRIEF|LOOK|TARGET|PERFORMANCE)\b/;

  function splitCallout(rest) {
    var id = null, m = rest.match(reId); if (m) { id = m[1]; rest = rest.replace(reId, ""); }
    rest = rest.replace(/\s*\[\[#[^\]]*\]\]/g, "");   // tags GASP didn't make
    var parts = rest.split(/\s*[·|]\s*|\s+[-–—]\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var o = { id: id, title: "", frame: "", location: "", seconds: null };
    parts.forEach(function (p) {
      var sec = p.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds)$/i);
      if (sec) o.seconds = +sec[1];
      else if (FRAMES.test(p)) o.frame = p.toUpperCase();
      else if (!o.title) o.title = p;
      else if (!o.location) o.location = p;
      else o.location += ", " + p;
    });
    return o;
  }

  function parse(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var blocks = [], cur = null, field = null, cue = null, scene = "", style = "", aspect = "", head = null, tail = false;
    function close(i) { if (cur) { cur.end = i - 1; while (cur.end > cur.start && !lines[cur.end].trim()) cur.end--; blocks.push(cur); } cur = null; field = null; cue = null; }
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i], t = L.trim(), m;
      if (reScene.test(t)) { close(i); scene = t; continue; }
      if (/^-{3,}$/.test(t) || /^(#+\s*)?(REFERENCE|REFERENCES|REFERENCE IMAGES?)\b/i.test(t)) { close(i); tail = true; continue; }
      if (tail && !reShot.test(t)) continue;
      if ((m = t.match(reShot)) && !reField.test(t)) {
        close(i); tail = false; var c = splitCallout(m[1]);
        cur = { start: i, end: i, id: c.id, title: c.title, frame: c.frame, location: c.location, seconds: c.seconds, scene: scene, image: "", motion: "", sfx: [], notes: "", who: "", action: "", lines: [] };
        continue;
      }
      if (!cur) {   // header lines above the first shot: FORMAT and STYLE
        if ((m = t.match(/^FORMAT\s*:\s*(\d+)\s*[:x×]\s*(\d+)/i))) { aspect = m[1] + ":" + m[2]; head = null; continue; }
        if ((m = t.match(/^STYLE\s*:\s*(.*)$/i))) { style = m[1].trim(); head = "style"; continue; }
        if (head === "style" && t && !/^[A-Z][A-Za-z ]{1,20}\s*:/.test(t)) { style += " " + t; continue; }
        head = null; continue;
      }
      if (!t) { field = null; cue = null; continue; }
      if ((m = t.match(reField))) {
        var k = FIELDS[m[1].toUpperCase()], v = m[2].trim();
        if (k === "sfx") { if (v) cur.sfx.push(v); field = "sfx"; }
        else if (k === "seconds") { var n = parseFloat(v); if (n) cur.seconds = n; field = null; }
        else if (k === "frame") { cur.frame = v.toUpperCase(); field = null; }
        else { cur[k] = cur[k] ? cur[k] + " " + v : v; field = k; }
        cue = null; continue;
      }
      if ((m = t.match(reDialog)) && !NOT_NAMES.test(m[1])) { cur.lines.push({ who: titleCase(m[1]), text: unquote(m[3]), how: m[2] ? m[2].slice(1, -1) : "" }); field = null; cue = null; continue; }
      if ((m = t.match(reCue)) && !NOT_NAMES.test(m[1]) && i + 1 < lines.length && lines[i + 1].trim()) { cue = { who: titleCase(m[1]), how: m[2] ? m[2].slice(1, -1) : "" }; field = null; continue; }
      if (cue && /^\(.*\)$/.test(t)) { cue.how = t.slice(1, -1); continue; }   // parenthetical under a cue
      if (cue) { cur.lines.push({ who: cue.who, text: unquote(t), how: cue.how }); cue = null; continue; }
      if (field === "sfx") { cur.sfx[cur.sfx.length - 1] += " " + t; continue; }
      if (field) { cur[field] += (cur[field] ? " " : "") + t; continue; }
      cur.action += (cur.action ? " " : "") + t;
    }
    close(lines.length);
    blocks.forEach(function (b, k) {
      b.num = k + 1;
      if (!b.title) b.title = firstWords(b.action || b.image || b.motion || "Shot " + b.num);
      if (!b.image && b.action) b.image = b.action;
      if (!b.who && b.lines.length) b.who = uniq(b.lines.map(function (l) { return l.who; })).join(", ");
    });
    return { blocks: blocks, characters: characters(lines), style: style, aspect: aspect };
  }
  function unquote(s) { s = s.trim(); return /^["“].*["”]$/.test(s) ? s.slice(1, -1) : s; }
  function titleCase(s) { return s.toLowerCase().replace(/(^|[\s'\-.])[a-z]/g, function (c) { return c.toUpperCase(); }); }
  function firstWords(s) { s = String(s).split(/(?<=[.!?;])\s/)[0].trim(); return s.length > 54 ? s.slice(0, 52).replace(/\s+\S*$/, "") + "…" : s; }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function characters(lines) { var seen = {}; lines.forEach(function (L) { var t = L.trim(), m = t.match(reDialog) || t.match(reCue); if (m && !NOT_NAMES.test(m[1]) && !reField.test(t) && !reShot.test(t) && !reScene.test(t) && m[1].length > 1) seen[m[1].trim()] = 1; }); return Object.keys(seen).sort(); }

  // ---- edits (all take and return the whole text) ----
  function calloutLine(num, sh) {
    var bits = [sh.title || "Untitled"]; if (sh.frame) bits.push(sh.frame); if (sh.location) bits.push(sh.location); if (sh.seconds) bits.push(sh.seconds + "s");
    return "SHOT " + num + ": " + bits.join(" · ") + (sh.id ? " [[#" + sh.id + "]]" : "");
  }
  function blockOf(text, id) { var p = parse(text); for (var i = 0; i < p.blocks.length; i++) if (p.blocks[i].id === id) return { b: p.blocks[i], p: p }; return null; }
  function lines(text) { return String(text || "").replace(/\r/g, "").split("\n"); }
  // set one field on a shot's block (IMAGE / MOTION / NOTE); value "" removes the line
  function setField(text, id, name, value) {
    var f = blockOf(text, id); if (!f) return text; var L = lines(text), b = f.b, label = name.toUpperCase() + ":";
    value = String(value || "").replace(/\s*\n\s*/g, " ").trim();
    var re = new RegExp("^\\s*" + name + "S?\\s*:", "i");
    for (var i = b.start + 1; i <= b.end; i++) if (re.test(L[i])) {
      var j = i + 1; while (j <= b.end && L[j].trim() && !reField.test(L[j]) && !reDialog.test(L[j].trim()) && !reCue.test(L[j].trim())) j++;   // run-on lines of that field
      if (value) L.splice(i, j - i, label + " " + value); else L.splice(i, j - i);
      return L.join("\n");
    }
    if (!value) return text;
    var at = b.start + 1;   // IMAGE right under the callout, MOTION after IMAGE, NOTE after both
    if (name !== "image") for (var k = b.start + 1; k <= b.end; k++) if (/^\s*(IMAGE|MOTION)\s*:/i.test(L[k])) at = k + 1;
    L.splice(at, 0, label + " " + value); return L.join("\n");
  }
  function setCallout(text, id, sh) { var f = blockOf(text, id); if (!f) return text; var L = lines(text); var old = splitCallout(L[f.b.start].replace(reShot, "$1")); L[f.b.start] = calloutLine(f.b.num, { id: id, title: sh.title != null ? sh.title : old.title, frame: sh.frame != null ? sh.frame : old.frame, location: sh.location != null ? sh.location : old.location, seconds: sh.seconds !== undefined ? sh.seconds : old.seconds }); return L.join("\n"); }
  // put linked blocks into the given order; unlinked text and scene headings stay where they are
  function reorder(text, ids) {
    var p = parse(text), L = lines(text), linked = p.blocks.filter(function (b) { return b.id && ids.indexOf(b.id) >= 0; });
    var chunks = {}; linked.forEach(function (b) { chunks[b.id] = L.slice(b.start, b.end + 1); });
    var order = ids.filter(function (id) { return chunks[id]; }); var out = [], pos = 0, n = 0;
    linked.forEach(function (b) { out = out.concat(L.slice(pos, b.start)); out = out.concat(chunks[order[n++]]); pos = b.end + 1; });
    out = out.concat(L.slice(pos)); return renumber(out.join("\n"));
  }
  function removeBlock(text, id) { var f = blockOf(text, id); if (!f) return text; var L = lines(text), e = f.b.end; while (e + 1 < L.length && !L[e + 1].trim()) e++; L.splice(f.b.start, e - f.b.start + 1); return renumber(L.join("\n")); }
  function insertBlock(text, afterId, sh) {
    var L = lines(text), chunk = [calloutLine(0, sh)].concat(sh.imagePrompt ? ["IMAGE: " + sh.imagePrompt] : []).concat(sh.motionPrompt ? ["MOTION: " + sh.motionPrompt] : []).concat([""]);
    var f = afterId ? blockOf(text, afterId) : null, at;
    if (f) { at = f.b.end + 1; while (at < L.length && !L[at].trim()) at++; if (at < L.length) chunk.push(""); chunk = [""].concat(chunk); at = f.b.end + 1; }
    else { var p = parse(text); at = p.blocks.length ? p.blocks[0].start : L.length; if (!p.blocks.length && L.length && L[L.length - 1].trim()) chunk = [""].concat(chunk); }
    L.splice.apply(L, [at, 0].concat(chunk)); return renumber(L.join("\n").replace(/\n{3,}/g, "\n\n"));
  }
  function renumber(text) { var p = parse(text), L = lines(text); p.blocks.forEach(function (b, k) { L[b.start] = L[b.start].replace(/^(\s*SHOT)\s*#?\d*\s*[:.\-–—·]?\s*/i, "SHOT " + (k + 1) + ": "); }); return L.join("\n"); }
  function stampId(text, block, id) { var L = lines(text); L[block.start] = L[block.start].replace(/\s*\[\[#[^\]]*\]\]/g, "") + " [[#" + id + "]]"; return L.join("\n"); }

  var GUIDE = [
    "GASP shot format. Write the script as a screenplay; mark every shot like this:",
    "",
    "FORMAT: 9:16                              (optional, above the first shot: 9:16 vertical is the default, or 16:9, 1:1)",
    "STYLE: 1980s cel-animated cartoon, bold ink outlines   (optional: the look, added in front of every IMAGE prompt)",
    "TONE: playful → charged                  (optional brief lines above the first shot: TONE, RULES, LIGHT, CAMERA, CAST, AUDIO)",
    "CAST: Wren — woman in her twenties, sun-streaked hair, leather-and-fur two-piece   (exact words to reuse in every IMAGE)",
    "SCENE: Beach camp, late morning          (optional scene heading; INT./EXT. also work)",
    "SHOT: Wren sunbathes on the rock · MS · Beach Rock · 5s",
    "WHO: Wren                                (which characters are in frame, so GASP attaches their reference images)",
    "IMAGE: what the keyframe shows, described from scratch: \"a woman in her twenties with sun-streaked hair...\",",
    "       pose, wardrobe, setting, light, lens. No character names: an image model doesn't know who Wren is.",
    "MOTION: what moves: camera move and action during the shot.",
    "WREN: \"Dialogue goes like this.\"          (or the name on its own line, then the line)",
    "SFX: surf, a gull, leather creaks",
    "NOTE: anything for the director",
    "",
    "Rules: one SHOT line per shot; the title comes first after SHOT:, then optional framing (ECU, CU, MCU, MS, WS, OTS),",
    "location and length (5s). Keep IMAGE prompts self-contained so each works on its own in any image model:",
    "write characters, props and places that have a look (a Reference card or a CAST line) by NAME IN CAPS (MOTHER, TOY SOLDIER):",
    "GASP swaps in the look when the image is made. Describe anyone else in full. Put who's in frame on the WHO: line. Frame for the episode's FORMAT.",
    "Lines ending in [[#…]] are links GASP adds; keep them when you rewrite a shot.",
  ].join("\n");

  // ---- format check: fix what is certain, flag the rest (line numbers are 0-based) ----
  var SYN = { VISUAL: "IMAGE", PROMPT: "IMAGE", "IMAGE PROMPT": "IMAGE", KEYFRAME: "IMAGE", PICTURE: "IMAGE", FRAME_IMAGE: "IMAGE", CAMERA: "MOTION", MOVEMENT: "MOTION", ANIMATION: "MOTION", "VIDEO PROMPT": "MOTION", "MOTION PROMPT": "MOTION", AUDIO: "SFX", "SOUND EFFECTS": "SFX", "SOUND EFFECT": "SFX", FX: "SFX", SOUNDS: "SFX", NOTES: "NOTE", "DIRECTOR NOTE": "NOTE", DURATION: "LENGTH", TIME: "LENGTH" };
  function lint(text, opt) {
    opt = opt || {};
    var L = lines(text), fixes = [], issues = [];
    var fix = function (i, nv, msg) { if (nv !== L[i]) { L[i] = nv; fixes.push({ line: i, msg: msg }); } };
    // names used as speakers anywhere (WREN: or a cue line) count as characters, so "Wren:" can be fixed to "WREN:"
    var known = {}; L.forEach(function (x) { var m = x.trim().match(reDialog) || x.trim().match(reCue); if (m && !NOT_NAMES.test(m[1]) && !reField.test(x) && !reShot.test(x.trim())) known[m[1].trim().toUpperCase()] = 1; });
    var inShots = false;
    L.forEach(function (x, i) {
      var t = x;
      t = t.replace(/^\s*(?:[-*•]\s+|#{1,6}\s+|>\s+)/, "");                         // bullets, markdown headings, quotes pasted from chat
      t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");        // markdown bold
      t = t.replace(/\s+$/, "");
      if (t !== x) fix(i, t, "removed chat formatting");
      var m;
      if ((m = t.match(/^\s*(scene|int\.|ext\.)\s*[:.\-–]?\s*(.*)$/i)) && !/^\s*(SCENE:|INT\.|EXT\.)/.test(t)) fix(i, (/scene/i.test(m[1]) ? "SCENE: " : m[1].toUpperCase() + " ") + m[2], "scene heading in caps");
      if ((m = t.match(/^\s*shot\b\s*#?\s*(\d*)\s*[:.\-–—·]?\s*(.*)$/i)) && !reField.test(t)) {
        var tags = m[2].match(/\[\[#[^\]]*\]\]/g) || [], real = tags.filter(function (g) { return /^\[\[#[a-z0-9]{6,16}\]\]$/i.test(g); }).pop();
        var rest = m[2].replace(/\s*\[\[#[^\]]*\]\]/g, "").replace(/\s*\|\s*/g, " · ").replace(/\s+[-–—]\s+/g, " · ").replace(/(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds)\b/gi, "$1s");
        inShots = true; rest = rest + (real ? " " + real : ""); var nv = "SHOT" + (m[1] ? " " + m[1] : "") + ": " + rest; if (!/^\s*SHOT\b/.test(t) || nv.replace(/\s/g, "") !== t.replace(/\s/g, "")) fix(i, nv, "SHOT line tidied");
        if (!splitCallout(rest).title) issues.push({ line: i, level: "warn", msg: "This SHOT has no title; the tile will be named from its first words." });
        return;
      }
      if ((m = t.match(/^\s*([A-Za-z][A-Za-z .'_\-]{1,28}?)\s*[:\-–]\s+(.+)$/))) {
        var lab = m[1].trim().toUpperCase().replace(/_/g, " ");
        if (FIELDS[lab] || FIELDS[lab.replace(/S$/, "")]) { var up = lab === "NOTES" ? "NOTE" : lab; if (t.indexOf(up + ": ") !== 0) fix(i, up + ": " + m[2], up + ": label fixed"); return; }
        if (!inShots && /^(STORY|EPISODE|STYLE|FORMAT|TONE|RULES|LIGHT|PALETTE|CAMERA|CAST|AUDIO|MUSIC|BRIEF|LOOK|TARGET|PERFORMANCE|EMOTION LINE)$/.test(lab)) { if (t.indexOf(lab + ": ") !== 0) fix(i, lab + ": " + m[2], "brief label in caps"); return; }   // the brief above the first shot
        if (SYN[lab] && inShots) { fix(i, SYN[lab] + ": " + m[2], lab + " → " + SYN[lab]); return; }
        if (known[lab]) { if (t.indexOf(lab + ": ") !== 0 && t.indexOf(lab + " (") !== 0) fix(i, lab + ": " + m[2], "speaker name in caps"); return; }
        if (/^[A-Z][A-Z .'\-]+$/.test(m[1].trim()) && !NOT_NAMES.test(lab)) return;      // a new speaker in caps is fine
        if (/^[A-Z][a-z]+$/.test(m[1].trim()) && /^["“]/.test(m[2])) { fix(i, lab + ": " + m[2], "speaker name in caps"); return; }
      }
    });
    // whole-shot checks on the cleaned text
    var out = L.join("\n").replace(/\n{3,}/g, "\n\n"); var p = parse(out), ids = {};
    var firstShot = p.blocks.length ? p.blocks[0].start : -1; var OL = lines(out);
    OL.forEach(function (x, i) { if (/^\s*(#+\s*)?(reference|references|reference images?)\b/i.test(x)) issues.push({ line: i, level: "info", msg: "Reference images go in the Reference tab, not the script; GASP attaches them by the names on WHO: lines." }); });
    if (!p.blocks.length && out.trim()) issues.push({ line: 0, level: "error", msg: "No SHOT lines, so Sync has nothing to make. Start each shot with SHOT:" });
    OL.forEach(function (x, i) { if (firstShot > 0 && i < firstShot && i > 0 && x.trim() && !reScene.test(x.trim()) && !/^\s*(STORY|EPISODE|STYLE|FORMAT|TONE|RULES|LIGHT|PALETTE|CAMERA|CAST|AUDIO|MUSIC|BRIEF|LOOK|TARGET|PERFORMANCE|EMOTION LINE)\s*:/i.test(x) && !/^\s*\S.*\s[—–-]\s/.test(x) && (reField.test(x) || reDialog.test(x.trim()))) issues.push({ line: i, level: "warn", msg: "This is above the first SHOT, so it won't reach any shot." }); });
    OL.forEach(function (x, i) { var m = x.trim().match(/^([A-Za-z][A-Za-z ]{2,24})\s*:\s+\S/); if (m && !FIELDS[m[1].toUpperCase()] && !SYN[m[1].toUpperCase()] && !known[m[1].toUpperCase()] && !/^[A-Z][A-Z .'\-]+$/.test(m[1]) && !/^(SCENE|SHOT|Title|STORY|EPISODE|STYLE|FORMAT|TONE|RULES|LIGHT|PALETTE|CAMERA|CAST|AUDIO|MUSIC|BRIEF|LOOK|LENGTH|TARGET|EMOTION LINE|PERFORMANCE)$/i.test(m[1])) issues.push({ line: i, level: "info", msg: "\"" + m[1] + ":\" isn't a GASP label, so this line counts as action. Use IMAGE:, MOTION:, SFX:, NOTE: or a speaker NAME:." }); });
    p.blocks.forEach(function (b) {
      if (b.id) { if (ids[b.id]) issues.push({ line: b.start, level: "error", msg: "Two SHOT lines share the link [[#" + b.id + "]]. Delete it from the copy so Sync makes a new shot." }); ids[b.id] = 1; }
      if (!b.image) issues.push({ line: b.start, level: "error", msg: "No IMAGE (or action) for this shot, so its keyframe has nothing to go on." });
      else if (b.image.length > 1200) issues.push({ line: b.start, level: "info", msg: "Very long IMAGE prompt (" + b.image.length + " characters). Image models tend to drop details past a few sentences." });
      var names = Object.keys(known).concat(String(b.who || "").split(/\s*,\s*|\s+and\s+/).map(function (x) { return x.trim().toUpperCase(); })).filter(function (n) { return n && n.length > 1; });
      // a name counts only written as a name (Wren, WREN), so role names like "Child" don't trip on "a small child"
      var hit = names.filter(function (n) { var tc = titleCase(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return tc.toUpperCase() !== tc && new RegExp("\\b(" + tc + ")\\b").test(b.image.replace(/(^|[.!?]\s+)\S/g, function (x) { return x.toLowerCase(); })); });
      if (hit.length) issues.push({ line: b.start, level: "warn", msg: "IMAGE names " + uniq(hit.map(titleCase)).join(", ") + ". Write " + (hit.length > 1 ? "names" : "the name") + " in caps (" + uniq(hit.map(function (n) { return n.toUpperCase(); })).join(", ") + ") so GASP swaps in the look from the Reference card or the CAST line. Image models don't know who " + titleCase(hit[0]) + " is." });
      if (!b.motion) issues.push({ line: b.start, level: "warn", msg: "No MOTION, so the video gets a generic \"subtle natural motion\"." });
      if (b.seconds && opt.minSeconds && b.seconds < opt.minSeconds) issues.push({ line: b.start, level: "warn", msg: b.seconds + "s is shorter than " + (opt.modelLabel || "the video model") + " makes (" + opt.minSeconds + "s at least). Fold this beat into a longer shot, or trim it in the edit." });
      if (b.seconds && b.seconds > 15) issues.push({ line: b.start, level: "warn", msg: b.seconds + "s is longer than any video model makes in one go (most stop at 10–15s)." });
    });
    if (fixes.length) out = renumber(out);
    issues.sort(function (a, b) { return a.line - b.line; });
    return { text: out, fixes: fixes, issues: issues };
  }

  // GASP keeps two lines at the top of every script: the story's name and the episode. They're rewritten on every save,
  // so renaming the story or episode updates them, and the chat never has to write them.
  function header(story, num, title) { return "STORY: " + story + "\nEPISODE: " + num + (title && !new RegExp("^Episode\\s*0*" + num + "$", "i").test(title) ? " · " + title : ""); }
  function withHeader(text, story, num, title) {
    var L = String(text || "").replace(/\r/g, "").split("\n"), i = 0;
    while (i < L.length && (!L[i].trim() || /^\s*(STORY|EPISODE)\s*:/i.test(L[i]))) i++;
    var body = L.slice(i).join("\n"); if (!body.trim()) return "";
    return header(story, num, title) + "\n\n" + body;
  }
  // CAST: Mother — woman in her thirties, … Father — … (one or several per line) → [{name, look}]
  function castOf(text) {
    var out = [], seen = {};
    String(text || "").replace(/\r/g, "").split("\n").forEach(function (line) {
      var m = line.match(/^\s*CAST\s*:\s*(.+)$/i); if (!m) return;
      m[1].split(/(?:^|[.;])\s+(?=[A-Z][\w'’ .-]{0,30}?\s+[—–-]\s)/).forEach(function (e) {
        var x = e.match(/^\s*([A-Z][\w'’ .-]{0,30}?)\s+[—–-]\s+(.+?)\s*[.;]?\s*$/); if (x && !seen[x[1].toLowerCase()]) { seen[x[1].toLowerCase()] = 1; out.push({ name: x[1].trim(), look: x[2].trim() }); }
      });
    });
    return out;
  }
  // "woman in her thirties, purple hair…" → "woman"; "small child in dungarees" → "small child"
  function lookNoun(look) { var m = String(look || "").match(/^\s*(?:an?\s+|the\s+)?(.*?)(?=\s+(?:in|with|wearing|who|holding|clutching|carrying|of)\b|[,;.(]|$)/i); var n = m ? m[1].trim() : ""; return n.split(/\s+/).length <= 4 ? n : ""; }
  // Names written in CAPS in a prompt (MOTHER, MOTHER'S, TOY SOLDIER) become the look they stand for:
  // the first mention gets the whole look, later ones "the woman". looks = [{names:[…], look, kind}]. short: never the whole look (for MOTION).
  function expandNames(text, looks, short) {
    var list = []; (looks || []).forEach(function (l) { if (!l.look) return; (l.names || []).forEach(function (n) { if (n && n.trim()) list.push({ n: n.trim().toUpperCase(), l: l }); }); });
    list.sort(function (a, b) { return b.n.length - a.n.length; });
    var seen = [], used = [], out = String(text || "");
    list.forEach(function (it) {
      var re = new RegExp("(^|[^A-Za-z0-9])(" + it.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")('S|’S)?(?![A-Za-z0-9])", "g");
      out = out.replace(re, function (all, pre, name, poss, off, str) {
        var l = it.l, isChar = l.kind === "character" || !l.kind, noun = isChar ? lookNoun(l.look) : it.n.toLowerCase(); if (!noun) noun = isChar ? "person" : it.n.toLowerCase();
        var first = seen.indexOf(l) < 0; if (first) seen.push(l); if (used.indexOf(it.n) < 0) used.push(it.n);
        var p = poss ? "'s" : "", look = l.look.replace(/\.\s*$/, ""), lead = new RegExp("^\\s*(?:an?\\s+|the\\s+)?" + noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b[,\\s]*", "i");
        var rest = isChar && lead.test(look) ? look.replace(lead, "") : look;
        var start = /(^|[.!?:]\s*)$/.test(str.slice(0, off) + pre);
        return pre + (start ? "The " : "the ") + noun + p + (first && !short && rest ? " (" + rest + ")" : "");
      });
    });
    return { text: out, used: used };
  }
  return { withHeader: withHeader, castOf: castOf, lookNoun: lookNoun, expandNames: expandNames, parse: parse, lint: lint, setField: setField, setCallout: setCallout, reorder: reorder, removeBlock: removeBlock, insertBlock: insertBlock, renumber: renumber, stampId: stampId, calloutLine: calloutLine, GUIDE: GUIDE, re: { shot: reShot, scene: reScene, field: reField, dialog: reDialog, cue: reCue, id: reId, notNames: NOT_NAMES } };
})();
if (typeof module !== "undefined") module.exports = GASPScript;
