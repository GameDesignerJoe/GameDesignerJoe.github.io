# Music Player PWA - Complete Technical Documentation

## Project Overview

A Progressive Web App that streams music from cloud storage (currently Dropbox) with a polished, Spotify-inspired interface. The app features lock screen controls, playlist management, and a sophisticated Sources management system for organizing your music library.

**Current Status:** ~90% Complete MVP - Fully functional with some UI/UX polish remaining

**Target Platform:** Mobile-first (iOS Safari primary), works on desktop

**Deployment:** Vercel (Production-ready)

---

## Technical Stack

- **Frontend:** Vanilla JavaScript (ES6+ Modules), HTML5, CSS3
- **Audio:** HTML5 Audio API with Media Session API for lock screen controls
- **Storage:** IndexedDB for offline persistence (tracks, playlists, settings, selected folders)
- **Cloud:** Dropbox API v2 with OAuth 2.0 PKCE authentication
- **Hosting:** Vercel with automatic deployments
- **PWA:** Service Worker, Web App Manifest, installable

---

## Architecture Overview

### Modular Design

The application follows a clean modular architecture with clear separation of concerns:

```
personal-music-player/
├── index.html                 # Single-page app entry point
├── manifest.json             # PWA manifest
├── sw.js                     # Service worker
├── config.js                 # Environment configuration
├── css/
│   ├── main.css             # Global styles, theme, utilities
│   ├── player.css           # Player UI (mini + full screen)
│   ├── library.css          # Library views (songs/artists/albums)
│   ├── playlists.css        # Playlist management UI
│   ├── sources.css          # Sources management screen
│   └── modals.css           # Modal dialogs and overlays
├── js/
│   ├── app.js               # Main entry point, initialization
│   ├── player.js            # Audio playback engine
│   ├── queue.js             # Queue management, shuffle, repeat
│   ├── library.js           # Library views and search
│   ├── playlists.js         # Playlist CRUD operations
│   ├── sources.js           # Sources screen management
│   ├── folder-browser.js    # Dropbox folder navigation
│   ├── scanner.js           # Audio file scanning
│   ├── dropbox.js           # Dropbox API integration
│   ├── storage.js           # IndexedDB wrapper
│   └── media-session.js     # Lock screen controls
├── assets/
│   └── icons/               # App icons and placeholders
└── docs/
    ├── music-player.md      # This file
    ├── music-played-milestone_plan.md  # Development roadmap
    └── todo.md              # Current tasks and issues
```

### Module Responsibilities

**app.js** - Application bootstrap and coordination
- Service worker registration
- Authentication state management
- Screen navigation
- Event listener setup
- Toast notifications
- Module initialization

**player.js** - Core audio playback
- HTML5 Audio element management
- Play/pause/seek/volume controls
- Timeline updates
- Media Session API integration
- Dropbox temporary link handling

**queue.js** - Playback queue management
- Track queue array and position
- Skip forward/backward logic
- Shuffle algorithm (Fisher-Yates)
- Repeat modes (off/all/one)
- Auto-advance on track end
- Queue UI updates

**library.js** - Music library display
- Three view modes: Songs, Artists, Albums
- Real-time search filtering
- Track grouping and sorting
- Play track with queue context
- Integration with playlists

**playlists.js** - Playlist management
- Create, rename, delete playlists
- Add/remove tracks
- Play entire playlist
- Playlist detail modal
- Context menus

**sources.js** - Sources management (NEW major feature)
- Cloud provider connection management
- Folder browser interface
- Folder selection/deselection
- Breadcrumb navigation
- Real-time count updates
- Auto-scanning on changes

**dropbox.js** - Dropbox API client
- OAuth 2.0 PKCE authentication
- Folder listing (recursive/non-recursive)
- File metadata retrieval
- Temporary link generation (4-hour expiry)
- Connection testing

**storage.js** - IndexedDB persistence
- Database initialization and versioning
- Track CRUD operations
- Playlist storage
- Selected folders persistence
- Settings storage

**media-session.js** - Lock screen integration
- Media Session API setup
- Metadata updates (title, artist, album, artwork)
- Action handlers (play, pause, next, previous, seek)
- Position state updates

---

## Key Features & Implementation

### 1. Sources Management System

**What it is:**
A dedicated screen for managing music sources with visual cloud provider icons. Currently supports Dropbox with infrastructure for future providers (Google Drive, OneDrive, Plex, etc.).

**Implementation:**
```javascript
// sources.js handles:
- Folder browsing with breadcrumb navigation
- Visual selection indicators (+ buttons, checkmarks)
- Real-time folder/song counts
- Automatic library scanning on folder changes
- Parent/child folder relationship handling
```

**User Flow:**
1. Navigate to Sources tab (🌐)
2. Select Dropbox (active by default when authenticated)
3. Browse folder tree with breadcrumbs
4. Click + to add folders to library
5. See checkmarks on selected folders
6. Auto-scan triggers and updates library
7. View updated song count in Sources panel

**Technical Details:**
- Stores selected folder paths in IndexedDB (`folders` store)
- Handles nested folder selections intelligently
- Visual indicators: `selected`, `has-selected` classes
- Prevents duplicate selections
- Cascading selection logic (parent folders include children)

### 2. Audio Playback System

**Playback Flow:**
```
User clicks track → Library calls queue.playTrackWithQueue() →
Queue sets up track array → Calls player.playTrack() →
Player requests Dropbox temp link → Loads audio URL →
Playback starts → Media Session updates → UI updates
```

**Features:**
- **Streaming:** Direct from Dropbox via temporary links (4-hour expiry)
- **Timeline:** Seekable progress bar with time display
- **Volume:** 0-100% slider control
- **UI States:** Mini player (bottom) + Full player (modal)
- **Auto-advance:** Automatic next track when current ends

**Technical Details:**
```javascript
// player.js uses HTML5 Audio element
const audio = new Audio();
audio.src = dropboxTemporaryLink;
audio.addEventListener('timeupdate', updateTimeline);
audio.addEventListener('ended', onTrackEnded);
```

### 3. Queue System

**Queue Features:**
- **Dynamic queue:** Tracks added when playing from library/playlist
- **Current position tracking:** Visual indicator (▶) on active track
- **Manual manipulation:** Remove tracks, jump to any track
- **Clear queue:** Keeps currently playing track
- **History:** Previous track navigation

**Shuffle Implementation:**
```javascript
// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
```

**Repeat Modes:**
- **Off:** Stop at end of queue
- **All:** Loop back to start after last track
- **One:** Replay current track indefinitely

**Skip Logic:**
- **Skip Forward:** Next track (or loop if repeat all)
- **Skip Back:** Restart if >3 seconds, previous if <3 seconds

### 4. Library Organization

**Three View Modes:**

**Songs View:**
- Flat list of all tracks
- Alphabetically sorted with natural sorting (1, 2, 10 not 1, 10, 2)
- Search filters in real-time
- Click to play with full library as queue

**Artists View:**
- Grouped by artist name
- Expandable sections
- Track count per artist
- "Unknown Artist" for missing metadata

**Albums View:**
- Grouped by album name
- Shows artist and track count
- "Play All" button per album
- Placeholder album art

**Search Implementation:**
```javascript
// Real-time filtering across metadata
function getFilteredTracks() {
  return allTracks.filter(track => {
    const title = (track.title || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();
    const album = (track.album || '').toLowerCase();
    return title.includes(query) || 
           artist.includes(query) || 
           album.includes(query);
  });
}
```

### 5. Playlist Management

**Playlist Features:**
- **Create:** Custom name via prompt
- **Add tracks:** Context menu (⋮) on any track
- **View:** Click playlist card to see contents
- **Play:** Play All or start from specific track
- **Edit:** Rename via playlist menu
- **Delete:** With confirmation dialog
- **Persistence:** Stored in IndexedDB

**Data Structure:**
```javascript
{
  id: number,              // Auto-increment
  name: string,           // User-defined
  tracks: [               // Array of track references
    { id: trackId, addedAt: timestamp }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Context Menu System:**
- Dynamic positioning near trigger button
- "Add to Playlist" shows all playlists
- "+ Create New Playlist" inline option
- Click-outside-to-close behavior

### 6. Lock Screen Controls

**Media Session API Integration:**
```javascript
navigator.mediaSession.metadata = new MediaMetadata({
  title: track.title,
  artist: track.artist,
  album: track.album,
  artwork: [{ src: iconUrl, sizes: '512x512' }]
});

navigator.mediaSession.setActionHandler('play', handlePlay);
navigator.mediaSession.setActionHandler('pause', handlePause);
navigator.mediaSession.setActionHandler('nexttrack', skipNext);
navigator.mediaSession.setActionHandler('previoustrack', skipPrev);
navigator.mediaSession.setActionHandler('seekto', handleSeek);
```

**Features:**
- Track metadata on lock screen
- Album artwork (currently placeholder icons)
- Play/pause/skip controls
- Seekable timeline
- Works with Bluetooth devices
- Notification center integration

### 7. PWA Capabilities

**Manifest Configuration:**
```json
{
  "name": "My Playback",
  "short_name": "Music",
  "display": "standalone",
  "theme_color": "#1DB954",
  "background_color": "#121212",
  "start_url": "/",
  "orientation": "portrait"
}
```

**Service Worker:**
- Registers on app load
- Basic caching strategy
- Cache app shell (HTML, CSS, JS)
- Network-first for API calls

**Installation:**
- Add to home screen prompt (iOS Safari)
- Standalone mode when installed
- No browser chrome
- Full-screen experience

---

## Data Models

### Track Object
```javascript
{
  id: string,              // Unique hash of path
  path: string,           // Dropbox file path
  filename: string,       // Original filename
  title: string,          // Extracted or from filename
  artist: string,         // Extracted or "Unknown Artist"
  album: string,          // Extracted or "Unknown Album"
  duration: number,       // Seconds (if available)
  addedDate: timestamp,   // When added to library
  sourceFolder: string    // Parent folder path
}
```

### Playlist Object
```javascript
{
  id: number,             // Auto-increment primary key
  name: string,           // User-defined name
  tracks: [
    {
      id: string,         // Reference to track.id
      addedAt: timestamp  // When added to playlist
    }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Selected Folder Object
```javascript
{
  path: string,           // Dropbox folder path (primary key)
  addedAt: timestamp      // When folder was selected
}
```

---

## IndexedDB Schema

**Database:** `MusicPlayerDB` (Version 1)

### Object Stores:

**tracks**
- KeyPath: `id`
- Indexes: `title`, `artist`, `album`, `path` (unique)
- Purpose: All scanned audio files

**folders**
- KeyPath: `path`
- Purpose: User-selected music folders

**playlists**
- KeyPath: `id` (auto-increment)
- Purpose: User-created playlists

**settings**
- KeyPath: `key`
- Purpose: App configuration and preferences

### Storage Operations:

```javascript
// Example: Get all tracks
export async function getAllTracks() {
  const transaction = db.transaction(['tracks'], 'readonly');
  const store = transaction.objectStore('tracks');
  return await store.getAll();
}

// Example: Save playlist
export async function savePlaylist(playlist) {
  const transaction = db.transaction(['playlists'], 'readwrite');
  const store = transaction.objectStore('playlists');
  return await store.put(playlist);
}
```

---

## Dropbox API Integration

### OAuth 2.0 PKCE Flow

```javascript
// 1. Generate code verifier and challenge
const codeVerifier = generateRandomString(128);
const codeChallenge = await sha256(codeVerifier);

// 2. Redirect to Dropbox authorization
const authUrl = `https://www.dropbox.com/oauth2/authorize?
  client_id=${appKey}&
  response_type=code&
  code_challenge=${codeChallenge}&
  code_challenge_method=S256&
  redirect_uri=${redirectUri}`;

// 3. Handle callback with authorization code
const code = getCodeFromURL();
const token = await exchangeCodeForToken(code, codeVerifier);

// 4. Store token in localStorage
localStorage.setItem('dropbox_access_token', token);
```

### Key API Endpoints Used:

**List Folder:**
```javascript
POST https://api.dropboxapi.com/2/files/list_folder
Body: { path: "/Music", recursive: false }
Returns: { entries: [...folders and files] }
```

**Get Temporary Link:**
```javascript
POST https://api.dropboxapi.com/2/files/get_temporary_link
Body: { path: "/Music/song.mp3" }
Returns: { link: "https://...", expires: "2024-..." }
Note: Links expire after 4 hours
```

**Test Connection:**
```javascript
POST https://api.dropboxapi.com/2/users/get_current_account
Returns: User account info or error
```

### Temporary Link Management:

- Links valid for 4 hours
- Requested fresh for each track play
- No caching of audio URLs
- Automatic re-authentication on 401 errors

---

## UI/UX Design

### Color Scheme (Spotify-Inspired)

```css
:root {
  --bg-primary: #121212;      /* Near black */
  --bg-secondary: #181818;    /* Card backgrounds */
  --bg-tertiary: #282828;     /* Hover states */
  --accent: #1DB954;          /* Spotify green */
  --text-primary: #FFFFFF;    /* Main text */
  --text-secondary: #B3B3B3;  /* Secondary text */
  --text-muted: #6a6a6a;      /* Disabled/muted */
  --error: #E22134;           /* Error states */
}
```

### Layout Structure

**Screen Hierarchy:**
1. **Auth Screen** - Dropbox connection prompt
2. **Library Screen** - Main music browsing (default after auth)
3. **Playlists Screen** - Playlist management
4. **Sources Screen** - Folder/source management
5. **Queue Screen** - Current queue view
6. **Player Screen** - Full-screen now playing (modal)

**Persistent UI Elements:**
- **Header:** App title + action buttons (refresh, disconnect)
- **Mini Player:** Bottom bar when music playing
- **Bottom Nav:** Library | Playlists | Sources (3 tabs)

### Interaction Patterns

**Navigation:**
- Bottom nav tabs switch main screens
- Back buttons (←) close modals/detail views
- Breadcrumbs in folder browser

**Playback Control:**
- Click track → Play immediately with queue
- Click mini player → Expand to full player
- Timeline drag/click → Seek to position

**Context Menus:**
- ⋮ button on tracks → Add to playlist
- ⋮ button on playlists → Rename/delete
- Position dynamically near trigger

**Toast Notifications:**
- Success (green): Actions completed
- Info (blue): Informational messages
- Error (red): Failed operations
- Auto-dismiss after 3 seconds

---

## State Management

### Application State (app.js)

```javascript
const appState = {
  isAuthenticated: boolean,
  currentScreen: string,      // 'auth', 'library', 'playlists', 'sources', 'queue'
  accessToken: string | null
};
```

### Player State (player.js)

```javascript
const playerState = {
  audio: Audio | null,
  currentTrack: Track | null,
  isPlaying: boolean,
  volume: number,             // 0.0 - 1.0
  duration: number,           // Total seconds
  currentTime: number         // Current position seconds
};
```

### Queue State (queue.js)

```javascript
const queueState = {
  tracks: Track[],            // All tracks in queue
  currentIndex: number,       // Currently playing index
  history: Track[],           // Previously played
  shuffled: boolean,
  repeatMode: 'off' | 'all' | 'one',
  originalOrder: Track[]      // Pre-shuffle order
};
```

### Persistence Strategy

**localStorage:**
- `dropbox_access_token` - OAuth token
- `player_shuffle` - Shuffle preference
- `player_repeat` - Repeat mode preference

**IndexedDB:**
- All tracks (scanned from folders)
- All playlists with track references
- Selected folder paths
- App settings

**Session-only:**
- Current queue (rebuilds on play)
- Player state (current time, volume restored from defaults)

---

## Error Handling

### Error Categories

**Network Errors:**
- Dropbox API failures
- Connection timeouts
- 401 Unauthorized (expired token)

**Playback Errors:**
- Audio loading failures
- Temporary link expiration
- Unsupported audio format

**Data Errors:**
- IndexedDB failures
- Corrupted track metadata
- Missing playlist tracks

### Error Handling Strategy

```javascript
// User-friendly toast notifications
try {
  await dropbox.listFolder(path);
} catch (error) {
  console.error('[Module] Error:', error);
  showToast('Failed to load folders. Please try again.', 'error');
  
  // Handle specific cases
  if (error.status === 401) {
    // Expired token - redirect to re-auth
    disconnect(false);
  }
}
```

### Logging Convention

All modules use consistent logging:
```javascript
console.log('[ModuleName] Action description');
console.error('[ModuleName] Error description:', error);
```

---

## Performance Optimizations

### Current Optimizations

1. **Lazy Loading:** Tracks loaded from IndexedDB only when needed
2. **Debounced Search:** 300ms delay before filtering (via input event)
3. **Efficient Sorting:** Natural sort algorithm for better UX
4. **Minimal Re-renders:** Update only changed DOM elements
5. **Indexed Queries:** IndexedDB indexes on artist, album, title

### Potential Optimizations (Not Yet Implemented)

- **Virtual Scrolling:** For libraries >1000 tracks
- **Image Lazy Loading:** Album artwork when implemented
- **Service Worker Caching:** Smarter caching strategy
- **Preload Next Track:** Request link when current track 80% complete
- **Web Audio API:** For advanced features (equalizer, crossfade)

---

## Testing & Quality Assurance

### Manual Testing Checklist

**Authentication Flow:**
- [x] Connect to Dropbox works
- [x] Callback URL handling
- [x] Token persistence
- [x] Auto-login on refresh
- [x] Disconnect clears state

**Sources & Library:**
- [x] Browse folders
- [x] Select/deselect folders
- [x] Scan and populate library
- [x] Search filtering
- [x] View mode switching

**Playback:**
- [x] Play track
- [x] Pause/resume
- [x] Skip forward/back
- [x] Seek timeline
- [x] Volume control
- [x] Auto-advance

**Queue:**
- [x] Add to queue
- [x] Remove from queue
- [x] Jump to track
- [x] Clear queue
- [x] Shuffle mode
- [x] Repeat modes

**Playlists:**
- [x] Create playlist
- [x] Add tracks
- [x] Remove tracks
- [x] Play playlist
- [x] Rename
- [x] Delete

**Lock Screen:**
- [x] Metadata displays
- [x] Play/pause works
- [x] Skip controls
- [x] Seek works

### Known Issues (from todo.md)

- Folder UI/UX needs improvement
- Mini player has limited controls
- Stacked alert notifications
- Plus button alignment
- Missing abstract placeholders
- No total song count display
- File path display would be nice
- Consider home page

---

## Deployment

### Vercel Configuration

**vercel.json:**
```json
{
  "buildCommand": null,
  "outputDirectory": ".",
  "framework": null
}
```

**Environment:**
- Static file hosting
- Automatic HTTPS
- Deploy on git push
- No build step required

### Dropbox App Configuration

1. App Key: `w6g3az21d8acv15`
2. Redirect URIs:
   - `http://localhost:8080/callback` (development)
   - `https://[your-app].vercel.app/callback` (production)
3. Permissions: `files.metadata.read`, `files.content.read`
4. Allow implicit grant: Yes (for PKCE)

### config.js Setup

```javascript
const config = {
  dropboxAppKey: 'w6g3az21d8acv15',
  redirectUri: window.location.hostname === 'localhost' 
    ? 'http://localhost:8080/callback'
    : `${window.location.origin}/callback`
};
```

---

## Future Enhancements

### High Priority
1. **Album Artwork Extraction** - jsmediatags for embedded cover art
2. **Mini Player Enhancement** - Add skip/shuffle/repeat controls
3. **UI Polish** - Address items in todo.md
4. **PWA Optimization** - Better install prompt, offline handling

### Medium Priority
5. **Google Drive Support** - Second cloud provider
6. **Offline Caching** - Save favorite tracks locally
7. **Smart Playlists** - Recently added, most played, etc.
8. **Better Icons** - Custom app icons (not placeholders)

### Low Priority
9. **Equalizer** - Web Audio API controls
10. **Crossfade** - Smooth track transitions
11. **Lyrics** - Display if embedded in files
12. **Statistics** - Listening history and insights
13. **Social Features** - Share playlists
14. **Multi-device Sync** - State across devices

---

## Development Guidelines for AI Agents

### Code Style

**ES6+ Modules:**
```javascript
// Always use import/export
import * as storage from './storage.js';
export async function init() { }
```

**Async/Await:**
```javascript
// Prefer async/await over promises
async function loadTracks() {
  const tracks = await storage.getAllTracks();
  return tracks;
}
```

**Error Handling:**
```javascript
try {
  await riskyOperation();
} catch (error) {
  console.error('[Module] Error:', error);
  showToast('User-friendly message', 'error');
}
```

**Logging:**
```javascript
console.log('[Module] Action started');
console.error('[Module] Error:', error);
```

### Module Pattern

Each module follows this structure:
```javascript
// Module state (private)
const moduleState = { };

// Initialize function
export async function init() {
  console.log('[Module] Initializing');
  // Setup code
}

// Public API functions
export async function publicFunction() { }

// Private helper functions
function privateHelper() { }
```

### UI Update Pattern

```javascript
// 1. Update data/state
moduleState.currentValue = newValue;

// 2. Update storage if needed
await storage.saveSetting('key', newValue);

// 3. Update UI
updateUI();

// 4. Notify user
showToast('Action completed', 'success');
```

### Adding New Features

1. **Plan:** Consider existing patterns
2. **Module:** Create/update appropriate module
3. **UI:** Add HTML structure if needed
4. **CSS:** Add styles to relevant CSS file
5. **Integration:** Wire up in app.js if needed
6. **Test:** Manual testing on desktop and mobile
7. **Document:** Update this file and todo.md

---

## Troubleshooting

### Common Issues

**"Failed to load folders"**
- Check Dropbox connection
- Verify OAuth token valid
- Check network connectivity
- See console for detailed error

**"Playback failed"**
- Temporary link may have expired
- Try playing again
- Check audio file format
- Verify Dropbox access

**"Authentication expired"**
- Token expired (need to reconnect)
- App will auto-redirect to auth
- Click "Connect to Dropbox" again

**"Queue is empty"**
- No tracks added to queue
- Play a track from library to start
- Check that library has tracks

**"No tracks found"**
- No folders selected in Sources
- Go to Sources tab and select folders
- Wait for scan to complete

### Debug Mode

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
// Reload page
```

Check IndexedDB:
```javascript
// In browser console
// Chrome DevTools > Application > IndexedDB > MusicPlayerDB
```

---

## Conclusion

This music player PWA represents a well-architected, functional MVP with ~90% feature completion. The modular design makes it easy to extend and maintain. The Sources management system provides a solid foundation for multi-cloud support. Core playback, queue, and playlist features work reliably.

**Next Steps:**
1. Address UI/UX items in todo.md
2. Implement album artwork extraction
3. Enhance PWA capabilities
4. Consider Google Drive integration

The app is production-ready and actively deployable, with a clear path for future enhancements.

---

**Document Version:** 2.0  
**Last Updated:** January 7, 2026  
**Project Status:** 90% Complete MVP  
**Deployment:** Live on Vercel
