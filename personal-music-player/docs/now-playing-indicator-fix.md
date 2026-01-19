# Now-Playing Indicator Fix

## Date: January 18, 2026

## Problem
The "now playing" visual indicators (green text + sound wave animation) stopped working in playlists. The feature was working in the library view but was missing from the playlists module.

## Root Cause
The playlists module (`js/playlists.js`) had polling functionality to update the play button icon, but it was **missing the code to update the now-playing CSS classes** on individual track elements.

## What Should Happen
When a song is playing:
1. The track's title should turn **green** (using CSS class `now-playing`)
2. An animated **sound wave** should appear over the play button (using CSS class `playing`)
3. These indicators should work in:
   - Library view ✓ (was working)
   - Playlist view ✗ (was broken) → **NOW FIXED**
   - Folder views ✓ (was working)

## CSS Classes (Already Existed)
The CSS was already properly defined in `css/library.css` and `css/playlists.css`:

```css
/* Green text for now playing track */
.track-item.now-playing .track-item-title {
  color: #1DB954; /* Spotify green */
}

/* Sound wave animation */
.track-item.now-playing.playing .sound-bars {
  display: flex;
}

.sound-bars {
  animation: sound-wave 0.8s ease-in-out infinite;
}
```

## Fix Applied
Added the missing `updatePlaylistNowPlayingIndicators()` function to `js/playlists.js`:

```javascript
// Update now-playing indicators for all visible playlist tracks
async function updatePlaylistNowPlayingIndicators() {
  const player = await import('./player.js');
  const currentTrack = player.getCurrentTrack();
  const isCurrentlyPlaying = player.isPlaying();
  
  // Update all playlist track elements
  const trackElements = document.querySelectorAll('.playlist-track-item');
  trackElements.forEach((trackEl) => {
    const trackId = trackEl.dataset.trackId;
    
    // Check if this is the currently playing track
    if (currentTrack && trackId === currentTrack.id) {
      // This is the current track
      trackEl.classList.add('now-playing');
      
      if (isCurrentlyPlaying) {
        trackEl.classList.add('playing');
      } else {
        trackEl.classList.remove('playing');
      }
    } else {
      // Not the current track
      trackEl.classList.remove('now-playing', 'playing');
    }
  });
}
```

And integrated it into the existing polling function:

```javascript
function startPlaylistPolling() {
  playlistUpdateInterval = setInterval(async () => {
    // ... existing play button update code ...
    
    // Update now-playing indicators for playlist tracks
    updatePlaylistNowPlayingIndicators();
  }, 500);
}
```

## How It Works
1. **Every 500ms**, the polling function runs
2. It gets the currently playing track from the player module
3. It finds all `.playlist-track-item` elements on the page
4. For each track element:
   - If it matches the currently playing track → add `now-playing` class
   - If the track is actively playing → add `playing` class
   - Otherwise → remove both classes
5. The CSS automatically applies:
   - Green text color to `.now-playing .track-item-title`
   - Sound wave animation to `.now-playing.playing .sound-bars`

## Testing
To verify the fix works:
1. Open a playlist in the music player
2. Play a song from the playlist
3. **Expected results:**
   - ✅ Song title turns green
   - ✅ Sound wave animation appears over the play button
   - ✅ When you pause, the sound wave stops but title stays green
   - ✅ When you play a different song, the indicators move to that song

## Files Modified
- `js/playlists.js` - Added missing now-playing indicator update function

## Comparison
- **Library module** (`js/library.js`) - Already had `updateNowPlayingIndicators()` ✓
- **Playlists module** (`js/playlists.js`) - Was missing the function ✗ → **NOW FIXED** ✓

## Technical Notes
- Polling happens every 500ms (twice per second)
- Uses CSS classes rather than inline styles for performance
- Animation is pure CSS, no JavaScript animation
- Works automatically with the existing CSS rules
- No changes needed to HTML or CSS - they were already correct!
