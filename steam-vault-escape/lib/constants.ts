// Game formulas and constants - v1.5
// Now loads from balance.json config file

import { GameTier } from '@/types/vault';
import { getBalanceConfig } from './config-loader';

export const FORMULAS = {
  // v1.5: Unlock cost = (Metacritic × Hours to Beat) × multiplier
  unlockCost: (metacritic: number, hoursTobeat: number): number => {
    const config = getBalanceConfig();
    return Math.floor(metacritic * hoursTobeat * config.economy.unlockCostMultiplier);
  },
  
  // v1.5: Click value = (Steam hours played) × multiplier (minimum from config)
  clickValue: (steamMinutes: number): number => {
    const config = getBalanceConfig();
    const baseValue = Math.floor(steamMinutes / 60);
    const multiplied = baseValue * config.progression.clickValueMultiplier;
    return Math.max(config.advanced.minClickValue, multiplied);
  },
  
  // v1.5: Max power = Click value × multiplier (from config)
  maxPower: (clickValue: number): number => {
    const config = getBalanceConfig();
    return clickValue * config.progression.maxPowerMultiplier;
  },
  
  // v1.5: Refresh cost = Click value × multiplier (minimum from config)
  refreshCost: (clickValue: number): number => {
    const config = getBalanceConfig();
    const cost = clickValue * config.progression.refreshCostMultiplier;
    return Math.max(config.advanced.minRefreshCost, cost);
  },
  
  // v1.5: Key reward = Metacritic × multiplier (or fallback from config)
  keyReward: (metacritic: number): number => {
    const config = getBalanceConfig();
    const score = metacritic || config.defaults.defaultMetacritic;
    return Math.floor(score * config.rewards.keyRewardMultiplier);
  },
  
  // v1.5: Tier classification based on unlock cost (thresholds from config)
  getTier: (unlockCost: number): GameTier => {
    const config = getBalanceConfig();
    if (unlockCost < config.tiers.cheapMaxCost) return 'cheap';
    if (unlockCost < config.tiers.moderateMaxCost) return 'moderate';
    return 'epic';
  },
  
  // Legacy v1.0 formulas (for migration)
  unlockCostLegacy: (hours: number): number => Math.max(10, Math.floor(hours * hours * 0.5)),
  passiveRate: (hours: number): number => Math.round(hours * 0.1 * 10) / 10,
  clickValueLegacy: (hours: number): number => Math.round(hours * 0.2 * 10) / 10,
  liberationBonus: (minutes: number): number => 50 + Math.floor(minutes * 0.5),
};

// Helper function to get thresholds from config
function getThreshold<T>(getter: (config: ReturnType<typeof getBalanceConfig>) => T): T {
  return getter(getBalanceConfig());
}

export const THRESHOLDS = {
  // v1.5 thresholds (now loaded from config)
  get KEY_GAME_MIN_PLAYTIME() { return getThreshold(c => c.rewards.keyGameMinMinutes); },
  get DRAW_COST() { return getThreshold(c => c.economy.drawCost); },
  get REDRAW_COST() { return getThreshold(c => c.economy.redrawCost); },
  get STARTING_GAME_METACRITIC_MIN() { return getThreshold(c => c.startingGame.metacriticMin); },
  get STARTING_GAME_METACRITIC_MAX() { return getThreshold(c => c.startingGame.metacriticMax); },
  get STARTING_GAME_HOURS_MIN() { return getThreshold(c => c.startingGame.hoursPlayedMin); },
  get STARTING_GAME_HOURS_MAX() { return getThreshold(c => c.startingGame.hoursPlayedMax); },
  get DEFAULT_METACRITIC() { return getThreshold(c => c.defaults.defaultMetacritic); },
  get DEFAULT_HOURS_TO_BEAT() { return getThreshold(c => c.defaults.defaultHoursTobeat); },
  get PASSIVE_REGEN_RATE_PERCENT() { return getThreshold(c => c.progression.passiveRegenRatePercent); },
  
  // Legacy v1.0 thresholds
  LIBERATION_KEY_MINUTES: 30,
  AUTO_REFRESH_INTERVAL: 300000, // 5 minutes in ms
  SAVE_INTERVAL: 5000, // 5 seconds in ms
  MIN_MANUAL_REFRESH: 10000, // 10 seconds between manual refreshes
};

export const STORAGE_KEY = 'steamVaultState';
export const STORAGE_VERSION = '1.5';
