import { initSettings, hasApiKey, setApiKey, setProvider } from './settings.js';

// Migrate old single-key format to new multi-provider format
(function migrateOldKey() {
    const oldKey = localStorage.getItem('inkwell_api_key');
    if (oldKey) {
        setApiKey('claude', oldKey);
        setProvider('claude');
        localStorage.removeItem('inkwell_api_key');
    }
})();
import { startCamera, stopCamera, refocus } from './camera.js';
import { init as initCapture, teardown as teardownCapture, scanPage } from './capture.js';
import { clearTranscript, copyAll, getPages, renderSavedPages, removeLastPage, getPageCount } from './transcript.js';
import { updateStatusPill, updatePageCounter } from './ui.js';
import { saveTranscript, deleteTranscript, getFullText, renderLibrary } from './library.js';

// --- DOM refs ---
const viewContainer = document.getElementById('view-container');
const btnScan = document.getElementById('btn-scan');
const btnCopy = document.getElementById('btn-copy');
const btnSave = document.getElementById('btn-save');
const btnClear = document.getElementById('btn-clear');
const btnNewDoc = document.getElementById('btn-new-doc');
const btnRescan = document.getElementById('btn-rescan');
const viewTabs = document.querySelectorAll('.view-tab');

// Save modal
const saveModal = document.getElementById('save-modal');
const saveNameInput = document.getElementById('save-name-input');
const btnConfirmSave = document.getElementById('btn-confirm-save');
const btnCancelSave = document.getElementById('btn-cancel-save');

let currentView = 0; // 0 = scan, 1 = text, 2 = library
let wakeLock = null;
let cameraStarted = false;

// --- Init ---
initSettings();
initTabs();
initScanActions();
initTextActions();
initSaveModal();
if (isDesktop()) viewContainer.style.transform = 'none';
boot();

// --- Boot: API key check then straight to camera ---
async function boot() {
    if (!hasApiKey()) {
        // Open settings modal on first launch
        document.getElementById('btn-settings').click();
    }

    // Start camera immediately
    try {
        const video = await startCamera();
        initCapture(video);
        cameraStarted = true;
    } catch (err) {
        updateStatusPill('Camera error', 'error');
        console.error('Camera start failed:', err);
    }

    await requestWakeLock();
    refreshLibrary();
}

// --- Wake Lock ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch (e) {}
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

// --- Tab Navigation ---
function initTabs() {
    viewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchView(parseInt(tab.dataset.view));
        });
    });
}

const isDesktop = () => window.innerWidth >= 900;

function switchView(view) {
    currentView = view;
    viewTabs.forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.view) === currentView);
    });

    if (isDesktop()) {
        // Desktop: scan+text always visible; library toggles overlay
        document.body.classList.toggle('library-active', currentView === 2);
    } else {
        // Mobile: slide views
        document.body.classList.remove('library-active');
        viewContainer.style.transform = `translateX(${-currentView * 100}vw)`;
    }

    // Refresh library when switching to it
    if (currentView === 2) {
        refreshLibrary();
    }
}

// --- Handle resize between mobile/desktop ---
window.addEventListener('resize', () => {
    if (isDesktop()) {
        viewContainer.style.transform = '';
        document.body.classList.toggle('library-active', currentView === 2);
    } else {
        document.body.classList.remove('library-active');
        viewContainer.style.transform = `translateX(${-currentView * 100}vw)`;
    }
});

// --- Scan Preview Toast (mobile only) ---
(function initPreviewToast() {
    const preview = document.getElementById('scan-preview');
    const previewText = preview.querySelector('.scan-preview-text');
    let hideTimer = null;

    document.addEventListener('inkwell:scanned', (e) => {
        if (isDesktop()) return; // Desktop shows transcript live
        previewText.textContent = e.detail.text;
        preview.classList.remove('hidden');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => preview.classList.add('hidden'), 4000);
    });

    // Tap to dismiss
    preview.addEventListener('click', () => {
        preview.classList.add('hidden');
        clearTimeout(hideTimer);
    });
})();

// --- Swipe Navigation (touch) ---
(function initSwipe() {
    let startX = 0;
    let startTime = 0;
    let deltaX = 0;
    let dragging = false;

    viewContainer.addEventListener('touchstart', (e) => {
        if (isDesktop()) return;
        if (e.target.closest('button, .transcript-body, .library-list')) return;
        startX = e.touches[0].clientX;
        startTime = Date.now();
        deltaX = 0;
        dragging = true;
        viewContainer.classList.add('no-transition');
    }, { passive: true });

    viewContainer.addEventListener('touchmove', (e) => {
        if (!dragging || isDesktop()) return;
        deltaX = e.touches[0].clientX - startX;

        const atLeftEdge = currentView === 0 && deltaX > 0;
        const atRightEdge = currentView === 2 && deltaX < 0;
        const resistedDelta = (atLeftEdge || atRightEdge) ? deltaX * 0.2 : deltaX;

        const baseOffset = -currentView * window.innerWidth;
        viewContainer.style.transform = `translateX(${baseOffset + resistedDelta}px)`;
    }, { passive: true });

    viewContainer.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        viewContainer.classList.remove('no-transition');

        const elapsed = Date.now() - startTime;
        const velocity = Math.abs(deltaX) / elapsed;
        const threshold = 80;

        if (Math.abs(deltaX) > threshold || velocity > 0.5) {
            if (deltaX < 0 && currentView < 2) {
                currentView++;
            } else if (deltaX > 0 && currentView > 0) {
                currentView--;
            }
        }

        switchView(currentView);
    });
})();

// --- Scan Actions ---
function initScanActions() {
    btnScan.addEventListener('click', () => {
        if (!hasApiKey()) {
            document.getElementById('btn-settings').click();
            return;
        }
        scanPage();
    });

    btnRescan.addEventListener('click', () => {
        if (!hasApiKey()) {
            document.getElementById('btn-settings').click();
            return;
        }
        removeLastPage();
        updatePageCounter(getPageCount());
        scanPage();
    });

    // Tap camera feed to refocus
    document.querySelector('.scan-viewport').addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        refocus();
        updateStatusPill('Refocusing…', 'working');
        setTimeout(() => updateStatusPill('Ready', 'ready'), 1000);
    });

    btnNewDoc.addEventListener('click', () => {
        const pages = getPages();
        if (pages.length > 0) {
            if (confirm('Save current transcript before starting new?')) {
                saveNameInput.value = '';
                saveModal.classList.remove('hidden');
                saveNameInput.focus();
                return;
            }
        }
        clearTranscript();
    });
}

// --- Text Actions ---
function initTextActions() {
    btnCopy.addEventListener('click', async () => {
        const success = await copyAll();
        if (success) {
            btnCopy.textContent = 'Copied!';
            btnCopy.classList.add('copied');
            setTimeout(() => {
                btnCopy.textContent = 'Copy All';
                btnCopy.classList.remove('copied');
            }, 1500);
        }
    });

    btnSave.addEventListener('click', () => {
        const pages = getPages();
        if (pages.length === 0) return;
        saveNameInput.value = '';
        saveModal.classList.remove('hidden');
        saveNameInput.focus();
    });

    btnClear.addEventListener('click', () => {
        if (!confirm('Clear current transcript?')) return;
        clearTranscript();
    });
}

// --- Save Modal ---
function initSaveModal() {
    btnConfirmSave.addEventListener('click', () => {
        const name = saveNameInput.value.trim();
        if (!name) return;
        const pages = getPages();
        if (pages.length === 0) return;

        saveTranscript(name, [...pages]);
        saveModal.classList.add('hidden');
        clearTranscript();
        refreshLibrary();

        // Flash confirmation
        btnSave.textContent = 'Saved!';
        setTimeout(() => { btnSave.textContent = 'Save'; }, 1500);
    });

    btnCancelSave.addEventListener('click', () => {
        saveModal.classList.add('hidden');
    });

    saveModal.querySelector('.modal-backdrop').addEventListener('click', () => {
        saveModal.classList.add('hidden');
    });
}

// --- Library ---
function refreshLibrary() {
    renderLibrary(
        // onCopy
        async (entry, btn) => {
            try {
                await navigator.clipboard.writeText(getFullText(entry));
                btn.textContent = 'Done';
                setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
            } catch {}
        },
        // onDelete
        (id) => {
            deleteTranscript(id);
            refreshLibrary();
        },
        // onView
        (entry) => {
            renderSavedPages(entry.pages);
            switchView(1);
        }
    );
}

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
