# 🎵 AI Agents: Read Me First

**Welcome!** You're working on a personal music player PWA. This document will get you up to speed quickly.

---

## 📋 Quick Project Summary

**What is this?**
A Progressive Web App that streams music from cloud storage (currently Dropbox). Think Spotify, but for your own music files.

**Current Status:** ~90% Complete MVP - Fully functional, needs some UI polish

**Tech Stack:** Vanilla JavaScript (ES6 modules), HTML5, CSS3, IndexedDB, Dropbox API, deployed on Vercel

**Target:** Mobile-first (iOS Safari), but works on desktop

---

## 🎯 What Makes This Project Unique

### The Sources Management System
This is the **crown jewel** - not in the original spec but adds huge value:
- Visual interface for selecting which Dropbox folders to include in library
- Browse folder tree with breadcrumb navigation
- Real-time folder/song counts
- Auto-scanning when folders change
- Future-ready for multiple cloud providers (Google Drive, OneDrive, etc.)

Instead of scanning the entire Dropbox (slow, messy), users cherry-pick folders. Much better UX.

---

## 🗂️ Project Architecture

### Core Modules (9 files in `/js/`)

1. **app.js** - The conductor. Initializes everything, handles navigation, authentication
2. **player.js** - Audio playback. HTML5 Audio element + controls
3. **queue.js** - Track queue, shuffle, repeat, skip logic
4. **library.js** - Display tracks in 3 views (Songs/Artists/Albums) with search
5. **playlists.js** - Create, edit, delete playlists
6. **sources.js** - ⭐ The Sources management screen (folder selection)
7. **dropbox.js** - Dropbox API client (OAuth, folder listing, temp links)
8. **storage.js** - IndexedDB wrapper (tracks, playlists, folders, settings)
9. **media-session.js** - Lock screen controls via Media Session API

### Key Concepts

**Modular Design:** Each module is self-contained with clear responsibilities. Import/export ES6 modules.

**Event Flow Example:**
```
User clicks track → library.js → queue.playTrackWithQueue() → 
player.playTrack() → dropbox.getTemporaryLink() → audio.play() → 
media-session.updateMetadata() → UI updates
```

**Data Persistence:**
- **IndexedDB:** All tracks, playlists, selected folders (via storage.js)
- **localStorage:** OAuth token, shuffle/repeat preferences
- **Session-only:** Current queue, player position

---

## 🎨 UI/UX Philosophy

**Spotify-Inspired Dark Theme:**
- Background: `#121212` (near black)
- Accent: `#1DB954` (Spotify green)
- Mobile-first responsive design

**Screen Structure:**
- Bottom navigation: Library | Playlists | Sources (3 tabs)
- Full-screen player modal when track playing
- Mini player bar at bottom (click to expand)
- Context menus for actions (⋮ buttons)
- Toast notifications for feedback

**User Flow:**
1. Auth with Dropbox → Sources screen
2. Select folders → Auto-scan
3. Library populates → Browse/search
4. Click track → Plays with queue
5. Lock screen controls work

---

## 📂 File Structure Quick Reference

```
personal-music-player/
├── index.html           # Single-page app
├── config.js           # Dropbox app key config
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── css/               # 6 CSS files (main, player, library, playlists, sources, modals)
├── js/                # 9 core modules (see above)
├── assets/icons/      # App icons (currently placeholders)
└── docs/
    ├── AI-AGENTS-README.md         # This file
    ├── music-player.md             # Comprehensive technical docs
    ├── music-played-milestone_plan.md  # Development progress tracker
    └── todo.md                     # Current issues/tasks
```

---

## 🚀 Getting Started as an AI Agent

### 1. Read These Files First (in order):
1. **This file** (you're here! ✓)
2. **docs/todo.md** - Current priorities and known issues
3. **docs/music-played-milestone_plan.md** - What's done, what's not
4. **docs/music-player.md** - Deep dive into architecture (as needed)

### 2. Understand the Module System

Each module follows this pattern:
```javascript
// Module-level state
const moduleState = { };

// Public init function
export async function init() {
  console.log('[ModuleName] Initializing');
  // Setup code
}

// Public API
export async function doSomething() { }

// Private helpers
function privateHelper() { }
```

**Always:**
- Use ES6 import/export
- Prefer async/await over promises
- Log with `[ModuleName]` prefix
- Show user feedback via `showToast(message, type)`
- Handle errors gracefully

### 3. Making Changes

**Before you code:**
- Check todo.md for current priorities
- Look at existing patterns in similar features
- Consider which module(s) are affected

**When you code:**
- Follow existing code style (see examples in modules)
- Update state → Update storage → Update UI → Notify user
- Test on desktop AND think mobile-first
- Add console logging for debugging

**After you code:**
- Update todo.md (mark completed items)
- Update docs if architecture changed
- Suggest testing steps

---

## 🎯 Common Tasks & Where to Look

| Task | Primary Module | Secondary Modules |
|------|---------------|-------------------|
| Add playback feature | player.js | queue.js, media-session.js |
| Change library display | library.js | storage.js |
| Add playlist feature | playlists.js | storage.js |
| Modify folder browser | sources.js, folder-browser.js | scanner.js, dropbox.js |
| Fix UI/styling | Relevant CSS file | index.html |
| Add cloud provider | sources.js, new module | storage.js, scanner.js |
| Fix authentication | dropbox.js | app.js |

---

## ⚠️ Important Things to Know

### 1. Dropbox Temporary Links
- Audio streams via temporary links (4-hour expiry)
- Requested fresh for each track play
- Don't cache audio URLs
- Auto-reauth on 401 errors

### 2. IndexedDB Schema
- **tracks** store: All scanned music files
- **folders** store: Selected folder paths
- **playlists** store: User playlists
- **settings** store: App configuration

All accessed via `storage.js` - never directly.

### 3. The Queue System
- Dynamically created when user plays track
- Tracks come with context (full library, album, playlist)
- Shuffle stores original order for un-shuffle
- Skip back logic: >3 sec = restart, <3 sec = previous

### 4. Sources Screen vs Library Screen
- **Sources:** WHERE music comes from (folder management)
- **Library:** WHAT music you have (browsing/playing)
- Don't confuse them!

### 5. Mobile-First Philosophy
- This is primarily for iPhone
- Test assumptions about touch vs mouse
- iOS Safari is the primary target
- Desktop is nice-to-have

---

## 🐛 Known Issues (High Level)

See `docs/todo.md` for complete list, but main themes:

1. **UI/UX Polish:** Some rough edges in Sources screen, mini player limited
2. **PWA Optimization:** Needs better install prompt, offline handling
3. **Album Artwork:** Currently using placeholder icons, need extraction
4. **Icon Design:** App icons are placeholders

**None are blockers** - app is fully functional!

---

## 🔧 Development Workflow

### Local Testing:
```bash
# Serve locally (use any static server)
python -m http.server 8080
# or
npx serve
```

### Deployment:
- Hosted on Vercel
- Auto-deploys on git push
- No build step (static files)
- HTTPS automatic

### Debugging:
```javascript
// Console logging convention
console.log('[ModuleName] Action description');
console.error('[ModuleName] Error:', error);

// Check IndexedDB
// Chrome DevTools > Application > IndexedDB > MusicPlayerDB

// Enable verbose mode
localStorage.setItem('debug', 'true');
```

---

## 🎓 Code Style Guidelines

### ✅ DO:
```javascript
// Use ES6 modules
import * as storage from './storage.js';
export async function init() { }

// Use async/await
const tracks = await storage.getAllTracks();

// Use toast notifications
showToast('Success message', 'success');

// Handle errors
try {
  await riskyOperation();
} catch (error) {
  console.error('[Module] Error:', error);
  showToast('User-friendly message', 'error');
}

// Update UI pattern
moduleState.value = newValue;
await storage.saveSetting('key', newValue);
updateUI();
showToast('Updated!', 'success');
```

### ❌ DON'T:
```javascript
// Don't use .then/.catch chains
storage.getAllTracks().then(tracks => { }); // NO

// Don't skip error handling
await riskyOperation(); // NO - what if it fails?

// Don't access IndexedDB directly
indexedDB.open('MusicPlayerDB'); // NO - use storage.js

// Don't forget user feedback
// Silent operations confuse users - always notify!
```

---

## 🎯 Current Priorities

Based on docs/todo.md, focus areas:

1. **UI/UX Polish** (highest impact)
   - Improve Sources screen folder browser
   - Enhance mini player with more controls
   - Better visual hierarchy

2. **Album Artwork** (highly visible)
   - Extract embedded artwork from files
   - Use jsmediatags library
   - Cache in IndexedDB

3. **PWA Enhancements** (for installability)
   - Custom install prompt
   - Offline state handling
   - Better icons

4. **Google Drive Support** (future)
   - Second cloud provider
   - Use Sources pattern

---

## 💡 Tips for Success

1. **Start Small:** Fix one issue or add one small feature at a time
2. **Follow Patterns:** Look at how similar features work
3. **Test Early:** Check in browser frequently
4. **Think Mobile:** This is iPhone-first
5. **Ask Questions:** If something's unclear, ask the user
6. **Document:** Update todo.md and docs as you go
7. **Use Toast:** Always give user feedback for actions
8. **Console Log:** Debug-friendly logging helps everyone
9. **Handle Errors:** Graceful degradation is key
10. **Enjoy:** This is a well-structured project - it's fun to work on!

---

## 📚 Resource Files

- **Full Technical Docs:** `docs/music-player.md`
- **Progress Tracker:** `docs/music-played-milestone_plan.md`
- **Current Tasks:** `docs/todo.md`
- **Dropbox Setup:** `DROPBOX_SETUP.md`
- **Deployment:** `DEPLOYMENT.md`

---

## 🎵 The Vision

This app aims to be:
- **Simple:** Stream your music without complexity
- **Elegant:** Spotify-level UI polish
- **Flexible:** Support multiple cloud providers
- **Powerful:** Playlists, search, lock screen controls
- **Personal:** Your music, your way

It's ~90% there. Your job is to polish and extend it.

---

## ✨ Final Thoughts

This is a **well-architected project** with:
- ✅ Clean modular structure
- ✅ Consistent patterns
- ✅ Good documentation
- ✅ Working MVP deployed
- ✅ Clear path forward

You're not fixing a mess - you're **polishing a gem**. 💎

The user has invested significant thought into the architecture (especially the Sources system). Respect the existing patterns, and you'll have a great time working on this.

**Ready to build?** Check `docs/todo.md` and pick a task!

---

**Document Version:** 1.0  
**Created:** January 7, 2026  
**For:** AI Agents working on personal-music-player project  
**Quick Start:** Read this → todo.md → Start coding!
