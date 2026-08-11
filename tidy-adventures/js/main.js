/* ============================================================
   TIDY ADVENTURES — main module

   Mid-refactor: the leaf modules (config, util, dom, data, validate,
   state, geometry, generate) have been split out; the render, action and
   input tiers still live here. See docs/CLAUDE.md for the target graph.
============================================================ */
import {
  SAVE_VERSION, SAVE_KEY, PROGRESS_KEY, TALENTS_KEY, SAVE_DEBOUNCE,
  INV_SIZE, DIRS, OPP, CHEVRON, ZOOM_MAX as ZOOM,
  DOUBLE_TAP_MS, DOUBLE_TAP_SLOP, DRAG_THRESHOLD, CELL_DRAG_THRESHOLD,
  PINCH_TAP_SUPPRESS_MS, T,
} from './config.js';
import { rnd, shuffle, clamp, tokenise, plural } from './util.js';
/* `el` is aliased: this file has many local `const el = ...` inside render
   functions, and an unaliased import would be shadowed confusingly. */
import {
  $, host, invBar, contGrid, shopBtn, whirlBtn, setHidden, el as mkEl,
} from './dom.js';
import { say, bump, flyReward, roomCompleteFX, clearSay } from './feedback.js';
import {
  DATA, LOOKUP, loadData, nameOf, costFor, maxLevel,
  itemCount, upgradeParam, upgradeDefaults,
} from './data.js';
import { G, setRun, endRun } from './state.js';
import { inShape, findFloorSpot, spin, pad } from './geometry.js';
import { generate } from './generate.js';
import {
  camEl, roomEl, applyCam, clampPan, zoomAt, zoomBy, wheelZoom, panBy,
  resetPan, resetZoom, isZoomed, camScale, setCamSmooth,
} from './camera.js';
import {
  initTalents, checkDraftThreshold, drainDrafts, renderTalents, openDraft,
} from './talents.js';
import { initAudio, play as sfx, settings as audioSettings, setVolume, setMuted } from './audio.js';
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
const WHIRL_CD = upgradeParam("whirl", "cooldownMs", 60000);

function getProgress(){ try{ return Math.max(0, parseInt(localStorage.getItem(PROGRESS_KEY)||"0",10)||0); }catch(e){ return 0; } }
function setProgress(n){ try{ localStorage.setItem(PROGRESS_KEY, String(n)); }catch(e){} }
function currentCfg(){ return G.mode==="campaign" ? LEVELS[G.levelIdx] : SIZES[G.size]; }

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

function positionTips(){
  const layer=document.getElementById("tipLayer");
  if(!layer.children.length) return;
  for(const b of layer.children){
    const t=tipById(b.dataset.kind);
    const el=t && tipTarget(t);
    if(!el || document.querySelector(".overlay.open") || G.openCont!==null){
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
      mode:G.mode, levelIdx:G.levelIdx, size:G.size, rowLen:G.rowLen,
      current:G.current, inv:G.inv, sel:G.sel,
      stats:{tosses:G.stats.tosses, firstGood:G.stats.firstGood, elapsed:Date.now()-G.stats.start},
      visited:[...G.visited], awarded:[...G.awarded], tipsDone:[...(G.tipsDone||new Set())],
      points:G.points, up:G.up,
      whirlRemain:Math.max(0, G.whirlReady-Date.now()),
    }));
  }catch(e){/* storage unavailable in this environment */}
}
/* Does a save exist that this build can actually load? showTitle() used to
   check only that the key existed, so a stale save showed a Continue button
   that failed the moment you pressed it. */
function hasSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    return JSON.parse(raw).v===SAVE_VERSION;
  }catch(e){ return false; }
}
function loadGame(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const d=JSON.parse(raw);
    if(d.v!==SAVE_VERSION) return false;
    /* Tips come from levels.json, not the save, so editing tip text can't
       corrupt a run in progress. */
    const lv = d.mode==="campaign" ? LEVELS[d.levelIdx] : null;
    setRun({
      rooms:d.rooms, items:d.items, typeHome:d.typeHome, locks:d.locks,
      rowLen:d.rowLen||5, theme:d.theme||DATA.themes.defaultTheme,
      tips:(lv?.tips||[]).map(t=>({...t})),
      tipsDone:new Set(d.tipsDone||[]),
      tipShown:new Set(d.tipsDone||[]),
      events:new Set(d.events||[]),
      current:d.current, cam:"room", pan:{x:0,y:0},
      inv:d.inv, sel:d.sel, openCont:null,
      stats:{tosses:d.stats.tosses, firstGood:d.stats.firstGood, start:Date.now()-d.stats.elapsed},
      visited:new Set(d.visited),
      awarded:new Set(d.awarded||[]),
      taught:new Set(d.taught||[]),
      roomFxDone:new Set(d.roomFxDone||[]),
      points:d.points||0,
      starsEarned:d.starsEarned??d.points??0,
      up:{...upgradeDefaults(), ...(d.up||{})},
      whirlReady:Date.now()+(d.whirlRemain||0),
    },{
      mode:d.mode||"free",
      levelIdx:(d.levelIdx==null?null:d.levelIdx),
      size:(SIZES[d.size]?d.size:null),
    });
    return true;
  }catch(e){ return false; }
}
function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ============================================================
   RULES — completion, not verdicts
============================================================ */
function rowIsComplete(c,row){
  const ids=c.cells[row];
  if(ids.some(v=>v===null)) return false;
  const t=G.items[ids[0]].type;
  if(!ids.every(id=>G.items[id].type===t)) return false;
  const home=G.typeHome[t];
  return home.room===c.roomId && home.cont===c.id;
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
    /* the pips already show this */
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
    o.loc={kind:"floor",room:room.id,
      x:Math.max(4,Math.min(95,cx+Math.cos(a)*d)),
      y:Math.max(4,Math.min(95,cy+Math.sin(a)*d)),
      rot:Math.random()*50-25};
  }
  G.points++; G.starsEarned++;
  sfx("cacheOpen"); say("Pop! The coin box bursts open ✨");
  renderRoom(); renderHUD();
  flyReward(host.querySelector(`.cache[data-cache="${cacheIdx}"]`) || host, "+1 ⭐");
  return true;
}

/* Does this held item open that lock? Matching is by token TYPE, not by
   instance: generation makes exactly one 🗝️ per 🗝️ lock so it plays as
   one-to-one, but two identical keys never behave differently — per-instance
   matching would be invisible to the player and would reintroduce exactly the
   guess-the-key problem the roadmap already ruled out. */
function fitsLock(lock, it){
  if(!lock || !it) return false;
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
    /* the pips already show this */
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

function buildRoomEl(room){
  const el=document.createElement("div");
  el.className="room shape-"+(room.shape||"rect");
  const sw=room.sw||1, sh=room.sh||1;
  el.style.width=(sw*100)+"%";
  el.style.height=(sh*100)+"%";
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
    let sense="";
    if(G.up.sense && G.sel!==null && G.inv[G.sel]!==null){
      const held=G.items[G.inv[G.sel]];
      if(!held.isKey){
        const home=G.typeHome[held.type];
        if(home.room===room.id && home.cont===c.id) sense=" sense";
      }
    }
    f.className="furn k-"+c.kind+(locked?" flocked":"")+(containerComplete(c)&&!locked?" aura":"")+sense;
    f.dataset.cont=c.id;
    f.style.cssText=`left:${s.x}%;top:${s.y}%;width:${s.w}%;height:${s.h}%;`;
    const badges=document.createElement("div"); badges.className="badges";
    if(locked){
      /* Show the key this lock actually wants rather than a generic 🔒, so
         the requirement is legible at a glance — no guess-the-key. */
      const ic=document.createElement("span");
      ic.textContent=LOOKUP.tokenById[c.lock.token||"key"]?.emoji || "🔒";
      badges.appendChild(ic);
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
      // badge strip: unique types inside, gold if that set is complete
      const inside=new Set();
      for(const rowIds of c.cells) for(const id of rowIds) if(id!==null) inside.add(G.items[id].type);
      for(const t of inside){
        const sp=document.createElement("span");
        sp.textContent=t;
        if(typeCompleteIn(c,t)) sp.classList.add("gold");
        badges.appendChild(sp);
      }
    }
    f.appendChild(badges);
    const lbl=document.createElement("div"); lbl.className="flabel";
    lbl.textContent=c.short||c.name;   /* short fits the face; name is used in titles */
    f.appendChild(lbl);
    el.appendChild(f);
  }
  /* A room you finished keeps something of its own. See data/props.json —
     walking back in and finding a cat asleep does more for "this is a place"
     than a feature would. */
  if(G.roomFxDone.has(room.id)){
    const p=DATA.props.props[room.defId];
    if(p){
      const pe=document.createElement("div");
      pe.className="prop";
      pe.title=p.title||"";
      pe.textContent=p.emoji;
      pe.style.cssText=`left:${p.at[0]}%;top:${p.at[1]}%;`;
      el.appendChild(pe);
    }
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
  for(const it of Object.values(G.items)){
    if(it.loc.kind!=="floor"||it.loc.room!==room.id||it.flying) continue;
    const sp=document.createElement("div");
    sp.className="item";
    sp.dataset.item=it.id;
    sp.textContent=it.type;
    sp.style.cssText=`left:${it.loc.x}%;top:${it.loc.y}%;transform:translate(-50%,-50%) rotate(${it.loc.rot}deg) scale(0.43);`;
    el.appendChild(sp);
  }
  return el;
}

/* #roomHost > .cam > .room — the camera owns zoom/pan, the room owns the
   slide and bounce animations. They shared one transform in v3, which is why
   bounce() had to repair the camera afterwards. */
function renderRoom(){
  host.innerHTML="";
  const cam=document.createElement("div");
  cam.className="cam smooth";
  cam.appendChild(buildRoomEl(G.rooms[G.current]));
  host.appendChild(cam);
  applyCam();
}

function render(){
  renderRoom();
  renderHUD();
  renderInv();
  renderTips();
  renderObjective();
  if(G.openCont!==null) renderContainer();
}

function slideTo(dir,newId){
  const old=roomEl();
  const [dx,dy]=DIRS[dir];
  const hr=host.getBoundingClientRect();
  const px=dx*(hr.width+80), py=dy*(hr.height+80);
  G.current=newId; G.visited.add(newId);
  fire("door");
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

function renderHUD(){
  const room=G.rooms[G.current];
  const done=roomComplete(room);
  const rn=$("#roomName");
  rn.classList.toggle("done",done);
  rn.innerHTML=`${room.name}<small>${done?"all tidy ✨":"swipe through doors"}</small>`;
  const left=Object.values(G.items).filter(i=>{
    if(i.loc.kind==="used") return false;
    if(i.loc.kind!=="cell") return true;
    const c=G.rooms[i.loc.room].containers[i.loc.cont];
    return !rowIsComplete(c,i.loc.row);
  }).length;
  $("#remaining").textContent=left+" left";
  $("#shopBtn").textContent="⭐ "+G.points;
  updateWhirlBtn();
  drawMinimap();
  scheduleSave();
}

function updateWhirlBtn(){
  const b=$("#whirlBtn");
  if(!G.up.whirl){ b.hidden=true; return; }
  b.hidden=false;
  const remain=G.whirlReady-Date.now();
  if(remain>0){ b.classList.add("cool"); b.textContent=Math.ceil(remain/1000)+"s"; }
  else{ b.classList.remove("cool"); b.textContent="🌀"; }
}
setInterval(()=>{ if(G && G.up.whirl) updateWhirlBtn(); },1000);

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
      if(id!==null) cell.textContent=G.items[id].type;
      rowEl.appendChild(cell);
    }
    grid.appendChild(rowEl);
  }
  $("#contView").classList.add("open");
}

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
     container is already saying "complete". */
  if(earned){
    const fe=host.querySelector(`.furn[data-cont="${c.id}"]`) || contGrid;
    flyReward(fe, "+"+earned+" ⭐");
  }
  if(contDone){
    sfx("contComplete");
    fire("contComplete", {container:c.short||c.name});
    /* First container finished in a room? Someone leaves you a note. */
    if(maybeDropNote(room)) renderRoom();
  }
  else if(newly.length) sfx("rowComplete");
  if(newly.length) fire("rowComplete", {container:c.short||c.name});

  /* Room completion is the biggest moment in the game and v3 marked it with
     a 1400ms toast. Now the gold visibly travels outward from the centre. */
  if(roomComplete(room) && !G.roomFxDone.has(room.id)){
    G.roomFxDone.add(room.id);
    sfx("roomComplete");
    roomCompleteFX(roomEl());
    renderRoom();   /* the room's prop appears */
    say(room.name+" is all tidy ✨", {priority:2});
    fire("roomComplete", {room:room.name});
  }
  const finishedQuest=checkQuests();
  if(finishedQuest) completeQuest(finishedQuest);
  renderHUD();
  checkDraftThreshold();
  if(checkWin()) setTimeout(showWin,T.winDelay);
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
  let extra=0;
  if(G.up.magnet){
    const near=Object.values(G.items)
      .filter(o=>o.id!==it.id && o.loc.kind==="floor" && o.loc.room===G.current
        && o.type===it.type && Math.hypot(o.loc.x-sx,o.loc.y-sy)<=14)
      .sort((a,b)=>Math.hypot(a.loc.x-sx,a.loc.y-sy)-Math.hypot(b.loc.x-sx,b.loc.y-sy));
    for(const o of near){
      const s2=G.inv.indexOf(null);
      if(s2===-1) break;
      o.loc={kind:"inv",slot:s2};
      G.inv[s2]=o.id;
      extra++;
    }
  }
  if(extra) say(nameOf(it.type)+" ×"+(extra+1)+" 🧲", {key:"magnet"});
  render();
}

function tapSlot(i){
  if(G.inv[i]===null) return;
  G.sel = (G.sel===i) ? null : i;
  renderInv();
  if(G.up.sense) renderRoom();
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
  afterMutation(room,c,[spot.row]);
  renderRoom();
  const fe2=host.querySelector(`.furn[data-cont="${contIdx}"]`);
  if(fe2) fe2.classList.add(right?"goldhit":"pophit");
  /* After renderRoom, so `lastEl` anchors to the element that's on screen now. */
  sfx(right ? "gold" : "cold");
  fire("place", {container:c.short||c.name, item:nameOf(it.type), el:fe2});
  if(right) fire("goldPlace", {container:c.short||c.name, el:fe2});
  return true;
}

function displaceAround(roomId,x,y,radius,push){
  radius=radius||13; push=push||9;
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
  }
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

function flingToFloor(slotIdx){
  const id=G.inv[slotIdx];
  if(id===null) return;
  const it=G.items[id];
  const room=G.rooms[G.current];
  let x,y,tries=0;
  do{
    x=8+Math.random()*84; y=8+Math.random()*84; tries++;
  }while(tries<50 && (!inShape(room,x,y) || room.containers.some(c=>{
    const s=c.slot;
    return x>s.x-2 && x<s.x+s.w+2 && y>s.y-4 && y<s.y+s.h+2;
  })));
  const slotEl=invBar.querySelector(`.slot[data-slot="${slotIdx}"]`);
  const sr=slotEl?slotEl.getBoundingClientRect():null;
  it.loc={kind:"floor",room:room.id,x,y,rot:Math.random()*40-20};
  it.flying=true;
  G.inv[slotIdx]=null;
  G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
  render();
  const [tx,ty]=roomPctToScreen(x,y);
  animateFlight(it.type, sr?sr.left+sr.width/2:tx, sr?sr.top:window.innerHeight, tx, ty, ()=>{
    it.flying=false;
    displaceAround(room.id, x, y, 11, 8);
    render();
  });
}

function dropOnFloor(slotIdx,cx,cy,rect){
  const id=G.inv[slotIdx];
  if(id===null) return;
  const it=G.items[id];
  const x=Math.max(4,Math.min(96,(cx-rect.left)/rect.width*100));
  const y=Math.max(4,Math.min(96,(cy-rect.top)/rect.height*100));
  it.loc={kind:"floor",room:G.current,x,y,rot:Math.random()*40-20};
  G.inv[slotIdx]=null;
  G.sel=G.inv.findIndex(v=>v!==null); if(G.sel===-1)G.sel=null;
  render();
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

/* ============================================================
   UPGRADE ACTIONS
============================================================ */
function doWhirl(){
  if(!G.up.whirl) return;
  if(Date.now()<G.whirlReady){ bump(whirlBtn, "⏳"); return; }
  const room=G.rooms[G.current];
  let any=false;
  for(const c of room.containers){
    if(c.lock && !c.lock.open) continue;
    const ids=c.cells.flat().filter(v=>v!==null);
    if(!ids.length) continue;
    // group by type, first-seen order; each type starts a fresh row
    const groups=new Map();
    for(const id of ids){
      const t=G.items[id].type;
      if(!groups.has(t)) groups.set(t,[]);
      groups.get(t).push(id);
    }
    const rows=c.cells.length;
    /* These two were hardcoded to 5. On Mega (rowLen 8) the rebuilt grid was
       3 cells narrower than the real one, so up to 3 items per type were
       dropped out of `cells` while their loc still pointed at a cell that no
       longer held them: counted in "N left" forever, run unwinnable. */
    const len=G.rowLen;
    c.cells=Array.from({length:rows},()=>Array(len).fill(null));
    let r=0, overflow=[];
    for(const [,arr] of groups){
      if(r>=rows){ overflow.push(...arr); continue; }
      let col=0;
      for(const id of arr){
        if(col===len){ break; } // a type never exceeds one row, safety only
        c.cells[r][col]=id;
        G.items[id].loc={kind:"cell",room:room.id,cont:c.id,row:r,col};
        col++;
      }
      r++;
    }
    // safety net for fragmentation: stuff leftovers into remaining cells
    for(const id of overflow){
      const spot=firstEmptyCell(c);
      if(!spot) break;
      c.cells[spot.row][spot.col]=id;
      G.items[id].loc={kind:"cell",room:room.id,cont:c.id,row:spot.row,col:spot.col};
    }
    any=true;
    afterMutation(room,c,[...Array(rows).keys()]);
  }
  if(any){
    G.whirlReady=Date.now()+WHIRL_CD;
    renderRoom(); renderHUD();
    sfx("whirlwind"); say("Whoosh — everything swept into rows 🌀");
  }else bump(whirlBtn, "🫧");
}

/* The draft grants; this repaints and persists. Passed to talents.js as a
   callback so that module never has to import the render tier. */
initTalents({
  grant(){
    saveTalents();
    renderHUD(); renderInv(); updateWhirlBtn();
    fire("talentEarned");
    scheduleSave();
  },
});

/* Campaign talents carry across levels — otherwise the draft is pointless,
   since a level is over in a few minutes. Free play keeps them in the run
   save as before. */
function saveTalents(){
  if(G.mode!=="campaign") return;
  try{
    localStorage.setItem(TALENTS_KEY, JSON.stringify({
      up:G.up, starsEarned:G.starsEarned, draftsTaken:G.draftsTaken, points:G.points,
    }));
  }catch(e){}
}
function loadTalents(){
  if(G.mode!=="campaign") return;
  try{
    const d=JSON.parse(localStorage.getItem(TALENTS_KEY)||"null");
    if(!d) return;
    G.up={...upgradeDefaults(), ...(d.up||{})};
    G.starsEarned=d.starsEarned||0;
    G.draftsTaken=d.draftsTaken||0;
    G.points=d.points||0;
    /* Rebuild hand slots to match. buyUpgrade used to push onto G.inv, so a
       fresh generate() would silently lose every earned slot. */
    const want=INV_SIZE+(G.up.hands||0);
    while(G.inv.length<want) G.inv.push(null);
  }catch(e){}
}
function clearTalents(){ try{ localStorage.removeItem(TALENTS_KEY); }catch(e){} }

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
  if(G.mode==="campaign"){
    const lv=LEVELS[G.levelIdx];
    $("#winTitle").textContent=lv.id+" · "+lv.name+" — complete!";
    $("#winStats").textContent=stats;
    if(G.levelIdx+1>getProgress()) setProgress(G.levelIdx+1);
    if(G.levelIdx+1<LEVELS.length){
      mk("Next level ▶","primary",()=>{ $("#winOverlay").classList.remove("open"); startCampaign(G.levelIdx+1); });
    }
    mk("Level select","",()=>{ $("#winOverlay").classList.remove("open"); openCampaignMenu(); });
    mk("Main menu","ghost",()=>{ $("#winOverlay").classList.remove("open"); showTitle(); });
  }else{
    $("#winTitle").textContent="All tidy.";
    $("#winStats").textContent=stats;
    const sz=SIZES[G.size]||SIZES.medium;
    mk("New "+sz.label.toLowerCase()+" house","primary",()=>{ $("#winOverlay").classList.remove("open"); startFree(SIZES[G.size]?G.size:"medium"); });
    mk("Main menu","ghost",()=>{ $("#winOverlay").classList.remove("open"); showTitle(); });
  }
  $("#winOverlay").classList.add("open");
}

function closeCont(){
  if(G.openCont!==null) sfx("closeCont");
  G.openCont=null;
  $("#contView").classList.remove("open");
  render();
  maybeDraft();   /* closing a container is a safe moment to interrupt */
}

function tryMove(dir){
  const to=G.rooms[G.current].doors[dir];
  if(to===null){ bounce(dir); return; }
  const lock=lockFor(G.current,dir);
  if(lock){
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

  ptr={sx:e.clientX,sy:e.clientY,panX:G.cam.x,panY:G.cam.y,drag:false,id:e.pointerId,
       downTarget:e.target,
       itemEl:e.target.closest(".item"), itemMoved:false, ix:0, iy:0, hotCont:null,
       samples:[{t:performance.now(),x:e.clientX,y:e.clientY}]};
  if(ptr.itemEl) showLoupe(G.items[+ptr.itemEl.dataset.item], ptr.itemEl, e.pointerType);
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
    ptr.itemMoved=true;
    ptr.itemEl.style.pointerEvents="none";
    const rect=roomEl().getBoundingClientRect();
    ptr.ix=Math.max(2,Math.min(97,(e.clientX-rect.left)/rect.width*100));
    ptr.iy=Math.max(2,Math.min(97,(e.clientY-rect.top)/rect.height*100));
    ptr.itemEl.style.left=ptr.ix+"%";
    ptr.itemEl.style.top=ptr.iy+"%";
    ptr.itemEl.style.zIndex=20;
    moveLoupe(ptr.itemEl);
    const under=document.elementFromPoint(e.clientX,e.clientY);
    const cont=under && under.closest(".furn, .door.locked, .cache");
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
            it.flying=true;
            it.loc.x=tx; it.loc.y=ty;
            const el=p.itemEl;
            el.style.transition="left .38s cubic-bezier(.15,.6,.35,1), top .38s cubic-bezier(.15,.6,.35,1), transform .38s linear";
            el.style.left=tx+"%"; el.style.top=ty+"%";
            el.style.transform=`translate(-50%,-50%) rotate(${(it.loc.rot||0)+(vx>0?540:-540)}deg) scale(0.43)`;
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
        it.loc.x=p.ix; it.loc.y=p.iy; scheduleSave();
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
  if(itemEl){ pickUp(+itemEl.dataset.item); lastTap={t:0}; return; }

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

  /* Double-tap-to-zoom on the floor is gone. Pinch (touch) and wheel
     (mouse) replace it, and keeping it would mean a mis-tap between small
     furniture and adjacent floor flips between "a panel opens" and "the
     camera jumps" — a far more jarring error than the old "nothing happens
     vs. zoom". Removing it also deletes the 330ms deferred-tap latency from
     every room interaction. */
});

/* Never interrupt a drag or an open container. */
const busy = () => !!ptr || !!invDrag || !!cellPtr || G.openCont!==null;
function maybeDraft(){ return drainDrafts(busy); }

function openContainer(idx, contEl){
  const c=G.rooms[G.current].containers[idx];
  if(c.lock && !c.lock.open){
    bump(contEl, "🔒", "Locked. Drag keys onto it — the pips show how many are left.", "lockedCont");
    return;
  }
  G.openCont=idx;
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
    const rEl=roomEl();
    if(roomEl){
      const rect=roomEl.getBoundingClientRect();
      if(e.clientX>rect.left && e.clientX<rect.right &&
         e.clientY>rect.top  && e.clientY<rect.bottom){
        dropOnFloor(d.idx,e.clientX,e.clientY,rect);
      }
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
      let x,y,tries=0;
      do{
        x=8+Math.random()*84; y=8+Math.random()*84; tries++;
      }while(tries<50 && (!inShape(room,x,y) || room.containers.some(cc=>{
        const s=cc.slot;
        return x>s.x-2 && x<s.x+s.w+2 && y>s.y-4 && y<s.y+s.h+2;
      })));
      it.loc={kind:"floor",room:room.id,x,y,rot:Math.random()*40-20};
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
$("#contView").addEventListener("pointerup",e=>{ if(e.target.id==="contView") closeCont(); });

/* keyboard */
window.addEventListener("keydown",e=>{
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
$("#gearBtn").addEventListener("click",()=>$("#gearOverlay").classList.add("open"));
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
$("#debugStar").addEventListener("click",()=>{
  G.points++; G.starsEarned++; renderHUD();
  checkDraftThreshold();
  if(!drainDrafts(()=>false)) say("+1 ⭐ (debug)");
});
$("#shopBtn").addEventListener("click",()=>{ fire("shop"); renderTalents(); $("#shopOverlay").classList.add("open"); });
$("#whirlBtn").addEventListener("click",doWhirl);

/* ---- audio settings ---- */
(function wireAudioUI(){
  const m=$("#volMaster"), s=$("#volSfx"), b=$("#muteBtn");
  const sync=()=>{
    m.value=Math.round(audioSettings.master*100);
    s.value=Math.round(audioSettings.sfx*100);
    b.textContent=audioSettings.muted?"🔇":"🔊";
  };
  m.addEventListener("input",()=>setVolume("master",m.value/100));
  s.addEventListener("input",()=>{ setVolume("sfx",s.value/100); sfx("uiTap"); });
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

function showTitle(){
  closeMenus();
  endRun();
  setHidden($("#btnContinue"), !hasSave());
  $("#titleOverlay").classList.add("open");
}

/* generate() returns a run; setRun installs it along with the metadata that
   says which config produced it. In v3 generate() overwrote the global and
   these three fields had to be patched back on afterwards. */
function startFree(sizeKey){
  clearSave();
  closeMenus();
  const cfg=SIZES[sizeKey];
  setRun(generate(cfg), {mode:"free", size:sizeKey, levelIdx:null});
  resetZoom();
  setHidden(shopBtn, false);   /* always available in free play */
  render();
  say(cfg.label+" house — happy tidying");
}

function startCampaign(i){
  clearSave();
  closeMenus();
  const lv=LEVELS[i];
  setRun(generate(lv), {mode:"campaign", levelIdx:i, size:null});
  loadTalents();
  resetZoom();
  /* Hidden until it means something. In v3 it sat there showing "⭐ 0" over
     an all-unaffordable list from level 1-1 onward, which mostly taught
     players to ignore it. */
  setHidden(shopBtn, !Object.values(G.up).some(v=>v>0));
  render();
  say(lv.id+" · "+lv.name, {priority:2});
  say(tokenise(lv.blurb, textVars()), {priority:1});
}

/* Values available to {tokens} in level blurbs, tips and help copy. */
function textVars(){
  return { handSlots:G.inv.length||INV_SIZE, rowLen:G.rowLen||5 };
}

function openCampaignMenu(){
  closeMenus();
  const prog=getProgress();
  const list=$("#levelList"); list.innerHTML="";
  LEVELS.forEach((lv,i)=>{
    const b=document.createElement("button");
    b.className="lvlbtn";
    b.disabled = i>prog;
    b.innerHTML=`<span class="lid">${lv.id}</span><span class="lname">${lv.name}</span>
      <span class="lstate">${i<prog?"✅":(i===prog?"▶":"🔒")}</span>`;
    if(i<=prog) b.addEventListener("click",()=>startCampaign(i));
    list.appendChild(b);
  });
  $("#campaignOverlay").classList.add("open");
}

function resetRun(){
  clearSave();
  closeMenus();
  const cfg=currentCfg();
  setRun(generate(cfg), {mode:G.mode, levelIdx:G.levelIdx, size:G.size});
  render();
}

/* menu wiring */
$("#btnContinue").addEventListener("click",()=>{
  if(loadGame()){ closeMenus(); render(); say("Welcome back"); }
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
function buildSizeMenu(){
  const grid=$("#sizeOverlay .sizegrid");
  grid.innerHTML="";
  for(const s of DATA.sizes.sizes){
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
  for(const h of document.querySelectorAll("#helpOverlay h1,#titleOverlay h1")) h.textContent=s.title;
  $("#titleOverlay .tagline").textContent=s.tagline;
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
  afterMutation, openContainer, closeCont, doWhirl,
};

/* boot: land on the title screen */
buildSizeMenu();
buildHelp();
showTitle();
