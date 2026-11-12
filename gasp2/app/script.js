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
  var NOT_NAMES = /^(INT|EXT|SCENE|SHOT|CUT TO|FADE IN|FADE OUT|THE END|END|CONTINUED|TITLE)\b/;

  function splitCallout(rest) {
    var id = null, m = rest.match(reId); if (m) { id = m[1]; rest = rest.replace(reId, ""); }
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
    var blocks = [], cur = null, field = null, cue = null, scene = "";
    function close(i) { if (cur) { cur.end = i - 1; while (cur.end > cur.start && !lines[cur.end].trim()) cur.end--; blocks.push(cur); } cur = null; field = null; cue = null; }
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i], t = L.trim(), m;
      if (reScene.test(t)) { close(i); scene = t; continue; }
      if ((m = t.match(reShot)) && !reField.test(t)) {
        close(i); var c = splitCallout(m[1]);
        cur = { start: i, end: i, id: c.id, title: c.title, frame: c.frame, location: c.location, seconds: c.seconds, scene: scene, image: "", motion: "", sfx: [], notes: "", who: "", action: "", lines: [] };
        continue;
      }
      if (!cur) continue;
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
    return { blocks: blocks, characters: characters(lines) };
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
  function stampId(text, block, id) { var L = lines(text); L[block.start] = L[block.start].replace(reId, "") + " [[#" + id + "]]"; return L.join("\n"); }

  var GUIDE = [
    "GASP shot format. Write the script as a screenplay; mark every shot like this:",
    "",
    "SCENE: Beach camp, late morning          (optional scene heading; INT./EXT. also work)",
    "SHOT: Wren sunbathes on the rock · MS · Beach Rock · 5s",
    "IMAGE: what the keyframe shows: who, pose, wardrobe, setting, light, lens. One paragraph.",
    "MOTION: what moves: camera move and action during the shot.",
    "WREN: \"Dialogue goes like this.\"          (or the name on its own line, then the line)",
    "SFX: surf, a gull, leather creaks",
    "NOTE: anything for the director",
    "",
    "Rules: one SHOT line per shot; the title comes first after SHOT:, then optional framing (ECU, CU, MCU, MS, WS, OTS),",
    "location and length (5s). Keep IMAGE prompts self-contained so each works on its own in an image model.",
    "Lines ending in [[#…]] are links GASP adds; keep them when you rewrite a shot.",
  ].join("\n");

  return { parse: parse, setField: setField, setCallout: setCallout, reorder: reorder, removeBlock: removeBlock, insertBlock: insertBlock, renumber: renumber, stampId: stampId, calloutLine: calloutLine, GUIDE: GUIDE, re: { shot: reShot, scene: reScene, field: reField, dialog: reDialog, cue: reCue, id: reId, notNames: NOT_NAMES } };
})();
if (typeof module !== "undefined") module.exports = GASPScript;
