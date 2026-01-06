Music Player PWA - Design Specification
Project Overview
A Progressive Web App that streams music from Dropbox with a polished, Spotify-inspired interface. Install to home screen, control from lock screen, manage playlists - all without touching the app store.
Technical Stack

Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3
Audio: Web Audio API for playback control
Lock Screen: Media Session API
Storage: IndexedDB for playlists and app state
Cloud: Dropbox API v2 for file access
Hosting: Netlify (or Vercel/GitHub Pages)

MVP Feature Set
1. Dropbox Integration

OAuth 2.0 authentication flow
Browse folder structure
Filter for audio files (.mp3, .m4a, .flac, .wav, .ogg)
Generate temporary streaming URLs
Cache library structure in IndexedDB

2. Music Library

Display all discovered audio files
Extract metadata using jsmediatags library:

Title, Artist, Album, Track Number
Embedded cover art


Three view modes:

Songs (flat list)
Artists (grouped)
Albums (grouped)


Basic search functionality

3. Playback Engine

Core controls: Play, Pause, Skip Forward, Skip Back
Seekable timeline with current/total time display
Volume control
Queue management (current track + up next)
Playback modes:

Normal (sequential)
Shuffle
Repeat Off/One/All


Gapless playback between tracks

4. Lock Screen Controls

Display current track metadata
Show album artwork
Enable play/pause/skip from:

Lock screen
Notification center
Control center
Bluetooth devices



5. Playlists

Create new playlists
Add/remove tracks
Reorder tracks (drag and drop)
Delete playlists
Play entire playlist
Store in IndexedDB

6. PWA Infrastructure

Manifest.json for installability
Service worker for offline manifest
Responsive design (mobile-first)
Full-screen mode when installed
App-like navigation (no browser chrome)

UI/UX Design
Color Scheme (Spotify-inspired)

Primary Background: #121212 (near black)
Secondary Background: #181818 (cards/sections)
Accent: #1DB954 (Spotify green)
Text Primary: #FFFFFF
Text Secondary: #B3B3B3
Error/Alert: #E22134

Layout Structure
Now Playing Screen (main view):

Large album artwork (centered, 80% screen width)
Track title (bold, 18px)
Artist name (14px, secondary color)
Playback timeline with scrubber
Control buttons row:

Shuffle (toggle)
Skip back
Play/Pause (large, primary)
Skip forward
Repeat (toggle)


Queue button (bottom right)
Volume slider (optional, can hide on mobile)

Library Screen:

Tab bar: Songs | Artists | Albums
Search bar (sticky at top)
Scrollable list/grid of items
Tap item → shows detail/plays

Playlist Screen:

List of created playlists
"Create New Playlist" button
Tap playlist → show tracks

Bottom Navigation Bar (persistent):

Now Playing (mini player when not in full view)
Library
Playlists

Gestures & Interactions

Tap album art → expand/collapse now playing
Swipe down on now playing → minimize to mini player
Long press track → add to playlist menu
Drag tracks in playlist → reorder

File Structure
music-player-pwa/
├── index.html
├── manifest.json
├── sw.js (service worker)
├── css/
│   ├── main.css
│   ├── player.css
│   ├── library.css
│   └── playlists.css
├── js/
│   ├── app.js (main entry point)
│   ├── dropbox.js (API integration)
│   ├── player.js (playback engine)
│   ├── library.js (file management)
│   ├── playlists.js (playlist CRUD)
│   ├── ui.js (DOM manipulation)
│   ├── storage.js (IndexedDB wrapper)
│   └── mediaSession.js (lock screen controls)
├── assets/
│   ├── icons/ (PWA icons: 192x192, 512x512)
│   └── placeholder-cover.png (fallback artwork)
└── lib/
    └── jsmediatags.min.js (metadata extraction)
Data Models
Track Object
javascript{
  id: string (unique hash of path),
  path: string (Dropbox path),
  filename: string,
  title: string,
  artist: string,
  album: string,
  trackNumber: number,
  duration: number (seconds),
  coverArt: string (base64 or null),
  dropboxUrl: string (temporary link, expires),
  urlExpiry: timestamp,
  addedDate: timestamp
}
Playlist Object
javascript{
  id: string (UUID),
  name: string,
  tracks: Array<trackId>,
  createdDate: timestamp,
  modifiedDate: timestamp
}
App State Object
javascript{
  currentTrack: trackId or null,
  queue: Array<trackId>,
  queuePosition: number,
  isPlaying: boolean,
  currentTime: number,
  volume: number (0-1),
  shuffleEnabled: boolean,
  repeatMode: 'off' | 'one' | 'all',
  lastView: 'player' | 'library' | 'playlists'
}
API Integration Details
Dropbox OAuth Flow

Redirect to Dropbox authorization URL with app key
User grants permission
Dropbox redirects back with access token
Store token in localStorage (encrypted if possible)
Use token for all subsequent API calls

Required Dropbox API Endpoints

/files/list_folder - Browse directories
/files/list_folder/continue - Pagination
/files/get_temporary_link - Get streaming URL (4 hour expiry)
/files/download - Download file content (for metadata)

Streaming Strategy

When track is selected:

Check if cached URL is still valid (< 3.5 hours old)
If expired, request new temporary link
Pass URL to Audio element
Preload next track in queue



IndexedDB Schema
Database Name: musicPlayerDB
Version: 1
Object Stores:

tracks

keyPath: id
Indexes: artist, album, title


playlists

keyPath: id


appState

keyPath: key
Single document store


cache

keyPath: key
For storing library scan results, URLs, etc.



Media Session API Implementation
javascript// When track starts playing
navigator.mediaSession.metadata = new MediaMetadata({
  title: track.title,
  artist: track.artist,
  album: track.album,
  artwork: [
    { src: track.coverArt, sizes: '512x512', type: 'image/png' }
  ]
});

// Register action handlers
navigator.mediaSession.setActionHandler('play', () => { /* resume */ });
navigator.mediaSession.setActionHandler('pause', () => { /* pause */ });
navigator.mediaSession.setActionHandler('previoustrack', () => { /* skip back */ });
navigator.mediaSession.setActionHandler('nexttrack', () => { /* skip forward */ });
navigator.mediaSession.setActionHandler('seekto', (details) => { /* seek */ });
Service Worker Strategy
Caching Strategy:

App Shell (HTML, CSS, JS): Cache-first
Audio files: Network-only (too large to cache)
Cover art: Cache-first with network fallback
API responses: Network-first with cache fallback

Offline Behavior:

Show cached library when offline
Disable playback if no internet (audio requires streaming)
Display "No connection" message

Manifest.json
json{
  "name": "My Music Player",
  "short_name": "Music",
  "description": "Stream your Dropbox music library",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#121212",
  "theme_color": "#1DB954",
  "icons": [
    {
      "src": "/assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
Performance Considerations

Lazy Load: Only fetch metadata for visible tracks
Virtual Scrolling: For large libraries (1000+ tracks)
Debounce Search: 300ms delay before filtering
Preload Next Track: Request URL when current track is 80% complete
Throttle Timeline Updates: Update position every 100ms, not per frame
Image Optimization: Scale down cover art to 512x512 max

Error Handling
Critical Errors (show modal):

Dropbox auth fails
Network completely unavailable
Audio playback error

Recoverable Errors (show toast):

Failed to load track (skip to next)
Metadata extraction fails (use filename)
Cover art missing (use placeholder)

Logging:

Console log all errors in development
Consider error reporting service for production (optional)

Security Considerations

OAuth Token: Store in localStorage, include expiry handling
HTTPS Required: PWA requires secure context
Content Security Policy: Restrict script sources
No Token in URL: Use POST/headers for API calls

Browser Compatibility
Primary Target: iOS Safari 15+ (your iPhone)
Secondary: Chrome Mobile, Firefox Mobile
Required APIs:

Web Audio API ✓ (universal support)
Media Session API ✓ (iOS 15+)
IndexedDB ✓ (universal)
Service Workers ✓ (iOS 11.3+)

Deployment
Netlify Setup

Connect GitHub repo
Build command: none (static files)
Publish directory: / (root)
Environment variables: DROPBOX_APP_KEY
HTTPS: Automatic
Deploy: Automatic on push to main

Dropbox App Setup

Create app at dropbox.com/developers
Choose "Scoped access"
Access type: "Full Dropbox" or "App folder"
Add redirect URI: https://your-app.netlify.app/callback
Copy App Key for environment variable

Testing Checklist

 Dropbox auth completes successfully
 Audio files discovered and listed
 Metadata extracted correctly
 Playback starts/stops on command
 Skip forward/back works
 Timeline seek works
 Volume control works
 Shuffle randomizes correctly
 Repeat modes function
 Lock screen controls respond
 Album art displays (both embedded and placeholder)
 Playlist creation works
 Track reordering in playlist works
 App installs to home screen
 Full-screen mode activates
 App resumes state after closing
 Search filters correctly
 Long library (100+ tracks) scrolls smoothly

Known Limitations (Document for User)

Internet Required: Streams from Dropbox, no offline playback in MVP
4-Hour Session: Dropbox URLs expire, app will refresh automatically
iOS Background: May pause after ~30 min of screen-off (iOS limitation)
No Equalizer: Web Audio API supports it, but out of scope for MVP
Single Device: State doesn't sync across devices (yet)

Future Enhancements (Post-MVP)

Offline caching of favorite tracks
Smart playlists (recently added, most played)
Lyrics display (if embedded in files)
Crossfade between tracks
Gapless playback improvements
Last.fm scrobbling
Multiple cloud providers (Google Drive, OneDrive)
Social features (share playlists)


Development Notes
Dropbox App Key Management

Store in .env file locally
Add .env to .gitignore
Set as Netlify environment variable
Access via process.env.DROPBOX_APP_KEY or build-time replacement

Audio Element vs Web Audio API

Start with <audio> element for simplicity
Provides built-in buffering, format support
Can enhance with Web Audio API later for:

Visualizations
Equalizer
Crossfade



Mobile-First Development

Test on actual device early and often
Chrome DevTools mobile emulation is helpful but not perfect
iOS Safari has quirks (audio autoplay, fullscreen behavior)

State Management

Keep it simple: vanilla JS with pub/sub pattern
No framework needed for MVP
Consider Vue/React only if complexity grows significantly


Success Criteria
MVP is complete when:

You can authenticate with Dropbox
Browse and play music from your library
Control playback from lock screen
Create and manage playlists
App is installed on your home screen
Experience feels smooth and responsive

It's working well when:

You actually use it instead of other players
Playback is reliable
UI feels intuitive
Performance is smooth even with large library

## Environment Variables

### Local Development (.env file)

Create a `.env` file in the project root:

```env
DROPBOX_APP_KEY=w6g3az21d8acv15
DROPBOX_REDIRECT_URI=http://localhost:8080/callback
```

**Important**: Add `.env` to your `.gitignore` file immediately:
```
.env
node_modules/
```

### Accessing Environment Variables in Code

Since this is a static PWA with no build step, you'll need to replace environment variables at runtime. Create a `config.js` file:

```javascript
// config.js
const config = {
  dropboxAppKey: 'w6g3az21d8acv15',
  redirectUri: window.location.hostname === 'localhost' 
    ? 'http://localhost:8080/callback'
    : `${window.location.origin}/callback`
};

export default config;
```

This automatically uses the correct redirect URI based on where the app is running.

## Deployment

### Vercel Setup
1. Connect GitHub repo to Vercel
2. Framework Preset: Other (static site)
3. Build Command: leave empty (no build needed)
4. Output Directory: `.` (root)
5. Install Command: leave empty
6. Environment Variables:
   - Key: `DROPBOX_APP_KEY`
   - Value: `w6g3az21d8acv15`
7. HTTPS: Automatic
8. Deploy: Automatic on push to main branch

### Dropbox App Setup
1. Create app at dropbox.com/developers ✓ (Already done)
2. Choose "Scoped access" ✓
3. Access type: "Full Dropbox" or "App folder" ✓
4. **Permissions tab**: Enable these scopes:
   - `files.metadata.read` (required)
   - `files.content.read` (required)
   - `files.content.write` (optional, for future features)
5. **Settings tab** - Add redirect URIs:
   - `http://localhost:8080/callback` ✓ (Already added)
   - `https://your-project-name.vercel.app/callback` (add after first deploy)
6. **Settings tab** - Ensure "Allow public clients (Implicit Grant & PKCE)" is set to "Allow" ✓
7. Copy App Key: `w6g3az21d8acv15` ✓

### Post-Deploy Steps
1. Note your Vercel URL (e.g., `your-project.vercel.app`)
2. Go back to Dropbox app settings
3. Add production redirect URI: `https://your-project.vercel.app/callback`
4. Test OAuth flow on production URL