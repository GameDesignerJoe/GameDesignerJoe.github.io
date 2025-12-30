// Game formulas and constants - v1.5

import { GameTier } from '@/types/vault';

export const FORMULAS = {
  // v1.5: Unlock cost = Metacritic × Hours to Beat
  unlockCost: (metacritic: number, hoursTobeat: number): number => 
    Math.floor(metacritic * hoursTobeat),
  
  // v1.5: Click value = Steam hours played (minimum 1)
  clickValue: (steamMinutes: number): number => 
    Math.max(1, Math.floor(steamMinutes / 60)),
  
  // v1.5: Max power = Click value × 100
  maxPower: (clickValue: number): number => 
    clickValue * 100,
  
  // v1.5: Refresh cost = Click value (playtime-based, minimum 1)
  refreshCost: (clickValue: number): number => 
    Math.max(1, clickValue),
  
  // v1.5: Key reward = Metacritic score (or fallback)
  keyReward: (metacritic: number): number => 
    metacritic || 70,
  
  // v1.5: Tier classification based on unlock cost
  getTier: (unlockCost: number): GameTier => {
    if (unlockCost < 1000) return 'cheap';
    if (unlockCost < 3000) return 'moderate';
    return 'epic';
  },
  
  // Legacy v1.0 formulas (for migration)
  unlockCostLegacy: (hours: number): number => Math.max(10, Math.floor(hours * hours * 0.5)),
  passiveRate: (hours: number): number => Math.round(hours * 0.1 * 10) / 10,
  clickValueLegacy: (hours: number): number => Math.round(hours * 0.2 * 10) / 10,
  liberationBonus: (minutes: number): number => 50 + Math.floor(minutes * 0.5),
};

export const THRESHOLDS = {
  // v1.5 thresholds
  KEY_GAME_MIN_PLAYTIME: 30, // Minutes
  DRAW_COST: 10, // Keys to draw new game
  REDRAW_COST: 5, // Keys to redraw
  STARTING_GAME_METACRITIC_MIN: 70,
  STARTING_GAME_METACRITIC_MAX: 79,
  STARTING_GAME_HOURS_MIN: 5,
  STARTING_GAME_HOURS_MAX: 10,
  DEFAULT_METACRITIC: 70,
  DEFAULT_HOURS_TO_BEAT: 30,
  
  // Legacy v1.0 thresholds
  LIBERATION_KEY_MINUTES: 30,
  AUTO_REFRESH_INTERVAL: 300000, // 5 minutes in ms
  SAVE_INTERVAL: 5000, // 5 seconds in ms
  MIN_MANUAL_REFRESH: 10000, // 10 seconds between manual refreshes
};

export const STORAGE_KEY = 'steamVaultState';
export const STORAGE_VERSION = '1.5';
