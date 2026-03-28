import { initSettings, hasApiKey } from './settings.js';
import { startCamera, stopCamera } from './camera.js';
import { init as initCapture, teardown as teardownCapture, scanPage } from './capture.js';
import { clearTranscript, copyAll } from './transcript.js';
import { updateStatusPill } from './ui.js';

// --- DOM refs ---
const screenHome = document.getElementById('screen-home');
const swipeContainer = document.getElementById('swipe-container');
const storyInput = document.getElementById('story-title');
const btnStart = document.getElementById('btn-start');
const btnScan = document.getElementById('btn-scan');
const transcriptTitle = document.getElementById('transcript-title');
const btnCopy = document.getElementById('btn-copy');
const btnNewStory = document.getElementById('btn-new-story');
const viewTabs = document.querySelectorAll('.view-tab');
const statusPill = document.getElementById('status-pill');
const pageCounter = document.getElementById('page-counter');

let currentView = 0; // 0 = scan, 1 = text
let wakeLock = null;

// --- Init ---
initSettings();
initHomeScreen();
initSwipe();
initTabs();
initTextActions();

// --- Home Screen ---
function initHomeScreen() {
    storyInput.addEventListener('input', () => {
        btnStart.disabled = !storyInput.value.trim();
    });

    btnStart.addEventListener('click', startSession);
    btnScan.addEventListener('click', scanPage);
}

async function startSession() {
    const title = storyInput.value.trim();
    if (!title) return;

    if (!hasApiKey()) {
        document.getElementById('btn-settings').click();
        return;
    }

    transcriptTitle.textContent = title;
    clearTranscript();

    // Transition to scan view
    screenHome.classList.remove('active');
    screenHome.style.display = 'none';
    swipeContainer.classList.remove('hidden');
    currentView = 0;
    updateTabs();

    // Request wake lock
    await requestWakeLock();

    // Start camera
    try {
        const video = await startCamera();
        initCapture(video);
    } catch (err) {
        updateStatusPill('Camera error', 'error');
        console.error('Camera start failed:', err);
    }
}

// --- Wake Lock ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch (e) {
            // Silent fail — not critical
        }
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

// Re-acquire wake lock when page becomes visible again
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !screenHome.classList.contains('active')) {
        requestWakeLock();
    }
});

// --- Tab Navigation (click) ---
function initTabs() {
    viewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const view = parseInt(tab.dataset.view);
            switchView(view);
        });
    });
}

function switchView(view) {
    currentView = view;
    swipeContainer.style.transform = `translateX(${-currentView * window.innerWidth}px)`;
    updateTabs();
}

function updateTabs() {
    viewTabs.forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.view) === currentView);
    });
}

// --- Swipe Navigation (touch) ---
function initSwipe() {
    let startX = 0;
    let startTime = 0;
    let deltaX = 0;
    let dragging = false;

    swipeContainer.addEventListener('touchstart', (e) => {
        if (e.target.closest('button, .transcript-body')) return;

        startX = e.touches[0].clientX;
        startTime = Date.now();
        deltaX = 0;
        dragging = true;
        swipeContainer.classList.add('no-transition');
    }, { passive: true });

    swipeContainer.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        deltaX = e.touches[0].clientX - startX;

        const atLeftEdge = currentView === 0 && deltaX > 0;
        const atRightEdge = currentView === 1 && deltaX < 0;
        const resistedDelta = (atLeftEdge || atRightEdge) ? deltaX * 0.2 : deltaX;

        const baseOffset = -currentView * window.innerWidth;
        swipeContainer.style.transform = `translateX(${baseOffset + resistedDelta}px)`;
    }, { passive: true });

    swipeContainer.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        swipeContainer.classList.remove('no-transition');

        const elapsed = Date.now() - startTime;
        const velocity = Math.abs(deltaX) / elapsed;
        const threshold = 80;

        if (Math.abs(deltaX) > threshold || velocity > 0.5) {
            if (deltaX < 0 && currentView === 0) {
                currentView = 1;
            } else if (deltaX > 0 && currentView === 1) {
                currentView = 0;
            }
        }

        swipeContainer.style.transform = `translateX(${-currentView * window.innerWidth}px)`;
        updateTabs();
    });
}

// --- Text View Actions ---
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

    btnNewStory.addEventListener('click', () => {
        if (!confirm('Start a new story? Current transcript will be cleared.')) return;
        endSession();
    });
}

function endSession() {
    teardownCapture();
    stopCamera();
    releaseWakeLock();
    clearTranscript();

    // Reset UI
    swipeContainer.classList.add('hidden');
    swipeContainer.style.transform = 'translateX(0)';
    currentView = 0;
    updateTabs();
    screenHome.style.display = '';
    screenHome.classList.add('active');
    storyInput.value = '';
    btnStart.disabled = true;
    statusPill.textContent = 'Waiting…';
    statusPill.className = 'status-pill';
    pageCounter.textContent = 'Pages: 0';
}

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
