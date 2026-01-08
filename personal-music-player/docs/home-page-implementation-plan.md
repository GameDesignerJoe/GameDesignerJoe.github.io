# Home Page Implementation Plan

**Created:** January 7, 2026  
**Feature:** Spotify-Style Home Page with Folder Collections  
**Status:** Ready for Implementation

---

## 🎯 Overview

Transform Playback into a streaming-style app by adding:
1. **Home Page** - Visual grid of folder collections (like Spotify)
2. **Responsive Navigation** - Desktop sidebar + mobile bottom nav
3. **Unified Search** - Search folders, songs, and playlists
4. **Folder Cover Images** - Auto-detect cover art from Dropbox folders

This is an **additive feature** - existing screens remain, navigation is reorganized.

---

## 📋 User Requirements

### Key Decisions
- **Still mobile-first** but with full desktop support
- **Home as default landing page** (unless no folders selected → Sources)
- **Clicking folder** → Library filtered to that folder
- **Show parent folders AND subfolders** as separate cards
- **Cover images** auto-detected from folder (cover.png/jpg or any image)
- **Playlists in sidebar** - Last 5 + "Show more" button
- **Mini player** at bottom of main content (proper spacing)
- **Auto re-scan** when folders added + manual Refresh button
- **Duplicate folder names** allowed (user's responsibility)

### Navigation Structure

**Desktop (≥769px):**
- Left sidebar with Home/Library/Sources/Playlists
- Main content area
- No bottom nav

**Mobile (≤768px):**
- Bottom nav with Home/Search/Library/Sources icons
- No sidebar

---

## 🏗️ Architecture

### New Modules

#### **home.js**
Purpose: Display "My Music Collection" folder grid

Functions:
- `init()` - Initialize module
- `refreshFolders()` - Reload folder data
- `createFolderCard(folder)` - Generate card HTML
- `handleFolderClick(folderPath)` - Navigate to filtered library

Features:
- Fetch selected folders from storage
- Display as grid (2 cols mobile, 3-4 cols desktop)
- Show both parent folders and subfolders as cards
- Cover art or cassette tape fallback
- "+ Add New Folder" card → Sources screen
- Refresh button next to title

#### **search.js**
Purpose: Unified search across folders, songs, playlists

Functions:
- `init()` - Initialize module
- `performSearch(query)` - Search all data
- `displayResults(folders, songs, playlists)` - Show grouped results

Features:
- Real-time search as user types
- Group results by type (Folders, Songs, Playlists)
- Click result → Navigate to appropriate view
- Empty state when no results

### Module Updates

#### **scanner.js**
Enhancements:
- Detect cover images in folders (cover.* or any .png/.jpg/.jpeg)
- Return cover image path with folder data
- Scan subfolders and mark those with audio files

#### **storage.js**
Schema updates:
```javascript
// Folder object
{
  path: string,
  name: string,
  coverImagePath: string | null,
  coverImageUrl: string | null,  // Dropbox temp link
  songCount: number,
  subfolders: string[],
  addedAt: timestamp
}
```

#### **sources.js**
- Trigger re-scan when folders added/removed
- Store folder cover image metadata

#### **library.js**
New feature:
```javascript
export function filterByFolder(folderPath) {
  // Filter tracks to specific folder
}
```

#### **playlists.js**
New features:
```javascript
export function getPlaylistsForSidebar() {
  // Return last 5 playlists
}

export function showAllPlaylists() {
  // Show full playlist list
}

export function openPlaylistFromSidebar(playlistId) {
  // Open playlist detail
}
```

#### **app.js**
Updates:
- Import home and search modules
- Initialize new modules
- Add 'home' and 'search' screen handling
- Set Home as default screen (unless no folders)
- Handle responsive navigation

---

## 🎨 UI Design

### Folder Card
```html
<div class="folder-card" data-folder-path="/Music/Songs I Wrote">
  <div class="folder-card-image">
    <img src="cover-url-or-cassette-fallback" alt="Songs I Wrote">
  </div>
  <div class="folder-card-info">
    <h3 class="folder-card-name">Songs I Wrote</h3>
    <p class="folder-card-count">47 songs</p>
  </div>
</div>
```

**Styling:**
- Square aspect ratio (1:1)
- Rounded corners (8px)
- Background: #181818
- Hover: scale(1.05) + subtle green glow
- Folder name: bold, white, 14px
- Song count: gray, 12px

### Desktop Sidebar
```html
<aside class="app-sidebar">
  <div class="sidebar-header">
    <h1 class="sidebar-logo">PLAYBACK</h1>
  </div>
  
  <nav class="sidebar-nav">
    <button class="nav-item active" data-screen="home">
      <span class="nav-icon">🏠</span>
      <span class="nav-label">Home</span>
    </button>
    <button class="nav-item" data-screen="library">
      <span class="nav-icon">🎵</span>
      <span class="nav-label">Library</span>
    </button>
    <button class="nav-item" data-screen="sources">
      <span class="nav-icon">🌐</span>
      <span class="nav-label">Sources</span>
    </button>
  </nav>
  
  <div class="sidebar-playlists">
    <h2 class="sidebar-section-title">PLAYLISTS</h2>
    <div class="playlists-list">
      <!-- Last 5 playlists -->
    </div>
    <button class="show-more-btn">Show more</button>
  </div>
</aside>
```

**Styling:**
- Width: 240px
- Background: #000000
- Nav items: 16px font, left-aligned
- Active: green left border + green text (#1DB954)
- Hover: background #181818
- Playlists: 14px font, scrollable, no visible scrollbar

### Mobile Bottom Nav
```html
<nav class="bottom-nav">
  <button class="bottom-nav-item active" data-screen="home">
    <span class="nav-icon">🏠</span>
    <span class="nav-label">Home</span>
  </button>
  <button class="bottom-nav-item" data-screen="search">
    <span class="nav-icon">🔍</span>
    <span class="nav-label">Search</span>
  </button>
  <button class="bottom-nav-item" data-screen="library">
    <span class="nav-icon">🎵</span>
    <span class="nav-label">Library</span>
  </button>
  <button class="bottom-nav-item" data-screen="sources">
    <span class="nav-icon">🌐</span>
    <span class="nav-label">Sources</span>
  </button>
</nav>
```

**Styling:**
- Height: 80px
- Background: #000000
- Icons: 28px
- Labels: 11px
- Active: green color
- Fixed to bottom

### Home Screen Layout
```html
<div id="homeScreen" class="screen active">
  <div class="home-header">
    <h1>MY MUSIC COLLECTION</h1>
    <button id="refreshFoldersBtn" class="icon-btn" title="Refresh">🔄</button>
  </div>
  
  <div class="folder-grid">
    <!-- Folder cards -->
    <div class="folder-card add-folder-card">
      <div class="folder-card-image">
        <span class="add-icon">+</span>
      </div>
      <div class="folder-card-info">
        <h3>Add New Folder</h3>
      </div>
    </div>
  </div>
</div>
```

### Search Screen Layout
```html
<div id="searchScreen" class="screen">
  <div class="search-header">
    <input type="text" id="searchInput" class="search-input" placeholder="Search folders, songs, playlists...">
  </div>
  
  <div id="searchResults" class="search-results">
    <!-- Results grouped by type -->
    <div class="search-section" id="foldersResults">
      <h2>Folders</h2>
      <div class="search-items"></div>
    </div>
    <div class="search-section" id="songsResults">
      <h2>Songs</h2>
      <div class="search-items"></div>
    </div>
    <div class="search-section" id="playlistsResults">
      <h2>Playlists</h2>
      <div class="search-items"></div>
    </div>
  </div>
</div>
```

---

## 🎨 CSS Structure

### New Files

**css/navigation.css**
- Desktop sidebar styles
- Mobile bottom nav styles
- Responsive breakpoints
- Active states and transitions

**css/home.css**
- Folder grid layout
- Folder card styles
- Home header with refresh button
- Add folder card styles
- Responsive columns (2 mobile, 3-4 desktop)

**css/search.css**
- Search input styles
- Results layout
- Grouped sections
- Empty state

### Responsive Breakpoints
```css
:root {
  --sidebar-width: 240px;
  --bottom-nav-height: 80px;
}

/* Mobile */
@media (max-width: 768px) {
  .app-sidebar { display: none; }
  .bottom-nav { display: flex; }
  .app-main { 
    padding-bottom: calc(var(--bottom-nav-height) + var(--mini-player-height));
  }
  .folder-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop */
@media (min-width: 769px) {
  .app-sidebar { display: flex; }
  .bottom-nav { display: none; }
  .app-main { margin-left: var(--sidebar-width); }
  .folder-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
}
```

---

## 🔧 Implementation Steps

### Phase 1: Data Layer (scanner.js, storage.js)
1. Update scanner to detect cover images
2. Add folder metadata schema to storage
3. Store cover image paths and song counts
4. Handle subfolder detection

### Phase 2: Home Module (home.js, home.css)
1. Create home.js module
2. Fetch folders from storage
3. Request Dropbox temp links for covers
4. Build folder card grid
5. Add click handlers
6. Style folder cards (home.css)

### Phase 3: Navigation (navigation.css, index.html)
1. Create navigation.css
2. Build desktop sidebar HTML
3. Build mobile bottom nav HTML
4. Implement responsive breakpoints
5. Active state indicators

### Phase 4: Search Module (search.js, search.css)
1. Create search.js module
2. Implement search algorithm
3. Group results by type
4. Build search UI
5. Style search results (search.css)

### Phase 5: Integration (app.js, library.js, playlists.js, sources.js)
1. Update app.js navigation logic
2. Add folder filtering to library.js
3. Update playlists.js for sidebar
4. Enhance sources.js re-scan trigger
5. Set Home as default screen

### Phase 6: Polish & Testing
1. Test desktop layout
2. Test mobile layout
3. Test cover image loading
4. Test subfolder detection
5. Fix mini player spacing
6. Lazy loading for covers
7. Performance optimization

---

## ✅ Success Criteria

### Desktop
- [ ] Left sidebar visible with navigation
- [ ] Last 5 playlists listed with "Show more"
- [ ] Home page shows folder grid (3-4 columns)
- [ ] Folder cards show cover art or cassette fallback
- [ ] Clicking folder filters Library
- [ ] Search accessible from sidebar
- [ ] No bottom nav visible
- [ ] Mini player doesn't overlap content

### Mobile
- [ ] Bottom nav shows 4 icons (Home/Search/Library/Sources)
- [ ] Home page shows folder grid (2 columns)
- [ ] Same folder card functionality
- [ ] No sidebar visible
- [ ] Touch-friendly targets (44x44px minimum)
- [ ] Mini player above bottom nav

### Both Platforms
- [ ] Home is default landing page
- [ ] Refresh button updates folder collection
- [ ] Search works across folders/songs/playlists
- [ ] Cover images load from Dropbox folders
- [ ] Subfolders show as separate cards
- [ ] "+ Add Folder" navigates to Sources
- [ ] Smooth transitions between screens
- [ ] Maintains Spotify dark theme
- [ ] Performance stays smooth

---

## ⚠️ Edge Cases to Handle

1. **No Folders Selected**
   - Show Sources screen instead of Home
   - Empty state on Home: "Add folders to get started"

2. **Cover Image Loading**
   - Handle expired temp links (4-hour expiry)
   - Lazy load as cards scroll into view
   - Fallback to cassette tape icon

3. **Subfolder Detection**
   - Only show folders with audio files
   - Handle nested folder structures

4. **Duplicate Folder Names**
   - Allow duplicates (user's responsibility)
   - Show full path on hover (tooltip)

5. **Large Folder Collections**
   - Virtual scrolling if >50 folders
   - Performance optimization

6. **Mini Player Spacing**
   - Calculate proper bottom padding
   - Account for bottom nav on mobile

7. **Playlist Overflow**
   - "Show more" expands full list
   - Scrollable without visible scrollbar

8. **Search Empty State**
   - "No results found for '...'"
   - Helpful suggestions

---

## 📝 Code Examples

### Folder Card Generation
```javascript
function createFolderCard(folder) {
  const card = document.createElement('div');
  card.className = 'folder-card';
  card.dataset.folderPath = folder.path;
  
  card.innerHTML = `
    <div class="folder-card-image">
      <img src="${folder.coverImageUrl || 'assets/icons/icon-tape-black.png'}" 
           alt="${folder.name}">
    </div>
    <div class="folder-card-info">
      <h3 class="folder-card-name">${escapeHtml(folder.name)}</h3>
      <p class="folder-card-count">${folder.songCount} ${folder.songCount === 1 ? 'song' : 'songs'}</p>
    </div>
  `;
  
  card.addEventListener('click', () => handleFolderClick(folder.path));
  return card;
}
```

### Folder Filtering in Library
```javascript
export function filterByFolder(folderPath) {
  const filteredTracks = allTracks.filter(track => 
    track.path.startsWith(folderPath)
  );
  
  // Show filtered tracks in Songs view
  currentTab = 'songs';
  displayLibrary('songs', filteredTracks);
  
  // Update header to show filter
  updateLibraryHeader(`Songs from ${getFolderName(folderPath)}`);
}
```

### Responsive Navigation Toggle
```javascript
function updateNavigationForViewport() {
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    showBottomNav();
    hideSidebar();
  } else {
    showSidebar();
    hideBottomNav();
  }
}

window.addEventListener('resize', updateNavigationForViewport);
```

---

## 🚀 Timeline Estimate

- **Phase 1 (Data Layer):** 2-3 hours
- **Phase 2 (Home Module):** 3-4 hours
- **Phase 3 (Navigation):** 2-3 hours
- **Phase 4 (Search Module):** 2-3 hours
- **Phase 5 (Integration):** 2-3 hours
- **Phase 6 (Polish & Testing):** 3-4 hours

**Total:** 14-20 hours

---

## 📚 References

- **Original Mockups:** Desktop and mobile designs provided
- **Spotify Inspiration:** Home page folder grid, sidebar navigation
- **Current Docs:** 
  - `docs/music-player.md` - Technical documentation
  - `docs/todo.md` - Current issues
  - `AI-AGENTS-README.md` - Development guidelines

---

## 🎯 Next Actions

1. ✅ Save this plan to docs folder
2. Begin Phase 1: Enhance scanner and storage
3. Create home.js module with folder grid
4. Build responsive navigation CSS
5. Test on both mobile and desktop
6. Polish and deploy

---

**Plan Status:** Ready for Implementation  
**Approved By:** User  
**Start Date:** January 7, 2026
