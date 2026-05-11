// ══════════════════════════════════════════════
// kill.code — audio.js
// SFX (Web Audio oscillators) + BGM (HTMLAudio playlist).
// Owns audio settings + persistence. No game-state coupling.
// Step 13 wires SFX to bus events so engine never imports this.
// ══════════════════════════════════════════════

import { PITCH, STORAGE_KEYS } from './config.js';
import { bus } from './bus.js';

let sfxMuted = localStorage.getItem(STORAGE_KEYS.sfxMute) === '1';
let bgmMuted = localStorage.getItem(STORAGE_KEYS.bgmMute) === '1';
let sfxVol   = parseFloat(localStorage.getItem(STORAGE_KEYS.sfxVol) ?? '0.5');
let bgmVol   = parseFloat(localStorage.getItem(STORAGE_KEYS.bgmVol) ?? '0.25');
if(!Number.isFinite(sfxVol)) sfxVol = 0.5;
if(!Number.isFinite(bgmVol)) bgmVol = 0.25;

// ── SFX ──────────────────────────────────────────
let _ac = null;
function getAC(){
  if(!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  return _ac;
}

function tone(freq, dur=.08, vol=.12, type='sine'){
  if(sfxMuted) return;
  try{
    const ctx=getAC(), o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type=type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq*.5, ctx.currentTime+dur);
    g.gain.setValueAtTime(vol*sfxVol*2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+dur);
    o.start(); o.stop(ctx.currentTime+dur);
  }catch(e){}
}

export function sndKey(ci){    tone(PITCH[ci]||800, .07, .12); }
export function sndDeploy(){   tone(600, .1, .11, 'square'); }
export function sndSubmit(){   tone(330, .15, .1, 'triangle'); }
export function sndWin(){      [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f, .22, .12),       i*90));  }
export function sndLose(){     [330,277,220].forEach((f,i)=>setTimeout(()=>tone(f, .25, .1, 'sawtooth'), i*120)); }
export function sndIceIntro(){ [240,180,140].forEach((f,i)=>setTimeout(()=>tone(f, .25, .14, 'sawtooth'), i*120)); }
export function sndIceCard(){  tone(220, .18, .13, 'square'); setTimeout(()=>tone(140, .22, .12, 'sawtooth'), 90); }

// ── BGM ──────────────────────────────────────────
const bgmEl = document.getElementById('bgm-audio');
if(bgmEl) bgmEl.volume = bgmMuted ? 0 : bgmVol;

// Track list resolves from (in order):
//   1. Server directory listing of audio/ (works with `python -m http.server`)
//   2. audio/playlist.json (for GitHub Pages or any host without dir listing)
//   3. Hardcoded fallback below.
let _bgmTracks  = ['Chrome Avenue.mp3'];
let _bgmQueue   = [];
let _bgmCurrent = null;

async function _loadBgmTracks(){
  try{
    const r = await fetch('audio/');
    if(r.ok){
      const html = await r.text();
      const matches = [...html.matchAll(/href="([^"#?]+\.mp3)"/gi)];
      const tracks = [...new Set(matches.map(m => decodeURIComponent(m[1]).replace(/^.*\//, '')))];
      if(tracks.length){ _bgmTracks = tracks; return; }
    }
  }catch(e){}
  try{
    const r = await fetch('audio/playlist.json');
    if(r.ok){
      const list = await r.json();
      if(Array.isArray(list) && list.length) _bgmTracks = list;
    }
  }catch(e){}
}

function _shuffleBgmQueue(){
  const arr = [..._bgmTracks];
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Avoid back-to-back repeat across queue boundaries.
  if(_bgmCurrent && arr.length>1 && arr[0] === _bgmCurrent){
    [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  _bgmQueue = arr;
}

function _playNextBgm(){
  if(!bgmEl || _bgmTracks.length === 0) return;
  if(_bgmQueue.length === 0) _shuffleBgmQueue();
  _bgmCurrent = _bgmQueue.shift();
  bgmEl.src = 'audio/' + encodeURIComponent(_bgmCurrent);
  if(!bgmMuted) bgmEl.play().catch(()=>{});
}

export function tryPlayBgm(){
  if(!bgmEl || bgmMuted) return;
  if(!bgmEl.src){ _playNextBgm(); return; }
  bgmEl.play().catch(()=>{});
}

if(bgmEl) bgmEl.addEventListener('ended', _playNextBgm);
_loadBgmTracks();

// Browsers gate autoplay until user gesture — kick off on first interaction.
['click','keydown','touchstart'].forEach(ev =>
  window.addEventListener(ev, tryPlayBgm, { once:true, capture:true }));

// ── Bus subscriptions — engine never imports this file ───────────────────
bus.on('sfx.deploy',    sndDeploy);
bus.on('peg.cycled',    ({ ci }) => { if(ci !== -1) sndKey(ci); });
bus.on('guess.submitted', sndSubmit);
bus.on('game.won',      sndWin);
bus.on('game.lost',     sndLose);
bus.on('ice.sequence.start', sndIceIntro);
bus.on('ice.card.starting',  sndIceCard);

// ── Settings API (used by settings.js) ─────────────
export const isSfxMuted = () => sfxMuted;
export const isBgmMuted = () => bgmMuted;
export const getSfxVol  = () => sfxVol;
export const getBgmVol  = () => bgmVol;

export function toggleSfx(){
  sfxMuted = !sfxMuted;
  localStorage.setItem(STORAGE_KEYS.sfxMute, sfxMuted ? '1' : '0');
}

export function toggleBgm(){
  bgmMuted = !bgmMuted;
  localStorage.setItem(STORAGE_KEYS.bgmMute, bgmMuted ? '1' : '0');
  if(bgmEl){
    bgmEl.volume = bgmMuted ? 0 : bgmVol;
    if(bgmMuted) bgmEl.pause(); else tryPlayBgm();
  }
}

export function setSfxVol(v){
  sfxVol = v;
  localStorage.setItem(STORAGE_KEYS.sfxVol, String(v));
}

export function setBgmVol(v){
  bgmVol = v;
  localStorage.setItem(STORAGE_KEYS.bgmVol, String(v));
  if(bgmEl && !bgmMuted) bgmEl.volume = v;
}
