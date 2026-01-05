import { CRIME_STATUS } from '../utils/constants.js';
import { isInPatrolZone } from '../utils/gridUtils.js';

/**
 * Resolve crimes based on warden deployment
 * @param {Crime[]} crimes
 * @param {Warden[]} wardens
 * @param {Citizen[]} citizens
 * @returns {Crime[]}
 */
export function resolveCrimes(crimes, wardens, citizens) {
  const resolvedCrimes = crimes.map(crime => {
    // Skip if already resolved (warden-generated crimes)
    if (crime.status === CRIME_STATUS.RESPONDED) {
      return crime;
    }
    
    // Find wardens covering this location
    const coveringWardens = wardens.filter(w =>
      isInPatrolZone(crime.location, w.position, w.patrolRadius)
    );
    
    if (coveringWardens.length === 0) {
      // No coverage - reported or unreported based on citizen trust
      return resolveWithoutWarden(crime, citizens);
    }
    
    // Select responding warden (for simplicity, pick first one)
    const responder = coveringWardens[0];
    
    // Prevention vs response based on warden effectiveness
    const preventionChance = 0.30 - (responder.corruptionLevel / 500);
    
    if (Math.random() < preventionChance) {
      // Prevented before it happened
      crime.status = CRIME_STATUS.PREVENTED;
      crime.wardenResponder = responder.id;
      responder.incidentsHandled++;
      return crime;
    }
    
    // Crime occurs, warden responds
    crime.status = CRIME_STATUS.RESPONDED;
    crime.wardenResponder = responder.id;
    responder.incidentsHandled++;
    
    return crime;
  });
  
  // Log resolution summary
  const prevented = resolvedCrimes.filter(c => c.status === CRIME_STATUS.PREVENTED).length;
  const responded = resolvedCrimes.filter(c => c.status === CRIME_STATUS.RESPONDED).length;
  const reported = resolvedCrimes.filter(c => c.status === CRIME_STATUS.REPORTED).length;
  const unreported = resolvedCrimes.filter(c => c.status === CRIME_STATUS.UNREPORTED).length;
  
  console.log(`🚓 Crime Resolution: ${prevented} prevented, ${responded} responded, ${reported} reported, ${unreported} unreported`);
  
  return resolvedCrimes;
}

/**
 * Resolve crime without warden presence
 * Depends on citizen trust for reporting
 * @param {Crime} crime
 * @param {Citizen[]} citizens
 * @returns {Crime}
 */
function resolveWithoutWarden(crime, citizens) {
  // Find citizens near crime location
  const nearbyCitizens = citizens.filter(c =>
    Math.abs(c.homeLocation.x - crime.location.x) <= 1 &&
    Math.abs(c.homeLocation.y - crime.location.y) <= 1
  );
  
  if (nearbyCitizens.length === 0) {
    // No one around, reported by chance
    crime.status = Math.random() < 0.3 ? CRIME_STATUS.REPORTED : CRIME_STATUS.UNREPORTED;
    return crime;
  }
  
  // Calculate average trust of nearby citizens
  const avgTrustScore = calculateAverageTrust(nearbyCitizens);
  
  // Higher trust = more likely to report
  const reportProbability = avgTrustScore / 100 * 0.8; // Max 80% reporting
  
  crime.status = Math.random() < reportProbability 
    ? CRIME_STATUS.REPORTED 
    : CRIME_STATUS.UNREPORTED;
    
  return crime;
}

/**
 * Calculate average trust score from trust levels
 * @param {Citizen[]} citizens
 * @returns {number} 0-100
 */
function calculateAverageTrust(citizens) {
  const trustScores = citizens.map(c => {
    switch(c.trustLevel) {
      case 'trusting': return 70;
      case 'neutral': return 50;
      case 'wary': return 30;
      case 'hostile': return 10;
      default: return 50;
    }
  });
  
  return trustScores.reduce((sum, score) => sum + score, 0) / trustScores.length;
}
