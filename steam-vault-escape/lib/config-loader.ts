// Balance Configuration Loader
// Loads balance.json and provides typed access to all balance values

export interface BalanceConfig {
  economy: {
    drawCost: number;
    redrawCost: number;
    unlockCostMultiplier: number;
  };
  progression: {
    clickValueMultiplier: number;
    maxPowerMultiplier: number;
    passiveRegenRatePercent: number;
    regenCooldownSeconds: number;
    refreshCostMultiplier: number;
  };
  rewards: {
    keyRewardMultiplier: number;
    keyGameMinMinutes: number;
    autoRefreshOnKeyComplete: boolean;
  };
  tiers: {
    cheapMaxCost: number;
    moderateMaxCost: number;
  };
  startingGame: {
    metacriticMin: number;
    metacriticMax: number;
    hoursPlayedMin: number;
    hoursPlayedMax: number;
  };
  defaults: {
    defaultMetacritic: number;
    defaultHoursTobeat: number;
  };
  advanced: {
    minClickValue: number;
    minRefreshCost: number;
    playtimeBasedUnlockCosts: boolean;
  };
}

// Default config (fallback if file fails to load)
const DEFAULT_CONFIG: BalanceConfig = {
  economy: {
    drawCost: 10,
    redrawCost: 5,
    unlockCostMultiplier: 1.0,
  },
  progression: {
    clickValueMultiplier: 1.0,
    maxPowerMultiplier: 100,
    passiveRegenRatePercent: 0.5,
    regenCooldownSeconds: 10,
    refreshCostMultiplier: 1.0,
  },
  rewards: {
    keyRewardMultiplier: 1.0,
    keyGameMinMinutes: 30,
    autoRefreshOnKeyComplete: true,
  },
  tiers: {
    cheapMaxCost: 1000,
    moderateMaxCost: 3000,
  },
  startingGame: {
    metacriticMin: 70,
    metacriticMax: 79,
    hoursPlayedMin: 5,
    hoursPlayedMax: 10,
  },
  defaults: {
    defaultMetacritic: 70,
    defaultHoursTobeat: 30,
  },
  advanced: {
    minClickValue: 1,
    minRefreshCost: 1,
    playtimeBasedUnlockCosts: false,
  },
};

let cachedConfig: BalanceConfig | null = null;

/**
 * Load balance configuration from JSON file
 */
export async function loadBalanceConfig(): Promise<BalanceConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch('/config/balance.json');
    if (!response.ok) {
      throw new Error(`Failed to load balance.json: ${response.status}`);
    }

    const rawConfig = await response.json();
    
    // Filter out comment fields (those starting with _)
    const config: BalanceConfig = {
      economy: {
        drawCost: rawConfig.economy.drawCost,
        redrawCost: rawConfig.economy.redrawCost,
        unlockCostMultiplier: rawConfig.economy.unlockCostMultiplier,
      },
      progression: {
        clickValueMultiplier: rawConfig.progression.clickValueMultiplier,
        maxPowerMultiplier: rawConfig.progression.maxPowerMultiplier,
        passiveRegenRatePercent: rawConfig.progression.passiveRegenRatePercent,
        regenCooldownSeconds: rawConfig.progression.regenCooldownSeconds,
        refreshCostMultiplier: rawConfig.progression.refreshCostMultiplier,
      },
      rewards: {
        keyRewardMultiplier: rawConfig.rewards.keyRewardMultiplier,
        keyGameMinMinutes: rawConfig.rewards.keyGameMinMinutes,
        autoRefreshOnKeyComplete: rawConfig.rewards.autoRefreshOnKeyComplete,
      },
      tiers: {
        cheapMaxCost: rawConfig.tiers.cheapMaxCost,
        moderateMaxCost: rawConfig.tiers.moderateMaxCost,
      },
      startingGame: {
        metacriticMin: rawConfig.startingGame.metacriticMin,
        metacriticMax: rawConfig.startingGame.metacriticMax,
        hoursPlayedMin: rawConfig.startingGame.hoursPlayedMin,
        hoursPlayedMax: rawConfig.startingGame.hoursPlayedMax,
      },
      defaults: {
        defaultMetacritic: rawConfig.defaults.defaultMetacritic,
        defaultHoursTobeat: rawConfig.defaults.defaultHoursTobeat,
      },
      advanced: {
        minClickValue: rawConfig.advanced.minClickValue,
        minRefreshCost: rawConfig.advanced.minRefreshCost,
        playtimeBasedUnlockCosts: rawConfig.advanced.playtimeBasedUnlockCosts,
      },
    };

    cachedConfig = config;
    console.log('[Balance Config] Loaded successfully:', config);
    return config;
  } catch (error) {
    console.error('[Balance Config] Failed to load, using defaults:', error);
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

/**
 * Get current balance config (must call loadBalanceConfig first)
 */
export function getBalanceConfig(): BalanceConfig {
  if (!cachedConfig) {
    console.warn('[Balance Config] Not loaded yet, returning defaults');
    return DEFAULT_CONFIG;
  }
  return cachedConfig;
}

/**
 * Clear cached config (useful for hot-reloading in dev)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  console.log('[Balance Config] Cache cleared');
}
