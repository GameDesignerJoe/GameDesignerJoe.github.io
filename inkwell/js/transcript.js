const pages = [];
const bodyEl = () => document.getElementById('transcript-body');

export function addPage(text) {
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

export function clearTranscript() {
    pages.length = 0;
    render();
}

export function renderSavedPages(savedPages) {
    pages.length = 0;
    savedPages.forEach(p => pages.push(p));
    render();
}

export async function copyAll() {
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

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
