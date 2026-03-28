const STORAGE_KEY = 'inkwell_api_key';

export function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
}

export function setApiKey(key) {
    if (key) {
        localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export function hasApiKey() {
    return getApiKey().length > 0;
}

export function initSettings() {
    const modal = document.getElementById('settings-modal');
    const backdrop = modal.querySelector('.modal-backdrop');
    const input = document.getElementById('api-key-input');
    const btnSave = document.getElementById('btn-save-key');
    const btnCancel = document.getElementById('btn-cancel-settings');
    const btnSettings = document.getElementById('btn-settings');
    const keyStatus = document.getElementById('key-status');

    function open() {
        input.value = getApiKey();
        keyStatus.textContent = hasApiKey() ? 'Key saved' : '';
        modal.classList.remove('hidden');
    }

    function close() {
        modal.classList.add('hidden');
    }

    btnSettings.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    btnCancel.addEventListener('click', close);

    btnSave.addEventListener('click', () => {
        const key = input.value.trim();
        if (!key) {
            keyStatus.textContent = 'Please enter a key';
            keyStatus.style.color = '#f87171';
            return;
        }
        setApiKey(key);
        keyStatus.textContent = 'Key saved';
        keyStatus.style.color = '#4ade80';
        setTimeout(close, 600);
    });
}
