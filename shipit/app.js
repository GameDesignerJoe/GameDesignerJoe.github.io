(function(){
"use strict";
// Ship It! Reads projects.json (the truth, in the repo) and shows where every project is on the dev plan.
// The page never writes to the repo. Ticks, stars and links made here wait on this device until "Send to repo".
var KEY="trailhead.v1", mem={};   // the old name stays here so nothing saved on a device is lost
function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||"{}")||{}; }catch(e){ return mem; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ mem=S; } }
var S=load();
function shape(){
  ["star","hidden","skip","ignore","fresh"].forEach(function(k){ if(!Array.isArray(S[k])) S[k]=[]; });
  ["love","live","notes","checks","nfp","proto"].forEach(function(k){ if(!S[k]||typeof S[k]!=="object") S[k]={}; });
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
 prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
 next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
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
  IGNORED=(d.ignored||[]).map(function(x){ return typeof x==="string" ? {folder:x,why:""} : x; });
  var ig={}; IGNORED.forEach(function(x){ ig[x.folder]=1; }); S.ignore=S.ignore.filter(function(f){ return !ig[f]; });
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
    if(S.notes[p.id]!=null && !Array.isArray(S.notes[p.id])) S.notes[p.id]=S.notes[p.id]?[S.notes[p.id]]:[];
    if(S.notes[p.id]!=null && S.notes[p.id].join("|")===fileNotes(p).join("|")) delete S.notes[p.id];
    if(S.nfp[p.id]!=null && !!S.nfp[p.id]===!!p.nfp) delete S.nfp[p.id];
    if(S.proto[p.id]!=null && !!S.proto[p.id]===!!p.proto) delete S.proto[p.id];
    var c=S.checks[p.id]; if(c){ var live={}; p.checklist.forEach(function(it){ live[hash(it.t)]=!!it.done; });
      Object.keys(c).forEach(function(h){ if(!(h in live) || live[h]===!!c[h]) delete c[h]; }); if(!Object.keys(c).length) delete S.checks[p.id]; }
  });
}
function isStar(id){ return S.star.indexOf(id)>=0; }
function isHidden(id){ return S.hidden.indexOf(id)>=0; }
function isProto(p){ return S.proto[p.id]!=null ? !!S.proto[p.id] : !!p.proto; }
function stg(p){ return isProto(p) ? 2 : p.stage; }
function noDoc(p){ return stg(p)>=3 && !isNfp(p) && !isProto(p) && !notesOf(p).length; }
function isNfp(p){ return S.nfp[p.id]!=null ? !!S.nfp[p.id] : !!p.nfp; }
function loveOf(p){ return S.love[p.id]!=null ? S.love[p.id] : (p.love||""); }
// A project's docs: Google Docs, or files in the repo. The first one is the running notes.
function fileNotes(p){ return Array.isArray(p.notes) ? p.notes.slice() : (p.notes ? [p.notes] : []); }
function notesOf(p){ return Array.isArray(S.notes[p.id]) ? S.notes[p.id] : fileNotes(p); }
function docHref(n){ return /^https?:/.test(n) ? n : "https://github.com/"+REPO+"/blob/main/"+n.split("/").map(encodeURIComponent).join("/"); }
function notesHref(p){ var n=notesOf(p)[0]; return n ? docHref(n) : ""; }
function visible(){ return PROJECTS.filter(function(p){ return !isHidden(p.id); }); }
function gate(p){ return STAGES[stg(p)-1]; }
function checks(p){ var c=S.checks[p.id]||{}; return p.checklist.map(function(it){ var h=hash(it.t); return {t:it.t, h:h, done:(h in c)?!!c[h]:!!it.done}; }); }
function progress(p){ var c=checks(p); return {done:c.filter(function(x){ return x.done; }).length, of:c.length}; }
function nextItem(p){ return checks(p).filter(function(x){ return !x.done; })[0]||null; }
function lastOf(p){ var l=S.live[p.id]; return (l && l>p.last) ? l : p.last; }
function days(p){ var d=new Date(lastOf(p)+"T12:00:00"); return Math.max(0, Math.round((Date.now()-d.getTime())/864e5)); }
function ago(n){ if(n<=0) return "today"; if(n===1) return "yesterday"; if(n<14) return n+" days ago"; if(n<70) return Math.round(n/7)+" weeks ago"; if(n<365) return Math.round(n/30.4)+" months ago"; var y=Math.round(n/365*10)/10; return (y===1?"a year":y+" years")+" ago"; }
function shortDate(d){ var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||""); return m ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2]-1]+" "+(+m[3])+(m[1]!==String(new Date().getFullYear())?", "+m[1]:"") : d; }
function href(p){ return !p.url ? "" : (/^https?:/.test(p.url) ? p.url : SITE+p.url); }

function pending(){
  var out=[];
  PROJECTS.forEach(function(p){
    var c={project:p.id}, n=0, set={};
    if(S.love[p.id]!=null){ set.love=S.love[p.id]; n++; }
    if(S.notes[p.id]!=null){ set.notes=S.notes[p.id]; n++; }
    if(S.nfp[p.id]!=null){ set.nfp=!!S.nfp[p.id]; n++; }
    if(S.proto[p.id]!=null){ set.proto=!!S.proto[p.id]; n++; }
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
var IGNORED=[];
function freshDirs(){ var known={}; PROJECTS.forEach(function(p){ known[p.folder]=1; }); IGNORED.forEach(function(x){ known[x.folder]=1; }); S.ignore.forEach(function(f){ known[f]=1; }); return S.fresh.filter(function(f){ return !known[f]; }); }
function addPrompt(f){ return "Ship It: add the folder "+f+"/ as a new project. Follow \"Adding a project\" in shipit/README.md."; }
function pendingCount(){ return pending().reduce(function(a,c){ return a+c.n; },0)+S.ignore.length; }
function codeLink(text){ return "https://claude.ai/code/new?q="+encodeURIComponent(text.slice(0,9000))+"&repo="+encodeURIComponent(REPO)+"&branch=main"; }
function syncPrompt(){
  var p=pending().map(function(c){ var o={}; Object.keys(c).forEach(function(k){ if(k!=="n") o[k]=c[k]; }); return o; });
  return "Ship It sync. Follow shipit/README.md.\n\nApply these changes from my device to shipit/projects.json, then commit to main and push. For each project: \"set\" replaces those fields, \"check\" marks those checklist items done, \"uncheck\" marks them not done. Change nothing else.\n\n"+JSON.stringify(p,null,1)+(S.ignore.length?"\n\nAlso add these folders to the top-level \"ignored\" list, with why set to \"Joe said to ignore\" and the month: "+JSON.stringify(S.ignore):"");
}
function goPrompt(p, t){
  return "Ship It: let's work on "+p.name+" ("+p.folder+"/). It's in "+gate(p).name+". Its entry in shipit/projects.json has the checklist for this gate."+(p.left?"\n\nWhere I left off: "+p.left:"")+(t?"\n\nNext on the list: "+t:"")+"\n\nHelp me do that now. If it needs me to play, decide or record something, walk me through it. If you can build it, build it. Tick it off when it's really done, then tell me what's next.";
}
function notesPrompt(p){
  var ns=notesOf(p), n=ns[0], rest=ns.slice(1);
  return "Ship It notes pass for "+p.name+" ("+p.folder+"/). There are new notes in "+(docId(n)?"its Google Doc: "+n:"its notes file: "+n)+(rest.length?"\n\nIts other docs, for reference only: "+rest.join(" , "):"")+"\n\nFollow \"Working a project's notes\" in shipit/README.md.";
}
function checkPrompt(p){ return "Ship It gate check for "+p.name+" ("+p.folder+"/). Use the gate-check skill."; }
function checkAllPrompt(){ return "Ship It gate check for every game that is for publish and not hidden. Use the gate-check skill in its check-them-all mode: do every game, write and push each one as you go, and do not stop to ask me anything. Give me one summary at the end."; }
function galleryPrompt(p){ return "Ship It: take gallery shots for "+p.name+" ("+p.folder+"/). Use the game-gallery skill."; }
function skillPrompt(k, p){
  return k==="gate-check" ? (p?checkPrompt(p):checkAllPrompt()) : k==="game-gallery" ? galleryPrompt(p) : k==="maze-task" ? "There are new tasks in the Maze doc. Use the maze-task skill." : "";
}
function gatePrompt(p){
  var nx=STAGES[stg(p)];
  return "Ship It: "+p.name+" ("+p.folder+"/) has everything ticked for "+gate(p).name+". Follow \"Moving through a gate\" in shipit/README.md: check it honestly"+(nx?", and if it holds, move it to "+nx.name+" and write that gate's checklist for this game.":".");
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
  var pool=visible().filter(function(p){ return nextItem(p) && !isProto(p) && S.skip.indexOf(p.id)<0; });
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
function tile(p, cls){ var src=ICONS[p.iconOf||p.id]; return '<span class="tile '+(cls||"")+'" aria-hidden="true">'+(src?'<img src="'+src+'" alt="">':p.icon)+'</span>'; }
function ringed(p, cls){ return '<span class="ring '+p.kind+(isNfp(p)?" nfp":"")+(isStar(p.id)?" starred":"")+'">'+tile(p,cls)+'</span>'; }
function act(tag, cls, icon, label, attrs){ return '<'+tag+' class="act '+cls+'" '+attrs+'><i>'+icon+'</i><span>'+label+'</span></'+tag+'>'; }

function renderGoal(){
  document.getElementById("goal").innerHTML='<p class="motto"><span aria-hidden="true">“</span>'+esc(GOALS[0]||"")+'</p>';
  var n=pendingCount(), pb=document.getElementById("pending"), sent=S.sentAt && Date.now()-S.sentAt<15*60e3 && S.sentN===n;
  if(!n){ delete S.sentAt; delete S.sentN; }
  pb.hidden=!n; if(n) pb.innerHTML= sent
    ? '<span>Sent to Claude Code. This clears itself when the change lands in your repo.</span><a class="btn line" href="'+esc(codeLink(syncPrompt()))+'" target="_blank" rel="noopener" data-act="sync">Send again</a>'
    : '<span>'+n+(n===1?" change":" changes")+' on this device '+(n===1?"isn't":"aren't")+' in your repo yet.</span><a class="btn solid" href="'+esc(codeLink(syncPrompt()))+'" target="_blank" rel="noopener" data-act="sync">'+I.arrow+'Send to repo</a>';
  var fr=freshDirs(), fb=document.getElementById("fresh");
  if(fb){ fb.hidden=!fr.length; fb.innerHTML=fr.map(function(f){ return '<div class="freshrow"><span class="label">New in your repo</span><b>'+esc(f)+'/</b><div><a class="btn solid" href="'+esc(codeLink(addPrompt(f)))+'" target="_blank" rel="noopener" data-act="adddir" data-f="'+esc(f)+'">Add it</a><button class="btn line" data-act="ignoredir" data-f="'+esc(f)+'">Ignore</button></div></div>'; }).join(""); }
}
// the five projects worked on most recently, one picture each
function renderRecent(){
  var el=document.getElementById("recent"), ps=visible().slice().sort(function(a,b){ return days(a)-days(b) || b.commits-a.commits; }).slice(0,5);
  el.innerHTML=ps.map(function(p){ var shot=(typeof SHOTS!=="undefined"&&SHOTS[p.id])?SHOTS[p.id].src:"";
    return '<button class="rcard'+(p.shot==="landscape"?" wide":"")+'" data-act="open" data-id="'+p.id+'">'+
      (shot?'<span class="rimg"><img src="'+esc(shot)+'" alt=""></span>':'<span class="rimg icon" style="background:'+(COLORS[p.iconOf||p.id]||"var(--sunk)")+'">'+tile(p,"lg")+'</span>')+
      '<b>'+esc(p.name)+'</b><span>'+esc(gate(p).name)+' · '+ago(days(p))+'</span></button>'; }).join("");
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
  vis.forEach(function(p){ if(stg(p)>top) top=stg(p); });
  STAGES.forEach(function(s){
    var ps=vis.filter(function(p){ return stg(p)===s.n; }).sort(function(a,b){ var pa=progress(a), pb=progress(b); return (pb.of?pb.done/pb.of:0)-(pa.of?pa.done/pa.of:0); });
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
    var a=pts[n], b=pts[n+1], loops=n<=2?1:0, sg=b.y<a.y?-1:1, R=Math.min(12,Math.abs(a.y-b.y)/6), dir=n%2?1:-1, K=96;
    for(var i=0;i<=K;i++){
      var t=i/K, tb=loops ? (t<.38 ? t/.76 : t>.62 ? (t-.24)/.76 : .5) : t;
      var e=tb*tb*(3-2*tb), x=a.x+(b.x-a.x)*e, y=a.y+(b.y-a.y)*tb;
      x+=Math.sin(tb*Math.PI*2)*8*a.w*dir;
      if(loops&&t>=.38&&t<=.62){ var th=(t-.38)/.24*Math.PI*2; x+=(1-Math.cos(th))*R*dir; y+=sg*Math.sin(th)*R; }
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
  vis.sort(UI.sort==="gate" ? function(a,b){ return (stg(b)-stg(a)) || (progress(b).done/Math.max(1,progress(b).of)-progress(a).done/Math.max(1,progress(a).of)); } : function(a,b){ return (isStar(b.id)-isStar(a.id)) || (days(a)-days(b)); });
  document.getElementById("filters").innerHTML=[["all","All"],["game","Games"],["tabletop","Tabletop"],["tool","Tools"]].map(function(k){ return '<button class="chip" data-act="kind" data-v="'+k[0]+'" aria-pressed="'+(UI.kind===k[0])+'">'+k[1]+'</button>'; }).join("")+
    '<button class="round" data-act="sort" aria-label="Change sort order">'+I.sort+'</button>';
  var show=UI.showAll?vis:vis.slice(0,10);
  document.getElementById("cards").innerHTML=show.map(function(p){ var pr=progress(p);
    return '<div class="card"><button class="main" data-act="open" data-id="'+p.id+'">'+tile(p)+
     '<span class="txt"><b>'+esc(p.name)+'</b><span class="tag">'+esc(p.tag)+'</span>'+
     '<span class="meta"><span class="st">'+esc(gate(p).name)+'</span><span>'+pr.done+" of "+pr.of+'</span><span>'+ago(days(p))+'</span>'+(isProto(p)?'<span>Kept as a prototype</span>':'')+(isNfp(p)?'<span>Not for publish</span>':'')+(noDoc(p)?'<span class="flag">No doc linked</span>':'')+'</span></span></button>'+
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
  notesOf(p).forEach(function(n, i){
    if(DOCS[n]) return;
    DOCS[n]={state:"loading"};
    var id=docId(n), url=id ? "https://docs.google.com/document/d/"+id+"/export?format=txt" : (/^https?:/.test(n) ? "" : "../"+n+"?t="+Date.now());
    if(!url){ DOCS[n]={state:"blocked"}; return; }
    fetch(url).then(function(r){ if(!r.ok) throw 0; return r.text(); })
     .then(function(t){ if(/<html/i.test(t.slice(0,300))) throw 0; var first=(t.replace(/^\uFEFF/,"").split(/\r?\n/).filter(function(l){ return l.trim(); })[0]||"").replace(/^#+\s*/,"").trim();
        DOCS[n]={state:"ok", title:id?first.slice(0,60):"", items:id?parseDoc(t):parseFile(t)}; paintDoc(p); })
     .catch(function(){ DOCS[n]={state:"blocked"}; paintDoc(p); });
  });
  paintDoc(p);
}
function docName(n){ var d=DOCS[n]||{}; return d.title || (docId(n) ? "Google Doc" : n.split("/").pop()); }
function paintDoc(p){
  var el=document.getElementById("docbody"); if(!el||el.dataset.id!==p.id) return;
  var ns=notesOf(p);
  el.innerHTML=ns.map(function(n, i){ var d=DOCS[n]||{};
    var sub = d.state==="ok" ? (i===0 ? (d.items.length?d.items.length+" open":"Nothing open") : "") : d.state==="blocked" ? (i===0&&p.docOpen!=null&&S.notes[p.id]==null?p.docOpen+" open when last read":"") : "Checking…";
    return '<div class="docrow"><a class="doclink" href="'+esc(docHref(n))+'" target="_blank" rel="noopener"><i>'+I.doc+'</i><span><b>'+esc(docName(n))+'</b>'+(i===0?'<em>Running notes'+(sub?" · "+esc(sub):"")+'</em>':(sub?'<em>'+esc(sub)+'</em>':''))+'</span></a><button class="x" data-act="rmdoc" data-id="'+p.id+'" data-i="'+i+'" aria-label="Remove this doc">×</button></div>'+
      (i===0&&d.state==="ok"&&d.items.length?'<details class="how"><summary>Read the '+d.items.length+' open</summary><ul>'+d.items.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join("")+'</ul></details>':''); }).join("");
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
    var items=(p.videos||[]).map(function(v){ var m=/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/.exec(v); return m ? {type:"yt", id:m[1], href:v} : {type:"video", src:/^https?:/.test(v)?v:"../"+v}; }), names=(list||[]).map(function(f){ return typeof f==="string"?f:f.name; }).sort(), base="../"+p.folder+"/media/";
    names.forEach(function(nm){ if(/\.(png|jpe?g|webp|gif)$/i.test(nm)) items.push({type:"img", src:base+encodeURIComponent(nm)}); else if(/\.(mp4|webm|mov)$/i.test(nm)) items.push({type:"video", src:base+encodeURIComponent(nm)}); });
    if(names.indexOf("videos.txt")>=0){
      fetch(base+"videos.txt").then(function(r){ return r.ok?r.text():""; }).then(function(t){ t.split(/\s+/).forEach(function(u){ var m=/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/.exec(u); if(m) items.push({type:"yt", id:m[1], href:u}); }); done(items); }, function(){ done(items); });
    } else done(items);
  }).catch(function(){ done((p.videos||[]).map(function(v){ return {type:"video", src:/^https?:/.test(v)?v:"../"+v}; })); });
}
function paintMedia(p){
  var el=document.getElementById("gallery"); if(!el||el.dataset.id!==p.id) return;
  var m=MEDIA[p.id]||{}, items=(m.items||[]).slice(), shot=(typeof SHOTS!=="undefined"&&SHOTS[p.id])?SHOTS[p.id]:null;
  if(m.state!=="ok"){ el.hidden=true; return; }
  if(!items.length && shot) items=[{type:"img", src:shot.src, cap:"How it looks now"+(shot.on?" · "+shot.on:"")}];
  if(!items.length){ el.hidden=true; return; }
  el.hidden=false;
  el.innerHTML='<div class="reel'+(p.shot==="landscape"?" wide":"")+(items.length===1?" one":"")+'">'+items.map(function(it){
    return '<div class="frame'+(it.type!=="img"?" vid":"")+'">'+(it.type==="img" ? '<img src="'+esc(it.src)+'" alt="'+esc(p.name)+' screenshot">'
      : it.type==="video" ? '<video src="'+esc(it.src)+'" controls playsinline preload="metadata"></video>'
      : '<a href="'+esc(it.href)+'" target="_blank" rel="noopener" class="yt"><img src="https://img.youtube.com/vi/'+esc(it.id)+'/hqdefault.jpg" alt="Video"><span>Watch on YouTube</span></a>')+(it.cap?'<span class="cap">'+esc(it.cap)+'</span>':'')+'</div>'; }).join("")+'</div>'+
    (items.length>1?'<div class="reelnav"><button class="round" data-reel="-1" aria-label="Previous">'+I.prev+'</button><p class="reelnote"><span id="reelpos">1</span> of '+items.length+'</p><button class="round" data-reel="1" aria-label="Next">'+I.next+'</button></div>':'');
  var reel=el.querySelector(".reel"), pos=document.getElementById("reelpos");
  function step(){ var f=reel.querySelector(".frame"); return f ? f.getBoundingClientRect().width+10 : 260; }
  el.querySelectorAll("[data-reel]").forEach(function(b){ b.addEventListener("click", function(){ reel.scrollBy({left:(+b.dataset.reel)*step(), behavior:"smooth"}); }); });
  // dragging with a mouse, since a desktop has no swipe
  var drag=null;
  reel.addEventListener("pointerdown", function(e){ if(e.pointerType!=="mouse"||e.target.closest("video")) return; drag={x:e.clientX, left:reel.scrollLeft, moved:false}; reel.classList.add("dragging"); });
  window.addEventListener("pointermove", function(e){ if(!drag) return; var dx=e.clientX-drag.x; if(Math.abs(dx)>4) drag.moved=true; reel.scrollLeft=drag.left-dx; });
  window.addEventListener("pointerup", function(){ if(!drag) return; var d=drag; drag=null; reel.classList.remove("dragging"); if(d.moved){ swallow=true; setTimeout(function(){ swallow=false; },80); reel.scrollTo({left:Math.round(reel.scrollLeft/step())*step(), behavior:"smooth"}); } });
  reel.addEventListener("dragstart", function(e){ e.preventDefault(); });
  if(pos) reel.addEventListener("scroll", function(){ var f=reel.querySelector(".frame"); if(!f) return; pos.textContent=Math.min(items.length, Math.round(reel.scrollLeft/(f.getBoundingClientRect().width+10))+1); }, {passive:true});
}

function renderSheet(){
  var sc=document.getElementById("scrim");
  if(UI.menu){ sc.hidden=false; sc.innerHTML=menuHtml(); document.body.style.overflow="hidden"; return; }
  var p=BY[UI.open]; if(!p){ sc.hidden=true; sc.innerHTML=""; document.body.style.overflow=""; return; }
  var h=href(p), g=gate(p), cs=checks(p), pr=progress(p), nx=nextItem(p), n=days(p), nxt=STAGES[stg(p)], nfp=isNfp(p), proto=isProto(p);
  var canAdvance=nxt && !proto && !(nfp && p.stage>=6);
  var hc=COLORS[p.iconOf||p.id]||({game:"#8a2c26",tabletop:"#1c4f80",tool:"#6f5500"})[p.kind];
  var open=cs.filter(function(x){ return !x.done; }), done=cs.filter(function(x){ return x.done; });
  function row(x){ return '<li class="'+(x.done?"done":"")+'"><button class="check" data-act="tick" data-id="'+p.id+'" data-h="'+x.h+'" aria-label="'+(x.done?"Mark not done":"Mark done")+'" aria-pressed="'+x.done+'">'+I.check+'</button><span class="tx">'+esc(x.t)+'</span></li>'; }
  sc.hidden=false; document.body.style.overflow="hidden";
  sc.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(p.name)+'">'+
   '<div class="hero" style="--hc:'+hc+'">'+
   '<div class="shead">'+tile(p,"lg")+'<div class="t"><h2>'+esc(p.name)+'</h2><p>'+esc(p.tag)+'</p></div><button class="round" data-act="close" aria-label="Close">'+I.x+'</button></div>'+
   '<div class="quote"><span aria-hidden="true">“</span><textarea class="fit" id="love" rows="1" data-id="'+p.id+'" aria-label="The razor for '+esc(p.name)+'" placeholder="The razor: what you\'d say in an elevator about why this is cool">'+esc(loveOf(p))+'</textarea></div>'+
   '<div class="acts">'+
     (h?act("a","",I.open,p.kind==="tool"?"Open":"Play",'href="'+esc(h)+'" target="_blank" rel="noopener"'):'')+
     (notesOf(p).length?act("a","",I.doc,"Notes",'href="'+esc(notesHref(p))+'" target="_blank" rel="noopener"'):'')+
     (notesOf(p).length?act("a","",I.arrow,"Work",'href="'+esc(codeLink(notesPrompt(p)))+'" target="_blank" rel="noopener" data-act="notespass" data-id="'+p.id+'"'):'')+
     act("button",isStar(p.id)?"on":"",I.star,isStar(p.id)?"Starred":"Star",'data-act="star" data-id="'+p.id+'" aria-pressed="'+isStar(p.id)+'"')+
     act("button",UI.more?"on":"",I.dots,"More",'data-act="more2" aria-expanded="'+UI.more+'"')+
   '</div>'+
   (UI.more?'<div class="moreacts">'+
      SKILLS.filter(function(k){ return k.per && (!k.kinds || k.kinds.indexOf(p.kind)>=0); }).map(function(k){ return '<a class="btn" href="'+esc(codeLink(skillPrompt(k.key,p)))+'" target="_blank" rel="noopener" data-act="skill" data-k="'+k.key+'" data-id="'+p.id+'">'+esc(k.key==="gate-check" ? "Gate Check: "+(p.checked?shortDate(p.checked):"never") : k.button)+'</a>'; }).join("")+
      '<button class="btn" data-act="proto" data-id="'+p.id+'" aria-pressed="'+proto+'">'+(proto?"Prototype: on":"Prototype")+'</button><button class="btn" data-act="nfp" data-id="'+p.id+'" aria-pressed="'+nfp+'">'+(nfp?"Not for publish: on":"Not for publish")+'</button><button class="btn" data-act="hide" data-id="'+p.id+'">Hide</button></div>':'')+
   '</div>'+
   '<div id="gallery" class="gallery" data-id="'+p.id+'" hidden></div>'+
   (proto?'<div class="block jump"><span class="label">Prototype</span><p class="jtask">Kept as a prototype.</p><p class="hint">It did its job, so nothing more is being asked of it. Turn Prototype off under More to send it on toward release.</p></div>':
   '<div class="block jump"><span class="label">'+esc(g.name)+' · '+pr.done+' of '+pr.of+(nfp?" · not for publish":"")+'</span>'+
     (noDoc(p)?'<p class="redflag">No Google Doc linked. A game should have one before it leaves Prototype. Paste a link under Docs.</p>':'')+
     (nx?'<p class="jtask">'+esc(nx.t)+'</p>':'<p class="jtask">Everything for '+esc(g.name)+' is ticked.</p>')+
     (p.left?'<p class="hint">Last time, '+ago(n)+': '+esc(p.left)+'</p>':'')+
     (nx?'<div class="chatacts"><a class="btn solid" href="'+esc(codeLink(goPrompt(p,nx.t)))+'" target="_blank" rel="noopener" data-act="go" data-id="'+p.id+'">'+I.arrow+'Let\'s do it!</a></div>'
        :(canAdvance?'<div class="chatacts"><a class="btn solid" href="'+esc(codeLink(gatePrompt(p)))+'" target="_blank" rel="noopener" data-act="gate" data-id="'+p.id+'">'+I.arrow+'Move it to '+esc(nxt.name)+'</a></div>':''))+'</div>')+
   '<div class="block docs"><span class="label">Docs</span><div id="docbody" data-id="'+p.id+'"></div>'+linkForm(p, notesOf(p).length?"Add another Google Doc link":"Paste a Google Doc link")+'</div>'+
   (proto?'':'<div class="block"><span class="label">To get through '+esc(g.name)+'</span><p class="hint">'+esc(g.desc)+'</p>'+
     '<div class="bar big"><i style="width:'+(pr.of?Math.round(pr.done/pr.of*100):0)+'%"></i></div>'+
     (open.length?'<ul class="list">'+(UI.allItems?open:open.slice(0,10)).map(row).join("")+'</ul>':'')+
     (open.length>10&&!UI.allItems?'<button class="btn line" data-act="showall">Show the other '+(open.length-10)+'</button>':'')+
     (done.length?'<details class="doneitems"'+(open.length?"":" open")+'><summary>'+done.length+' done</summary><ul class="list">'+done.map(row).join("")+'</ul></details>':'')+
   '</div>')+
   '<details class="block more"><summary><span class="label">Details</span></summary>'+
     '<p>'+esc(p.status)+'</p>'+
     (p.backlog.length?'<span class="grp">Bigger work and ideas · '+p.backlog.length+'</span><ul class="list">'+p.backlog.map(function(t){ return '<li><span class="dot"></span><span class="tx">'+esc(t)+'</span></li>'; }).join("")+'</ul>':'')+
     ((p.done||[]).length?'<span class="grp">Shipped · '+p.done.length+'</span><ul class="list">'+p.done.slice().reverse().map(function(x){ return '<li><span class="dot"></span><span class="tx">'+esc(x.t)+(x.on?' <span class="hint">'+esc(x.on)+'</span>':'')+'</span></li>'; }).join("")+'</ul>':'')+
     (canAdvance?'<span class="grp">Next gate: '+esc(nxt.name)+'</span><p class="hint">'+esc(nxt.desc)+'</p>':'')+
     '<p class="src">'+p.commits+" commits · started "+p.first+" · last commit "+lastOf(p)+" · "+esc(p.folder)+'/</p>'+
   '</details>'+
  '</div>';
  fitAll(); loadDoc(p); loadMedia(p);
}
function applySkin(){ var r=document.documentElement; if(S.skin!=='classic') r.setAttribute('data-skin','pixel'); else r.removeAttribute('data-skin'); var m=document.getElementById('mark'); if(m && !m.firstChild && ICONS.shipit) m.innerHTML='<img src="'+ICONS.shipit+'" alt="">'; }
function menuHtml(){
  return '<div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">'+
   '<div class="shead"><div class="t"><h2>Ship It!</h2><p>'+PROJECTS.length+' projects. projects.json last updated '+esc(UPDATED)+'</p></div><button class="round" data-act="close" aria-label="Close">'+I.x+'</button></div>'+
   '<div class="block"><span class="label">Look</span><div class="chatacts"><button class="btn '+(S.skin!=="classic"?"line":"solid")+'" data-act="skin" data-k="classic" aria-pressed="'+(S.skin==="classic")+'">Classic</button><button class="btn '+(S.skin!=="classic"?"solid":"line")+'" data-act="skin" data-k="pixel" aria-pressed="'+(S.skin!=="classic")+'">Pixel</button></div></div>'+
   '<div class="block"><span class="label">Fresh dates</span><p>Ask GitHub when each project last changed.</p><button class="btn solid" data-act="github">Check GitHub now</button><span class="hint" id="ghmsg">'+(S.liveAt?"Last checked "+new Date(S.liveAt).toLocaleString():"Not checked yet")+'</span></div>'+
   '<div class="block"><span class="label">Skills</span><p class="hint">Things Claude Code knows how to do in your repo. The ones marked per project are also under More on each project\'s page.</p>'+
     SKILLS.map(function(k){ return '<div class="skill"><b>'+esc(k.name)+'</b>'+(k.per?'<span class="pill">per project</span>':'')+'<p>'+esc(k.what)+'</p><p class="hint">Say: “'+esc(k.say)+'”</p>'+(k.all?'<a class="btn line" href="'+esc(codeLink(skillPrompt(k.key,null)))+'" target="_blank" rel="noopener" data-act="skill" data-k="'+k.key+'">'+esc(k.all)+'</a>':'')+'</div>'; }).join("")+'</div>'+
   '<div class="block"><span class="label">How this saves</span><p>Everything lives in your repo, in shipit/projects.json, so every device shows the same thing. A tick, a star or a new link made here waits on this device until you press Send to repo.</p></div>'+
   '<div class="block"><span class="label">Not tracked</span><p class="hint">Folders left out because they hold assets, originals or one-off pages: '+esc(IGNORED.map(function(x){ return x.folder; }).concat(S.ignore).join(", "))+'.</p></div>'+
  '</div>';
}
function fit(t){ t.style.height="auto"; t.style.height=t.scrollHeight+"px"; }
function fitAll(){ document.querySelectorAll("textarea.fit").forEach(fit); }
function renderAll(){ if(!LOADED) return; renderGoal(); renderRecent(); renderNow(); renderFocus(); renderPath(); renderList(); renderSheet(); }
function keepScroll(fn){ var sh=document.querySelector(".sheet"), t=sh?sh.scrollTop:0; fn(); sh=document.querySelector(".sheet"); if(sh) sh.scrollTop=t; }

var swallow=false;   // the click a browser fires at the end of a mouse drag
document.addEventListener("click", function(e){
  if(swallow){ swallow=false; e.preventDefault(); return; }
  var t=e.target.closest("[data-act]");
  if(!t){ if(e.target.id==="scrim"){ UI.open=null; UI.menu=false; UI.more=false; renderSheet(); } return; }
  var a=t.dataset.act, id=t.dataset.id, p=BY[id];
  if(a==="open"){ UI.open=id; UI.more=false; UI.allItems=false; renderSheet(); document.querySelector(".sheet").scrollTop=0; }
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
  else if(a==="proto"){ var pv=!isProto(p); if(pv===!!p.proto) delete S.proto[id]; else S.proto[id]=pv; save(); keepScroll(renderAll); toast(pv?p.name+" stays a prototype. It won't be pushed any further.":p.name+" is back on the dev plan."); }
  else if(a==="nfp"){ var nv=!isNfp(p); if(nv===!!p.nfp) delete S.nfp[id]; else S.nfp[id]=nv; save(); keepScroll(renderAll); toast(nv?p.name+" won't be pushed toward release.":p.name+" is headed for release again."); }
  else if(a==="kind"){ UI.kind=t.dataset.v; UI.showAll=false; renderList(); }
  else if(a==="sort"){ UI.sort=UI.sort==="recent"?"gate":"recent"; renderList(); }
  else if(a==="more"){ UI.showAll=true; renderList(); }
  else if(a==="tick"){ var h=t.dataset.h, cur=checks(p).filter(function(x){ return x.h===h; })[0], base=p.checklist.filter(function(it){ return hash(it.t)===h; })[0]; if(!cur||!base) return;
    var nv2=!cur.done; S.checks[id]=S.checks[id]||{}; if(nv2===!!base.done) delete S.checks[id][h]; else S.checks[id][h]=nv2?1:0; if(!Object.keys(S.checks[id]).length) delete S.checks[id]; save(); keepScroll(renderAll); }
  else if(a==="rmdoc"){ var arr=notesOf(p).slice(); arr.splice(+t.dataset.i,1); S.notes[id]=arr; if(arr.join("|")===fileNotes(p).join("|")) delete S.notes[id]; save(); keepScroll(renderAll); }
  else if(a==="showall"){ UI.allItems=true; keepScroll(renderSheet); }
  else if(a==="nownext"){ UI.nowIdx++; renderNow(); }
  else if(a==="go"){ copy(goPrompt(p,(nextItem(p)||{}).t), "Opening Claude Code. The request is copied too."); }
  else if(a==="gate"){ copy(gatePrompt(p), "Opening Claude Code. The request is copied too."); }
  else if(a==="notespass"){ copy(notesPrompt(p), "Opening Claude Code. The request is copied too."); }
  else if(a==="check"){ copy(checkPrompt(p), "Opening Claude Code. The request is copied too."); }
  else if(a==="skill"){ copy(skillPrompt(t.dataset.k, p), "Opening Claude Code. The request is copied too."); }
  else if(a==="sync"){ copy(syncPrompt(), "Opening Claude Code. The changes are copied too."); S.sentAt=Date.now(); S.sentN=pendingCount(); save(); setTimeout(renderGoal,400); }
  else if(a==="github"){ checkGitHub(true); }
  else if(a==="ignoredir"){ if(S.ignore.indexOf(t.dataset.f)<0) S.ignore.push(t.dataset.f); save(); keepScroll(renderAll); toast(t.dataset.f+" will be ignored. Send to repo to keep that on every device."); }
  else if(a==="adddir"){ copy(addPrompt(t.dataset.f), "Opening Claude Code. The request is copied too."); }
  else if(a==="skin"){ S.skin=t.dataset.k; save(); applySkin(); keepScroll(renderAll); }
});
document.addEventListener("submit", function(e){
  var lf=e.target.closest('[data-form="link"]'); if(!lf) return; e.preventDefault();
  var lv=lf.querySelector("input").value.trim(), lp=BY[lf.dataset.id]; if(!lv) return;
  if(!docId(lv)){ toast("That doesn't look like a Google Doc link."); return; }
  var nu="https://docs.google.com/document/d/"+docId(lv)+"/edit", cur=notesOf(lp).slice();
  if(cur.indexOf(nu)>=0){ toast("That doc is already linked."); return; }
  cur.push(nu); S.notes[lp.id]=cur; save(); keepScroll(renderAll); toast("Linked. Send to repo to keep it on every device.");
});
document.addEventListener("input", function(e){
  if(e.target.classList&&e.target.classList.contains("fit")) fit(e.target);
  if(e.target.id==="love"){ S.love[e.target.dataset.id]=e.target.value; save(); }
});
document.addEventListener("keydown", function(e){ if(e.key==="Escape"&&(UI.open||UI.menu)){ UI.open=null; UI.menu=false; UI.more=false; renderAll(); } });
window.addEventListener("resize", drawTrail);

function checkFolders(){ S.freshAt=Date.now(); save();
  fetch("https://api.github.com/repos/"+REPO+"/contents/").then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(j){ S.fresh=j.filter(function(x){ return x.type==="dir" && x.name.charAt(0)!=="."; }).map(function(x){ return x.name; }); save(); if(LOADED) renderGoal(); }).catch(function(){});
}
function checkGitHub(manual){
  var msg=function(m){ var el=document.getElementById("ghmsg"); if(el) el.textContent=m; };
  var list=PROJECTS.slice(), i=0, changed=0, failed=false;
  if(manual) msg("Checking…");
  checkFolders();
  function next(){
    if(failed) return;
    if(i>=list.length){ S.liveAt=Date.now(); save(); renderAll(); if(manual){ UI.menu=true; renderSheet(); msg((changed?changed+" projects have newer commits than the file says.":"Nothing newer than the file.")+(freshDirs().length?" New folders: "+freshDirs().join(", ")+".":" No new folders.")); } return; }
    var p=list[i++];
    fetch("https://api.github.com/repos/"+REPO+"/commits?per_page=1&path="+encodeURIComponent(p.folder)).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(j){
      var d=j&&j[0]&&j[0].commit&&j[0].commit.committer&&j[0].commit.committer.date;
      if(d){ d=d.slice(0,10); if(d>p.last){ if(S.live[p.id]!==d) changed++; S.live[p.id]=d; } }
      next();
    }).catch(function(){ failed=true; if(manual) msg("Couldn't reach GitHub from here."); });
  }
  next();
}

var lastFetch=0;
function refresh(first){
  if(location.protocol==="file:") return;
  lastFetch=Date.now();
  fetch("projects.json?t="+Date.now(),{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
    if(!d||!Array.isArray(d.projects)) throw 0;
    var typing=document.activeElement&&/^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName);
    setData(d); if(typing) renderGoal(); else keepScroll(renderAll);
  }).catch(function(){ if(first&&!LOADED) document.getElementById("now").innerHTML='<span class="label">One thing right now</span><p class="task">Couldn\'t load projects.json.</p><p class="why">It should sit next to this page in the shipit folder.</p>'; });
}
if(window.TRAILHEAD_DATA){ setData(window.TRAILHEAD_DATA); renderAll(); }
else document.getElementById("now").innerHTML='<span class="label">One thing right now</span><p class="why">Loading your projects…</p>';
refresh(true);
// coming back to the tab, or waiting on something just sent: look at the repo again
document.addEventListener("visibilitychange", function(){ if(!document.hidden && Date.now()-lastFetch>8000) refresh(); });
window.addEventListener("focus", function(){ if(Date.now()-lastFetch>8000) refresh(); });
setInterval(function(){ if(!document.hidden && LOADED && pendingCount() && Date.now()-lastFetch>30000) refresh(); }, 10000);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(drawTrail);
applySkin();
if(!S.freshAt || Date.now()-S.freshAt>6*3600e3) checkFolders();
})();
