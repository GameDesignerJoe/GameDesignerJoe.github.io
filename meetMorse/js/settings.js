import { state } from './state.js';
import { saveSettings } from './lib/storage.js';
import { audioEngine } from './engines/audioEngine.js';

// Mutate a single setting, persist, and apply any side-effect immediately.
export function updateSetting(key, value) {
  state.settings[key] = value;
  saveSettings(state.settings);
  applySetting(key);
}

// Walk every setting once at boot. Most settings (autoCommitDelayMs,
// hintsOn, hintDelayMs, hapticsOn) are read at the call site, so the
// only one with an active side-effect is sound on/off.
export function applyAllSettings() {
  applySetting('soundOn');
}

function applySetting(key) {
  if (key === 'soundOn') {
    audioEngine.setEnabled(state.settings.soundOn);
  }
  // Other settings are read directly from state.settings at the call site
  // (input.js, guidedWord.js, etc.) so no apply hook needed here.
}
