// Click Manager for v1.5
// Handles clicking games to generate Collection Power

import { SteamGame } from '@/types/steam';
import { GameProgress } from '@/types/vault';
import { FORMULAS } from './constants';

export interface ClickResult {
  powerGained: number;
  isDrained: boolean;
  newProgress: GameProgress;
}

/**
 * Handle clicking a game to generate Collection Power
 */
export function handleGameClick(
  game: SteamGame,
  currentProgress: GameProgress | undefined
): ClickResult {
  // Calculate click value (power per click)
  const clickValue = FORMULAS.clickValue(game.playtime_forever);
  
  // Calculate max power this game can generate
  const maxPower = FORMULAS.maxPower(clickValue);
  
  // Get current progress or initialize
  const progress = currentProgress || {
    currentPower: 0,
    maxPower: maxPower,
    isDrained: false,
    lastPlaytime: game.playtime_forever,
  };
  
  // Check if already drained
  if (progress.isDrained) {
    return {
      powerGained: 0,
      isDrained: true,
      newProgress: progress,
    };
  }
  
  // Add power
  const newCurrentPower = progress.currentPower + clickValue;
  
  // Check if drained after this click
  const isDrained = newCurrentPower >= maxPower;
  
  // Cap at max power
  const finalPower = isDrained ? maxPower : newCurrentPower;
  
  const newProgress: GameProgress = {
    currentPower: finalPower,
    maxPower: maxPower,
    isDrained: isDrained,
    lastPlaytime: game.playtime_forever,
    drainedAt: isDrained ? Date.now() : progress.drainedAt, // Set timestamp when drained, preserve if already set
  };
  
  return {
    powerGained: clickValue,
    isDrained: isDrained,
    newProgress: newProgress,
  };
}

/**
 * Calculate refresh cost for a drained game
 * Cost = Click value (so refreshing a 10-hour game costs 10 keys)
 */
export function calculateRefreshCost(game: SteamGame): number {
  const clickValue = FORMULAS.clickValue(game.playtime_forever);
  return FORMULAS.refreshCost(clickValue);
}

/**
 * Refresh a drained game (reset its power)
 */
export function refreshDrainedGame(
  game: SteamGame,
  currentProgress: GameProgress
): GameProgress {
  const clickValue = FORMULAS.clickValue(game.playtime_forever);
  const maxPower = FORMULAS.maxPower(clickValue);
  
  return {
    currentPower: 0,
    maxPower: maxPower,
    isDrained: false,
    lastPlaytime: game.playtime_forever,
  };
}

/**
 * Auto-refresh all drained games (used when Key Game is played)
 */
export function autoRefreshAllDrained(
  gameProgress: { [appId: number]: GameProgress }
): { [appId: number]: GameProgress } {
  const updated = { ...gameProgress };
  
  for (const appId in updated) {
    if (updated[appId].isDrained) {
      updated[appId] = {
        ...updated[appId],
        currentPower: 0,
        isDrained: false,
      };
    }
  }
  
  return updated;
}

/**
 * Get click value for a game (for display purposes)
 */
export function getClickValue(game: SteamGame): number {
  return FORMULAS.clickValue(game.playtime_forever);
}

/**
 * Get max power for a game (for display purposes)
 */
export function getMaxPower(game: SteamGame): number {
  const clickValue = FORMULAS.clickValue(game.playtime_forever);
  return FORMULAS.maxPower(clickValue);
}

/**
 * Calculate full recharge duration in seconds
 * Formula: 100% / (percent per second) = total seconds
 */
export function calculateRechargeDuration(game: SteamGame): number {
  const maxPower = getMaxPower(game);
  const regenRatePercent = 0.5; // 0.5% per second from config (THRESHOLDS.PASSIVE_REGEN_RATE_PERCENT)
  
  // Time to recharge = 100% / (percent per second)
  const secondsToFullRecharge = 100 / regenRatePercent;
  
  return secondsToFullRecharge; // 200 seconds for 0.5%/sec
}
