// Google Docs integration — auth, doc management, iframe embed, text insertion

const STORAGE_REFRESH = 'inkwell_gdocs_refresh';
const STORAGE_DOCID = 'inkwell_gdocs_docid';
const STORAGE_DOCNAME = 'inkwell_gdocs_docname';
const STORAGE_CLIENT_ID = 'inkwell_gdocs_client_id';

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

export function getDocEmbedUrl() {
    const docId = getDocId();
    if (!docId) return null;
    return `https://docs.google.com/document/d/${docId}/edit?embedded=true&rm=minimal`;
}

export function getClientId() {
    return localStorage.getItem(STORAGE_CLIENT_ID) || '';
}

export function setClientId(id) {
    localStorage.setItem(STORAGE_CLIENT_ID, id.trim());
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

    const res = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: title || `Inkwell Scan — ${new Date().toLocaleDateString()}` })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to create doc');
    }

    const doc = await res.json();
    localStorage.setItem(STORAGE_DOCID, doc.documentId);
    localStorage.setItem(STORAGE_DOCNAME, doc.title);

    document.dispatchEvent(new CustomEvent('inkwell:gdocs-connected', {
        detail: { docId: doc.documentId, docName: doc.title }
    }));

    return doc.documentId;
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
                    localStorage.setItem(STORAGE_DOCID, doc.id);
                    localStorage.setItem(STORAGE_DOCNAME, doc.name);

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
 * Append scanned text to the connected Google Doc.
 * Inserts a page break (except for the first page) followed by the text.
 */
export async function appendTextToDoc(text, pageNumber) {
    const docId = getDocId();
    if (!docId) throw new Error('No doc connected');

    await ensureValidToken();

    // First, get the doc to find the end index
    const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!docRes.ok) {
        const err = await docRes.json();
        throw new Error(err.error?.message || 'Failed to read doc');
    }

    const doc = await docRes.json();
    const endIndex = doc.body.content[doc.body.content.length - 1].endIndex - 1;

    // Build the batch update requests
    const requests = [];

    // For pages after the first, insert a page break
    if (pageNumber > 1) {
        requests.push({
            insertPageBreak: {
                location: { index: endIndex }
            }
        });
    }

    // Insert the scanned text after the page break (or at end for first page)
    // We need to calculate the new index after inserting the page break
    // A page break adds 2 characters (newline + page break)
    const textIndex = pageNumber > 1 ? endIndex + 2 : endIndex;

    requests.push({
        insertText: {
            location: { index: textIndex },
            text: text + '\n'
        }
    });

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

// --- Internal helpers ---

function setupCodeClient(clientId) {
    console.log('[gdocs] Setting up code client with origin:', window.location.origin);
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
