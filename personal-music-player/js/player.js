// Audio Player Module
// Handles audio playback, controls, and state

import * as dropbox from './dropbox.js';
import * as linkManager from './link-manager.js';
import * as localFiles from './local-files.js';
import * as storage from './storage.js';
import { showToast } from './app.js';
import * as mediaSession from './media-session.js';

// Player state
const playerState = {
  audio: null,
  currentTrack: null,
  currentTrackLinkExpiresAt: null,
  currentBlobUrl: null, // For local files
  isPlaying: false,
  volume: 0.8,
  duration: 0,
  currentTime: 0,
  retryAttempted: false
};

// Initialize player
export function init() {
  console.log('[Player] Initializing audio player');
  
  // Create audio element
  playerState.audio = new Audio();
  playerState.audio.volume = playerState.volume;
  
  // Set up audio event listeners
  setupAudioEvents();
  
  console.log('[Player] Audio player initialized');
}

// Set up audio element event listeners
function setupAudioEvents() {
  const audio = playerState.audio;
  
  // When track is loaded and ready to play
  audio.addEventListener('loadedmetadata', async () => {
    playerState.duration = audio.duration;
    console.log('[Player] Track loaded, duration:', formatTime(audio.duration));
    updatePlayerUI();
    
    // Update media session
    if (playerState.currentTrack) {
      mediaSession.updateMetadata(playerState.currentTrack);
      mediaSession.updatePositionState(playerState.duration, 0);
      
      // Update track duration in database if missing
      if ((!playerState.currentTrack.duration || playerState.currentTrack.duration === 0) && audio.duration) {
        console.log('[Player] Updating track duration in database:', audio.duration);
        const updatedTrack = { ...playerState.currentTrack, duration: audio.duration };
        await storage.saveTrack(updatedTrack);
        playerState.currentTrack.duration = audio.duration;
      }
    }
  });
  
  // When playback starts
  audio.addEventListener('play', () => {
    playerState.isPlaying = true;
    updatePlayerUI();
    mediaSession.updatePlaybackState('playing');
    console.log('[Player] Playback started');
  });
  
  // When playback pauses
  audio.addEventListener('pause', () => {
    playerState.isPlaying = false;
    updatePlayerUI();
    mediaSession.updatePlaybackState('paused');
    console.log('[Player] Playback paused');
  });
  
  // Update current time
  audio.addEventListener('timeupdate', () => {
    playerState.currentTime = audio.currentTime;
    updateTimeline();
    
    // Update media session position every second
    if (Math.floor(playerState.currentTime) !== Math.floor(playerState.currentTime - 0.25)) {
      mediaSession.updatePositionState(playerState.duration, playerState.currentTime);
    }
  });
  
  // When track ends
  audio.addEventListener('ended', async () => {
    console.log('[Player] Track ended');
    playerState.isPlaying = false;
    updatePlayerUI();
    
    // Auto-play next track in queue
    const queue = await import('./queue.js');
    await queue.onTrackEnded();
  });
  
  // Error handling with automatic retry
  audio.addEventListener('error', async (e) => {
    console.error('[Player] Playback error:', audio.error);
    
    // Check if we haven't already attempted a retry
    if (!playerState.retryAttempted && playerState.currentTrack) {
      console.log('[Player] Attempting automatic retry with fresh link...');
      playerState.retryAttempted = true;
      
      // Show retry message
      showToast('Retrying with fresh link...', 'info');
      
      // Wait a moment before retry
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Retry with fresh link
      try {
        await playTrack(playerState.currentTrack, true);
        return; // Success, exit error handler
      } catch (retryError) {
        console.error('[Player] Retry failed:', retryError);
      }
    }
    
    // If retry failed or already attempted
    showToast('Playback error. Please try another track.', 'error');
    playerState.isPlaying = false;
    updatePlayerUI();
  });
}

// Play a track
export async function playTrack(track, isRetry = false) {
  console.log('[Player] Loading track:', track.title, isRetry ? '(retry)' : '');
  
  try {
    // Show loading state (only if not retry)
    if (!isRetry) {
      showToast('Loading track...', 'info');
      playerState.retryAttempted = false;
    }
    
    // Revoke previous blob URL if any
    if (playerState.currentBlobUrl) {
      localFiles.revokeFileUrl(playerState.currentBlobUrl);
      playerState.currentBlobUrl = null;
    }
    
    let audioUrl;
    
    // Check if this is a local file
    if (track.source === 'local' || track.path?.startsWith('local:')) {
      console.log('[Player] Loading local file');
      
      // Get file handle from track or storage
      let fileHandle = track.fileHandle;
      
      if (!fileHandle) {
        // Try to get full track data from storage
        const fullTrack = await storage.getTrackById(track.id);
        fileHandle = fullTrack?.fileHandle;
      }
      
      if (!fileHandle) {
        throw new Error('File handle not found for local track');
      }
      
      // Verify permission
      const hasPermission = await localFiles.verifyPermission(fileHandle);
      if (!hasPermission) {
        throw new Error('Permission denied for local file');
      }
      
      // Create blob URL
      audioUrl = await localFiles.getFileUrl(fileHandle);
      playerState.currentBlobUrl = audioUrl;
      
    } else {
      // Dropbox file - get fresh temporary download link
      const linkData = await linkManager.getFreshTemporaryLink(track.path);
      audioUrl = linkData.url;
      playerState.currentTrackLinkExpiresAt = linkData.expiresAt;
    }
    
    console.log('[Player] Got audio URL, starting playback');
    
    // Update state
    playerState.currentTrack = track;
    
    // Load and play audio
    playerState.audio.src = audioUrl;
    playerState.audio.load();
    
    // Show mini player and player screen
    showMiniPlayer();
    updatePlayerUI();
    
    // Auto-play
    try {
      await playerState.audio.play();
      if (!isRetry) {
        showToast(`♪ ${track.title}`, 'success');
      } else {
        showToast(`✓ ${track.title}`, 'success');
      }
    } catch (playError) {
      console.error('[Player] Auto-play blocked:', playError);
      if (!isRetry) {
        showToast('Click play to start', 'info');
      }
    }
    
  } catch (error) {
    console.error('[Player] Error loading track:', error);
    showToast('Failed to load track', 'error');
  }
}

// Toggle play/pause
export function togglePlayPause() {
  if (!playerState.audio || !playerState.currentTrack) {
    showToast('No track loaded', 'info');
    return;
  }
  
  if (playerState.isPlaying) {
    playerState.audio.pause();
  } else {
    playerState.audio.play().catch(error => {
      console.error('[Player] Play error:', error);
      showToast('Playback failed', 'error');
    });
  }
}

// Seek to position (0-1)
export function seekTo(position) {
  if (!playerState.audio || !playerState.currentTrack) return;
  
  const time = position * playerState.duration;
  playerState.audio.currentTime = time;
  console.log('[Player] Seeking to:', formatTime(time));
}

// Set volume (0-1)
export function setVolume(volume) {
  if (!playerState.audio) return;
  
  playerState.volume = Math.max(0, Math.min(1, volume));
  playerState.audio.volume = playerState.volume;
  console.log('[Player] Volume set to:', Math.round(playerState.volume * 100) + '%');
}

// Update player UI elements
async function updatePlayerUI() {
  const track = playerState.currentTrack;
  if (!track) return;
  
  // Determine album art URL
  const albumArtUrl = track.albumArt || 'assets/icons/icon-song-black..png';
  
  // Update full player
  document.getElementById('albumArt').src = albumArtUrl;
  document.getElementById('albumArt').alt = track.album;
  document.getElementById('trackTitle').textContent = track.title;
  document.getElementById('trackArtist').textContent = track.artist;
  
  // Update mini player track info
  const miniPlayerArt = document.getElementById('miniPlayerArt');
  const miniPlayerTitle = document.querySelector('.mini-player-title');
  const miniPlayerArtist = document.querySelector('.mini-player-artist');
  const miniPlayerLocation = document.querySelector('.mini-player-location');
  
  if (miniPlayerArt) {
    miniPlayerArt.src = albumArtUrl;
    miniPlayerArt.alt = track.album;
  }
  
  if (miniPlayerTitle) {
    miniPlayerTitle.textContent = track.title;
  }
  
  if (miniPlayerArtist) {
    miniPlayerArtist.textContent = track.artist;
  }
  
  // Update location from playback context
  if (miniPlayerLocation) {
    const queue = await import('./queue.js');
    const context = queue.getPlaybackContext();
    
    if (context && context.name) {
      miniPlayerLocation.textContent = context.name;
    } else if (track.source === 'local') {
      miniPlayerLocation.textContent = 'Local Drive';
    } else if (track.source === 'dropbox' || track.path) {
      miniPlayerLocation.textContent = 'Dropbox';
    } else {
      miniPlayerLocation.textContent = '—';
    }
  }
  
  // Update play/pause buttons
  const playPauseIcon = document.getElementById('playPauseIcon');
  const miniPlayBtn = document.getElementById('miniPlayPauseBtn');
  const miniPlayBtnDesktop = document.getElementById('miniPlayPauseBtnDesktop');
  
  if (playerState.isPlaying) {
    if (playPauseIcon) playPauseIcon.textContent = '||';
    if (miniPlayBtn) miniPlayBtn.textContent = '||';
    if (miniPlayBtnDesktop) miniPlayBtnDesktop.textContent = '||';
  } else {
    if (playPauseIcon) playPauseIcon.textContent = '▶';
    if (miniPlayBtn) miniPlayBtn.textContent = '▶';
    if (miniPlayBtnDesktop) miniPlayBtnDesktop.textContent = '▶';
  }
  
  // Update time display
  const totalTime = document.getElementById('totalTime');
  if (totalTime && playerState.duration) {
    totalTime.textContent = formatTime(playerState.duration);
  }
}

// Update timeline progress
function updateTimeline() {
  if (!playerState.duration) return;
  
  const progress = playerState.currentTime / playerState.duration;
  
  // Update full player timeline
  const timelineProgress = document.getElementById('timelineProgress');
  const timelineHandle = document.getElementById('timelineHandle');
  const currentTimeEl = document.getElementById('currentTime');
  
  if (timelineProgress) {
    timelineProgress.style.width = `${progress * 100}%`;
  }
  
  if (timelineHandle) {
    timelineHandle.style.left = `${progress * 100}%`;
  }
  
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTime(playerState.currentTime);
  }
  
  // Update mini player progress bar
  const miniProgress = document.getElementById('miniPlayerProgress');
  if (miniProgress) {
    miniProgress.style.width = `${progress * 100}%`;
  }
}

// Show mini player
function showMiniPlayer() {
  const miniPlayer = document.getElementById('miniPlayer');
  if (miniPlayer) {
    miniPlayer.style.display = 'block';
  }
}

// Hide mini player
export function hideMiniPlayer() {
  const miniPlayer = document.getElementById('miniPlayer');
  if (miniPlayer) {
    miniPlayer.style.display = 'none';
  }
}

// Format seconds to MM:SS
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get current player state (for other modules)
export function getPlayerState() {
  return {
    ...playerState,
    audio: undefined // Don't expose audio element directly
  };
}

// Export current track getter
export function getCurrentTrack() {
  return playerState.currentTrack;
}

// Export is playing getter
export function isPlaying() {
  return playerState.isPlaying;
}
