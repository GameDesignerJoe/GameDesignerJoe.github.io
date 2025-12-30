// Key Game Detection System for M6
// Detects when player has played a Key Game (30+ minutes), awards keys

import { SteamGame } from '@/types/steam';
import { THRESHOLDS } from './constants';

/**
 * Result of detecting a newly played key game
 */
export interface KeyGameDetectionResult {
  game: SteamGame;
  keysAwarded: number;
  minutesPlayed: number;
}

/**
 * Detect which Key Games (Pool 3) have been played for 30+ minutes
 * by comparing current playtime vs cached playtime
 */
export function detectNewlyPlayedKeyGames(
  currentGames: SteamGame[],
  cachedGames: SteamGame[],
  pool3_keyGames: number[]
): KeyGameDetectionResult[] {
  const results: KeyGameDetectionResult[] = [];
  
  // Check each game in Pool 3
  for (const appId of pool3_keyGames) {
    const currentGame = currentGames.find(g => g.appid === appId);
    const cachedGame = cachedGames.find(g => g.appid === appId);
    
    if (!currentGame) continue; // Game not in current library (shouldn't happen)
    
    const currentMinutes = currentGame.playtime_forever;
    const cachedMinutes = cachedGame?.playtime_forever || 0;
    
    // Check if playtime crossed the 30-minute threshold
    if (cachedMinutes < THRESHOLDS.KEY_GAME_MIN_PLAYTIME && 
        currentMinutes >= THRESHOLDS.KEY_GAME_MIN_PLAYTIME) {
      
      // Calculate key reward (Metacritic score or default)
      const keysAwarded = currentGame.metacritic || THRESHOLDS.DEFAULT_METACRITIC;
      
      results.push({
        game: currentGame,
        keysAwarded,
        minutesPlayed: currentMinutes,
      });
      
      console.log(`[Key Game Detector] 🎉 ${currentGame.name} played! ${currentMinutes} minutes. Awarding ${keysAwarded} keys.`);
    }
  }
  
  return results;
}

/**
 * Calculate total keys to award from detection results
 */
export function calculateTotalKeysAwarded(results: KeyGameDetectionResult[]): number {
  return results.reduce((sum, result) => sum + result.keysAwarded, 0);
}

/**
 * Check if enough time has passed since last sync to trigger detection
 */
export function shouldSync(lastSync: number, syncIntervalMinutes: number = 5): boolean {
  const now = Date.now();
  const timeSinceLastSync = now - lastSync;
  const syncInterval = syncIntervalMinutes * 60 * 1000; // Convert to milliseconds
  
  return timeSinceLastSync >= syncInterval;
}
