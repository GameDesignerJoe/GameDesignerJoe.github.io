// Pool management system for v1.5

import { SteamGame } from '@/types/steam';
import { VaultState } from '@/types/vault';
import { THRESHOLDS } from './constants';
import { selectStartingGame, enrichGameWithMetadata } from './game-utils';

/**
 * Initialize the three pools from a Steam library
 * This runs on first load to set up the v1.5 pool system
 */
export async function initializePools(
  steamLibrary: SteamGame[]
): Promise<{
  pool1_unlocked: number[];
  pool2_hidden: number[];
  pool3_keyGames: number[];
  startingGame: SteamGame | null;
}> {
  // Separate games into played (> 0 mins) and never played (0 mins)
  const playedGames = steamLibrary.filter(g => g.playtime_forever > 0);
  const neverPlayedGames = steamLibrary.filter(g => g.playtime_forever === 0);
  
  // Pool 3: All never-played games (Liberation/Key Games)
  const pool3_keyGames = neverPlayedGames.map(g => g.appid);
  
  // Select and enrich starting game
  let startingGame = selectStartingGame(playedGames);
  
  if (startingGame) {
    // Enrich with metadata (Metacritic, hours-to-beat)
    console.log('[Pool Manager] Enriching starting game:', startingGame.name);
    startingGame = await enrichGameWithMetadata(startingGame);
  }
  
  // Pool 1: Starting game (unlocked and playable)
  const pool1_unlocked = startingGame ? [startingGame.appid] : [];
  
  // Pool 2: All other played games (hidden, waiting to be drawn)
  const pool2_hidden = playedGames
    .filter(g => !pool1_unlocked.includes(g.appid))
    .map(g => g.appid);
  
  console.log('[Pool Manager] Pools initialized:', {
    pool1: pool1_unlocked.length,
    pool2: pool2_hidden.length,
    pool3: pool3_keyGames.length,
    startingGame: startingGame?.name || 'None',
  });
  
  return {
    pool1_unlocked,
    pool2_hidden,
    pool3_keyGames,
    startingGame,
  };
}

/**
 * Move a game from Pool 3 (Key Games) to Pool 2 (Hidden) after 30+ min play
 */
export function promoteKeyGame(
  state: VaultState,
  appId: number
): VaultState {
  // Check if game is in Pool 3
  if (!state.pool3_keyGames?.includes(appId)) {
    console.warn('[Pool Manager] Game not in Pool 3:', appId);
    return state;
  }
  
  // Remove from Pool 3
  const newPool3 = state.pool3_keyGames.filter(id => id !== appId);
  
  // Add to Pool 2
  const newPool2 = [...(state.pool2_hidden || []), appId];
  
  console.log(`[Pool Manager] Promoted Key Game ${appId} to Pool 2`);
  
  return {
    ...state,
    pool3_keyGames: newPool3,
    pool2_hidden: newPool2,
  };
}

/**
 * Move a game from Pool 2 (Hidden) to Pool 1 (Unlocked) via shop draw/unlock
 */
export function unlockGame(
  state: VaultState,
  appId: number
): VaultState {
  // Check if game is in Pool 2
  if (!state.pool2_hidden?.includes(appId)) {
    console.warn('[Pool Manager] Game not in Pool 2:', appId);
    return state;
  }
  
  // Remove from Pool 2
  const newPool2 = state.pool2_hidden.filter(id => id !== appId);
  
  // Add to Pool 1
  const newPool1 = [...(state.pool1_unlocked || []), appId];
  
  console.log(`[Pool Manager] Unlocked game ${appId} to Pool 1`);
  
  return {
    ...state,
    pool2_hidden: newPool2,
    pool1_unlocked: newPool1,
  };
}

/**
 * Get games in a specific pool
 */
export function getGamesInPool(
  pool: number[],
  allGames: SteamGame[]
): SteamGame[] {
  return allGames.filter(g => pool.includes(g.appid));
}

/**
 * Check if pools need to be initialized (first time v1.5 user)
 */
export function needsPoolInitialization(state: VaultState | null): boolean {
  // If no save exists, need initialization
  if (!state) return true;
  
  // If version is 1.5 and pools exist, already initialized
  if (state.version === '1.5' && 
      state.pool1_unlocked !== undefined &&
      state.pool2_hidden !== undefined &&
      state.pool3_keyGames !== undefined) {
    return false;
  }
  
  // Otherwise, needs initialization
  return true;
}

/**
 * Get pool statistics for UI
 */
export function getPoolStats(state: VaultState) {
  return {
    pool1_count: state.pool1_unlocked?.length || 0,
    pool2_count: state.pool2_hidden?.length || 0,
    pool3_count: state.pool3_keyGames?.length || 0,
    total: (state.pool1_unlocked?.length || 0) + 
           (state.pool2_hidden?.length || 0) + 
           (state.pool3_keyGames?.length || 0),
  };
}
