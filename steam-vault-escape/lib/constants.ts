// Game formulas and constants

export const FORMULAS = {
  // Unlock cost: hours² × 0.5, minimum 10 points
  unlockCost: (hours: number): number => Math.max(10, Math.floor(hours * hours * 0.5)),
  
  // Passive rate: hours × 0.1 (rounded to 1 decimal)
  passiveRate: (hours: number): number => Math.round(hours * 0.1 * 10) / 10,
  
  // Click value: hours × 0.2 (rounded to 1 decimal)
  clickValue: (hours: number): number => Math.round(hours * 0.2 * 10) / 10,
  
  // Liberation bonus: 50 + (minutes × 0.5)
  liberationBonus: (minutes: number): number => 50 + Math.floor(minutes * 0.5),
};

export const THRESHOLDS = {
  LIBERATION_KEY_MINUTES: 30, // Min play time to unlock key
  AUTO_REFRESH_INTERVAL: 300000, // 5 minutes in ms
  SAVE_INTERVAL: 5000, // 5 seconds in ms
  MIN_MANUAL_REFRESH: 10000, // 10 seconds between manual refreshes
};

export const VAULT_CONTROLLER = {
  appid: 'vault-controller',
  name: 'The Vault Controller',
  playtime_forever: 300, // Equivalent to 5 hours
  img_icon_url: 'vault-controller-icon',
  img_logo_url: 'vault-controller-icon',
  isFake: true,
};

export const STORAGE_KEY = 'steamVaultState';
export const STORAGE_VERSION = '1.0';
