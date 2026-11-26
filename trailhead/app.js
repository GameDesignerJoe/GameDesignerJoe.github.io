(function(){
"use strict";
var KEY="trailhead.v1";
var mem={};
function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||"{}")||{}; }catch(e){ return mem; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ mem=S; } }
var S=load();
["star","hidden","skip"].forEach(function(k){ if(!Array.isArray(S[k])) S[k]=[]; });
["dream","love","done","added","removed","live","basics","chat","order"].forEach(function(k){ if(!S[k]||typeof S[k]!=="object") S[k]={}; });
var KKEY="trailhead.key", memKey="";
function getKey(){ try{ return localStorage.getItem(KKEY)||""; }catch(e){ return memKey; } }
function setKey(v){ memKey=v; try{ if(v) localStorage.setItem(KKEY,v); else localStorage.removeItem(KKEY); }catch(e){} }
var MODEL_DEFAULT="anthropic/claude-sonnet-4.6";
function migrate(){
  var v=S.v||1;
  if(v<3){ if(S.star.length) S.starSet=true; if(S.hidden.length) S.hidSet=true; }
  if(v<4){
    Object.keys(S.dream).forEach(function(id){ var d=S.dream[id]; if(d&&typeof d==="object") S.dream[id]=d.text||""; if(!S.dream[id]) delete S.dream[id]; });
    Object.keys(S.added).forEach(function(id){ var a=S.added[id]; if(a&&a.steps){ a.todos=a.steps.concat(a.todos||[]); delete a.steps; } });
    [S.done].concat(Object.keys(S.removed).map(function(id){ return S.removed[id]; })).forEach(function(o){ Object.keys(o||{}).forEach(function(k){ if(k.indexOf(":steps:")>0){ o[k.replace(":steps:",":todos:")]=o[k]; delete o[k]; } }); });
  }
  S.v=4;
}
var UI={kind:"all", sort:"recent", showAll:false, open:null, menu:false, nowIdx:0, justDone:0};
var PROJECTS=[], BY={}, SCANNED="", LOADED=false;
function same(a,b){ return a.slice().sort().join("|")===b.slice().sort().join("|"); }
function fileSet(k){ return PROJECTS.filter(function(p){ return p[k]; }).map(function(p){ return p.id; }); }
// The repo's projects.json is the truth. What you change on this device sits on top of it until it is sent to the repo.
function setData(d){
  PROJECTS=(d.projects||[]).map(function(p){
    p.icon=p.icon||p.emoji||"•";
    if(p.steps&&p.steps.length){ p.todos=p.steps.concat(p.todos||[]); } delete p.steps; p.todos=p.todos||[]; p.ideas=p.ideas||[];
    if(p.dream&&typeof p.dream==="object") p.dream=p.dream.text||""; if(p.dreamHint&&typeof p.dreamHint==="object") p.dreamHint=p.dreamHint.text||"";
    return p; });
  BY={}; PROJECTS.forEach(function(p){ BY[p.id]=p; });
  SCANNED=d.updated||""; if(d.goals&&d.goals.length) GOALS=d.goals; if(d.lead) LEAD=d.lead;
  LOADED=true; migrate(); reconcile(); save();
}
var GENERIC=["Open it and use it once, start to finish","Open it and play for five minutes","Open the folder and read the last thing you wrote"];
function inFile(p, t){ return ["todos","ideas"].some(function(k){ return (p[k]||[]).indexOf(t)>=0; }) || (p.done||[]).some(function(x){ return x.t===t; }); }
function reconcile(){
  if(S.starSet && same(S.star, fileSet("star"))) S.starSet=false;
  if(S.hidSet && same(S.hidden, fileSet("hidden"))) S.hidSet=false;
  if(!S.starSet) S.star=fileSet("star");
  if(!S.hidSet) S.hidden=fileSet("hidden");
  S.star=S.star.filter(function(id){ return BY[id]; }); S.hidden=S.hidden.filter(function(id){ return BY[id]; });
  PROJECTS.forEach(function(p){
    if(S.dream[p.id]!=null && S.dream[p.id]===(p.dream||"")) delete S.dream[p.id];
    if(S.love[p.id]!=null && S.love[p.id]===(p.love||"")) delete S.love[p.id];
    var a=S.added[p.id]; if(a) Object.keys(a).forEach(function(k){ a[k]=a[k].filter(function(t){ return !inFile(p,t); }); });
    var b=S.basics[p.id]; if(b) Object.keys(b).forEach(function(k){ if(p.basics && (k in p.basics) && !!p.basics[k]===!!b[k]) delete b[k]; });
    var live={}; ["todos","ideas"].forEach(function(k){ (p[k]||[]).concat((S.added[p.id]||{})[k]||[]).forEach(function(t){ live[p.id+":"+k+":"+hash(t)]=1; }); });
    GENERIC.forEach(function(t){ live[p.id+":todos:"+hash(t)]=1; });
    if(S.order[p.id] && !((S.added[p.id]||{}).todos||[]).length && S.order[p.id].filter(function(t){ return (p.todos||[]).indexOf(t)>=0; }).join("|")===(p.todos||[]).join("|")) delete S.order[p.id];
    Object.keys(S.done).forEach(function(k){ if(k.indexOf(p.id+":")===0 && !live[k]) delete S.done[k]; });
    var r=S.removed[p.id]; if(r) Object.keys(r).forEach(function(k){ if(!live[k]) delete r[k]; });
  });
}
// everything on this device that the repo doesn't have yet
function pending(){
  var out=[];
  PROJECTS.forEach(function(p){
    var c={project:p.id, name:p.name}, n=0, set={};
    if(S.dream[p.id]!=null){ set.dream=S.dream[p.id]||null; n++; }
    if(S.love[p.id]!=null){ set.love=S.love[p.id]; n++; }
    if(S.starSet && isStar(p.id)!==!!p.star){ set.star=isStar(p.id); n++; }
    if(S.hidSet && isHidden(p.id)!==!!p.hidden){ set.hidden=isHidden(p.id); n++; }
    var b=S.basics[p.id]; if(b&&Object.keys(b).length){ set.basics={}; Object.keys(b).forEach(function(k){ set.basics[k]=!!b[k]; }); n+=Object.keys(b).length; }
    if(n) c.set=set;
    var ord=S.order[p.id];
    if(ord){ set.todos=items(p,"todos").map(function(o){ return o.t; }).filter(function(t){ return GENERIC.indexOf(t)<0; }); c.set=set; n++; }
    var add={}; (ord?["ideas"]:["todos","ideas"]).forEach(function(k){ var a=((S.added[p.id]||{})[k]||[]); if(a.length){ add[k]=a.slice(); n+=a.length; } });
    if(Object.keys(add).length) c.add=add;
    var comp=[], rm=[]; ["todos","ideas"].forEach(function(k){ (p[k]||[]).concat(ord&&k==="todos"?((S.added[p.id]||{}).todos||[]):[]).forEach(function(t){ var key=p.id+":"+k+":"+hash(t); if((S.removed[p.id]||{})[key]){ if(!(ord&&k==="todos")) rm.push(t); } else if(S.done[key]) comp.push(t); }); });
    if(comp.length){ c.complete=comp; n+=comp.length; } if(rm.length){ c.remove=rm; n+=rm.length; }
    if(n){ c.n=n; out.push(c); }
  });
  return out;
}
function pendingCount(){ return pending().reduce(function(a,c){ return a+c.n; },0); }
function codeLink(text){ return "https://claude.ai/code/new?q="+encodeURIComponent(text.slice(0,9000))+"&repo="+encodeURIComponent(REPO)+"&branch=main"; }
function syncPrompt(){
  var p=pending().map(function(c){ var o={}; Object.keys(c).forEach(function(k){ if(k!=="n"&&k!=="name") o[k]=c[k]; }); return o; });
  return "Trailhead sync. Follow trailhead/README.md.\n\nApply these changes from my device to trailhead/projects.json, then commit to main and push. For each project: \"set\" replaces those fields (a \"todos\" list there is the new order, top three first), \"add\" appends to those lists, \"complete\" moves those items into done with today's date, \"remove\" deletes them. Change nothing else.\n\n"+JSON.stringify(p,null,1);
}
function taskPrompt(p, t){
  return "Trailhead task for "+p.name+", in the "+p.folder+"/ folder of this repo. Follow trailhead/README.md.\n\nTask: "+t+"\n\nFirst read this project's entry in trailhead/projects.json: where it stands, where I left off, what I love about it, and my dream for it. Then do the task, check that it works, and commit to main and push. When it's done, update the entry: move this task into done with today's date, and refresh status, left and last. If the task needs me (playing it, deciding something, recording something), don't fake it. Tell me exactly what you need.";
}

var I={
 star:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
 open:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>',
 sort:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5v14l-3-3M17 19V5l3 3"/></svg>',
 up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6"/></svg>',
 swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
 hide:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0112 6c5 0 8.5 4 9.5 6a13 13 0 01-2.6 3.4M6.3 7.7A13 13 0 002.5 12c1 2 4.500 6 9.500 6 1.300 0 2.500-.3 3.600-.7"/></svg>',
 dots:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
 send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
 x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
function lastOf(p){ var l=S.live[p.id]; return (l && l>p.last) ? l : p.last; }
function days(p){ var d=new Date(lastOf(p)+"T12:00:00"); return Math.max(0, Math.round((Date.now()-d.getTime())/864e5)); }
function ago(n){ if(n<=0) return "today"; if(n===1) return "yesterday"; if(n<14) return n+" days ago"; if(n<70) return Math.round(n/7)+" weeks ago"; if(n<365) return Math.round(n/30.4)+" months ago"; var y=Math.round(n/365*10)/10; return (y===1?"a year":y+" years")+" ago"; }
function stageName(n){ return STAGES[n-1].name; }
function href(p){ return !p.url ? "" : (/^https?:/.test(p.url) ? p.url : SITE+p.url); }
function isStar(id){ return S.star.indexOf(id)>=0; }
function loveOf(p){ return S.love[p.id]!=null ? S.love[p.id] : (p.love||""); }
function isHidden(id){ return S.hidden.indexOf(id)>=0; }
function visible(){ return PROJECTS.filter(function(p){ return !isHidden(p.id); }); }

// lists: what the scan found, minus what was removed, plus what was added on this device
function items(p, kind){
  var rem=S.removed[p.id]||{}, add=(S.added[p.id]||{})[kind]||[];
  var base=(p[kind]||[]).concat(add);
  if(kind==="todos"){
    var ord=S.order[p.id]; if(ord){ var first=ord.filter(function(t){ return base.indexOf(t)>=0; }); base=first.concat(base.filter(function(t){ return first.indexOf(t)<0; })); }
    if(!base.length) base=[ p.url ? (p.kind==="tool" ? GENERIC[0] : GENERIC[1]) : GENERIC[2] ];
  }
  return base.map(function(t){ return {t:t, k:p.id+":"+kind+":"+hash(t), mine:add.indexOf(t)>=0}; }).filter(function(o){ return !rem[o.k]; });
}
function openTodos(p){ return items(p,"todos").filter(function(o){ return !S.done[o.k]; }); }
function openSteps(p){ return openTodos(p).slice(0,3); }
function dream(p){ return S.dream[p.id]!=null ? S.dream[p.id] : (p.dream||""); }
function gapText(p){ return ""; }

// what to surface when nothing is starred: recently warm, heavily invested, close to a stated dream
function score(p){
  var n=days(p), s=Math.min(p.commits,150)/150*1.5;
  s += 3.5*Math.exp(-n/12) + (n<=60 ? .8 : n<=180 ? .3 : 0);
  if(dream(p)) s+=.8;
  if(p.love) s+=.4;
  return s;
}
function nowQueue(){
  var pool=visible().filter(function(p){ return openSteps(p).length && S.skip.indexOf(p.id)<0; });
  var stars=pool.filter(function(p){ return isStar(p.id); });
  var rest=pool.filter(function(p){ return !isStar(p.id); }).sort(function(a,b){ return score(b)-score(a); });
  return stars.concat(rest);
}
function why(p){
  var n=days(p);
  if(isStar(p.id)) return "One of your focus projects. Last touched "+ago(n)+".";
  if(n<=14) return "You were in here "+ago(n)+". The thread is still warm.";
  if(p.commits>=40) return p.commits+" commits in, and untouched for "+(n<70?Math.round(n/7)+" weeks":Math.round(n/30.4)+" months")+".";
  return "Last touched "+ago(n)+".";
}

function prompt(p, step){
  var d=dream(p), L=[];
  L.push("I'm getting back into "+p.name+", one of my side projects. It lives in the "+p.folder+"/ folder of my "+REPO+" repo"+(href(p)?" and runs at "+href(p):"")+".");
  L.push(""); L.push("Where it stands: "+p.status);
  if(p.left) L.push("Where I left off ("+lastOf(p)+"): "+p.left);
  var lv=loveOf(p); if(lv) L.push("What I love about it: "+lv);
  if(d) L.push("My dream for it: "+d);
  L.push("It's at the \""+stageName(p.stage)+"\" stage of my usual path ("+STAGES.map(function(s){return s.name;}).join(" > ")+").");
  var st=step||(openSteps(p)[0]||{}).t; if(st){ L.push(""); L.push("The one small thing I want to do right now: "+st); }
  var td=openTodos(p).slice(0,8);
  if(td.length){ L.push(""); L.push("Open to-dos:"); td.forEach(function(o){ L.push("- "+o.t); }); }
  var miss=basicsOf(p).filter(function(x){ return !x.ok; }).map(function(x){ return x.name; });
  if(miss.length){ L.push(""); L.push("Basics it's still missing: "+miss.join(", ")+"."); }
  L.push("My bigger goal: "+GOALS.join(" "));
  L.push(""); L.push("Help me start with that one small thing. Keep it small, then tell me the next step after it.");
  return L.join("\n");
}

var toastT;
function toast(msg){ var t=document.getElementById("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ t.hidden=true; }, 2600); }
function copy(text, ok){
  var done=function(){ toast(ok); };
  var fb=function(){ var ta=document.createElement("textarea"); ta.value=text; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); done(); }catch(e){ toast("Couldn't copy from here"); } document.body.removeChild(ta); };
  try{ navigator.clipboard.writeText(text).then(done, fb); }catch(e){ fb(); }
}

function tile(p, cls){ var src=ICONS[p.id]; return '<span class="tile '+(cls||"")+'" aria-hidden="true">'+(src?'<img src="'+src+'" alt="">':p.icon)+'</span>'; }
function ringed(p, cls){ return '<span class="ring '+p.kind+(isStar(p.id)?" starred":"")+'">'+tile(p,cls)+'</span>'; }
function act(tag, cls, icon, label, attrs){ return '<'+tag+' class="act '+cls+'" '+attrs+'><i>'+icon+'</i><span>'+label+'</span></'+tag+'>'; }
function basicsOf(p){ var a=(AUDIT[p.id]||{}).c||{}, o=S.basics[p.id]||{}, f=p.basics||{}; return BASICS.filter(function(b){ return b[0] in a; }).map(function(b){ var v=(b[0] in o)?o[b[0]]:(b[0] in f)?f[b[0]]:a[b[0]]; return {k:b[0], name:b[1], desc:b[2], ok:!!v}; }); }
function basicsCount(p){ var b=basicsOf(p); return b.filter(function(x){return x.ok;}).length+" of "+b.length; }

function renderNow(){
  var q=nowQueue(), el=document.getElementById("now");
  if(!q.length){ el.innerHTML='<span class="label">One thing right now</span><p class="task">Every small step is ticked off.</p><p class="why">Add a new small step to any project and it shows up here.</p>'; return; }
  var p=q[UI.nowIdx % q.length], st=openSteps(p)[0];
  var h=href(p);
  el.innerHTML='<span class="label">'+(UI.justDone?"Nice. While you're in there":"Let's do this one thing right now")+'</span>'+
   '<button class="who" data-act="open" data-id="'+p.id+'">'+tile(p)+'<span>'+esc(p.name)+'</span></button>'+
   '<p class="task">'+esc(st.t)+'</p>'+
   '<p class="why">'+esc(UI.justDone ? UI.justDone+(UI.justDone===1?" step":" steps")+" done this sitting. Here's the next one." : why(p))+'</p>'+
   '<div class="acts">'+
    act("button","go",I.check,"Did it",'data-act="nowdone" data-k="'+st.k+'"')+
    (h?act("a","",I.open,p.kind==="tool"?"Open":"Play",'href="'+esc(h)+'" target="_blank" rel="noopener"'):'')+
    act("button","",I.chat,"Talk it out",'data-act="chat" data-id="'+p.id+'" data-step="'+esc(st.t)+'"')+
    (q.length>1?act("button","",I.swap,"Another",'data-act="nownext"'):'')+
   '</div>';
}

function renderFocus(){
  var el=document.getElementById("focus"), out="";
  var stars=S.star.map(function(id){ return BY[id]; }).filter(Boolean);
  for(var i=0;i<2;i++){
    var p=stars[i];
    if(p){ var g=gapText(p); out+='<button class="slot full" data-act="open" data-id="'+p.id+'">'+tile(p)+'<span class="txt"><b>'+esc(p.name)+'</b><span class="sub">'+esc(stageName(p.stage))+" · "+ago(days(p))+(g?" · "+esc(g):"")+'</span></span></button>'; }
    else out+='<div class="slot empty">'+(i===0&&!stars.length?"Star a project to pin it here. Two at most, so they stay the ones you really mean.":"One more focus slot.")+'</div>';
  }
  el.innerHTML=out;
}

function renderGoal(){
  var shapes=['<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="var(--surface)" stroke="var(--ink)" stroke-width="3.5"/></svg>',
   '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l8 14H2z" fill="var(--surface)" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"/></svg>',
   '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="1.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="3.5"/></svg>'];
  document.getElementById("goal").innerHTML='<span class="label">What I\'m reaching for</span><ul>'+GOALS.map(function(g,i){ return '<li>'+shapes[i%3]+'<span>'+esc(g)+'</span></li>'; }).join("")+'</ul>';
  var n=pendingCount(), pb=document.getElementById("pending");
  pb.hidden=!n; if(n) pb.innerHTML='<span>'+n+(n===1?" change":" changes")+' on this device '+(n===1?"isn't":"aren't")+' in your repo yet.</span><a class="btn solid" href="'+esc(codeLink(syncPrompt()))+'" target="_blank" rel="noopener" data-act="sync">'+I.arrow+'Send to repo</a>';
}
function renderPath(){
  var el=document.getElementById("path"), out='<svg aria-hidden="true"></svg>';
  var vis=visible(), top=0; vis.forEach(function(p){ if(p.stage>top) top=p.stage; });
  var lead=BY[LEAD];
  STAGES.slice().reverse().forEach(function(s){
    var ps=vis.filter(function(p){ return p.stage===s.n; }).sort(function(a,b){ return days(a)-days(b); });
    var dreamers=0;
    var cls=(s.n>top?" ahead":"")+(s.n===STAGES.length?" goalstop":"");
    out+='<div class="stop'+cls+'" data-stop="'+s.n+'"><div><h3>'+esc(s.name)+' <span class="count">'+ps.length+'</span></h3><p>'+esc(s.desc)+(dreamers?". "+dreamers+" headed here":"")+'</p></div>'+
     (ps.length?'<div class="chips">'+ps.map(function(p){ return '<button data-act="open" data-id="'+p.id+'" aria-label="'+esc(p.name)+'" title="'+esc(p.name)+'">'+ringed(p,"sm")+'</button>'; }).join("")+'</div>':'')+
     (lead&&!isHidden(lead.id)&&s.n===lead.stage+1?'<p class="leadnote">'+esc(lead.name)+'\'s next stop. It\'s your lead game.</p>':'')+
     (s.how?'<details class="how"'+(lead&&s.n===lead.stage+1?" open":"")+'><summary>What it takes</summary><ul>'+s.how.map(function(h){ return '<li>'+esc(h)+'</li>'; }).join("")+'</ul></details>':'')+
     '</div>';
  });
  el.innerHTML=out; drawTrail();
  document.getElementById("srcnote").innerHTML='The stops from Polished up are built on your '+PLAN_SRC.date+' chat, <a href="'+PLAN_SRC.url+'" target="_blank" rel="noopener">'+esc(PLAN_SRC.title)+'</a>. Fees and prices are as quoted there.';
}
function drawTrail(){
  var el=document.getElementById("path"), svg=el.querySelector("svg"); if(!svg) return;
  var box=el.getBoundingClientRect(), N=STAGES.length, pts=[];
  el.querySelectorAll(".stop").forEach(function(st){ var h=st.querySelector("h3").getBoundingClientRect(); pts[+st.dataset.stop]={y:h.top-box.top+h.height/2}; });
  if(!pts[1]) return;
  // wander wide at the start, straighten out toward the goal
  var CX=34;
  for(var n=1;n<=N;n++){ var w=Math.pow(1-(n-1)/(N-1),1.3); pts[n].x=CX+(n%2?-1:1)*15*w; pts[n].w=w; }
  var d="";
  for(n=1;n<N;n++){
    var a=pts[n], b=pts[n+1], w2=a.w, loops=n<=2?1:0, R=Math.min(12,(a.y-b.y)/6), dir=n%2?1:-1, K=96;
    for(var i=0;i<=K;i++){
      var t=i/K, tb=loops ? (t<.38 ? t/.76 : t>.62 ? (t-.24)/.76 : .5) : t;   // the walk pauses while the path curls
      var e=tb*tb*(3-2*tb), x=a.x+(b.x-a.x)*e, y=a.y+(b.y-a.y)*tb;
      x+=Math.sin(tb*Math.PI*2)*8*w2*dir;                       // a lazy extra bend
      if(loops&&t>=.38&&t<=.62){ var th=(t-.38)/.24*Math.PI*2; x+=(1-Math.cos(th))*R*dir; y-=Math.sin(th)*R; }  // a full loop back on itself
      d+=(d?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
    }
  }
  var g='<path d="'+d+'" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.1 7"/>';
  for(n=1;n<=N;n++){ var p=pts[n];
    g+= n===N ? '<circle cx="'+p.x+'" cy="'+p.y+'" r="10" fill="var(--surface)" stroke="var(--ink)" stroke-width="4"/><circle cx="'+p.x+'" cy="'+p.y+'" r="3.2" fill="var(--ink)"/>'
              : '<circle cx="'+p.x+'" cy="'+p.y+'" r="6.5" fill="var(--bg)" stroke="var(--ink)" stroke-width="3"/>';
  }
  svg.innerHTML=g;
}
function renderBasics(){
  var games=visible().filter(function(p){ return p.kind!=="tool"; });
  var rows=BASICS.map(function(b){ var n=0; games.forEach(function(p){ basicsOf(p).forEach(function(x){ if(x.k===b[0]&&x.ok) n++; }); }); return {b:b, n:n}; }).sort(function(a,c){ return a.n-c.n; });
  document.getElementById("basicsnote").textContent="Across "+games.length+" games";
  document.getElementById("basics").innerHTML=rows.map(function(r){ return '<div class="brow"><span>'+esc(r.b[1])+'</span><span class="bar"><i style="width:'+Math.round(r.n/games.length*100)+'%"></i></span><span class="n">'+r.n+"/"+games.length+'</span></div>'; }).join("");
}

function renderList(){
  var vis=visible().filter(function(p){ return UI.kind==="all"||p.kind===UI.kind; });
  vis.sort(UI.sort==="invested" ? function(a,b){ return b.commits-a.commits; } : function(a,b){ return (isStar(b.id)-isStar(a.id)) || (days(a)-days(b)); });
  var kinds=[["all","All"],["game","Games"],["tabletop","Tabletop"],["tool","Tools"]];
  document.getElementById("filters").innerHTML=kinds.map(function(k){ return '<button class="chip" data-act="kind" data-v="'+k[0]+'" aria-pressed="'+(UI.kind===k[0])+'">'+k[1]+'</button>'; }).join("")+
    '<button class="round" data-act="sort" aria-label="Change sort order. Now sorted by '+(UI.sort==="recent"?"last touched":"most work put in")+'">'+I.sort+'</button>';
  var show=UI.showAll?vis:vis.slice(0,10);
  document.getElementById("cards").innerHTML=show.map(function(p){
    var g=gapText(p);
    return '<div class="card"><button class="main" data-act="open" data-id="'+p.id+'">'+tile(p)+
     '<span class="txt"><b>'+esc(p.name)+'</b><span class="tag">'+esc(p.tag)+'</span>'+
     '<span class="meta"><span class="st">'+esc(stageName(p.stage))+'</span><span>'+ago(days(p))+'</span>'+(g?'<span>'+esc(g)+'</span>':(!dream(p)?'<span>No dream yet</span>':''))+'</span></span></button>'+
     '<button class="starbtn'+(isStar(p.id)?" on":"")+'" data-act="star" data-id="'+p.id+'" aria-label="'+(isStar(p.id)?"Remove star from ":"Star ")+esc(p.name)+'" aria-pressed="'+isStar(p.id)+'">'+I.star+'</button></div>';
  }).join("");
  var more=document.getElementById("more"); more.hidden=UI.showAll||vis.length<=10; more.textContent="Show all "+vis.length;
  document.getElementById("count").textContent=visible().length+" showing, by "+(UI.sort==="recent"?"last touched":"most work put in");
  var hid=PROJECTS.filter(function(p){ return isHidden(p.id); }), hb=document.getElementById("hiddenbox");
  hb.hidden=!hid.length;
  hb.innerHTML='<summary>Hidden ('+hid.length+')</summary>'+hid.map(function(p){ return '<div class="hrow">'+tile(p,"sm")+'<span class="nm">'+esc(p.name)+'</span><button class="btn line" style="min-height:38px;align-self:center" data-act="unhide" data-id="'+p.id+'">Bring back</button></div>'; }).join("");
}

function listBlock(p, kind, title, hint, checkable, ph){
  var its=items(p,kind);
  var rows=its.map(function(o){
    return '<li class="'+(S.done[o.k]?"done":"")+'">'+(checkable?'<button class="check" data-act="tick" data-k="'+o.k+'" aria-label="Mark done">'+I.check+'</button>':'<span class="dot"></span>')+
      '<span class="tx">'+esc(o.t)+'</span>'+(checkable&&!S.done[o.k]?'<a class="doit" href="'+esc(codeLink(taskPrompt(p,o.t)))+'" target="_blank" rel="noopener" data-act="doit" data-id="'+p.id+'" data-t="'+esc(o.t)+'" aria-label="Build this in Claude Code" title="Build this in Claude Code">'+I.arrow+'</a>':'')+'<button class="x" data-act="rm" data-id="'+p.id+'" data-k="'+o.k+'" data-kind="'+kind+'" data-t="'+esc(o.t)+'" aria-label="Remove">×</button></li>';
  }).join("");
  return '<div class="block"><span class="label">'+title+'</span>'+(hint?'<span class="hint">'+hint+'</span>':'')+
   (rows?'<ul class="list">'+rows+'</ul>':'')+
   '<form class="add" data-form="add" data-id="'+p.id+'" data-kind="'+kind+'"><input id="add-'+kind+'" placeholder="'+ph+'" autocomplete="off" aria-label="'+ph+'"><button aria-label="Add">+</button></form></div>';
}

function todoBlock(p){
  var all=items(p,"todos"), open=all.filter(function(o){ return !S.done[o.k]; }), ticked=all.filter(function(o){ return S.done[o.k]; });
  function row(o,i,now){
    var done=!!S.done[o.k];
    return '<li class="'+(done?"done":"")+'"><button class="check" data-act="tick" data-k="'+o.k+'" aria-label="Mark done">'+I.check+'</button><span class="tx">'+esc(o.t)+'</span>'+
      (!done&&!now?'<button class="mini-btn" data-act="top" data-id="'+p.id+'" data-t="'+esc(o.t)+'" aria-label="Move to right now" title="Move to right now">'+I.up+'</button>':'')+
      (!done?'<a class="mini-btn" href="'+esc(codeLink(taskPrompt(p,o.t)))+'" target="_blank" rel="noopener" data-act="doit" data-id="'+p.id+'" data-t="'+esc(o.t)+'" aria-label="Build this in Claude Code" title="Build this in Claude Code">'+I.arrow+'</a>':'')+
      '<button class="x" data-act="rm" data-id="'+p.id+'" data-k="'+o.k+'" data-kind="todos" data-t="'+esc(o.t)+'" aria-label="Remove">×</button></li>';
  }
  var now=open.slice(0,3), later=open.slice(3);
  return '<div class="block"><span class="label">To-do</span>'+
   (now.length?'<span class="grp rn">Right now</span><ul class="list">'+now.map(function(o,i){ return row(o,i,true); }).join("")+'</ul>':'')+
   (later.length||ticked.length?'<span class="grp">Later</span><ul class="list">'+later.concat(ticked).map(function(o,i){ return row(o,i,false); }).join("")+'</ul>':'')+
   '<form class="add" data-form="add" data-id="'+p.id+'" data-kind="todos"><input id="add-todos" placeholder="Add a to-do" autocomplete="off" aria-label="Add a to-do"><button aria-label="Add">+</button></form>'+
   '<span class="hint">The top three are the small things to do right now, and they feed the one-thing pane. The up arrow moves a task there. The slanted arrow hands it to Claude Code to build.</span></div>';
}
function renderSheet(){
  var sc=document.getElementById("scrim");
  if(UI.menu){ sc.hidden=false; sc.innerHTML=menuHtml(); document.body.style.overflow="hidden"; return; }
  if(UI.chat){ sc.hidden=false; sc.innerHTML=chatHtml(); document.body.style.overflow="hidden"; fitAll(); var sh=sc.querySelector(".sheet"); sh.scrollTop=sh.scrollHeight; return; }
  var p=BY[UI.open]; if(!p){ sc.hidden=true; sc.innerHTML=""; document.body.style.overflow=""; return; }
  var d=dream(p), h=href(p), love=loveOf(p), n=days(p);
  var mini='<span class="fill '+p.kind+'" style="width:'+((p.stage-1)/(STAGES.length-1)*100)+'%"></span>'+STAGES.map(function(s){ var c=[]; if(s.n<p.stage) c.push("done"); if(s.n===p.stage) c.push("here"); return '<i class="'+c.join(" ")+'" title="'+esc(s.name)+'"></i>'; }).join("");
  var bs=basicsOf(p), missing=bs.filter(function(x){ return !x.ok; });
  var ik=(AUDIT[p.id]||{}).k;
  var g="";
  var hc=COLORS[p.id]||({game:"#8a2c26",tabletop:"#1c4f80",tool:"#6f5500"})[p.kind];
  var dq='<div class="block dreamq"><span class="label">The dream</span><textarea class="fit" id="dream" rows="1" data-id="'+p.id+'" placeholder="If '+esc(p.name)+' went as well as it possibly could, what exists?">'+esc(d)+'</textarea>'+(!d&&p.dreamHint?'<button class="hintfill" data-act="usehint" data-id="'+p.id+'">From your notes: '+esc(p.dreamHint)+' <u>Use this</u></button>':'')+'</div>';
  sc.hidden=false; document.body.style.overflow="hidden";
  sc.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(p.name)+'">'+
   '<div class="hero" style="--hc:'+hc+'">'+
   '<div class="shead">'+tile(p,"lg")+'<div class="t"><h2>'+esc(p.name)+'</h2><p>'+esc(p.tag)+'</p></div><button class="round" data-act="close" aria-label="Close">'+I.x+'</button></div>'+
   '<div class="acts">'+
     (h?act("a","",I.open,p.kind==="tool"?"Open":"Play",'href="'+esc(h)+'" target="_blank" rel="noopener"'):'')+
     act("button","",I.chat,"Chat",'data-act="chat" data-id="'+p.id+'"')+
     act("button",isStar(p.id)?"on":"",I.star,isStar(p.id)?"Starred":"Star",'data-act="star" data-id="'+p.id+'" aria-pressed="'+isStar(p.id)+'"')+
     act("button","",I.hide,"Hide",'data-act="hide" data-id="'+p.id+'"')+
   '</div></div>'+
   '<div class="block"><div class="mini">'+mini+'</div><div class="minicap"><span>Now: <b>'+esc(stageName(p.stage))+'</b></span><span>Stop '+p.stage+' of '+STAGES.length+'</span></div><p>'+esc(p.status)+'</p></div>'+
   (p.left?'<div class="block"><span class="label">Where you left off · '+ago(n)+'</span><p>'+esc(p.left)+'</p></div>':'')+
   '<div class="block"><span class="label">What you love about it</span><textarea class="fit" id="love" rows="1" data-id="'+p.id+'" placeholder="What pulled you into this one? Write it down so it can pull you back.">'+esc(love)+'</textarea>'+(p.love&&S.love[p.id]==null?'<span class="hint">Pulled from your own docs and notes. Fix it if it\'s off.</span>':'')+'</div>'+
   dq+
   todoBlock(p)+
   listBlock(p,"ideas","Cool ideas","",false,"Add an idea")+
   ((p.done||[]).length?'<details class="block donebox"><summary><span class="label">Done · '+p.done.length+'</span></summary><ul class="list">'+p.done.slice().reverse().map(function(x){ return '<li class="done"><span class="check">'+I.check+'</span><span class="tx" style="text-decoration:none">'+esc(x.t)+(x.on?' <span class="hint">'+esc(x.on)+'</span>':'')+'</span></li>'; }).join("")+'</ul></details>':'')+
   (bs.length?'<div class="block"><span class="label">The basics · '+basicsCount(p)+'</span><span class="hint">'+(missing.length?"Still to add: "+missing.map(function(x){ return x.name.toLowerCase(); }).join(", ")+".":"All in.")+" Tap one to correct it."+(ik&&ik!=="app icon"?" The picture shown for this project is its "+ik+", not a real app icon.":(!ik?" No icon found, so it shows an emoji.":""))+'</span><div class="bgrid">'+
     bs.map(function(x){ return '<button class="bitem'+(x.ok?" ok":"")+'" data-act="basic" data-id="'+p.id+'" data-k="'+x.k+'" title="'+esc(x.desc)+'" aria-pressed="'+x.ok+'"><i>'+I.check+'</i>'+esc(x.name)+'</button>'; }).join("")+'</div></div>':'')+
   '<p class="src">'+p.commits+" commits · started "+p.first+" · last commit "+lastOf(p)+" · "+esc(p.folder)+"/<br>Read from: "+esc(p.docs)+'</p>'+
  '</div>';
  fitAll();
}
function thread(id){ return S.chat[id]||(S.chat[id]=[]); }
function appContext(){
  var L=["Trailhead is my personal tracker for my side projects. It reads from my "+REPO+" repo and puts every project on one path: "+STAGES.map(function(s){return s.name;}).join(" > ")+"."];
  L.push("What I'm reaching for: "+GOALS.join(" "));
  L.push(""); L.push("My projects right now:");
  visible().forEach(function(p){ var d=dream(p); L.push("- "+p.name+" ("+p.kind+", "+stageName(p.stage)+", last touched "+ago(days(p))+(isStar(p.id)?", starred":"")+"): "+p.tag+(d?" Dream: "+d:"")); });
  return L.join("\n");
}
function contextFor(id){ return id==="_app" ? appContext() : prompt(BY[id]).replace(/\n\nHelp me start with that one small thing[\s\S]*$/,""); }
function transcript(id){ return thread(id).filter(function(m){ return !m.err; }).map(function(m){ return (m.r==="u"?"Joe: ":"Assistant: ")+m.t; }).join("\n\n"); }
// Claude Code can read the repo, so the hand-off only carries what the repo doesn't have: what Joe just said.
function handoff(id){
  var p=BY[id], said=thread(id).filter(function(m){ return m.r==="u"; }).map(function(m){ return "- "+m.t; }).join("\n");
  return "Trailhead chat"+(p?" about "+p.name+" ("+p.folder+"/)":"")+". Context is in trailhead/projects.json and trailhead/README.md."+
    (said?"\n\nWhat I said:\n"+said:"")+
    "\n\nPick this up with me. If I'm asking for changes to a project's to-dos or to Trailhead itself, make them.";
}
function chatHtml(){
  var id=UI.chat, p=BY[id], th=thread(id), has=!!getKey();
  var link=codeLink(handoff(id));
  return '<div class="sheet" role="dialog" aria-modal="true" aria-label="Chat">'+
   '<div class="shead">'+(p?tile(p):'<span class="tile" aria-hidden="true">'+I.chat+'</span>')+'<div class="t"><h2>'+(p?esc(p.name):"Trailhead")+'</h2><p>'+(p?"Flesh this one out":"Talk about your projects, or about changes to this app")+'</p></div><button class="round" data-act="chatclose" aria-label="Close">'+I.x+'</button></div>'+
   (th.length?'<div class="msgs">'+th.map(function(m,i){ return '<div class="msg '+(m.r==="u"?"me":"ai")+(m.err?" err":"")+'">'+esc(m.t).replace(/\n/g,"<br>")+(m.r==="a"&&!m.err&&!m.wait&&p?'<button class="keep" data-act="keep" data-i="'+i+'">Save as an idea</button>':'')+'</div>'; }).join("")+'</div>'
     :'<div class="block"><p>'+(has?"Say what's on your mind. The reply knows where this "+(p?"project":"app")+" stands.":"There's no chat key on this device, so nothing answers here yet. You can still write your thoughts down, then carry them into Claude Code with one tap.")+'</p></div>')+
   '<form class="chatform" data-form="chat"><textarea class="fit" id="chatin" rows="1" placeholder="'+(has?"Message":"Write a note to yourself")+'" aria-label="Message">'+esc(UI.seed||"")+'</textarea><button class="round sendbtn" aria-label="Send">'+I.send+'</button></form>'+
   '<div class="chatacts"><a class="btn solid" href="'+esc(link)+'" target="_blank" rel="noopener" data-act="handoff">'+I.arrow+'Continue in Claude Code</a>'+(th.length?'<button class="btn line" data-act="chatclear">Clear</button>':'')+'</div>'+
   '<p class="src">Continue in Claude Code opens a session on your repo with what you wrote here. It can read where every project stands, and it can change to-dos, the app, or a game.'+(has?"":" To get answers here, add a fal key in the menu.")+'</p>'+
  '</div>';
}
function sendChat(){
  var inp=document.getElementById("chatin"), v=inp.value.trim(), id=UI.chat; if(!v) return;
  var th=thread(id); th.push({r:"u", t:v}); UI.seed=""; 
  var key=getKey();
  if(!key){ save(); renderSheet(); return; }
  var hist=transcript(id), wait={r:"a", t:"…", wait:1}; th.push(wait); renderSheet();
  var sys="You are a thinking partner inside Trailhead, Joe's own tracker for his side projects. He gets heavily invested in a project and then drifts to the next one, so your job is to help him get back in and keep going. Be warm and brief: a few sentences, plain words, no headers. Ask one question at a time. Push toward the next small concrete step. "+(id==="_app"?"He may also want to talk about improving Trailhead itself. You cannot change the app, so help him get clear on what he wants and tell him to press Continue in Claude Code, which can make the change.":"You cannot edit files or the app. If he wants a to-do added or something built, tell him to press Continue in Claude Code, which can do it.")+"\n\nContext:\n"+contextFor(id);
  fetch("https://fal.run/openrouter/router",{method:"POST", headers:{"Authorization":"Key "+key, "Content-Type":"application/json"},
    body:JSON.stringify({model:S.model||MODEL_DEFAULT, system_prompt:sys, prompt:hist+"\n\nAssistant:", max_tokens:900, temperature:0.7})})
  .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, status:r.status, j:j}; }, function(){ return {ok:r.ok, status:r.status, j:{}}; }); })
  .then(function(o){
    delete wait.wait;
    if(o.ok && o.j && o.j.output){ wait.t=String(o.j.output).replace(/^\s*Assistant:\s*/,"").trim(); }
    else { wait.err=1; wait.t = o.status===401||o.status===403 ? "fal turned the key down. Check it in the menu." : "fal answered with an error"+(o.j&&(o.j.error||o.j.detail)?": "+String(typeof (o.j.error||o.j.detail)==="string"?(o.j.error||o.j.detail):JSON.stringify(o.j.error||o.j.detail)).slice(0,200):" ("+o.status+")")+"."; }
    if(th.length>60) th.splice(0, th.length-60);
    save(); if(UI.chat===id) renderSheet();
  })
  .catch(function(){ delete wait.wait; wait.err=1; wait.t="Couldn't reach fal from this page. That happens inside Claude, where outside calls are blocked. It should work from your own site or a local file."; save(); if(UI.chat===id) renderSheet(); });
}
function menuHtml(){
  return '<div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">'+
   '<div class="shead"><div class="t"><h2>Trailhead</h2><p>'+PROJECTS.length+' projects. projects.json last updated '+esc(SCANNED)+'</p></div><button class="round" data-act="close" aria-label="Close">'+I.x+'</button></div>'+
   '<div class="block"><span class="label">Fresh dates</span><p>Ask GitHub when each project last changed. It needs no key, and works when this page runs on your own site.</p><button class="btn solid" data-act="github">Check GitHub now</button><span class="hint" id="ghmsg">'+(S.liveAt?"Last checked "+new Date(S.liveAt).toLocaleString():"Not checked yet")+'</span></div>'+
   '<div class="block"><span class="label">Chat key</span><p>'+(getKey()?"A fal key is saved on this device.":"Paste a fal key to get answers in the chat. It stays in this browser and is sent only to fal.")+'</p>'+
     '<input class="field" id="falkey" type="password" autocomplete="off" placeholder="'+(getKey()?"Paste a new key to replace it":"fal key")+'" aria-label="fal key">'+
     '<input class="field" id="falmodel" type="text" autocomplete="off" value="'+esc(S.model||MODEL_DEFAULT)+'" aria-label="Model">'+
     '<div class="chatacts"><button class="btn solid" data-act="savekey">Save</button>'+(getKey()?'<button class="btn line" data-act="rmkey">Remove key</button>':'')+'</div>'+
     '<span class="hint">The key is never part of a backup, and never in the page or your repo. Any page on the same web address can read it, so set a spending limit on the key at fal.</span></div>'+
   '<div class="block"><span class="label">Your stars, dreams, to-dos and chats</span><p>Project details live in your repo, in trailhead/projects.json, so every device shows the same thing. What you change here waits on this device until you send it to the repo. Chats stay on this device. A backup copies both.</p><button class="btn solid" data-act="backup">Copy backup</button>'+
     '<textarea class="paste" id="restore" rows="2" placeholder="Paste a backup here to restore it"></textarea><button class="btn line" data-act="restore">Restore from pasted backup</button></div>'+
   '<div class="block"><span class="label">Not tracked</span><p class="hint">Folders left out because they hold assets, originals or one-off pages: '+esc(NOT_TRACKED)+'.</p></div>'+
  '</div>';
}

function fit(t){ t.style.height="auto"; t.style.height=t.scrollHeight+"px"; }
function fitAll(){ document.querySelectorAll("textarea.fit").forEach(fit); }
function renderAll(){ if(!LOADED) return; renderGoal(); renderNow(); renderFocus(); renderPath(); renderBasics(); renderList(); renderSheet(); }

var pendingDest=null;
document.addEventListener("click", function(e){
  var t=e.target.closest("[data-act]");
  if(!t){ if(e.target.id==="scrim"){ UI.open=null; UI.menu=false; UI.chat=null; UI.editDream=false; renderSheet(); } return; }
  var a=t.dataset.act, id=t.dataset.id, p=BY[id];
  if(a==="open"){ UI.chat=null; UI.open=id; UI.editDream=false; pendingDest=null; renderSheet(); document.querySelector(".sheet").scrollTop=0; }
  else if(a==="close"){ UI.open=null; UI.menu=false; UI.editDream=false; renderAll(); }
  else if(a==="menu"){ UI.menu=true; renderSheet(); }
  else if(a==="star"){
    S.starSet=true; var i=S.star.indexOf(id);
    if(i>=0) S.star.splice(i,1);
    else if(S.star.length>=2){ toast("Two stars is the limit. Unstar "+BY[S.star[0]].name+" or "+BY[S.star[1]].name+" first."); return; }
    else { S.star.push(id); UI.nowIdx=0; }
    save(); renderAll();
  }
  else if(a==="hide"){ S.hidSet=true; if(!isHidden(id)) S.hidden.push(id); var s=S.star.indexOf(id); if(s>=0){ S.star.splice(s,1); S.starSet=true; } UI.open=null; save(); renderAll(); toast(p.name+" is hidden. It's at the bottom if you want it back."); }
  else if(a==="unhide"){ S.hidSet=true; S.hidden.splice(S.hidden.indexOf(id),1); save(); renderAll(); }
  else if(a==="kind"){ UI.kind=t.dataset.v; UI.showAll=false; renderList(); }
  else if(a==="sort"){ UI.sort=UI.sort==="recent"?"invested":"recent"; renderList(); }
  else if(a==="more"){ UI.showAll=true; renderList(); }
  else if(a==="tick"){ var k=t.dataset.k; if(S.done[k]) delete S.done[k]; else S.done[k]=Date.now(); save(); renderAll(); }
  else if(a==="rm"){
    var ad=(S.added[id]||{})[t.dataset.kind]||[], ix=ad.indexOf(t.dataset.t);
    if(ix>=0) ad.splice(ix,1); else { (S.removed[id]=S.removed[id]||{})[t.dataset.k]=1; }
    save(); renderAll();
  }
  else if(a==="basic"){ var k=t.dataset.k, cur=basicsOf(p).filter(function(x){ return x.k===k; })[0], f=p.basics||{}, base=(k in f)?!!f[k]:!!((AUDIT[id]||{}).c||{})[k], nv=!cur.ok; S.basics[id]=S.basics[id]||{}; if(nv===base) delete S.basics[id][k]; else S.basics[id][k]=nv?1:0; save(); var tp=document.querySelector(".sheet").scrollTop; renderAll(); document.querySelector(".sheet").scrollTop=tp; }
  else if(a==="nowdone"){ S.done[t.dataset.k]=Date.now(); UI.justDone++; save(); renderAll(); }
  else if(a==="nownext"){ UI.nowIdx++; UI.justDone=0; renderNow(); }
  else if(a==="top"){ var cur=items(p,"todos").map(function(o){ return o.t; }).filter(function(x){ return x!==t.dataset.t; }); S.order[id]=[t.dataset.t].concat(cur); save(); var tp2=document.querySelector(".sheet").scrollTop; renderAll(); document.querySelector(".sheet").scrollTop=tp2; }
  else if(a==="usehint"){ S.dream[id]=p.dreamHint; save(); renderAll(); }
  else if(a==="doit"){ copy(taskPrompt(p, t.dataset.t), "Opening Claude Code. The task is copied too."); }
  else if(a==="sync"){ copy(syncPrompt(), "Opening Claude Code. The changes are copied too."); }
  else if(a==="chat"){ UI.chat=id; UI.menu=false; UI.seed=t.dataset.step?"Help me start: "+t.dataset.step:""; renderSheet(); }
  else if(a==="chatclose"){ UI.chat=null; UI.seed=""; renderAll(); }
  else if(a==="chatclear"){ S.chat[UI.chat]=[]; save(); renderSheet(); }
  else if(a==="handoff"){ var pend=(document.getElementById("chatin")||{}).value; if(pend&&pend.trim()){ thread(UI.chat).push({r:"u",t:pend.trim()}); UI.seed=""; save(); t.href=codeLink(handoff(UI.chat)); } copy(handoff(UI.chat), "Copied too. Opening Claude Code."); }
  else if(a==="keep"){ var m=thread(UI.chat)[+t.dataset.i], pid=UI.chat; if(m&&BY[pid]){ S.added[pid]=S.added[pid]||{}; (S.added[pid].ideas=S.added[pid].ideas||[]).push(m.t.length>280?m.t.slice(0,277)+"…":m.t); save(); toast("Saved to "+BY[pid].name+"'s ideas."); } }
  else if(a==="savekey"){ var kv=document.getElementById("falkey").value.trim(), mv=document.getElementById("falmodel").value.trim(); if(kv) setKey(kv); S.model=mv||MODEL_DEFAULT; save(); renderSheet(); toast(kv?"Key saved on this device.":"Saved."); }
  else if(a==="rmkey"){ setKey(""); renderSheet(); toast("Key removed."); }
  else if(a==="editdream"){ UI.editDream=true; pendingDest=(dream(BY[UI.open])||{}).dest||null; renderSheet(); }
  else if(a==="dest"){ pendingDest=+t.dataset.v; t.parentNode.querySelectorAll(".opt").forEach(function(o){ o.setAttribute("aria-pressed", o===t); }); }
  else if(a==="savedream"){
    var txt=document.getElementById("dreamtext").value.trim(), on=document.querySelector('.opt[aria-pressed="true"]');
    var dest=on?+on.dataset.v:null;
    if(!txt&&!dest){ toast("Write a line or pick how far it should go."); return; }
    S.dream[id]={text:txt, dest:dest, at:Date.now()}; UI.editDream=false; save(); renderAll(); toast("Saved. That's what this one is for.");
  }
  else if(a==="backup"){ copy(JSON.stringify(S), "Backup copied."); }
  else if(a==="restore"){
    try{ var o=JSON.parse(document.getElementById("restore").value); if(!o||typeof o!=="object"||!Array.isArray(o.star)) throw 0; S=o; ["hidden","skip"].forEach(function(k){ if(!Array.isArray(S[k])) S[k]=[]; }); ["dream","love","done","added","removed","live","basics","chat","order"].forEach(function(k){ if(!S[k]) S[k]={}; }); S.v=S.v||2; migrate(); reconcile(); save(); UI.menu=false; renderAll(); toast("Restored."); }
    catch(err){ toast("That doesn't look like a Trailhead backup."); }
  }
  else if(a==="github"){ checkGitHub(true); }
});
document.addEventListener("submit", function(e){
  if(e.target.closest('[data-form="chat"]')){ e.preventDefault(); sendChat(); return; }
  var f=e.target.closest('[data-form="add"]'); if(!f) return; e.preventDefault();
  var inp=f.querySelector("input"), v=inp.value.trim(); if(!v) return;
  var id=f.dataset.id, kind=f.dataset.kind; S.added[id]=S.added[id]||{}; (S.added[id][kind]=S.added[id][kind]||[]).push(v);
  save(); var top=document.querySelector(".sheet").scrollTop; renderAll(); document.querySelector(".sheet").scrollTop=top;
  var again=document.getElementById("add-"+kind); if(again) again.focus();
});
document.addEventListener("input", function(e){
  if(e.target.classList&&e.target.classList.contains("fit")) fit(e.target);
  if(e.target.id==="chatin"){ UI.seed=e.target.value; }
  if(e.target.id==="dream"){ S.dream[e.target.dataset.id]=e.target.value; save(); }
  if(e.target.id==="love"){ S.love[e.target.dataset.id]=e.target.value; save(); }
});
document.addEventListener("keydown", function(e){
  if(e.key==="Enter"&&!e.shiftKey&&e.target.id==="chatin"&&window.matchMedia("(pointer:fine)").matches){ e.preventDefault(); sendChat(); return; }
  if(e.key==="Escape"&&UI.chat){ UI.chat=null; renderAll(); return; }
  if(e.key==="Escape"&&(UI.open||UI.menu)){ UI.open=null; UI.menu=false; UI.editDream=false; renderAll(); } });
window.addEventListener("resize", drawTrail);

function checkGitHub(manual){
  var msg=function(m){ var el=document.getElementById("ghmsg"); if(el) el.textContent=m; };
  var list=PROJECTS.slice(), i=0, changed=0, failed=false;
  if(manual) msg("Checking…");
  function next(){
    if(failed) return;
    if(i>=list.length){ S.liveAt=Date.now(); save(); renderAll(); if(manual){ UI.menu=true; renderSheet(); msg(changed?changed+" projects have newer commits than the scan.":"No commits newer than the scan."); } return; }
    var p=list[i++];
    fetch("https://api.github.com/repos/"+REPO+"/commits?per_page=1&path="+encodeURIComponent(p.folder)).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(j){
      var d=j&&j[0]&&j[0].commit&&j[0].commit.committer&&j[0].commit.committer.date;
      if(d){ d=d.slice(0,10); if(d>p.last){ if(S.live[p.id]!==d) changed++; S.live[p.id]=d; } }
      next();
    }).catch(function(){ failed=true; if(manual) msg("Couldn't reach GitHub from here. This works once the page is on your own site."); });
  }
  try{ next(); }catch(e){ if(manual) msg("Couldn't reach GitHub from here."); }
}

if(window.TRAILHEAD_DATA){ setData(window.TRAILHEAD_DATA); renderAll(); }
else document.getElementById("now").innerHTML='<span class="label">One thing right now</span><p class="why">Loading your projects…</p>';
if(location.protocol!=="file:"){
  fetch("projects.json?t="+Date.now(),{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){ if(!d||!Array.isArray(d.projects)) throw 0; setData(d); renderAll(); })
  .catch(function(){ if(!LOADED) document.getElementById("now").innerHTML='<span class="label">One thing right now</span><p class="task">Couldn\'t load projects.json.</p><p class="why">It should sit next to this page in the trailhead folder.</p>'; });
}
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(drawTrail);
if(/github\.io$/.test(location.hostname) && (!S.liveAt || Date.now()-S.liveAt>12*36e5)) checkGitHub(false);
})();
