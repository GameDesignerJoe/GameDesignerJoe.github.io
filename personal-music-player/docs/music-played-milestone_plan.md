# Music Player PWA - Milestone Plan

## Overview
This milestone plan breaks the MVP into manageable chunks with clear verification steps. Complete each milestone in order, testing thoroughly before moving to the next.

---

## Milestone 1: Project Setup & Basic Structure
**Goal**: Get the foundational files and structure in place

### Tasks
1. Create project directory structure:
   ```
   music-player-pwa/
   ├── index.html
   ├── manifest.json
   ├── sw.js
   ├── .gitignore
   ├── config.js
   ├── css/
   │   └── main.css
   ├── js/
   │   └── app.js
   ├── assets/
   │   └── icons/
   └── lib/
   ```

2. Create `.gitignore`:
   ```
   .env
   node_modules/
   .DS_Store
   ```

3. Create `config.js` with Dropbox app key and redirect URI logic

4. Create basic `index.html` with:
   - Proper meta tags (viewport, theme-color)
   - Link to manifest.json
   - Link to CSS and JS files
   - Basic HTML structure (header, main, footer)

5. Create `manifest.json` with:
   - App name, short name, description
   - Start URL, display mode (standalone)
   - Theme colors matching Spotify aesthetic
   - Icon placeholders (can use simple colored squares for now)

6. Create placeholder icon images (192x192 and 512x512)

7. Create basic `sw.js` service worker:
   - Install event with cache creation
   - Activate event
   - Fetch event with basic caching strategy

8. Create `css/main.css` with:
   - CSS reset/normalize
   - Root color variables (Spotify theme)
   - Basic typography
   - Mobile-first responsive base styles

9. Initialize `js/app.js` with:
   - Service worker registration
   - Basic console log to verify loading

### Verification Checklist
- [ ] Project structure matches specification
- [ ] `.gitignore` is in place
- [ ] Opening `index.html` in browser shows basic page
- [ ] Console shows service worker registered (may need local server)
- [ ] No console errors
- [ ] manifest.json is valid (check with Chrome DevTools > Application > Manifest)

### Estimated Time
1-2 hours

---

## Milestone 2: Dropbox Authentication
**Goal**: Successfully authenticate with Dropbox and store access token

### Tasks
1. Create `js/dropbox.js` module:
   - Export function to initiate OAuth flow
   - Export function to handle OAuth callback
   - Export function to check if authenticated
   - Export function to get stored access token
   - Export function to clear token (logout)

2. Implement OAuth PKCE flow:
   - Generate code verifier and code challenge
   - Build authorization URL with proper parameters
   - Redirect to Dropbox authorization page

3. Create callback handler:
   - Parse URL hash for access token
   - Validate token
   - Store in localStorage
   - Redirect to main app

4. Add authentication UI to `index.html`:
   - "Connect to Dropbox" button (shown when not authenticated)
   - "Disconnect" button (shown when authenticated)
   - Loading state during auth

5. Update `js/app.js`:
   - Import dropbox module
   - Check authentication status on load
   - Handle auth button clicks
   - Handle callback URL

6. Add basic CSS styling for auth buttons

### Verification Checklist
- [ ] Clicking "Connect to Dropbox" redirects to Dropbox
- [ ] After authorizing, redirects back to app
- [ ] Access token is stored in localStorage
- [ ] Page shows authenticated state
- [ ] Refreshing page maintains authenticated state
- [ ] "Disconnect" button clears token and returns to login state
- [ ] No console errors during flow

### Estimated Time
2-3 hours

---

## Milestone 3: Browse Dropbox & List Audio Files
**Goal**: Scan Dropbox for audio files and display them

### Tasks
1. Expand `js/dropbox.js`:
   - Add function to list folder contents
   - Add function to recursively scan for audio files
   - Add function to get temporary download link
   - Filter for audio extensions (.mp3, .m4a, .flac, .wav, .ogg)

2. Create `js/storage.js` for IndexedDB:
   - Initialize database with 'tracks' object store
   - Export functions: addTrack, getTrack, getAllTracks, clearTracks
   - Export functions: saveAppState, getAppState

3. Create `js/library.js`:
   - Import dropbox and storage modules
   - Function to scan Dropbox for audio files
   - Function to save discovered tracks to IndexedDB
   - Function to load tracks from IndexedDB
   - Generate unique track IDs from file paths

4. Add library scan UI:
   - "Scan Library" button (shown after authentication)
   - Loading indicator during scan
   - Progress display (e.g., "Found 47 tracks...")
   - Simple list view of discovered tracks

5. Create `css/library.css`:
   - Styles for track list
   - Loading states
   - Empty state ("No tracks found")

6. Update `js/app.js`:
   - Trigger library scan after authentication
   - Display tracks in simple list
   - Handle loading and error states

### Verification Checklist
- [ ] After authentication, can trigger library scan
- [ ] Scan discovers audio files in Dropbox
- [ ] Tracks are saved to IndexedDB
- [ ] Track list displays with filenames
- [ ] Refreshing page loads tracks from IndexedDB (no re-scan needed)
- [ ] Can see count of total tracks found
- [ ] Loading indicator shows during scan
- [ ] No console errors

### Estimated Time
3-4 hours

---

## Milestone 4: Basic Audio Playback
**Goal**: Play audio files from Dropbox

### Tasks
1. Create `js/player.js` module:
   - Create Audio element
   - Export functions: play, pause, stop, seek, setVolume
   - Export function to load track (gets Dropbox URL)
   - Emit events: playing, paused, ended, timeupdate, error
   - Handle track loading (request temporary link from Dropbox)

2. Add metadata extraction:
   - Include jsmediatags library (download to `lib/` folder)
   - Create function to extract ID3 tags from audio file
   - Update track objects with: title, artist, album, cover art
   - Store updated metadata in IndexedDB

3. Create basic player UI in `index.html`:
   - Currently playing track info (title, artist)
   - Play/Pause button
   - Skip forward/back buttons (disabled for now)
   - Timeline/progress bar with current/total time
   - Volume slider

4. Create `css/player.css`:
   - Player container styling
   - Button styles (Spotify-inspired)
   - Timeline/scrubber styles
   - Responsive layout

5. Update `js/app.js`:
   - Wire up player UI to player module
   - Handle track selection from library list
   - Update UI based on player events
   - Handle play/pause button
   - Handle timeline seeking
   - Handle volume changes

6. Add "Play" button next to each track in library list

### Verification Checklist
- [ ] Clicking a track starts playback
- [ ] Audio plays from Dropbox
- [ ] Play/Pause button works
- [ ] Timeline shows current position and total duration
- [ ] Can seek by clicking timeline
- [ ] Volume slider controls volume
- [ ] Track info displays (title, artist)
- [ ] If metadata missing, shows filename
- [ ] Playback continues when changing tabs
- [ ] No audio glitches or stuttering
- [ ] Console shows no errors

### Estimated Time
3-4 hours

---

## Milestone 5: Queue Management & Skip Controls
**Goal**: Implement queue system with skip forward/back

### Tasks
1. Expand `js/player.js`:
   - Add queue array
   - Add current queue position tracking
   - Export functions: addToQueue, setQueue, skipNext, skipPrevious
   - Auto-advance to next track when current ends
   - Handle queue end (stop or loop based on repeat mode)

2. Create queue UI:
   - "Up Next" section showing queue
   - Display 5-10 upcoming tracks
   - "Clear Queue" button
   - Drag-to-reorder (can be simplified for MVP)

3. Update skip buttons:
   - Enable skip forward (plays next in queue)
   - Enable skip back (restarts current or plays previous)
   - Handle skip back logic: if >3 seconds, restart; if <3 seconds, go to previous

4. Add queue context menu:
   - "Play Next" option when clicking track
   - "Add to Queue" option
   - Update library list with these options

5. Save queue state:
   - Store current queue in IndexedDB
   - Store current position
   - Restore queue on app reload

### Verification Checklist
- [ ] Can add tracks to queue
- [ ] Queue displays upcoming tracks
- [ ] Skip forward plays next track
- [ ] Skip back restarts or goes to previous (based on position)
- [ ] When track ends, automatically plays next
- [ ] Queue persists after page reload
- [ ] Can clear entire queue
- [ ] "Play Next" adds to front of queue
- [ ] "Add to Queue" adds to end of queue

### Estimated Time
2-3 hours

---

## Milestone 6: Playback Modes (Shuffle & Repeat)
**Goal**: Implement shuffle and repeat functionality

### Tasks
1. Expand `js/player.js`:
   - Add shuffle state (boolean)
   - Add repeat mode state ('off', 'one', 'all')
   - Export functions: toggleShuffle, cycleRepeatMode
   - Implement shuffle logic (randomize queue, don't repeat until all played)
   - Implement repeat logic:
     - 'off': stop at end of queue
     - 'one': replay current track infinitely
     - 'all': loop back to start of queue

2. Add UI controls:
   - Shuffle button (toggle on/off with visual indicator)
   - Repeat button (cycles through off/one/all with icons)
   - Visual states for each mode

3. Update queue behavior:
   - When shuffle enabled, create shuffled copy of queue
   - When shuffle disabled, restore original order
   - Preserve current track position during shuffle toggle

4. Save playback mode state:
   - Store shuffle and repeat preferences
   - Restore on app reload

### Verification Checklist
- [ ] Shuffle button toggles shuffle mode
- [ ] When shuffled, tracks play in random order
- [ ] Shuffle doesn't repeat tracks until all have played
- [ ] Turning shuffle off restores original queue order
- [ ] Repeat button cycles through: off → one → all → off
- [ ] Repeat One: replays current track continuously
- [ ] Repeat All: loops back to start of queue after last track
- [ ] Repeat Off: stops at end of queue
- [ ] Modes persist after page reload
- [ ] Visual indicators clearly show current mode

### Estimated Time
2-3 hours

---

## Milestone 7: Lock Screen Controls (Media Session API)
**Goal**: Enable playback control from lock screen

### Tasks
1. Create `js/mediaSession.js` module:
   - Import player module
   - Function to update Media Session metadata
   - Register action handlers: play, pause, previoustrack, nexttrack, seekto
   - Update metadata when track changes

2. Integrate with player:
   - Call updateMetadata when new track loads
   - Update position state periodically
   - Handle artwork (convert base64 to blob URL if needed)
   - Fallback to placeholder artwork if none available

3. Test on mobile device:
   - Lock screen display
   - Notification controls
   - Control center integration
   - Bluetooth device controls (if available)

4. Handle edge cases:
   - Clear metadata when stopped
   - Update playback state accurately
   - Handle seek requests from media session

### Verification Checklist
- [ ] Track info appears on lock screen
- [ ] Album artwork displays on lock screen
- [ ] Play button works from lock screen
- [ ] Pause button works from lock screen
- [ ] Skip forward works from lock screen
- [ ] Skip back works from lock screen
- [ ] Timeline/position updates on lock screen
- [ ] Controls work from notification center
- [ ] Controls work from control center
- [ ] Bluetooth controls work (if device available)
- [ ] Metadata updates when track changes

### Estimated Time
2-3 hours

---

## Milestone 8: Library Views & Search
**Goal**: Organize library and add search functionality

### Tasks
1. Expand `js/library.js`:
   - Function to group tracks by artist
   - Function to group tracks by album
   - Function to search tracks (title, artist, album)
   - Sort functions (alphabetical, recently added)

2. Create library view UI:
   - Tab bar: Songs | Artists | Albums
   - Switch between views
   - Songs: flat list of all tracks
   - Artists: grouped by artist, expandable
   - Albums: grid or list of albums with cover art

3. Add search functionality:
   - Search bar (sticky at top)
   - Filter as user types
   - Search across title, artist, album
   - Clear search button
   - Show "No results" when empty

4. Update `css/library.css`:
   - Tab bar styles
   - List/grid view styles
   - Grouped list styles (expandable sections)
   - Search bar styles
   - Album grid styles

5. Handle track selection:
   - Clicking track starts playback
   - Option to "Play All" for artist/album
   - Option to "Add All to Queue"

### Verification Checklist
- [ ] Can switch between Songs/Artists/Albums views
- [ ] Songs view shows all tracks in a flat list
- [ ] Artists view groups tracks by artist
- [ ] Albums view shows albums (with cover art if available)
- [ ] Can expand/collapse artist/album groups
- [ ] Search filters results as typing
- [ ] Search works across all metadata fields
- [ ] Clear search button resets results
- [ ] Can play individual track or entire group
- [ ] Views are responsive on mobile
- [ ] Smooth transitions between views

### Estimated Time
3-4 hours

---

## Milestone 9: Playlist Management
**Goal**: Create, edit, and play playlists

### Tasks
1. Expand `js/storage.js`:
   - Add 'playlists' object store to IndexedDB
   - Functions: addPlaylist, getPlaylist, getAllPlaylists, updatePlaylist, deletePlaylist

2. Create `js/playlists.js` module:
   - Function to create new playlist
   - Function to add track to playlist
   - Function to remove track from playlist
   - Function to reorder tracks in playlist
   - Function to rename playlist
   - Function to delete playlist

3. Create playlists UI:
   - Playlists tab/view
   - "New Playlist" button
   - List of existing playlists
   - Playlist detail view showing tracks
   - Edit mode for reordering tracks

4. Add playlist context menu:
   - "Add to Playlist" option on tracks
   - Show list of playlists to choose from
   - "Create New Playlist" option in menu

5. Create `css/playlists.css`:
   - Playlist list styles
   - Playlist detail view styles
   - Drag-and-drop reorder styles
   - Empty state styles

6. Implement drag-and-drop:
   - Simple touch/mouse drag to reorder
   - Visual feedback during drag
   - Update playlist order in IndexedDB

7. Add playlist playback:
   - "Play" button for entire playlist
   - "Shuffle Play" button
   - Clicking track plays from that position

### Verification Checklist
- [ ] Can create new playlist with custom name
- [ ] Can add tracks to playlist from library
- [ ] Can view playlist contents
- [ ] Can remove tracks from playlist
- [ ] Can reorder tracks by dragging
- [ ] Can rename playlist
- [ ] Can delete playlist (with confirmation)
- [ ] "Play" starts playlist from beginning
- [ ] "Shuffle Play" plays playlist shuffled
- [ ] Clicking track plays from that position
- [ ] Playlists persist after page reload
- [ ] Can add same track to multiple playlists

### Estimated Time
4-5 hours

---

## Milestone 10: Polish & UX Refinements
**Goal**: Make the app feel professional and smooth

### Tasks
1. UI polish:
   - Smooth transitions between views
   - Loading skeletons for slow operations
   - Subtle animations on buttons/interactions
   - Consistent spacing and alignment
   - Touch targets sized appropriately (44x44px minimum)

2. Visual feedback:
   - Button press animations
   - Active states for all interactive elements
   - Progress indicators for async operations
   - Success/error toast notifications
   - Ripple effects on touch (optional)

3. Cover art handling:
   - Extract embedded artwork from files
   - Display in player, library, lock screen
   - Fallback to dominant color background when missing
   - Cache artwork in IndexedDB for performance
   - Lazy load artwork as scrolling

4. Error handling:
   - Graceful handling of network errors
   - Display user-friendly error messages
   - Retry mechanisms for failed operations
   - Handle edge cases (empty library, playback failures)

5. Performance optimization:
   - Virtual scrolling for large libraries (1000+ tracks)
   - Debounce search input (300ms)
   - Throttle timeline position updates (100ms)
   - Preload next track in queue
   - Optimize IndexedDB queries

6. Accessibility:
   - Proper ARIA labels on buttons
   - Keyboard navigation support
   - Focus indicators
   - Semantic HTML structure
   - Screen reader friendly

7. Empty states:
   - "Connect to Dropbox" welcome screen
   - "No tracks found" in library
   - "No playlists yet" in playlists view
   - "Queue is empty" message
   - Each with helpful call-to-action

### Verification Checklist
- [ ] All transitions are smooth (no janky animations)
- [ ] Loading states show during operations
- [ ] Buttons animate on press
- [ ] Cover art displays consistently
- [ ] Missing cover art shows placeholder/color
- [ ] Error messages are clear and helpful
- [ ] Can recover from network failures
- [ ] Large libraries scroll smoothly
- [ ] Search feels responsive (no lag)
- [ ] Timeline updates smoothly
- [ ] Next track preloads near end of current
- [ ] Can navigate with keyboard (bonus)
- [ ] Focus states are visible
- [ ] Empty states guide user to next action
- [ ] App feels polished and professional

### Estimated Time
4-5 hours

---

## Milestone 11: PWA Features & Installation
**Goal**: Enable installation and full PWA capabilities

### Tasks
1. Finalize manifest.json:
   - Create proper app icons (not placeholders)
   - Ensure all required fields are present
   - Set theme colors matching app design
   - Configure display mode (standalone)
   - Add screenshots for app stores (optional)

2. Enhance service worker:
   - Cache app shell (HTML, CSS, JS)
   - Cache static assets (icons, fonts)
   - Network-first for API calls
   - Cache-first for artwork
   - Implement cache versioning
   - Clean up old caches on activate

3. Add install prompt:
   - Detect if app is installable
   - Show custom "Install App" button
   - Handle beforeinstallprompt event
   - Show success message after install
   - Hide prompt if already installed

4. Offline handling:
   - Detect offline state
   - Show offline indicator
   - Disable network-dependent features gracefully
   - Queue operations for when back online (optional)

5. App state persistence:
   - Save current track, position, queue
   - Save volume, shuffle, repeat settings
   - Save last viewed library tab
   - Restore complete state on reload

6. Test PWA criteria:
   - HTTPS required (test on deployed version)
   - Service worker registered
   - Manifest with icons
   - Mobile responsive
   - Works offline (cached content)

### Verification Checklist
- [ ] App icons display correctly on home screen
- [ ] "Install App" prompt appears (mobile)
- [ ] Can install to home screen
- [ ] Installed app opens in standalone mode (no browser UI)
- [ ] Splash screen shows on launch
- [ ] Service worker caches app shell
- [ ] App loads instantly on repeat visits
- [ ] Offline indicator shows when disconnected
- [ ] Can browse cached library offline
- [ ] App state persists across sessions
- [ ] Returns to exact playback position after reload
- [ ] Chrome DevTools Lighthouse PWA score > 90
- [ ] Works in iOS Safari (primary target)

### Estimated Time
3-4 hours

---

## Milestone 12: Deployment & Testing
**Goal**: Deploy to Vercel and test in production

### Tasks
1. Prepare for deployment:
   - Review all code for hardcoded values
   - Ensure config.js handles production URLs
   - Test locally one more time
   - Check .gitignore (no secrets committed)

2. Deploy to Vercel:
   - Connect GitHub repository
   - Configure build settings (static site)
   - Deploy to production
   - Note the production URL

3. Update Dropbox app:
   - Add production redirect URI to Dropbox app settings
   - Test OAuth flow with production URL

4. Test on actual device:
   - Open production URL on iPhone
   - Test complete authentication flow
   - Verify library scan works
   - Test all playback features
   - Test lock screen controls
   - Install to home screen
   - Use as installed app for full testing session

5. Performance testing:
   - Test with large library (100+ tracks)
   - Test with slow network connection
   - Monitor for memory leaks (long session)
   - Check battery usage during playback

6. Bug fixes:
   - Document any issues found
   - Prioritize critical bugs
   - Fix and redeploy
   - Retest affected areas

7. User testing:
   - Use app yourself for a few days
   - Note any friction points
   - Identify missing features
   - Gather feedback from others (optional)

### Verification Checklist
- [ ] App successfully deploys to Vercel
- [ ] Production URL is accessible
- [ ] OAuth flow works in production
- [ ] Can authenticate from mobile device
- [ ] Library scan works in production
- [ ] All playback features work
- [ ] Lock screen controls work
- [ ] Playlists function correctly
- [ ] App installs to home screen
- [ ] Installed app launches properly
- [ ] Performance is acceptable (no lag/stuttering)
- [ ] No console errors in production
- [ ] App handles errors gracefully
- [ ] Battery usage is reasonable
- [ ] Actually enjoyable to use!

### Estimated Time
3-4 hours + ongoing testing

---

## Total Estimated Time
**35-45 hours** spread across 12 milestones

## Post-MVP Considerations

After completing the MVP, if the app proves valuable, consider:

1. **Offline Caching**: Cache favorite tracks for offline playback
2. **Smart Playlists**: Auto-generated playlists (recently added, most played)
3. **Lyrics Support**: Display synced lyrics if embedded in files
4. **Equalizer**: Audio controls via Web Audio API
5. **Crossfade**: Smooth transitions between tracks
6. **Multiple Cloud Providers**: Add Google Drive, OneDrive support
7. **Social Features**: Share playlists with friends
8. **Statistics**: Track listening history and generate insights
9. **Sonos Integration**: Add multi-room audio support (from original spec)
10. **App Store Distribution**: Package with Capacitor for official app stores

## Success Metrics

You'll know the MVP is successful when:
- You actually use it regularly instead of other players
- Playback is reliable and doesn't interrupt
- The interface feels intuitive and responsive
- Lock screen controls work seamlessly
- You can build and play playlists easily
- Loading your library feels fast (< 5 seconds for 100 tracks)
- You're motivated to add the "nice to have" features

## Tips for Working with Cline

1. **Complete one milestone at a time** - Don't skip ahead
2. **Test thoroughly** before moving on - Bugs compound
3. **Commit after each milestone** - Easy rollback if needed
4. **Reference the design spec** - Cline should follow it closely
5. **Ask Cline to explain** if something seems off
6. **Iterate on details** - Polish is what makes it feel professional
7. **Test on your actual phone early** - Desktop browser ≠ mobile Safari

Good luck! This is a solid project that'll actually be useful when it's done.