import { TRUST_LEVELS } from '../utils/constants.js';
import { isInPatrolZone } from '../utils/gridUtils.js';
import { CORRUPTION_CONFIG, TRUST_CONFIG } from '../config/gameConfig.js';

/**
 * Update warden corruption levels
 * @param {Warden[]} wardens
 * @param {Crime[]} crimes
 * @returns {Warden[]}
 */
export function updateWardenCorruption(wardens, crimes) {
  wardens.forEach(warden => {
    let corruptionIncrease = CORRUPTION_CONFIG.baseDailyIncrease;
    
    // Count crimes in patrol zone
    const crimesInZone = crimes.filter(c =>
      isInPatrolZone(c.location, warden.position, warden.patrolRadius)
    ).length;
    
    // Boredom factor (low activity)
    if (crimesInZone < CORRUPTION_CONFIG.boredomThreshold) {
      corruptionIncrease += CORRUPTION_CONFIG.boredomBonus;
    }
    // Burnout factor (high activity)
    else if (crimesInZone > CORRUPTION_CONFIG.burnoutThreshold) {
      corruptionIncrease += CORRUPTION_CONFIG.burnoutBonus;
    }
    
    warden.corruptionLevel = Math.min(CORRUPTION_CONFIG.maxCorruption, warden.corruptionLevel + corruptionIncrease);
    warden.daysEmployed++;
    
    // Log corrupt actions if corruption is high
    if (warden.corruptionLevel > CORRUPTION_CONFIG.corruptActionThreshold && Math.random() < CORRUPTION_CONFIG.corruptActionChance) {
      const action = {
        day: 0, // Will be set by simulation
        type: 'excessive_force',
        location: warden.position,
        description: `Used excessive force in patrol area`,
        affectedCitizenIds: []
      };
      warden.corruptActions.push(action);
    }
  });
  
  const avgCorruption = wardens.reduce((sum, w) => sum + w.corruptionLevel, 0) / wardens.length;
  console.log(`👮 Warden Corruption: Avg ${avgCorruption.toFixed(1)} (${wardens.filter(w => w.corruptionLevel > 30).length}/${wardens.length} corrupted)`);
  
  return wardens;
}

/**
 * Update citizen trust levels based on warden presence and experiences
 * @param {Citizen[]} citizens
 * @param {Warden[]} wardens
 * @param {Crime[]} crimes
 * @returns {Citizen[]}
 */
export function updateCitizenTrust(citizens, wardens, crimes) {
  citizens.forEach(citizen => {
    if (citizen.isWarden) return; // Wardens don't have trust scores
    
    let trustChange = 0;
    
    // Watch exposure factor - being in patrolled area decreases trust
    const wardensNearHome = wardens.filter(w =>
      isInPatrolZone(citizen.homeLocation, w.position, w.patrolRadius)
    ).length;
    
    trustChange += wardensNearHome * TRUST_CONFIG.watchExposurePenalty;
    citizen.watchExposure += wardensNearHome;
    
    // Crime victim factor
    const wasVictim = crimes.some(c =>
      c.location.x === citizen.homeLocation.x &&
      c.location.y === citizen.homeLocation.y
    );
    
    if (wasVictim) {
      const victimCrime = crimes.find(c =>
        c.location.x === citizen.homeLocation.x &&
        c.location.y === citizen.homeLocation.y
      );
      
      if (victimCrime.status === 'prevented' || victimCrime.status === 'responded') {
        trustChange += TRUST_CONFIG.goodResponseBonus;
      } else if (victimCrime.status === 'unreported') {
        trustChange += TRUST_CONFIG.noResponsePenalty;
      }
    }
    
    // Apply trust change and update level
    const currentScore = getTrustScore(citizen.trustLevel);
    const newScore = Math.max(0, Math.min(100, currentScore + trustChange));
    citizen.trustLevel = getTrustLevelFromScore(newScore);
  });
  
  // Log trust distribution
  const distribution = {
    trusting: citizens.filter(c => !c.isWarden && c.trustLevel === TRUST_LEVELS.TRUSTING).length,
    neutral: citizens.filter(c => !c.isWarden && c.trustLevel === TRUST_LEVELS.NEUTRAL).length,
    wary: citizens.filter(c => !c.isWarden && c.trustLevel === TRUST_LEVELS.WARY).length,
    hostile: citizens.filter(c => !c.isWarden && c.trustLevel === TRUST_LEVELS.HOSTILE).length
  };
  
  console.log(`👥 Citizen Trust: ${distribution.trusting} trusting, ${distribution.neutral} neutral, ${distribution.wary} wary, ${distribution.hostile} hostile`);
  
  return citizens;
}

/**
 * Get numeric trust score from trust level
 * @param {string} trustLevel
 * @returns {number}
 */
function getTrustScore(trustLevel) {
  switch(trustLevel) {
    case TRUST_LEVELS.TRUSTING: return 70;
    case TRUST_LEVELS.NEUTRAL: return 50;
    case TRUST_LEVELS.WARY: return 30;
    case TRUST_LEVELS.HOSTILE: return 10;
    default: return 50;
  }
}

/**
 * Get trust level from numeric score
 * @param {number} score
 * @returns {string}
 */
function getTrustLevelFromScore(score) {
  if (score >= TRUST_CONFIG.trustThresholds.trusting) return TRUST_LEVELS.TRUSTING;
  if (score >= TRUST_CONFIG.trustThresholds.neutral) return TRUST_LEVELS.NEUTRAL;
  if (score >= TRUST_CONFIG.trustThresholds.wary) return TRUST_LEVELS.WARY;
  return TRUST_LEVELS.HOSTILE;
}
