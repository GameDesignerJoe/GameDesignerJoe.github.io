# FellowDivers JSON Editor

A local web-based editor for editing FellowDivers game data files (JSON). This tool provides a user-friendly interface for managing game data without manually editing JSON files.

## Features

- ✅ **Multi-file editing** - Open multiple JSON files in tabs
- ✅ **Auto-save** - Changes are automatically saved after 500ms
- ✅ **Dynamic dropdowns** - Field values automatically populated from other data files
- ✅ **Search & filter** - Quickly find items by name/title/id
- ✅ **Add/delete items** - With confirmation modals
- ✅ **Collapsible sections** - Keep your workspace organized
- ✅ **Real-time cache updates** - Dropdown options update when files change
- ✅ **Save indicators** - Visual feedback for save status

## Installation

### First-time Setup

```bash
# From the ship-life directory
cd editor

# Install server dependencies
npm install

# Install client dependencies (automatically runs via postinstall)
# Or manually:
cd client
npm install
cd ..
```

## Usage

### Development Mode (Recommended)

Run both the server and client in development mode for hot-reloading:

```bash
# Terminal 1 - Start the API server
cd ship-life/editor
npm run dev

# Terminal 2 - Start the React dev server
cd ship-life/editor/client
npm run dev

# Open browser to http://localhost:5173
```

### Production Mode

Build the client and run from the server:

```bash
# From ship-life/editor directory
npm run build:client
npm start

# Open browser to http://localhost:3001
```

## Quick Start Scripts

From the **ship-life root directory**, you can use:

```bash
# Run editor in dev mode (run server manually in another terminal)
npm run edit-data
```

## How It Works

### Architecture

1. **Express Server** (`server/index.js`)
   - Runs on port 3001
   - Provides REST API for file operations
   - Watches data files for changes
   - Caches dropdown options

2. **React Frontend** (`client/`)
   - Modern React + TypeScript + Vite
   - Tailwind CSS for styling
   - API-based file loading/saving

3. **Data Cache** (`server/utils/dataCache.js`)
   - Automatically scans all JSON files
   - Extracts IDs for dropdown options
   - Updates when files change

### API Endpoints

- `GET /api/files` - List all JSON files
- `GET /api/files/:filename` - Load a specific file
- `PUT /api/files/:filename` - Save changes to a file
- `GET /api/files/meta/dropdown-options` - Get cached dropdown options

## Supported Data Files

The editor automatically works with all JSON files in the `ship-life/data/` directory:

- `anomalies.json`
- `blueprints.json`
- `conversations.json`
- `guardians.json`
- `items.json`
- `missions.json`
- `rooms.json`
- `trophies.json`
- `workstations.json`

New JSON files added to the data folder are automatically detected!

## Field Type Detection

The editor intelligently detects field types:

- **Dropdowns** - Automatically created for fields like:
  - `actor`, `guardian`, `guardian_id` → Guardian names
  - `item`, `item_id` → Item IDs
  - `mission`, `mission_id` → Mission IDs
  - `room`, `room_id` → Room IDs
  - `type` → Conversation types
  - And more...

- **Textareas** - Fields containing "text", "description", or "dialogue"
- **Checkboxes** - Boolean fields
- **Number inputs** - Numeric fields
- **Text inputs** - Everything else

## Tips & Tricks

### Keyboard Workflow
- Open multiple files in tabs for easy cross-referencing
- Use the search box to quickly filter items
- Changes auto-save every 500ms - no need to manually save!

### Adding New Items
1. Click the green "Add New" button
2. A blank template is created based on existing items
3. Fill in the fields
4. It auto-saves!

### Deleting Items
1. Select the item you want to delete
2. Click the red "Delete" button
3. Confirm in the modal
4. Done!

### Dropdown Updates
When you add a new guardian, item, or other entity, the dropdown options automatically update across all open files. No need to reload!

## Troubleshooting

### Port 3001 already in use

```bash
# Find and kill the process using port 3001
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3001 | xargs kill
```

### Changes not saving

- Check the save indicator in the header
- Look for error messages in the browser console
- Ensure the server is running
- Verify file permissions in the data folder

### Dropdown options not showing

- Ensure the server is running
- Check that data files have the correct structure
- Restart the server to rebuild the cache

## Development

### Project Structure

```
editor/
├── server/
│   ├── index.js              # Express server
│   ├── routes/
│   │   └── files.js          # API endpoints
│   └── utils/
│       └── dataCache.js      # Dropdown options cache
├── client/
│   ├── src/
│   │   ├── App.tsx           # Main React component
│   │   ├── main.tsx          # Entry point
│   │   ├── types.ts          # TypeScript types
│   │   ├── components/       # Reusable components
│   │   ├── hooks/            # Custom hooks (API)
│   │   └── utils/            # Helper functions
│   ├── index.html
│   └── vite.config.ts
├── package.json              # Server dependencies
└── README.md                 # This file
```

### Adding New Field Mappings

Edit `client/src/utils/fieldHelpers.ts` and add to the `mapping` object:

```typescript
const mapping: Record<string, keyof DropdownOptions> = {
  'your_field_name': 'dataSource',
  // e.g., 'character_id': 'guardians'
};
```

## Security Notes

⚠️ **This is a development tool for local use only!**

- No authentication
- Direct file system access
- Should NOT be exposed to the internet
- Runs on localhost only

## License

Part of the FellowDivers game project.
