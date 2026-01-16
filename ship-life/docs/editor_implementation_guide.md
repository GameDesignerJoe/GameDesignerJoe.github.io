# FellowDivers JSON Editor - Implementation Guide

## Project Overview
Build a local web-based editor for FellowDivers game data files (JSON). The editor runs as a Node.js/Express server that serves a React UI and provides API endpoints to read/write JSON files directly in the project's `data/` folder.

## Architecture

### Tech Stack
- **Backend**: Node.js + Express
- **Frontend**: React + TypeScript (bundled with Webpack or Vite)
- **Communication**: REST API for file operations
- **Styling**: Tailwind CSS (matching the proof of concept)

### Folder Structure
```
ship-life/
├── data/                          # Game JSON files
│   ├── conversations.json
│   ├── guardians.json
│   ├── items.json
│   ├── missions.json
│   ├── workstations.json
│   ├── blueprints.json
│   └── rooms.json
├── editor/                        # Editor application
│   ├── server/
│   │   ├── index.js              # Express server
│   │   ├── routes/
│   │   │   └── files.js          # File CRUD endpoints
│   │   └── utils/
│   │       ├── dataCache.js      # Cache for dropdown options
│   │       └── fileWatcher.js    # Watch for external changes
│   ├── client/
│   │   ├── src/
│   │   │   ├── App.tsx           # Main React app (from proof of concept)
│   │   │   ├── components/
│   │   │   │   ├── FileTab.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Editor.tsx
│   │   │   │   └── Modal.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useApi.ts     # API communication
│   │   │   └── types.ts
│   │   ├── public/
│   │   └── package.json
│   ├── package.json              # Editor package.json
│   └── README.md
├── src/                          # Game source code
└── package.json                  # Game package.json
```

## Implementation Steps

### Phase 1: Server Setup

#### 1.1 Initialize Editor Project
```bash
cd ship-life
mkdir editor
cd editor
npm init -y
npm install express cors chokidar
npm install --save-dev nodemon
```

#### 1.2 Create Express Server (`server/index.js`)
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const fileRoutes = require('./routes/files');
const { initDataCache } = require('./utils/dataCache');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static frontend files (after build)
app.use(express.static(path.join(__dirname, '../client/dist')));

// API routes
app.use('/api/files', fileRoutes);

// Initialize data cache for dropdowns
initDataCache(path.join(__dirname, '../../data'));

// Start server
app.listen(PORT, () => {
  console.log(`FellowDivers Editor running at http://localhost:${PORT}`);
  console.log(`Data folder: ${path.join(__dirname, '../../data')}`);
});
```

#### 1.3 File CRUD Routes (`server/routes/files.js`)
```javascript
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '../../../data');

// GET /api/files - List all JSON files
router.get('/', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    res.json({ files: jsonFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/files/:filename - Read a specific file
router.get('/:filename', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    res.json({ filename: req.params.filename, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/files/:filename - Update a file
router.put('/:filename', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, req.params.filename);
    const content = JSON.stringify(req.body.data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    res.json({ success: true, filename: req.params.filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dropdown-options - Get all dropdown options
router.get('/dropdown-options', async (req, res) => {
  const { getDropdownOptions } = require('../utils/dataCache');
  try {
    const options = await getDropdownOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### 1.4 Data Cache for Dropdowns (`server/utils/dataCache.js`)
```javascript
const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

let dataCache = {
  guardians: [],
  items: [],
  missions: [],
  workstations: [],
  blueprints: [],
  conversationTypes: ['important', 'background'],
  playerCharReq: ['any']
};

let dataDir = '';

async function buildCache() {
  try {
    // Read guardians
    const guardiansFile = await fs.readFile(path.join(dataDir, 'guardians.json'), 'utf-8');
    const guardians = JSON.parse(guardiansFile);
    dataCache.guardians = guardians.guardians ? guardians.guardians.map(g => g.id) : [];
    dataCache.playerCharReq = ['any', ...dataCache.guardians];

    // Read items
    const itemsFile = await fs.readFile(path.join(dataDir, 'items.json'), 'utf-8');
    const items = JSON.parse(itemsFile);
    dataCache.items = items.items ? items.items.map(i => i.id) : [];

    // Read missions
    const missionsFile = await fs.readFile(path.join(dataDir, 'missions.json'), 'utf-8');
    const missions = JSON.parse(missionsFile);
    dataCache.missions = missions.missions ? missions.missions.map(m => m.id) : [];

    // Read workstations
    const workstationsFile = await fs.readFile(path.join(dataDir, 'workstations.json'), 'utf-8');
    const workstations = JSON.parse(workstationsFile);
    dataCache.workstations = workstations.workstations ? workstations.workstations.map(w => w.id) : [];

    // Read blueprints
    const blueprintsFile = await fs.readFile(path.join(dataDir, 'blueprints.json'), 'utf-8');
    const blueprints = JSON.parse(blueprintsFile);
    dataCache.blueprints = blueprints.blueprints ? blueprints.blueprints.map(b => b.id) : [];

    console.log('Data cache rebuilt:', {
      guardians: dataCache.guardians.length,
      items: dataCache.items.length,
      missions: dataCache.missions.length,
      workstations: dataCache.workstations.length,
      blueprints: dataCache.blueprints.length
    });
  } catch (error) {
    console.error('Error building cache:', error);
  }
}

function initDataCache(dir) {
  dataDir = dir;
  
  // Build initial cache
  buildCache();

  // Watch for file changes and rebuild cache
  const watcher = chokidar.watch(dataDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('change', (filePath) => {
    console.log(`File ${filePath} changed, rebuilding cache...`);
    buildCache();
  });
}

function getDropdownOptions() {
  return dataCache;
}

module.exports = { initDataCache, getDropdownOptions };
```

#### 1.5 Update package.json scripts
```json
{
  "name": "fellowdivers-editor",
  "version": "1.0.0",
  "scripts": {
    "start": "node server/index.js",
    "dev": "nodemon server/index.js",
    "build:client": "cd client && npm run build",
    "postinstall": "cd client && npm install"
  }
}
```

### Phase 2: React Frontend

#### 2.1 Initialize React App
```bash
cd editor
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install lucide-react
```

#### 2.2 Create API Hook (`client/src/hooks/useApi.ts`)
```typescript
import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

export interface DropdownOptions {
  guardians: string[];
  items: string[];
  missions: string[];
  workstations: string[];
  blueprints: string[];
  conversationTypes: string[];
  playerCharReq: string[];
}

export function useApi() {
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions | null>(null);

  useEffect(() => {
    loadDropdownOptions();
  }, []);

  const loadDropdownOptions = async () => {
    try {
      const response = await fetch(`${API_BASE}/dropdown-options`);
      const data = await response.json();
      setDropdownOptions(data);
    } catch (error) {
      console.error('Failed to load dropdown options:', error);
    }
  };

  const listFiles = async () => {
    const response = await fetch(`${API_BASE}/files`);
    return response.json();
  };

  const loadFile = async (filename: string) => {
    const response = await fetch(`${API_BASE}/files/${filename}`);
    return response.json();
  };

  const saveFile = async (filename: string, data: any) => {
    const response = await fetch(`${API_BASE}/files/${filename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    
    // Reload dropdown options after save (in case new items were added)
    await loadDropdownOptions();
    
    return response.json();
  };

  return {
    dropdownOptions,
    listFiles,
    loadFile,
    saveFile
  };
}
```

#### 2.3 Adapt Proof of Concept React Code

**Key changes from the proof of concept:**

1. **Remove file upload input** - Replace with file picker that calls `listFiles()` API
2. **Replace state management** - Use API calls instead of local state
3. **Auto-save** - Debounce saves (500ms after last edit) using the `saveFile()` API
4. **Use dynamic dropdown options** - Get from `dropdownOptions` instead of hardcoded OPTIONS

**File loading flow:**
```typescript
// Instead of FileReader:
const handleFileSelect = async (filename: string) => {
  const result = await loadFile(filename);
  setOpenFiles(prev => [...prev, {
    name: result.filename,
    data: result.data,
    activeTab: 0,
    isDirty: false
  }]);
};
```

**Auto-save with debounce:**
```typescript
const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

const updateValue = (path: string[], value: any) => {
  // Update local state immediately for UI responsiveness
  const newFiles = [...openFiles];
  // ... update logic ...
  newFiles[activeFileIndex].isDirty = true;
  setOpenFiles(newFiles);

  // Debounce save
  if (saveTimeout) clearTimeout(saveTimeout);
  const timeout = setTimeout(async () => {
    await saveFile(newFiles[activeFileIndex].name, newFiles[activeFileIndex].data);
    newFiles[activeFileIndex].isDirty = false;
    setOpenFiles([...newFiles]);
  }, 500);
  setSaveTimeout(timeout);
};
```

**Dropdown field mapping:**
```typescript
// Map field names to dropdown option keys
const getDropdownOptions = (fieldName: string): string[] | null => {
  const mapping: Record<string, keyof DropdownOptions> = {
    'actor': 'guardians',
    'type': 'conversationTypes',
    'player_char_req': 'playerCharReq',
    'item': 'items',
    'blueprint_required': 'blueprints',
    'unlocks_recipe': 'items'
  };

  const optionKey = mapping[fieldName];
  return optionKey && dropdownOptions ? dropdownOptions[optionKey] : null;
};

// Use in renderField:
const fieldOptions = getDropdownOptions(key);
```

#### 2.4 Build Configuration

Update `client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist'
  }
});
```

### Phase 3: Integration with Game Project

#### 3.1 Add Editor Scripts to Game's package.json

In `ship-life/package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "edit-data": "cd editor && npm run dev",
    "edit-data:build": "cd editor && npm run build:client && npm start"
  }
}
```

#### 3.2 Usage Workflow

**Development (both running in dev mode):**
```bash
# Terminal 1 - Run game
npm run dev

# Terminal 2 - Run editor
npm run edit-data
```

**Production editor (built frontend):**
```bash
# One-time build
cd editor
npm run build:client

# Run editor
npm start
# Opens at http://localhost:3001
```

### Phase 4: Features to Implement

Copy these features from the proof of concept artifact:

✅ **Multi-file tabs** - Load multiple JSON files, switch between them
✅ **Sidebar with search** - Filter items by name/title/participants
✅ **Collapsible sections** - Expand/collapse sections to save space
✅ **Add new item** - Green "Add New" button creates blank template
✅ **Delete with confirmation** - Red "Delete" button with modal
✅ **Compact dialogue lines** - Actor dropdown + text field in single row
✅ **Reorder lines** - Up/down arrows to move dialogue lines
✅ **Auto-save indicator** - Show "Saving..." / "All changes saved"
✅ **Dirty state indicators** - Dot on tab when file has unsaved changes
✅ **Dynamic dropdowns** - Populate from API cache

### Phase 5: Testing Checklist

- [ ] Server starts successfully on port 3001
- [ ] Can list all JSON files from data folder
- [ ] Can load each file type (conversations, guardians, items, etc.)
- [ ] Can open multiple files simultaneously in tabs
- [ ] Changes save automatically after 500ms
- [ ] Dropdown options populate from actual data files
- [ ] Add new guardian → appears in conversation participant dropdowns immediately
- [ ] Delete item shows confirmation modal
- [ ] Search/filter works in sidebar
- [ ] Reorder dialogue lines with up/down arrows
- [ ] Collapsible sections expand/collapse correctly
- [ ] Close tab with unsaved changes shows warning
- [ ] External file changes trigger cache rebuild
- [ ] Can run alongside game dev server without conflicts

## Error Handling

### Server-side
- Validate JSON before writing files
- Return clear error messages to client
- Log errors to console with timestamps
- Handle missing files gracefully

### Client-side
- Show error toast for failed operations
- Validate required fields before saving
- Show warning for broken references (e.g., conversation referencing deleted guardian)
- Graceful fallback if dropdown options fail to load

## Performance Considerations

- Debounce auto-save to avoid excessive writes
- Cache dropdown options in memory
- Only rebuild cache when relevant files change
- Use React.memo for expensive components
- Lazy-load collapsed sections (don't render hidden fields)

## Security Notes

**This is a development tool, not production:**
- Runs on localhost only
- No authentication required
- Direct file system access
- Should NOT be exposed to public internet
- Add `.gitignore` for `node_modules`, `dist`, etc.

## Future Enhancements (Post-MVP)

- Undo/redo support
- Duplicate item command
- Batch operations (delete multiple, export selection)
- Visual graph of conversation prerequisites
- Find references (show where an item is used)
- Import/export data folder as ZIP
- Hot reload game data when editor saves (using WebSocket)

## File Reference

### Key Files to Create

1. `editor/server/index.js` - Main Express server
2. `editor/server/routes/files.js` - File CRUD endpoints
3. `editor/server/utils/dataCache.js` - Dropdown options cache
4. `editor/client/src/App.tsx` - Main React component (adapt from proof of concept)
5. `editor/client/src/hooks/useApi.ts` - API communication hook
6. `editor/package.json` - Editor dependencies and scripts
7. `editor/README.md` - Usage instructions

### Dependencies

**Server:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "chokidar": "^3.5.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**Client:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

## Getting Started

### Initial Setup (One-time)
```bash
cd ship-life
mkdir editor
cd editor

# Initialize and install server dependencies
npm init -y
npm install express cors chokidar
npm install --save-dev nodemon

# Create server structure
mkdir -p server/routes server/utils
# Create files as specified above

# Initialize React client
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install lucide-react

# Return to editor root
cd ..
```

### Daily Usage
```bash
# From ship-life root directory

# Terminal 1 - Game development
npm run dev

# Terminal 2 - Data editing
npm run edit-data
```

## Success Criteria

The editor is complete when:
✅ You can load any JSON file from the data folder
✅ Edit and save changes without copy-paste
✅ Changes appear immediately in your git status
✅ Dropdowns show current guardians, items, missions, etc.
✅ Adding a new guardian updates conversation dropdowns instantly
✅ The workflow feels faster than manual JSON editing
✅ No data loss, clear save indicators, reliable auto-save

---

## Notes for Implementation

- Start with Phase 1 (server) to establish API
- Then Phase 2 (frontend) adapting the proof of concept
- Test each file operation thoroughly before moving on
- The proof of concept artifact contains all the UI/UX logic - adapt it to use the API instead of local state
- Focus on reliability over features - auto-save must work perfectly