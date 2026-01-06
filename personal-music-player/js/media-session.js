// Media Session Module
// Integrates with browser's Media Session API for lock screen controls

import * as queue from './queue.js';
import * as player from './player.js';

let isInitialized = false;

// Initialize Media Session
export function init() {
  if (!('mediaSession' in navigator)) {
    console.log('[MediaSession] Media Session API not supported');
    return;
  }
  
  console.log('[MediaSession] Initializing Media Session API');
  
  // Set up action handlers
  setupActionHandlers();
  
  isInitialized = true;
  console.log('[MediaSession] Media Session initialized');
}

// Set up media session action handlers
function setupActionHandlers() {
  try {
    // Play action
    navigator.mediaSession.setActionHandler('play', () => {
      console.log('[MediaSession] Play action triggered');
      player.togglePlayPause();
    });
    
    // Pause action
    navigator.mediaSession.setActionHandler('pause', () => {
      console.log('[MediaSession] Pause action triggered');
      player.togglePlayPause();
    });
    
    // Previous track
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      console.log('[MediaSession] Previous track action triggered');
      queue.skipToPrevious();
    });
    
    // Next track
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      console.log('[MediaSession] Next track action triggered');
      queue.skipToNext();
    });
    
    // Seek backward (optional - 10 seconds back)
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      console.log('[MediaSession] Seek backward action triggered');
      const seekOffset = details.seekOffset || 10;
      const currentState = player.getPlayerState();
      const newTime = Math.max(0, currentState.currentTime - seekOffset);
      player.seekTo(newTime / currentState.duration);
    });
    
    // Seek forward (optional - 10 seconds forward)
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      console.log('[MediaSession] Seek forward action triggered');
      const seekOffset = details.seekOffset || 10;
      const currentState = player.getPlayerState();
      const newTime = Math.min(currentState.duration, currentState.currentTime + seekOffset);
      player.seekTo(newTime / currentState.duration);
    });
    
    // Seek to (scrubbing)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      console.log('[MediaSession] Seek to action triggered:', details.seekTime);
      if (details.fastSeek && ('fastSeek' in HTMLMediaElement.prototype)) {
        // Use fast seek if available
        const currentState = player.getPlayerState();
        player.seekTo(details.seekTime / currentState.duration);
      } else {
        const currentState = player.getPlayerState();
        player.seekTo(details.seekTime / currentState.duration);
      }
    });
    
    // Stop (optional)
    navigator.mediaSession.setActionHandler('stop', () => {
      console.log('[MediaSession] Stop action triggered');
      player.togglePlayPause();
    });
    
  } catch (error) {
    console.error('[MediaSession] Error setting up action handlers:', error);
  }
}

// Update media session metadata
export function updateMetadata(track) {
  if (!isInitialized || !track) return;
  
  try {
    console.log('[MediaSession] Updating metadata:', track.title);
    
    // Create metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Unknown Track',
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      artwork: [
        // { src: track.albumArt || 'assets/placeholder-cover.svg', sizes: '96x96', type: 'image/svg+xml' },
        { src: 'assets/placeholder-cover.svg', sizes: '96x96', type: 'image/svg+xml' },
        { src: 'assets/placeholder-cover.svg', sizes: '128x128', type: 'image/svg+xml' },
        { src: 'assets/placeholder-cover.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: 'assets/placeholder-cover.svg', sizes: '256x256', type: 'image/svg+xml' },
        { src: 'assets/placeholder-cover.svg', sizes: '384x384', type: 'image/svg+xml' },
        { src: 'assets/placeholder-cover.svg', sizes: '512x512', type: 'image/svg+xml' }
      ]
    });
    
  } catch (error) {
    console.error('[MediaSession] Error updating metadata:', error);
  }
}

// Update playback state
export function updatePlaybackState(state) {
  if (!isInitialized) return;
  
  try {
    // state can be: 'none', 'paused', 'playing'
    navigator.mediaSession.playbackState = state;
    console.log('[MediaSession] Playback state updated:', state);
  } catch (error) {
    console.error('[MediaSession] Error updating playback state:', error);
  }
}

// Update position state (for seekbar on lock screen)
export function updatePositionState(duration, position, playbackRate = 1.0) {
  if (!isInitialized) return;
  
  try {
    if ('setPositionState' in navigator.mediaSession) {
      navigator.mediaSession.setPositionState({
        duration: duration || 0,
        playbackRate: playbackRate,
        position: position || 0
      });
    }
  } catch (error) {
    console.error('[MediaSession] Error updating position state:', error);
  }
}

// Clear media session (when playback stops)
export function clear() {
  if (!isInitialized) return;
  
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    console.log('[MediaSession] Media session cleared');
  } catch (error) {
    console.error('[MediaSession] Error clearing media session:', error);
  }
}

export default {
  init,
  updateMetadata,
  updatePlaybackState,
  updatePositionState,
  clear
};
