// ══════════════════════════════════════════════
// kill.code — settings.js
// Settings overlay: audio toggles, volume sliders, stats display, wipe.
// ══════════════════════════════════════════════

import {
  isSfxMuted, isBgmMuted, getSfxVol, getBgmVol,
  toggleSfx as audioToggleSfx, toggleBgm as audioToggleBgm,
  setSfxVol as audioSetSfxVol, setBgmVol as audioSetBgmVol,
} from './audio.js';
import { loadSt, saveSt, renderStats } from './stats.js';

export function showSettings(){
  document.getElementById('v-main').style.display     = 'none';
  document.getElementById('v-settings').style.display = 'flex';
  renderSettingsStats();
  renderAudioControls();
}

export function hideSettings(){
  document.getElementById('v-settings').style.display = 'none';
  document.getElementById('v-main').style.display     = 'flex';
}

export function toggleSfx(){ audioToggleSfx(); renderAudioControls(); }
export function toggleBgm(){ audioToggleBgm(); renderAudioControls(); }
export function setSfxVol(v){ audioSetSfxVol(v); }
export function setBgmVol(v){ audioSetBgmVol(v); }

export function renderAudioControls(){
  const sp = document.getElementById('sfx-pill'),  bp = document.getElementById('bgm-pill');
  const ss = document.getElementById('sfx-slider'),bs = document.getElementById('bgm-slider');
  const sm = isSfxMuted(), bm = isBgmMuted();
  if(sp){ sp.textContent = sm ? 'OFF' : 'ON'; sp.className = 'mute-pill ' + (sm ? 'off' : 'on'); }
  if(bp){ bp.textContent = bm ? 'OFF' : 'ON'; bp.className = 'mute-pill ' + (bm ? 'off' : 'on'); }
  if(ss){ ss.value = Math.round(getSfxVol() * 100); ss.disabled = sm; }
  if(bs){ bs.value = Math.round(getBgmVol() * 100); bs.disabled = bm; }
}

export function wipeScores(){
  saveSt({});
  renderStats();
  renderSettingsStats();
}

export function renderSettingsStats(){
  const s = loadSt();
  const b = document.getElementById('st-best'),
        r = document.getElementById('st-runs'),
        l = document.getElementById('st-last');
  if(b){ b.textContent = s.best || '—';                    b.className = 'stat-box-val' + (s.best ? '' : ' dim'); }
  if(r){ r.textContent = s.runs || 0;                      r.className = 'stat-box-val' + (s.runs ? '' : ' dim'); }
  if(l){ l.textContent = s.last > 0 ? s.last : (s.runs ? '✕' : '—'); l.className = 'stat-box-val' + (s.last > 0 ? '' : ' dim'); }
}
