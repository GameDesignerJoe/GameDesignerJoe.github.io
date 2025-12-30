// Metadata Enrichment Manager
// Maintains a buffer of Pool 2 games with complete metadata for shop draws

import { SteamGame } from '@/types/steam';
import { enrichGameWithMetadata } from './game-utils';

const METADATA_BUFFER_SIZE = 10;

/**
 * Get count of Pool 2 games that have complete metadata
 */
export function countPool2WithMetadata(pool2Ids: number[], allGames: SteamGame[]): number {
  return pool2Ids.filter(id => {
    const game = allGames.find(g => g.appid === id);
    return game && game.metacritic && game.hoursTobeat;
  }).length;
}

/**
 * Get Pool 2 games that DON'T have metadata yet
 */
export function getPool2WithoutMetadata(pool2Ids: number[], allGames: SteamGame[]): number[] {
  return pool2Ids.filter(id => {
    const game = allGames.find(g => g.appid === id);
    return game && (!game.metacritic || !game.hoursTobeat);
  });
}

/**
 * Maintain metadata buffer for Pool 2 games
 * Ensures at least `targetCount` games have metadata for shop draws
 * 
 * @param pool2Ids - Array of Pool 2 game IDs
 * @param allGames - All games in library
 * @param targetCount - Target number of games with metadata (default: 10)
 * @returns Updated games array with enriched metadata
 */
export async function maintainMetadataBuffer(
  pool2Ids: number[],
  allGames: SteamGame[],
  targetCount: number = METADATA_BUFFER_SIZE
): Promise<SteamGame[]> {
  console.log('[Metadata] Checking metadata buffer...');
  
  // Count how many Pool 2 games already have metadata
  const currentCount = countPool2WithMetadata(pool2Ids, allGames);
  console.log(`[Metadata] Current: ${currentCount}, Target: ${targetCount}`);
  
  if (currentCount >= targetCount) {
    console.log('[Metadata] Buffer sufficient, no enrichment needed');
    return allGames;
  }
  
  // How many more do we need?
  const needed = targetCount - currentCount;
  console.log(`[Metadata] Need to enrich ${needed} more games`);
  
  // Get games without metadata
  const gamesWithoutMetadata = getPool2WithoutMetadata(pool2Ids, allGames);
  
  if (gamesWithoutMetadata.length === 0) {
    console.log('[Metadata] No more Pool 2 games available to enrich');
    return allGames;
  }
  
  // Select random games to enrich (up to what we need)
  const toEnrich = gamesWithoutMetadata
    .sort(() => Math.random() - 0.5) // Shuffle
    .slice(0, needed);
  
  console.log(`[Metadata] Enriching ${toEnrich.length} games:`, toEnrich);
  
  // Enrich games one by one
  const updatedGames = [...allGames];
  
  for (const appId of toEnrich) {
    const gameIndex = updatedGames.findIndex(g => g.appid === appId);
    if (gameIndex === -1) continue;
    
    const game = updatedGames[gameIndex];
    console.log(`[Metadata] Fetching metadata for: ${game.name} (${appId})`);
    
    try {
      const enriched = await enrichGameWithMetadata(game);
      updatedGames[gameIndex] = enriched;
      console.log(`[Metadata] ✓ Enriched ${game.name}: Metacritic=${enriched.metacritic}, Hours=${enriched.hoursTobeat}`);
    } catch (error) {
      console.error(`[Metadata] ✗ Failed to enrich ${game.name}:`, error);
      // Continue with next game even if this one fails
    }
  }
  
  // Log final status
  const finalCount = countPool2WithMetadata(pool2Ids, updatedGames);
  console.log(`[Metadata] Enrichment complete. Final count: ${finalCount}/${targetCount}`);
  
  return updatedGames;
}

/**
 * Initial metadata enrichment for Pool 2
 * Called once when initializing the vault
 */
export async function initialMetadataEnrichment(
  pool2Ids: number[],
  allGames: SteamGame[]
): Promise<SteamGame[]> {
  console.log('[Metadata] Starting initial enrichment for Pool 2...');
  return maintainMetadataBuffer(pool2Ids, allGames, METADATA_BUFFER_SIZE);
}

/**
 * Top up metadata buffer after a game is unlocked
 * Called when a game moves from Pool 2 to Pool 1
 */
export async function topUpMetadataBuffer(
  pool2Ids: number[],
  allGames: SteamGame[]
): Promise<SteamGame[]> {
  console.log('[Metadata] Topping up metadata buffer after unlock...');
  return maintainMetadataBuffer(pool2Ids, allGames, METADATA_BUFFER_SIZE);
}
