const KEYS_STORAGE = 'inkwell_api_keys';
const PROVIDER_STORAGE = 'inkwell_provider';

const PROVIDERS = ['claude', 'gemini', 'gcv'];

function loadKeys() {
    try {
        return JSON.parse(localStorage.getItem(KEYS_STORAGE)) || {};
    } catch {
        return {};
    }
}

function saveKeys(keys) {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
}

export function getProvider() {
    return localStorage.getItem(PROVIDER_STORAGE) || 'claude';
}

export function setProvider(provider) {
    localStorage.setItem(PROVIDER_STORAGE, provider);
}

export function getApiKey(provider) {
    const p = provider || getProvider();
    return loadKeys()[p] || '';
}

export function setApiKey(provider, key) {
    const keys = loadKeys();
    if (key) {
        keys[provider] = key.trim();
    } else {
        delete keys[provider];
    }
    saveKeys(keys);
}

export function hasApiKey() {
    return getApiKey(getProvider()).length > 0;
}

export function initSettings() {
    const modal = document.getElementById('settings-modal');
    const backdrop = modal.querySelector('.modal-backdrop');
    const btnSave = document.getElementById('btn-save-key');
    const btnCancel = document.getElementById('btn-cancel-settings');
    const btnSettings = document.getElementById('btn-settings');
    const keyStatus = document.getElementById('key-status');
    const providerBtns = modal.querySelectorAll('.provider-btn');

    let selectedProvider = getProvider();

    function showKeySection(provider) {
        PROVIDERS.forEach(p => {
            const section = document.getElementById(`key-section-${p}`);
            section.classList.toggle('hidden', p !== provider);
        });
        providerBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.provider === provider);
        });
    }

    function open() {
        selectedProvider = getProvider();
        // Load all saved keys into inputs
        PROVIDERS.forEach(p => {
            const input = document.getElementById(`api-key-${p}`);
            input.value = getApiKey(p);
        });
        showKeySection(selectedProvider);
        keyStatus.textContent = hasApiKey() ? `Using ${selectedProvider}` : '';
        keyStatus.style.color = '#4ade80';
        modal.classList.remove('hidden');
    }

    function close() {
        modal.classList.add('hidden');
    }

    // Provider tab clicks
    providerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedProvider = btn.dataset.provider;
            showKeySection(selectedProvider);
        });
    });

    btnSettings.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    btnCancel.addEventListener('click', close);

    btnSave.addEventListener('click', () => {
        // Save all keys that have values
        PROVIDERS.forEach(p => {
            const input = document.getElementById(`api-key-${p}`);
            setApiKey(p, input.value.trim());
        });

        // Save selected provider
        setProvider(selectedProvider);

        // Check the active provider has a key
        const activeKey = getApiKey(selectedProvider);
        if (!activeKey) {
            keyStatus.textContent = `No key for ${selectedProvider}`;
            keyStatus.style.color = '#f87171';
            return;
        }

        keyStatus.textContent = `Saved — using ${selectedProvider}`;
        keyStatus.style.color = '#4ade80';
        setTimeout(close, 800);
    });
}
