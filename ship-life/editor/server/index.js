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

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  FellowDivers JSON Editor                 ║`);
  console.log(`║  Running at http://localhost:${PORT}       ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);
  console.log(`Data folder: ${path.join(__dirname, '../../data')}\n`);
});
