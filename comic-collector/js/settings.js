// AI provider settings. Stored in localStorage. No API keys ever leave this device
// except inside the /api/identify request body when a lookup is made.

const LS_KEY = 'comic_collector_settings';

// Default models per provider. User can override in settings.
export const PROVIDERS = {
  anthropic: { label: 'Claude (Anthropic)',   defaultModel: 'claude-sonnet-4-6',        needsEndpoint: false },
  openai:    { label: 'OpenAI',                defaultModel: 'gpt-4o-mini',              needsEndpoint: false },
  gemini:    { label: 'Gemini (Google)',       defaultModel: 'gemini-2.0-flash',         needsEndpoint: false },
  xai:       { label: 'Grok (xAI)',            defaultModel: 'grok-2-vision-1212',       needsEndpoint: false },
  groq:      { label: 'Groq',                  defaultModel: 'llama-3.2-90b-vision-preview', needsEndpoint: false },
  custom:    { label: 'Custom (OpenAI-shape)', defaultModel: '',                         needsEndpoint: true  },
};

const EMPTY = { provider: '', model: '', apiKey: '', endpoint: '' };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...EMPTY };
    const obj = JSON.parse(raw);
    return {
      provider: obj.provider || '',
      model: obj.model || '',
      apiKey: obj.apiKey || '',
      endpoint: obj.endpoint || '',
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveSettings(s) {
  localStorage.setItem(LS_KEY, JSON.stringify({
    provider: s.provider || '',
    model: s.model || '',
    apiKey: s.apiKey || '',
    endpoint: s.endpoint || '',
  }));
}

export function isConfigured(s = loadSettings()) {
  if (!s.provider || !s.apiKey || !s.model) return false;
  if (PROVIDERS[s.provider]?.needsEndpoint && !s.endpoint) return false;
  return true;
}

// Build the settings form HTML inside a given container element.
export function renderSettingsForm(container) {
  const s = loadSettings();
  const providerOptions = Object.entries(PROVIDERS).map(([key, p]) =>
    `<option value="${key}" ${s.provider === key ? 'selected' : ''}>${p.label}</option>`
  ).join('');

  container.innerHTML = `
    <label class="cs-lbl">Provider</label>
    <select id="cs-provider">
      <option value="">— pick a vision provider —</option>
      ${providerOptions}
    </select>

    <label class="cs-lbl">Model</label>
    <input type="text" id="cs-model" value="${escapeAttr(s.model)}" placeholder="(picks default when you choose a provider)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    <div class="cs-hint" id="cs-model-hint"></div>

    <label class="cs-lbl">API Key</label>
    <input type="password" id="cs-key" value="${escapeAttr(s.apiKey)}" placeholder="paste your key — stays in this browser only" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">

    <div id="cs-endpoint-row" style="display:${s.provider === 'custom' ? 'block' : 'none'}">
      <label class="cs-lbl">Endpoint URL <span class="cs-lbl-hint">(OpenAI-compatible chat-completions URL)</span></label>
      <input type="text" id="cs-endpoint" value="${escapeAttr(s.endpoint)}" placeholder="https://example.com/v1/chat/completions" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    </div>

    <div class="cs-actions">
      <button class="cs-btn primary" id="cs-save">SAVE</button>
      <button class="cs-btn" id="cs-test">TEST CONNECTION</button>
    </div>
    <div class="cs-status" id="cs-status"></div>
  `;

  const providerEl = container.querySelector('#cs-provider');
  const modelEl = container.querySelector('#cs-model');
  const hintEl = container.querySelector('#cs-model-hint');
  const endpointRow = container.querySelector('#cs-endpoint-row');

  function updateHint() {
    const key = providerEl.value;
    const p = PROVIDERS[key];
    if (!p) { hintEl.textContent = ''; return; }
    hintEl.textContent = p.defaultModel ? `Default: ${p.defaultModel}` : 'Provide a model name appropriate for your endpoint.';
    if (!modelEl.value && p.defaultModel) modelEl.value = p.defaultModel;
    endpointRow.style.display = p.needsEndpoint ? 'block' : 'none';
  }
  providerEl.addEventListener('change', updateHint);
  updateHint();
}

// Pull current form values back into an object (without persisting).
export function readSettingsForm(container) {
  return {
    provider: container.querySelector('#cs-provider').value,
    model: container.querySelector('#cs-model').value.trim(),
    apiKey: container.querySelector('#cs-key').value.trim(),
    endpoint: (container.querySelector('#cs-endpoint')?.value || '').trim(),
  };
}

function escapeAttr(s) { return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
