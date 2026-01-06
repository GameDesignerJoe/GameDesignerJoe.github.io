// Queue Module
// Manages the play queue and track navigation

import * as storage from './storage.js';
import * as player from './player.js';
import { showToast } from './app.js';

// Queue state
const queueState = {
  tracks: [],           // All tracks in queue
  currentIndex: -1,     // Index of currently playing track
  history: []          // Previously played tracks
};

// Initialize queue
export function init() {
  console.log('[Queue] Queue system initialized');
}

// Play a track and set up queue
export async function playTrackWithQueue(track, queueTracks = []) {
  console.log('[Queue] Playing track with queue:', track.title);
  
  // If no queue provided, use all library tracks
  if (queueTracks.length === 0) {
    queueTracks = await storage.getAllTracks();
  }
  
  // Set up queue
  queueState.tracks = queueTracks;
  
  // Find the track in the queue
  const trackIndex = queueState.tracks.findIndex(t => t.id === track.id);
  
  if (trackIndex !== -1) {
    queueState.currentIndex = trackIndex;
  } else {
    // Track not in queue, add it at the beginning
    queueState.tracks.unshift(track);
    queueState.currentIndex = 0;
  }
  
  // Play the track
  await player.playTrack(track);
  
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
    console.log('[Queue] End of queue reached');
    showToast('End of queue', 'info');
    // TODO: Implement repeat mode in Milestone 6
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
