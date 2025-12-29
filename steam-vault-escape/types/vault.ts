// Vault game state types

export type GameState = 'locked' | 'playable' | 'liberationKey';

export interface VaultGameState {
  appid: number | string; // 'vault-controller' or Steam App ID
  name: string;
  state: GameState;
  hoursPlayed: number;
  unlockCost: number; // Points needed to unlock
  passiveRate: number; // Points per second
  clickValue: number; // Points per click
  isFake?: boolean; // True for Vault Controller
  img_icon_url?: string;
  img_logo_url?: string;
}

export interface VaultState {
  points: number;
  unlockedGames: Array<number | string>; // App IDs of unlocked games
  featuredGame: number | string | null; // Currently featured game
  cachedLibrary: any[]; // Raw Steam games
  lastRefresh: number; // Unix timestamp
  version: string; // Save format version
  // Victory stats
  hasWon?: boolean;
  totalPointsEarned?: number;
  liberationKeysPlayed?: number;
  mostExpensiveUnlock?: { name: string; cost: number };
  highestPassiveGame?: { name: string; rate: number };
}
