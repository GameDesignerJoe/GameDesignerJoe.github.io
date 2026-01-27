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
  planets: [],
  activities: [],
  conversationTypes: ['important', 'background'],
  playerCharReq: ['any'],
  roomImages: [],
  guardianImages: [],
  missionImages: [],
  itemImages: [],
  workstationImages: [],
  mapImages: [],
  locationImages: []
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

    // Read blueprints from items.json (filter by type: 'blueprint')
    // This replaces the deprecated blueprints.json file
    dataCache.blueprints = items.items 
      ? items.items
          .filter(i => i.type === 'blueprint')
          .map(i => i.id)
          .sort((a, b) => a.localeCompare(b))
      : [];

    // Read missions
    const missionsFile = await fs.readFile(path.join(dataDir, 'missions.json'), 'utf-8');
    const missions = JSON.parse(missionsFile);
    dataCache.missions = missions.missions ? missions.missions.map(m => m.id) : [];

    // Read workstations
    const workstationsFile = await fs.readFile(path.join(dataDir, 'workstations.json'), 'utf-8');
    const workstations = JSON.parse(workstationsFile);
    dataCache.workstations = workstations.workstations ? workstations.workstations.map(w => w.id) : [];

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

    // Read planets
    const planetsFile = await fs.readFile(path.join(dataDir, 'planets.json'), 'utf-8');
    const planets = JSON.parse(planetsFile);
    dataCache.planets = planets.planets ? planets.planets.map(p => p.id) : [];

    // Read activities
    const activitiesFile = await fs.readFile(path.join(dataDir, 'activities.json'), 'utf-8');
    const activities = JSON.parse(activitiesFile);
    dataCache.activities = activities.activities ? activities.activities.map(a => a.id) : [];

    // Scan image folders
    const assetsDir = path.join(dataDir, '../assets/images');
    const imageFolders = ['rooms', 'guardians', 'missions', 'items', 'workstations', 'planets', 'locations'];
    
    for (const folder of imageFolders) {
      const folderPath = path.join(assetsDir, folder);
      const cacheKey = `${folder}Images`;
      
      try {
        const files = await fs.readdir(folderPath);
        dataCache[cacheKey] = files
          .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))
          .map(f => `${folder}/${f}`);
      } catch (error) {
        console.error(`Could not read ${folder} images:`, error.message);
        dataCache[cacheKey] = [];
      }
    }

    console.log('Data cache rebuilt:', {
      guardians: dataCache.guardians.length,
      items: dataCache.items.length,
      missions: dataCache.missions.length,
      workstations: dataCache.workstations.length,
      blueprints: dataCache.blueprints.length,
      rooms: dataCache.rooms.length,
      anomalies: dataCache.anomalies.length,
      trophies: dataCache.trophies.length,
      planets: dataCache.planets.length,
      activities: dataCache.activities.length
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

function refreshCache() {
  console.log('Refreshing data cache...');
  return buildCache();
}

module.exports = { initDataCache, getDropdownOptions, refreshCache };
