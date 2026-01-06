// Configuration for the music player app
const config = {
  dropboxAppKey: 'w6g3az21d8acw15',
  redirectUri: window.location.hostname === 'localhost' 
    ? 'http://localhost:8080/'
    : window.location.origin,
  
  // Supported audio file extensions
  audioExtensions: ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus', '.webm', '.aac'],
  
  // App settings
  dropboxUrlExpiry: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
  preloadThreshold: 0.8, // Preload next track when current is 80% complete
  searchDebounce: 300, // Search debounce in milliseconds
  timelineUpdateInterval: 100, // Timeline position update interval in milliseconds
};

export default config;
