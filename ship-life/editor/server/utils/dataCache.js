const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

let dataCache = {
  guardians: [],
  items: [],
  missions: [],
  workstations: [],
  blueprints: [],
  rooms: [],
  anomalies: [],
  trophies: [],
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

    // Read rooms
    const roomsFile = await fs.readFile(path.join(dataDir, 'rooms.json'), 'utf-8');
    const rooms = JSON.parse(roomsFile);
    dataCache.rooms = rooms.rooms ? rooms.rooms.map(r => r.id) : [];

    // Read anomalies
    const anomaliesFile = await fs.readFile(path.join(dataDir, 'anomalies.json'), 'utf-8');
    const anomalies = JSON.parse(anomaliesFile);
    dataCache.anomalies = anomalies.anomalies ? anomalies.anomalies.map(a => a.id) : [];

    // Read trophies
    const trophiesFile = await fs.readFile(path.join(dataDir, 'trophies.json'), 'utf-8');
    const trophies = JSON.parse(trophiesFile);
    dataCache.trophies = trophies.trophies ? trophies.trophies.map(t => t.id) : [];

    console.log('Data cache rebuilt:', {
      guardians: dataCache.guardians.length,
      items: dataCache.items.length,
      missions: dataCache.missions.length,
      workstations: dataCache.workstations.length,
      blueprints: dataCache.blueprints.length,
      rooms: dataCache.rooms.length,
      anomalies: dataCache.anomalies.length,
      trophies: dataCache.trophies.length
    });
  } catch (error) {
    console.error('Error building cache:', error.message);
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

  watcher.on('add', (filePath) => {
    if (filePath.endsWith('.json')) {
      console.log(`New file ${filePath} detected, rebuilding cache...`);
      buildCache();
    }
  });
}

function getDropdownOptions() {
  return dataCache;
}

module.exports = { initDataCache, getDropdownOptions };
