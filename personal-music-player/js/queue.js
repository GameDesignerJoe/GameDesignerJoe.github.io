// Queue Module
// Manages the play queue and track navigation

import * as storage from './storage.js';
import * as player from './player.js';
import { showToast } from './app.js';

// Queue state
const queueState = {
  tracks: [],           // All tracks in queue
  currentIndex: -1,     // Index of currently playing track
  history: [],          // Previously played tracks
  shuffled: false,      // Is shuffle mode on?
  repeatMode: 'off',    // 'off', 'all', 'one'
  originalOrder: [],    // Original track order (for un-shuffling)
  playbackContext: null // Where the music is being played from: { type, id, name }
};

// Initialize queue
export function init() {
  console.log('[Queue] Queue system initialized');
  
  // Load saved preferences
  loadPreferences();
  
  // Update UI to reflect loaded preferences
  updatePlaybackModeUI();
}

// Load shuffle/repeat preferences from localStorage
function loadPreferences() {
  const savedShuffle = localStorage.getItem('player_shuffle');
  const savedRepeat = localStorage.getItem('player_repeat');
  
  if (savedShuffle !== null) {
    queueState.shuffled = savedShuffle === 'true';
  }
  
  if (savedRepeat !== null) {
    queueState.repeatMode = savedRepeat;
  }
  
  console.log('[Queue] Loaded preferences - Shuffle:', queueState.shuffled, 'Repeat:', queueState.repeatMode);
}

// Save preferences to localStorage
function savePreferences() {
  localStorage.setItem('player_shuffle', queueState.shuffled);
  localStorage.setItem('player_repeat', queueState.repeatMode);
}

// Play a track and set up queue with optional context
export async function playTrackWithQueue(track, queueTracks = [], context = null) {
  console.log('[Queue] Playing track with queue:', track.title);
  
  // If no queue provided, use all library tracks
  if (queueTracks.length === 0) {
    queueTracks = await storage.getAllTracks();
  }
  
  // Give each track in the queue a unique instance ID and display index
  // This allows us to distinguish between multiple instances of the same song
  let instanceCounter = Date.now();
  const tracksWithInstanceIds = queueTracks.map((t, index) => {
    return {
      ...t,
      __instanceId: `${t.id}_${instanceCounter++}`,
      __displayIndex: index  // Track original position for matching
    };
  });
  
  // Set up queue
  queueState.tracks = tracksWithInstanceIds;
  
  // Store playback context
  queueState.playbackContext = context;
  if (context) {
    console.log('[Queue] Playback context:', context);
  }
  
  // Find the track in the queue by matching the original track object
  const trackIndex = queueTracks.findIndex(t => t === track);
  
  if (trackIndex !== -1) {
    queueState.currentIndex = trackIndex;
  } else {
    // Track not in queue, add it at the beginning with instance ID
    const trackWithInstanceId = {
      ...track,
      __instanceId: `${track.id}_${instanceCounter++}`
    };
    queueState.tracks.unshift(trackWithInstanceId);
    queueState.currentIndex = 0;
  }
  
  // Play the track (get the one with instance ID from queue)
  await player.playTrack(queueState.tracks[queueState.currentIndex]);
  
  // Update queue UI
  updateQueueUI();
  
  console.log(`[Queue] Queue set with ${queueState.tracks.length} tracks, playing index ${queueState.currentIndex}`);
}

// Skip to next track
export async function skipToNext() {
  if (queueState.tracks.length === 0) {
    showToast('Queue is empty', 'info');
    return;
  }
  
  // Handle repeat one mode
  if (queueState.repeatMode === 'one') {
    const currentTrack = getCurrentTrack();
    if (currentTrack) {
      console.log('[Queue] Repeat one - replaying:', currentTrack.title);
      await player.playTrack(currentTrack);
      return;
    }
  }
  
  // Move to next track
  if (queueState.currentIndex < queueState.tracks.length - 1) {
    // Add current track to history
    if (queueState.currentIndex >= 0) {
      const currentTrack = queueState.tracks[queueState.currentIndex];
      queueState.history.push(currentTrack);
    }
    
    queueState.currentIndex++;
    const nextTrack = queueState.tracks[queueState.currentIndex];
    
    console.log('[Queue] Skipping to next:', nextTrack.title);
    await player.playTrack(nextTrack);
    updateQueueUI();
    
  } else {
    // End of queue reached
    console.log('[Queue] End of queue reached');
    
    // Handle repeat all mode
    if (queueState.repeatMode === 'all' && queueState.tracks.length > 0) {
      console.log('[Queue] Repeat all - restarting from beginning');
      queueState.currentIndex = 0;
      const firstTrack = queueState.tracks[0];
      await player.playTrack(firstTrack);
      updateQueueUI();
    } else {
      showToast('End of queue', 'info');
    }
  }
}

// Skip to previous track
export async function skipToPrevious() {
  if (queueState.tracks.length === 0) {
    showToast('Queue is empty', 'info');
    return;
  }
  
  // If we're more than 3 seconds into the track, restart it
  const playerStateInfo = player.getPlayerState();
  if (playerStateInfo.currentTime > 3) {
    player.seekTo(0);
    console.log('[Queue] Restarting current track');
    return;
  }
  
  // Move to previous track
  if (queueState.currentIndex > 0) {
    queueState.currentIndex--;
    const prevTrack = queueState.tracks[queueState.currentIndex];
    
    console.log('[Queue] Skipping to previous:', prevTrack.title);
    await player.playTrack(prevTrack);
    updateQueueUI();
    
  } else if (queueState.history.length > 0) {
    // Go back to history
    const prevTrack = queueState.history.pop();
    queueState.tracks.unshift(prevTrack);
    queueState.currentIndex = 0;
    
    console.log('[Queue] Going back in history:', prevTrack.title);
    await player.playTrack(prevTrack);
    updateQueueUI();
    
  } else {
    console.log('[Queue] Start of queue reached');
    player.seekTo(0); // Just restart current track
  }
}

// Auto-play next track (called when current track ends)
export async function onTrackEnded() {
  console.log('[Queue] Track ended, auto-playing next');
  await skipToNext();
}

// Add track to queue
export function addToQueue(track) {
  queueState.tracks.push(track);
  updateQueueUI();
  showToast(`Added "${track.title}" to queue`, 'success');
  console.log('[Queue] Track added to queue:', track.title);
}

// Add multiple tracks to queue
export function addTracksToQueue(tracks) {
  queueState.tracks.push(...tracks);
  updateQueueUI();
  showToast(`Added ${tracks.length} tracks to queue`, 'success');
  console.log('[Queue] Added', tracks.length, 'tracks to queue');
}

// Remove track from queue
export function removeFromQueue(index) {
  if (index < 0 || index >= queueState.tracks.length) return;
  
  const track = queueState.tracks[index];
  
  // Adjust current index if needed
  if (index < queueState.currentIndex) {
    queueState.currentIndex--;
  } else if (index === queueState.currentIndex) {
    // Removing currently playing track - skip to next
    skipToNext();
  }
  
  queueState.tracks.splice(index, 1);
  updateQueueUI();
  
  console.log('[Queue] Removed track from queue:', track.title);
}

// Clear entire queue
export function clearQueue() {
  const currentTrack = getCurrentTrack();
  
  queueState.tracks = currentTrack ? [currentTrack] : [];
  queueState.currentIndex = currentTrack ? 0 : -1;
  queueState.history = [];
  
  updateQueueUI();
  showToast('Queue cleared', 'success');
  console.log('[Queue] Queue cleared');
}

// Move track in queue (for drag-and-drop reordering)
export function moveInQueue(fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= queueState.tracks.length) return;
  if (toIndex < 0 || toIndex >= queueState.tracks.length) return;
  
  const track = queueState.tracks[fromIndex];
  queueState.tracks.splice(fromIndex, 1);
  queueState.tracks.splice(toIndex, 0, track);
  
  // Adjust current index
  if (queueState.currentIndex === fromIndex) {
    queueState.currentIndex = toIndex;
  } else if (fromIndex < queueState.currentIndex && toIndex >= queueState.currentIndex) {
    queueState.currentIndex--;
  } else if (fromIndex > queueState.currentIndex && toIndex <= queueState.currentIndex) {
    queueState.currentIndex++;
  }
  
  updateQueueUI();
}

// Jump to specific track in queue
export async function jumpToTrack(index) {
  if (index < 0 || index >= queueState.tracks.length) return;
  
  queueState.currentIndex = index;
  const track = queueState.tracks[index];
  
  console.log('[Queue] Jumping to track:', track.title);
  await player.playTrack(track);
  updateQueueUI();
}

// Update queue UI
function updateQueueUI() {
  const queueContent = document.getElementById('queueContent');
  if (!queueContent) return;
  
  queueContent.innerHTML = '';
  
  if (queueState.tracks.length === 0) {
    queueContent.innerHTML = '<div class="empty-state"><p>Queue is empty</p></div>';
    return;
  }
  
  // Display queue tracks
  queueState.tracks.forEach((track, index) => {
    const trackEl = createQueueTrackElement(track, index);
    queueContent.appendChild(trackEl);
  });
  
  // Update queue count
  const queueCount = document.querySelector('.queue-count');
  if (queueCount) {
    queueCount.textContent = `${queueState.tracks.length} ${queueState.tracks.length === 1 ? 'song' : 'songs'}`;
  }
}

// Create queue track element
function createQueueTrackElement(track, index) {
  const div = document.createElement('div');
  div.className = 'queue-track-item';
  
  // Mark currently playing track
  if (index === queueState.currentIndex) {
    div.classList.add('playing');
  }
  
  div.innerHTML = `
    <div class="queue-track-number">
      ${index === queueState.currentIndex ? '▶' : index + 1}
    </div>
    <div class="queue-track-info">
      <div class="queue-track-title">${escapeHtml(track.title)}</div>
      <div class="queue-track-artist">${escapeHtml(track.artist)}</div>
    </div>
    <button class="queue-track-remove" data-index="${index}">✕</button>
  `;
  
  // Click to play
  div.addEventListener('click', (e) => {
    if (!e.target.classList.contains('queue-track-remove')) {
      jumpToTrack(index);
    }
  });
  
  // Remove button
  div.querySelector('.queue-track-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    removeFromQueue(index);
  });
  
  return div;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get current track
export function getCurrentTrack() {
  if (queueState.currentIndex >= 0 && queueState.currentIndex < queueState.tracks.length) {
    return queueState.tracks[queueState.currentIndex];
  }
  return null;
}

// Get current queue index (for identifying exact instance of duplicate tracks)
export function getCurrentQueueIndex() {
  return queueState.currentIndex;
}

// Get current queue (for matching track instances)
export function getCurrentQueue() {
  return queueState.tracks;
}

// Get queue state (for external use)
export function getQueueState() {
  return {
    tracks: [...queueState.tracks],
    currentIndex: queueState.currentIndex,
    hasNext: queueState.currentIndex < queueState.tracks.length - 1,
    hasPrevious: queueState.currentIndex > 0 || queueState.history.length > 0
  };
}

// Export queue tracks
export function getQueue() {
  return queueState.tracks;
}

// Toggle shuffle mode
export function toggleShuffle() {
  queueState.shuffled = !queueState.shuffled;
  
  if (queueState.shuffled) {
    // Save original order
    queueState.originalOrder = [...queueState.tracks];
    
    // Get current track before shuffling
    const currentTrack = getCurrentTrack();
    
    // Shuffle the queue
    shuffleArray(queueState.tracks);
    
    // Put current track at the beginning
    if (currentTrack) {
      const currentTrackIndex = queueState.tracks.findIndex(t => t.id === currentTrack.id);
      if (currentTrackIndex !== -1 && currentTrackIndex !== 0) {
        queueState.tracks.splice(currentTrackIndex, 1);
        queueState.tracks.unshift(currentTrack);
      }
      queueState.currentIndex = 0;
    }
    
    showToast('🔀 Shuffle ON', 'success');
    console.log('[Queue] Shuffle enabled');
  } else {
    // Restore original order
    if (queueState.originalOrder.length > 0) {
      const currentTrack = getCurrentTrack();
      queueState.tracks = [...queueState.originalOrder];
      
      // Find current track in restored order
      if (currentTrack) {
        const newIndex = queueState.tracks.findIndex(t => t.id === currentTrack.id);
        queueState.currentIndex = newIndex !== -1 ? newIndex : 0;
      }
      
      queueState.originalOrder = [];
    }
    
    showToast('🔀 Shuffle OFF', 'info');
    console.log('[Queue] Shuffle disabled');
  }
  
  savePreferences();
  updateQueueUI();
  updatePlaybackModeUI();
}

// Toggle repeat mode (cycles through: off -> all -> one -> off)
export function toggleRepeat() {
  switch (queueState.repeatMode) {
    case 'off':
      queueState.repeatMode = 'all';
      showToast('🔁 Repeat All', 'success');
      break;
    case 'all':
      queueState.repeatMode = 'one';
      showToast('🔂 Repeat One', 'success');
      break;
    case 'one':
      queueState.repeatMode = 'off';
      showToast('🔁 Repeat OFF', 'info');
      break;
  }
  
  console.log('[Queue] Repeat mode:', queueState.repeatMode);
  savePreferences();
  updatePlaybackModeUI();
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Update playback mode UI (shuffle/repeat buttons)
function updatePlaybackModeUI() {
  // Update main player buttons
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  
  if (shuffleBtn) {
    if (queueState.shuffled) {
      shuffleBtn.classList.add('active');
    } else {
      shuffleBtn.classList.remove('active');
    }
  }
  
  if (repeatBtn) {
    repeatBtn.classList.remove('repeat-off', 'repeat-all', 'repeat-one');
    repeatBtn.classList.add(`repeat-${queueState.repeatMode}`);
    
    // Update icon
    switch (queueState.repeatMode) {
      case 'off':
        repeatBtn.textContent = '🔁';
        break;
      case 'all':
        repeatBtn.textContent = '🔁';
        repeatBtn.classList.add('active');
        break;
      case 'one':
        repeatBtn.textContent = '🔂';
        repeatBtn.classList.add('active');
        break;
    }
  }
  
  // Update mini player buttons
  const miniShuffleBtn = document.getElementById('miniShuffleBtn');
  const miniRepeatBtn = document.getElementById('miniRepeatBtn');
  
  if (miniShuffleBtn) {
    if (queueState.shuffled) {
      miniShuffleBtn.classList.add('active');
      miniShuffleBtn.textContent = '⇄'; // Same icon, but active class makes it white
    } else {
      miniShuffleBtn.classList.remove('active');
      miniShuffleBtn.textContent = '⇄';
    }
  }
  
  if (miniRepeatBtn) {
    miniRepeatBtn.classList.remove('active');
    
    // Update icon based on repeat mode
    switch (queueState.repeatMode) {
      case 'off':
        miniRepeatBtn.textContent = '↻';
        break;
      case 'all':
        miniRepeatBtn.textContent = '↻';
        miniRepeatBtn.classList.add('active');
        break;
      case 'one':
        miniRepeatBtn.textContent = '➀'; // Circled number 1
        miniRepeatBtn.classList.add('active');
        break;
    }
  }
}

// Get current playback modes
export function getPlaybackModes() {
  return {
    shuffled: queueState.shuffled,
    repeatMode: queueState.repeatMode
  };
}

// Get playback context
export function getPlaybackContext() {
  return queueState.playbackContext;
}
