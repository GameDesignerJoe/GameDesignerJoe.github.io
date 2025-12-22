interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url?: string;
}

interface Friend {
  steamid: string;
  personaname: string;
  profileurl: string;
  games?: SteamGame[];
  totalPlaytime?: number;
}

interface LeaderboardEntry {
  name: string;
  steamid: string;
  profileurl: string;
  playtime: number;
  position: number;
}

interface FriendGame {
  name: string;
  appid: number;
  totalPlaytime: number;
  friendCount: number;
}

interface GenreBuddyGame {
  name: string;
  appid: number;
  friendName: string;
  steamid: string;
  profileurl: string;
  playtime: number;
}

/**
 * Calculate top 5 genres by playtime for a player
 */
export function getTopGenres(
  games: SteamGame[],
  steamCategoriesCache: Map<number, string[]>
): string[] {
  const genrePlaytime = new Map<string, number>();
  
  games.forEach(game => {
    if (game.playtime_forever === 0) return;
    
    const genres = steamCategoriesCache.get(game.appid) || [];
    genres.forEach(genre => {
      const currentHours = genrePlaytime.get(genre) || 0;
      genrePlaytime.set(genre, currentHours + (game.playtime_forever / 60));
    });
  });
  
  return Array.from(genrePlaytime.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);
}

/**
 * Find "Genre Buddies" - friends who match 3+ of your top 5 genres
 */
export function findGenreBuddies(
  playerTopGenres: string[],
  friends: Friend[],
  steamCategoriesCache: Map<number, string[]>
): Friend[] {
  return friends
    .map(friend => {
      if (!friend.games || friend.games.length === 0) return null;
      
      const friendTopGenres = getTopGenres(friend.games, steamCategoriesCache);
      const matchCount = friendTopGenres.filter(g => playerTopGenres.includes(g)).length;
      
      return matchCount >= 3 ? friend : null;
    })
    .filter((f): f is Friend => f !== null);
}

/**
 * Get your position in the leaderboard for your most played game
 * Shows #1 player, then "..." separator, then player ±2 when player is 6th or lower
 */
export function getFriendLeaderboard(
  playerMostPlayedGame: SteamGame,
  playerName: string,
  friends: Friend[]
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  
  // Add player entry
  entries.push({
    name: playerName,
    steamid: 'you',
    profileurl: '',
    playtime: playerMostPlayedGame.playtime_forever,
    position: 0,
  });
  
  // Add friends who own the game
  friends.forEach(friend => {
    const game = friend.games?.find(g => g.appid === playerMostPlayedGame.appid);
    if (game) {
      entries.push({
        name: friend.personaname,
        steamid: friend.steamid,
        profileurl: friend.profileurl,
        playtime: game.playtime_forever,
        position: 0,
      });
    }
  });
  
  // Sort by playtime (descending)
  entries.sort((a, b) => b.playtime - a.playtime);
  
  // Assign positions
  entries.forEach((entry, index) => {
    entry.position = index + 1;
  });
  
  // Find player's position
  const playerIndex = entries.findIndex(e => e.steamid === 'you');
  if (playerIndex === -1) return [];
  
  const playerPosition = playerIndex + 1;
  
  // If player is in top 5, show top 5
  if (playerPosition <= 5) {
    return entries.slice(0, Math.min(5, entries.length));
  }
  
  // Player is 6th or lower: show #1, separator, then player ±2
  const result: LeaderboardEntry[] = [];
  
  // Add #1
  result.push(entries[0]);
  
  // Add separator
  result.push({
    name: '...',
    steamid: 'separator',
    profileurl: '',
    playtime: 0,
    position: 0,
  });
  
  // Add player ±2 (2 above, player, 2 below)
  const start = Math.max(1, playerIndex - 2); // Don't include #1 again
  const end = Math.min(entries.length, playerIndex + 3); // Player + 2 below
  
  result.push(...entries.slice(start, end));
  
  return result;
}

/**
 * Get friends' top 5 most played games (aggregate playtime)
 */
export function getFriendsTopGames(friends: Friend[]): FriendGame[] {
  const gameMap = new Map<number, { name: string; totalPlaytime: number; friendCount: number }>();
  
  friends.forEach(friend => {
    friend.games?.forEach(game => {
      if (game.playtime_forever === 0) return;
      
      const existing = gameMap.get(game.appid);
      if (existing) {
        existing.totalPlaytime += game.playtime_forever;
        existing.friendCount += 1;
      } else {
        gameMap.set(game.appid, {
          name: game.name,
          totalPlaytime: game.playtime_forever,
          friendCount: 1,
        });
      }
    });
  });
  
  return Array.from(gameMap.entries())
    .map(([appid, data]) => ({
      appid,
      name: data.name,
      totalPlaytime: data.totalPlaytime,
      friendCount: data.friendCount,
    }))
    .sort((a, b) => b.totalPlaytime - a.totalPlaytime)
    .slice(0, 5);
}

/**
 * Get genre buddies ranked by total playtime in matching genres
 */
export function getGenreBuddiesRanked(
  playerTopGenres: string[],
  friends: Friend[],
  steamCategoriesCache: Map<number, string[]>
): Array<{ friend: Friend; matchCount: number; totalPlaytime: number }> {
  const rankedBuddies: Array<{ friend: Friend; matchCount: number; totalPlaytime: number }> = [];
  
  friends.forEach(friend => {
    if (!friend.games || friend.games.length === 0) return;
    
    const friendTopGenres = getTopGenres(friend.games, steamCategoriesCache);
    const matchingGenres = friendTopGenres.filter(g => playerTopGenres.includes(g));
    const matchCount = matchingGenres.length;
    
    // Only include friends with 3+ matches
    if (matchCount >= 3) {
      // Calculate total playtime in matching genres
      let totalPlaytime = 0;
      friend.games.forEach(game => {
        const gameGenres = steamCategoriesCache.get(game.appid) || [];
        const hasMatchingGenre = gameGenres.some(genre => matchingGenres.includes(genre));
        if (hasMatchingGenre) {
          totalPlaytime += game.playtime_forever;
        }
      });
      
      rankedBuddies.push({
        friend,
        matchCount,
        totalPlaytime
      });
    }
  });
  
  // Sort by match count FIRST (descending), then by total playtime as tiebreaker
  return rankedBuddies
    .sort((a, b) => {
      // Primary sort: match count (higher is better)
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      // Tiebreaker: total playtime in matching genres (higher is better)
      return b.totalPlaytime - a.totalPlaytime;
    })
    .slice(0, 5);
}

/**
 * Get friends who have played a specific game for 50+ hours
 */
export function getFriendsWithSignificantPlaytime(
  appid: number,
  friends: Friend[],
  minHours: number = 50
): Friend[] {
  return friends
    .map(friend => {
      const game = friend.games?.find(g => g.appid === appid);
      if (game && (game.playtime_forever / 60) >= minHours) {
        return friend;
      }
      return null;
    })
    .filter((f): f is Friend => f !== null);
}

/**
 * Get total playtime leaderboard - player + 4 nearest friends by total playtime
 * Shows #1 player, then "..." separator, then player ±2 when player is 6th or lower
 */
export function getTotalPlaytimeLeaderboard(
  playerTotalMinutes: number,
  playerName: string,
  friends: Friend[]
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  
  // Add player entry
  entries.push({
    name: playerName,
    steamid: 'you',
    profileurl: '',
    playtime: playerTotalMinutes,
    position: 0,
  });
  
  // Add all friends with their total playtime
  friends.forEach(friend => {
    if (!friend.games || friend.games.length === 0) {
      // Private profile - add with 0 playtime and special marker
      entries.push({
        name: friend.personaname || 'Private Profile',
        steamid: friend.steamid,
        profileurl: friend.profileurl,
        playtime: 0,
        position: 0,
      });
      return;
    }
    
    // Calculate total playtime across all games
    const totalPlaytime = friend.games.reduce((sum, game) => sum + game.playtime_forever, 0);
    
    entries.push({
      name: friend.personaname,
      steamid: friend.steamid,
      profileurl: friend.profileurl,
      playtime: totalPlaytime,
      position: 0,
    });
  });
  
  // Sort by playtime (descending)
  entries.sort((a, b) => b.playtime - a.playtime);
  
  // Assign positions
  entries.forEach((entry, index) => {
    entry.position = index + 1;
  });
  
  // Find player's position
  const playerIndex = entries.findIndex(e => e.steamid === 'you');
  if (playerIndex === -1) return [];
  
  const playerPosition = playerIndex + 1;
  
  // If player is in top 5, show top 5
  if (playerPosition <= 5) {
    return entries.slice(0, Math.min(5, entries.length));
  }
  
  // Player is 6th or lower: show #1, separator, then player ±2
  const result: LeaderboardEntry[] = [];
  
  // Add #1
  result.push(entries[0]);
  
  // Add separator
  result.push({
    name: '...',
    steamid: 'separator',
    profileurl: '',
    playtime: 0,
    position: 0,
  });
  
  // Add player ±2 (2 above, player, 2 below)
  const start = Math.max(1, playerIndex - 2); // Don't include #1 again
  const end = Math.min(entries.length, playerIndex + 3); // Player + 2 below
  
  result.push(...entries.slice(start, end));
  
  return result;
}

/**
 * Get library size leaderboard - player + 4 nearest friends by total games owned
 * Shows #1 player, then "..." separator, then player ±2 when player is 6th or lower
 */
export function getLibrarySizeLeaderboard(
  playerTotalGames: number,
  playerName: string,
  friends: Friend[]
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  
  // Add player entry (using playtime field to store game count)
  entries.push({
    name: playerName,
    steamid: 'you',
    profileurl: '',
    playtime: playerTotalGames,
    position: 0,
  });
  
  // Add all friends with their total game count
  friends.forEach(friend => {
    if (!friend.games || friend.games.length === 0) {
      // Private profile - add with 0 games
      entries.push({
        name: friend.personaname || 'Private Profile',
        steamid: friend.steamid,
        profileurl: friend.profileurl,
        playtime: 0, // Using playtime field to store game count
        position: 0,
      });
      return;
    }
    
    const totalGames = friend.games.length;
    
    entries.push({
      name: friend.personaname,
      steamid: friend.steamid,
      profileurl: friend.profileurl,
      playtime: totalGames, // Using playtime field to store game count
      position: 0,
    });
  });
  
  // Sort by game count (descending)
  entries.sort((a, b) => b.playtime - a.playtime);
  
  // Assign positions
  entries.forEach((entry, index) => {
    entry.position = index + 1;
  });
  
  // Find player's position
  const playerIndex = entries.findIndex(e => e.steamid === 'you');
  if (playerIndex === -1) return [];
  
  const playerPosition = playerIndex + 1;
  
  // If player is in top 5, show top 5
  if (playerPosition <= 5) {
    return entries.slice(0, Math.min(5, entries.length));
  }
  
  // Player is 6th or lower: show #1, separator, then player ±2
  const result: LeaderboardEntry[] = [];
  
  // Add #1
  result.push(entries[0]);
  
  // Add separator
  result.push({
    name: '...',
    steamid: 'separator',
    profileurl: '',
    playtime: 0,
    position: 0,
  });
  
  // Add player ±2 (2 above, player, 2 below)
  const start = Math.max(1, playerIndex - 2); // Don't include #1 again
  const end = Math.min(entries.length, playerIndex + 3); // Player + 2 below
  
  result.push(...entries.slice(start, end));
  
  return result;
}

interface CompletionEntry {
  name: string;
  steamid: string;
  profileurl: string;
  totalGames: number;
  playedGames: number;
  completionRate: number;
  position: number;
}

/**
 * Get completion rate leaderboard - player + 4 nearest friends by % of library played
 * Shows #1 player, then "..." separator, then player ±2 when player is 6th or lower
 */
export function getCompletionRateLeaderboard(
  playerTotalGames: number,
  playerPlayedGames: number,
  playerName: string,
  friends: Friend[]
): CompletionEntry[] {
  const entries: CompletionEntry[] = [];
  
  // Add player entry
  const playerRate = playerTotalGames > 0 ? (playerPlayedGames / playerTotalGames) * 100 : 0;
  entries.push({
    name: playerName,
    steamid: 'you',
    profileurl: '',
    totalGames: playerTotalGames,
    playedGames: playerPlayedGames,
    completionRate: playerRate,
    position: 0,
  });
  
  // Add all friends with their completion rates
  friends.forEach(friend => {
    if (!friend.games || friend.games.length === 0) return;
    
    const totalGames = friend.games.length;
    const playedGames = friend.games.filter(g => g.playtime_forever > 0).length;
    const completionRate = totalGames > 0 ? (playedGames / totalGames) * 100 : 0;
    
    entries.push({
      name: friend.personaname,
      steamid: friend.steamid,
      profileurl: friend.profileurl,
      totalGames,
      playedGames,
      completionRate,
      position: 0,
    });
  });
  
  // Sort by completion rate (descending)
  entries.sort((a, b) => b.completionRate - a.completionRate);
  
  // Assign positions
  entries.forEach((entry, index) => {
    entry.position = index + 1;
  });
  
  // Find player's position
  const playerIndex = entries.findIndex(e => e.steamid === 'you');
  if (playerIndex === -1) return [];
  
  const playerPosition = playerIndex + 1;
  
  // If player is in top 5, show top 5
  if (playerPosition <= 5) {
    return entries.slice(0, Math.min(5, entries.length));
  }
  
  // Player is 6th or lower: show #1, separator, then player ±2
  const result: CompletionEntry[] = [];
  
  // Add #1
  result.push(entries[0]);
  
  // Add separator
  result.push({
    name: '...',
    steamid: 'separator',
    profileurl: '',
    totalGames: 0,
    playedGames: 0,
    completionRate: 0,
    position: 0,
  });
  
  // Add player ±2 (2 above, player, 2 below)
  const start = Math.max(1, playerIndex - 2); // Don't include #1 again
  const end = Math.min(entries.length, playerIndex + 3); // Player + 2 below
  
  result.push(...entries.slice(start, end));
  
  return result;
}

/**
 * Get most played games leaderboard - player + 4 nearest friends by count of games played
 * Shows #1 player, then "..." separator, then player ±2 when player is 6th or lower
 */
export function getMostPlayedGamesLeaderboard(
  playerPlayedGames: number,
  playerName: string,
  friends: Friend[]
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  
  // Add player entry (using playtime field to store game count)
  entries.push({
    name: playerName,
    steamid: 'you',
    profileurl: '',
    playtime: playerPlayedGames,
    position: 0,
  });
  
  // Add all friends with their played game count
  friends.forEach(friend => {
    if (!friend.games || friend.games.length === 0) {
      // Private profile - add with 0 games
      entries.push({
        name: friend.personaname || 'Private Profile',
        steamid: friend.steamid,
        profileurl: friend.profileurl,
        playtime: 0, // Using playtime field to store game count
        position: 0,
      });
      return;
    }
    
    const playedGames = friend.games.filter(g => g.playtime_forever > 0).length;
    
    entries.push({
      name: friend.personaname,
      steamid: friend.steamid,
      profileurl: friend.profileurl,
      playtime: playedGames, // Using playtime field to store game count
      position: 0,
    });
  });
  
  // Sort by game count (descending)
  entries.sort((a, b) => b.playtime - a.playtime);
  
  // Assign positions
  entries.forEach((entry, index) => {
    entry.position = index + 1;
  });
  
  // Find player's position
  const playerIndex = entries.findIndex(e => e.steamid === 'you');
  if (playerIndex === -1) return [];
  
  const playerPosition = playerIndex + 1;
  
  // If player is in top 5, show top 5
  if (playerPosition <= 5) {
    return entries.slice(0, Math.min(5, entries.length));
  }
  
  // Player is 6th or lower: show #1, separator, then player ±2
  const result: LeaderboardEntry[] = [];
  
  // Add #1
  result.push(entries[0]);
  
  // Add separator
  result.push({
    name: '...',
    steamid: 'separator',
    profileurl: '',
    playtime: 0,
    position: 0,
  });
  
  // Add player ±2 (2 above, player, 2 below)
  const start = Math.max(1, playerIndex - 2); // Don't include #1 again
  const end = Math.min(entries.length, playerIndex + 3); // Player + 2 below
  
  result.push(...entries.slice(start, end));
  
  return result;
}
