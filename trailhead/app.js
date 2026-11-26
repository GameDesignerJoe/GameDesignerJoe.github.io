(function(){
"use strict";
// Trailhead. Reads projects.json (the truth, in the repo) and shows where every project is on the dev plan.
// The page never writes to the repo. Ticks, stars and links made here wait on this device until "Send to repo".
var KEY="trailhead.v1", mem={};
function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||"{}")||{}; }catch(e){ return mem; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ mem=S; } }
var S=load();
function shape(){
  ["star","hidden","skip"].forEach(function(k){ if(!Array.isArray(S[k])) S[k]=[]; });
  ["love","live","notes","checks","nfp"].forEach(function(k){ if(!S[k]||typeof S[k]!=="object") S[k]={}; });
}
shape();
function migrate(){
  var v=S.v||1;
  if(v<3){ if(S.star.length) S.starSet=true; if(S.hidden.length) S.hidSet=true; }
  if(v<5){ ["dream","done","added","removed","order","basics","chat","model"].forEach(function(k){ delete S[k]; }); try{ localStorage.removeItem("trailhead.key"); }catch(e){} }
  S.v=5;
}
var UI={kind:"all", sort:"recent", showAll:false, open:null, menu:false, more:false, nowIdx:0};
var PROJECTS=[], BY={}, UPDATED="", LOADED=false;

var I={
 star:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 open:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>',
 sort:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5v14l-3-3M17 19V5l3 3"/></svg>',
 doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/></svg>',
 swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
 dots:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
 x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
function same(a,b){ return a.slice().sort().join("|")===b.slice().sort().join("|"); }
function fileSet(k){ return PROJECTS.filter(function(p){ return p[k]; }).map(function(p){ return p.id; }); }

function setData(d){
  PROJECTS=(d.projects||[]).map(function(p){ p.icon=p.icon||p.emoji||"•"; p.checklist=p.checklist||[]; p.backlog=p.backlog||[]; p.stage=Math.min(Math.max(p.stage||1,1),STAGES.length); return p; });
  BY={}; PROJECTS.forEach(function(p){ BY[p.id]=p; });
  UPDATED=d.updated||""; if(d.goals&&d.goals.length) GOALS=d.goals; if(d.lead) LEAD=d.lead;
  LOADED=true; migrate(); reconcile(); save();
}
// drop anything saved on this device that the repo now agrees with
function reconcile(){
  if(S.starSet && same(S.star, fileSet("star"))) S.starSet=false;
  if(S.hidSet && same(S.hidden, fileSet("hidden"))) S.hidSet=false;
  if(!S.starSet) S.star=fileSet("star");
  if(!S.hidSet) S.hidden=fileSet("hidden");
  S.star=S.star.filter(function(id){ return BY[id]; }); S.hidden=S.hidden.filter(function(id){ return BY[id]; });
  PROJECTS.forEach(function(p){
    if(S.love[p.id]!=null && S.love[p.id]===(p.love||"")) delete S.love[p.id];
    if(S.notes[p.id]!=null && S.notes[p.id]===(p.notes||"")) delete S.notes[p.id];
    if(S.nfp[p.id]!=null && !!S.nfp[p.id]===!!p.nfp) delete S.nfp[p.id];
    var c=S.checks[p.id]; if(c){ var live={}; p.checklist.forEach(function(it){ live[hash(it.t)]=!!it.done; });
      Object.keys(c).forEach(function(h){ if(!(h in live) || live[h]===!!c[h]) delete c[h]; }); if(!Object.keys(c).length) delete S.checks[p.id]; }
  });
}
function isStar(id){ return S.star.indexOf(id)>=0; }
function isHidden(id){ return S.hidden.indexOf(id)>=0; }
function isNfp(p){ return S.nfp[p.id]!=null ? !!S.nfp[p.id] : !!p.nfp; }
function loveOf(p){ return S.love[p.id]!=null ? S.love[p.id] : (p.love||""); }
function notesOf(p){ return S.notes[p.id]!=null ? S.notes[p.id] : (p.notes||""); }
function notesHref(p){ var n=notesOf(p); return !n ? "" : /^https?:/.test(n) ? n : "https://github.com/"+REPO+"/blob/main/"+n.split("/").map(encodeURIComponent).join("/"); }
function visible(){ return PROJECTS.filter(function(p){ return !isHidden(p.id); }); }
function gate(p){ return STAGES[p.stage-1]; }
function checks(p){ var c=S.checks[p.id]||{}; return p.checklist.map(function(it){ var h=hash(it.t); return {t:it.t, h:h, done:(h in c)?!!c[h]:!!it.done}; }); }
function progress(p){ var c=checks(p); return {done:c.filter(function(x){ return x.done; }).length, of:c.length}; }
function nextItem(p){ return checks(p).filter(function(x){ return !x.done; })[0]||null; }
function lastOf(p){ var l=S.live[p.id]; return (l && l>p.last) ? l : p.last; }
function days(p){ var d=new Date(lastOf(p)+"T12:00:00"); return Math.max(0, Math.round((Date.now()-d.getTime())/864e5)); }
function ago(n){ if(n<=0) return "today"; if(n===1) return "yesterday"; if(n<14) return n+" days ago"; if(n<70) return Math.round(n/7)+" weeks ago"; if(n<365) return Math.round(n/30.4)+" months ago"; var y=Math.round(n/365*10)/10; return (y===1?"a year":y+" years")+" ago"; }
function href(p){ return !p.url ? "" : (/^https?:/.test(p.url) ? p.url : SITE+p.url); }

function pending(){
  var out=[];
  PROJECTS.forEach(function(p){
    var c={project:p.id}, n=0, set={};
    if(S.love[p.id]!=null){ set.love=S.love[p.id]; n++; }
    if(S.notes[p.id]!=null){ set.notes=S.notes[p.id]; n++; }
    if(S.nfp[p.id]!=null){ set.nfp=!!S.nfp[p.id]; n++; }
    if(S.starSet && isStar(p.id)!==!!p.star){ set.star=isStar(p.id); n++; }
    if(S.hidSet && isHidden(p.id)!==!!p.hidden){ set.hidden=isHidden(p.id); n++; }
    if(n) c.set=set;
    var ov=S.checks[p.id]||{}, on=[], off=[];
    p.checklist.forEach(function(it){ var h=hash(it.t); if(h in ov){ (ov[h]?on:off).push(it.t); } });
    if(on.length){ c.check=on; n+=on.length; } if(off.length){ c.uncheck=off; n+=off.length; }
    if(n){ c.n=n; out.push(c); }
  });
  return out;
}
function pendingCount(){ return pending().reduce(function(a,c){ return a+c.n; },0); }
function codeLink(text){ return "https://claude.ai/code/new?q="+encodeURIComponent(text.slice(0,9000))+"&repo="+encodeURIComponent(REPO)+"&branch=main"; }
function syncPrompt(){
  var p=pending().map(function(c){ var o={}; Object.keys(c).forEach(function(k){ if(k!=="n") o[k]=c[k]; }); return o; });
  return "Trailhead sync. Follow trailhead/README.md.\n\nApply these changes from my device to trailhead/projects.json, then commit to main and push. For each project: \"set\" replaces those fields, \"check\" marks those checklist items done, \"uncheck\" marks them not done. Change nothing else.\n\n"+JSON.stringify(p,null,1);
}
function goPrompt(p, t){
  return "Trailhead: let's work on "+p.name+" ("+p.folder+"/). It's in "+gate(p).name+". Its entry in trailhead/projects.json has the checklist for this gate."+(p.left?"\n\nWhere I left off: "+p.left:"")+(t?"\n\nNext on the list: "+t:"")+"\n\nHelp me do that now. If it needs me to play, decide or record something, walk me through it. If you can build it, build it. Tick it off when it's really done, then tell me what's next.";
}
function notesPrompt(p){
  var n=notesOf(p);
  return "Trailhead notes pass for "+p.name+" ("+p.folder+"/). There are new notes in "+(docId(n)?"its Google Doc: "+n:"its notes file: "+n)+"\n\nFollow \"Working a project's notes\" in trailhead/README.md.";
}
function gatePrompt(p){
  var nx=STAGES[p.stage];
  return "Trailhead: "+p.name+" ("+p.folder+"/) has everything ticked for "+gate(p).name+". Follow \"Moving through a gate\" in trailhead/README.md: check it honestly"+(nx?", and if it holds, move it to "+nx.name+" and write that gate's checklist for this game.":".");
}

// what to surface when nothing is starred: warm, invested, and close to clearing its gate
function score(p){
  var n=days(p), pr=progress(p), s=Math.min(p.commits,150)/150*1.5;
  s += 3.5*Math.exp(-n/12) + (n<=60 ? .8 : n<=180 ? .3 : 0);
  if(pr.of) s += (pr.done/pr.of)*1.2;
  if(isNfp(p)) s -= 1.5;
  return s;
}
function nowQueue(){
  var pool=visible().filter(function(p){ return nextItem(p) && S.skip.indexOf(p.id)<0; });
  var stars=pool.filter(function(p){ return isStar(p.id); });
  var rest=pool.filter(function(p){ return !isStar(p.id); }).sort(function(a,b){ return score(b)-score(a); });
  return stars.concat(rest);
}
function why(p){
  var n=days(p), pr=progress(p), g=gate(p).name+", "+pr.done+" of "+pr.of+".";
  if(isStar(p.id)) return "A focus project. "+g;
  if(n<=14) return "You were in here "+ago(n)+". "+g;
  return "Last touched "+ago(n)+". "+g;
}

var toastT;
function toast(msg){ var t=document.getElementById("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ t.hidden=true; }, 2600); }
function copy(text, ok){
  var done=function(){ toast(ok); };
  var fb=function(){ var ta=document.createElement("textarea"); ta.value=text; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); done(); }catch(e){} document.body.removeChild(ta); };
  try{ navigator.clipboard.writeText(text).then(done, fb); }catch(e){ fb(); }
}
function tile(p, cls){ var src=ICONS[p.id]; return '<span class="tile '+(cls||"")+'" aria-hidden="true">'+(src?'<img src="'+src+'" alt="">':p.icon)+'</span>'; }
function ringed(p, cls){ return '<span class="ring '+p.kind+(isNfp(p)?" nfp":"")+(isStar(p.id)?" starred":"")+'">'+tile(p,cls)+'</span>'; }
function act(tag, cls, icon, label, attrs){ return '<'+tag+' class="act '+cls+'" '+attrs+'><i>'+icon+'</i><span>'+label+'</span></'+tag+'>'; }

function renderGoal(){
  var shapes=['<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="var(--surface)" stroke="var(--ink)" stroke-width="3.5"/></svg>',
   '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l8 14H2z" fill="var(--surface)" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"/></svg>',
   '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="1.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="3.5"/></svg>'];
  document.getElementById("goal").innerHTML='<span class="label">What I\'m reaching for</span><ul>'+GOALS.map(function(g,i){ return '<li>'+shapes[i%3]+'<span>'+esc(g)+'</span></li>'; }).join("")+'</ul>';
  var n=pendingCount(), pb=document.getElementById("pending");
  pb.hidden=!n; if(n) pb.innerHTML='<span>'+n+(n===1?" change":" changes")+' on this device '+(n===1?"isn't":"aren't")+' in your repo yet.</span><a class="btn solid" href="'+esc(codeLink(syncPrompt()))+'" target="_blank" rel="noopener" data-act="sync">'+I.arrow+'Send to repo</a>';
}
function renderNow(){
  var q=nowQueue(), el=document.getElementById("now");
  if(!q.length){ el.innerHTML='<span class="label">One thing right now</span><p class="task">Every checklist is clear.</p>'; return; }
  var p=q[UI.nowIdx % q.length], it=nextItem(p), h=href(p);
  el.innerHTML='<span class="label">Let\'s do this one thing right now</span>'+
   '<button class="who" data-act="open" data-id="'+p.id+'">'+tile(p)+'<span>'+esc(p.name)+'</span></button>'+
   '<p class="task">'+esc(it.t)+'</p><p class="why">'+esc(why(p))+'</p>'+
   '<div class="acts">'+
    act("a","go",I.arrow,"Let's do it!",'href="'+esc(codeLink(goPrompt(p,it.t)))+'" target="_blank" rel="noopener" data-act="go" data-id="'+p.id+'"')+
    (h?act("a","",I.open,p.kind==="tool"?"Open":"Play",'href="'+esc(h)+'" target="_blank" rel="noopener"'):'')+
    (q.length>1?act("button","",I.swap,"Another",'data-act="nownext"'):'')+
   '</div>';
}
function renderFocus(){
  var el=document.getElementById("focus"), out="", stars=S.star.map(function(id){ return BY[id]; }).filter(Boolean);
  for(var i=0;i<2;i++){
    var p=stars[i];
    if(p){ var pr=progress(p); out+='<button class="slot full" data-act="open" data-id="'+p.id+'">'+tile(p)+'<span class="txt"><b>'+esc(p.name)+'</b><span class="sub">'+esc(gate(p).name)+" · "+pr.done+" of "+pr.of+'</span></span></button>'; }
    else out+='<div class="slot empty">'+(i===0&&!stars.length?"Star a project to pin it here. Two at most, so they stay the ones you really mean.":"One more focus slot.")+'</div>';
  }
  el.innerHTML=out;
}
function renderPath(){
  var el=document.getElementById("path"), out='<svg aria-hidden="true"></svg>', vis=visible(), top=0;
  vis.forEach(function(p){ if(p.stage>top) top=p.stage; });
  STAGES.slice().reverse().forEach(function(s){
    var ps=vis.filter(function(p){ return p.stage===s.n; }).sort(function(a,b){ var pa=progress(a), pb=progress(b); return (pb.of?pb.done/pb.of:0)-(pa.of?pa.done/pa.of:0); });
    out+='<div class="stop'+(s.n>top?" ahead":"")+(s.n===STAGES.length?" goalstop":"")+'" data-stop="'+s.n+'"><div><h3>'+esc(s.name)+' <span class="count">'+ps.length+'</span></h3><p>'+esc(s.desc)+'</p></div>'+
     (ps.length?'<div class="chips">'+ps.map(function(p){ return '<button data-act="open" data-id="'+p.id+'" aria-label="'+esc(p.name)+'" title="'+esc(p.name)+'">'+ringed(p,"sm")+'</button>'; }).join("")+'</div>':'')+
     (s.n>top?'<details class="how"><summary>What it takes</summary><ul>'+s.items.map(function(h){ return '<li>'+esc(h.t)+'</li>'; }).join("")+'</ul></details>':'')+
     '</div>';
  });
  el.innerHTML=out; drawTrail();
  document.getElementById("srcnote").innerHTML='The release gates are built on your '+PLAN_SRC.date+' chat, <a href="'+PLAN_SRC.url+'" target="_blank" rel="noopener">'+esc(PLAN_SRC.title)+'</a>. Fees are as quoted there.';
}
function drawTrail(){
  var el=document.getElementById("path"), svg=el.querySelector("svg"); if(!svg) return;
  var box=el.getBoundingClientRect(), N=STAGES.length, pts=[];
  el.querySelectorAll(".stop").forEach(function(st){ var h=st.querySelector("h3").getBoundingClientRect(); pts[+st.dataset.stop]={y:h.top-box.top+Math.min(h.height,28)/2}; });
  if(!pts[1]) return;
  var CX=34, n, d="";
  for(n=1;n<=N;n++){ var w=Math.pow(1-(n-1)/(N-1),1.3); pts[n].x=CX+(n%2?-1:1)*15*w; pts[n].w=w; }
  for(n=1;n<N;n++){
    var a=pts[n], b=pts[n+1], loops=n<=2?1:0, R=Math.min(12,(a.y-b.y)/6), dir=n%2?1:-1, K=96;
    for(var i=0;i<=K;i++){
      var t=i/K, tb=loops ? (t<.38 ? t/.76 : t>.62 ? (t-.24)/.76 : .5) : t;
      var e=tb*tb*(3-2*tb), x=a.x+(b.x-a.x)*e, y=a.y+(b.y-a.y)*tb;
      x+=Math.sin(tb*Math.PI*2)*8*a.w*dir;
      if(loops&&t>=.38&&t<=.62){ var th=(t-.38)/.24*Math.PI*2; x+=(1-Math.cos(th))*R*dir; y-=Math.sin(th)*R; }
      d+=(d?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
    }
  }
  var g='<path d="'+d+'" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.1 7"/>';
  for(n=1;n<=N;n++){ var p=pts[n];
    g+= n===N ? '<circle cx="'+p.x+'" cy="'+p.y+'" r="10" fill="var(--surface)" stroke="var(--ink)" stroke-width="4"/><circle cx="'+p.x+'" cy="'+p.y+'" r="3.2" fill="var(--ink)"/>'
              : '<circle cx="'+p.x+'" cy="'+p.y+'" r="6.5" fill="var(--bg)" stroke="var(--ink)" stroke-width="3"/>'; }
  svg.innerHTML=g;
}
function renderList(){
  var vis=visible().filter(function(p){ return UI.kind==="all"||p.kind===UI.kind; });
  vis.sort(UI.sort==="gate" ? function(a,b){ return (b.stage-a.stage) || (progress(b).done/Math.max(1,progress(b).of)-progress(a).done/Math.max(1,progress(a).of)); } : function(a,b){ return (isStar(b.id)-isStar(a.id)) || (days(a)-days(b)); });
  document.getElementById("filters").innerHTML=[["all","All"],["game","Games"],["tabletop","Tabletop"],["tool","Tools"]].map(function(k){ return '<button class="chip" data-act="kind" data-v="'+k[0]+'" aria-pressed="'+(UI.kind===k[0])+'">'+k[1]+'</button>'; }).join("")+
    '<button class="round" data-act="sort" aria-label="Change sort order">'+I.sort+'</button>';
  var show=UI.showAll?vis:vis.slice(0,10);
  document.getElementById("cards").innerHTML=show.map(function(p){ var pr=progress(p);
    return '<div class="card"><button class="main" data-act="open" data-id="'+p.id+'">'+tile(p)+
     '<span class="txt"><b>'+esc(p.name)+'</b><span class="tag">'+esc(p.tag)+'</span>'+
     '<span class="meta"><span class="st">'+esc(gate(p).name)+'</span><span>'+pr.done+" of "+pr.of+'</span><span>'+ago(days(p))+'</span>'+(isNfp(p)?'<span>Not for publish</span>':'')+'</span></span></button>'+
     '<button class="starbtn'+(isStar(p.id)?" on":"")+'" data-act="star" data-id="'+p.id+'" aria-label="'+(isStar(p.id)?"Remove star from ":"Star ")+esc(p.name)+'" aria-pressed="'+isStar(p.id)+'">'+I.star+'</button></div>';
  }).join("");
  var more=document.getElementById("more"); more.hidden=UI.showAll||vis.length<=10; more.textContent="Show all "+vis.length;
  document.getElementById("count").textContent=visible().length+" showing, by "+(UI.sort==="recent"?"last touched":"how far along");
  var hid=PROJECTS.filter(function(p){ return isHidden(p.id); }), hb=document.getElementById("hiddenbox");
  hb.hidden=!hid.length;
  hb.innerHTML='<summary>Hidden ('+hid.length+')</summary>'+hid.map(function(p){ return '<div class="hrow">'+tile(p,"sm")+'<span class="nm">'+esc(p.name)+'</span><button class="btn line" style="min-height:38px;align-self:center" data-act="unhide" data-id="'+p.id+'">Bring back</button></div>'; }).join("");
}

// ---- notes: a Google Doc, or a file in the repo
var DOCS={};
function docId(u){ var m=/\/document\/d\/([A-Za-z0-9_-]+)/.exec(u||""); return m?m[1]:""; }
function parseDoc(txt){
  var lines=String(txt).replace(/\r/g,"").split("\n").map(function(l){ return l.trim(); }), live=[], stop=/^#*\s*(old notes?|done\??)\s*:?\s*$/i;
  for(var i=0;i<lines.length;i++){
    var l=lines[i]; if(stop.test(l)) break;
    if(!l) continue;
    var b=/^[*\-•]\s+(.*)$/.exec(l); if(b){ if(b[1] && !/^!?\[/.test(b[1])) live.push(b[1].replace(/\\([!.\-_*#()\[\]])/g,"$1")); }
  }
  return live;
}
function parseFile(txt){
  var out=[], skipLevel=0, SKIP=/idea|long.?term|research|thought|future|someday|done|complete|shipped|fixed|old notes|archive|maybe/i;
  String(txt).replace(/\r/g,"").split("\n").forEach(function(raw){
    var l=raw.replace(/\s+$/,""), t=l.trim(); if(!t) return;
    var m=/^(#{1,6})\s+(.*)$/.exec(t), c=!m && !/^[-*•\d]/.test(t) && /^(.{2,48}):$/.exec(t);
    if(m||c){ var lvl=m?m[1].length:7, title=m?m[2]:c[1];
      if(skipLevel && lvl>skipLevel) return;
      skipLevel=SKIP.test(title)?lvl:0; return; }
    if(skipLevel) return;
    var indent=l.length-l.replace(/^\s+/,"").length, b=/^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(t);
    if(!b||indent>1) return;
    var x=b[1];
    if(/^\[[xX]\]/.test(x)||/✅|~~/.test(x)||/^[\[(]?done\b/i.test(x)) return;
    x=x.replace(/^\[\s?\]\s*/,"").replace(/\*\*/g,"").trim();
    if(x.length>2) out.push(x.length>200?x.slice(0,197)+"…":x);
  });
  return out;
}
function loadDoc(p){
  var n=notesOf(p); if(!n) return;
  if(DOCS[n]){ paintDoc(p); return; }
  DOCS[n]={state:"loading"};
  var id=docId(n), url=id ? "https://docs.google.com/document/d/"+id+"/export?format=txt" : (/^https?:/.test(n) ? "" : "../"+n+"?t="+Date.now());
  if(!url){ DOCS[n]={state:"blocked"}; paintDoc(p); return; }
  fetch(url).then(function(r){ if(!r.ok) throw 0; return r.text(); })
   .then(function(t){ if(/<html/i.test(t.slice(0,300))) throw 0; DOCS[n]={state:"ok", items:id?parseDoc(t):parseFile(t)}; paintDoc(p); })
   .catch(function(){ DOCS[n]={state:"blocked"}; paintDoc(p); });
}
function paintDoc(p){
  var el=document.getElementById("docbody"); if(!el||el.dataset.id!==p.id) return;
  var n=notesOf(p), d=DOCS[n]||{}, where=docId(n)?"your doc":n.split("/").pop();
  if(d.state==="ok"){
    el.innerHTML = d.items.length
      ? '<details class="how"><summary>'+d.items.length+' open in '+esc(where)+'</summary><ul>'+d.items.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join("")+'</ul></details>'
      : '<p class="hint">Nothing open in '+esc(where)+'.</p>';
  } else if(d.state==="blocked"){
    el.innerHTML='<p class="hint">'+(p.docOpen!=null&&S.notes[p.id]==null?esc(String(p.docOpen))+" open "+(p.docOpen===1?"note":"notes")+" when Claude Code last read it"+(p.docSeen?" ("+esc(p.docSeen)+")":"")+". ":"")+'This page couldn\'t read '+esc(where)+' from here.</p>';
  } else el.innerHTML='<p class="hint">Checking '+esc(where)+'…</p>';
}
function linkForm(p, label){ return '<form class="add" data-form="link" data-id="'+p.id+'"><input id="notelink" placeholder="'+label+'" autocomplete="off" inputmode="url" aria-label="'+label+'"><button aria-label="Save">+</button></form>'; }

// ---- gallery: whatever is in the game's media folder, listed through GitHub so adding or deleting a file just works
var MEDIA={};
function loadMedia(p){
  if(MEDIA[p.id]){ paintMedia(p); return; }
  MEDIA[p.id]={state:"loading"};
  var done=function(items){ MEDIA[p.id]={state:"ok", items:items}; paintMedia(p); };
  var local=location.hostname==="localhost";
  if(!/github\.io$/.test(location.hostname) && !local){ done([]); return; }
  var src=local ? fetch("../"+p.folder+"/media/index.json").then(function(r){ if(!r.ok) throw 0; return r.json(); })
    : fetch("https://api.github.com/repos/"+REPO+"/contents/"+p.folder.split("/").map(encodeURIComponent).join("/")+"/media").then(function(r){ if(!r.ok) throw 0; return r.json(); });
  src.then(function(list){
    var items=[], names=(list||[]).map(function(f){ return typeof f==="string"?f:f.name; }).sort(), base="../"+p.folder+"/media/";
    names.forEach(function(nm){ if(/\.(png|jpe?g|webp|gif)$/i.test(nm)) items.push({type:"img", src:base+encodeURIComponent(nm)}); else if(/\.(mp4|webm|mov)$/i.test(nm)) items.push({type:"video", src:base+encodeURIComponent(nm)}); });
    if(names.indexOf("videos.txt")>=0){
      fetch(base+"videos.txt").then(function(r){ return r.ok?r.text():""; }).then(function(t){ t.split(/\s+/).forEach(function(u){ var m=/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/.exec(u); if(m) items.push({type:"yt", id:m[1], href:u}); }); done(items); }, function(){ done(items); });
    } else done(items);
  }).catch(function(){ done([]); });
}
function paintMedia(p){
  var el=document.getElementById("gallery"); if(!el||el.dataset.id!==p.id) return;
  var m=MEDIA[p.id]||{}, items=(m.items||[]).slice(), shot=(typeof SHOTS!=="undefined"&&SHOTS[p.id])?SHOTS[p.id]:null;
  if(m.state!=="ok"){ el.hidden=true; return; }
  if(!items.length && shot) items=[{type:"img", src:shot.src, cap:"How it looks now"+(shot.on?" · "+shot.on:"")}];
  if(!items.length){ el.hidden=true; return; }
  el.hidden=false;
  el.innerHTML='<div class="reel'+(p.shot==="landscape"?" wide":"")+(items.length===1?" one":"")+'">'+items.map(function(it){
    return '<div class="frame">'+(it.type==="img" ? '<img src="'+esc(it.src)+'" alt="'+esc(p.name)+' screenshot">'
      : it.type==="video" ? '<video src="'+esc(it.src)+'" controls playsinline preload="metadata"></video>'
      : '<a href="'+esc(it.href)+'" target="_blank" rel="noopener" class="yt"><img src="https://img.youtube.com/vi/'+esc(it.id)+'/hqdefault.jpg" alt="Video"><span>Watch on YouTube</span></a>')+(it.cap?'<span class="cap">'+esc(it.cap)+'</span>':'')+'</div>'; }).join("")+'</div>'+
    (items.length>1?'<p class="reelnote"><span id="reelpos">1</span> of '+items.length+'</p>':'');
  var reel=el.querySelector(".reel"), pos=document.getElementById("reelpos");
  if(pos) reel.addEventListener("scroll", function(){ var f=reel.querySelector(".frame"); if(!f) return; pos.textContent=Math.min(items.length, Math.round(reel.scrollLeft/(f.getBoundingClientRect().width+10))+1); }, {passive:true});
}

function renderSheet(){
  var sc=document.getElementById("scrim");
  if(UI.menu){ sc.hidden=false; sc.innerHTML=menuHtml(); document.body.style.overflow="hidden"; return; }
  var p=BY[UI.open]; if(!p){ sc.hidden=true; sc.innerHTML=""; document.body.style.overflow=""; return; }
  var h=href(p), g=gate(p), cs=checks(p), pr=progress(p), nx=nextItem(p), n=days(p), nxt=STAGES[p.stage], nfp=isNfp(p);
  var canAdvance=nxt && !(nfp && p.stage>=5);
  var hc=COLORS[p.id]||({game:"#8a2c26",tabletop:"#1c4f80",tool:"#6f5500"})[p.kind];
  var open=cs.filter(function(x){ return !x.done; }), done=cs.filter(function(x){ return x.done; });
  function row(x){ return '<li class="'+(x.done?"done":"")+'"><button class="check" data-act="tick" data-id="'+p.id+'" data-h="'+x.h+'" aria-label="'+(x.done?"Mark not done":"Mark done")+'" aria-pressed="'+x.done+'">'+I.check+'</button><span class="tx">'+esc(x.t)+'</span></li>'; }
  sc.hidden=false; document.body.style.overflow="hidden";
  sc.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(p.name)+'">'+
   '<div class="hero" style="--hc:'+hc+'">'+
   '<div class="shead">'+tile(p,"lg")+'<div class="t"><h2>'+esc(p.name)+'</h2><p>'+esc(p.tag)+'</p></div><button class="round" data-act="close" aria-label="Close">'+I.x+'</button></div>'+
   '<div class="quote"><span aria-hidden="true">“</span><textarea class="fit" id="love" rows="1" data-id="'+p.id+'" aria-label="The razor for '+esc(p.name)+'" placeholder="The razor: what you\'d say in an elevator about why this is cool">'+esc(loveOf(p))+'</textarea></div>'+
   '<div class="acts">'+
     (h?act("a","",I.open,p.kind==="tool"?"Open":"Play",'href="'+esc(h)+'" target="_blank" rel="noopener"'):'')+
     (notesOf(p)?act("a","",I.doc,"Notes",'href="'+esc(notesHref(p))+'" target="_blank" rel="noopener"'):'')+
     (notesOf(p)?act("a","",I.arrow,"Work",'href="'+esc(codeLink(notesPrompt(p)))+'" target="_blank" rel="noopener" data-act="notespass" data-id="'+p.id+'"'):'')+
     act("button",isStar(p.id)?"on":"",I.star,isStar(p.id)?"Starred":"Star",'data-act="star" data-id="'+p.id+'" aria-pressed="'+isStar(p.id)+'"')+
     act("button",UI.more?"on":"",I.dots,"More",'data-act="more2" aria-expanded="'+UI.more+'"')+
   '</div>'+
   (UI.more?'<div class="moreacts"><button class="btn" data-act="nfp" data-id="'+p.id+'" aria-pressed="'+nfp+'">'+(nfp?"Not for publish: on":"Not for publish")+'</button><button class="btn" data-act="hide" data-id="'+p.id+'">Hide</button></div>':'')+
   '</div>'+
   '<div class="block jump"><span class="label">'+esc(g.name)+' · '+pr.done+' of '+pr.of+(nfp?" · not for publish":"")+'</span>'+
     (nx?'<p class="jtask">'+esc(nx.t)+'</p>':'<p class="jtask">Everything for '+esc(g.name)+' is ticked.</p>')+
     (p.left?'<p class="hint">Last time, '+ago(n)+': '+esc(p.left)+'</p>':'')+
     (nx?'<div class="chatacts"><a class="btn solid" href="'+esc(codeLink(goPrompt(p,nx.t)))+'" target="_blank" rel="noopener" data-act="go" data-id="'+p.id+'">'+I.arrow+'Let\'s do it!</a></div>'
        :(canAdvance?'<div class="chatacts"><a class="btn solid" href="'+esc(codeLink(gatePrompt(p)))+'" target="_blank" rel="noopener" data-act="gate" data-id="'+p.id+'">'+I.arrow+'Move it to '+esc(nxt.name)+'</a></div>':''))+'</div>'+
   '<div id="gallery" class="gallery" data-id="'+p.id+'" hidden></div>'+
   '<div class="block"><span class="label">To get through '+esc(g.name)+'</span><p class="hint">'+esc(g.desc)+'</p>'+
     '<div class="bar big"><i style="width:'+(pr.of?Math.round(pr.done/pr.of*100):0)+'%"></i></div>'+
     (open.length?'<ul class="list">'+open.map(row).join("")+'</ul>':'')+
     (done.length?'<details class="doneitems"'+(open.length?"":" open")+'><summary>'+done.length+' done</summary><ul class="list">'+done.map(row).join("")+'</ul></details>':'')+
   '</div>'+
   (notesOf(p)?'<div class="block"><span class="label">Notes</span><div id="docbody" data-id="'+p.id+'"></div></div>'
              :'<div class="block"><span class="label">Notes</span><p class="hint">No notes doc linked yet.</p>'+linkForm(p,"Paste a Google Doc link")+'</div>')+
   '<details class="block more"><summary><span class="label">More</span></summary>'+
     '<p>'+esc(p.status)+'</p>'+
     (p.backlog.length?'<span class="grp">Bigger work and ideas · '+p.backlog.length+'</span><ul class="list">'+p.backlog.map(function(t){ return '<li><span class="dot"></span><span class="tx">'+esc(t)+'</span></li>'; }).join("")+'</ul>':'')+
     ((p.done||[]).length?'<span class="grp">Shipped · '+p.done.length+'</span><ul class="list">'+p.done.slice().reverse().map(function(x){ return '<li><span class="dot"></span><span class="tx">'+esc(x.t)+(x.on?' <span class="hint">'+esc(x.on)+'</span>':'')+'</span></li>'; }).join("")+'</ul>':'')+
     (canAdvance?'<span class="grp">Next gate: '+esc(nxt.name)+'</span><p class="hint">'+esc(nxt.desc)+'</p>':'')+
     (notesOf(p)?'<span class="grp">Notes link</span><p class="src" style="overflow-wrap:anywhere">'+esc(notesOf(p))+'</p>'+linkForm(p,"Paste a different Google Doc link"):'')+
     '<p class="src">'+p.commits+" commits · started "+p.first+" · last commit "+lastOf(p)+" · "+esc(p.folder)+'/</p>'+
   '</details>'+
  '</div>';
  fitAll(); if(notesOf(p)) loadDoc(p); loadMedia(p);
}
function menuHtml(){
  return '<div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">'+
   '<div class="shead"><div class="t"><h2>Trailhead</h2><p>'+PROJECTS.length+' projects. projects.json last updated '+esc(UPDATED)+'</p></div><button class="round" data-act="close" aria-label="Close">'+I.x+'</button></div>'+
   '<div class="block"><span class="label">Fresh dates</span><p>Ask GitHub when each project last changed.</p><button class="btn solid" data-act="github">Check GitHub now</button><span class="hint" id="ghmsg">'+(S.liveAt?"Last checked "+new Date(S.liveAt).toLocaleString():"Not checked yet")+'</span></div>'+
   '<div class="block"><span class="label">How this saves</span><p>Everything lives in your repo, in trailhead/projects.json, so every device shows the same thing. A tick, a star or a new link made here waits on this device until you press Send to repo.</p></div>'+
   '<div class="block"><span class="label">Not tracked</span><p class="hint">Folders left out because they hold assets, originals or one-off pages: '+esc(NOT_TRACKED)+'.</p></div>'+
  '</div>';
}
function fit(t){ t.style.height="auto"; t.style.height=t.scrollHeight+"px"; }
function fitAll(){ document.querySelectorAll("textarea.fit").forEach(fit); }
function renderAll(){ if(!LOADED) return; renderGoal(); renderNow(); renderFocus(); renderPath(); renderList(); renderSheet(); }
function keepScroll(fn){ var sh=document.querySelector(".sheet"), t=sh?sh.scrollTop:0; fn(); sh=document.querySelector(".sheet"); if(sh) sh.scrollTop=t; }

document.addEventListener("click", function(e){
  var t=e.target.closest("[data-act]");
  if(!t){ if(e.target.id==="scrim"){ UI.open=null; UI.menu=false; UI.more=false; renderSheet(); } return; }
  var a=t.dataset.act, id=t.dataset.id, p=BY[id];
  if(a==="open"){ UI.open=id; UI.more=false; renderSheet(); document.querySelector(".sheet").scrollTop=0; }
  else if(a==="close"){ UI.open=null; UI.menu=false; UI.more=false; renderAll(); }
  else if(a==="menu"){ UI.menu=true; renderSheet(); }
  else if(a==="more2"){ UI.more=!UI.more; keepScroll(renderSheet); }
  else if(a==="star"){
    S.starSet=true; var i=S.star.indexOf(id);
    if(i>=0) S.star.splice(i,1);
    else if(S.star.length>=2){ toast("Two stars is the limit. Unstar "+BY[S.star[0]].name+" or "+BY[S.star[1]].name+" first."); return; }
    else { S.star.push(id); UI.nowIdx=0; }
    save(); keepScroll(renderAll);
  }
  else if(a==="hide"){ S.hidSet=true; if(!isHidden(id)) S.hidden.push(id); var s=S.star.indexOf(id); if(s>=0){ S.star.splice(s,1); S.starSet=true; } UI.open=null; UI.more=false; save(); renderAll(); toast(p.name+" is hidden. It's at the bottom if you want it back."); }
  else if(a==="unhide"){ S.hidSet=true; S.hidden.splice(S.hidden.indexOf(id),1); save(); renderAll(); }
  else if(a==="nfp"){ var nv=!isNfp(p); if(nv===!!p.nfp) delete S.nfp[id]; else S.nfp[id]=nv; save(); keepScroll(renderAll); toast(nv?p.name+" won't be pushed toward release.":p.name+" is headed for release again."); }
  else if(a==="kind"){ UI.kind=t.dataset.v; UI.showAll=false; renderList(); }
  else if(a==="sort"){ UI.sort=UI.sort==="recent"?"gate":"recent"; renderList(); }
  else if(a==="more"){ UI.showAll=true; renderList(); }
  else if(a==="tick"){ var h=t.dataset.h, cur=checks(p).filter(function(x){ return x.h===h; })[0], base=p.checklist.filter(function(it){ return hash(it.t)===h; })[0]; if(!cur||!base) return;
    var nv2=!cur.done; S.checks[id]=S.checks[id]||{}; if(nv2===!!base.done) delete S.checks[id][h]; else S.checks[id][h]=nv2?1:0; if(!Object.keys(S.checks[id]).length) delete S.checks[id]; save(); keepScroll(renderAll); }
  else if(a==="nownext"){ UI.nowIdx++; renderNow(); }
  else if(a==="go"){ copy(goPrompt(p,(nextItem(p)||{}).t), "Opening Claude Code. The request is copied too."); }
  else if(a==="gate"){ copy(gatePrompt(p), "Opening Claude Code. The request is copied too."); }
  else if(a==="notespass"){ copy(notesPrompt(p), "Opening Claude Code. The request is copied too."); }
  else if(a==="sync"){ copy(syncPrompt(), "Opening Claude Code. The changes are copied too."); }
  else if(a==="github"){ checkGitHub(true); }
});
document.addEventListener("submit", function(e){
  var lf=e.target.closest('[data-form="link"]'); if(!lf) return; e.preventDefault();
  var lv=lf.querySelector("input").value.trim(), lp=BY[lf.dataset.id]; if(!lv) return;
  if(!docId(lv)){ toast("That doesn't look like a Google Doc link."); return; }
  S.notes[lp.id]="https://docs.google.com/document/d/"+docId(lv)+"/edit"; save(); renderAll(); toast("Linked. Send to repo to keep it on every device.");
});
document.addEventListener("input", function(e){
  if(e.target.classList&&e.target.classList.contains("fit")) fit(e.target);
  if(e.target.id==="love"){ S.love[e.target.dataset.id]=e.target.value; save(); }
});
document.addEventListener("keydown", function(e){ if(e.key==="Escape"&&(UI.open||UI.menu)){ UI.open=null; UI.menu=false; UI.more=false; renderAll(); } });
window.addEventListener("resize", drawTrail);

function checkGitHub(manual){
  var msg=function(m){ var el=document.getElementById("ghmsg"); if(el) el.textContent=m; };
  var list=PROJECTS.slice(), i=0, changed=0, failed=false;
  if(manual) msg("Checking…");
  function next(){
    if(failed) return;
    if(i>=list.length){ S.liveAt=Date.now(); save(); renderAll(); if(manual){ UI.menu=true; renderSheet(); msg(changed?changed+" projects have newer commits than the file says.":"Nothing newer than the file."); } return; }
    var p=list[i++];
    fetch("https://api.github.com/repos/"+REPO+"/commits?per_page=1&path="+encodeURIComponent(p.folder)).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(j){
      var d=j&&j[0]&&j[0].commit&&j[0].commit.committer&&j[0].commit.committer.date;
      if(d){ d=d.slice(0,10); if(d>p.last){ if(S.live[p.id]!==d) changed++; S.live[p.id]=d; } }
      next();
    }).catch(function(){ failed=true; if(manual) msg("Couldn't reach GitHub from here."); });
  }
  next();
}

if(window.TRAILHEAD_DATA){ setData(window.TRAILHEAD_DATA); renderAll(); }
else document.getElementById("now").innerHTML='<span class="label">One thing right now</span><p class="why">Loading your projects…</p>';
if(location.protocol!=="file:"){
  fetch("projects.json?t="+Date.now(),{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){ if(!d||!Array.isArray(d.projects)) throw 0; setData(d); renderAll(); })
  .catch(function(){ if(!LOADED) document.getElementById("now").innerHTML='<span class="label">One thing right now</span><p class="task">Couldn\'t load projects.json.</p><p class="why">It should sit next to this page in the trailhead folder.</p>'; });
}
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(drawTrail);
})();
