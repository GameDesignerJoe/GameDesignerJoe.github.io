import { GRID_SIZE, CITIZEN_COUNT, STARTING_WARDENS, CRIME_DENSITY, TRUST_LEVELS } from '../utils/constants.js';
import { GAME_STRUCTURE } from '../config/gameConfig.js';

/**
 * Initialize a 5x5 grid with random crime densities
 * Distribution: 30% low, 50% medium, 20% high
 * @returns {GridSquare[]}
 */
export function initializeGrid() {
  const grid = [];
  const totalSquares = GRID_SIZE * GRID_SIZE;
  
  // Calculate target counts for each density
  const densityTargets = {
    low: Math.floor(totalSquares * 0.30),    // ~7-8 squares
    medium: Math.floor(totalSquares * 0.50),  // ~12-13 squares
    high: Math.floor(totalSquares * 0.20)     // ~5 squares
  };
  
  // Create array of densities to shuffle
  const densities = [
    ...Array(densityTargets.low).fill(CRIME_DENSITY.LOW),
    ...Array(densityTargets.medium).fill(CRIME_DENSITY.MEDIUM),
    ...Array(densityTargets.high).fill(CRIME_DENSITY.HIGH)
  ];
  
  // Fill remaining squares with medium density
  while (densities.length < totalSquares) {
    densities.push(CRIME_DENSITY.MEDIUM);
  }
  
  // Shuffle the densities
  shuffleArray(densities);
  
  // Create grid squares
  let densityIndex = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      grid.push({
        x,
        y,
        crimeDensity: densities[densityIndex],
        crimes: []
      });
      densityIndex++;
    }
  }
  
  return grid;
}

/**
 * Initialize citizens with random home locations
 * Trust levels assigned based on config distribution
 * @param {GridSquare[]} grid
 * @returns {Citizen[]}
 */
export function initializeCitizens(grid) {
  const citizens = [];
  const { initialTrustDistribution } = GAME_STRUCTURE;
  
  // Create array of trust levels based on distribution
  const trustLevels = [
    ...Array(initialTrustDistribution.trusting).fill(TRUST_LEVELS.TRUSTING),
    ...Array(initialTrustDistribution.neutral).fill(TRUST_LEVELS.NEUTRAL),
    ...Array(initialTrustDistribution.wary).fill(TRUST_LEVELS.WARY),
    ...Array(initialTrustDistribution.hostile).fill(TRUST_LEVELS.HOSTILE)
  ];
  
  // Shuffle to randomize assignment
  shuffleArray(trustLevels);
  
  for (let i = 0; i < CITIZEN_COUNT; i++) {
    citizens.push({
      id: i,
      homeLocation: getRandomGridLocation(grid),
      trustLevel: trustLevels[i] || TRUST_LEVELS.NEUTRAL, // Fallback to neutral
      watchExposure: 0,
      isWarden: false,
      wardenId: null
    });
  }
  
  return citizens;
}

/**
 * Initialize wardens from citizen pool
 * Selects random citizens and converts them to wardens
 * @param {Citizen[]} citizens
 * @param {GridSquare[]} grid
 * @returns {Warden[]}
 */
export function initializeWardens(citizens, grid) {
  const wardens = [];
  
  // Shuffle citizens to randomly select wardens
  const shuffledCitizens = [...citizens];
  shuffleArray(shuffledCitizens);
  
  // Select first N citizens to become wardens
  for (let i = 0; i < STARTING_WARDENS; i++) {
    const citizen = shuffledCitizens[i];
    
    // Mark citizen as warden
    citizen.isWarden = true;
    citizen.wardenId = i;
    
    // Create warden object
    wardens.push({
      id: i,
      citizenId: citizen.id,
      position: getRandomGridLocation(grid),
      patrolRadius: 1, // Fixed for MVG
      corruptionLevel: 0,
      daysEmployed: 0,
      incidentsHandled: 0,
      corruptActions: []
    });
  }
  
  return wardens;
}

/**
 * Initialize the complete game state
 * @returns {GameState}
 */
export function initializeGame() {
  const grid = initializeGrid();
  const citizens = initializeCitizens(grid);
  const wardens = initializeWardens(citizens, grid);
  
  console.log('=== Game Initialized ===');
  console.log(`Grid: ${GRID_SIZE}x${GRID_SIZE} (${grid.length} squares)`);
  console.log(`Citizens: ${CITIZEN_COUNT} (${citizens.filter(c => !c.isWarden).length} civilians, ${STARTING_WARDENS} wardens)`);
  console.log(`Crime Density Distribution:`, {
    low: grid.filter(s => s.crimeDensity === CRIME_DENSITY.LOW).length,
    medium: grid.filter(s => s.crimeDensity === CRIME_DENSITY.MEDIUM).length,
    high: grid.filter(s => s.crimeDensity === CRIME_DENSITY.HIGH).length
  });
  
  return {
    currentDay: 1,
    phase: 'placement',
    citizens,
    wardens,
    grid,
    dailyReports: [],
    finalAudit: null,
    selectedWardenId: null
  };
}

// Utility Functions

/**
 * Get a random grid location
 * @param {GridSquare[]} grid
 * @returns {{x: number, y: number}}
 */
function getRandomGridLocation(grid) {
  const x = Math.floor(Math.random() * GRID_SIZE);
  const y = Math.floor(Math.random() * GRID_SIZE);
  return { x, y };
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle in place
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
