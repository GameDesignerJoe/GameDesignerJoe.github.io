import * as state from './state.js';
import * as themes from './themes.js';
import * as archive from './archive.js';

const STORAGE_KEY = 'guitar-scales-settings';

// Load settings from localStorage into state.settings
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Migrate old boolean `leftHanded` → `handedness` enum
    if ('leftHanded' in saved && !('handedness' in saved)) {
      saved.handedness = saved.leftHanded ? 'left' : 'right';
      delete saved.leftHanded;
    }
    for (const key of Object.keys(saved)) {
      state.setSetting(key, saved[key]);
    }
  } catch (e) {
    console.warn('Failed to load settings', e);
  }
  // Apply theme right away so the UI matches saved preference
  themes.applyTheme(state.settings.theme);
}

// Save settings to localStorage
export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  } catch (e) {
    console.warn('Failed to save settings', e);
  }
}

// Wire up the Settings modal. onChange callback fires after any setting changes.
export function initSettingsModal(onChange) {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('btn-settings');

  function setSegmentedActive(group, value) {
    group.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function openModal() {
    // Reflect current state into form controls
    const notationGroup = modal.querySelector('.segmented[data-setting="notation"]');
    if (notationGroup) {
      setSegmentedActive(notationGroup, state.settings.useFlats ? 'flats' : 'sharps');
    }
    const handednessGroup = modal.querySelector('.segmented[data-setting="handedness"]');
    if (handednessGroup) {
      setSegmentedActive(handednessGroup, state.settings.handedness || 'right');
    }
    // Update active state on theme cards
    const currentTheme = state.settings.theme || 'midnight';
    modal.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.theme === currentTheme);
    });
    modal.hidden = false;
  }

  // Build the Themes grid once
  function buildThemesGrid() {
    const grid = document.getElementById('themes-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const [id, theme] of Object.entries(themes.THEMES)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'theme-card';
      card.dataset.theme = id;
      const c = theme.colors;
      // Inline styles on the card itself so previews always match the theme,
      // regardless of the currently-applied theme.
      card.style.background = c.bg;
      card.style.borderColor = c['fret-wire'];
      card.innerHTML = `
        <div class="theme-preview" style="background:${c.surface}">
          <div class="theme-swatches">
            <span style="background:${c['root-color']}"></span>
            <span style="background:${c['note-color']}"></span>
            <span style="background:${c.accent}"></span>
            <span style="background:${c['string-color']}"></span>
          </div>
        </div>
        <div class="theme-meta">
          <div class="theme-name" style="color:${c.text}">${theme.name}</div>
          <div class="theme-desc" style="color:${c.muted}">${theme.description}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        state.setSetting('theme', id);
        themes.applyTheme(id);
        saveSettings();
        // Update active state immediately
        modal.querySelectorAll('.theme-card').forEach(c => {
          c.classList.toggle('active', c.dataset.theme === id);
        });
        if (onChange) onChange();
      });
      grid.appendChild(card);
    }
  }
  buildThemesGrid();

  function closeModal() {
    modal.hidden = true;
  }

  openBtn.addEventListener('click', openModal);

  // Close via backdrop or X
  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  // Tab switching
  const tabs = modal.querySelectorAll('.modal-tab');
  const panels = modal.querySelectorAll('.modal-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelName = tab.dataset.tab;
      const panel = modal.querySelector(`.modal-panel[data-panel="${panelName}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Flats/sharps segmented toggle
  const notationGroup = modal.querySelector('.segmented[data-setting="notation"]');
  if (notationGroup) {
    notationGroup.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        setSegmentedActive(notationGroup, val);
        state.setSetting('useFlats', val === 'flats');
        saveSettings();
        if (onChange) onChange();
      });
    });
  }

  // Handedness segmented toggle (right / left / leftUpside)
  const handednessGroup = modal.querySelector('.segmented[data-setting="handedness"]');
  if (handednessGroup) {
    handednessGroup.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        setSegmentedActive(handednessGroup, val);
        state.setSetting('handedness', val);
        saveSettings();
        if (onChange) onChange();
      });
    });
  }

  // Archive — Save/Load the whole page to/from a .gscale file
  function showArchiveStatus(msg, isError = false) {
    const status = document.getElementById('archive-status');
    if (!status) return;
    status.textContent = msg;
    status.hidden = false;
    status.classList.toggle('error', isError);
    clearTimeout(showArchiveStatus._t);
    showArchiveStatus._t = setTimeout(() => { status.hidden = true; }, 4000);
  }

  const archiveSaveBtn = document.getElementById('btn-archive-save');
  if (archiveSaveBtn) {
    archiveSaveBtn.addEventListener('click', async () => {
      try {
        const name = await archive.saveToFile();
        if (name) {
          closeModal();
        }
      } catch (e) {
        showArchiveStatus(`Save failed: ${e.message || 'unknown error'}`, true);
      }
    });
  }

  const archiveLoadBtn = document.getElementById('btn-archive-load');
  if (archiveLoadBtn) {
    archiveLoadBtn.addEventListener('click', async () => {
      try {
        const name = await archive.loadFromFile();
        if (name) {
          if (onChange) onChange();
          closeModal();
        }
      } catch (e) {
        showArchiveStatus(`Load failed: ${e.message || 'invalid file'}`, true);
      }
    });
  }

  // Feedback form — two options:
  // - "Open Email" tries the user's default mail client via mailto:
  // - "Open Gmail" opens Gmail's compose window in a new tab
  // - "Copy to Clipboard" is always a safe fallback
  const FEEDBACK_EMAIL = 'GameDesignerJoe@gmail.com';

  function buildFeedback() {
    const typeEl = document.getElementById('feedback-type');
    const msgEl = document.getElementById('feedback-message');
    const type = typeEl ? typeEl.value : 'Feedback';
    const message = msgEl ? msgEl.value.trim() : '';
    const subject = `Guitar Scales — ${type}`;
    const body = [
      message || '(describe here)',
      '',
      '—',
      `Page URL: ${window.location.href}`,
      `Browser: ${navigator.userAgent}`,
    ].join('\n');
    return { subject, body };
  }

  function showFeedbackStatus(msg) {
    const status = document.getElementById('feedback-status');
    if (!status) return;
    status.textContent = msg;
    status.hidden = false;
    clearTimeout(showFeedbackStatus._t);
    showFeedbackStatus._t = setTimeout(() => { status.hidden = true; }, 4000);
  }

  function clearFeedbackMessage() {
    const msgEl = document.getElementById('feedback-message');
    if (msgEl) msgEl.value = '';
  }

  const sendBtn = document.getElementById('btn-send-feedback');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const { subject, body } = buildFeedback();
      const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      clearFeedbackMessage();
      showFeedbackStatus('Opening your email app. Form cleared — if nothing happened, re-type and try Gmail or Copy.');
    });
  }

  const gmailBtn = document.getElementById('btn-send-gmail');
  if (gmailBtn) {
    gmailBtn.addEventListener('click', () => {
      const { subject, body } = buildFeedback();
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(FEEDBACK_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank', 'noopener');
      clearFeedbackMessage();
      showFeedbackStatus('Opened Gmail in a new tab. Form cleared.');
    });
  }

  const copyBtn = document.getElementById('btn-copy-feedback');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const { subject, body } = buildFeedback();
      const text = `To: ${FEEDBACK_EMAIL}\nSubject: ${subject}\n\n${body}`;
      try {
        await navigator.clipboard.writeText(text);
        clearFeedbackMessage();
        showFeedbackStatus('Copied! Form cleared — paste into any email.');
      } catch (e) {
        showFeedbackStatus('Copy failed — select and copy manually.');
      }
    });
  }
}
