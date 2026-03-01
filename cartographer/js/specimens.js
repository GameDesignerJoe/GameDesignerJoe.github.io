// ============================================================
// THE CARTOGRAPHER - specimens.js
// Specimen type definitions, procedural placement, collection.
// Also contains island name generation.
// ============================================================

import { GRID, SPECIMEN_COLLECT_RADIUS } from './config.js';
import { state } from './state.js';
import { getTerrain } from './terrain.js';

export const SPECIMEN_TYPES = [
  // Beach
  { name: 'Sea Shell',      emoji: '🐚', terrain: 'beach'    },
  { name: 'Coral Fragment', emoji: '🪸', terrain: 'beach'    },
  { name: 'Hermit Crab',    emoji: '🦀', terrain: 'beach'    },
  { name: 'Starfish',       emoji: '⭐', terrain: 'beach'    },
  // Lowland
  { name: 'Giant Beetle',   emoji: '🪲', terrain: 'lowland'  },
  { name: 'Butterfly',      emoji: '🦋', terrain: 'lowland'  },
  { name: 'Wild Berries',   emoji: '🫐', terrain: 'lowland'  },
  { name: 'River Stone',    emoji: '🪨', terrain: 'lowland'  },
  // Forest
  { name: 'Blue Orchid',    emoji: '🌺', terrain: 'forest'   },
  { name: 'Wild Mushroom',  emoji: '🍄', terrain: 'forest'   },
  { name: 'Bird Feather',   emoji: '🪶', terrain: 'forest'   },
  { name: 'Tree Frog',      emoji: '🐸', terrain: 'forest'   },
  { name: 'Pine Cone',      emoji: '🌲', terrain: 'forest'   },
  // Highland
  { name: 'Fern Fossil',    emoji: '🌿', terrain: 'highland' },
  { name: 'Ancient Coin',   emoji: '🪙', terrain: 'highland' },
  { name: 'Volcanic Glass', emoji: '💎', terrain: 'highland' },
  { name: 'Quartz Crystal', emoji: '🔮', terrain: 'highland' },
  { name: 'Amber Insect',   emoji: '🫙', terrain: 'highland' },
];

const NAME_PREFIXES = ['Port', 'Isle of', 'Cape', 'Mount', 'Fort', 'St.'];
const NAME_WORDS    = ['Whitmore', 'Ashdown', 'Blackwater', 'Fernhollow', 'Greymist',
                       'Bramley', 'Thornwick', 'Seagrove', 'Dunhaven', 'Millcrest'];

export function generateIslandName() {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const word   = NAME_WORDS[Math.floor(Math.random() * NAME_WORDS.length)];
  return `${prefix} ${word}`;
}

const SPECIMENS_PER_ISLAND = 6;

// Randomly select 6 specimen types, place each on a matching terrain tile.
// Returns the generated specimens array (also mutates state.specimens).
export function generateSpecimens() {
  // Build per-terrain tile pools
  const terrainPools = {};
  for (let tx = 0; tx < GRID; tx++) {
    for (let ty = 0; ty < GRID; ty++) {
      const t = getTerrain(tx, ty);
      if (t !== 'water') {
        if (!terrainPools[t]) terrainPools[t] = [];
        terrainPools[t].push({ tx, ty });
      }
    }
  }

  state.specimens = [];
  state.collectedSpecimens = [];

  // Shuffle the full pool, then pick the first 6 that have a valid tile
  const shuffled = [...SPECIMEN_TYPES].sort(() => Math.random() - 0.5);
  for (const spec of shuffled) {
    if (state.specimens.length >= SPECIMENS_PER_ISLAND) break;
    const pool = terrainPools[spec.terrain];
    if (pool && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const tile = pool.splice(idx, 1)[0]; // remove to prevent duplicates
      state.specimens.push({ ...spec, tx: tile.tx, ty: tile.ty, collected: false });
    }
  }

  return state.specimens;
}

// Attempt to collect any uncollected specimen within range of player.
// Returns index of collected specimen, or -1 if none.
export function tryCollectSpecimen() {
  for (let i = 0; i < state.specimens.length; i++) {
    const spec = state.specimens[i];
    if (spec.collected) continue;
    const dx = state.player.x - (spec.tx + 0.5);
    const dy = state.player.y - (spec.ty + 0.5);
    if (Math.sqrt(dx * dx + dy * dy) < SPECIMEN_COLLECT_RADIUS) {
      spec.collected = true;
      state.collectedSpecimens.push(spec);
      return i;
    }
  }
  return -1;
}
