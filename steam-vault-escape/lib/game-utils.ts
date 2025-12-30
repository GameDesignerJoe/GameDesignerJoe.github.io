// Game utility functions for v1.5

import { SteamGame } from '@/types/steam';
import { THRESHOLDS, FORMULAS } from './constants';

/**
 * Enrich a game with metadata from external APIs
 * Fetches Metacritic and hours-to-beat data
 */
export async function enrichGameWithMetadata(game: SteamGame): Promise<SteamGame> {
  try {
    // Fetch from both APIs in parallel
    const [storeResponse, spyResponse] = await Promise.all([
      fetch(`/api/steam-store?appid=${game.appid}`).catch(() => null),
      fetch(`/api/steamspy?appid=${game.appid}`).catch(() => null),
    ]);
    
    // Parse Steam Store data (Metacritic)
    let metacritic = THRESHOLDS.DEFAULT_METACRITIC;
    let recommendations = 0;
    if (storeResponse && storeResponse.ok) {
      const storeData = await storeResponse.json();
      if (storeData.metacritic) {
        metacritic = storeData.metacritic;
      } else if (storeData.recommendations) {
        // Fallback: Use recommendation count to estimate rating
        recommendations = storeData.recommendations;
        // Scale recommendations to 70-90 range (rough estimate)
        metacritic = Math.min(90, 70 + Math.floor(Math.log10(recommendations + 1) * 5));
      }
    }
    
    // Parse SteamSpy data (hours to beat)
    let hoursTobeat = THRESHOLDS.DEFAULT_HOURS_TO_BEAT;
    let tags: string[] = [];
    if (spyResponse && spyResponse.ok) {
      const spyData = await spyResponse.json();
      if (spyData.hoursTobeat) {
        hoursTobeat = spyData.hoursTobeat;
      }
      if (spyData.tags) {
        tags = spyData.tags;
      }
      // If we didn't get Metacritic, try SteamSpy rating
      if (metacritic === THRESHOLDS.DEFAULT_METACRITIC && spyData.rating) {
        metacritic = spyData.rating;
      }
    }
    
    // Return enriched game
    return {
      ...game,
      metacritic,
      hoursTobeat,
      tags,
      recommendations,
    };
  } catch (error) {
    console.error(`[GameUtils] Failed to enrich game ${game.appid}:`, error);
    // Return game with defaults
    return {
      ...game,
      metacritic: THRESHOLDS.DEFAULT_METACRITIC,
      hoursTobeat: THRESHOLDS.DEFAULT_HOURS_TO_BEAT,
      tags: [],
      recommendations: 0,
    };
  }
}

/**
 * Select a starting game from the library
 * Criteria: Metacritic 70-79, 5-10 hours played
 * Fallback 1: Any game with 5-10 hours played
 * Fallback 2: Game with lowest playtime > 0
 */
export function selectStartingGame(games: SteamGame[]): SteamGame | null {
  if (games.length === 0) return null;
  
  // Filter to only played games
  const playedGames = games.filter(g => g.playtime_forever > 0);
  if (playedGames.length === 0) return null;
  
  // Convert minutes to hours for filtering
  const MIN_HOURS = THRESHOLDS.STARTING_GAME_HOURS_MIN * 60;
  const MAX_HOURS = THRESHOLDS.STARTING_GAME_HOURS_MAX * 60;
  
  // Try: Metacritic 70-79, 5-10 hours played
  const idealGames = playedGames.filter(g => 
    g.metacritic !== undefined &&
    g.metacritic >= THRESHOLDS.STARTING_GAME_METACRITIC_MIN &&
    g.metacritic <= THRESHOLDS.STARTING_GAME_METACRITIC_MAX &&
    g.playtime_forever >= MIN_HOURS &&
    g.playtime_forever <= MAX_HOURS
  );
  
  if (idealGames.length > 0) {
    // Pick random from ideal games
    return idealGames[Math.floor(Math.random() * idealGames.length)];
  }
  
  // Fallback 1: Any game with 5-10 hours played
  const midRangeGames = playedGames.filter(g =>
    g.playtime_forever >= MIN_HOURS &&
    g.playtime_forever <= MAX_HOURS
  );
  
  if (midRangeGames.length > 0) {
    return midRangeGames[Math.floor(Math.random() * midRangeGames.length)];
  }
  
  // Fallback 2: Game with lowest playtime (but > 0)
  return playedGames.sort((a, b) => a.playtime_forever - b.playtime_forever)[0];
}

/**
 * Calculate unlock cost for a game based on v1.5 formula
 */
export function calculateUnlockCost(game: SteamGame): number {
  const metacritic = game.metacritic || THRESHOLDS.DEFAULT_METACRITIC;
  const hoursTobeat = game.hoursTobeat || THRESHOLDS.DEFAULT_HOURS_TO_BEAT;
  return FORMULAS.unlockCost(metacritic, hoursTobeat);
}

/**
 * Batch enrich multiple games with rate limiting
 * Processes games in batches to avoid overwhelming APIs
 */
export async function batchEnrichGames(
  games: SteamGame[],
  batchSize: number = 5,
  delayMs: number = 1000
): Promise<SteamGame[]> {
  const enrichedGames: SteamGame[] = [];
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    const enrichedBatch = await Promise.all(
      batch.map(game => enrichGameWithMetadata(game))
    );
    enrichedGames.push(...enrichedBatch);
    
    // Delay between batches to respect rate limits
    if (i + batchSize < games.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return enrichedGames;
}
