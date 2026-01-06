import { AUDIT_CONFIG, SCORE_CONFIG } from '../config/gameConfig.js';

/**
 * Independent Audit System
 * Analyzes complete game data and generates final evaluation
 */

/**
 * Calculate audit results from complete game state
 * @param {GameState} gameState
 * @returns {AuditResults}
 */
export function calculateAudit(gameState) {
  // Aggregate crime statistics
  const totalCrimesPrevented = gameState.dailyReports.reduce((sum, r) => sum + r.crimesPrevented, 0);
  const totalCrimesResponded = gameState.dailyReports.reduce((sum, r) => sum + r.crimesResponded, 0);
  const totalCrimesReported = gameState.dailyReports.reduce((sum, r) => sum + r.crimesReported, 0);
  const totalEstimatedUnreported = gameState.dailyReports.reduce((sum, r) => 
    sum + Math.floor((r.estimatedUnreported.min + r.estimatedUnreported.max) / 2), 0
  );

  // Calculate warden metrics
  const avgCorruption = gameState.wardens.reduce((sum, w) => sum + w.corruptionLevel, 0) / gameState.wardens.length;
  const maxCorruption = Math.max(...gameState.wardens.map(w => w.corruptionLevel));
  const corruptWardenCount = gameState.wardens.filter(w => w.corruptionLevel > 30).length;

  // Calculate citizen trust metrics
  const civilians = gameState.citizens.filter(c => !c.isWarden);
  const trustDistribution = {
    trusting: civilians.filter(c => c.trustLevel === 'trusting').length,
    neutral: civilians.filter(c => c.trustLevel === 'neutral').length,
    wary: civilians.filter(c => c.trustLevel === 'wary').length,
    hostile: civilians.filter(c => c.trustLevel === 'hostile').length
  };
  
  const avgWatchExposure = civilians.reduce((sum, c) => sum + c.watchExposure, 0) / civilians.length;

  // Calculate overall scores
  const crimeControlScore = calculateCrimeControlScore(
    totalCrimesPrevented,
    totalCrimesResponded,
    totalCrimesReported,
    totalEstimatedUnreported
  );
  
  const corruptionScore = 100 - avgCorruption; // Inverse - higher is better
  
  const trustScore = calculateTrustScore(trustDistribution);

  // Determine outcome classification
  const outcome = classifyOutcome(crimeControlScore, corruptionScore, trustScore);

  // Generate narrative
  const narrative = generateNarrative(outcome, crimeControlScore, corruptionScore, trustScore);

  // Generate key findings
  const keyFindings = generateKeyFindings(
    gameState,
    avgCorruption,
    trustDistribution,
    totalEstimatedUnreported
  );

  return {
    outcome,
    crimeStats: {
      prevented: totalCrimesPrevented,
      responded: totalCrimesResponded,
      reported: totalCrimesReported,
      unreported: totalEstimatedUnreported,
      total: totalCrimesPrevented + totalCrimesResponded + totalCrimesReported + totalEstimatedUnreported
    },
    wardenMetrics: {
      averageCorruption: avgCorruption,
      maxCorruption,
      corruptWardenCount,
      totalWardens: gameState.wardens.length
    },
    trustMetrics: {
      distribution: trustDistribution,
      averageWatchExposure: avgWatchExposure
    },
    scores: {
      crimeControl: crimeControlScore,
      corruption: corruptionScore,
      trust: trustScore,
      overall: Math.floor((crimeControlScore + corruptionScore + trustScore) / 3)
    },
    narrative,
    keyFindings
  };
}

/**
 * Calculate crime control effectiveness score (0-100)
 */
function calculateCrimeControlScore(prevented, responded, reported, unreported) {
  const total = prevented + responded + reported + unreported;
  if (total === 0) return 50;
  
  const handledWell = prevented * 1.0 + responded * 0.8;
  const handledPoorly = reported * 0.4 + unreported * 0.0;
  
  return Math.min(100, Math.floor(((handledWell + handledPoorly) / total) * 100));
}

/**
 * Calculate trust score based on distribution (0-100)
 */
function calculateTrustScore(distribution) {
  const total = distribution.trusting + distribution.neutral + distribution.wary + distribution.hostile;
  if (total === 0) return 50;
  
  const score = (
    distribution.trusting * 100 +
    distribution.neutral * 50 +
    distribution.wary * 25 +
    distribution.hostile * 0
  ) / total;
  
  return Math.floor(score);
}

/**
 * Classify outcome based on scores
 */
function classifyOutcome(crimeScore, corruptionScore, trustScore) {
  const { balancedThresholds, authoritarianThresholds, neglectfulThresholds, chaosThresholds } = AUDIT_CONFIG;
  
  // High crime control, low corruption, high trust = IDEAL (rare)
  if (crimeScore >= balancedThresholds.crimeControl && 
      corruptionScore >= balancedThresholds.corruption && 
      trustScore >= balancedThresholds.trust) {
    return 'balanced';
  }
  
  // High crime control, low corruption/trust = AUTHORITARIAN
  if (crimeScore >= authoritarianThresholds.crimeControl && 
      (corruptionScore < authoritarianThresholds.corruptionMax || 
       trustScore < authoritarianThresholds.trustMax)) {
    return 'authoritarian';
  }
  
  // Low crime control, high trust = NEGLECTFUL
  if (crimeScore < neglectfulThresholds.crimeControlMax && 
      trustScore >= neglectfulThresholds.trust) {
    return 'neglectful';
  }
  
  // Low everything = CHAOS
  if (crimeScore < chaosThresholds.crimeControlMax && 
      corruptionScore < chaosThresholds.corruptionMax && 
      trustScore < chaosThresholds.trustMax) {
    return 'chaos';
  }
  
  // Middle ground
  return 'mixed';
}

/**
 * Generate narrative summary
 */
function generateNarrative(outcome, crimeScore, corruptionScore, trustScore) {
  const narratives = {
    balanced: [
      "Remarkable. Your deployment achieved the near-impossible: effective crime prevention while maintaining citizen trust and warden integrity.",
      "The data shows a carefully balanced approach that neither over-policed nor neglected the community.",
      "This outcome is rare and suggests thoughtful, measured leadership."
    ],
    authoritarian: [
      "The numbers reveal an authoritarian pattern. Crime stats look impressive, but at what cost?",
      "Your wardens achieved control through constant presence and harsh measures.",
      "Citizens feel surveilled. Trust has eroded. The corruption metrics are alarming.",
      "You chose order over freedom. History will judge whether it was worth it."
    ],
    neglectful: [
      "The audit shows a hands-off approach that prioritized privacy over protection.",
      "Low watch presence preserved citizen autonomy but left them vulnerable.",
      "Crime festered in neglected areas. Victims felt abandoned.",
      "You chose freedom over order, but some paid the price."
    ],
    chaos: [
      "The data paints a troubling picture. Neither effective crime control nor citizen trust were achieved.",
      "Wardens became corrupt without proper oversight. Citizens lost faith.",
      "The worst of both worlds: invasive yet ineffective policing.",
      "A case study in failed policy implementation."
    ],
    mixed: [
      "The audit reveals a complex outcome with mixed results.",
      "Some metrics are strong, others concerning. The tradeoffs you made are evident in the data.",
      "Not a clear success or failure, but rather a realistic picture of difficult choices under pressure."
    ]
  };
  
  return narratives[outcome];
}

/**
 * Generate key findings bullet points
 */
function generateKeyFindings(gameState, avgCorruption, trustDistribution, unreported) {
  const findings = [];
  
  // Corruption findings
  if (avgCorruption > 70) {
    findings.push("⚠️ CRITICAL: Average warden corruption reached " + avgCorruption.toFixed(0) + "%. Systemic abuse likely occurred.");
  } else if (avgCorruption > 40) {
    findings.push("⚠️ WARNING: Moderate corruption detected (" + avgCorruption.toFixed(0) + "%). Wardens may have overstepped authority.");
  } else {
    findings.push("✓ Warden corruption remained relatively low (" + avgCorruption.toFixed(0) + "%).");
  }
  
  // Trust findings
  if (trustDistribution.hostile > 0) {
    findings.push("⚠️ " + trustDistribution.hostile + " citizens became openly hostile to The Watch.");
  }
  if (trustDistribution.trusting > 4) {
    findings.push("✓ Strong citizen support maintained - " + trustDistribution.trusting + " citizens remained trusting.");
  }
  
  // Unreported crime findings
  if (unreported > 15) {
    findings.push("⚠️ High unreported crime (" + unreported + " estimated) suggests citizens don't trust reporting.");
  } else if (unreported < 5) {
    findings.push("✓ Low unreported crime suggests strong citizen cooperation.");
  }
  
  // Watch exposure
  const civilians = gameState.citizens.filter(c => !c.isWarden);
  const avgExposure = civilians.reduce((sum, c) => sum + c.watchExposure, 0) / civilians.length;
  if (avgExposure > 10) {
    findings.push("⚠️ Citizens experienced heavy watch presence (avg " + avgExposure.toFixed(1) + " exposure days).");
  }
  
  return findings;
}
