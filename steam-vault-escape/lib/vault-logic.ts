// Game economy calculations and state logic

import { SteamGame } from '@/types/steam';
import { GameState, VaultGameState } from '@/types/vault';
import { FORMULAS } from './constants';

/**
 * Classify a game into one of three states
 */
export function classifyGame(
  game: SteamGame | any,
  unlockedGames: Array<number | string>
): GameState {
  // Never played = Liberation Key
  if (game.playtime_forever === 0) {
    return 'liberationKey';
  }
  
  // Played but not unlocked = Locked
  if (!unlockedGames.includes(game.appid)) {
    return 'locked';
  }
  
  // Otherwise playable
  return 'playable';
}

/**
 * Calculate game stats based on playtime
 */
export function calculateGameStats(game: SteamGame): {
  hoursPlayed: number;
  unlockCost: number;
  passiveRate: number;
  clickValue: number;
} {
  const hours = game.playtime_forever / 60;
  
  return {
    hoursPlayed: Math.round(hours * 10) / 10,
    unlockCost: FORMULAS.unlockCostLegacy(hours), // Using legacy v1.0 formula during transition
    passiveRate: FORMULAS.passiveRate(hours),
    clickValue: FORMULAS.clickValueLegacy(hours), // Using legacy v1.0 formula during transition
  };
}

/**
 * Calculate total passive income from all unlocked games
 */
export function calculateTotalPassive(
  games: SteamGame[],
  unlockedGames: Array<number | string>
): number {
  let total = 0;
  
  games.forEach(game => {
    if (unlockedGames.includes(game.appid)) {
      const stats = calculateGameStats(game);
      total += stats.passiveRate;
    }
  });
  
  return Math.round(total * 10) / 10; // 1 decimal precision
}

/**
 * Convert Steam game to VaultGameState
 */
export function toVaultGameState(
  game: SteamGame | any,
  unlockedGames: Array<number | string>
): VaultGameState {
  const state = classifyGame(game, unlockedGames);
  const stats = calculateGameStats(game);
  
  return {
    appid: game.appid,
    name: game.name,
    state,
    hoursPlayed: stats.hoursPlayed,
    unlockCost: stats.unlockCost,
    passiveRate: stats.passiveRate,
    clickValue: stats.clickValue,
    isFake: game.appid === 'vault-controller' || game.isFake === true,
    img_icon_url: game.img_icon_url,
    img_logo_url: game.img_logo_url,
  };
}

/**
 * Calculate Liberation Key bonus
 */
export function calculateLiberationBonus(minutesPlayed: number): number {
  return FORMULAS.liberationBonus(minutesPlayed);
}

/**
 * Detect newly unlocked Liberation Keys
 */
export function detectNewUnlocks(
  newLibrary: SteamGame[],
  cachedLibrary: SteamGame[]
): Array<{ game: SteamGame; bonus: number }> {
  const newUnlocks: Array<{ game: SteamGame; bonus: number }> = [];
  
  newLibrary.forEach(newGame => {
    const cached = cachedLibrary.find(g => g.appid === newGame.appid);
    
    if (!cached) {
      // New game added to library (shouldn't happen often)
      return;
    }
    
    const oldMinutes = cached.playtime_forever;
    const newMinutes = newGame.playtime_forever;
    
    // Crossed 30-minute threshold?
    if (oldMinutes < 30 && newMinutes >= 30) {
      const bonus = calculateLiberationBonus(newMinutes);
      newUnlocks.push({ game: newGame, bonus });
    }
  });
  
  return newUnlocks;
}
