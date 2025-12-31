// Progress Track Types

export type RewardType = 'power' | 'keys' | 'refresh' | 'keyGames';

export interface ProgressReward {
  type: RewardType;
  amount: number;
  icon: string; // '⚡' | '🔑' | '♻️' | '⭐'
  label: string; // Display text
}

export interface UnlockedGame {
  appId: number;
  unlockTimestamp: number;
  tier: 'cheap' | 'moderate' | 'epic'; // For border color
  name: string;
}

export interface ProgressTrackState {
  nextReward: ProgressReward;
  unlockedGames: UnlockedGame[];
}

// Build reward pool from balance config
export function buildRewardPool(config?: any): ProgressReward[] {
  const powerRewards = config?.progressTrack?.powerRewards || [250, 750, 1250];
  const keyRewards = config?.progressTrack?.keyRewards || [3, 6, 13];
  
  const pool: ProgressReward[] = [];
  
  // Add power rewards
  powerRewards.forEach((amount: number) => {
    pool.push({ type: 'power', amount, icon: '⚡', label: 'Collection Power' });
  });
  
  // Add key rewards
  keyRewards.forEach((amount: number) => {
    pool.push({ type: 'keys', amount, icon: '🔑', label: 'Keys' });
  });
  
  return pool;
}

// Default reward pool (fallback)
export const REWARD_POOL: ProgressReward[] = buildRewardPool();

// Pick a random reward from the pool
export function pickRandomReward(pool: ProgressReward[] = REWARD_POOL, config?: any): ProgressReward {
  const rewardPool = config ? buildRewardPool(config) : pool;
  return rewardPool[Math.floor(Math.random() * rewardPool.length)];
}

// Get tier-based border color
export function getTierBorderColor(tier: 'cheap' | 'moderate' | 'epic'): string {
  const colors = {
    cheap: 'border-gray-400',
    moderate: 'border-blue-500',
    epic: 'border-vault-gold',
  };
  return colors[tier];
}
