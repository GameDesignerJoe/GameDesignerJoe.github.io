import { CRIME_TYPES, CRIME_STATUS } from '../utils/constants.js';

let crimeIdCounter = 0;

/**
 * Generate crimes for a day based on citizens and grid
 * @param {Citizen[]} citizens
 * @param {GridSquare[]} grid
 * @param {Warden[]} wardens
 * @param {number} currentDay
 * @returns {Crime[]}
 */
export function generateCrimes(citizens, grid, wardens, currentDay) {
  const crimes = [];
  
  // Generate citizen-based crimes
  citizens.forEach(citizen => {
    if (citizen.isWarden) return; // Wardens don't commit crimes (in MVG)
    
    const crimeProbability = calculateCrimeProbability(citizen, grid);
    
    if (Math.random() < crimeProbability) {
      const crime = createCrime(citizen.homeLocation, currentDay);
      crimes.push(crime);
    }
  });
  
  // Generate location-based crimes
  grid.forEach(square => {
    const locationCrimeProbability = square.crimeDensity * 0.08; // 8% base at high density
    
    if (Math.random() < locationCrimeProbability) {
      const crime = createCrime({ x: square.x, y: square.y }, currentDay);
      crimes.push(crime);
    }
  });
  
  // Generate corrupt warden crimes (harassment in quiet areas)
  wardens.forEach(warden => {
    if (warden.corruptionLevel > 30) {
      const corruptCrimes = generateCorruptWardenCrimes(warden, crimes, currentDay);
      crimes.push(...corruptCrimes);
    }
  });
  
  console.log(`📊 Generated ${crimes.length} crimes for Day ${currentDay}`);
  return crimes;
}

/**
 * Calculate crime probability for a citizen based on trust
 * @param {Citizen} citizen
 * @param {GridSquare[]} grid
 * @returns {number}
 */
function calculateCrimeProbability(citizen, grid) {
  let baseProbability = 0.05; // 5% base chance
  
  // Trust factor - lower trust = higher crime
  if (citizen.trustLevel === 'wary') baseProbability *= 1.5;
  if (citizen.trustLevel === 'hostile') baseProbability *= 2.0;
  
  // Location density factor
  const homeSquare = grid.find(s => s.x === citizen.homeLocation.x && s.y === citizen.homeLocation.y);
  if (homeSquare) {
    baseProbability *= homeSquare.crimeDensity;
  }
  
  return Math.min(baseProbability, 0.3); // Cap at 30%
}

/**
 * Create a crime object
 * @param {{x: number, y: number}} location
 * @param {number} currentDay
 * @returns {Crime}
 */
function createCrime(location, currentDay) {
  const crimeTypes = Object.values(CRIME_TYPES);
  const type = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
  
  return {
    id: crimeIdCounter++,
    location,
    timeOfDay: generateRandomTime(),
    type,
    status: CRIME_STATUS.REPORTED, // Will be updated during resolution
    wardenResponder: null,
    isWardenGenerated: false
  };
}

/**
 * Generate crimes by corrupt wardens in quiet areas
 * @param {Warden} warden
 * @param {Crime[]} existingCrimes
 * @param {number} currentDay
 * @returns {Crime[]}
 */
function generateCorruptWardenCrimes(warden, existingCrimes, currentDay) {
  const crimes = [];
  
  // Count crimes in warden's patrol zone
  const patrolZoneCrimes = existingCrimes.filter(c =>
    Math.abs(c.location.x - warden.position.x) <= warden.patrolRadius &&
    Math.abs(c.location.y - warden.position.y) <= warden.patrolRadius
  ).length;
  
  // If quiet area (< 2 crimes), bored warden manufactures incidents
  if (patrolZoneCrimes < 2) {
    const manufactureCount = Math.floor(Math.random() * 2) + 1; // 1-2 incidents
    
    for (let i = 0; i < manufactureCount; i++) {
      const crime = {
        id: crimeIdCounter++,
        location: {
          x: warden.position.x + Math.floor(Math.random() * 3) - 1,
          y: warden.position.y + Math.floor(Math.random() * 3) - 1
        },
        timeOfDay: generateRandomTime(),
        type: Math.random() < 0.5 ? CRIME_TYPES.HARASSMENT : CRIME_TYPES.TRAFFIC,
        status: CRIME_STATUS.RESPONDED, // Warden "solves" it
        wardenResponder: warden.id,
        isWardenGenerated: true
      };
      crimes.push(crime);
    }
  }
  
  return crimes;
}

/**
 * Generate a random time string for flavor
 * @returns {string}
 */
function generateRandomTime() {
  const hour = Math.floor(Math.random() * 12) + 1;
  const minute = Math.floor(Math.random() * 60);
  const period = Math.random() < 0.5 ? 'am' : 'pm';
  return `${hour}:${minute.toString().padStart(2, '0')}${period}`;
}

/**
 * Reset crime ID counter (for new games)
 */
export function resetCrimeCounter() {
  crimeIdCounter = 0;
}
