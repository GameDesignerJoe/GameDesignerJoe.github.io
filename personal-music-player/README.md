# My Music Player - PWA

A Spotify-inspired Progressive Web App that streams music from your Dropbox account with lock screen controls.

## 🚀 Quick Start

### Running Locally

Since this app uses ES6 modules, you **must** run it on a local server. The `file://` protocol won't work.

**Option 1: Python (Recommended)**
```bash
cd c:/Users/GameD/GameDesignerJoe.github.io/personal-music-player
python -m http.server 8080
```

Then visit: **http://localhost:8080**

**Option 2: Node.js (if you have npm installed)**
```bash
cd c:/Users/GameD/GameDesignerJoe.github.io/personal-music-player
npx http-server -p 8080
```

**Option 3: Visual Studio Code Live Server**
- Right-click on `index.html` → "Open with Live Server"

### First-Time Setup

1. Start the local server (see above)
2. Open http://localhost:8080 in your browser
3. Click "Connect to Dropbox"
4. Authorize the app
5. You'll be redirected back to the app

## 📱 Features (Current Status)

### ✅ Completed
- **Milestone 1**: Project Setup & Basic Structure
  - Spotify-inspired dark theme UI
  - Responsive mobile-first design
  - PWA manifest and service worker
  - Complete navigation system

- **Milestone 2**: Dropbox Authentication
  - OAuth 2.0 flow
  - Token storage and management
  - Connection testing
  - Full Dropbox API integration

### 🚧 In Progress
- **Milestone 3**: Browse Dropbox & List Audio Files (Next)

## 🔧 Dropbox Configuration

The app is configured with:
- **App Key**: `w6g3az21d8acv15`
- **Redirect URI**: 
  - Local: `http://localhost:8080/callback`
  - Production: `https://your-domain.com/personal-music-player/callback`

### Supported Audio Formats
- MP3 (.mp3)
- M4A (.m4a)
- FLAC (.flac)
- WAV (.wav)
- OGG (.ogg)
- OPUS (.opus)
- WEBM (.webm)
- AAC (.aac)

## 🗂️ Project Structure

```
personal-music-player/
├── index.html          # Main app HTML
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── config.js          # App configuration
├── assets/            # Icons and images
│   ├── icons/
│   └── placeholder-cover.svg
├── css/               # Stylesheets
│   ├── main.css       # Base styles & layout
│   ├── player.css     # Player screen styles
│   ├── library.css    # Library view styles
│   └── playlists.css  # Playlist styles
├── js/                # JavaScript modules
│   ├── app.js         # Main entry point
│   └── dropbox.js     # Dropbox API integration
└── lib/               # Third-party libraries
```

## 🐛 Troubleshooting

### "Failed to load module" errors
- Make sure you're running on a local server (not `file://`)
- Check that all paths are correct in import statements

### Icons not loading
- Verify icon files are in `assets/icons/`
- Check browser console for 404 errors

### Dropbox authentication fails
- Ensure redirect URI matches exactly in Dropbox app settings
- Check that app key is correct in `config.js`
- Verify you're using `http://localhost:8080` (not 127.0.0.1)

### Service Worker not registering
- Service workers require HTTPS in production
- On localhost, HTTP is allowed for testing
- Check browser console for service worker errors

## 📚 Documentation

See the `docs/` folder for:
- `music-player.md` - Full design specification
- `music-played-milestone_plan.md` - Development roadmap

## 🎯 Next Steps

1. Implement library scanning
2. Add metadata extraction
3. Build audio playback engine
4. Enable lock screen controls
5. Create playlist management
6. Deploy to production

## 📝 License

Personal project - Not for commercial use
