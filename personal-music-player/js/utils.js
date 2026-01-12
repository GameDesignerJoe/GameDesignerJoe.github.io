// Utility functions for the app

// Detect if device is mobile
export function isMobileDevice() {
  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Check for mobile patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(userAgent);
  
  // Check for touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen size (mobile-sized screen)
  const isSmallScreen = window.innerWidth <= 768;
  
  // Consider it mobile if it matches UA or has touch + small screen
  return isMobileUA || (hasTouch && isSmallScreen);
}

// Detect if device is iOS
export function isIOS() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
}

// Detect if device is Android
export function isAndroid() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android/i.test(userAgent);
}

// Sleep/delay function
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Throttle async operations - limit concurrency
export async function throttleAsync(tasks, limit, delayMs = 0) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    // Create promise for this task
    const promise = Promise.resolve().then(() => task());
    results.push(promise);
    
    // Track executing promises
    if (limit <= tasks.length) {
      const executing_promise = promise.then(() => {
        executing.splice(executing.indexOf(executing_promise), 1);
      });
      executing.push(executing_promise);
      
      // Wait if we've hit the limit
      if (executing.length >= limit) {
        await Promise.race(executing);
        
        // Add delay between batches if specified
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }
  }
  
  return Promise.all(results);
}

// Batch array into chunks
export function batchArray(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// Format bytes to human-readable size
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Get optimal settings based on device type
export function getDeviceOptimizedSettings() {
  const mobile = isMobileDevice();
  
  return {
    isMobile: mobile,
    // Concurrent API calls
    maxConcurrentApiCalls: mobile ? 2 : 5,
    // Delay between API call batches (ms)
    apiBatchDelay: mobile ? 300 : 100,
    // Image quality/size for cover art
    imageQuality: mobile ? 0.7 : 0.9,
    maxImageSize: mobile ? 500 : 1000,
    // Timeout for operations (ms)
    operationTimeout: mobile ? 30000 : 60000,
    // Enable progressive loading
    progressiveLoading: mobile
  };
}

// Log device info for debugging
export function logDeviceInfo() {
  const settings = getDeviceOptimizedSettings();
  console.log('[Utils] Device info:', {
    userAgent: navigator.userAgent,
    isMobile: settings.isMobile,
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    hasTouch: 'ontouchstart' in window,
    settings: settings
  });
}

// Multi-level sort for library view: Artist → Album → Track → Title
export function libraryMultiSort(a, b) {
  // Level 1: Artist (alphabetical)
  const artistCompare = (a.artist || 'Unknown Artist').localeCompare(
    b.artist || 'Unknown Artist', 
    undefined, 
    { sensitivity: 'base' }
  );
  if (artistCompare !== 0) return artistCompare;
  
  // Level 2: Album (same artist, alphabetical)
  const albumCompare = (a.album || 'Unknown Album').localeCompare(
    b.album || 'Unknown Album', 
    undefined, 
    { sensitivity: 'base' }
  );
  if (albumCompare !== 0) return albumCompare;
  
  // Level 3: Track number (same album)
  if (a.track && b.track) {
    const trackCompare = parseInt(a.track) - parseInt(b.track);
    if (trackCompare !== 0) return trackCompare;
  }
  
  // Track number priority (if only one has it)
  if (a.track && !b.track) return -1;
  if (!a.track && b.track) return 1;
  
  // Level 4: Title (fallback)
  return (a.title || 'Untitled').localeCompare(
    b.title || 'Untitled', 
    undefined, 
    { numeric: true, sensitivity: 'base' }
  );
}

// Simple track number sort for folder/album playback: Track → Title
export function trackNumberSort(a, b) {
  // If both have track numbers, sort by track
  if (a.track && b.track) {
    const trackCompare = parseInt(a.track) - parseInt(b.track);
    if (trackCompare !== 0) return trackCompare;
  }
  
  // Track number priority (if only one has it)
  if (a.track && !b.track) return -1;
  if (!a.track && b.track) return 1;
  
  // Fallback to title (with numeric sorting for "Track 1" vs "Track 10")
  return (a.title || 'Untitled').localeCompare(
    b.title || 'Untitled', 
    undefined, 
    { numeric: true, sensitivity: 'base' }
  );
}
