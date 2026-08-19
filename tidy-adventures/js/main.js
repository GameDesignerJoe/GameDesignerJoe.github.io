/* ============================================================
   TIDY ADVENTURES — main module

   Mid-refactor: the leaf modules (config, util, dom, data, validate,
   state, geometry, generate) have been split out; the render, action and
   input tiers still live here. See docs/CLAUDE.md for the target graph.
============================================================ */
import {
  VERSION, SAVE_VERSION, SAVE_KEY, PROGRESS_KEY, DONE_KEY, UNLOCK_KEY, LEGACY_ORDER,
  TALENTS_KEY, SAVE_DEBOUNCE,
  INV_SIZE, DIRS, CHEVRON, ZOOM_TAP, ZOOM_START, REVEAL_MS,
  DOUBLE_TAP_MS, DOUBLE_TAP_SLOP, DRAG_THRESHOLD,
  PINCH_TAP_SUPPRESS_MS, T,
} from './config.js';
import { rnd, tokenise } from './util.js';
/* `el` is aliased: this file has many local `const el = ...` inside render
   functions, and an unaliased import would be shadowed confusingly. */
import {
  $, host, invBar, contGrid, shopBtn, setHidden, el as mkEl,
} from './dom.js';
import { say, bump, flyStar, roomCompleteFX, clearSay } from './feedback.js';
import {
  DATA, LOOKUP, loadData, nameOf, maxLevel,
  itemCount, upgradeParam, upgradeDefaults, jobAt,
} from './data.js';
import { showClient, hideClient, isSpeaking } from './client.js';
import { G, setRun, endRun } from './state.js';
import { itemAt, underAt, onInk, warmMasks, maskStats } from './hit.js';
import {
  findFloorSpot, nearestFloorSpot, unstickFloorItems, inDoorway, spin,
} from './geometry.js';
import { generate } from './generate.js';
import {
  camEl, roomEl, applyCam, clampPan, zoomAt, zoomBy, wheelZoom, panBy,
  resetPan, resetZoom, isZoomed, camScale, setCamSmooth, fitScale,
} from './camera.js';
import {
  initTalents, checkDraftThreshold, drainDrafts, renderTalents, openDraft,
  draftsEarnedFor,
} from './talents.js';
import { initAudio, play as sfx, settings as audioSettings, setVolume, setMuted,
         playMusic, nowPlayingMusic, musicDebug } from './audio.js';
import {
  initQuests, maybeDropNote, openNote, renderObjective, checkQuests, completeQuest,
} from './quests.js';

/* Data must be in hand before anything reads it. Top-level await keeps every
   module below this point free of "is it loaded yet" checks. */
await loadData();
initAudio(DATA.audio);
initQuests({ change(){ renderHUD(); renderObjective(); scheduleSave(); } });

/* Convenience views over the loaded data, so the code below reads the same
   way it did when these were inline literals. */
const UPGRADES = DATA.upgrades.upgrades;
const SIZES    = LOOKUP.sizeById;
const LEVELS   = LOOKUP.levelByIdx;
const NAMES    = LOOKUP.names;

/* ============================================================
   CAMPAIGN PROGRESS — finished job ids, not a count

   It used to be one integer: "how many levels are unlocked", an index into
   levels.json. That made the file APPEND-ONLY, because inserting a level
   silently re-pointed every saved player at a different job — and append-only
   is precisely what stopped a new kind of level ever arriving early.

   Now it is the set of level ids you have finished, plus a FRONTIER: the
   furthest you have ever reached. A level is locked only past the frontier, so
   a job inserted behind it shows up as playable-but-unplayed sitting in a row
   of finished ones, and nothing downstream re-locks. That is what makes
   insertion safe rather than merely possible.
============================================================ */
function doneIds(){
  try{
    const raw=localStorage.getItem(DONE_KEY);
    if(raw!=null) return new Set(JSON.parse(raw));
  }catch(e){}
  /* Nothing under the new key: migrate the old integer through the frozen
     order the campaign had when it was written. Reading it against TODAY's
     levels.json would be the exact bug this whole change exists to avoid. */
  let n=0;
  try{ n=Math.max(0, parseInt(localStorage.getItem(PROGRESS_KEY)||"0",10)||0); }catch(e){}
  const done=new Set(LEGACY_ORDER.slice(0, n));
  if(n>0) saveDone(done);          /* write it through so this runs once */
  return done;
}
function saveDone(set){
  try{ localStorage.setItem(DONE_KEY, JSON.stringify([...set])); }catch(e){}
}
function markDone(id){
  if(!id) return;
  const done=doneIds();
  if(done.has(id)) return;
  done.add(id);
  saveDone(done);
}
function clearDone(){
  saveDone(new Set());
  /* The legacy key would otherwise re-migrate on the next read and undo this. */
  try{ localStorage.removeItem(PROGRESS_KEY); }catch(e){}
}

/* ---------- DEBUG: every job open at once ----------

   THIS MOVES THE GATE, IT DOES NOT MARK ANYTHING DONE, and that distinction is
   the whole design. The obvious implementation — write all 34 ids into
   DONE_KEY — is destructive and irreversible: it overwrites the real record of
   what you have actually played, and there is no way back to it afterwards.
   It also lies to the rest of the game. Every tile would render "done" with a
   ✅, the board would read "34 of 34", the "now" job would fall off the end,
   and every client would be showing their farewell line instead of their arc —
   so the one thing you turned it on to look at, the story, is the thing it
   would hide.

   The frontier is the only thing that locks a tile (see stageState), so
   overriding just the frontier gives you every job playable and every client's
   face revealed while the finished-set stays honest underneath. Turning it off restores
   exactly the progress you had, because nothing was ever written over. */
function debugUnlocked(){
  try{ return localStorage.getItem(UNLOCK_KEY)==="1"; }catch(e){ return false; }
}
function setDebugUnlock(on){
  try{
    if(on) localStorage.setItem(UNLOCK_KEY,"1");
    else localStorage.removeItem(UNLOCK_KEY);
  }catch(e){}
  return debugUnlocked();
}

/* Everything the job board and the level flow need, derived in one place.
   `frontier` is how far you've ever got; `now` is the earliest job you have
   not finished, which after an insertion is the new one. */
function progress(){
  const done=doneIds();
  let frontier=0;
  LEVELS.forEach((lv,i)=>{ if(done.has(lv.id)) frontier=Math.max(frontier, i+1); });
  /* The debug override lands HERE and nowhere else: one assignment, before
     anything derives from it, so the board, the faces, the tile states and the
     replay line all agree without a single one of them knowing about it. */
  const unlocked=debugUnlocked();
  if(unlocked) frontier=LEVELS.length;
  let now=LEVELS.findIndex((lv,i)=> i<=frontier && !done.has(lv.id));
  if(now===-1) now=Math.min(frontier, LEVELS.length);
  return { done, frontier, now, count:done.size, unlocked };
}
function currentCfg(){ return G.mode==="campaign" ? LEVELS[G.levelIdx] : SIZES[G.size]; }
/* "Small" and "Mega" are sizes OF a house, so the word was baked into three
   strings. "Frat House house" and "New the zoo house" are what that turns into
   the moment a preset names a place instead of a size, so the word now comes
   from the preset: house presets keep it, world presets are already a noun. */
function presetName(cfg){
  if(!cfg) return "";
  return cfg.theme && cfg.theme!=="house" ? cfg.label : cfg.label+" house";
}

/* ============================================================
   TEACHING TIPS

   In v3 a tip's `kind` did triple duty — identity, anchor selector, and
   dismiss trigger — which is why a level could never have two tips pointing
   at the same thing, and why tips could only ever be shown at level start.
   They're three fields now:

     kind    identity + save key
     target  what it anchors to
     when    the event that makes it eligible (absent = eligible immediately)
     until   the event that dismisses it (absent = same as kind)

   `when` is the new capability: a tip can now appear in response to
   something the player just did, with the thing they did interpolated into
   the text.
============================================================ */
function tipTarget(t){
  switch(t.target || t.kind){
    case "item": return host.querySelector(".item");
    case "furn": return host.querySelector(".furn:not(.flocked)");
    case "door": return host.querySelector(".door");
    case "lock": return host.querySelector(".door.locked, .furn.flocked");
    case "shop": return document.getElementById("shopBtn");
    case "open": return host.querySelector(".furn:not(.flocked)");
    case "zoom": case "pan": return roomEl();
    case "lastEl": return G.tipCtx.el?.isConnected ? G.tipCtx.el : null;
  }
  return null;
}

const tipById = kind => G.tips.find(t => t.kind === kind);

function tipText(t){
  return tokenise(t.text, { ...textVars(), ...G.tipCtx });
}

function pendingTips(){
  if(!G.active || !G.tips.length) return [];
  /* Sequential: one lesson at a time, and only once its trigger has fired. */
  const t = G.tips.find(t =>
    !G.tipsDone.has(t.kind) && (!t.when || G.events.has(t.when)));
  return t ? [t] : [];
}

function renderTips(){
  const layer=document.getElementById("tipLayer");
  layer.innerHTML="";
  for(const t of pendingTips()){
    const b=document.createElement("div");
    b.className="tip";
    b.dataset.kind=t.kind;
    b.textContent=tipText(t);
    b.style.display="none";
    layer.appendChild(b);
  }
}

/* Is something modal on screen? A client mid-sentence is a modal in every
   respect except the backdrop — and the backdrop is the one thing they must
   not have — so they can't be found by the `.overlay.open` selector and have
   to be asked for by name. */
const modalUp = () => !!document.querySelector(".overlay.open") || isSpeaking();

function positionTips(){
  const layer=document.getElementById("tipLayer");
  if(!layer.children.length) return;
  for(const b of layer.children){
    const t=tipById(b.dataset.kind);
    const el=t && tipTarget(t);
    if(!el || modalUp() || G.openCont!==null){
      b.style.display="none"; continue;
    }
    const r=el.getBoundingClientRect();
    if(r.width===0){ b.style.display="none"; continue; }
    b.style.display="block";
    /* Only a tip the player has actually SEEN can be marked learned. */
    G.tipShown.add(b.dataset.kind);
    const above=r.top>110;
    b.classList.toggle("below",!above);
    b.style.left=Math.max(90,Math.min(window.innerWidth-90, r.left+r.width/2))+"px";
    b.style.top=above ? (r.top-8)+"px" : (r.bottom+8)+"px";
  }
}
export function startTipLoop(){
  (function tipLoop(){ try{ positionTips(); }catch(e){} requestAnimationFrame(tipLoop); })();
}
startTipLoop();

/* Announce that something happened. Makes `when` tips eligible, dismisses
   `until` tips, and stashes context for {token} interpolation. */
function fire(ev, ctx){
  if(!G.active) return;
  if(ctx) Object.assign(G.tipCtx, ctx);
  const fresh = !G.events.has(ev);
  G.events.add(ev);
  for(const t of G.tips){
    if((t.until || t.kind) === ev) tipDone(t.kind);
  }
  if(fresh || ctx) renderTips();
}

function tipDone(kind){
  if(!G.active || G.tipsDone.has(kind)) return;
  const t=tipById(kind);
  if(!t) return;
  /* v3 marked a lesson learned on membership alone, so a gesture credited its
     tip even when a different tip was on screen. On level 2-2 the first drag
     silently ate the pan lesson while the zoom tip was still showing, and the
     pan tip could never appear. Require it to be the ACTIVE tip and to have
     actually been rendered. */
  const active=pendingTips()[0];
  if(!active || active.kind!==kind) return;
  if(!G.tipShown.has(kind)) return;
  G.tipsDone.add(kind);
  renderTips();
  scheduleSave();
}

/* ============================================================
   SAVE / LOAD (works on real hosting; silently skipped if unavailable)
============================================================ */
let saveTimer=null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveGame,SAVE_DEBOUNCE); }
function saveGame(){
  if(!G.active) return;
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v:SAVE_VERSION, rooms:G.rooms, items:G.items, typeHome:G.typeHome, locks:G.locks,
      /* levelId as well as levelIdx: the index is a position in levels.json and
         the id is a name. Appending is safe either way, but if a level is ever
         inserted or reordered the index quietly means a different level, and
         this save would resume the wrong job. */
      /* theme was generated into the run and then dropped on the floor here,
         while loadGame() defaulted it back to "house" — invisible until
         something read it, and then a resumed dream would come back beige. */
      mode:G.mode, levelIdx:G.levelIdx, levelId:(LEVELS[G.levelIdx]?.id ?? null), size:G.size,
      theme:G.theme, rowLen:G.rowLen,
      current:G.current, inv:G.inv, sel:G.sel,
      stats:{tosses:G.stats.tosses, firstGood:G.stats.firstGood, elapsed:Date.now()-G.stats.start},
      visited:[...G.visited], awarded:[...G.awarded], tipsDone:[...(G.tipsDone||new Set())],
      /* draftsTaken is what stops an earned talent draft being handed out
         twice, and it was missing here while ⭐ was written faithfully — so a
         Continue restored "you have 30 lifetime stars" next to "you have never
         drafted", and checkDraftThreshold() dutifully re-owed every draft the
         player had already taken. They arrived one per safe moment, which in
         practice is one every time you close a container. Anything that gates a
         reward has to travel with the score that earns it. */
      points:G.points, starsEarned:G.starsEarned,
      draftsTaken:G.draftsTaken, pendingDrafts:G.pendingDrafts,
      up:G.up,
    }));
  }catch(e){/* storage unavailable in this environment */}
}
/* Does a save exist that this build can actually load? showTitle() used to
   check only that the key existed, so a stale save showed a Continue button
   that failed the moment you pressed it. */
/* The save PARSED BUT NOT LOADED. Enough to put the job you're going back to
   on the Continue button without touching the live run — pressing Continue is
   still what installs it. */
function peekSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const d=JSON.parse(raw);
    return d.v===SAVE_VERSION ? d : null;
  }catch(e){ return null; }
}
const hasSave = () => !!peekSave();
function loadGame(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const d=JSON.parse(raw);
    if(d.v!==SAVE_VERSION) return false;
    /* Resolve the level by NAME first and fall back to the index for saves
       written before ids were stored. A campaign save pointing at a level that
       no longer exists is discarded rather than loaded: it used to load a run
       with no tips and then throw on the win screen, reading `.id` off
       undefined. */
    let levelIdx = d.levelIdx;
    if(d.mode==="campaign"){
      if(d.levelId!=null && LOOKUP.levelIdxById[d.levelId]!=null) levelIdx=LOOKUP.levelIdxById[d.levelId];
      if(!LEVELS[levelIdx]) return false;
    }
    /* Tips come from levels.json, not the save, so editing tip text can't
       corrupt a run in progress. */
    const lv = d.mode==="campaign" ? LEVELS[levelIdx] : null;
    setRun({
      rooms:d.rooms, items:d.items, typeHome:d.typeHome, locks:d.locks,
      rowLen:d.rowLen||5, theme:d.theme||DATA.themes.defaultTheme,
      tips:(lv?.tips||[]).map(t=>({...t})),
      /* Read from levels.json for the same reason as tips, and deliberately not
         saved: turning stars on for a level must take effect on a run already
         in progress rather than waiting for the next one. */
      talents: lv ? lv.talents !== false : true,
      tipsDone:new Set(d.tipsDone||[]),
      tipShown:new Set(d.tipsDone||[]),
      events:new Set(d.events||[]),
      /* The camera is not saved, so a resumed run starts framed. It must still
         be a real {z,x,y} — see the note in js/state.js. */
      current:d.current, cam:{z:ZOOM_START,x:0,y:0},
      inv:d.inv, sel:d.sel, openCont:null,
      stats:{tosses:d.stats.tosses, firstGood:d.stats.firstGood, start:Date.now()-d.stats.elapsed},
      visited:new Set(d.visited),
      awarded:new Set(d.awarded||[]),
      taught:new Set(d.taught||[]),
      roomFxDone:new Set(d.roomFxDone||[]),
      points:d.points||0,
      starsEarned:d.starsEarned??d.points??0,
      /* A save written before draftsTaken existed still has to be settled, and
         the honest reading of one is "they took what their stars earned" —
         they are holding the talents to prove it. Assuming zero is what caused
         the bug in the first place, so it is the one answer this may not give. */
      draftsTaken:d.draftsTaken??draftsEarnedFor(d.starsEarned??d.points??0),
      pendingDrafts:d.pendingDrafts||0,
      up:{...upgradeDefaults(), ...(d.up||{})},
    },{
      mode:d.mode||"free",
      levelIdx:(levelIdx==null?null:levelIdx),
      /* Fall back to the smallest LIVE preset, never null. A save whose preset
         has since been retired kept its rooms and items either way, but a null
         size made currentCfg() undefined and "New house" in the gear threw on
         generate(undefined). */
      size:(SIZES[d.size] ? d.size : (DATA.sizes.sizes[0]?.id ?? null)),
    });
    /* Saves made before doorways were kept clear can hold items parked under
       a door, which are invisible and can't be tapped — and the run can't be
       finished without them. Repair on load rather than bumping SAVE_VERSION
       and throwing the run away. */
    unstickFloorItems(G.rooms, G.items);
    return true;
  }catch(e){ return false; }
}
function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ============================================================
   RULES — completion, not verdicts
============================================================ */
/* Is this the container that emoji lives in? The home lookup is spelled out
   at half a dozen call sites, most of which only have a container INDEX to
   hand; the ones holding the container object itself use this. */
function belongsIn(c, type){
  const home=G.typeHome[type];
  return !!home && home.room===c.roomId && home.cont===c.id;
}

function rowIsComplete(c,row){
  const ids=c.cells[row];
  if(ids.some(v=>v===null)) return false;
  const t=G.items[ids[0]].type;
  if(!ids.every(id=>G.items[id].type===t)) return false;
  return belongsIn(c,t);
}
function containerComplete(c){
  return c.cells.every((_,r)=>rowIsComplete(c,r));
}
function typeCompleteIn(c,type){
  return c.cells.some((ids)=>ids.every(id=>id!==null&&G.items[id].type===type));
}
function roomComplete(room){
  return room.containers.every(containerComplete);
}
function checkWin(){
  return G.rooms.every(roomComplete);
}
function firstEmptyCell(c){
  for(let r=0;r<c.cells.length;r++)
    for(let col=0;col<c.cells[r].length;col++)
      if(c.cells[r][col]===null) return {row:r,col};
  return null;
}
function bestSpot(c,type){
  // 1) a row already holding this type, with space
  for(let r=0;r<c.cells.length;r++){
    const ids=c.cells[r].filter(v=>v!==null);
    if(ids.length && ids.every(x=>G.items[x].type===type)){
      const col=c.cells[r].indexOf(null);
      if(col!==-1) return {row:r,col};
    }
  }
  // 2) the next completely empty row
  for(let r=0;r<c.cells.length;r++)
    if(c.cells[r].every(v=>v===null)) return {row:r,col:0};
  // 3) any free cell (foreign junk crams in wherever)
  return firstEmptyCell(c);
}
function lockFor(roomId, dir){
  const to=G.rooms[roomId].doors[dir];
  if(to===null) return null;
  return G.locks.find(l=>!l.open &&
    ((l.a===roomId&&l.b===to)||(l.b===roomId&&l.a===to))) || null;
}
function insertKey(lockIdx, it, fromSlot){
  fire("lock");
  const lock=G.locks[lockIdx];
  it.loc={kind:"used"};
  if(fromSlot!==undefined && fromSlot!==null){
    G.inv[fromSlot]=null;
    G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
    renderInv();
  }
  lock.have++;
  if(lock.have>=lock.need){
    lock.open=true;
    sfx("unlock"); say("The door creaks open ✨");
  }else{
    /* A key going into a lock that still wants more was completely silent —
       the pips changed and nothing else happened, which reads as a dropped
       input on the one action in the game you have to hunt for the tool to
       perform. `keyInsert` has been sitting in audio.json unplayed for this. */
    sfx("keyInsert");
  }
  renderRoom(); renderHUD();
  if(!lock.open){
    const plate=host.querySelector(`.door.locked[data-lock="${lockIdx}"]`);
    if(plate) plate.classList.add("goldhit");
  }
}
function judgeToss(it, roomId, contIdx){
  G.stats.tosses++;
  if(!it.judged){
    it.judged=true;
    const home=G.typeHome[it.type];
    if(home.room===roomId && home.cont===contIdx) G.stats.firstGood++;
  }
}

function openCache(cacheIdx, it, fromSlot){
  const room=G.rooms[G.current];
  const cache=(room.caches||[])[cacheIdx];
  const ke=host.querySelector(`.cache[data-cache="${cacheIdx}"]`);
  if(!cache || cache.opened) return false;
  if(!it.isCoin){
    bump(ke, "🪙", "A little slot. Something coin-shaped fits it.", "cacheHint");
    return false;
  }
  it.loc={kind:"used"};
  if(fromSlot!==undefined && fromSlot!==null){
    G.inv[fromSlot]=null;
    G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
    renderInv();
  }
  cache.opened=true;
  const cx=cache.slot.x+cache.slot.w/2, cy=cache.slot.y+cache.slot.h/2;
  for(const id of cache.items){
    const o=G.items[id];
    const a=Math.random()*Math.PI*2, d=4+Math.random()*9;
    /* The burst is a scatter, so it aims where it likes and then settles on
       reachable floor — a cache beside a door used to spray items into the
       doorway, where they can't be picked up. */
    const s=nearestFloorSpot(room, cx+Math.cos(a)*d, cy+Math.sin(a)*d, {padName:"toss"});
    o.loc={kind:"floor",room:room.id,x:s.x,y:s.y,rot:spin(25)};
  }
  G.points++; G.starsEarned++;
  sfx("cacheOpen"); say("Pop! The coin box bursts open ✨");
  renderRoom(); renderHUD();
  flyStar(host.querySelector(`.cache[data-cache="${cacheIdx}"]`) || host, "+1 ⭐");
  return true;
}

/* Does this held item open that lock? Matching is by token TYPE, not by
   instance: generation makes exactly one 🗝️ per 🗝️ lock so it plays as
   one-to-one, but two identical keys never behave differently — per-instance
   matching would be invisible to the player and would reintroduce exactly the
   guess-the-key problem the roadmap already ruled out. */
function fitsLock(lock, it){
  if(!lock || !it) return false;
  /* A quest seal has no keyhole — it opens by finishing another container in
     the room. Without this a plain key would satisfy `have >= need` (need is
     0) and pop it open. */
  if(lock.quest) return false;
  return (it.token || (it.isKey ? "key" : null)) === (lock.token || "key");
}

function insertContainerKey(contIdx, it, fromSlot){
  fire("lock");
  const room=G.rooms[G.current], c=room.containers[contIdx];
  it.loc={kind:"used"};
  if(fromSlot!==undefined && fromSlot!==null){
    G.inv[fromSlot]=null;
    G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
    renderInv();
  }
  c.lock.have++;
  if(c.lock.have>=c.lock.need){
    c.lock.open=true;
    sfx("unlock"); say("The "+c.name.toLowerCase()+" clicks open ✨");
  }else{
    /* Same silence as the door version above. Unreachable with today's data —
       a chest is a one-key HUNT (`need: 1` on the skel branch in generate.js),
       so this else never runs — but the two key paths should not disagree
       about whether a partial insert makes a noise, and generate.js still
       carries the multi-key branch for when `skel` is absent. */
    sfx("keyInsert");
  }
  renderRoom(); renderHUD();
  const fe=host.querySelector(`.furn[data-cont="${contIdx}"]`);
  if(fe) fe.classList.add("goldhit");
}

/* ============================================================
   RENDER
   `host` now comes from dom.js — it used to be declared here, below
   tipTarget() which reads it, which only worked because the tip loop's
   try/catch swallowed the temporal-dead-zone throw on the first frame.
============================================================ */

/* HOMESICK. Does this item have a home in this room that could take it right
   now? Measured across 180 generated rooms, a quarter of what's lying on any
   given floor lives in that room — so this lights about 25% of the clutter,
   which is a signal rather than a wash. The useful half is the inverse: the
   other 75% is stuff you are going to have to carry somewhere, and until now
   the only way to learn that was to pick each piece up and ask.

   "Could take it right now" is the literal reading, and the honest one: a
   locked chest or a full one glows for nothing, because you cannot act on it. */
function homesick(room, it){
  if(!G.up.homesick) return false;
  if(it.isKey||it.isCoin||it.isNote||it.token) return false;
  const h=G.typeHome[it.type];
  if(!h || h.room!==room.id) return false;
  const c=room.containers[h.cont];
  if(!c || (c.lock && !c.lock.open)) return false;
  return !!bestSpot(c, it.type);
}

function buildRoomEl(room){
  const el=document.createElement("div");
  /* A finished room turns its own walls gold — see .room.done in room.css.
     This replaced dropping a decorative prop on the floor, which read as
     clutter you were not allowed to tidy. */
  el.className="room shape-"+(room.shape||"rect")+(roomComplete(room)?" done":"");
  const sw=room.sw||1, sh=room.sh||1;
  el.style.width=(sw*100)+"%";
  el.style.height=(sh*100)+"%";
  /* Doors and their labels are sized in real pixels, but the camera scales
     the whole room to fill the stage — so a small room magnified 3x got
     doors three times the size of a big room's. Dividing their px sizes by
     the fit scale keeps them the same on screen whatever the room. Zoom
     still enlarges them, which is what you want. */
  el.style.setProperty("--fit", fitScale(room).toFixed(4));
  el.innerHTML=`<div class="floor floor-${room.floor}"></div>`;
  for(const [dir,to] of Object.entries(room.doors)) if(to!==null){
    const d=document.createElement("div");
    const lock=lockFor(room.id,dir);
    if(lock){
      d.className="door locked "+dir;
      d.dataset.lock=G.locks.indexOf(lock);
      /* Show the key the lock actually wants, not a generic 🔒, so the
         requirement is always legible — no guess-the-key. */
      const ic=document.createElement("span");
      ic.textContent=LOOKUP.tokenById[lock.token||"key"]?.emoji || "🔒";
      const pips=document.createElement("div"); pips.className="pips";
      for(let i=0;i<lock.need;i++){
        const p=document.createElement("i");
        if(i<lock.have) p.classList.add("full");
        pips.appendChild(p);
      }
      d.appendChild(ic); d.appendChild(pips);
    }else{
      /* Doors into rooms you haven't been in yet breathe gold. Free
         wayfinding, and it gives the chevron something to say. */
      d.className="door "+dir+(G.visited.has(to)?"":" unvisited");
      d.textContent=CHEVRON[dir];
    }
    el.appendChild(d);
    const lab=document.createElement("div");
    lab.className="doorlab "+dir;
    lab.textContent=G.rooms[to].name;
    el.appendChild(lab);
  }
  for(const c of room.containers){
    const s=c.slot;
    const f=document.createElement("div");
    const locked=c.lock && !c.lock.open;
    const done=containerComplete(c);
    let sense="";
    /* Don't point at a container that's locked or already finished — there's
       nothing you can do with the hint, and on a finished one it competes
       with the gold that means "done". */
    if(G.up.sense && !locked && !done && G.sel!==null && G.inv[G.sel]!==null){
      const held=G.items[G.inv[G.sel]];
      if(!held.isKey && !held.isCoin && !held.isNote){
        const home=G.typeHome[held.type];
        if(home && home.room===room.id && home.cont===c.id) sense=" sense";
      }
    }
    f.className="furn k-"+c.kind+(locked?" flocked":"")+(done&&!locked?" aura":"")+sense;
    f.dataset.cont=c.id;
    f.style.cssText=`left:${s.x}%;top:${s.y}%;width:${s.w}%;height:${s.h}%;`;
    const badges=document.createElement("div"); badges.className="badges";
    if(locked){
      /* Show the key this lock actually wants rather than a generic 🔒, so
         the requirement is legible at a glance — no guess-the-key. A quest
         seal wants no key at all, so it gets its own mark. */
      /* A quest seal must NOT look like a keyhole. Showing a padlock on it
         sent me hunting for a key that by design does not exist. It gets an
         hourglass and a dashed edge; a real lock keeps the key emoji and a
         solid one. */
      const ic=document.createElement("span");
      ic.textContent=c.lock.quest ? "⏳"
        : (LOOKUP.tokenById[c.lock.token||"key"]?.emoji || "🔒");
      badges.appendChild(ic);
      if(c.lock.quest) f.classList.add("fsealed");
      /* A single-key lock needs no pip strip; the emoji says it all. */
      if(c.lock.need>1){
        const pips=document.createElement("div"); pips.className="pips";
        for(let i=0;i<c.lock.need;i++){
          const p=document.createElement("i");
          if(i<c.lock.have) p.classList.add("full");
          pips.appendChild(p);
        }
        badges.appendChild(pips);
      }
    }else{
      /* Badge strip: unique types inside, gold if that set is complete, red
         if the type doesn't live here at all — so a container holding
         somebody else's things says so from across the room, without being
         opened. */
      const inside=new Set();
      for(const rowIds of c.cells) for(const id of rowIds) if(id!==null) inside.add(G.items[id].type);
      for(const t of inside){
        const sp=document.createElement("span");
        sp.textContent=t;
        if(!belongsIn(c,t)) sp.classList.add("wrong");
        else if(typeCompleteIn(c,t)) sp.classList.add("gold");
        badges.appendChild(sp);
      }
    }
    f.appendChild(badges);
    const lbl=document.createElement("div"); lbl.className="flabel";
    /* The full name. `short` is still in rooms.json and still used where space
       is genuinely tight (the objective strip, bump messages), but a face
       reading "SINK" when the thing is the Under the Sink cupboard is just
       worse — the label wraps to two lines instead. */
    lbl.textContent=c.name;
    f.appendChild(lbl);
    el.appendChild(f);
  }
  for(const k of (room.caches||[])){
    if(k.opened) continue;
    const ke=document.createElement("div");
    ke.className="cache";
    ke.dataset.cache=k.id;
    ke.style.cssText=`left:${k.slot.x}%;top:${k.slot.y}%;width:${k.slot.w}%;height:${k.slot.h}%;`;
    ke.innerHTML=`<span class="cico">🪙</span><span class="slotline"></span>`;
    el.appendChild(ke);
  }
  /* Tokens go down FIRST so the clutter paints over them — that ordering is
     the entire burial, since every item shares a z-index. A key under a pile
     is behind it, which is what makes finding one a matter of clearing the
     pile rather than scanning for the shiniest emoji on the floor. Generation
     drops keys into the clutter on purpose — see generate.js. */
  const floorItems=Object.values(G.items)
    .filter(it=>it.loc.kind==="floor" && it.loc.room===room.id && !it.flying)
    .sort((a,b)=>(a.token?0:1)-(b.token?0:1));
  for(const it of floorItems){
    const sp=document.createElement("div");
    sp.className="item"+(it.token?" buried":"")+(G.reveal&&it.token?" revealed":"")
      +(homesick(room, it)?" homesick":"");
    sp.dataset.item=it.id;
    sp.textContent=it.type;
    /* The glyph is drawn at --item-size directly; the only scale() an item
       ever carries is the pick-up lift. See css/items.css. */
    sp.style.cssText=`left:${it.loc.x}%;top:${it.loc.y}%;transform:${itemTransform(it)};`;
    el.appendChild(sp);
  }
  return el;
}

/* #roomHost > .cam > .room — the camera owns zoom/pan, the room owns the
   slide and bounce animations. They shared one transform in v3, which is why
   bounce() had to repair the camera afterwards.

   Nothing here lifts a hidden key out of the pile. That existed briefly and is
   gone on purpose: keys are buried, finding them is the hunt, and the clutter
   covering one is clutter you have to pick up anyway. "Debug: where are the
   keys" in the gear is the way to check a level, not a rule in the renderer. */
function renderRoom(){
  host.innerHTML="";
  const cam=document.createElement("div");
  cam.className="cam smooth";
  cam.appendChild(buildRoomEl(G.rooms[G.current]));
  host.appendChild(cam);
  applyCam();
  /* Measure this room's glyphs while the browser is idle, so the cost never
     lands on the first tap. Cheap and idempotent — masks are cached by emoji,
     so re-entering a room measures nothing. See js/hit.js. */
  warmMasks(host);
}

function render(){
  applyTheme();
  renderRoom();
  renderHUD();
  renderInv();
  renderTips();
  renderObjective();
  if(G.openCont!==null) renderContainer();
}

/* THE ONLY PLACE THE THEME REACHES THE SCREEN.

   A room element carries `shape-*` and `floor-*` and nothing else, so until
   now the theme was generated, saved and then never looked at — two houses
   and a dream all painted the same beige. One attribute on <body> lets
   css/themes.css repoint --bg, --wall and --wall-dark, which between them own
   the walls of all three room shapes, the door surround, the door glow and
   the page behind everything.

   Chrome tokens (--panel, --ink, --gold) are deliberately NOT themed: the
   HUD, the gear and the job board should be the one thing that stays put
   while the world changes underneath them. */
function applyTheme(){
  const t = G.active ? (G.theme || DATA.themes.defaultTheme) : "";
  if(t) document.body.dataset.theme = t;
  else delete document.body.dataset.theme;
}

function slideTo(dir,newId){
  const old=roomEl();
  const [dx,dy]=DIRS[dir];
  const hr=host.getBoundingClientRect();
  const px=dx*(hr.width+80), py=dy*(hr.height+80);
  G.current=newId; G.visited.add(newId);
  fire("door");
  sfx("door");
  /* Keep the player's zoom through a door; only recentre the pan. Resetting
     zoom on every transition is what made zoom feel disposable. */
  resetPan(); applyCam();
  const neu=buildRoomEl(G.rooms[newId]);
  neu.style.transition="none";
  neu.style.transform=`translate(${px}px, ${py}px)`;
  camEl().appendChild(neu);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    old.style.transition="transform .32s ease";
    neu.style.transition="transform .32s ease";
    old.style.transform=`translate(${-px}px, ${-py}px)`;
    neu.style.transform="translate(0,0)";
    setTimeout(()=>{ old.remove(); neu.style.transition=""; },340);
  }));
  renderHUD();
}

function bounce(dir){
  const el=roomEl();
  if(!el) return;
  const [dx,dy]=DIRS[dir];
  el.style.transition="transform .1s ease";
  el.style.transform=`translate(${dx*14}px, ${dy*14}px)`;
  setTimeout(()=>{
    el.style.transform="";
    setTimeout(()=>{el.style.transition="";el.style.transform="";},120);
  },100);
}

/* The HUD's "N left", extracted so the Continue card can ask the same question
   of a SAVE it has not loaded — peekSave() parses the run without installing it,
   which is the whole point of that function, and a second copy of this filter
   would be a second definition of the only number the player watches. */
function itemsLeft(items, typeHome){
  return Object.values(items||{}).filter(i=>{
    if(i.isKey || i.isCoin || i.isNote || i.loc.kind==="used") return false;
    if(i.loc.kind!=="cell") return true;
    const home=(typeHome||{})[i.type];
    return !home || i.loc.room!==home.room || i.loc.cont!==home.cont;
  }).length;
}

function renderHUD(){
  const room=G.rooms[G.current];
  const done=roomComplete(room);
  const rn=$("#roomName");
  rn.classList.toggle("done",done);
  rn.innerHTML=`${room.name}<small>${done?"all tidy ✨":"swipe through doors"}</small>`;
  /* "N left" means items not yet in the container they belong in — so it ticks
     down on EVERY correct placement.

     It used to count an item as away only once its whole ROW was complete,
     which meant four placements moved nothing and the fifth dropped the number
     by five. The information was real (a part-filled row isn't finished) but it
     read as a counter that had stopped working.

     Keys, coins and notes are excluded, because they are not things you put
     away — they're spent. Counting them meant a finished house could still say
     "2 left" over a spare key. This is now the same set showWin() reports, so
     the counter reaches exactly 0 as the win screen appears. */
  $("#remaining").textContent=itemsLeft(G.items, G.typeHome)+" left";
  $("#shopBtn").textContent="⭐ "+G.points;
  drawMinimap();
  scheduleSave();
}


function drawMinimap(){
  const cv=$("#minimap canvas"), ctx=cv.getContext("2d");
  ctx.clearRect(0,0,cv.width,cv.height);
  const cell=14, pad=3;
  ctx.strokeStyle="#5a4a33"; ctx.lineWidth=3;
  for(const r of G.rooms) for(const [dir,to] of Object.entries(r.doors)) if(to!==null){
    const t=G.rooms[to];
    ctx.beginPath();
    ctx.moveTo(pad+r.gx*cell+cell/2, pad+r.gy*cell+cell/2);
    ctx.lineTo(pad+t.gx*cell+cell/2, pad+t.gy*cell+cell/2);
    ctx.stroke();
  }
  for(const l of G.locks) if(!l.open){
    const a=G.rooms[l.a], b=G.rooms[l.b];
    const mx=pad+(a.gx+b.gx)/2*cell+cell/2, my=pad+(a.gy+b.gy)/2*cell+cell/2;
    ctx.fillStyle="#17110b";
    ctx.fillRect(mx-3,my-3,6,6);
    ctx.strokeStyle="#f5c542"; ctx.lineWidth=1;
    ctx.strokeRect(mx-3,my-3,6,6);
    ctx.strokeStyle="#5a4a33"; ctx.lineWidth=3;
  }
  for(const r of G.rooms){
    ctx.fillStyle = roomComplete(r) ? "#f5c542" : (G.visited.has(r.id)?"#b9a88d":"#5a4a33");
    ctx.beginPath();
    ctx.roundRect(pad+r.gx*cell+2, pad+r.gy*cell+2, cell-4, cell-4, 3);
    ctx.fill();
    if(r.id===G.current){
      ctx.strokeStyle="#f3e9d8"; ctx.lineWidth=2;
      ctx.strokeRect(pad+r.gx*cell+1, pad+r.gy*cell+1, cell-2, cell-2);
      ctx.strokeStyle="#5a4a33"; ctx.lineWidth=3;
    }
  }
}

function renderInv(){
  const bar=$("#invBar");
  bar.querySelectorAll(".slot").forEach(s=>s.remove());
  const n=G.inv.length;
  const size=n>6 ? Math.max(38, Math.floor((Math.min(window.innerWidth,760)-30-(n-1)*8)/n)) : 56;
  G.inv.forEach((id,i)=>{
    const s=document.createElement("div");
    s.className="slot"+(G.sel===i?" sel":"");
    s.dataset.slot=i;
    s.textContent=id!==null?G.items[id].type:"";
    if(size!==56){
      s.style.width=size+"px"; s.style.height=size+"px";
      s.style.fontSize=Math.floor(size*.55)+"px";
    }
    bar.appendChild(s);
  });
  const lbl=$("#handLabel");
  if(G.sel!==null && G.inv[G.sel]!==null){
    const it=G.items[G.inv[G.sel]];
    lbl.textContent=(NAMES[it.type]||"")+senseSuffix(it);
  }else lbl.textContent="";
}

function senseSuffix(it){
  if(!G.up.sense) return "";
  if(it.token==="skel") return " → one specific lock";
  if(it.isKey) return " → a lock";
  if(it.isCoin) return " → a coin slot";
  const home=G.typeHome[it.type];
  const hr=G.rooms[home.room];
  const hc=hr.containers[home.cont];
  return " → "+hc.name+(home.room!==G.current?" ("+hr.name+")":"");
}

function renderContainer(flashRows){
  const room=G.rooms[G.current], c=room.containers[G.openCont];
  $("#contTitle").textContent=room.name+" · "+c.name;
  const grid=$("#contGrid"); grid.innerHTML="";
  const rows=c.cells.length;
  const len=G.rowLen||5;
  const size=Math.max(26,Math.min(60,
    Math.floor((window.innerHeight-330)/rows)-12,
    Math.floor(window.innerWidth*(0.72/len))));
  grid.style.setProperty("--cell",size+"px");
  grid.style.gridTemplateRows=`repeat(${rows},1fr)`;
  for(let r=0;r<rows;r++){
    const rowEl=document.createElement("div");
    rowEl.className="crow"+(rowIsComplete(c,r)?" done":"");
    if(flashRows && flashRows.includes(r)) rowEl.classList.add("flash");
    rowEl.dataset.row=r;
    rowEl.style.gridTemplateColumns=`repeat(${c.cells[r].length},1fr)`;
    for(let col=0;col<c.cells[r].length;col++){
      const cell=document.createElement("div");
      cell.className="cell"; cell.dataset.row=r; cell.dataset.col=col;
      const id=c.cells[r][col];
      if(id!==null){
        cell.textContent=G.items[id].type;
        /* A faint red wash on anything that doesn't live here. Before this,
           foreign junk was indistinguishable from a correctly-filed item once
           the cold shake had played — you had to open the container, read
           every emoji and remember the taxonomy to find what didn't belong.
           The state is permanent because the mistake is: it stays wrong until
           you take it out. */
        if(!belongsIn(c, G.items[id].type)) cell.classList.add("wrong");
      }
      rowEl.appendChild(cell);
    }
    grid.appendChild(rowEl);
  }
  $("#contView").classList.add("open");
}

/* ============================================================
   CELEBRATIONS — one beat at a time, and never behind the panel

   Finishing a container is almost always finishing a ROW as well, and
   sometimes the ROOM, the QUEST and the RUN too — all inside the same
   millisecond. Four sounds played over each other, four messages queued at
   once, and the room's gold ripple ran underneath the open container panel,
   where the player could not see the biggest moment the game has. (It was
   also cancelling itself: roomCompleteFX() decorated the room element and the
   very next line rebuilt that element.)

   So the endings are a queue. One beat plays, then the next, and a beat
   marked `inRoom` waits until the container panel is out of the way. A
   finished container closes its own panel, because there is nothing left
   inside it to do — which is what gets the room's moment on screen.
============================================================ */
const beats=[];
let beatBusy=false;

function celebrate(beat){
  /* Already queued? Once is a celebration, twice is noise. One Trip at level 2
     can finish several rows in a single put-away. */
  if(beat.key && beats.some(b=>b.key===beat.key)) return;
  beats.push(beat);
  playBeats();
}

function playBeats(){
  if(beatBusy || !beats.length) return;
  if(!G.active){ beats.length=0; return; }
  /* The room's moments wait for the room to be visible. */
  if(beats[0].inRoom && G.openCont!==null) return;
  const b=beats.shift();
  beatBusy=true;
  /* `hold` beats end when they say so, not when a timer says so — a person
     talking takes as long as the player takes to read. Everything else keeps
     its exact timing. `settled` makes done() idempotent, so a beat that both
     calls it and throws can't run the queue twice. */
  let settled=false;
  const done=()=>{ if(settled) return; settled=true; beatBusy=false; playBeats(); };
  try{ b.run(done); }
  catch(err){
    console.error("[Tidy Adventures] celebration beat failed", err);
    if(b.hold) done();
  }
  if(!b.hold) setTimeout(done, b.ms ?? 350);
}

/* Nothing may interrupt a celebration — least of all a talent draft, which is
   itself a celebration and was landing on top of these. */
const celebrating = () => beatBusy || beats.length>0;
function clearBeats(){ beats.length=0; beatBusy=false; }

/* ============================================================
   ACTIONS
============================================================ */

function afterMutation(room, c, changedRows, opts={}){
  const newly=changedRows.filter(r=>rowIsComplete(c,r));
  let earned=0;
  for(const r of newly){
    const k=room.id+"|"+c.id+"|"+r;
    if(!G.awarded.has(k)){ G.awarded.add(k); G.points++; earned++; }
  }
  const contDone=containerComplete(c);
  G.starsEarned+=earned;

  /* Rewards fly to the ⭐ rather than printing a sentence: it reads without
     reading, and it teaches where stars accumulate. The gold flash on the
     container is already saying "complete". Immediate, not queued — this one
     is the receipt for the tap that just happened. */
  if(earned){
    const fe=host.querySelector(`.furn[data-cont="${c.id}"]`) || contGrid;
    flyStar(fe, "+"+earned+" ⭐");
  }
  if(contDone){
    celebrate({key:"cont", ms:620, run(){ sfx("contComplete"); }});
    fire("contComplete", {container:c.short||c.name});
    /* First container finished in a room? Someone leaves you a note, and
       the room's sealed container opens. The note drops now — that's state —
       but its arrival gets its own beat. */
    if(maybeDropNote(room, c)) celebrate({ms:420, run(){ sfx("unlock"); renderRoom(); }});
    /* A complete container holds nothing you can act on, so the panel bows
       out and stops standing in front of whatever the room does next. */
    celebrate({ms:300, run(){
      if(G.openCont===c.id && G.current===room.id) closeCont();
    }});
  }
  else if(newly.length) celebrate({key:"row", ms:280, run(){ sfx("rowComplete"); }});
  if(newly.length) fire("rowComplete", {container:c.short||c.name});

  /* Room completion is the biggest moment in the game and v3 marked it with
     a 1400ms toast. Now the gold visibly travels outward from the centre —
     and waits for the panel, so it is actually watched. */
  if(roomComplete(room) && !G.roomFxDone.has(room.id)){
    G.roomFxDone.add(room.id);
    fire("roomComplete", {room:room.name});
    celebrate({key:"room"+room.id, ms:1500, inRoom:true, run(){
      /* Repaint FIRST so the walls are gold and the element is the one that
         stays, THEN decorate it. The old order drew the ripple onto an
         element that renderRoom() threw away on the next line. */
      renderRoom();
      sfx("roomComplete");
      roomCompleteFX(roomEl());
      say(room.name+" is all tidy ✨", {priority:2});
    }});
  }
  const finishedQuest=checkQuests();
  if(finishedQuest) celebrate({ms:900, run(){ completeQuest(finishedQuest); }});
  renderHUD();
  checkDraftThreshold();
  if(checkWin()){
    /* The client comes back to thank you — after the room's gold, before the
       win screen, because the queue plays in emission order and the win beat
       can't start while this one holds.

       NOT inRoom, deliberately. playBeats() has no retry timer, so an inRoom
       beat reaching the head with the container panel still open would park
       the queue behind itself — including the win beat that would have closed
       the panel. It closes the panel itself instead, exactly as the win beat
       below already does. */
    const job=G.mode==="campaign" ? jobAt(G.levelIdx) : null;
    const outro=job?.stage.outro || [];
    if(outro.length){
      celebrate({key:"outro", hold:true, run(done){
        if(G.openCont!==null) closeCont();
        showClient(job.client.emoji, outro, {side:"left", onDone:done});
      }});
    }
    /* The run is over: there is nothing left to sort, so the panel is closed
       for the player instead of making them dismiss it to reach the ending. */
    celebrate({key:"win", ms:0, run(){
      if(G.openCont!==null) closeCont();
      showWin();
    }});
  }
  else maybeDraft();
  return newly;
}

function pickUp(itemId){
  const slot=G.inv.indexOf(null);
  if(slot===-1){ bump(invBar, "✋", "Your hands are full — put something away first", "handsFull"); sfx("locked"); return; }
  const it=G.items[itemId];
  const sx=it.loc.x, sy=it.loc.y;
  it.loc={kind:"inv",slot};
  /* A note isn't cargo — reading it consumes it, so it never occupies a
     hand slot the player needs for actual hauling. */
  if(it.isNote){
    it.loc={kind:"used"};
    sfx("uiTap");
    renderRoom();
    openNote(it.noteId);
    return;
  }
  G.inv[slot]=it.id;
  if(G.sel===null) G.sel=slot;
  sfx(it.isKey||it.isCoin ? "keyPickup" : "pickup");
  fire("pickUp");
  /* Magnet Fingers used to fire here, sweeping up matching items within 14% of
     the room. It was true 8.1% of the time. It now fires on put-away instead —
     see cascade(). */
  render();
}

function tapSlot(i){
  if(G.inv[i]===null) return;
  G.sel = (G.sel===i) ? null : i;
  renderInv();
  if(G.up.sense) renderRoom();
}

/* ============================================================
   THE CASCADE — One Trip and Magnet Fingers

   Both talents answer the same complaint from the notes doc: filing is done
   one item at a time even when the next five are obviously the same errand.
   They fire at the same moment (a correct placement) and differ only in where
   they reach:

     One Trip       your HANDS. Level 1 takes the same kind, level 2 takes
                    anything you're carrying that lives in this container.
     Magnet Fingers the FLOOR of this room, `pull` items of the filed kind per
                    level.

   Only on a CORRECT placement, deliberately. A wrong drop is information — the
   grey shake is how the game teaches where things live — and cascading five
   more items into the wrong home would turn one mistake into six, then make
   the player undo all of them. Getting it right is what pays.

   Returns how many extra items it filed, so the caller can say so.
============================================================ */
function cascade(room, c, contIdx, type){
  const filed=[];
  const put=o=>{
    const spot=bestSpot(c, o.type);
    if(!spot) return false;                 /* container full: stop, quietly */
    c.cells[spot.row][spot.col]=o.id;
    o.loc={kind:"cell",room:room.id,cont:c.id,row:spot.row,col:spot.col};
    judgeToss(o, room.id, contIdx);
    filed.push(spot.row);
    return true;
  };
  const livesHere=o=>{
    const h=G.typeHome[o.type];
    return h && h.room===room.id && h.cont===contIdx;
  };

  /* ---- One Trip: out of your hands ---- */
  if(G.up.oneTrip){
    for(let s=0;s<G.inv.length;s++){
      const id=G.inv[s];
      if(id===null) continue;
      const o=G.items[id];
      if(o.isKey||o.isCoin||o.isNote) continue;
      /* Level 1 is "and the others like it"; level 2 is "and everything else
         that lives in this drawer". Level 2 is the one the doc asked for;
         level 1 exists so the talent has somewhere to grow from. */
      const want = G.up.oneTrip>=2 ? livesHere(o) : (o.type===type && livesHere(o));
      if(!want) continue;
      if(!put(o)) break;
      G.inv[s]=null;
    }
    G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
  }

  /* ---- Magnet Fingers: off the floor of this room ---- */
  if(G.up.magnet){
    const budget=G.up.magnet*upgradeParam("magnet","pull",1);
    const loose=Object.values(G.items)
      .filter(o=>o.loc.kind==="floor" && o.loc.room===room.id && o.type===type)
      /* Nearest first, so what flies home is what you could see — the talent
         reads as a tug on the pile you are standing in, not teleportation
         from a room-corner you have never looked at. */
      .sort((a,b)=>Math.hypot(a.loc.x-50,a.loc.y-50)-Math.hypot(b.loc.x-50,b.loc.y-50))
      .slice(0,budget);
    for(const o of loose) if(!put(o)) break;
  }

  return filed;
}

/* toss an item into a piece of furniture: first empty slot, no logic */
function tossInto(it, contIdx, fromSlot){
  const room=G.rooms[G.current], c=room.containers[contIdx];
  const fe=host.querySelector(`.furn[data-cont="${contIdx}"]`);
  if(c.lock && !c.lock.open){
    if(fitsLock(c.lock, it)){ insertContainerKey(contIdx, it, fromSlot); return true; }
    if(it.isKey||it.isCoin){
      const want=LOOKUP.tokenById[c.lock.token||"key"];
      bump(fe, want?.emoji||"🔒", "This one wants "+(want?.name||"a key").toLowerCase()+" — "+(want?.emoji||"🔑"), "wrongToken");
      return false;
    }
    if(fe) fe.classList.add("fullhit");
    bump(fe, "🔒", "That one's locked. Feed it keys to open it.", "locked");
    return false;
  }
  if(it.isKey||it.isCoin){
    if(fe) fe.classList.add("fullhit");
    bump(fe, it.isCoin?"🪙":"🔑", it.isCoin?"Coins go in coin slots, not furniture.":"Keys go in locks, not furniture.", it.isCoin?"coinUse":"keyUse");
    return false;
  }
  const spot=bestSpot(c, it.type);
  if(!spot){
    if(fe) fe.classList.add("fullhit");
    bump(fe, "🚫", "That one's full — finish sorting what's inside.", "contFull");
    return false;
  }
  c.cells[spot.row][spot.col]=it.id;
  it.loc={kind:"cell",room:room.id,cont:c.id,row:spot.row,col:spot.col};
  if(fromSlot!==undefined && fromSlot!==null){
    G.inv[fromSlot]=null;
    G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
    renderInv();
  }
  const home=G.typeHome[it.type];
  const right=home.room===room.id && home.cont===contIdx;
  judgeToss(it, room.id, contIdx);
  /* The talents ride along BEFORE afterMutation, so the rows they complete are
     in the same batch as the row you completed by hand: one gold flash, one
     "+3 ⭐" chip, one celebration. Paying them out separately would turn one
     satisfying put-away into a stutter of three. */
  const extra = right ? cascade(room, c, contIdx, it.type) : [];
  /* Deduped: two cascaded items can land in the same row, and afterMutation
     would then look at that row twice. G.awarded stops it paying twice either
     way, but the celebration counts off this list. */
  afterMutation(room,c,[...new Set([spot.row,...extra])]);
  if(extra.length){
    /* `whirlwind` lost its call site when the Whirlwind talent went, and it is
       a whoosh — which is exactly what a handful of things flying home sounds
       like. The same sound, at the moment it was always describing. */
    sfx("whirlwind");
    /* Count, not type: One Trip at level 2 files a whole mixed armful, so
       "Onion ×4" would be a lie. */
    say("+"+extra.length+" more put away ✨", {key:"cascade"});
    renderInv();
    /* The panel can be open on the very container we just poured into — the
       room's furniture is still reachable around the edges of it. One item
       landing was survivable to miss; a cascade landing five is not. */
    if(G.openCont===c.id) renderContainer();
  }
  renderRoom();
  const fe2=host.querySelector(`.furn[data-cont="${contIdx}"]`);
  if(fe2) fe2.classList.add(right?"goldhit":"pophit");
  /* After renderRoom, so `lastEl` anchors to the element that's on screen now.
     Two layers, and they say different things: the toss is the item landing,
     which happens either way; gold/cold is the verdict on top of it. Until the
     recordings arrived only the verdict played, so a placement had no body. */
  sfx("toss");
  sfx(right ? "gold" : "cold");
  fire("place", {container:c.short||c.name, item:nameOf(it.type), el:fe2});
  if(right) fire("goldPlace", {container:c.short||c.name, el:fe2});
  return true;
}

/* Returns how many items it shoved, so the caller can make a noise only when
   something actually clattered. Landing on bare floor should sound like
   landing on bare floor. */
function displaceAround(roomId,x,y,radius,push){
  radius=radius||13; push=push||9;
  let moved=0;
  for(const o of Object.values(G.items)){
    if(o.loc.kind!=="floor"||o.loc.room!==roomId) continue;
    const dx=o.loc.x-x, dy=o.loc.y-y;
    const d=Math.hypot(dx,dy);
    if(d>radius) continue;
    let ux,uy,f;
    if(d<0.5){
      // stacked or nearly stacked: burst apart in a random direction
      const a=Math.random()*Math.PI*2;
      ux=Math.cos(a); uy=Math.sin(a); f=push*(0.6+Math.random()*0.4);
    }else{
      ux=dx/d; uy=dy/d; f=(radius-d)/radius*push;
    }
    o.loc.x=Math.max(3,Math.min(96,o.loc.x+ux*f));
    o.loc.y=Math.max(3,Math.min(96,o.loc.y+uy*f));
    o.loc.rot=(o.loc.rot||0)+(Math.random()*30-15);
    /* Shoving something into a doorway hides it under the door. Only that
       case is corrected — an item nudged up against a cupboard is still
       perfectly visible and pickable, and dragging those out too would make
       every landing rearrange half the floor. */
    if(inDoorway(G.rooms[roomId], o.loc.x, o.loc.y)){
      const s=nearestFloorSpot(G.rooms[roomId], o.loc.x, o.loc.y, {padName:"toss"});
      o.loc.x=s.x; o.loc.y=s.y;
    }
    moved++;
  }
  /* `scatter` has existed in audio.json since the first pass and nothing has
     ever played it. This is the moment it was written for — the brief calls it
     "3-4 items clattering apart". */
  if(moved) sfx("scatter");
  return moved;
}

function animateFlight(type, fromX, fromY, toX, toY, done){
  const fl=document.createElement("div");
  fl.textContent=type;
  const spin=(Math.random()<.5?-1:1)*(360+rnd(360));
  fl.style.cssText=`position:fixed;left:${fromX}px;top:${fromY}px;z-index:220;
    font-size:34px;line-height:1;pointer-events:none;
    transform:translate(-50%,-50%) rotate(0deg);
    filter:drop-shadow(0 8px 10px rgba(0,0,0,.45));
    transition:left .42s cubic-bezier(.2,.55,.4,1), top .42s cubic-bezier(.35,.1,.55,1), transform .42s linear;`;
  document.body.appendChild(fl);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    fl.style.left=toX+"px";
    fl.style.top=toY+"px";
    fl.style.transform=`translate(-50%,-50%) rotate(${spin}deg)`;
  }));
  setTimeout(()=>{ fl.remove(); done&&done(); },440);
}

function roomPctToScreen(x,y){
  const rect=roomEl().getBoundingClientRect();
  return [rect.left+rect.width*x/100, rect.top+rect.height*y/100];
}
/* The other direction. The camera's scale and pan are already baked into the
   room's client rect, so nothing here needs to know about zoom. */
function screenToRoomPct(cx,cy){
  const rect=roomEl().getBoundingClientRect();
  return [(cx-rect.left)/rect.width*100, (cy-rect.top)/rect.height*100];
}

/* How an item on the floor is drawn. It was written out at each of the three
   places that move one, which is how a dragged item could keep a stale
   `scale()` after it was put down. `held` is the pick-up lift. */
function itemTransform(it, held){
  return `translate(-50%,-50%) rotate(${it.loc.rot||0}deg)`+(held?" scale(1.12)":"");
}
/* Put it back down. Every release path that doesn't repaint the room has to
   call this, or the item keeps the lift it was picked up with. */
function unlift(el, it){
  if(!el) return;
  el.classList.remove("held");
  if(it) el.style.transform=itemTransform(it);
}

function flingToFloor(slotIdx){
  const id=G.inv[slotIdx];
  if(id===null) return;
  const it=G.items[id];
  const room=G.rooms[G.current];
  /* This was its own copy of the spot search — one that knew about furniture
     but not about doorways, so a fling could park an item under a door where
     it can't be tapped. One function, in geometry.js, for every placement. */
  const {x,y}=findFloorSpot(room,{padName:"toss",margin:8,span:84,avoidCaches:true});
  const slotEl=invBar.querySelector(`.slot[data-slot="${slotIdx}"]`);
  const sr=slotEl?slotEl.getBoundingClientRect():null;
  it.loc={kind:"floor",room:room.id,x,y,rot:Math.random()*40-20};
  it.flying=true;
  G.inv[slotIdx]=null;
  G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
  render();
  const [tx,ty]=roomPctToScreen(x,y);
  sfx("fling");
  animateFlight(it.type, sr?sr.left+sr.width/2:tx, sr?sr.top:window.innerHeight, tx, ty, ()=>{
    it.flying=false;
    displaceAround(room.id, x, y, 11, 8);
    render();
  });
}

/* Put a held item down on the floor exactly where the hand let go.
   The only correction is nearestFloorSpot's: a drop aimed into a doorway or
   inside a cupboard slides to the closest open floor instead, because an item
   left in either place is one the player can't pick back up. */
function dropOnFloor(slotIdx,cx,cy,rect){
  const id=G.inv[slotIdx];
  if(id===null) return;
  const it=G.items[id];
  const room=G.rooms[G.current];
  const spot=nearestFloorSpot(room,
    (cx-rect.left)/rect.width*100,
    (cy-rect.top)/rect.height*100,
    {padName:"toss"});
  it.loc={kind:"floor",room:room.id,x:spot.x,y:spot.y,rot:spin()};
  G.inv[slotIdx]=null;
  G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
  sfx("dropFloor");
  render();
  scheduleSave();
}

/* inside the open container */
function placeFromSlot(slotIdx,row,col){
  const room=G.rooms[G.current], c=room.containers[G.openCont];
  if(c.cells[row][col]!==null) return false;
  if(slotIdx===null || G.inv[slotIdx]===null){ bump(invBar, "👆", "Pick something up first, then tap a cell.", "pickFirst"); return false; }
  const it=G.items[G.inv[slotIdx]];
  if(it.isKey){ bump(invBar, "🔑", "Keys go in locks, not containers.", "keyUse"); return false; }
  if(it.isCoin){ bump(invBar, "🪙", "Coins go in coin slots, not containers.", "coinUse"); return false; }
  c.cells[row][col]=it.id;
  it.loc={kind:"cell",room:room.id,cont:c.id,row,col};
  G.inv[slotIdx]=null;
  const home=G.typeHome[it.type];
  const right=home.room===room.id && home.cont===G.openCont;
  judgeToss(it, room.id, G.openCont);
  G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
  renderInv();
  const newly=afterMutation(room,c,[row]);
  renderContainer(newly);
  const cellEl=contGrid.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if(cellEl) cellEl.classList.add(right?"gold":"cold");
  sfx("toss");
  sfx(right ? "gold" : "cold");
  fire("place", {container:c.short||c.name, item:nameOf(it.type)});
  if(right) fire("goldPlace", {container:c.short||c.name});
  return true;
}

function tapCell(row,col){
  const room=G.rooms[G.current], c=room.containers[G.openCont];
  const occupant=c.cells[row][col];
  if(occupant!==null){
    const slot=G.inv.indexOf(null);
    if(slot===-1){ bump(invBar, "✋", "Your hands are full — put something away first", "handsFull"); sfx("locked"); return; }
    c.cells[row][col]=null;
    const it=G.items[occupant];
    it.loc={kind:"inv",slot};
    G.inv[slot]=it.id;
    if(G.sel===null) G.sel=slot;
    renderInv();
    afterMutation(room,c,[row]);
    renderContainer();
    return;
  }
  placeFromSlot(G.sel,row,col);
}

function moveWithinContainer(fromRow,fromCol,toRow,toCol){
  const room=G.rooms[G.current], c=room.containers[G.openCont];
  const a=c.cells[fromRow][fromCol];
  if(a===null) return;
  const b=c.cells[toRow][toCol];   // occupant → swap
  c.cells[fromRow][fromCol]=b;
  c.cells[toRow][toCol]=a;
  G.items[a].loc={kind:"cell",room:room.id,cont:c.id,row:toRow,col:toCol};
  if(b!==null) G.items[b].loc={kind:"cell",room:room.id,cont:c.id,row:fromRow,col:fromCol};
  const newly=afterMutation(room,c,[fromRow,toRow]);
  renderContainer(newly);
  const home=G.typeHome[G.items[a].type];
  const right=home.room===room.id && home.cont===G.openCont;
  const el=contGrid.querySelector(`.cell[data-row="${toRow}"][data-col="${toCol}"]`);
  if(el) el.classList.add(right?"gold":"cold");
}

/* The draft grants; this repaints and persists. Passed to talents.js as a
   callback so that module never has to import the render tier. */
initTalents({
  grant(){
    renderHUD(); renderInv();
    fire("talentEarned");
    scheduleSave();
  },
  /* "Drop Everything": file every item in your hands that has an open home in
     this room. Reuses the same bestSpot/afterMutation path a hand placement
     takes, so a row it completes celebrates and pays out exactly like one you
     filed yourself. */
  fileHands(){
    if(!G.active) return 0;
    const room=G.rooms[G.current];
    let n=0;
    for(let s=0;s<G.inv.length;s++){
      const id=G.inv[s];
      if(id===null) continue;
      const o=G.items[id];
      if(o.isKey||o.isCoin||o.isNote) continue;
      const h=G.typeHome[o.type];
      if(!h || h.room!==room.id) continue;
      const c=room.containers[h.cont];
      if(!c || (c.lock && !c.lock.open)) continue;
      const spot=bestSpot(c, o.type);
      if(!spot) continue;
      c.cells[spot.row][spot.col]=o.id;
      o.loc={kind:"cell",room:room.id,cont:c.id,row:spot.row,col:spot.col};
      G.inv[s]=null;
      judgeToss(o, room.id, h.cont);
      afterMutation(room,c,[spot.row]);
      n++;
    }
    if(n){
      G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
      sfx("toss"); sfx("gold");
      say("+"+n+" put away ✨", {priority:2});
      render();
    }else{
      say("Nothing in your hands lives in this room.", {priority:2});
    }
    return n;
  },
});

/* TALENTS DO NOT CARRY BETWEEN LEVELS.

   They used to: a campaign level's talents were written to their own
   localStorage key and reloaded by the next level, on the reasoning that a
   draft is pointless if a level is over in a few minutes. What it actually
   produced was a campaign that got easier the further in you went — by 4-2
   you arrived holding Sixth Sense and Bigger Hands, and the level that was
   authored to teach locked doors was being played with the answers already
   in hand. Every level now starts level, and earns its own.

   They still persist WITHIN a level: `up` rides in the run save, so quitting
   and continuing mid-level keeps what you drafted. The only thing that's
   gone is carrying them forward past the win screen. */
function clearTalents(){ try{ localStorage.removeItem(TALENTS_KEY); }catch(e){} }

/* ============================================================
   THE NEXT JOB CARD — the win screen's whole first answer

   WHAT THIS REPLACED. The win screen offered "Next job" and "Job board" and
   swapped which of them was gold: staying with the same client made Next job
   primary, moving to a new one sent you to the board instead, "so they get
   their own arrival". The reasoning was sound and the result was not — a
   client's arrival on the board is a small greyed tile in a grid of thirty-four,
   and the player had to go looking for it. Half the transitions in the campaign
   were a menu.

   So the next job is now ALWAYS first, always gold, and big enough to carry the
   person offering it: their face, their name, why they are calling you, and one
   line in their own voice. A new client's arrival is a card with their face on
   it, which is a better arrival than the board ever gave them.

   TWO LINES, DOING TWO DIFFERENT JOBS.
     stage.hook   — third person, and the one that carries the through-line:
                    how this person found you, or what they want. For a first
                    stage that is a referral ("Your mom told her about you"),
                    which is what makes the cast feel like it knows itself.
     stage.teaser — their own words, quoted.

   `teaser` ALREADY EXISTED ON EVERY STAGE AND NOTHING HAS EVER RENDERED IT.
   Thirty-four authored lines, validated for tokens on every boot, checked for
   voice in review, and dead — the only reader was soonTile(), which asks for
   `client.teaser` (a client-level field no client has) rather than a stage's.
   That is the same failure mode as the two consumables that set a field nothing
   read: it did not look broken, it looked like copy someone had decided against.

   NEW vs RETURNING is measured, not assumed. `stageNo > 1` would be wrong the
   moment a level is skipped — with "Unlock all jobs" on you can reach a third
   stage having met nobody — so it asks the finished-set whether you have
   actually done an earlier job for this client. That also keeps it honest for a
   level inserted behind a player's frontier.
============================================================ */
/* PURE PRESENTATION. Handed a face, a name and up to two lines; knows nothing
   about runs, saves or progress. Same reasoning as js/client.js, and the reason
   the win screen and the title screen can share one component: the win screen
   offers a job that has not started, the title screen offers one you are in the
   middle of, and the only thing that differs is the copy. */
function fillJobCard(b, o){
  b.textContent = "";
  b.classList.remove("menubtn","primary","ghost");
  b.classList.add("jobcard");

  const tag = mkEl("span","njtag", o.tag);
  if(o.chip) tag.appendChild(mkEl("em","njchip", o.chip));
  b.appendChild(tag);

  const row = mkEl("span","njrow");
  row.appendChild(mkEl("span","njface", o.face));
  const text = mkEl("span","njtext");
  text.appendChild(mkEl("span","njname", o.name));
  /* Both lines are optional: a free-play save has nobody to quote, and a stage
     with no teaser must not leave a gap where one used to be. */
  if(o.body) text.appendChild(mkEl("span","njhook", o.body));
  if(o.say)  text.appendChild(mkEl("span","njsay",  o.say));
  row.appendChild(text);
  b.appendChild(row);

  const foot = mkEl("span","njfoot", o.foot || "");
  foot.appendChild(mkEl("em",null,"▶"));
  b.appendChild(foot);
  return b;
}
function jobCard(o){
  const b = fillJobCard(document.createElement("button"), o);
  if(o.onGo) b.addEventListener("click", o.onGo);
  return b;
}

function nextJobCard(idx, onGo){
  const next = jobAt(idx);
  if(!next) return null;
  const S = DATA.strings.winScreen || {};
  const done = progress().done;
  /* Have we actually worked for this person, or does the arc merely say so? */
  const arc = LOOKUP.arcs.find(a => a.client.id === next.client.id);
  const worked = !!arc && arc.stages.some(s => s.stageNo < next.stageNo && done.has(s.level.id));
  /* hook is the line that matters; teaser is flavour and may be absent. Falling
     back to the level blurb means this card can never render an empty gap. */
  const hook = next.stage.hook || next.level.blurb || "";
  /* NO LEVEL NAME, only the id. The card carries two lines of the client's own
     voice, and the level title is a THIRD headline competing with them — on
     eleven of the thirty-four stages it also repeats a word the card has already
     said, because the titles were written from the same beats: "Terms have been
     agreed." above TERMS AGREED, "Twelve a day. Worth it." above TWELVE A DAY,
     T-1's hook saying "Four hundred years I have lived here" directly above FOUR
     HUNDRED YEARS. Two quotes of the same thing reads as a mistake even where it
     is not. The id stays: four characters, what the board and the gear call this
     job, and the only thing on the card a bug report can name. */
  return jobCard({
    tag:  S.nextJob || "Next job",
    chip: worked ? (S.chipAgain || "Asking for you again") : (S.chipNew || "New client"),
    face: next.client.emoji,
    name: next.client.name,
    body: hook && tokenise(hook, {handSlots:INV_SIZE, rowLen:next.level.rowLen||5, name:next.client.name, level:next.level.id}),
    say:  next.stage.teaser,
    foot: next.level.id,
    onGo,
  });
}

function showWin(){
  clearSave();
  const secs=Math.round((Date.now()-G.stats.start)/1000);
  const m=Math.floor(secs/60), s=secs%60;
  const sortable=Object.values(G.items).filter(i=>!i.isKey&&!i.isCoin&&!i.isNote);
  const acc=Math.round(100*G.stats.firstGood/sortable.length);
  const stats=`${sortable.length} items sorted in ${m}m ${s}s — ${acc}% landed in the right home on the first toss.`;
  const btns=$("#winButtons"); btns.innerHTML="";
  const mk=(label,cls,fn)=>{
    const b=document.createElement("button");
    b.className="menubtn"+(cls?" "+cls:"");
    b.textContent=label;
    b.addEventListener("click",fn);
    btns.appendChild(b);
  };
  const lv=G.mode==="campaign" ? LEVELS[G.levelIdx] : null;
  if(G.mode==="campaign" && lv){
    const job=jobAt(G.levelIdx);
    /* The client's face, not a generic ✨ — you finished a job for a person.
       They have already said their piece out loud (the outro beat), so this
       screen only names them. */
    $("#winOverlay .big").textContent=job ? job.client.emoji : "✨";
    $("#winTitle").textContent=job
      ? job.client.name+(job.last ? " — that's the lot" : " — job done")
      : lv.id+" · "+lv.name+" — complete!";
    $("#winStats").textContent=stats;
    markDone(lv.id);
    /* markDone above ran BEFORE this, which matters: the card asks the
       finished-set whether you have worked for the next client, and the job you
       just finished has to be in it. */
    const card = G.levelIdx+1<LEVELS.length
      ? nextJobCard(G.levelIdx+1, ()=>{ $("#winOverlay").classList.remove("open"); startCampaign(G.levelIdx+1); })
      : null;
    if(card) btns.appendChild(card);
    /* `ghost` rather than a bare .menubtn for the secondaries: `.overlay button`
       (0,1,1) outranks `.menubtn` (0,1,0), so a plain one comes out gold and the
       card stops being the obvious thing to press. */
    mk("Job board", card?"ghost":"primary", ()=>{ $("#winOverlay").classList.remove("open"); openCampaignMenu(); });
    mk("Main menu","ghost",()=>{ $("#winOverlay").classList.remove("open"); showTitle(); });
  }else{
    $("#winOverlay .big").textContent="✨";
    $("#winTitle").textContent="All tidy.";
    $("#winStats").textContent=stats;
    const sz=SIZES[G.size]||SIZES.medium;
    mk("New "+presetName(sz).toLowerCase(),"primary",()=>{ $("#winOverlay").classList.remove("open"); startFree(SIZES[G.size]?G.size:"medium"); });
    mk("Main menu","ghost",()=>{ $("#winOverlay").classList.remove("open"); showTitle(); });
  }
  /* The last thing you hear after finishing a whole house was nothing at all.
     After the class, so it lands with the screen rather than ahead of it. */
  sfx("win");
  $("#winOverlay").classList.add("open");
}

function closeCont(){
  if(G.openCont!==null) sfx("closeCont");
  G.openCont=null;
  $("#contView").classList.remove("open");
  render();
  playBeats();    /* anything that was waiting for the room can play now */
  maybeDraft();   /* closing a container is a safe moment to interrupt */
}

function tryMove(dir){
  const to=G.rooms[G.current].doors[dir];
  /* Swiping into a wall. The bounce was silent, which read as a dropped input
     rather than "there's nothing that way". */
  if(to===null){ sfx("bump"); bounce(dir); return; }
  const lock=lockFor(G.current,dir);
  if(lock){
    sfx("locked");
    bounce(dir);
    bump(host.querySelector(".door.locked"), "🔒", "Sealed. Drag keys onto it — the pips show how many are left.", "lockedDoor");
    const plate=host.querySelector(`.door.locked[data-lock="${G.locks.indexOf(lock)}"]`);
    if(plate) plate.classList.add("fullhit");
    return;
  }
  slideTo(dir,to);
}


/* ============================================================
   INPUT — room stage
============================================================ */
let ptr=null, lastTap={t:0,x:0,y:0};
const loupe=document.getElementById("loupe");

/* Every pointer currently down. v3 kept exactly one and dropped the rest,
   which is why pinch never worked — a second finger's events were discarded
   by `if(!ptr||e.pointerId!==ptr.id) return`. */
const live=new Map();
let pinch=null;
/* A trailing finger lifting after a pinch would otherwise land as a tap and
   open a container. */
let suppressTapUntil=0;

const pinchSpan=()=>{
  const [a,b]=[...live.values()];
  return {d:Math.hypot(a.x-b.x, a.y-b.y), mx:(a.x+b.x)/2, my:(a.y+b.y)/2};
};
function startPinch(){
  const s=pinchSpan();
  return {d0:s.d, z0:G.cam.z, mx:s.mx, my:s.my};
}
function updatePinch(){
  if(!pinch || live.size<2) return;
  const s=pinchSpan();
  if(s.d>0 && pinch.d0>0){
    zoomAt(pinch.z0 * (s.d/pinch.d0), s.mx, s.my);
    if(isZoomed()) fire("zoom");
  }
  /* Two-finger drag pans at the same time. */
  panBy(s.mx-pinch.mx, s.my-pinch.my);
  pinch.mx=s.mx; pinch.my=s.my;
}
function endPinch(){
  pinch=null;
  suppressTapUntil=Date.now()+PINCH_TAP_SUPPRESS_MS;
  setCamSmooth(true);
}

/* Put a half-dragged item back where it came from. */
function cancelItemDrag(){
  if(!ptr?.itemEl) return;
  ptr.itemEl.style.pointerEvents="";
  ptr.itemEl.style.zIndex="";
  clearHots();
  renderRoom();
}

function showLoupe(it,el,ptype){
  loupe.classList.toggle("mouse", ptype==="mouse");
  loupe.querySelector(".lemoji").textContent=it.type;
  loupe.querySelector(".lname").textContent=(NAMES[it.type]||"")+senseSuffix(it);
  loupe.style.display="flex";
  moveLoupe(el);
  if(G.up.sense && !it.isKey){
    const home=G.typeHome[it.type];
    if(home.room===G.current){
      const fe=host.querySelector(`.furn[data-cont="${home.cont}"]`);
      if(fe) fe.classList.add("sense");
    }
  }
}
function moveLoupe(el){
  const r=el.getBoundingClientRect();
  loupe.style.left=(r.left+r.width/2)+"px";
  loupe.style.top=(r.top-10)+"px";
}
function hideLoupe(){
  loupe.style.display="none";
  host.querySelectorAll(".furn.sense").forEach(f=>f.classList.remove("sense"));
}

/* Continuous, cursor-anchored. v3 ignored deltaY's magnitude and snapped
   between exactly two levels. */
let wheelIdle=null;
host.addEventListener("wheel",e=>{
  if(!G.active) return;
  e.preventDefault();
  setCamSmooth(false);
  wheelZoom(e);
  if(isZoomed()) fire("zoom");
  clearTimeout(wheelIdle);
  wheelIdle=setTimeout(()=>setCamSmooth(true),140);
},{passive:false});

host.addEventListener("pointerdown",e=>{
  if(!G.active) return;
  live.set(e.pointerId,{x:e.clientX,y:e.clientY});
  /* Capture is an optimisation, not a requirement — it throws if the pointer
     is already gone, and an uncaught throw here would kill the rest of the
     handler (including all pinch handling). */
  try{ host.setPointerCapture(e.pointerId); }catch(err){}

  /* Second finger down = pinch. v3 stored a single pointer and discarded any
     other, so pinch-zoom did not exist at all (only double-tap did). Abort
     any in-flight item drag so the item doesn't fly off mid-pinch. */
  if(live.size===2){
    if(ptr?.itemEl) cancelItemDrag();
    pinch=startPinch();
    ptr=null;
    hideLoupe();
    setCamSmooth(false);
    return;
  }
  if(live.size>2) return;

  /* NOT e.target.closest(".item"). The browser hit-tests an item's box, which
     is the 22px glyph plus 10px of invisible padding on every side — about
     four times the area you can see, and items are scattered to overlap. So
     the top item's halo was stealing taps aimed squarely at the item under it.
     itemAt() prefers whichever glyph's actual pixels are under the point and
     falls back to this exact box test when none are. See js/hit.js. */
  ptr={sx:e.clientX,sy:e.clientY,panX:G.cam.x,panY:G.cam.y,drag:false,id:e.pointerId,
       downTarget:e.target,
       itemEl:itemAt(e.clientX,e.clientY), itemMoved:false, ix:0, iy:0, hotCont:null,
       grabDX:0, grabDY:0,
       samples:[{t:performance.now(),x:e.clientX,y:e.clientY}]};
  if(ptr.itemEl){
    /* Remember WHERE ON THE ITEM you took hold of it. Without this the drag
       writes the pointer position straight into the item's centre, so the
       moment you move past the drag threshold the thing leaps sideways by
       however far from its middle you happened to grab — up to half its width,
       and worse on a phone, where the camera scales an item to twice the size
       it is on a laptop. You are then holding an object that jumped out from
       under your finger before it started following it. */
    const it=G.items[+ptr.itemEl.dataset.item];
    const [px,py]=screenToRoomPct(e.clientX,e.clientY);
    ptr.grabDX=it.loc.x-px;
    ptr.grabDY=it.loc.y-py;
    showLoupe(it, ptr.itemEl, e.pointerType);
  }
});

host.addEventListener("pointermove",e=>{
  if(live.has(e.pointerId)) live.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch){ updatePinch(); return; }
  if(!ptr||e.pointerId!==ptr.id) return;
  const dx=e.clientX-ptr.sx, dy=e.clientY-ptr.sy;
  if(Math.hypot(dx,dy)>DRAG_THRESHOLD) ptr.drag=true;
  if(!ptr.drag) return;
  ptr.samples.push({t:performance.now(),x:e.clientX,y:e.clientY});
  if(ptr.samples.length>6) ptr.samples.shift();
  if(ptr.itemEl){
    const first=!ptr.itemMoved;
    ptr.itemMoved=true;
    ptr.itemEl.style.pointerEvents="none";
    const [px,py]=screenToRoomPct(e.clientX,e.clientY);
    /* Carry the grab offset, so the item travels WITH the finger instead of
       snapping its centre to it. */
    ptr.ix=Math.max(2,Math.min(97,px+ptr.grabDX));
    ptr.iy=Math.max(2,Math.min(97,py+ptr.grabDY));
    ptr.itemEl.style.left=ptr.ix+"%";
    ptr.itemEl.style.top=ptr.iy+"%";
    ptr.itemEl.style.zIndex=20;
    /* Lifted off the floor: a little bigger, with a longer shadow. It is the
       only feedback that the tap became a drag. */
    if(first){
      const it=G.items[+ptr.itemEl.dataset.item];
      ptr.itemEl.style.transform=itemTransform(it,true);
      ptr.itemEl.classList.add("held");
    }
    moveLoupe(ptr.itemEl);
    const under=document.elementFromPoint(e.clientX,e.clientY);
    /* underAt, not under.closest: another item lying on the chest is drawn
       above it and used to swallow the drop. See js/hit.js. */
    const cont=underAt(e.clientX,e.clientY,".furn, .door.locked, .cache");
    if(ptr.hotCont && ptr.hotCont!==cont) ptr.hotCont.classList.remove("drophot");
    ptr.hotCont=cont||null;
    if(ptr.hotCont) ptr.hotCont.classList.add("drophot");
    const slotEl=under && under.closest(".slot");
    if(ptr.hotSlot && ptr.hotSlot!==slotEl) ptr.hotSlot.classList.remove("sel");
    ptr.hotSlot=(slotEl && G.inv[+slotEl.dataset.slot]===null)?slotEl:null;
    if(ptr.hotSlot) ptr.hotSlot.classList.add("sel");
  }else if(isZoomed()){
    const t=camScale();
    G.cam.x=ptr.panX+dx/t;
    G.cam.y=ptr.panY+dy/t;
    clampPan(); applyCam();
    fire("pan");
  }
});

host.addEventListener("pointerup",e=>{
  live.delete(e.pointerId);
  if(pinch){ if(live.size<2) endPinch(); return; }
  if(Date.now()<suppressTapUntil){ ptr=null; return; }
  if(!ptr||e.pointerId!==ptr.id) return;
  hideLoupe();
  const dx=e.clientX-ptr.sx, dy=e.clientY-ptr.sy;
  const dist=Math.hypot(dx,dy);
  const wasDrag=ptr.drag, p=ptr; ptr=null;

  if(wasDrag){
    if(p.itemMoved){
      p.itemEl.style.pointerEvents="";
      if(p.hotCont) p.hotCont.classList.remove("drophot");
      if(p.hotSlot) p.hotSlot.classList.remove("sel");
      const it=G.items[+p.itemEl.dataset.item];
      if(it.loc.kind==="floor"){
        // dropped on the inventory bar → into your hands
        const under=document.elementFromPoint(e.clientX,e.clientY);
        const overInv=under && under.closest("#invBar");
        if(overInv){
          const slotEl=under.closest(".slot");
          let slot=(slotEl && G.inv[+slotEl.dataset.slot]===null) ? +slotEl.dataset.slot : G.inv.indexOf(null);
          if(slot===-1){ bump(invBar, "✋", "Your hands are full — put something away first", "handsFull"); }
          else{
            it.loc={kind:"inv",slot};
            G.inv[slot]=it.id;
            if(G.sel===null) G.sel=slot;
            render();
            return;
          }
        }
        if(p.hotCont){
          if(p.hotCont.classList.contains("cache")){
            if(openCache(+p.hotCont.dataset.cache, it)) return;
          }else if(p.hotCont.classList.contains("locked")){
            if(fitsLock(G.locks[+p.hotCont.dataset.lock], it)){ insertKey(+p.hotCont.dataset.lock, it); return; }
            p.hotCont.classList.add("fullhit");
            bump(null, "🔑", "Only a key fits a lock.", "keyOnly");
          }else if(p.hotCont.classList.contains("furn")){
            if(tossInto(it, +p.hotCont.dataset.cont)) return;
          }
        }
        // flick: fast release over open floor sends it sailing
        const s=p.samples;
        if(s.length>=2){
          const a=s[0], b=s[s.length-1];
          const dt=Math.max(1, b.t-a.t);
          const vx=(b.x-a.x)/dt, vy=(b.y-a.y)/dt;
          const speed=Math.hypot(vx,vy);
          if(speed>0.8){
            const distPct=Math.min(55, 12+speed*16);
            const ux=vx/speed, uy=vy/speed;
            const rawX=p.ix+ux*distPct, rawY=p.iy+uy*distPct;
            let tx=Math.max(4,Math.min(95,rawX));
            let ty=Math.max(4,Math.min(95,rawY));
            // walls and doors alike: bounce back inward with jitter
            if(rawX<4)  tx=6+Math.random()*9;
            if(rawX>95) tx=93-Math.random()*9;
            if(rawY<4)  ty=6+Math.random()*9;
            if(rawY>95) ty=93-Math.random()*9;
            tx=Math.max(4,Math.min(95,tx+(Math.random()*6-3)));
            ty=Math.max(4,Math.min(95,ty+(Math.random()*6-3)));
            /* A flick that ends in a doorway lands somewhere reachable
               instead — under a door the item is painted over and its taps
               go to the door. */
            ({x:tx,y:ty}=nearestFloorSpot(G.rooms[G.current],tx,ty,{padName:"toss"}));
            it.flying=true;
            it.loc.x=tx; it.loc.y=ty;
            const el=p.itemEl;
            el.style.transition="left .38s cubic-bezier(.15,.6,.35,1), top .38s cubic-bezier(.15,.6,.35,1), transform .38s linear";
            el.style.left=tx+"%"; el.style.top=ty+"%";
            el.style.transform=`translate(-50%,-50%) rotate(${(it.loc.rot||0)+(vx>0?540:-540)}deg)`;
            setTimeout(()=>{
              it.flying=false;
              it.loc.rot=Math.random()*40-20;
              displaceAround(G.current, tx, ty, 12, 8);
              render();
              scheduleSave();
            },390);
            return;
          }
        }
        /* Slow release: it stays exactly where you let go of it — unless that's
           a doorway, where it would be invisible and untappable. */
        const rest=nearestFloorSpot(G.rooms[G.current], p.ix, p.iy, {padName:"toss"});
        const slid=rest.x!==p.ix || rest.y!==p.iy;
        it.loc.x=rest.x; it.loc.y=rest.y;
        scheduleSave();
        if(slid) renderRoom();
        else unlift(p.itemEl, it);   /* no repaint here, so set it down by hand */
      }
      p.itemEl.style.zIndex="";
      return;
    }
    if(!isZoomed() && dist>55){
      const dir = Math.abs(dx)>Math.abs(dy) ? (dx<0?"E":"W") : (dy<0?"S":"N");
      tryMove(dir);
    }
    return;
  }

  const target=p.downTarget;
  const itemEl=p.itemEl;
  if(itemEl){
    const id=+itemEl.dataset.item;
    /* Picking up the thing it is pointing at is acknowledgement enough — the
       flashing has done its job and can stop. pickUp() repaints, so this
       doesn't. */
    if(G.reveal && G.items[id]?.token) stopReveal(false);
    pickUp(id);
    lastTap={t:0};
    return;
  }

  const cacheEl=target.closest(".cache");
  if(cacheEl){
    lastTap={t:0};
    bump(cacheEl, "🪙", "A little slot. Something coin-shaped fits it.", "cacheHint");
    return;
  }

  const doorEl=target.closest(".door");
  if(doorEl){
    lastTap={t:0};
    const dir=["N","S","E","W"].find(d=>doorEl.classList.contains(d));
    if(doorEl.classList.contains("locked")){
      const lk=lockFor(G.current,dir);
      if(lk){
        bump(doorEl, "🔒", "Sealed. Drag keys onto it — the pips show how many are left.", "lockedDoor");
      }
    }else if(dir){
      tryMove(dir);
    }
    return;
  }

  /* Furniture opens on a SINGLE tap, in the same early-return chain as
     items, caches and doors. It used to require a double-tap, and a single
     tap did nothing whatsoever — no feedback, no hint that the furniture was
     even interactive. Locked furniture now shakes on the first tap too. */
  const contEl=target.closest(".furn");
  if(contEl){
    lastTap={t:0};
    openContainer(+contEl.dataset.cont, contEl);
    return;
  }

  /* ---- double-tap the bare floor: zoom in, and back out ----
     This is BARE FLOOR ONLY, which is what makes it safe. It was removed
     because a mis-tap between small furniture and the floor beside it flipped
     between "a panel opens" and "the camera jumps"; every one of those targets
     returned above, so by the time we get here the tap hit nothing at all.
     And because a single floor tap does nothing, the second tap can act
     immediately — there's no 330ms deferred-tap latency anywhere, which was
     the other reason it went. */
  const now=Date.now();
  if(now-lastTap.t<DOUBLE_TAP_MS &&
     Math.hypot(e.clientX-lastTap.x, e.clientY-lastTap.y)<DOUBLE_TAP_SLOP){
    lastTap={t:0,x:0,y:0};
    setCamSmooth(true);
    if(isZoomed()){
      resetZoom(); applyCam(); sfx("zoomOut");
    }else{
      /* Zoom toward the tapped point, so double-tapping a corner of the room
         brings THAT corner in, not the middle. */
      zoomAt(ZOOM_TAP, e.clientX, e.clientY);
      sfx("zoomIn");
      fire("zoom");
    }
    return;
  }
  lastTap={t:now,x:e.clientX,y:e.clientY};
});

/* Never interrupt a drag, an open container, a celebration, or someone talking.
   isSpeaking() is belt and braces next to celebrating() — the outro beat holds
   the queue for its whole speech — but each call site defends itself, and the
   intro is not a beat at all. */
const busy = () =>
  !!ptr || !!invDrag || !!cellPtr || G.openCont!==null || celebrating() || isSpeaking();
function maybeDraft(){ return drainDrafts(busy); }

/* When the panel opened. A tap on the backdrop closes the panel, so the
   second tap of a double-tap aimed at furniture used to open it and shut it
   again in one gesture — the panel flashed and the player saw nothing
   happen. Now that double-tap means something on the floor, that gesture is
   one people will make. A tap within this window of opening is the tail of
   the gesture that opened it, not a dismissal. */
let contOpenedAt=0;
const PANEL_GRACE=320;

function openContainer(idx, contEl){
  const c=G.rooms[G.current].containers[idx];
  if(c.lock && !c.lock.open){
    if(c.lock.quest){
      bump(contEl, "🔒", "Sealed. Finish another container in this room and it opens.", "questSeal");
    }else{
      bump(contEl, "🔒", "Locked. Drag keys onto it — the pips show how many are left.", "lockedCont");
    }
    return;
  }
  G.openCont=idx;
  contOpenedAt=Date.now();
  sfx("openCont");
  renderContainer();
  fire("open", {container: c.short || c.name});
}

host.addEventListener("pointercancel",e=>{
  live.delete(e.pointerId);
  if(pinch && live.size<2) endPinch();
  if(!ptr||e.pointerId!==ptr.id) return;
  hideLoupe();
  if(ptr.itemEl){
    ptr.itemEl.style.pointerEvents="";
    ptr.itemEl.style.zIndex="";
    unlift(ptr.itemEl, G.items[+ptr.itemEl.dataset.item]);
  }
  clearHots();
  ptr=null;
});

function clearHots(){
  if(ptr?.hotCont) ptr.hotCont.classList.remove("drophot");
  if(ptr?.hotSlot) ptr.hotSlot.classList.remove("sel");
}

/* ============================================================
   INPUT — inventory: tap to select, drag onto furniture / floor / cells
============================================================ */
const ghost=$("#dragGhost");   /* invBar comes from dom.js */
let invDrag=null, hotCell=null, invHotCont=null;
let lastSlotTap={t:0,idx:-1};

function clearInvHots(){
  if(hotCell){hotCell.classList.remove("hot");hotCell=null;}
  if(invHotCont){invHotCont.classList.remove("drophot");invHotCont=null;}
}

function autoPlace(slotIdx){
  if(G.openCont===null) return;
  const id=G.inv[slotIdx];
  if(id===null) return;
  const c=G.rooms[G.current].containers[G.openCont];
  const spot=bestSpot(c, G.items[id].type);
  if(spot){ placeFromSlot(slotIdx,spot.row,spot.col); return; }
  bump(contGrid, "🚫", "No room left in here — take something out first.", "cellFull");
}

invBar.addEventListener("pointerdown",e=>{
  const s=e.target.closest(".slot");
  if(!s) return;
  invDrag={idx:+s.dataset.slot, sx:e.clientX, sy:e.clientY, moved:false, el:s, id:e.pointerId};
  invBar.setPointerCapture(e.pointerId);
});

invBar.addEventListener("pointermove",e=>{
  if(!invDrag||e.pointerId!==invDrag.id) return;
  if(G.inv[invDrag.idx]===null) return;
  const dist=Math.hypot(e.clientX-invDrag.sx,e.clientY-invDrag.sy);
  if(!invDrag.moved && dist>12){
    invDrag.moved=true;
    invDrag.el.classList.add("dragging");
    ghost.textContent=G.items[G.inv[invDrag.idx]].type;
    ghost.style.display="block";
  }
  if(invDrag.moved){
    ghost.style.left=e.clientX+"px";
    ghost.style.top=e.clientY+"px";
    const under=document.elementFromPoint(e.clientX,e.clientY);
    if(G.openCont!==null){
      const cell=under && under.closest(".cell");
      if(hotCell && hotCell!==cell) hotCell.classList.remove("hot");
      hotCell = (cell && !cell.textContent) ? cell : null;
      if(hotCell) hotCell.classList.add("hot");
    }else{
      const cont=under && under.closest(".furn, .door.locked, .cache");
      if(invHotCont && invHotCont!==cont) invHotCont.classList.remove("drophot");
      invHotCont=cont||null;
      if(invHotCont) invHotCont.classList.add("drophot");
    }
  }
});

function endInvDrag(e){
  if(!invDrag||e.pointerId!==invDrag.id) return;
  const d=invDrag; invDrag=null;
  ghost.style.display="none";
  d.el.classList.remove("dragging");
  clearInvHots();

  if(!d.moved){
    if(G.inv[d.idx]===null) return;
    if(G.openCont!==null){ autoPlace(d.idx); return; }
    const now=Date.now();
    if(now-lastSlotTap.t<330 && lastSlotTap.idx===d.idx){
      lastSlotTap={t:0,idx:-1};
      flingToFloor(d.idx);
    }else{
      lastSlotTap={t:now,idx:d.idx};
      tapSlot(d.idx);
    }
    return;
  }

  if(G.openCont===null){
    const under=document.elementFromPoint(e.clientX,e.clientY);
    const kbox=under && under.closest(".cache");
    if(kbox && G.inv[d.idx]!==null){
      openCache(+kbox.dataset.cache, G.items[G.inv[d.idx]], d.idx);
      return;
    }
    const plate=under && under.closest(".door.locked");
    if(plate && G.inv[d.idx]!==null){
      const it=G.items[G.inv[d.idx]];
      if(fitsLock(G.locks[+plate.dataset.lock], it)){ insertKey(+plate.dataset.lock, it, d.idx); }
      else{ bump(plate, "🔑", "Only a key fits a lock.", "keyOnly"); }
      return;
    }
    const cont=under && under.closest(".furn");
    if(cont && G.inv[d.idx]!==null){
      tossInto(G.items[G.inv[d.idx]], +cont.dataset.cont, d.idx);
      return;
    }
    /* Anywhere else over the room: put it down there.
       This was `if(roomEl)` — the imported FUNCTION, always truthy — followed
       by `roomEl.getBoundingClientRect()` on the function object, which threw
       and took the whole handler down. Dragging out of your hands onto the
       floor therefore did nothing at all: the item stayed in the slot and the
       only clue was a console error.
       The bounds test is the stage rather than the room rect, so a release
       just past a small room's wall still puts the item down (clamped inward)
       instead of silently doing nothing. */
    const rEl=roomEl();
    if(rEl && under && under.closest("#stage")){
      dropOnFloor(d.idx,e.clientX,e.clientY,rEl.getBoundingClientRect());
    }
    return;
  }
  const under=document.elementFromPoint(e.clientX,e.clientY);
  const cell=under && under.closest(".cell");
  if(cell && !cell.textContent){
    placeFromSlot(d.idx,+cell.dataset.row,+cell.dataset.col);
  }
}
invBar.addEventListener("pointerup",endInvDrag);
invBar.addEventListener("pointercancel",e=>{
  if(invDrag&&e.pointerId===invDrag.id){
    ghost.style.display="none";
    invDrag.el.classList.remove("dragging");
    clearInvHots();
    invDrag=null;
  }
});

/* ============================================================
   INPUT — container view: tap cells, drag between cells
============================================================ */
let cellPtr=null, cellHot=null;
/* contGrid comes from dom.js */

contGrid.addEventListener("pointerdown",e=>{
  const cell=e.target.closest(".cell");
  if(!cell) return;
  cellPtr={cell, row:+cell.dataset.row, col:+cell.dataset.col,
           x:e.clientX, y:e.clientY, id:e.pointerId,
           hasItem:!!cell.textContent, dragging:false};
  contGrid.setPointerCapture(e.pointerId);
});

contGrid.addEventListener("pointermove",e=>{
  if(!cellPtr||e.pointerId!==cellPtr.id) return;
  const dist=Math.hypot(e.clientX-cellPtr.x,e.clientY-cellPtr.y);
  if(!cellPtr.dragging && cellPtr.hasItem && dist>12){
    cellPtr.dragging=true;
    ghost.textContent=cellPtr.cell.textContent;
    ghost.style.display="block";
    cellPtr.cell.style.opacity=.35;
  }
  if(cellPtr.dragging){
    ghost.style.left=e.clientX+"px";
    ghost.style.top=e.clientY+"px";
    const under=document.elementFromPoint(e.clientX,e.clientY);
    const target=under && under.closest(".cell");
    if(cellHot && cellHot!==target) cellHot.classList.remove("hot");
    cellHot=(target && target!==cellPtr.cell)?target:null;
    if(cellHot) cellHot.classList.add("hot");
  }
});

function endCellPtr(e){
  if(!cellPtr||e.pointerId!==cellPtr.id) return;
  const p=cellPtr; cellPtr=null;
  ghost.style.display="none";
  p.cell.style.opacity="";
  if(cellHot){cellHot.classList.remove("hot");cellHot=null;}

  if(p.dragging){
    const under=document.elementFromPoint(e.clientX,e.clientY);
    const target=under && under.closest(".cell");
    if(target && target!==p.cell){
      moveWithinContainer(p.row,p.col,+target.dataset.row,+target.dataset.col);
      return;
    }
    // released off the grid: eject to hands or onto the floor
    const room=G.rooms[G.current], c=room.containers[G.openCont];
    const id=c.cells[p.row][p.col];
    if(id===null) return;
    const it=G.items[id];
    const overInv=under && under.closest("#invBar");
    const inPanel=under && under.closest("#contPanel");
    if(overInv){
      const slotEl=under.closest(".slot");
      let slot=(slotEl && G.inv[+slotEl.dataset.slot]===null)?+slotEl.dataset.slot:G.inv.indexOf(null);
      if(slot===-1){ bump(invBar, "✋", "Your hands are full — put something away first", "handsFull"); sfx("locked"); return; }
      c.cells[p.row][p.col]=null;
      it.loc={kind:"inv",slot};
      G.inv[slot]=id;
      if(G.sel===null) G.sel=slot;
      renderInv();
      afterMutation(room,c,[p.row]);
      renderContainer();
      return;
    }
    if(!inPanel){
      c.cells[p.row][p.col]=null;
      /* Third copy of the spot search, also blind to doorways. Same function
         as everything else now. */
      const {x,y}=findFloorSpot(room,{padName:"toss",margin:8,span:84,avoidCaches:true});
      it.loc={kind:"floor",room:room.id,x,y,rot:spin()};
      /* the item is visibly on the floor; no narration needed */
      afterMutation(room,c,[p.row]);
      renderContainer(); renderHUD();
    }
    return;
  }
  if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<=14){
    tapCell(p.row,p.col);
  }
}
contGrid.addEventListener("pointerup",endCellPtr);
contGrid.addEventListener("pointercancel",e=>{
  if(cellPtr&&e.pointerId===cellPtr.id){
    ghost.style.display="none";
    cellPtr.cell.style.opacity="";
    if(cellHot){cellHot.classList.remove("hot");cellHot=null;}
    cellPtr=null;
  }
});
$("#contClose").addEventListener("click",closeCont);
$("#contView").addEventListener("pointerup",e=>{
  if(e.target.id!=="contView") return;
  if(Date.now()-contOpenedAt<PANEL_GRACE) return;   /* tail of the opening tap */
  closeCont();
});

/* keyboard */
window.addEventListener("keydown",e=>{
  if(isSpeaking()) return;   /* js/client.js owns the keyboard while they talk */
  const k={ArrowUp:"N",ArrowDown:"S",ArrowLeft:"W",ArrowRight:"E"}[e.key];
  if(k && G.openCont===null) tryMove(k);
  if(e.key==="Escape" && G.openCont!==null) closeCont();
});

/* Where "Got it" should return to: the title screen if help was opened from
   the menu, the game if it was opened from the HUD. */
let helpReturnsToTitle=false;

$("#helpBtn").addEventListener("click",()=>{
  helpReturnsToTitle=false;
  $("#helpOverlay").classList.add("open");
});
/* What am I actually playing? Campaign levels are named on the job board and
   then never again, so mid-level there was no way to tell 5-1 from 5-3. */
function nowPlaying(){
  const el=$("#nowPlaying");
  if(!G.active){ setHidden(el,true); return; }
  setHidden(el,false);
  if(G.mode==="campaign"){
    const lv=LEVELS[G.levelIdx], job=jobAt(G.levelIdx);
    el.innerHTML=`${lv?lv.id+" · "+lv.name:"Campaign"}`+
      (job?`<small>${job.client.emoji} ${job.client.name} — job ${job.stageNo} of ${job.stageCount}</small>`:"");
  }else{
    const sz=SIZES[G.size];
    el.innerHTML=`Free Play${sz?" · "+sz.label:""}<small>${G.rooms.length} rooms</small>`;
  }
}
$("#gearBtn").addEventListener("click",()=>{
  const gear=$("#gearOverlay");
  /* The button floats above its own panel now, so it has to close it too. */
  if(gear.classList.contains("open")){ gear.classList.remove("open"); return; }
  nowPlaying();
  /* Reachable from the title screen and the job board, where there is no run:
     grey out everything that would act on one. Left ungated, "New house"
     re-rolled a config that doesn't exist and "+1 ⭐" repainted a HUD with no
     rooms in it — both threw. */
  for(const id of ["resetBtn","debugStar","debugFinish","debugKeys"]){
    $("#"+id).disabled=!G.active;
  }
  /* Unlock and Relock act on progress, not on a run, so they stay live on the
     title screen and the board — which is exactly where you want them. */
  syncUnlockBtn();
  gear.classList.add("open");
});
/* were inline onclick= in the v3 single file; modules can't reach globals from markup */
$("#helpClose").addEventListener("click",()=>{
  $("#helpOverlay").classList.remove("open");
  if(helpReturnsToTitle){ helpReturnsToTitle=false; showTitle(); }
});
$("#gearClose").addEventListener("click",()=>$("#gearOverlay").classList.remove("open"));
$("#shopClose").addEventListener("click",()=>$("#shopOverlay").classList.remove("open"));
$("#noteClose").addEventListener("click",()=>{
  $("#noteOverlay").classList.remove("open");
  sfx("uiTap");
});
$("#resetBtn").addEventListener("click",()=>{
  if(confirm("Re-roll this run? The current run will be erased.")){
    resetRun();
  }
});
/* ============================================================
   DEBUG — for testing the story without playing four hundred items

   `finishJob` deliberately does NOT jump to the win screen. It files
   everything the way a player would and then hands the LAST item to
   afterMutation, so the whole ending runs for real: row → container → the
   panel bowing out → the room's gold ripple → the client's thank-you → the
   win screen. Testing the narrative means testing the sequence, and a
   shortcut past afterMutation would test nothing.
============================================================ */
function finishJob(){
  if(!G.active) return false;
  /* Which types live in which container, from the run's own home table. */
  const byHome={};
  for(const [type,h] of Object.entries(G.typeHome)){
    const k=h.room+"|"+h.cont;
    (byHome[k]=byHome[k]||[]).push(type);
  }
  const loose={};
  for(const it of Object.values(G.items)){
    if(it.token || it.isNote || it.loc.kind==="used") continue;
    (loose[it.type]=loose[it.type]||[]).push(it);
  }
  let lastRoom=null, lastCont=null, lastRow=0, lastCol=0, lastItem=null;
  for(const room of G.rooms) for(const c of room.containers){
    if(c.lock) c.lock.open=true;              /* a debug key for every lock */
    (byHome[room.id+"|"+c.id]||[]).forEach((type,row)=>{
      if(row>=c.cells.length) return;
      const items=loose[type]||[];
      for(let col=0;col<c.cells[row].length;col++){
        const it=items[col];
        if(!it) continue;
        c.cells[row][col]=it.id;
        it.loc={kind:"cell",room:room.id,cont:c.id,row,col};
        /* Count them as clean first-time placements so the win screen's
           accuracy line reads like a game rather than a 0%. */
        if(!it.judged){ it.judged=true; G.stats.tosses++; G.stats.firstGood++; }
        lastRoom=room; lastCont=c; lastRow=row; lastCol=col; lastItem=it;
      }
    });
  }
  for(const l of G.locks) l.open=true;
  if(!lastItem) return false;
  /* Pull the very last one back out, then place it properly — that one real
     placement is what fires the whole celebration chain. */
  lastCont.cells[lastRow][lastCol]=null;
  G.current=lastRoom.id; G.visited.add(lastRoom.id);
  if(G.openCont!==null && G.openCont!==lastCont.id) closeCont();
  render();
  lastCont.cells[lastRow][lastCol]=lastItem.id;
  lastItem.loc={kind:"cell",room:lastRoom.id,cont:lastCont.id,row:lastRow,col:lastCol};
  afterMutation(lastRoom,lastCont,[lastRow]);
  return true;
}

$("#debugFinish").addEventListener("click",()=>{
  /* The gear is an .overlay at z-index 120 and the client is at 100, so the
     ending would play behind this panel. */
  $("#gearOverlay").classList.remove("open");
  if(!finishJob()) say("Nothing to finish — start a job first.");
});

/* Where are the keys. Rings every token still loose, in every room, and lifts
   it above whatever it is hiding under — generation buries them on purpose, so
   this is the only way to check a level is findable rather than merely
   solvable. Names the rooms too, since the one you want is usually elsewhere.

   It is a FLASH, not a mode: it points, then gets out of the way. Anything
   that means "yes, I've seen it" ends it early — tapping the key it is
   pointing at, or pressing the button again. */
let revealTimer=null;
function stopReveal(repaint=true){
  clearTimeout(revealTimer); revealTimer=null;
  if(!G.reveal) return;
  G.reveal=false;
  $("#debugKeys").textContent="Reveal";
  if(repaint && G.active) renderRoom();
}
function startReveal(){
  clearTimeout(revealTimer);
  G.reveal=true;
  $("#debugKeys").textContent="Hide";
  renderRoom();
  revealTimer=setTimeout(()=>stopReveal(), REVEAL_MS);
}

$("#debugKeys").addEventListener("click",()=>{
  if(!G.active) return;
  $("#gearOverlay").classList.remove("open");
  if(G.reveal){ stopReveal(); return; }
  startReveal();
  const where={};
  for(const it of Object.values(G.items)){
    if(!it.token || it.loc.kind!=="floor") continue;
    const room=G.rooms[it.loc.room].name;
    (where[room]=where[room]||[]).push(it.type);
  }
  const rooms=Object.entries(where);
  say(rooms.length
    ? rooms.map(([room,ks])=>ks.join("")+" "+room).join(" · ")
    : "Nothing left on the floor — every key has been used.",
    {ms:REVEAL_MS, priority:2});
});

/* A TOGGLE, not a one-way switch, and it reports its own state on the button:
   this is the one debug control whose effect is invisible until you open
   another screen, so a button that always says the same thing would leave you
   guessing whether the last press turned it on or off. */
function syncUnlockBtn(){
  const b=$("#debugUnlock");
  if(!b) return;
  const on=debugUnlocked();
  b.textContent = on ? "On ✓" : "Unlock";
  b.classList.toggle("dbgon", on);
}
$("#debugUnlock").addEventListener("click",()=>{
  setDebugUnlock(!debugUnlocked());
  syncUnlockBtn();
  $("#gearOverlay").classList.remove("open");
  /* Straight to the board, because the board is the whole point of the button
     and it is where the change is visible. Any run in progress is untouched —
     this writes one localStorage key and nothing else. */
  openCampaignMenu();
});

$("#debugRelock").addEventListener("click",()=>{
  clearDone();
  $("#gearOverlay").classList.remove("open");
  /* No toast: #toast is z-index 95 and the board is 120, so a confirmation
     would be printed behind it. The board redrawing with one job open says it
     better anyway. */
  openCampaignMenu();
});

/* ============================================================
   VERSION AND FORCE REFRESH

   Installed to a home screen, this is a plain web page with no update
   mechanism: the browser keeps serving whatever it cached, and DATA_VERSION
   can't help because the thing that carries it — config.js — is cached too.
   Deleting the app and re-adding it worked, and was a ridiculous way to see a
   change you just pushed.

   So: refetch every asset this page actually loaded, with cache:"reload" to
   bypass and overwrite the HTTP cache, then reload. performance's resource
   list is used rather than a hardcoded manifest because it is always exactly
   what the app loaded — a list here would drift the first time a file was
   added.
============================================================ */
/* When this copy of index.html was made. If it's cached, this is the CACHED
   copy's date — which is the useful reading: it tells you how old what you're
   holding is. */
function copyDate(){
  const d=new Date(document.lastModified);
  return isNaN(d.getTime()) ? "" :
    d.toLocaleString(undefined,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}

async function forceRefresh(btn){
  if(btn){ btn.disabled=true; btn.textContent="…"; }
  const base=location.origin+location.pathname.replace(/[^/]*$/,"");

  /* Drop only OUR files from any service-worker cache. The portfolio at the
     repo root registers a cache-first worker scoped to "/", and blowing its
     whole cache away to update this game would be rude to every other app on
     the site. */
  try{
    if(window.caches){
      for(const key of await caches.keys()){
        const cache=await caches.open(key);
        for(const req of await cache.keys()){
          if(req.url.startsWith(base)) await cache.delete(req);
        }
      }
    }
  }catch(e){/* no Cache API, or a cross-origin entry we may not touch */}

  const urls=new Set([location.href.split("#")[0]]);
  for(const e of performance.getEntriesByType("resource")){
    if(e.name.startsWith(location.origin)) urls.add(e.name);
  }
  /* Failures are ignored on purpose: offline, the reload should still bring
     the app up from cache rather than leaving a dead button. */
  await Promise.all([...urls].map(u=>fetch(u,{cache:"reload"}).catch(()=>{})));
  location.reload();
}

$("#refreshBtn").addEventListener("click",e=>forceRefresh(e.currentTarget));

$("#debugStar").addEventListener("click",()=>{
  G.points++; G.starsEarned++; renderHUD();
  /* Say so out loud. Otherwise this button appears broken on any level with
     `"talents": false`, which is now most of the early campaign. */
  if(!G.talents){ say("+1 ⭐ (debug) — this level has talents off"); return; }
  checkDraftThreshold();
  if(!drainDrafts(()=>false)) say("+1 ⭐ (debug)");
});
$("#shopBtn").addEventListener("click",()=>{ fire("shop"); renderTalents(); $("#shopOverlay").classList.add("open"); });

/* ---- audio settings ---- */
(function wireAudioUI(){
  const m=$("#volMaster"), s=$("#volSfx"), u=$("#volMusic"), b=$("#muteBtn");
  const sync=()=>{
    m.value=Math.round(audioSettings.master*100);
    s.value=Math.round(audioSettings.sfx*100);
    u.value=Math.round(audioSettings.music*100);
    b.textContent=audioSettings.muted?"🔇":"🔊";
  };
  m.addEventListener("input",()=>setVolume("master",m.value/100));
  s.addEventListener("input",()=>{ setVolume("sfx",s.value/100); sfx("uiTap"); });
  /* No confirmation blip on this one: the track itself is the feedback. */
  u.addEventListener("input",()=>setVolume("music",u.value/100));
  b.addEventListener("click",()=>{ setMuted(!audioSettings.muted); sync(); if(!audioSettings.muted) sfx("uiTap"); });
  $("#gearBtn").addEventListener("click",sync);
  sync();
})();

/* ============================================================ */
function closeMenus(){
  ["titleOverlay","campaignOverlay","sizeOverlay","winOverlay","helpOverlay","gearOverlay","shopOverlay"]
    .forEach(id=>document.getElementById(id).classList.remove("open"));
  $("#contView").classList.remove("open");
}

/* A run ending takes its unfinished business with it: queued celebrations and
   queued messages both belong to the run that queued them, and a "Kitchen is
   all tidy ✨" arriving over the title screen belongs to nobody. */
function endCeremony(){ clearBeats(); clearSay(); hideClient(); stopReveal(false); }

function showTitle(){
  closeMenus();
  endCeremony();
  endRun();
  applyTheme();          /* endRun cleared G.active — drop back to house colours */
  const save=peekSave();
  setHidden($("#btnContinue"), !save);
  if(save) labelContinue(save);
  $("#titleOverlay").classList.add("open");
  playMusic("menu");
}

/* Which track this run wants. Free play and anyone without a theme of their
   own get "play"; a client with "music" in clients.json gets theirs, which is
   the whole per-character hook — see data/audio.json. playMusic() ignores a
   request for what's already playing, so calling this on every entry into a
   run (new job, Continue, re-roll) can't restart the track under the player. */
function runMusic(){
  const job = G.mode==="campaign" ? jobAt(G.levelIdx) : null;
  playMusic(job?.client.music || "play");
}

/* "Continue" on its own asks you to remember what you were in the middle of,
   which after a day away you don't. It used to name the client and the job on a
   one-line subtitle; it is now the SAME card the win screen uses, because the
   thing that pulls somebody back into a half-tidied house is the person waiting
   in it. The win screen says "here is who wants to hire you"; this says "here is
   who you left standing there".

   It reads the save through peekSave() and never loads it — pressing the button
   is still what installs the run — so everything here has to come out of the
   parsed JSON: the room you were in, the count still on the floor, and the job
   the level id resolves to. */
function labelContinue(d){
  const b=$("#btnContinue");
  const S=DATA.strings.titleScreen||{};
  const left=itemsLeft(d.items, d.typeHome);
  const room=(d.rooms||[]).find(r=>r.id===d.current);
  /* Two phrasings rather than one with a number that might be zero: showWin()
     clears the save, so a finished run should never be resumable, but "Still 0
     things on the floor" is a sentence worth making unreachable by construction. */
  const where = tokenise(left ? (S.leftOff||"") : (S.leftOffClear||""), {left});
  /* THE ROOM IS A FOOTER LABEL, NOT PART OF A SENTENCE. Room names carry their
     own articles and they disagree: "Kitchen" wants "the", "The Familiar's Roost"
     already has one, "Hydroponics" wants none. "You left off in the {room}" gave
     "in the the Familiar's Roost" and "in the Hydroponics" on the same build. In
     the footer, uppercased next to the id, no article is implied by anything. */
  const at = room ? " · " + room.name : "";

  if(d.mode==="campaign"){
    /* Same id-first resolution as loadGame(), so the card can never name a
       different job than the one Continue is about to open. */
    const idx = (d.levelId!=null && LOOKUP.levelIdxById[d.levelId]!=null)
      ? LOOKUP.levelIdxById[d.levelId] : d.levelIdx;
    const lv=LEVELS[idx], job=jobAt(idx);
    /* No lv means loadGame() will discard this save. Fall back to the plain
       button rather than promising a job that is not there. */
    if(lv && job){
      fillJobCard(b, {
        tag:  S.continueTag || "Continue",
        chip: S.chipMidJob  || "In progress",
        face: job.client.emoji,
        name: job.client.name,
        body: where,
        /* Their own words about THIS job, still outstanding. The hook is not
           reused: it is about how they found you, which is settled by now. */
        say:  job.stage.teaser,
        foot: lv.id + at,
      });
      return;
    }
    b.classList.remove("jobcard");
    b.classList.add("menubtn","primary");
    b.textContent = S.continueFallback || "Continue Tidy Job";
    return;
  }

  const sz=SIZES[d.size];
  /* Free play has no client to put a face to, so the WORLD wears one — a 🏠 over
     a half-tidied wizard's tower says nothing about where you were. There is
     nobody to quote either, and fillJobCard() simply omits that line. */
  const th=DATA.themes.themes[d.theme] || DATA.themes.themes[DATA.themes.defaultTheme];
  fillJobCard(b, {
    tag:  S.continueTag || "Continue",
    chip: S.chipFreePlay || "Free play",
    face: th?.icon || DATA.strings.icon || "🧺",
    name: sz ? presetName(sz) : (S.continueFallback || "Continue Tidy Job"),
    body: where,
    /* Not the theme's label — for every world preset that is the same string as
       the name directly above it ("Frat House" over "Frat House"). */
    foot: (d.rooms||[]).length + " rooms" + at,
  });
}

/* generate() returns a run; setRun installs it along with the metadata that
   says which config produced it. In v3 generate() overwrote the global and
   these three fields had to be patched back on afterwards. */
function startFree(sizeKey){
  clearSave();
  closeMenus();
  endCeremony();
  const cfg=SIZES[sizeKey];
  setRun(generate(cfg), {mode:"free", size:sizeKey, levelIdx:null});
  resetZoom();
  setHidden(shopBtn, false);   /* always available in free play */
  render();
  runMusic();
  say(presetName(cfg)+" — happy tidying");
}

function startCampaign(i){
  clearSave();
  closeMenus();
  endCeremony();
  const lv=LEVELS[i];
  setRun(generate(lv), {mode:"campaign", levelIdx:i, size:null});
  /* A level starts with nothing learned — see clearTalents() above. The key
     is purged rather than ignored so a save written by the carry-over build
     can't come back later. */
  clearTalents();
  resetZoom();
  /* Hidden until it means something. In v3 it sat there showing "⭐ 0" over
     an all-unaffordable list from level 1-1 onward, which mostly taught
     players to ignore it. */
  setHidden(shopBtn, !Object.values(G.up).some(v=>v>0));
  render();
  runMusic();

  /* The client turns up. AFTER render(), so the house they are describing is
     already on screen behind them.

     The blurb toast is dropped when someone is here to say it: it is
     instruction copy the teaching tips already deliver word for word, and a
     strip sliding out from under the HUD while a person talks is the "four
     things at once" problem again. The level name lands as they leave —
     showClient() calls clearSay(), so it has to be said afterwards, not before.
     Teaching tips are suppressed for free by modalUp(). */
  const job=jobAt(i);
  const replaying=progress().done.has(lv.id);
  if(job?.stage.intro?.length){
    const lines=[...job.stage.intro];
    if(replaying && job.stage.replay) lines[0]=job.stage.replay;
    showClient(job.client.emoji, lines, {
      onDone(){ say(lv.id+" · "+lv.name, {priority:2}); },
    });
  }else{
    say(lv.id+" · "+lv.name, {priority:2});
    say(tokenise(lv.blurb, textVars()), {priority:1});
  }
}

/* Values available to {tokens} in level blurbs, tips and help copy. */
function textVars(){
  return { handSlots:G.inv.length||INV_SIZE, rowLen:G.rowLen||5 };
}

/* ============================================================
   THE JOB BOARD

   ONE TILE PER LEVEL, IN THE ORDER YOU PLAY THEM. It used to group levels
   under the client who hired you: a stack of cards, each with a face, a
   quote and its own list of level rows. That read as a tall column of text
   with small faces in it, and the faces are the point — so the grouping is
   gone. The grid is levels.json order, which is also play order, and each
   tile is a big face saying who that job is for. Two clients' arcs
   interleave; you can see that in the grid without anyone explaining it.

   Every piece of state is still derived from the single progress integer —
   nothing here is stored. A tile is done / now / locked by comparing its
   index to progress, and a client is a SILHOUETTE until you have met them.
============================================================ */
/* FOUR states, not three. "open" is the one insertion made necessary: a job
   you can play, have not played, and which is not the next one up — which is
   what a level dropped in behind an existing player's frontier looks like. It
   needs no styling of its own; it is simply not dimmed and not ringed. */
const stageState = (idx, p) =>
  p.done.has(LEVELS[idx].id) ? "done"
  : idx === p.now            ? "now"
  : idx <= p.frontier        ? "open"
  : "locked";

function jobTile(job, idx, p){
  const S=DATA.strings.jobBoard||{};
  const st=stageState(idx, p);
  /* FACES ARE RATIONED. Everything you've worked and the job you can start
     show their client outright. Exactly ONE job ahead is a tease: the face is
     there but greyed, so you can see who's coming and equally see that you
     can't have them yet. Everything past that is a silhouette. Showing a
     client's whole arc at once spent the arrival of every one of their jobs
     the moment you met them. */
  const seen=idx<=p.frontier, peek=idx===p.frontier+1;
  const b=document.createElement("button");
  b.className="jtile "+st+(seen?"":peek?" next":" unknown");
  b.disabled = st==="locked";
  /* Who hired you goes above the head, the job itself goes below it: the name
     is a label on the face, the title is what the tile is actually offering. */
  b.appendChild(mkEl("span","jname",seen||peek?job.client.name:(S.lockedTile||"???")));
  /* A generic figure, not their own emoji blacked out: 👽 and 🧑‍🎓 are still
     recognisable as shapes, which gives the surprise away a job early. */
  b.appendChild(mkEl("span","jface",seen||peek?job.client.emoji:"🧑"));
  b.appendChild(mkEl("span","jtitle",job.level.name));
  b.appendChild(mkEl("span","jid",job.level.id));
  if(st==="done") b.appendChild(mkEl("span","jmark","✅"));
  if(st!=="locked") b.addEventListener("click",()=>startCampaign(idx));
  return b;
}

/* A client written into clients.json with no stages yet — see `soon`. There
   are none today (all six are real), but the data model promises they'd show
   up, and a silhouette that silently vanishes is the sort of thing you only
   notice months later. One tile each, at the end, unclickable. */
function soonTile(arc){
  const S=DATA.strings.jobBoard||{};
  const b=document.createElement("button");
  b.className="jtile locked unknown";
  b.disabled=true;
  b.appendChild(mkEl("span","jname",S.lockedTile||"???"));
  b.appendChild(mkEl("span","jface","🧑"));
  b.appendChild(mkEl("span","jtitle",arc.client.teaser||""));
  b.appendChild(mkEl("span","jid","SOON"));
  return b;
}

function openCampaignMenu(){
  closeMenus();
  const p=progress();
  const S=DATA.strings.jobBoard||{};
  if(S.title) $("#boardTitle").textContent=S.title;
  const total=LOOKUP.levelByIdx.length;
  /* The real count of finished jobs, not the frontier — after an insertion
     those differ, and "13 of 25" while one behind you is unplayed would be a
     lie the board tells every time you open it. */
  $("#boardSub").textContent = tokenise(S.sub||"", {
    done:Math.min(p.count,total), total,
  }) + (p.unlocked ? "  ·  🔓 debug: all jobs open" : "");
  /* A board with everything open has to SAY it is a debug board. Without this
     there is no way to tell a real 34-of-34 from an unlocked one — not from a
     screenshot, and not from a bug report a week later. Same reasoning as
     nowPlaying() in the gear. */

  const board=$("#jobBoard"); board.innerHTML="";
  let current=null;
  LOOKUP.levelByIdx.forEach((lv, i)=>{
    const job=jobAt(i);
    if(!job) return;                       /* validate.js makes this impossible */
    const tile=jobTile(job, i, p);
    if(i===p.now) current=tile;
    board.appendChild(tile);
  });
  for(const arc of LOOKUP.arcs) if(arc.soon) board.appendChild(soonTile(arc));

  $("#campaignOverlay").classList.add("open");
  /* Twenty-two tiles don't fit on a phone, and the one you want is the one
     you can play. Centre it by hand rather than scrollIntoView(), which on a
     nested scroller will happily scroll the page behind the overlay too.
     Rects, not offsetTop: #jobBoard isn't a positioned ancestor, so offsetTop
     is measured from the overlay and lands the wrong side of a row. After
     .open, so the board has a height to measure at all. */
  if(current){
    const cr=current.getBoundingClientRect(), br=board.getBoundingClientRect();
    board.scrollTop = Math.max(0,
      board.scrollTop + (cr.top - br.top) - (br.height - cr.height)/2);
  }
  /* Assignment, not addEventListener: openCampaignMenu runs every time the
     board is opened and stacked listeners would be a slow leak. */
  board.onscroll = ()=>fadeBoardEnd(board);
  fadeBoardEnd(board);
}

/* The bottom fade is the only "more below" affordance, so it has to switch off
   at the end of the list — see #jobBoard.atEnd in css/overlays.css. */
function fadeBoardEnd(board){
  board.classList.toggle("atEnd",
    board.scrollTop >= board.scrollHeight - board.clientHeight - 2);
}

function resetRun(){
  clearSave();
  closeMenus();
  endCeremony();
  const cfg=currentCfg();
  setRun(generate(cfg), {mode:G.mode, levelIdx:G.levelIdx, size:G.size});
  render();
}

/* menu wiring */
$("#btnContinue").addEventListener("click",()=>{
  if(loadGame()){ closeMenus(); render(); runMusic(); say("Welcome back"); }
  else { setHidden($("#btnContinue"), true); say("No save found"); }
});
$("#btnCampaign").addEventListener("click",openCampaignMenu);
$("#btnFree").addEventListener("click",()=>{ closeMenus(); $("#sizeOverlay").classList.add("open"); });
/* Every overlay shares z-index 120, so DOM order decides who paints on top
   and #titleOverlay is declared last. Opening help without closing the title
   first left the help card behind an opaque backdrop, unreadable and
   unclickable. Close first, and send Got-it back to the title. */
$("#btnHow").addEventListener("click",()=>{
  closeMenus();
  helpReturnsToTitle=true;
  $("#helpOverlay").classList.add("open");
});
$("#campBack").addEventListener("click",showTitle);
$("#sizeBack").addEventListener("click",showTitle);
$("#menuBtn").addEventListener("click",()=>{ saveGame(); showTitle(); });

/* The Free Play menu is built from sizes.json, and the item count is COMPUTED
   (targetTypes x rowLen). v3 hardcoded "~50 items" in the markup alongside an
   `items:` field in the config that generate() never read — three numbers for
   one quantity, none of them authoritative. */
/* `group` splits the grid under headings. Free play used to be four house
   sizes, so the labels alone ("Small", "Mega") answered the only question
   there was. With a preset per world in the same list, "Mega" and "The Zoo"
   read as answers to two different questions, and a player scanning for the
   new worlds has to know which of the nine words are places. A heading per
   group costs one span and says it outright.
   Ungrouped presets keep the top of the list with no heading at all, so the
   house sizes look exactly as they always did. */
function buildSizeMenu(){
  const grid=$("#sizeOverlay .sizegrid");
  grid.innerHTML="";
  let group=null;
  for(const s of DATA.sizes.sizes){
    if((s.group||null)!==group){
      group=s.group||null;
      if(group) grid.appendChild(mkEl("h2","sizehead",group));
    }
    const b=mkEl("button","menubtn");
    b.appendChild(document.createTextNode(s.label));
    b.appendChild(mkEl("small",null,"~"+itemCount(s).toLocaleString()+" items"));
    b.addEventListener("click",()=>startFree(s.id));
    grid.appendChild(b);
  }
}

/* Help copy lives in strings.json so the rename, the hand count and the row
   length can never drift out of sync with the game again. */
function buildHelp(){
  const s=DATA.strings, v={handSlots:INV_SIZE, rowLen:5};
  document.title=s.title;
  $("#titleVersion").textContent="v"+VERSION;
  const when=copyDate();
  $("#gearVersion").textContent="v"+VERSION+(when?" · this copy "+when:"")+
    ". Refresh pulls the newest build.";
  for(const h of document.querySelectorAll("#helpOverlay h1,#titleOverlay h1")) h.textContent=s.title;
  $("#titleOverlay .tagline").textContent=s.tagline;
  /* strings.json carried an `icon` that nothing read, so the title screen's
     emoji was whatever index.html said and the two could disagree. */
  if(s.icon) $("#titleOverlay .big").textContent=s.icon;
  $("#helpOverlay p").textContent=tokenise(s.helpIntro,v);
  const ul=$("#helpOverlay .gestures");
  ul.innerHTML="";
  for(const b of s.helpBullets){
    const li=document.createElement("li");
    li.appendChild(mkEl("b",null,b.b));
    li.appendChild(document.createTextNode(" "+tokenise(b.text,v)));
    ul.appendChild(li);
  }
}

/* Console handle for poking at a run: `tidy.G`, `tidy.DATA`, `tidy.start('mega')`. */
window.tidy = {
  G, DATA, LOOKUP, start:startFree, level:startCampaign, render, generate, setRun, sfx,
  /* handy from the console, and what the browser tests drive */
  dropNote:maybeDropNote, openNote, checkQuests, completeQuest,
  afterMutation, openContainer, closeCont,
  insertKey, insertContainerKey, flingToFloor, showWin, displaceAround,
  tossInto, cascade, pickUp, openDraft,
  /* The SAVE ROUND-TRIP. Continue is the one entry point that restores state
     rather than generating it, so it is where state that was never written
     shows up — and that is exactly how the talent draft came to re-grant every
     draft a player had already taken, one per container they closed. There was
     no way to exercise it from here, which is a large part of why it survived
     as long as it did. */
  saveGame, loadGame, clearSave, checkDraftThreshold, maybeDraft, finishJob,
  /* `tidy.unlockAll()` / `tidy.unlockAll(false)` / `tidy.progress()`. The gear
     button is the same call; this is here because "open every job" is a thing
     you want mid-thought without hunting for a panel. */
  unlockAll:on=>{ const v=setDebugUnlock(on!==false); syncUnlockBtn(); return v; },
  progress, relockAll:()=>{ clearDone(); return progress(); },
  jobAt, showClient, hideClient, isSpeaking, board:openCampaignMenu,
  itemAt, underAt, onInk, maskStats,
  playMusic, nowPlayingMusic, musicDebug, audio:audioSettings,
};

/* boot: land on the title screen */
buildSizeMenu();
buildHelp();
showTitle();
