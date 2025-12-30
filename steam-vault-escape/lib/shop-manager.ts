// Shop management system for v1.5

import { SteamGame } from '@/types/steam';
import { ShopSlot, GameTier } from '@/types/vault';
import { FORMULAS, THRESHOLDS } from './constants';
import { enrichGameWithMetadata, calculateUnlockCost } from './game-utils';

/**
 * Initialize the shop with 5 curated games from Pool 2
 * Aims for tier distribution: 3 cheap, 1 moderate, 1 epic
 */
export async function initializeShop(
  pool2_ids: number[],
  allGames: SteamGame[]
): Promise<ShopSlot[]> {
  if (pool2_ids.length === 0) {
    console.warn('[Shop Manager] Pool 2 is empty, cannot initialize shop');
    return Array(5).fill({ appId: null, tier: null });
  }
  
  // Get Pool 2 games
  const pool2Games = allGames.filter(g => pool2_ids.includes(g.appid));
  
  // Enrich games with metadata if needed
  const enrichedGames = await Promise.all(
    pool2Games.map(async (game) => {
      if (game.metacritic && game.hoursTobeat) {
        return game; // Already enriched
      }
      return await enrichGameWithMetadata(game);
    })
  );
  
  // Categorize by tier
  const gamesByTier = categorizeByTier(enrichedGames);
  
  // Draw games for shop: 3 cheap, 1 moderate, 1 epic
  const shopSlots: ShopSlot[] = [];
  
  // Draw 3 cheap games
  for (let i = 0; i < 3; i++) {
    const game = drawFromTier(gamesByTier.cheap);
    shopSlots.push({
      appId: game ? game.appid : null,
      tier: game ? 'cheap' : null,
    });
  }
  
  // Draw 1 moderate game
  const moderateGame = drawFromTier(gamesByTier.moderate);
  shopSlots.push({
    appId: moderateGame ? moderateGame.appid : null,
    tier: moderateGame ? 'moderate' : null,
  });
  
  // Draw 1 epic game
  const epicGame = drawFromTier(gamesByTier.epic);
  shopSlots.push({
    appId: epicGame ? epicGame.appid : null,
    tier: epicGame ? 'epic' : null,
  });
  
  console.log('[Shop Manager] Shop initialized:', {
    cheap: shopSlots.slice(0, 3).filter(s => s.appId).length,
    moderate: shopSlots[3].appId ? 1 : 0,
    epic: shopSlots[4].appId ? 1 : 0,
  });
  
  return shopSlots;
}

/**
 * Categorize games by tier based on unlock cost
 */
export function categorizeByTier(games: SteamGame[]): {
  cheap: SteamGame[];
  moderate: SteamGame[];
  epic: SteamGame[];
} {
  const cheap: SteamGame[] = [];
  const moderate: SteamGame[] = [];
  const epic: SteamGame[] = [];
  
  games.forEach(game => {
    const unlockCost = calculateUnlockCost(game);
    const tier = FORMULAS.getTier(unlockCost);
    
    if (tier === 'cheap') cheap.push(game);
    else if (tier === 'moderate') moderate.push(game);
    else epic.push(game);
  });
  
  return { cheap, moderate, epic };
}

/**
 * Draw a random game from a tier array
 * Returns null if array is empty
 */
function drawFromTier(tierGames: SteamGame[]): SteamGame | null {
  if (tierGames.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * tierGames.length);
  const drawnGame = tierGames[randomIndex];
  
  // Remove from array so we don't draw it again
  tierGames.splice(randomIndex, 1);
  
  return drawnGame;
}

/**
 * Draw a new game for a specific slot with tier targeting
 * Uses weighted random to favor target tier: 70% target, 20% adjacent, 10% opposite
 */
export async function drawNewGame(
  targetTier: GameTier,
  pool2_ids: number[],
  allGames: SteamGame[],
  excludeIds: number[] = []
): Promise<SteamGame | null> {
  // Get available Pool 2 games (not already in shop)
  const availableGames = allGames.filter(g => 
    pool2_ids.includes(g.appid) && !excludeIds.includes(g.appid)
  );
  
  if (availableGames.length === 0) {
    console.warn('[Shop Manager] No games available to draw');
    return null;
  }
  
  // Enrich if needed
  const enrichedGames = await Promise.all(
    availableGames.map(async (game) => {
      if (game.metacritic && game.hoursTobeat) return game;
      return await enrichGameWithMetadata(game);
    })
  );
  
  // Categorize by tier
  const gamesByTier = categorizeByTier(enrichedGames);
  
  // Weighted random draw
  const random = Math.random();
  
  if (random < 0.7) {
    // 70% chance: Draw from target tier
    const game = drawFromTier(gamesByTier[targetTier]);
    if (game) return game;
  } else if (random < 0.9) {
    // 20% chance: Draw from adjacent tier
    const adjacentTier = targetTier === 'cheap' ? 'moderate' : 
                         targetTier === 'epic' ? 'moderate' : 
                         Math.random() < 0.5 ? 'cheap' : 'epic';
    const game = drawFromTier(gamesByTier[adjacentTier]);
    if (game) return game;
  } else {
    // 10% chance: Draw from opposite tier
    const oppositeTier = targetTier === 'cheap' ? 'epic' : 
                         targetTier === 'epic' ? 'cheap' : 
                         Math.random() < 0.5 ? 'cheap' : 'epic';
    const game = drawFromTier(gamesByTier[oppositeTier]);
    if (game) return game;
  }
  
  // Fallback: Draw from any available tier
  for (const tier of ['cheap', 'moderate', 'epic'] as GameTier[]) {
    const game = drawFromTier(gamesByTier[tier]);
    if (game) return game;
  }
  
  return null;
}
