// Configuration for the music player app
const config = {
  dropboxAppKey: 'w6g3az21d8acw15',
  // Get the directory path (remove index.html if present)
  redirectUri: (() => {
    const origin = window.location.origin;
    let path = window.location.pathname;
    // Remove index.html or any trailing filename
    if (path.endsWith('index.html')) {
      path = path.replace('index.html', '');
    }
    // Ensure trailing slash
    if (!path.endsWith('/')) {
      path += '/';
    }
    return origin + path;
  })(),
  
  // Supported audio file extensions
  audioExtensions: ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus', '.webm', '.aac'],
  
  // Supported image file extensions (for cover art)
  imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  
  // App settings
  dropboxUrlExpiry: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
  preloadThreshold: 0.8, // Preload next track when current is 80% complete
  searchDebounce: 300, // Search debounce in milliseconds
  timelineUpdateInterval: 100, // Timeline position update interval in milliseconds
};

export default config;
