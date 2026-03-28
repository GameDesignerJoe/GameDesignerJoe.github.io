const pages = [];
let viewingEntry = null; // non-null when viewing a saved transcript
const bodyEl = () => document.getElementById('transcript-body');

export function addPage(text) {
    // If viewing a saved entry, restore active pages first
    if (viewingEntry) {
        exitViewMode();
    }
    pages.push(text);
    render();
    return pages.length;
}

export function getFullText() {
    return pages.map((text, i) => `— Page ${i + 1} —\n\n${text}`).join('\n\n');
}

export function getPageCount() {
    return pages.length;
}

export function getPages() {
    return pages;
}

export function removeLastPage() {
    if (viewingEntry) {
        exitViewMode();
    }
    if (pages.length > 0) {
        pages.pop();
        render();
    }
    return pages.length;
}

export function clearTranscript() {
    viewingEntry = null;
    pages.length = 0;
    render();
}

// View a saved entry without destroying active pages
export function viewSavedEntry(entry) {
    viewingEntry = entry;
    renderViewing(entry);
}

// Exit view mode and restore active scan pages
export function exitViewMode() {
    if (!viewingEntry) return;
    viewingEntry = null;
    render();
}

export function isViewing() {
    return viewingEntry !== null;
}

export function getViewingEntry() {
    return viewingEntry;
}

export async function copyAll() {
    // If viewing a saved entry, copy that
    if (viewingEntry) {
        const text = viewingEntry.pages.map((t, i) => `— Page ${i + 1} —\n\n${t}`).join('\n\n');
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }
    if (pages.length === 0) return false;
    try {
        await navigator.clipboard.writeText(getFullText());
        return true;
    } catch {
        return false;
    }
}

function render() {
    const el = bodyEl();
    // Remove any viewing banner
    const existing = document.getElementById('viewing-banner');
    if (existing) existing.remove();

    if (pages.length === 0) {
        el.innerHTML = '<p class="transcript-placeholder">Scanned pages will appear here…</p>';
        return;
    }

    el.innerHTML = pages.map((text, i) => `
        ${i > 0 ? `<div class="page-divider">Page ${i + 1}</div>` : '<div class="page-divider">Page 1</div>'}
        <div class="page-text">${escapeHtml(text)}</div>
    `).join('');

    // Auto-scroll to bottom
    el.scrollTop = el.scrollHeight;
}

function renderViewing(entry) {
    const el = bodyEl();

    const banner = `<div id="viewing-banner" class="viewing-banner">
        <span>Viewing: <strong>${escapeHtml(entry.name)}</strong></span>
        <button id="btn-back-to-scan" class="viewing-back-btn">Back to scan</button>
    </div>`;

    el.innerHTML = banner + entry.pages.map((text, i) => `
        ${i > 0 ? `<div class="page-divider">Page ${i + 1}</div>` : '<div class="page-divider">Page 1</div>'}
        <div class="page-text">${escapeHtml(text)}</div>
    `).join('');

    el.scrollTop = 0;

    // Wire the back button
    document.getElementById('btn-back-to-scan').addEventListener('click', () => {
        exitViewMode();
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
