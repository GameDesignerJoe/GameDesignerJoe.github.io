import { initSettings, hasApiKey, setApiKey, setProvider } from './settings.js';
import {
    initGoogleAuth, connectGoogle, disconnectGoogle, isConnected, hasAuth,
    createNewDoc, openDocPicker, openFolderPicker, getDocEmbedUrl, getDocFullUrl, getDocName, getDocId,
    getClientId, setClientId, renameDoc, getFolderName, getFolderId, setFolder,
    getTabs, getActiveTabIndex, addTab, removeTab, switchTab, renameTabDoc, syncDocTitle
} from './gdocs.js';

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
import { clearTranscript, copyAll, getPages, viewSavedEntry, exitViewMode, isViewing, removeLastPage, getPageCount } from './transcript.js';
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
const isDesktop = () => window.innerWidth >= 900;

// --- Init ---
initSettings();
initTabs();
initScanActions();
initTextActions();
initSaveModal();
initGoogleDocs();
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

    // Exit view mode when navigating away from text
    if (currentView !== 1 && isViewing()) {
        exitViewMode();
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
        if (isConnected()) {
            // In Google Docs mode, "New Doc" opens the doc picker
            document.dispatchEvent(new CustomEvent('inkwell:request-doc-picker'));
            return;
        }
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
        if (isViewing()) return; // Already saved
        const pages = getPages();
        if (pages.length === 0) return;
        saveNameInput.value = '';
        saveModal.classList.remove('hidden');
        saveNameInput.focus();
    });

    btnClear.addEventListener('click', () => {
        if (isViewing()) {
            exitViewMode();
            return;
        }
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
            viewSavedEntry(entry);
            switchView(1);
        }
    );
}

// --- Google Docs Integration ---

function initGoogleDocs() {
    const banner = document.getElementById('gdocs-banner');
    const btnConnect = document.getElementById('btn-gdocs-connect');
    const frameContainer = document.getElementById('gdocs-frame-container');
    const frame = document.getElementById('gdocs-frame');
    const transcriptBody = document.getElementById('transcript-body');
    const btnOpen = document.getElementById('btn-gdocs-open');
    const btnDisconnect = document.getElementById('btn-gdocs-disconnect');
    const settingsModal = document.getElementById('settings-modal');
    const tabsContainer = document.getElementById('gdocs-tabs');
    const btnAddTab = document.getElementById('btn-gdocs-add-tab');

    // Doc picker modal
    const pickerModal = document.getElementById('gdocs-picker-modal');
    const btnNewDoc = document.getElementById('btn-gdocs-new');
    const btnExisting = document.getElementById('btn-gdocs-existing');
    const btnPickerCancel = document.getElementById('btn-gdocs-picker-cancel');
    const btnChooseFolder = document.getElementById('btn-gdocs-folder');
    const folderNameDisplay = document.getElementById('gdocs-folder-display');

    // Settings: Google Client ID
    const clientIdInput = document.getElementById('gdocs-client-id');
    const authStatus = document.getElementById('gdocs-auth-status');

    // Load saved client ID into settings input whenever modal opens
    clientIdInput.value = getClientId();
    document.getElementById('btn-settings').addEventListener('click', () => {
        clientIdInput.value = getClientId();
        authStatus.textContent = isConnected() ? 'Connected' : hasAuth() ? 'Authenticated' : '';
        authStatus.style.color = '#4ade80';
        btnDisconnect.classList.toggle('hidden', !hasAuth());
    });

    // Hook into settings save to persist client ID
    const btnSaveSettings = document.getElementById('btn-save-key');
    btnSaveSettings.addEventListener('click', () => {
        const newId = clientIdInput.value.trim();
        const oldId = getClientId();
        setClientId(newId);

        if (newId && newId !== oldId) {
            authStatus.textContent = 'Client ID saved';
            authStatus.style.color = '#4ade80';
            initGoogleAuth();
        } else if (!newId) {
            authStatus.textContent = '';
        }
    });

    // Initialize auth on load if client ID exists
    initGoogleAuth();

    // Restore connected state on load
    if (isConnected()) {
        showConnectedUI();
    }

    // Connect button in banner
    btnConnect.addEventListener('click', async () => {
        if (!getClientId()) {
            document.getElementById('btn-settings').click();
            return;
        }

        if (hasAuth()) {
            showDocPicker();
            return;
        }

        try {
            await connectGoogle();
            showDocPicker();
        } catch (err) {
            console.error('Google connect failed:', err);
        }
    });

    // --- Folder picker ---
    function updateFolderDisplay() {
        const name = getFolderName();
        folderNameDisplay.textContent = name ? name : 'My Drive (root)';
    }

    btnChooseFolder.addEventListener('click', async () => {
        try {
            await openFolderPicker();
            updateFolderDisplay();
        } catch (err) {
            if (err.message !== 'Picker cancelled') {
                console.error('Folder picker failed:', err);
            }
        }
    });

    // --- Doc picker modal ---
    btnNewDoc.addEventListener('click', async () => {
        pickerModal.classList.add('hidden');
        try {
            await createNewDoc();
            showConnectedUI();
        } catch (err) {
            console.error('Create doc failed:', err);
        }
    });

    btnExisting.addEventListener('click', async () => {
        pickerModal.classList.add('hidden');
        try {
            await openDocPicker();
            showConnectedUI();
        } catch (err) {
            if (err.message !== 'Picker cancelled') {
                console.error('Picker failed:', err);
            }
        }
    });

    btnPickerCancel.addEventListener('click', () => {
        pickerModal.classList.add('hidden');
    });

    pickerModal.querySelector('.modal-backdrop').addEventListener('click', () => {
        pickerModal.classList.add('hidden');
    });

    // --- Tab bar ---

    // "+" button opens doc picker (create new or open existing)
    btnAddTab.addEventListener('click', () => {
        showDocPicker();
    });

    function renderTabs() {
        const tabs = getTabs();
        const activeIndex = getActiveTabIndex();
        tabsContainer.innerHTML = '';

        tabs.forEach((tab, i) => {
            const tabEl = document.createElement('div');
            tabEl.className = 'gdocs-tab' + (i === activeIndex ? ' active' : '');

            const nameEl = document.createElement('span');
            nameEl.className = 'gdocs-tab-name';
            nameEl.textContent = tab.docName;
            tabEl.appendChild(nameEl);

            const closeEl = document.createElement('button');
            closeEl.className = 'gdocs-tab-close';
            closeEl.textContent = '\u00d7';
            closeEl.title = 'Close tab';
            closeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTab(i);
                const remaining = getTabs();
                if (remaining.length === 0) {
                    showDisconnectedUI();
                } else {
                    showConnectedUI();
                }
            });
            tabEl.appendChild(closeEl);

            tabEl.addEventListener('click', () => {
                if (i === activeIndex) {
                    // Tapping the active tab opens rename prompt
                    const newName = prompt('Rename document:', tab.docName);
                    if (newName && newName.trim() && newName.trim() !== tab.docName) {
                        renameDoc(newName.trim()).then(() => renderTabs())
                            .catch(err => console.error('Rename failed:', err));
                    }
                    return;
                }
                switchTab(i);
                showConnectedUI();
            });

            tabsContainer.appendChild(tabEl);
        });
    }

    // Disconnect (in settings modal)
    btnDisconnect.addEventListener('click', () => {
        if (!confirm('Disconnect from Google Docs?')) return;
        disconnectGoogle();
        showDisconnectedUI();
        settingsModal.classList.add('hidden');
    });

    // Listen for events from gdocs.js
    document.addEventListener('inkwell:gdocs-connected', () => {
        showConnectedUI();
    });

    document.addEventListener('inkwell:gdocs-disconnected', () => {
        showDisconnectedUI();
    });

    // Allow other parts of the app to request the doc picker
    document.addEventListener('inkwell:request-doc-picker', () => {
        showDocPicker();
    });

    function showDocPicker() {
        updateFolderDisplay();
        pickerModal.classList.remove('hidden');
    }

    function showConnectedUI() {
        banner.classList.add('hidden');
        transcriptBody.classList.add('hidden');
        frameContainer.classList.remove('hidden');
        document.body.classList.add('gdocs-active');

        // Migrate: if we have a docId but no tabs, create the first tab
        const tabs = getTabs();
        if (tabs.length === 0 && getDocId()) {
            addTab(getDocId(), getDocName());
        }

        renderTabs();
        btnOpen.href = getDocFullUrl() || '#';

        const embedUrl = getDocEmbedUrl();
        if (embedUrl && frame.src !== embedUrl) {
            frame.src = embedUrl;
        }

        // Sync doc title from Google Drive in case it was renamed in-doc
        syncDocTitle().then(name => {
            if (name) renderTabs();
        });
    }

    function showDisconnectedUI() {
        banner.classList.remove('hidden');
        transcriptBody.classList.remove('hidden');
        frameContainer.classList.add('hidden');
        frame.src = '';
        document.body.classList.remove('gdocs-active');
    }
}

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
