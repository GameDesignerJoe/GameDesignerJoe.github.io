// Draw Manager for Shop Slot Drawing
// Handles drawing new games from Pool 2 for shop slots

import { SteamGame } from '@/types/steam';
import { GameTier, ShopSlot } from '@/types/vault';
import { FORMULAS } from './constants';

export interface DrawResult {
  game: SteamGame;
  tier: GameTier;
}

/**
 * Draw a game from Pool 2 with tier targeting
 * Uses weighted randomization to target specific tiers
 * @param excludeIds - Optional array of game IDs to exclude from drawing (e.g., currently drawn game)
 */
export function drawGameFromPool2(
  pool2Ids: number[],
  allGames: SteamGame[],
  targetTier?: GameTier,
  excludeIds: number[] = []
): DrawResult | null {
  // Get all Pool 2 games with metadata, excluding specified IDs
  const pool2Games = pool2Ids
    .filter(id => !excludeIds.includes(id)) // Exclude specified games
    .map(id => allGames.find(g => g.appid === id))
    .filter((g): g is SteamGame => g !== undefined)
    .filter(g => g.metacritic && g.hoursTobeat); // Must have metadata
  
  if (pool2Games.length === 0) {
    console.warn('[Draw] No games available in Pool 2 with metadata');
    return null;
  }
  
  // Categorize by tier
  const categorized = {
    cheap: pool2Games.filter(g => {
      const cost = FORMULAS.unlockCost(g.metacritic!, g.hoursTobeat!);
      return FORMULAS.getTier(cost) === 'cheap';
    }),
    moderate: pool2Games.filter(g => {
      const cost = FORMULAS.unlockCost(g.metacritic!, g.hoursTobeat!);
      return FORMULAS.getTier(cost) === 'moderate';
    }),
    epic: pool2Games.filter(g => {
      const cost = FORMULAS.unlockCost(g.metacritic!, g.hoursTobeat!);
      return FORMULAS.getTier(cost) === 'epic';
    }),
  };
  
  console.log('[Draw] Pool 2 tier distribution:', {
    cheap: categorized.cheap.length,
    moderate: categorized.moderate.length,
    epic: categorized.epic.length,
  });
  
  // If target tier specified, try to draw from that tier with STRONG weighted fallback
  if (targetTier) {
    // Much stronger weighting: 90% chance of target tier, 10% for fallback
    const weights = {
      cheap: targetTier === 'cheap' ? 0.9 : 0.05,
      moderate: targetTier === 'moderate' ? 0.9 : 0.05,
      epic: targetTier === 'epic' ? 0.9 : 0.05,
    };
    
    // Weighted random selection
    const roll = Math.random();
    let cumulative = 0;
    
    for (const tier of ['cheap', 'moderate', 'epic'] as GameTier[]) {
      cumulative += weights[tier];
      if (roll < cumulative && categorized[tier].length > 0) {
        const game = categorized[tier][Math.floor(Math.random() * categorized[tier].length)];
        console.log(`[Draw] Drew ${tier} game (targeted ${targetTier}):`, game.name);
        return { game, tier };
      }
    }
  }
  
  // No target or weighted selection failed - random from all
  const game = pool2Games[Math.floor(Math.random() * pool2Games.length)];
  const cost = FORMULAS.unlockCost(game.metacritic!, game.hoursTobeat!);
  const tier = FORMULAS.getTier(cost);
  
  console.log(`[Draw] Drew random ${tier} game:`, game.name);
  return { game, tier };
}

/**
 * Get the tier that a shop slot should target based on its index
 * Slot distribution: [cheap, moderate, cheap, epic, moderate]
 */
export function getSlotTargetTier(slotIndex: number): GameTier {
  const tierPattern: GameTier[] = ['cheap', 'moderate', 'cheap', 'epic', 'moderate'];
  return tierPattern[slotIndex] || 'cheap';
}

/**
 * Check if user can afford to draw (needs 10 Liberation Keys)
 */
export function canAffordDraw(liberationKeys: number): boolean {
  return liberationKeys >= 10;
}

/**
 * Check if user can afford to redraw (needs 5 Liberation Keys)
 */
export function canAffordRedraw(liberationKeys: number): boolean {
  return liberationKeys >= 5;
}
