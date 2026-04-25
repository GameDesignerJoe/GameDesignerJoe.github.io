import { state } from '../state.js';
import { updateSetting } from '../settings.js';
import { setView } from './views.js';

// Declarative description of every settings row. Each entry says what
// kind of control to render and which state.settings key it edits.
const ROWS = [
  {
    type: 'toggle', key: 'soundOn',
    label: 'Sound', help: 'Tone on press, audio playback in listening mode.',
  },
  {
    type: 'toggle', key: 'hapticsOn',
    label: 'Haptics', help: 'Short vibration on each press release. Silent on iOS.',
  },
  {
    type: 'toggle', key: 'hintsOn',
    label: 'Hints', help: 'When idle, light an amber trail to the next letter.',
  },
  {
    type: 'segmented', key: 'hintDelayMs',
    label: 'Hint Delay',
    options: [
      { value: 2000, label: '2s' },
      { value: 3000, label: '3s' },
      { value: 5000, label: '5s' },
      { value: 8000, label: '8s' },
    ],
  },
  {
    type: 'segmented', key: 'autoCommitDelayMs',
    label: 'Auto-commit',
    help: 'Pause length that ends a letter and looks it up.',
    options: [
      { value: 400, label: '400ms' },
      { value: 600, label: '600ms' },
      { value: 900, label: '900ms' },
    ],
  },
  {
    type: 'locked', key: 'numbersUnlocked',
    label: 'Include Numbers',
    help: 'Tree extension + word content not built yet.',
  },
  {
    type: 'locked', key: 'punctuationUnlocked',
    label: 'Include Punctuation',
    help: 'Tree extension + word content not built yet.',
  },
];

let listEl = null;

export function initSettingsScreen() {
  listEl = document.getElementById('settings-list');
  if (!listEl) return;

  for (const row of ROWS) {
    listEl.appendChild(buildRow(row));
  }

  const about = document.createElement('div');
  about.className = 'settings-about';
  about.innerHTML =
    'Inspired by <strong>Nux Gadgets’</strong> Morse Code learning board ' +
    '— a physical tool that makes the alphabet learnable at a glance.';
  listEl.appendChild(about);

  document
    .getElementById('settings-back-button')
    ?.addEventListener('click', () => setView('home'));

  renderSettingsScreen();
}

// Re-syncs every control's visual state with state.settings. Called
// when entering the settings view in case state changed elsewhere.
export function renderSettingsScreen() {
  if (!listEl) return;
  for (const row of listEl.querySelectorAll('[data-setting-key]')) {
    const key = row.dataset.settingKey;
    const value = state.settings[key];
    if (row.dataset.controlType === 'toggle') {
      for (const opt of row.querySelectorAll('.settings-option')) {
        const optValue = opt.dataset.value === 'true';
        opt.classList.toggle('active', optValue === value);
      }
    } else if (row.dataset.controlType === 'segmented') {
      for (const opt of row.querySelectorAll('.settings-option')) {
        opt.classList.toggle('active', Number(opt.dataset.value) === value);
      }
    }
  }
}

function buildRow(row) {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-row';
  wrapper.dataset.settingKey = row.key;
  wrapper.dataset.controlType = row.type;

  const header = document.createElement('div');
  header.className = 'settings-row-header';
  const label = document.createElement('span');
  label.className = 'settings-row-label';
  label.textContent = row.label;
  header.appendChild(label);
  if (row.type === 'locked') {
    const lock = document.createElement('span');
    lock.className = 'settings-row-lock';
    lock.textContent = '\u{1F512}';
    header.appendChild(lock);
  }
  wrapper.appendChild(header);

  if (row.help) {
    const help = document.createElement('span');
    help.className = 'settings-row-help';
    help.textContent = row.help;
    wrapper.appendChild(help);
  }

  if (row.type === 'toggle') {
    wrapper.appendChild(buildToggleControl(row));
  } else if (row.type === 'segmented') {
    wrapper.appendChild(buildSegmentedControl(row));
  } else if (row.type === 'locked') {
    wrapper.classList.add('locked');
  }

  return wrapper;
}

function buildToggleControl(row) {
  const control = document.createElement('div');
  control.className = 'settings-row-control';
  for (const opt of [
    { value: true, label: 'on' },
    { value: false, label: 'off' },
  ]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-option';
    btn.dataset.value = String(opt.value);
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      updateSetting(row.key, opt.value);
      renderSettingsScreen();
    });
    control.appendChild(btn);
  }
  return control;
}

function buildSegmentedControl(row) {
  const control = document.createElement('div');
  control.className = 'settings-row-control';
  for (const opt of row.options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-option';
    btn.dataset.value = String(opt.value);
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      updateSetting(row.key, opt.value);
      renderSettingsScreen();
    });
    control.appendChild(btn);
  }
  return control;
}
