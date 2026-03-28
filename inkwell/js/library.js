const STORAGE_KEY = 'inkwell_library';

function loadLibrary() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveLibrary(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function saveTranscript(name, pages) {
    const entries = loadLibrary();
    entries.unshift({
        id: Date.now().toString(),
        name: name,
        pages: pages,
        date: new Date().toISOString()
    });
    saveLibrary(entries);
}

export function deleteTranscript(id) {
    const entries = loadLibrary().filter(e => e.id !== id);
    saveLibrary(entries);
}

export function getTranscript(id) {
    return loadLibrary().find(e => e.id === id) || null;
}

export function getFullText(entry) {
    return entry.pages.map((text, i) => `— Page ${i + 1} —\n\n${text}`).join('\n\n');
}

export function renderLibrary(onCopy, onDelete) {
    const listEl = document.getElementById('library-list');
    const entries = loadLibrary();

    if (entries.length === 0) {
        listEl.innerHTML = '<p class="library-placeholder">No saved transcripts yet.</p>';
        return;
    }

    listEl.innerHTML = entries.map(entry => {
        const date = new Date(entry.date);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const pageCount = entry.pages.length;
        return `
            <div class="library-item" data-id="${entry.id}">
                <div class="library-item-info">
                    <div class="library-item-name">${escapeHtml(entry.name)}</div>
                    <div class="library-item-meta">${pageCount} page${pageCount !== 1 ? 's' : ''} · ${dateStr}</div>
                </div>
                <div class="library-item-actions">
                    <button class="library-btn copy-btn" data-id="${entry.id}">Copy</button>
                    <button class="library-btn delete" data-id="${entry.id}">Del</button>
                </div>
            </div>
        `;
    }).join('');

    // Wire up buttons
    listEl.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const entry = getTranscript(btn.dataset.id);
            if (entry) onCopy(entry, btn);
        });
    });

    listEl.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this transcript?')) {
                onDelete(btn.dataset.id);
            }
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
