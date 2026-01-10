// Dropbox API Integration Module
import config from '../config.js';

// Dropbox API endpoints
const DROPBOX_API = {
  authorize: 'https://www.dropbox.com/oauth2/authorize',
  filesListFolder: 'https://api.dropboxapi.com/2/files/list_folder',
  filesListFolderContinue: 'https://api.dropboxapi.com/2/files/list_folder/continue',
  filesGetTemporaryLink: 'https://api.dropboxapi.com/2/files/get_temporary_link',
  filesDownload: 'https://content.dropboxapi.com/2/files/download'
};

/**
 * Check if the stored token is expired
 * @returns {boolean} True if token is expired
 */
export function isTokenExpired() {
  const expirationTime = localStorage.getItem('dropbox_token_expires');
  
  if (!expirationTime) {
    // No expiration time stored, assume expired
    return true;
  }
  
  const now = Date.now();
  const expired = now >= parseInt(expirationTime);
  
  if (expired) {
    console.log('[Dropbox] Token has expired');
  }
  
  return expired;
}

/**
 * Check if user is authenticated with a valid (non-expired) token
 * @returns {boolean}
 */
export function isAuthenticated() {
  const token = getAccessToken();
  
  if (!token) {
    return false;
  }
  
  // Check if token is expired
  if (isTokenExpired()) {
    console.log('[Dropbox] Token expired, clearing authentication');
    clearAccessToken();
    return false;
  }
  
  return true;
}

/**
 * Get stored access token
 * @returns {string|null}
 */
export function getAccessToken() {
  return localStorage.getItem('dropbox_access_token');
}

/**
 * Store access token with expiration time
 * @param {string} token 
 * @param {number} expiresIn - Seconds until expiration (default 4 hours)
 */
export function setAccessToken(token, expiresIn = 14400) {
  localStorage.setItem('dropbox_access_token', token);
  
  // Store expiration timestamp (current time + expiresIn seconds)
  const expirationTime = Date.now() + (expiresIn * 1000);
  localStorage.setItem('dropbox_token_expires', expirationTime.toString());
  
  console.log('[Dropbox] Access token stored, expires at:', new Date(expirationTime).toLocaleString());
}

/**
 * Clear stored access token and expiration time
 */
export function clearAccessToken() {
  localStorage.removeItem('dropbox_access_token');
  localStorage.removeItem('dropbox_token_expires');
  console.log('[Dropbox] Access token cleared');
}

/**
 * Initiate OAuth authorization flow
 * Redirects user to Dropbox authorization page
 */
export function initiateOAuth() {
  console.log('[Dropbox] Initiating OAuth flow');
  
  // Build authorization URL
  const authUrl = new URL(DROPBOX_API.authorize);
  authUrl.searchParams.append('client_id', config.dropboxAppKey);
  authUrl.searchParams.append('response_type', 'token');
  authUrl.searchParams.append('redirect_uri', config.redirectUri);
  
  console.log('[Dropbox] Authorization URL:', authUrl.toString());
  console.log('[Dropbox] Redirect URI:', config.redirectUri);
  
  // Redirect to Dropbox
  window.location.href = authUrl.toString();
}

/**
 * Handle OAuth callback
 * Extracts access token from URL hash
 * @returns {string|null} Access token if found
 */
export function handleOAuthCallback() {
  const hash = window.location.hash;
  
  if (!hash.includes('access_token')) {
    return null;
  }
  
  console.log('[Dropbox] Processing OAuth callback');
  
  try {
    // Extract access token from URL hash
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const tokenType = params.get('token_type');
    const expiresIn = params.get('expires_in');
    
    if (accessToken) {
      console.log('[Dropbox] Access token received');
      console.log('[Dropbox] Token type:', tokenType);
      console.log('[Dropbox] Expires in:', expiresIn, 'seconds');
      
      // Store the token with expiration time
      const expiresInSeconds = expiresIn ? parseInt(expiresIn) : 14400; // Default 4 hours
      setAccessToken(accessToken, expiresInSeconds);
      
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
      
      return accessToken;
    }
  } catch (error) {
    console.error('[Dropbox] Error processing OAuth callback:', error);
  }
  
  return null;
}

/**
 * Make authenticated API request to Dropbox
 * @param {string} endpoint - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} API response
 */
async function makeApiRequest(endpoint, options = {}) {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  
  const response = await fetch(endpoint, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Dropbox] API Error:', response.status, errorText);
    
    // Handle authentication errors
    if (response.status === 401) {
      clearAccessToken();
      throw new Error('Authentication expired. Please reconnect.');
    }
    
    throw new Error(`Dropbox API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * List files and folders in a directory
 * @param {string} path - Dropbox path (empty string for root)
 * @param {boolean} recursive - Whether to list recursively
 * @returns {Promise<Object>} List of files and folders
 */
export async function listFolder(path = '', recursive = true) {
  console.log('[Dropbox] Listing folder:', path || '(root)');
  
  try {
    const response = await makeApiRequest(DROPBOX_API.filesListFolder, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: path || '',
        recursive: recursive,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false
      })
    });
    
    console.log('[Dropbox] Found', response.entries.length, 'items');
    return response;
  } catch (error) {
    console.error('[Dropbox] Error listing folder:', error);
    throw error;
  }
}

/**
 * Continue listing folder (pagination)
 * @param {string} cursor - Cursor from previous list_folder call
 * @returns {Promise<Object>} More files and folders
 */
export async function listFolderContinue(cursor) {
  console.log('[Dropbox] Continuing folder list with cursor');
  
  try {
    const response = await makeApiRequest(DROPBOX_API.filesListFolderContinue, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cursor: cursor
      })
    });
    
    console.log('[Dropbox] Found', response.entries.length, 'more items');
    return response;
  } catch (error) {
    console.error('[Dropbox] Error continuing folder list:', error);
    throw error;
  }
}

/**
 * Get all files recursively with pagination support
 * @param {string} path - Starting path
 * @param {Function} progressCallback - Called with count of files found
 * @returns {Promise<Array>} All entries
 */
export async function getAllFiles(path = '', progressCallback = null) {
  console.log('[Dropbox] Getting all files from:', path || '(root)');
  
  let allEntries = [];
  let hasMore = true;
  let cursor = null;
  
  try {
    // Initial request
    let response = await listFolder(path, true);
    allEntries = allEntries.concat(response.entries);
    hasMore = response.has_more;
    cursor = response.cursor;
    
    if (progressCallback) {
      progressCallback(allEntries.length);
    }
    
    // Continue fetching if there are more results
    while (hasMore) {
      response = await listFolderContinue(cursor);
      allEntries = allEntries.concat(response.entries);
      hasMore = response.has_more;
      cursor = response.cursor;
      
      if (progressCallback) {
        progressCallback(allEntries.length);
      }
    }
    
    console.log('[Dropbox] Total entries found:', allEntries.length);
    return allEntries;
  } catch (error) {
    console.error('[Dropbox] Error getting all files:', error);
    throw error;
  }
}

/**
 * Filter entries for audio files only
 * @param {Array} entries - Dropbox file entries
 * @returns {Array} Audio files only
 */
export function filterAudioFiles(entries) {
  const audioExtensions = config.audioExtensions;
  
  const audioFiles = entries.filter(entry => {
    if (entry['.tag'] !== 'file') return false;
    
    const fileName = entry.name.toLowerCase();
    return audioExtensions.some(ext => fileName.endsWith(ext));
  });
  
  console.log('[Dropbox] Filtered', audioFiles.length, 'audio files from', entries.length, 'total entries');
  return audioFiles;
}

/**
 * Get temporary download link for a file
 * Link expires after 4 hours
 * @param {string} path - Full path to file
 * @returns {Promise<Object>} Object with link and metadata
 */
export async function getTemporaryLink(path) {
  console.log('[Dropbox] Getting temporary link for:', path);
  
  try {
    const response = await makeApiRequest(DROPBOX_API.filesGetTemporaryLink, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: path
      })
    });
    
    console.log('[Dropbox] Temporary link obtained, expires at:', new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleString());
    return response;
  } catch (error) {
    console.error('[Dropbox] Error getting temporary link:', error);
    throw error;
  }
}

/**
 * Download file content (for metadata extraction)
 * @param {string} path - Full path to file
 * @returns {Promise<Blob>} File content as blob
 */
export async function downloadFile(path) {
  console.log('[Dropbox] Downloading file:', path);
  
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  try {
    const response = await fetch(DROPBOX_API.filesDownload, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: path
        })
      }
    });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.blob();
  } catch (error) {
    console.error('[Dropbox] Error downloading file:', error);
    throw error;
  }
}

/**
 * Test API connection
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  console.log('[Dropbox] Testing API connection');
  
  try {
    await listFolder('', false);
    console.log('[Dropbox] Connection test successful');
    return true;
  } catch (error) {
    console.error('[Dropbox] Connection test failed:', error);
    return false;
  }
}

export default {
  isAuthenticated,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  initiateOAuth,
  handleOAuthCallback,
  listFolder,
  listFolderContinue,
  getAllFiles,
  filterAudioFiles,
  getTemporaryLink,
  downloadFile,
  testConnection
};
