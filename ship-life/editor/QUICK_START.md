# Quick Start Guide - FellowDivers JSON Editor

## What Was Built

A complete local web-based JSON editor for your FellowDivers game data with:
- ✅ Express backend server (Node.js)
- ✅ React frontend (TypeScript + Vite)
- ✅ Auto-save functionality (500ms debounce)
- ✅ Dynamic dropdown options from your data files
- ✅ Multi-file editing with tabs
- ✅ Search, filter, add, delete capabilities
- ✅ Collapsible sections

## How to Start the Editor

### Option 1: Start Both Servers (Development Mode - RECOMMENDED)

**Terminal 1 - API Server:**
```bash
cd c:\Users\GameD\GameDesignerJoe.github.io\ship-life\editor
node server/index.js
```

**Terminal 2 - React Dev Server:**
```bash
cd c:\Users\GameD\GameDesignerJoe.github.io\ship-life\editor\client
npm run dev
```

Then open your browser to: **http://localhost:5173**

### Option 2: Production Mode

First build the client:
```bash
cd c:\Users\GameD\GameDesignerJoe.github.io\ship-life\editor\client
npm run build
```

Then start the server:
```bash
cd c:\Users\GameD\GameDesignerJoe.github.io\ship-life\editor
node server/index.js
```

Then open your browser to: **http://localhost:3001**

## Using the Editor

### 1. Load a File
- You'll see a list of all JSON files from your `data/` folder
- Click on any file (e.g., `guardians.json`, `conversations.json`)
- The file opens in a new tab

### 2. Edit Data
- Navigate items using the sidebar
- Click on any field to edit
- Changes auto-save after 500ms
- Watch the save indicator in the header

### 3. Add New Items
- Click the green "Add New" button
- A blank template is created
- Fill in the fields
- It saves automatically

### 4. Delete Items
- Click the red "Delete" button
- Confirm in the modal

### 5. Search
- Use the search box in the sidebar
- Filters items by name/title/id

## Features

### Smart Field Detection
The editor automatically detects field types:
- **Dropdowns**: Fields like `actor`, `guardian_id`, `item_id` automatically show dropdown lists
- **Textareas**: Fields with "text", "description", or "dialogue" in the name
- **Checkboxes**: Boolean fields
- **Number inputs**: Numeric fields

### Auto-updating Dropdowns
When you add a new guardian, item, or mission, the dropdown options automatically update in all open files!

## Troubleshooting

### If the server won't start:
Check if port 3001 is already in use:
```bash
# Windows
netstat -ano | findstr :3001

# If found, kill the process
taskkill /PID <PID> /F
```

### If changes aren't saving:
- Check the browser console for errors (F12)
- Ensure the server terminal shows no errors
- Verify file permissions in the `data/` folder

### If dropdown options are empty:
- Ensure the server started successfully
- Check server console for cache rebuild messages
- Restart the server

## Project Structure

```
ship-life/editor/
├── server/
│   ├── index.js              # Express API server
│   ├── routes/files.js       # File CRUD endpoints
│   └── utils/dataCache.js    # Caches dropdown options
├── client/
│   ├── src/
│   │   ├── App.tsx           # Main React component
│   │   ├── hooks/useApi.ts   # API communication
│   │   ├── utils/            # Helper functions
│   │   └── components/       # UI components
│   └── dist/                 # Built files (after npm run build)
└── README.md                 # Full documentation
```

## What Happens When You Edit?

1. You type in a field
2. After 500ms of no typing, the app saves to the server
3. Server writes the JSON file to disk
4. Server rebuilds the dropdown cache
5. All open files get updated dropdown options
6. You see "✓ All changes saved" in the header

## Next Steps

1. Start the servers using Option 1 above
2. Open http://localhost:5173 in your browser
3. Click on a JSON file to load it
4. Start editing!

## Support

- See `README.md` for full documentation
- Check the implementation guide: `../docs/editor_implementation_guide.md`
- View the proof of concept: `../docs/json_form_editor.tsx`

---

**Remember**: This is a development tool for local use only. Never expose it to the internet!
