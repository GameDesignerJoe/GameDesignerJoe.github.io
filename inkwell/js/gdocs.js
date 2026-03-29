// Google Docs integration — auth, doc management, iframe embed, text insertion

const STORAGE_REFRESH = 'inkwell_gdocs_refresh';
const STORAGE_DOCID = 'inkwell_gdocs_docid';
const STORAGE_DOCNAME = 'inkwell_gdocs_docname';
const STORAGE_CLIENT_ID = 'inkwell_gdocs_client_id';
const STORAGE_FOLDERID = 'inkwell_gdocs_folderid';
const STORAGE_FOLDERNAME = 'inkwell_gdocs_foldername';
const STORAGE_TABS = 'inkwell_gdocs_tabs';
const STORAGE_ACTIVE_TAB = 'inkwell_gdocs_active_tab';

let accessToken = null;
let tokenExpiry = 0;
let codeClient = null;
let pickerLoaded = false;

// --- Public API ---

export function isConnected() {
    return !!localStorage.getItem(STORAGE_REFRESH) && !!localStorage.getItem(STORAGE_DOCID);
}

export function hasAuth() {
    return !!localStorage.getItem(STORAGE_REFRESH);
}

export function getDocId() {
    return localStorage.getItem(STORAGE_DOCID);
}

export function getDocName() {
    return localStorage.getItem(STORAGE_DOCNAME) || 'Untitled';
}

/**
 * Fetch the current doc title from Google Drive and update the tab if it changed.
 * Returns the title, or null if the check failed silently.
 */
export async function syncDocTitle() {
    const docId = getDocId();
    if (!docId) return null;

    try {
        await ensureValidToken();
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${docId}?fields=name`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (!res.ok) return null;
        const file = await res.json();
        const currentName = getDocName();
        if (file.name && file.name !== currentName) {
            localStorage.setItem(STORAGE_DOCNAME, file.name);
            renameTabDoc(getActiveTabIndex(), file.name);
            return file.name;
        }
        return currentName;
    } catch {
        return null;
    }
}

export function getDocEmbedUrl() {
    const docId = getDocId();
    if (!docId) return null;
    return `https://docs.google.com/document/d/${docId}/edit?embedded=true`;
}

export function getDocFullUrl() {
    const docId = getDocId();
    if (!docId) return null;
    return `https://docs.google.com/document/d/${docId}/edit`;
}

export function getClientId() {
    return localStorage.getItem(STORAGE_CLIENT_ID) || '';
}

export function setClientId(id) {
    localStorage.setItem(STORAGE_CLIENT_ID, id.trim());
}

export function getFolderId() {
    return localStorage.getItem(STORAGE_FOLDERID) || '';
}

export function getFolderName() {
    return localStorage.getItem(STORAGE_FOLDERNAME) || '';
}

export function setFolder(id, name) {
    if (id) {
        localStorage.setItem(STORAGE_FOLDERID, id);
        localStorage.setItem(STORAGE_FOLDERNAME, name || 'Untitled folder');
    } else {
        localStorage.removeItem(STORAGE_FOLDERID);
        localStorage.removeItem(STORAGE_FOLDERNAME);
    }
}

// --- Images-only mode ---

let imagesOnlyMode = false;

export function getImagesOnly() { return imagesOnlyMode; }
export function setImagesOnly(val) { imagesOnlyMode = !!val; }

// --- Tab Management ---

export function getTabs() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_TABS)) || [];
    } catch { return []; }
}

export function getActiveTabIndex() {
    return parseInt(localStorage.getItem(STORAGE_ACTIVE_TAB)) || 0;
}

function saveTabs(tabs, activeIndex) {
    localStorage.setItem(STORAGE_TABS, JSON.stringify(tabs));
    localStorage.setItem(STORAGE_ACTIVE_TAB, String(activeIndex));

    // Keep legacy STORAGE_DOCID/DOCNAME synced with active tab
    const active = tabs[activeIndex];
    if (active) {
        localStorage.setItem(STORAGE_DOCID, active.docId);
        localStorage.setItem(STORAGE_DOCNAME, active.docName);
    } else {
        localStorage.removeItem(STORAGE_DOCID);
        localStorage.removeItem(STORAGE_DOCNAME);
    }
}

export function addTab(docId, docName) {
    const tabs = getTabs();
    // Don't add duplicate
    const existing = tabs.findIndex(t => t.docId === docId);
    if (existing >= 0) {
        saveTabs(tabs, existing);
        return existing;
    }
    tabs.push({ docId, docName });
    const newIndex = tabs.length - 1;
    saveTabs(tabs, newIndex);
    return newIndex;
}

export function removeTab(index) {
    const tabs = getTabs();
    if (index < 0 || index >= tabs.length) return;
    tabs.splice(index, 1);

    let activeIndex = getActiveTabIndex();
    if (tabs.length === 0) {
        localStorage.removeItem(STORAGE_TABS);
        localStorage.removeItem(STORAGE_ACTIVE_TAB);
        localStorage.removeItem(STORAGE_DOCID);
        localStorage.removeItem(STORAGE_DOCNAME);
        return;
    }
    if (activeIndex >= tabs.length) activeIndex = tabs.length - 1;
    saveTabs(tabs, activeIndex);
}

export function switchTab(index) {
    const tabs = getTabs();
    if (index < 0 || index >= tabs.length) return;
    saveTabs(tabs, index);
}

export function renameTabDoc(index, newName) {
    const tabs = getTabs();
    if (index >= 0 && index < tabs.length) {
        tabs[index].docName = newName;
        saveTabs(tabs, getActiveTabIndex());
    }
}

/**
 * Initialize Google Identity Services.
 * Call once on app startup.
 */
export function initGoogleAuth() {
    const clientId = getClientId();
    if (!clientId) return;

    // Load GIS library if not already loaded
    if (!window.google?.accounts?.oauth2) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => setupCodeClient(clientId);
        document.head.appendChild(script);
    } else {
        setupCodeClient(clientId);
    }

    // If we have a refresh token, try to restore the session silently
    if (hasAuth()) {
        ensureValidToken().catch(() => {
            // Token refresh failed — clear stale auth
            clearAuth();
        });
    }
}

/**
 * Trigger the Google OAuth popup.
 * Returns a promise that resolves when auth completes.
 */
export function connectGoogle() {
    return new Promise((resolve, reject) => {
        const clientId = getClientId();
        if (!clientId) {
            reject(new Error('No Google Client ID configured'));
            return;
        }

        // Ensure GIS is loaded
        if (!window.google?.accounts?.oauth2) {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
                setupCodeClient(clientId);
                doConnect(resolve, reject);
            };
            document.head.appendChild(script);
        } else {
            if (!codeClient) setupCodeClient(clientId);
            doConnect(resolve, reject);
        }
    });
}

/**
 * Disconnect from Google Docs — clears tokens and doc selection.
 */
export function disconnectGoogle() {
    accessToken = null;
    tokenExpiry = 0;
    clearAuth();
    document.dispatchEvent(new CustomEvent('inkwell:gdocs-disconnected'));
}

/**
 * Create a new Google Doc and set it as the connected doc.
 * Returns the doc ID.
 */
export async function createNewDoc(title) {
    await ensureValidToken();

    const docTitle = title || `Inkwell Scan — ${new Date().toLocaleDateString()}`;
    const folderId = getFolderId();

    // Create via Drive API so we can specify the parent folder
    const metadata = {
        name: docTitle,
        mimeType: 'application/vnd.google-apps.document'
    };
    if (folderId) {
        metadata.parents = [folderId];
    }

    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to create doc');
    }

    const file = await res.json();
    addTab(file.id, docTitle);

    document.dispatchEvent(new CustomEvent('inkwell:gdocs-connected', {
        detail: { docId: file.id, docName: docTitle }
    }));

    return file.id;
}

/**
 * Open the Google Drive Picker to select an existing doc.
 * Returns the doc ID.
 */
export async function openDocPicker() {
    await ensureValidToken();
    await loadPickerApi();

    return new Promise((resolve, reject) => {
        const picker = new google.picker.PickerBuilder()
            .addView(new google.picker.DocsView(google.picker.ViewId.DOCUMENTS))
            .setOAuthToken(accessToken)
            .setCallback(async (data) => {
                if (data.action === google.picker.Action.PICKED) {
                    const doc = data.docs[0];
                    addTab(doc.id, doc.name);

                    document.dispatchEvent(new CustomEvent('inkwell:gdocs-connected', {
                        detail: { docId: doc.id, docName: doc.name }
                    }));

                    resolve(doc.id);
                } else if (data.action === google.picker.Action.CANCEL) {
                    reject(new Error('Picker cancelled'));
                }
            })
            .build();

        picker.setVisible(true);
    });
}

/**
 * Rename the connected Google Doc.
 */
export async function renameDoc(newTitle) {
    const docId = getDocId();
    if (!docId) throw new Error('No doc connected');

    await ensureValidToken();

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newTitle })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to rename doc');
    }

    localStorage.setItem(STORAGE_DOCNAME, newTitle);
    renameTabDoc(getActiveTabIndex(), newTitle);
    return newTitle;
}

/**
 * Detect if a line has leading whitespace indicating it should be centered.
 * OCR models add leading spaces to approximate centering on the page.
 * Returns the trimmed text if centered, or null if left-aligned.
 */
function detectCentered(line) {
    // OCR approximates centering with leading spaces. To distinguish real centering
    // from simple indentation (e.g. poetry continuation lines with 4-8 spaces),
    // require substantial leading space AND check that the indent is roughly what
    // you'd expect if the text were centered on a ~70-char line.
    const leadingSpaces = line.match(/^( +)/)?.[1].length || 0;
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length >= 60) return null;

    // Expect centering indent to be roughly (lineWidth - textLength) / 2
    // Use a generous minimum of 15 spaces to avoid false positives on indented lines
    const expectedIndent = Math.max(15, Math.floor((70 - trimmed.length) / 2) - 10);
    if (leadingSpaces >= expectedIndent) {
        return trimmed;
    }
    return null;
}

/**
 * Append scanned text to the connected Google Doc.
 * Always inserts a page break if the doc already has content.
 * Detects a title on the first line and formats it as a heading.
 * Detects centered lines and applies Google Docs center alignment.
 * Sets font to Calibri for all inserted text.
 */
export async function appendTextToDoc(text, pageNumber) {
    const docId = getDocId();
    if (!docId) throw new Error('No doc connected');

    await ensureValidToken();

    // Get the doc to find the end index
    const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!docRes.ok) {
        const err = await docRes.json();
        throw new Error(err.error?.message || 'Failed to read doc');
    }

    const doc = await docRes.json();
    const endIndex = doc.body.content[doc.body.content.length - 1].endIndex - 1;

    // Check if doc already has real content (more than just a single newline)
    const docHasContent = endIndex > 1;

    const requests = [];
    let insertAt = endIndex;

    // Insert a page break if the doc already has content
    if (docHasContent) {
        requests.push({
            insertPageBreak: {
                location: { index: insertAt }
            }
        });
        // Page break adds 2 characters (newline + page break)
        insertAt += 2;
    }

    // Detect title: first line if it's short, followed by a blank line or more text
    const lines = text.split('\n');
    let titleLine = null;
    let bodyStartLine = 0;

    if (lines.length >= 2) {
        const firstLine = lines[0].trim();
        // Title heuristic: first line is short (under 60 chars), non-empty,
        // and doesn't start with common body-text patterns
        if (firstLine.length > 0 && firstLine.length < 60 &&
            !firstLine.startsWith('"') && !firstLine.startsWith('---[')) {
            titleLine = firstLine;
            // Skip the title line (and an optional blank line after it) for the body
            bodyStartLine = lines[1].trim() === '' ? 2 : 1;
        }
    }

    // Track paragraph ranges that need center alignment
    const centeredRanges = [];

    // Insert title if detected
    if (titleLine) {
        const titleIsCentered = detectCentered(lines[0]) !== null;
        requests.push({
            insertText: {
                location: { index: insertAt },
                text: titleLine + '\n'
            }
        });
        const titleEndIndex = insertAt + titleLine.length;

        // Style title as Heading 2
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: insertAt, endIndex: titleEndIndex + 1 },
                paragraphStyle: { namedStyleType: 'HEADING_2' },
                fields: 'namedStyleType'
            }
        });

        // Center-align the title if it was centered on the page
        if (titleIsCentered) {
            centeredRanges.push({ startIndex: insertAt, endIndex: titleEndIndex + 1 });
        }

        // Set title font to Calibri
        requests.push({
            updateTextStyle: {
                range: { startIndex: insertAt, endIndex: titleEndIndex },
                textStyle: {
                    weightedFontFamily: { fontFamily: 'Calibri' }
                },
                fields: 'weightedFontFamily'
            }
        });

        insertAt += titleLine.length + 1; // +1 for the newline
    }

    // Process body lines: strip leading spaces from centered lines and track their positions
    const bodyLines = lines.slice(bodyStartLine || 0);
    // If we extracted a title, body starts after bodyStartLine
    if (titleLine) {
        bodyLines.splice(0, bodyLines.length);
        bodyLines.push(...lines.slice(bodyStartLine));
    }

    if (bodyLines.length > 0) {
        const bodyStartIndex = insertAt;

        // Build the body text, stripping leading spaces from centered lines
        // and tracking which line ranges need center alignment
        const processedLines = [];
        const lineCenterFlags = [];

        for (const line of bodyLines) {
            const centered = detectCentered(line);
            if (centered !== null) {
                processedLines.push(centered);
                lineCenterFlags.push(true);
            } else {
                processedLines.push(line);
                lineCenterFlags.push(false);
            }
        }

        const bodyText = processedLines.join('\n');
        if (bodyText.trim()) {
            requests.push({
                insertText: {
                    location: { index: insertAt },
                    text: bodyText + '\n'
                }
            });

            // Set body font to Calibri
            const bodyEndIndex = insertAt + bodyText.length;
            requests.push({
                updateTextStyle: {
                    range: { startIndex: bodyStartIndex, endIndex: bodyEndIndex },
                    textStyle: {
                        weightedFontFamily: { fontFamily: 'Calibri' }
                    },
                    fields: 'weightedFontFamily'
                }
            });

            // Calculate centered paragraph ranges from line positions
            let pos = insertAt;
            for (let i = 0; i < processedLines.length; i++) {
                const lineLen = processedLines[i].length;
                if (lineCenterFlags[i]) {
                    // Range covers this paragraph (line + its newline)
                    centeredRanges.push({
                        startIndex: pos,
                        endIndex: pos + lineLen + 1 // +1 for newline
                    });
                }
                pos += lineLen + 1; // +1 for newline separator
            }
        }
    }

    // Apply center alignment to all detected centered paragraphs
    for (const range of centeredRanges) {
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: range.startIndex, endIndex: range.endIndex },
                paragraphStyle: { alignment: 'CENTER' },
                fields: 'alignment'
            }
        });
    }

    const batchRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
    });

    if (!batchRes.ok) {
        const err = await batchRes.json();
        throw new Error(err.error?.message || 'Failed to append text');
    }

    return batchRes.json();
}

/**
 * Open the Google Drive Picker to select a folder.
 * Returns { id, name } of the selected folder.
 */
export async function openFolderPicker() {
    await ensureValidToken();
    await loadPickerApi();

    return new Promise((resolve, reject) => {
        const folderView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setMimeTypes('application/vnd.google-apps.folder');

        const picker = new google.picker.PickerBuilder()
            .addView(folderView)
            .setOAuthToken(accessToken)
            .setTitle('Choose a folder for Inkwell docs')
            .setCallback((data) => {
                if (data.action === google.picker.Action.PICKED) {
                    const folder = data.docs[0];
                    setFolder(folder.id, folder.name);
                    resolve({ id: folder.id, name: folder.name });
                } else if (data.action === google.picker.Action.CANCEL) {
                    reject(new Error('Picker cancelled'));
                }
            })
            .build();

        picker.setVisible(true);
    });
}

// --- Scan Image Backup ---

// Cache: docId → scan subfolder ID (avoids re-querying Drive each scan)
const scanFolderCache = new Map();

/**
 * Build a camelCase filename from OCR text: "PagesAreJust.jpg"
 */
function buildScanFilename(text) {
    const words = text.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).slice(0, 4);
    const camel = words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    return `${camel || 'Scan'}.jpg`;
}

/**
 * Find or create a "{docName} Scans" subfolder in Drive for the active doc.
 * Returns the folder ID.
 */
async function getOrCreateScanFolder() {
    const docId = getDocId();
    if (!docId) throw new Error('No doc connected');

    // Check cache first
    if (scanFolderCache.has(docId)) return scanFolderCache.get(docId);

    await ensureValidToken();

    const docName = getDocName();
    const folderName = `${docName} Scans`;
    const parentId = getFolderId() || 'root';

    // Search for existing subfolder
    const q = `name = '${folderName.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files?.length > 0) {
            const folderId = searchData.files[0].id;
            scanFolderCache.set(docId, folderId);
            return folderId;
        }
    }

    // Create the subfolder
    const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error?.message || 'Failed to create scan folder');
    }

    const folder = await createRes.json();
    scanFolderCache.set(docId, folder.id);
    return folder.id;
}

/**
 * Upload a scan image to the doc's scan subfolder in Google Drive.
 * Fire-and-forget — errors are logged but never block scanning.
 */
export async function uploadScanImage(base64, text) {
    await ensureValidToken();

    const folderId = await getOrCreateScanFolder();

    const filename = buildScanFilename(text);

    const metadata = {
        name: filename,
        parents: [folderId]
    };

    // Convert base64 to binary Blob
    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
    }
    const imageBlob = new Blob([byteArray], { type: 'image/jpeg' });

    // Build multipart body: JSON metadata + binary image
    const boundary = '---inkwell_upload';
    const metaPart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) + '\r\n';
    const binaryHeader = `--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;

    const body = new Blob([metaPart, binaryHeader, imageBlob, closing]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to upload scan image');
    }

    return res.json();
}

// --- Internal helpers ---

function setupCodeClient(clientId) {
    codeClient = google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        redirect_uri: 'postmessage',
        callback: () => {} // Overridden per-call in doConnect
    });
}

let connectResolve = null;
let connectReject = null;

function doConnect(resolve, reject) {
    connectResolve = resolve;
    connectReject = reject;

    codeClient.callback = async (response) => {
        if (response.error) {
            connectReject(new Error(response.error));
            return;
        }

        try {
            // Exchange the auth code for tokens via our server endpoint
            const tokenRes = await fetch('/api/gdocs-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: response.code,
                    redirect_uri: 'postmessage'
                })
            });

            const tokenData = await tokenRes.json();

            if (!tokenRes.ok) {
                connectReject(new Error(tokenData.error || 'Token exchange failed'));
                return;
            }

            accessToken = tokenData.access_token;
            tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 min buffer

            if (tokenData.refresh_token) {
                localStorage.setItem(STORAGE_REFRESH, tokenData.refresh_token);
            }

            document.dispatchEvent(new CustomEvent('inkwell:gdocs-authed'));
            connectResolve();
        } catch (err) {
            connectReject(err);
        }
    };

    codeClient.requestCode();
}

async function ensureValidToken() {
    if (accessToken && Date.now() < tokenExpiry) return;

    const refreshToken = localStorage.getItem(STORAGE_REFRESH);
    if (!refreshToken) throw new Error('Not authenticated');

    const res = await fetch('/api/gdocs-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
    });

    const data = await res.json();

    if (!res.ok) {
        clearAuth();
        throw new Error(data.error || 'Token refresh failed');
    }

    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
}

function clearAuth() {
    localStorage.removeItem(STORAGE_REFRESH);
    localStorage.removeItem(STORAGE_DOCID);
    localStorage.removeItem(STORAGE_DOCNAME);
    localStorage.removeItem(STORAGE_FOLDERID);
    localStorage.removeItem(STORAGE_FOLDERNAME);
    localStorage.removeItem(STORAGE_TABS);
    localStorage.removeItem(STORAGE_ACTIVE_TAB);
}

async function loadPickerApi() {
    if (pickerLoaded) return;

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            gapi.load('picker', () => {
                pickerLoaded = true;
                resolve();
            });
        };
        document.head.appendChild(script);
    });
}
