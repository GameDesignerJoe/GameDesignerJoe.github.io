# Background Playback Fix - Instructions for Cline

## Problem
The app stops playing the next track when the phone is locked or screen is dark. This happens because iOS suspends the web app when audio stops between tracks.

## Solution Overview
We need to ensure continuous audio playback by preloading the next track and eliminating any gaps between songs. This keeps iOS from suspending the app.

---

## Changes Needed in `js/player.js`

### 1. Add Preloading State Variables

At the top of your player module, add these variables:

```javascript
let nextTrackUrl = null;
let nextTrackPreloaded = false;
let preloadInProgress = false;
```

### 2. Create Preload Function

Add this new function to preload the next track's URL:

```javascript
async function preloadNextTrack() {
  if (preloadInProgress || nextTrackPreloaded) return;
  
  preloadInProgress = true;
  
  try {
    // Get the next track in queue
    const nextTrackId = getNextTrackInQueue(); // Use your existing queue logic
    if (!nextTrackId) {
      preloadInProgress = false;
      return;
    }
    
    // Get the track object
    const nextTrack = await getTrackById(nextTrackId); // Use your existing function
    if (!nextTrack) {
      preloadInProgress = false;
      return;
    }
    
    // Get Dropbox temporary URL for next track
    nextTrackUrl = await getDropboxUrl(nextTrack.path); // Use your existing Dropbox function
    nextTrackPreloaded = true;
    
    console.log('Next track preloaded:', nextTrack.title);
    
  } catch (error) {
    console.error('Error preloading next track:', error);
  } finally {
    preloadInProgress = false;
  }
}
```

### 3. Modify Audio Element Configuration

In your audio element initialization, ensure these settings:

```javascript
audio.preload = 'auto';
audio.crossOrigin = 'anonymous'; // For Dropbox URLs
```

### 4. Add Time Update Listener for Preloading

Add or modify your `timeupdate` event listener:

```javascript
audio.addEventListener('timeupdate', () => {
  const currentTime = audio.currentTime;
  const duration = audio.duration;
  
  // Update UI timeline (your existing code)
  updateTimelineUI(currentTime, duration);
  
  // Preload next track when 80% through current track
  if (!nextTrackPreloaded && duration > 0) {
    const percentComplete = (currentTime / duration) * 100;
    if (percentComplete >= 80) {
      preloadNextTrack();
    }
  }
});
```

### 5. Modify Track Loading Function

Update your track loading function to use preloaded URL if available:

```javascript
async function loadTrack(track) {
  try {
    // Reset preload state for previous track
    const previousUrl = nextTrackUrl;
    const wasPreloaded = nextTrackPreloaded;
    nextTrackUrl = null;
    nextTrackPreloaded = false;
    
    // If this track was preloaded, use that URL
    let streamUrl;
    if (wasPreloaded && previousUrl) {
      streamUrl = previousUrl;
      console.log('Using preloaded URL');
    } else {
      // Otherwise fetch new URL
      streamUrl = await getDropboxUrl(track.path);
    }
    
    // Set audio source
    audio.src = streamUrl;
    
    // Update Media Session IMMEDIATELY
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || track.filename,
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        artwork: track.coverArt ? [
          { src: track.coverArt, sizes: '512x512', type: 'image/png' }
        ] : []
      });
      
      // Set playback state
      navigator.mediaSession.playbackState = 'playing';
    }
    
    // Start playback
    await audio.play();
    
    // Update UI
    updateNowPlayingUI(track);
    
    // Save state
    await saveAppState();
    
  } catch (error) {
    console.error('Error loading track:', error);
    // Handle error - skip to next track
    skipToNext();
  }
}
```

### 6. Improve Ended Event Listener

Modify your `ended` event listener to immediately play next track:

```javascript
audio.addEventListener('ended', async () => {
  console.log('Track ended, playing next...');
  
  // Immediately get next track and play
  const nextTrackId = getNextTrackInQueue();
  
  if (!nextTrackId) {
    console.log('End of queue reached');
    handleEndOfQueue(); // Your existing logic for repeat/stop
    return;
  }
  
  const nextTrack = await getTrackById(nextTrackId);
  
  if (nextTrack) {
    // Play next track immediately
    await loadTrack(nextTrack);
    advanceQueue(); // Your existing function to move queue position
  } else {
    console.error('Next track not found');
    handleEndOfQueue();
  }
});
```

### 7. Update Media Session Handlers

Ensure your Media Session action handlers are set up:

```javascript
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => {
    audio.play();
    navigator.mediaSession.playbackState = 'playing';
  });
  
  navigator.mediaSession.setActionHandler('pause', () => {
    audio.pause();
    navigator.mediaSession.playbackState = 'paused';
  });
  
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    skipToPrevious(); // Your existing function
  });
  
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    skipToNext(); // Your existing function
  });
  
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) {
      audio.currentTime = details.seekTime;
    }
  });
}
```

---

## Additional Changes

### In `js/dropbox.js`

Make sure your Dropbox URL function caches URLs and checks expiry:

```javascript
// Add to track object when getting URL
track.dropboxUrl = temporaryLink;
track.urlExpiry = Date.now() + (3.5 * 60 * 60 * 1000); // 3.5 hours

// Check if URL is still valid before using
function isUrlValid(track) {
  return track.dropboxUrl && track.urlExpiry && Date.now() < track.urlExpiry;
}
```

### In `manifest.json`

Ensure your manifest includes:

```json
{
  "display": "standalone",
  "categories": ["music", "entertainment"],
  "prefer_related_applications": false
}
```

---

## Testing Instructions

After implementing these changes:

1. **Test basic playback:**
   - Play a track
   - Verify it starts immediately
   - Check console for "Next track preloaded" message when 80% through

2. **Test lock screen:**
   - Start playing a playlist
   - Lock your phone
   - Wait for current track to end
   - Next track should start within 1 second
   - Lock screen should update with new track info

3. **Test queue advancement:**
   - Play multiple tracks in a row
   - Verify queue position advances correctly
   - Check that preloading happens for each track

4. **Test repeat modes:**
   - Test with Repeat Off (should stop at end)
   - Test with Repeat One (should replay same track)
   - Test with Repeat All (should loop queue)

---

## Common Issues to Watch For

**If tracks still don't advance:**
- Check console for errors during preload
- Verify Dropbox URLs aren't expiring
- Make sure `getNextTrackInQueue()` returns correct track ID
- Ensure `ended` event is firing (add console.log)

**If there's a gap between tracks:**
- Increase preload trigger to 90% instead of 80%
- Check network speed (slow connections need earlier preload)
- Verify audio.src is being set immediately in loadTrack

**If Media Session doesn't update:**
- Check that metadata is being set before play() is called
- Verify artwork URLs are valid
- Ensure playbackState is being updated

---

## Success Criteria

✅ Tracks advance automatically when phone is locked
✅ No gap between tracks (< 1 second)
✅ Lock screen shows current track info
✅ Lock screen controls work (play/pause/skip)
✅ Console shows preloading happening at 80%
✅ App doesn't crash or stop after multiple tracks

---

## Notes

- This fix eliminates the gap between tracks by having the next URL ready before current track ends
- Media Session API tells iOS "I'm actively playing audio" so it doesn't suspend
- Preloading at 80% gives plenty of time even on slow connections
- Using the preloaded URL means no API delay when track ends

If issues persist after these changes, check for any setTimeout/setInterval calls that might be delaying playback, and ensure no async operations are happening between tracks.