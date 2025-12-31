// Vault game state types - v1.5

import { ProgressTrackState } from './progress';

// v1.5: GameState removed - replaced by pool membership
export type GameTier = 'cheap' | 'moderate' | 'epic';

export interface GameProgress {
  currentPower: number;
  maxPower: number;
  isDrained: boolean;
  lastPlaytime: number; // For detecting Key Game plays
  drainedAt?: number; // Timestamp when game became drained (for 10s cooldown)
}

export interface ShopSlot {
  appId: number | null;
  tier: GameTier | null;
}

export interface VaultState {
  // Dual currency (v1.5)
  collectionPower?: number;
  liberationKeys?: number;
  
  // Three pools (v1.5) - arrays of app IDs
  pool1_unlocked?: number[];
  pool2_hidden?: number[];
  pool3_keyGames?: number[];
  
  // Shop state (v1.5)
  shopSlots?: ShopSlot[];
  
  // Game progress tracking (v1.5)
  gameProgress?: { [appId: number]: GameProgress };
  
  // Progress Track (v1.5)
  progressTrack?: ProgressTrackState;
  
  // Metadata
  lastSync?: number;
  steamId?: string;
  version: string;
  
  // Legacy v1.0 fields (for migration compatibility)
  points?: number;
  unlockedGames?: Array<number | string>;
  featuredGame?: number | string | null;
  cachedLibrary?: any[];
  lastRefresh?: number;
}

// Legacy v1.0 types - kept for reference during migration
export type GameState = 'locked' | 'playable' | 'liberationKey';

export interface VaultGameState {
  appid: number | string;
  name: string;
  state: GameState;
  hoursPlayed: number;
  unlockCost: number;
  passiveRate: number;
  clickValue: number;
  isFake?: boolean;
  img_icon_url?: string;
  img_logo_url?: string;
}
