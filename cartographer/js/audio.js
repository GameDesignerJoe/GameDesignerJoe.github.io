// ============================================================
// THE CARTOGRAPHER - audio.js
// Audio manager: music, ambience loops, one-shot SFX, footsteps.
// Uses HTMLAudioElement throughout for broad browser compatibility.
// ============================================================

import { state } from './state.js';
import { getTerrain } from './terrain.js';

const AUDIO_PATH = 'assets/audio/';
const STORAGE_KEY = 'cartographer_audio';
const FADE_MS     = 2000; // ambience crossfade duration

// ---- Volume state ----
let _vol     = { master: 0.8, music: 0.1, sfx: 0.85, ambience: 0.45 };
let _muted   = false;
let _initialized = false;

// ---- Active loop elements ----
const _loops = {};           // key -> HTMLAudioElement
let _currentMusicKey    = null;
let _currentAmbienceKey = null;
let _oceanFaded = false; // true after fadeOutAmbience(); prevents amb_ocean from restarting

// ---- Footstep loop ----
let _lastStepAudio    = null; // currently looping footstep element
let _currentStepTerrain = null; // terrain type of the active footstep loop

// ---- Sound registries ----
// One-shot SFX: played by cloning a fresh Audio each time (allows overlapping)
const SFX_FILES = {
  snd_begin_button:  'snd_begin_button.mp3',
  snd_start_play_01: 'snd_start_play_01.mp3',
  snd_quest_complete:'snd_quest_complete.mp3',
  snd_collect:       'snd_collect_01.mp3',
  snd_survey:        'snd_survey.mp3',
  snd_sextant:       'snd_sextant.mp3',
  snd_exit_boat:     'snd_exit_boat.mp3',
  snd_discover_site: 'snd_discover_site.mp3',
  step_sand:         'snd_walking_sand.mp3',
  step_grass:        'snd_walking_grass.mp3',
  step_leaf:         'snd_walking_forest.mp3',
  step_rock:         'snd_walking_stone.mp3',
};

// Loops (music, ambience, cinematics): single element per key, .loop = true
const LOOP_FILES = {
  bgm_empty_island: 'bgm_empty_island.mp3',
  amb_ocean:        'amb_ocean.mp3',
  snd_sailboat:     'snd_sailboat.mp3',
};

// Terrain → ambience loop + footstep SFX key
const TERRAIN_AUDIO = {
  water:    { ambience: 'amb_ocean', step: 'step_sand'  },
  beach:    { ambience: 'amb_ocean', step: 'step_sand'  },
  lowland:  { ambience: null,        step: 'step_grass' },
  forest:   { ambience: null,        step: 'step_leaf'  },
  highland: { ambience: null,        step: 'step_rock'  },
  peak:     { ambience: null,        step: 'step_rock'  },
};

// ============================================================
// PUBLIC API
// ============================================================

// Call once after a user gesture (e.g. start button click).
export function initAudio() {
  if (_initialized) return;
  _initialized = true;
  _loadPrefs();
}

// Start or crossfade to a music loop. key = key in LOOP_FILES.
export function playMusic(key) {
  if (_currentMusicKey === key) return;
  _stopLoop(_currentMusicKey);
  _currentMusicKey = key;
  if (!LOOP_FILES[key]) return;
  _startLoop(key, _effectiveVol('music'));
}

export function stopMusic() {
  _stopLoop(_currentMusicKey);
  _currentMusicKey = null;
}

// Start a non-music, non-ambience loop (e.g. snd_sailboat for the cinematic).
export function playLoop(key) {
  if (_loops[key]) return;
  if (!LOOP_FILES[key]) return;
  _startLoop(key, _effectiveVol('sfx'));
}

export function stopLoop(key) {
  _stopLoop(key);
}

// Fade out current ambience and suppress ocean from restarting this expedition.
// Called after arrival to let the island feel quiet before terrain takes over.
export function fadeOutAmbience(ms = FADE_MS) {
  _oceanFaded = true;
  const key = _currentAmbienceKey;
  _currentAmbienceKey = null;
  if (key && _loops[key]) _fadeOut(_loops[key], ms, () => _stopLoop(key));
}

// Reset session-specific audio state for a new expedition.
export function resetAudio() {
  _oceanFaded = false;
  if (_lastStepAudio) { _lastStepAudio.pause(); _lastStepAudio.currentTime = 0; _lastStepAudio = null; }
  _currentStepTerrain = null;
}

// Call each frame (or throttled) with the current terrain string.
// Crossfades the ambience loop automatically.
export function updateAmbience(terrain) {
  const desired = TERRAIN_AUDIO[terrain]?.ambience ?? null;
  // Once the ocean has been faded out for gameplay, don't restart it
  const effective = (_oceanFaded && desired === 'amb_ocean') ? null : desired;
  if (effective === _currentAmbienceKey) return;

  // Fade out the old ambience
  const oldKey = _currentAmbienceKey;
  if (oldKey && _loops[oldKey]) {
    _fadeOut(_loops[oldKey], FADE_MS, () => {
      // Only stop if we haven't faded back to it
      if (_currentAmbienceKey !== oldKey) _stopLoop(oldKey);
    });
  }

  _currentAmbienceKey = effective;

  if (effective) {
    if (!_loops[effective]) _startLoop(effective, 0);
    _fadeIn(_loops[effective], _effectiveVol('ambience'), FADE_MS);
  }
}

// Directly set ambience without crossfade (use at sequence start).
export function setAmbienceImmediate(key) {
  if (_currentAmbienceKey && _loops[_currentAmbienceKey]) _stopLoop(_currentAmbienceKey);
  _currentAmbienceKey = key;
  if (key && LOOP_FILES[key]) _startLoop(key, _effectiveVol('ambience'));
}

// Call every frame with whether the player is moving and the current terrain.
// Starts a looping footstep sound on movement, stops it immediately on rest,
// and swaps to the new terrain sound when the biome changes mid-walk.
export function onPlayerMoved(isMoving, terrain) {
  if (!isMoving) {
    // Player stopped — kill sound immediately
    if (_lastStepAudio) {
      _lastStepAudio.pause();
      _lastStepAudio.currentTime = 0;
      _lastStepAudio = null;
    }
    _currentStepTerrain = null;
    return;
  }

  // Already playing the right terrain loop — do nothing
  if (terrain === _currentStepTerrain && _lastStepAudio) return;

  // Start or switch: stop any current sound then start the new one
  if (_lastStepAudio) {
    _lastStepAudio.pause();
    _lastStepAudio.currentTime = 0;
    _lastStepAudio = null;
  }
  _currentStepTerrain = terrain;

  if (_muted) return;
  const key  = TERRAIN_AUDIO[terrain]?.step ?? 'step_grass';
  const file = SFX_FILES[key];
  if (!file) return;

  const audio  = new Audio(AUDIO_PATH + file);
  audio.loop   = true;
  audio.volume = _effectiveVol('sfx');
  _lastStepAudio = audio;
  audio.play().catch(() => {});
}

// Play a one-shot sound effect. Always creates a fresh Audio instance so
// sounds can overlap (multiple footsteps, rapid UI clicks, etc.)
export function playSFX(key) {
  if (_muted) return;
  const file = SFX_FILES[key];
  if (!file) return;
  const audio = new Audio(AUDIO_PATH + file);
  audio.volume = _effectiveVol('sfx');
  audio.play().catch(() => {});
}

// type: 'master' | 'music' | 'sfx' | 'ambience'
export function setVolume(type, val) {
  if (!(type in _vol)) return;
  _vol[type] = Math.max(0, Math.min(1, val));
  _applyVolumes();
  _savePrefs();
}

export function getVolumes() { return { ..._vol }; }

export function toggleMute() {
  _muted = !_muted;
  _applyVolumes();
  _savePrefs();
}

export function isMuted() { return _muted; }

// ============================================================
// PRIVATE HELPERS
// ============================================================

// Keys that should play once rather than loop
const _PLAY_ONCE = new Set(['snd_sailboat']);

function _startLoop(key, vol) {
  if (_loops[key]) return _loops[key];
  const file = LOOP_FILES[key];
  if (!file) return null;
  const audio    = new Audio(AUDIO_PATH + file);
  audio.loop     = !_PLAY_ONCE.has(key);
  audio.volume   = _muted ? 0 : Math.max(0, Math.min(1, vol));
  audio.play().catch(() => {});
  _loops[key] = audio;
  return audio;
}

function _stopLoop(key) {
  if (!key || !_loops[key]) return;
  _loops[key].pause();
  _loops[key].currentTime = 0;
  delete _loops[key];
}

function _fadeIn(audio, targetVol, ms) {
  if (!audio) return;
  const steps    = 30;
  const interval = ms / steps;
  const delta    = targetVol / steps;
  let step = 0;
  const timer = setInterval(() => {
    step++;
    audio.volume = _muted ? 0 : Math.min(targetVol, audio.volume + delta);
    if (step >= steps) clearInterval(timer);
  }, interval);
}

function _fadeOut(audio, ms, onDone) {
  if (!audio) { onDone?.(); return; }
  const startVol = audio.volume;
  const steps    = 30;
  const interval = ms / steps;
  const delta    = startVol / steps;
  let step = 0;
  const timer = setInterval(() => {
    step++;
    audio.volume = Math.max(0, audio.volume - delta);
    if (step >= steps) { clearInterval(timer); onDone?.(); }
  }, interval);
}

function _effectiveVol(type) {
  if (_muted) return 0;
  return Math.max(0, Math.min(1, _vol.master * _vol[type]));
}

function _applyVolumes() {
  for (const [key, audio] of Object.entries(_loops)) {
    if (key === _currentMusicKey)    audio.volume = _effectiveVol('music');
    else if (key === _currentAmbienceKey) audio.volume = _effectiveVol('ambience');
    else                             audio.volume = _effectiveVol('sfx');
  }
}

function _savePrefs() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ..._vol, muted: _muted })); }
  catch (_) {}
}

function _loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.master   !== undefined) _vol.master   = saved.master;
    if (saved.music    !== undefined) _vol.music    = saved.music;
    if (saved.sfx      !== undefined) _vol.sfx      = saved.sfx;
    if (saved.ambience !== undefined) _vol.ambience = saved.ambience;
    // _muted is intentionally NOT restored — always start unmuted on refresh
  } catch (_) {}
}
