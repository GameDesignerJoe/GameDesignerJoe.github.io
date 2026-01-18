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
    
    // Validate JSON before writing
    const content = JSON.stringify(req.body.data, null, 2);
    JSON.parse(content); // Will throw if invalid
    
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`✓ Saved ${req.params.filename}`);
    res.json({ success: true, filename: req.params.filename });
  } catch (error) {
    console.error(`✗ Error saving ${req.params.filename}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dropdown-options - Get all dropdown options
router.get('/meta/dropdown-options', async (req, res) => {
  const { getDropdownOptions } = require('../utils/dataCache');
  try {
    const options = await getDropdownOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/meta/refresh-cache - Refresh the dropdown options cache
router.post('/meta/refresh-cache', async (req, res) => {
  const { refreshCache } = require('../utils/dataCache');
  try {
    await refreshCache();
    const { getDropdownOptions } = require('../utils/dataCache');
    const options = await getDropdownOptions();
    console.log('✓ Cache refreshed');
    res.json({ success: true, options });
  } catch (error) {
    console.error('✗ Error refreshing cache:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
