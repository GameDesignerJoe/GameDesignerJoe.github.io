// Shared UI update functions — avoids circular imports between app.js and capture.js

const statusPill = document.getElementById('status-pill');
const pageCounter = document.getElementById('page-counter');
const errorBar = document.getElementById('error-bar');
const errorMsg = document.getElementById('error-msg');
const btnRetry = document.getElementById('btn-retry');
const btnSkip = document.getElementById('btn-skip');

export function updateStatusPill(text, state) {
    statusPill.textContent = text;
    statusPill.className = 'status-pill';
    if (state) statusPill.classList.add(state);

    // Hide error bar when status changes to non-error
    if (state !== 'error') {
        hideError();
    }
}

export function updatePageCounter(count) {
    pageCounter.textContent = `Pages: ${count}`;
}

export function showError(message, onRetry, onSkip) {
    errorMsg.textContent = message;
    errorBar.classList.remove('hidden');

    // Replace listeners to avoid stacking
    const newRetry = btnRetry.cloneNode(true);
    const newSkip = btnSkip.cloneNode(true);
    btnRetry.replaceWith(newRetry);
    btnSkip.replaceWith(newSkip);

    newRetry.addEventListener('click', () => {
        hideError();
        onRetry();
    });
    newSkip.addEventListener('click', () => {
        hideError();
        onSkip();
    });
}

export function hideError() {
    errorBar.classList.add('hidden');
}
