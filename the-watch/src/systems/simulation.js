import { generateCrimes } from './crime.js';
import { resolveCrimes } from './resolution.js';
import { updateWardenCorruption, updateCitizenTrust } from './updates.js';

/**
 * Run one day of simulation
 * @param {GameState} gameState
 * @returns {GameState}
 */
export function simulateDay(gameState) {
  console.log(`\n🎮 === SIMULATING DAY ${gameState.currentDay} ===`);
  
  // 1. Generate crimes
  const crimes = generateCrimes(
    gameState.citizens,
    gameState.grid,
    gameState.wardens,
    gameState.currentDay
  );
  
  // 2. Resolve crimes based on warden placement
  const resolvedCrimes = resolveCrimes(
    crimes,
    gameState.wardens,
    gameState.citizens
  );
  
  // 3. Update warden corruption
  updateWardenCorruption(gameState.wardens, resolvedCrimes);
  
  // 4. Update citizen trust
  updateCitizenTrust(gameState.citizens, gameState.wardens, resolvedCrimes);
  
  // 5. Update grid with crimes
  const updatedGrid = gameState.grid.map(square => ({
    ...square,
    crimes: resolvedCrimes.filter(c =>
      c.location.x === square.x && c.location.y === square.y
    )
  }));
  
  // 6. Generate daily report data (for M4)
  const report = generateReportData(gameState.currentDay, resolvedCrimes, gameState.wardens);
  
  console.log(`✅ Day ${gameState.currentDay} simulation complete!\n`);
  
  return {
    ...gameState,
    grid: updatedGrid,
    dailyReports: [...gameState.dailyReports, report],
    phase: 'placement' // Stay in placement for now (will be 'report' in M4)
  };
}

/**
 * Generate report data from simulation results
 * @param {number} day
 * @param {Crime[]} crimes
 * @param {Warden[]} wardens
 * @returns {Report}
 */
function generateReportData(day, crimes, wardens) {
  const prevented = crimes.filter(c => c.status === 'prevented').length;
  const responded = crimes.filter(c => c.status === 'responded').length;
  const reported = crimes.filter(c => c.status === 'reported').length;
  const unreported = crimes.filter(c => c.status === 'unreported').length;
  
  return {
    day,
    crimesPrevented: prevented,
    crimesResponded: responded,
    crimesReported: reported,
    estimatedUnreported: {
      min: Math.floor(unreported * 0.7),
      max: Math.ceil(unreported * 1.3)
    },
    notableIncidents: generateNotableIncidents(crimes, 3),
    wardenDeployment: wardens.map(w => ({
      id: w.id,
      position: w.position
    }))
  };
}

/**
 * Generate notable incident descriptions for flavor
 * @param {Crime[]} crimes
 * @param {number} count
 * @returns {string[]}
 */
function generateNotableIncidents(crimes, count) {
  // Pick random crimes for flavor text
  const shuffled = [...crimes].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, crimes.length));
  
  return selected.map(crime => {
    const statusText = crime.status === 'prevented' ? 'prevented by'
      : crime.status === 'responded' ? 'responded to by'
      : crime.status === 'reported' ? 'reported by citizen'
      : 'unreported';
    
    const wardenText = crime.wardenResponder !== null
      ? ` Warden #${crime.wardenResponder + 1}`
      : '';
    
    return `${crime.type} at [${crime.location.x}, ${crime.location.y}], ${crime.timeOfDay} - ${statusText}${wardenText}`;
  });
}
