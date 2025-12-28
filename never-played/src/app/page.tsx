'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useFriendsData } from '@/hooks/useFriendsData';
import { steamRequestQueue } from '@/utils/requestQueue';
import { verifyFriendsBackground, getUnverifiedFriends, hasAutoStarted, markAutoStarted } from '@/utils/friendsVerification';
import CompassIcon from '@/components/CompassIcon';
import {
  findGenreBuddies,
  getFriendLeaderboard,
  getFriendsTopGames,
  getGenreBuddiesRanked,
  getFriendsWithSignificantPlaytime,
  getTopGenres as getPlayerTopGenres,
  getTotalPlaytimeLeaderboard,
  getLibrarySizeLeaderboard,
  getCompletionRateLeaderboard,
  getMostPlayedGamesLeaderboard,
  getTrendingWithFriends
} from '@/utils/genreAffinity';

// Detect if user is on mobile device
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Smart link handler: Try steam:// protocol, fallback to web if fails
function handleSteamLink(appId: number, e?: React.MouseEvent) {
  if (e) e.preventDefault();
  
  const webFallback = `https://store.steampowered.com/app/${appId}`;
  
  if (isMobileDevice()) {
    // Mobile: Go directly to Steam website (it has "Open in App" button if Steam app is installed)
    // This is more reliable than trying to deep link, which often shows error dialogs
    window.location.href = webFallback;
  } else {
    // Desktop: Use steam://nav/games/details/{appId} for Steam client
    const steamProtocol = `steam://nav/games/details/${appId}`;
    window.location.href = steamProtocol;
  }
}

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  rtime_last_played?: number; // Unix timestamp of when last played
  rating?: number | null; // Steam review score (0-100), null if no data available
  tags?: string[]; // Top 5 tags from SteamSpy
  releaseDate?: string; // Formatted release date
  price?: number; // Price in dollars
  medianMinutes?: number | null; // Median playtime from SteamSpy (in minutes)
}

interface FailedGameRequest {
  appId: number;
  gameName: string;
  reason: 'rate_limit' | 'timeout' | 'not_found' | 'server_error' | 'unknown';
  attempts: number;
  lastAttempt: Date;
  httpStatus?: number;
}

interface SteamStoreData {
  name: string | null;
  short_description: string | null;
  header_image: string | null;
  release_date: {
    date: string | null;
    coming_soon: boolean;
  };
  genres: string[];
  categories: string[]; // Steam categories: Single-player, Multi-player, Co-op, etc.
  metacritic: number | null;
  recommendations: number | null;
  developers: string[];
  publishers: string[];
  positive_reviews: number | null;
  negative_reviews: number | null;
  review_score: number | null;
  review_score_desc: string | null;
  movies: Array<{
    id: number;
    name: string;
    thumbnail: string;
    webm_480: string;
    mp4_480: string;
    mp4_max: string;
  }>;
}

interface LibraryStats {
  totalGames: number;
  neverPlayed: number;
  totalMinutes: number;
  completionRate: number;
  costPerHour: number | null; // null if can't calculate
  totalSpent: number; // total money spent on played games
  gamesWithPrice: number; // number of played games with price data
}

interface FriendsDataForSort {
  friends: Array<{
    steamid: string;
    personaname: string;
    games?: Array<{ appid: number; playtime_forever: number }>;
  }>;
}

type SortOption = 'name-asc' | 'name-desc' | 'playtime-asc' | 'playtime-desc' | 'appid-asc' | 'appid-desc' | 'rating-desc' | 'rating-asc' | 'release-desc' | 'release-asc' | 'best-match' | 'friends-playtime-desc';

function sortGames(games: SteamGame[], sortBy: SortOption, steamCategoriesCache?: Map<number, string[]>, playerTopGenres?: string[], friendsData?: FriendsDataForSort | null): SteamGame[] {
  const sorted = [...games];
  
  switch (sortBy) {
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'playtime-asc':
      return sorted.sort((a, b) => a.playtime_forever - b.playtime_forever);
    case 'playtime-desc':
      return sorted.sort((a, b) => b.playtime_forever - a.playtime_forever);
    case 'appid-asc':
      return sorted.sort((a, b) => a.appid - b.appid);
    case 'appid-desc':
      return sorted.sort((a, b) => b.appid - a.appid);
    case 'rating-desc':
      // Sort by rating (high to low), unrated games at bottom
      return sorted.sort((a, b) => {
        if ((a.rating === undefined || a.rating === null) && (b.rating === undefined || b.rating === null)) return 0;
        if (a.rating === undefined || a.rating === null) return 1;
        if (b.rating === undefined || b.rating === null) return -1;
        return b.rating - a.rating;
      });
    case 'rating-asc':
      // Sort by rating (low to high), unrated games at bottom
      return sorted.sort((a, b) => {
        if ((a.rating === undefined || a.rating === null) && (b.rating === undefined || b.rating === null)) return 0;
        if (a.rating === undefined || a.rating === null) return 1;
        if (b.rating === undefined || b.rating === null) return -1;
        return a.rating - b.rating;
      });
    case 'release-desc':
      // Sort by release date (newest first), games without dates at bottom
      return sorted.sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return 0;
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      });
    case 'release-asc':
      // Sort by release date (oldest first), games without dates at bottom
      return sorted.sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return 0;
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      });
    case 'best-match':
      // Best Match: Sort by genre affinity + rating quality
      // Score = (Genre Matches × 10) + (Rating / 10)
      if (!steamCategoriesCache || !playerTopGenres) {
        return sorted; // Can't sort without genre data
      }
      
      return sorted.sort((a, b) => {
        // Calculate score for game A
        const aGenres = steamCategoriesCache.get(a.appid) || [];
        const aMatches = aGenres.filter(g => playerTopGenres.includes(g)).length;
        const aRating = (a.rating !== undefined && a.rating !== null) ? a.rating : 0;
        const aScore = (aMatches * 10) + (aRating / 10);
        
        // Calculate score for game B
        const bGenres = steamCategoriesCache.get(b.appid) || [];
        const bMatches = bGenres.filter(g => playerTopGenres.includes(g)).length;
        const bRating = (b.rating !== undefined && b.rating !== null) ? b.rating : 0;
        const bScore = (bMatches * 10) + (bRating / 10);
        
        // Games with no genres or rating go to bottom
        if (aScore === 0 && bScore === 0) return 0;
        if (aScore === 0) return 1;
        if (bScore === 0) return -1;
        
        // Sort by score descending (highest first)
        return bScore - aScore;
      });
    case 'friends-playtime-desc':
      // Sort by total friend playtime (high to low)
      if (!friendsData || !friendsData.friends) {
        return sorted; // Can't sort without friends data
      }
      
      return sorted.sort((a, b) => {
        // Calculate total friend playtime for game A
        let aFriendPlaytime = 0;
        friendsData.friends.forEach((friend: any) => {
          const game = friend.games?.find((g: any) => g.appid === a.appid);
          if (game) {
            aFriendPlaytime += game.playtime_forever;
          }
        });
        
        // Calculate total friend playtime for game B
        let bFriendPlaytime = 0;
        friendsData.friends.forEach((friend: any) => {
          const game = friend.games?.find((g: any) => g.appid === b.appid);
          if (game) {
            bFriendPlaytime += game.playtime_forever;
          }
        });
        
        // Games with no friend playtime go to bottom
        if (aFriendPlaytime === 0 && bFriendPlaytime === 0) return 0;
        if (aFriendPlaytime === 0) return 1;
        if (bFriendPlaytime === 0) return -1;
        
        // Sort by friend playtime descending (highest first)
        return bFriendPlaytime - aFriendPlaytime;
      });
    default:
      return sorted;
  }
}

// Helper: Get effective playtime (0 if ignored, otherwise actual)
function getEffectivePlaytime(game: SteamGame, ignoredList: number[]): number {
  return ignoredList.includes(game.appid) ? 0 : game.playtime_forever;
}

function calculateStats(games: SteamGame[], playedElsewhereList: number[] = [], ignoredPlaytimeList: number[] = []): LibraryStats {
  const totalGames = games.length;
  // Exclude playedElsewhere games from never played count
  const neverPlayed = games.filter(g => 
    g.playtime_forever === 0 && !playedElsewhereList.includes(g.appid)
  ).length;
  // Use effective playtime (ignoring games in ignoredPlaytimeList)
  const totalMinutes = games.reduce((sum, g) => sum + getEffectivePlaytime(g, ignoredPlaytimeList), 0);
  // Count playedElsewhere as "tried" for completion rate (still counts ignored games as tried)
  const playedElsewhereCount = games.filter(g => playedElsewhereList.includes(g.appid)).length;
  const actuallyPlayed = games.filter(g => g.playtime_forever > 0).length;
  const tried = actuallyPlayed + playedElsewhereCount;
  const completionRate = totalGames > 0 ? Math.round((tried / totalGames) * 100) : 0;
  
  // Calculate cost per hour (only for played games, using effective playtime)
  const playedGames = games.filter(g => getEffectivePlaytime(g, ignoredPlaytimeList) > 0);
  const gamesWithPrice = playedGames.filter(g => g.price !== undefined && g.price !== null && g.price > 0);
  const totalSpent = gamesWithPrice.reduce((sum, g) => sum + (g.price || 0), 0);
  const totalHoursPlayed = games.reduce((sum, g) => sum + getEffectivePlaytime(g, ignoredPlaytimeList), 0) / 60;
  const costPerHour = totalHoursPlayed > 0 && totalSpent > 0 ? totalSpent / totalHoursPlayed : null;
  
  return {
    totalGames,
    neverPlayed,
    totalMinutes,
    completionRate,
    costPerHour,
    totalSpent,
    gamesWithPrice: gamesWithPrice.length
  };
}

function formatPlaytime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0 && mins > 0) {
    return `${hours.toLocaleString()}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours.toLocaleString()}h`;
  } else {
    return `${mins}m`;
  }
}

// Format playtime in human-readable units (years, weeks, days, hours, minutes)
function formatPlaytimeDetailed(minutes: number): string {
  const totalMinutes = minutes;
  const totalHours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  
  const years = Math.floor(totalHours / (365 * 24));
  const remainingAfterYears = totalHours % (365 * 24);
  
  const weeks = Math.floor(remainingAfterYears / (7 * 24));
  const remainingAfterWeeks = remainingAfterYears % (7 * 24);
  
  const days = Math.floor(remainingAfterWeeks / 24);
  const hours = remainingAfterWeeks % 24;
  
  const parts: string[] = [];
  
  if (years > 0) parts.push(`${years}y`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  
  return parts.length > 0 ? parts.join(' ') : '0m';
}

// Truncate text with ellipsis if it exceeds maxLength
function truncateText(text: string, maxLength: number = 20): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Get playtime label based on hours
function getPlaytimeLabel(hours: number): string {
  if (hours < 3) return 'Quick Session';
  if (hours <= 10) return 'Weekend Game';
  if (hours <= 30) return 'Medium Length';
  return 'Long Haul';
}

function getSuggestion(
  games: SteamGame[], 
  blacklist: number[] = [], 
  playedElsewhereList: number[] = [],
  steamCategoriesCache?: Map<number, string[]>,
  friendsData?: any
): SteamGame | null {
  const neverPlayed = games
    .filter(g => g.playtime_forever === 0)
    .filter(g => !blacklist.includes(g.appid))
    .filter(g => !playedElsewhereList.includes(g.appid));
  
  if (neverPlayed.length === 0) {
    return null;
  }
  
  // If no genre/friend data, fall back to random selection
  if (!steamCategoriesCache || steamCategoriesCache.size === 0) {
    const randomIndex = Math.floor(Math.random() * neverPlayed.length);
    return neverPlayed[randomIndex];
  }
  
  // Calculate player's top 5 genres
  const playerTopGenres = getTop5Genres(games, steamCategoriesCache);
  const playerGenreNames = playerTopGenres.map(g => g.genre);
  
  // 10% chance to suggest a "Taste Changer" (outside top genres but highly rated)
  const shouldSuggestTasteChanger = Math.random() < 0.1;
  
  // Score each game
  const scoredGames = neverPlayed.map(game => {
    const gameGenres = steamCategoriesCache.get(game.appid) || [];
    const genreMatches = gameGenres.filter(g => playerGenreNames.includes(g)).length;
    
    // Calculate friend playtime for this game
    let friendPlaytime = 0;
    if (friendsData && friendsData.friends) {
      friendsData.friends.forEach((friend: any) => {
        const friendGame = friend.games?.find((g: any) => g.appid === game.appid);
        if (friendGame) {
          friendPlaytime += friendGame.playtime_forever;
        }
      });
    }
    
    // Rating score (0-100 normalized to 0-10)
    const ratingScore = (game.rating !== undefined && game.rating !== null) ? game.rating / 10 : 0;
    
    // Friend playtime score (hours, capped at 100 for balance)
    const friendScore = Math.min(friendPlaytime / 60, 100) / 10;
    
    let totalScore = 0;
    
    if (shouldSuggestTasteChanger) {
      // Taste Changer mode: Prioritize games OUTSIDE top genres but highly rated
      const isOutsideGenres = genreMatches === 0;
      const isHighlyRated = ratingScore >= 7; // 70%+ rating
      
      if (isOutsideGenres && isHighlyRated) {
        // Boost score for taste changers
        totalScore = ratingScore * 2 + friendScore;
      } else {
        // Lower score for genre matches in taste changer mode
        totalScore = ratingScore + friendScore - (genreMatches * 2);
      }
    } else {
      // Normal mode: Prioritize genre matches
      // Formula: (Genre Matches × 20) + (Rating × 1) + (Friend Score × 1.5)
      totalScore = (genreMatches * 20) + ratingScore + (friendScore * 1.5);
    }
    
    return {
      game,
      score: totalScore,
      genreMatches
    };
  }).filter(item => item.score > 0); // Filter out games with no score
  
  if (scoredGames.length === 0) {
    // No scored games, fall back to random
    const randomIndex = Math.floor(Math.random() * neverPlayed.length);
    return neverPlayed[randomIndex];
  }
  
  // Sort by score (highest first)
  scoredGames.sort((a, b) => b.score - a.score);
  
  // Pick randomly from top 20% of scored games (adds variety while staying smart)
  const topCount = Math.max(1, Math.ceil(scoredGames.length * 0.2));
  const topGames = scoredGames.slice(0, topCount);
  const randomIndex = Math.floor(Math.random() * topGames.length);
  
  return topGames[randomIndex].game;
}

// Calculate how many years ago a game was released
function getGameAge(releaseDate?: string): string | null {
  if (!releaseDate) return null;
  
  try {
    const releaseYear = new Date(releaseDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const yearsAgo = currentYear - releaseYear;
    
    if (yearsAgo === 0) return 'Released this year';
    if (yearsAgo === 1) return 'Released 1 year ago';
    return `Released ${yearsAgo} years ago`;
  } catch (e) {
    return null;
  }
}

// Find the last "new" game (tried but didn't commit: 1-120 minutes playtime)
function getLastNewGame(games: SteamGame[]): { game: SteamGame, daysAgo: number } | null {
  // Filter: Games with 1-120 minutes playtime (1-2 hours = "tried but didn't commit")
  const triedGames = games.filter(g => 
    g.playtime_forever >= 1 && 
    g.playtime_forever <= 120 &&
    g.rtime_last_played !== undefined
  );
  
  if (triedGames.length === 0) return null;
  
  // Sort by rtime_last_played descending (most recent first)
  triedGames.sort((a, b) => (b.rtime_last_played || 0) - (a.rtime_last_played || 0));
  
  const mostRecent = triedGames[0];
  const daysAgo = Math.floor((Date.now() - (mostRecent.rtime_last_played! * 1000)) / (1000 * 60 * 60 * 24));
  
  return { game: mostRecent, daysAgo };
}

// Cache version - increment when API structure changes
const STEAM_STORE_CACHE_VERSION = 3;

// Enhanced data cache interface
interface GameData {
  score: number | null;
  tags?: string[];
  releaseDate?: string;
  price?: number;
  medianMinutes?: number | null;
  timestamp: number;
}

// Cache helpers for enhanced game data
function getCachedData(appId: number): GameData | null {
  const cached = localStorage.getItem(`rating_${appId}`);
  if (!cached) return null;
  
  try {
    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    if (age < sevenDays) {
      return data;
    }
  } catch (e) {
    // Invalid cache entry
  }
  
  return null;
}

function setCachedData(appId: number, data: Omit<GameData, 'timestamp'>) {
  localStorage.setItem(`rating_${appId}`, JSON.stringify({
    ...data,
    timestamp: Date.now()
  }));
}

// Fetch all game data from SteamSpy (via our API to avoid CORS)
async function fetchSteamSpyData(appId: number): Promise<GameData | null> {
  try {
    // Use RequestQueue with 2 retries to handle rate limiting
    const response = await steamRequestQueue.enqueueWithRetry(
      () => fetch(`/api/steamspy-rating?appid=${appId}`),
      'low',
      2  // 2 retry attempts
    );
    const data = await response.json();
    
    if (!response.ok || data.error) {
      return null;
    }
    
    return {
      score: data.rating,
      tags: data.tags || [],
      releaseDate: data.releaseDate,
      price: data.price,
      medianMinutes: data.medianMinutes || null,
      timestamp: Date.now()
    };
  } catch (e) {
    // Fetch failed after retries
    console.warn(`⚠️ SteamSpy data failed for ${appId} after retries`);
    return null;
  }
}

// Fetch data for a batch of games (10 parallel)
async function fetchDataBatch(games: SteamGame[]): Promise<Map<number, Partial<SteamGame>>> {
  const gameDataMap = new Map<number, Partial<SteamGame>>();
  
  const fetchPromises = games.map(async (game) => {
    // Check cache first
    const cached = getCachedData(game.appid);
    if (cached) {
      gameDataMap.set(game.appid, {
        rating: cached.score,
        tags: cached.tags,
        releaseDate: cached.releaseDate,
        price: cached.price,
        medianMinutes: cached.medianMinutes
      });
      return;
    }
    
    // Fetch from SteamSpy
    const data = await fetchSteamSpyData(game.appid);
    if (data) {
      gameDataMap.set(game.appid, {
        rating: data.score,
        tags: data.tags,
        releaseDate: data.releaseDate,
        price: data.price,
        medianMinutes: data.medianMinutes
      });
      setCachedData(game.appid, {
        score: data.score,
        tags: data.tags,
        releaseDate: data.releaseDate,
        price: data.price,
        medianMinutes: data.medianMinutes
      });
    }
  });
  
  await Promise.all(fetchPromises);
  return gameDataMap;
}

// Get most played game (using effective playtime)
function getMostPlayedGame(games: SteamGame[], ignoredList: number[] = []): SteamGame | null {
  const playedGames = games.filter(g => getEffectivePlaytime(g, ignoredList) > 0);
  if (playedGames.length === 0) return null;
  
  return playedGames.reduce((max, game) => 
    getEffectivePlaytime(game, ignoredList) > getEffectivePlaytime(max, ignoredList) ? game : max
  );
}

// Get top 5 most played games (using effective playtime)
function getTop5MostPlayed(games: SteamGame[], ignoredList: number[] = []): SteamGame[] {
  return games
    .filter(g => getEffectivePlaytime(g, ignoredList) > 0)
    .sort((a, b) => getEffectivePlaytime(b, ignoredList) - getEffectivePlaytime(a, ignoredList))
    .slice(0, 5);
}

// Get top 5 genres by playtime (using effective playtime)
function getTop5Genres(games: SteamGame[], steamCategoriesCache: Map<number, string[]>, ignoredList: number[] = []): Array<{genre: string, hours: number}> {
  const genrePlaytime = new Map<string, number>();
  
  games.forEach(game => {
    const effectiveTime = getEffectivePlaytime(game, ignoredList);
    if (effectiveTime === 0) return;
    
    // Get genres from the passed-in cache Map (NOT from localStorage)
    const genres = steamCategoriesCache.get(game.appid) || [];
    
    // Add effective playtime to each genre
    genres.forEach((genre: string) => {
      const currentHours = genrePlaytime.get(genre) || 0;
      genrePlaytime.set(genre, currentHours + (effectiveTime / 60));
    });
  });
  
  const result = Array.from(genrePlaytime.entries())
    .map(([genre, hours]) => ({ genre, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);
  
  return result;
}

function LibraryStats({ games, playedElsewhereList, ignoredPlaytimeList, steamCategoriesCache, friendsData, ratingsLoading, ratingsLoaded, ratingsTotal, playerName }: { games: SteamGame[], playedElsewhereList: number[], ignoredPlaytimeList: number[], steamCategoriesCache: Map<number, string[]>, friendsData: { friends: any[], timeAgo: string, loading?: boolean } | null, ratingsLoading: boolean, ratingsLoaded: number, ratingsTotal: number, playerName: string }) {
  const stats = calculateStats(games, playedElsewhereList, ignoredPlaytimeList);
  const lastNewGame = getLastNewGame(games);
  const mostPlayed = getMostPlayedGame(games, ignoredPlaytimeList);
  const top5Games = getTop5MostPlayed(games, ignoredPlaytimeList);
  const top5Genres = getTop5Genres(games, steamCategoriesCache, ignoredPlaytimeList);
  
  // Calculate percentage of total time for most played game
  const mostPlayedPercentage = mostPlayed && stats.totalMinutes > 0
    ? ((mostPlayed.playtime_forever / stats.totalMinutes) * 100).toFixed(1)
    : null;
  
  // Social features data
  const playerTopGenres = getPlayerTopGenres(games, steamCategoriesCache);
  const friendLeaderboard = mostPlayed && friendsData && friendsData.friends ? getFriendLeaderboard(mostPlayed, playerName, friendsData.friends) : [];
  const friendsTopGames = friendsData && friendsData.friends ? getFriendsTopGames(friendsData.friends) : [];
  // const genreBuddiesRanked = friendsData && friendsData.friends ? getGenreBuddiesRanked(playerTopGenres, friendsData.friends, steamCategoriesCache) : [];
  const totalPlaytimeLeaderboard = friendsData && friendsData.friends ? getTotalPlaytimeLeaderboard(stats.totalMinutes, playerName, friendsData.friends) : [];
  const librarySizeLeaderboard = friendsData && friendsData.friends ? getLibrarySizeLeaderboard(stats.totalGames, playerName, friendsData.friends) : [];
  const playerPlayedGames = games.filter(g => g.playtime_forever > 0).length;
  const completionRateLeaderboard = friendsData && friendsData.friends ? getCompletionRateLeaderboard(stats.totalGames, playerPlayedGames, playerName, friendsData.friends) : [];
  const mostPlayedGamesLeaderboard = friendsData && friendsData.friends ? getMostPlayedGamesLeaderboard(playerPlayedGames, playerName, friendsData.friends) : [];
  const displayTimeAgo = friendsData?.timeAgo || 'not yet synced';
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Row 1 */}
      <div className="bg-gray-700 rounded p-5 text-center">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1">Total Games</div>
        <div className="text-3xl sm:text-2xl font-bold">{stats.totalGames}</div>
      </div>
      
      <div className="bg-gray-700 rounded p-5 text-center">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1">Never Played Games</div>
        <div className="text-3xl sm:text-2xl font-bold text-red-400">{stats.neverPlayed}</div>
      </div>
      
      <div className="bg-gray-700 rounded p-5 text-center">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1">Total Playtime</div>
        <div className="text-3xl sm:text-2xl font-bold">{formatPlaytimeDetailed(stats.totalMinutes)}</div>
      </div>
      
      {/* Row 2 */}
      <div className="bg-gray-700 rounded p-5 text-center">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1">Tried</div>
        <div className="text-3xl sm:text-2xl font-bold text-green-400">{stats.completionRate}%</div>
      </div>
      
      <div className="bg-gray-700 rounded p-5 text-center">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1">Cost Per Hour</div>
        {stats.costPerHour !== null ? (
          <>
            <div className="text-3xl sm:text-2xl font-bold text-yellow-400">${stats.costPerHour.toFixed(2)}</div>
            <div className="text-xs text-gray-400 mt-1 sm:mt-0.5">{stats.gamesWithPrice} games</div>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-400">No data</div>
            <div className="text-xs text-gray-500">Check Steam privacy</div>
          </>
        )}
      </div>
      
      <div className="bg-gray-700 rounded p-5 text-center">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1">Last New Game</div>
        {lastNewGame ? (
          <>
            <div className="text-lg sm:text-base font-bold text-blue-400 truncate px-2">{lastNewGame.game.name}</div>
            <div className="text-xs text-gray-400 mt-1 sm:mt-0.5">{lastNewGame.daysAgo}d ago</div>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-400">No data</div>
            <div className="text-xs text-gray-500">Check Steam privacy</div>
          </>
        )}
      </div>
      
      {/* Row 3 */}
      <div className="bg-gray-700 rounded p-5">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1 text-center">Most Played</div>
        {mostPlayed ? (
          <div className="flex flex-col items-center gap-2">
            {mostPlayed.img_icon_url && (
              <img
                src={`https://media.steampowered.com/steamcommunity/public/images/apps/${mostPlayed.appid}/${mostPlayed.img_icon_url}.jpg`}
                alt={mostPlayed.name}
                className="w-12 h-12 rounded"
              />
            )}
            <div className="text-center min-w-0 w-full">
              <div className="text-lg sm:text-base font-bold text-purple-400 truncate px-2">{mostPlayed.name}</div>
              <div className="text-sm sm:text-xs text-gray-400">{formatPlaytimeDetailed(mostPlayed.playtime_forever)}</div>
              {mostPlayedPercentage && (
                <div className="text-xs text-gray-500">{mostPlayedPercentage}% of total</div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-400 text-center">No data</div>
            <div className="text-xs text-gray-500 text-center">Check Steam privacy</div>
          </>
        )}
      </div>
      
      <div className="bg-gray-700 rounded p-5">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1 text-center">Top 5 Games</div>
        {top5Games.length > 0 ? (
          <div className="space-y-1">
            {top5Games.map((game, i) => (
              <a 
                key={game.appid} 
                href={`#game-${game.appid}`}
                className="flex items-center justify-between text-xs text-gray-300 hover:text-blue-400 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById(`game-${game.appid}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('ring-2', 'ring-blue-500');
                    setTimeout(() => {
                      element.classList.remove('ring-2', 'ring-blue-500');
                    }, 2000);
                  }
                }}
              >
                <span className="truncate flex-1 text-sm sm:text-xs">{i + 1}. {truncateText(game.name, 20)}</span>
                <span className="text-purple-400 ml-2 text-sm sm:text-xs whitespace-nowrap">{formatPlaytimeDetailed(game.playtime_forever)}</span>
              </a>
            ))}
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-400 text-center">No data</div>
            <div className="text-xs text-gray-500 text-center">Check Steam privacy</div>
          </>
        )}
      </div>
      
      <div className="bg-gray-700 rounded p-5">
        <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1 text-center">Top 5 Genres</div>
        {top5Genres.length > 0 ? (
          <div className="space-y-1">
            {top5Genres.map((item, i) => (
              <div key={item.genre} className="flex items-center justify-between text-xs text-gray-300">
                <span className="truncate flex-1 text-sm sm:text-xs">{i + 1}. {item.genre}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center">
            No genre data yet
          </div>
        )}
      </div>
      
      {/* Row 4 - Social Features */}
      {friendsData && (
        <>
          <div className="bg-gray-700 rounded p-5">
            <div className="text-gray-400 text-sm sm:text-xs mb-2 sm:mb-1 text-center">
              Top Game Position
              <span className="text-xs text-gray-500 ml-1">({displayTimeAgo})</span>
            </div>
            {friendLeaderboard.length > 0 && mostPlayed ? (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-purple-400 text-center truncate px-2 mb-2">
                  {mostPlayed.name}
                </div>
                {friendLeaderboard.map((entry) => (
                  <div key={entry.steamid} className="flex items-center justify-between text-xs">
                    {entry.steamid === 'separator' ? (
                      <span className="text-gray-500 text-center w-full">...</span>
                    ) : entry.steamid === 'you' ? (
                      <span className="font-bold text-blue-400 truncate flex-1">
                        {entry.position}. {entry.name}
                      </span>
                    ) : (
                      <a
                        href={entry.profileurl || `https://steamcommunity.com/profiles/${entry.steamid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-blue-400 truncate flex-1"
                      >
                        {entry.position}. {entry.name}
                      </a>
                    )}
                    {entry.steamid !== 'separator' && (
                      <span className="text-purple-400 ml-2">
                        {entry.playtime === 0 && entry.steamid !== 'you' ? 'Private Profile' : formatPlaytimeDetailed(entry.playtime)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-400 text-center">No data</div>
                <div className="text-xs text-gray-500 text-center">Check Steam privacy</div>
              </>
            )}
          </div>
          
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm mb-1 text-center">Friends' Combined Top 5</div>
            {friendsTopGames.length > 0 ? (
              <div className="space-y-1">
                {friendsTopGames.map((game: any, i: number) => (
                  <div key={game.appid} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 truncate flex-1">{i + 1}. {game.name}</span>
                    <span className="text-purple-400 ml-2">{formatPlaytimeDetailed(game.totalPlaytime)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center">
                {friendsData.loading ? 'Loading...' : 'No data'}
              </div>
            )}
          </div>
          
          {/* Genre Buddies - COMMENTED OUT FOR FUTURE USE
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm mb-1 text-center">
              Genre Buddies
            </div>
            <div className="text-xs text-gray-500 text-center mb-2">
              Friends with your top genres
            </div>
            {genreBuddiesRanked.length > 0 ? (
              <div className="space-y-1">
                {genreBuddiesRanked.map((buddy, i) => (
                  <div key={buddy.friend.steamid} className="flex items-center justify-between text-xs">
                    <a
                      href={buddy.friend.profileurl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-blue-400 truncate flex-1"
                    >
                      {i + 1}. {buddy.friend.personaname}
                    </a>
                    <span className="text-purple-400 ml-2">
                      ({buddy.matchCount} matches)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center">
                {friendsData.loading ? 'Loading...' : 'No genre buddies found'}
              </div>
            )}
          </div>
          */}
          
          {/* Total Playtime Position */}
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm mb-1 text-center">
              <Link href="/debug/friends" className="hover:text-blue-400 transition-colors">
                Total Playtime Position
              </Link>
              <span className="text-xs text-gray-500 ml-1">({displayTimeAgo})</span>
            </div>
            {totalPlaytimeLeaderboard.length > 0 ? (
              <div className="space-y-1">
                {totalPlaytimeLeaderboard.map((entry) => (
                  <div key={entry.steamid} className="flex items-center justify-between text-xs">
                    {entry.steamid === 'separator' ? (
                      <span className="text-gray-500 text-center w-full">...</span>
                    ) : entry.steamid === 'you' ? (
                      <span className="font-bold text-blue-400 truncate flex-1">
                        {entry.position}. {entry.name}
                      </span>
                    ) : (
                      <a
                        href={entry.profileurl || `https://steamcommunity.com/profiles/${entry.steamid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-blue-400 truncate flex-1"
                      >
                        {entry.position}. {entry.name && entry.name.trim() ? entry.name : <span className="italic">Private Profile</span>}
                      </a>
                    )}
                    {entry.steamid !== 'separator' && (
                      <span className="text-purple-400 ml-2">
                        {formatPlaytimeDetailed(entry.playtime)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center">
                {friendsData.loading ? 'Loading...' : 'No friends data'}
              </div>
            )}
          </div>
          
          {/* Largest Game Collection */}
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm mb-1 text-center">
              <Link href="/debug/friends" className="hover:text-blue-400 transition-colors">
                Largest Game Collection
              </Link>
              <span className="text-xs text-gray-500 ml-1">({displayTimeAgo})</span>
            </div>
            {librarySizeLeaderboard.length > 0 ? (
              <div className="space-y-1">
                {librarySizeLeaderboard.map((entry) => (
                  <div key={entry.steamid} className="flex items-center justify-between text-xs">
                    {entry.steamid === 'separator' ? (
                      <span className="text-gray-500 text-center w-full">...</span>
                    ) : entry.steamid === 'you' ? (
                      <span className="font-bold text-blue-400 truncate flex-1">
                        {entry.position}. {entry.name}
                      </span>
                    ) : (
                      <a
                        href={entry.profileurl || `https://steamcommunity.com/profiles/${entry.steamid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-blue-400 truncate flex-1"
                      >
                        {entry.position}. {entry.name && entry.name.trim() ? entry.name : <span className="italic">Private Profile</span>}
                      </a>
                    )}
                    {entry.steamid !== 'separator' && (
                      <span className="text-purple-400 ml-2">
                        {entry.playtime === 0 && entry.steamid !== 'you' ? <span className="italic">Private Profile</span> : `${entry.playtime} games`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center">
                {friendsData.loading ? 'Loading...' : 'No friends data'}
              </div>
            )}
          </div>
          
          {/* Played the Most Games */}
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm mb-1 text-center">
              <Link href="/debug/friends" className="hover:text-blue-400 transition-colors">
                Played the Most Games
              </Link>
              <span className="text-xs text-gray-500 ml-1">({displayTimeAgo})</span>
            </div>
            {mostPlayedGamesLeaderboard.length > 0 ? (
              <div className="space-y-1">
                {mostPlayedGamesLeaderboard.map((entry) => (
                  <div key={entry.steamid} className="flex items-center justify-between text-xs">
                    {entry.steamid === 'separator' ? (
                      <span className="text-gray-500 text-center w-full">...</span>
                    ) : entry.steamid === 'you' ? (
                      <span className="font-bold text-blue-400 truncate flex-1">
                        {entry.position}. {entry.name}
                      </span>
                    ) : (
                      <a
                        href={entry.profileurl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-blue-400 truncate flex-1"
                      >
                        {entry.position}. {entry.name && entry.name.trim() ? entry.name : <span className="italic">Private Profile</span>}
                      </a>
                    )}
                    {entry.steamid !== 'separator' && (
                      <span className="text-purple-400 ml-2">
                        {entry.playtime === 0 && entry.steamid !== 'you' ? <span className="italic">Private Profile</span> : `${entry.playtime} games`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center">
                {friendsData.loading ? 'Loading...' : 'No friends data'}
              </div>
            )}
          </div>
          
          {/* Most Played Library */}
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm mb-1 text-center">
              <Link href="/debug/friends" className="hover:text-blue-400 transition-colors">
                Most Played Library
              </Link>
              <span className="text-xs text-gray-500 ml-1">({displayTimeAgo})</span>
            </div>
            {completionRateLeaderboard.length > 0 ? (
              <div className="space-y-1">
                {completionRateLeaderboard.map((entry) => (
                  <div key={entry.steamid} className="flex items-center justify-between text-xs">
                    {entry.steamid === 'separator' ? (
                      <span className="text-gray-500 text-center w-full">...</span>
                    ) : entry.steamid === 'you' ? (
                      <span className="font-bold text-blue-400 truncate flex-1">
                        {entry.position}. {entry.name}
                      </span>
                    ) : (
                      <a
                        href={entry.profileurl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-blue-400 truncate flex-1"
                      >
                        {entry.position}. {entry.name && entry.name.trim() ? entry.name : <span className="italic">Private Profile</span>}
                      </a>
                    )}
                    {entry.steamid !== 'separator' && (
                      <span className="text-purple-400 ml-2">
                        ({entry.totalGames} games) {Math.round(entry.completionRate)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center">
                {friendsData.loading ? 'Loading...' : 'No friends data'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RatingProgressBanner({ 
  loading, 
  loaded, 
  total,
  stage 
}: { 
  loading: boolean;
  loaded: number;
  total: number;
  stage: LoadingStage;
}) {
  // Don't show banner if idle
  if (stage === 'idle') return null;
  
  const percentage = total > 0 ? (loaded / total) * 100 : 0;
  
  // Determine message based on stage
  let message = '';
  let showProgress = false;
  let isComplete = false;
  
  switch (stage) {
    case 'profile':
      message = '⏳ Loading Your Steam Profile...';
      break;
    case 'friends':
      message = '⏳ Loading Friends Data (this may take a few)...';
      break;
    case 'gameinfo':
      message = '⏳ Loading Game Information...';
      showProgress = true;
      break;
    case 'complete':
      message = '✅ Ready! Genres loading in background...';
      isComplete = true;
      break;
  }
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className={`rounded-lg p-4 shadow-lg border-2 ${
        isComplete 
          ? 'bg-green-900 border-green-500' 
          : 'bg-gray-800 border-blue-500'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {message}
          </span>
          {showProgress && (
            <span className="text-xs text-gray-400">{loaded}/{total}</span>
          )}
        </div>
        {showProgress && (
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all duration-300 bg-blue-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
        {(stage === 'profile' || stage === 'friends') && (
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div className="h-2 bg-blue-500 animate-pulse w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({
  game, 
  onNewSuggestion,
  onNeverSuggest,
  onTogglePlayedElsewhere,
  playedElsewhereList,
  hiddenCount,
  onResetHidden,
  storeData,
  storeLoading,
  games,
  steamCategoriesCache,
  friendsData,
  onToggleWannaPlay,
  wannaPlayList
}: { 
  game: SteamGame | null;
  onNewSuggestion: () => void;
  onNeverSuggest: (appId: number) => void;
  onTogglePlayedElsewhere: (appId: number) => void;
  playedElsewhereList: number[];
  hiddenCount: number;
  onResetHidden: () => void;
  storeData: SteamStoreData | null;
  storeLoading: boolean;
  games: SteamGame[];
  steamCategoriesCache: Map<number, string[]>;
  friendsData: any;
  onToggleWannaPlay: (appId: number) => void;
  wannaPlayList: number[];
}) {
  const [showFullDescription, setShowFullDescription] = useState(false);
  
  // Helper function to calculate years ago from release date string
  const calculateYearsAgo = (dateString: string | null): { years: number; text: string } | null => {
    if (!dateString) return null;
    
    try {
      // Try to extract year from various formats
      const yearMatch = dateString.match(/\d{4}/);
      if (!yearMatch) return null;
      
      const releaseYear = parseInt(yearMatch[0]);
      const currentYear = new Date().getFullYear();
      const years = currentYear - releaseYear;
      
      if (years === 0) return { years: 0, text: 'Released this year!' };
      if (years === 1) return { years: 1, text: 'Released 1 year ago' };
      return { years, text: `Released ${years} years ago` };
    } catch (e) {
      return null;
    }
  };
  
  if (!game) {
    if (hiddenCount > 0) {
      return (
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border-2 border-gray-600">
          <p className="text-gray-400 text-center mb-4">
            No more games to suggest! You've hidden {hiddenCount} game{hiddenCount !== 1 ? 's' : ''}.
          </p>
          <button
            onClick={onResetHidden}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition"
          >
            🔄 Reset Hidden Games
          </button>
        </div>
      );
    }
    return null;
  }
  
  // Truncate description if needed (roughly 2 rows of text)
  const description = storeData?.short_description || '';
  const shouldTruncate = description.length > 300;
  const displayDescription = shouldTruncate && !showFullDescription 
    ? description.slice(0, 300) + '...' 
    : description;
  
  const releaseInfo = storeData?.release_date.coming_soon 
    ? null 
    : calculateYearsAgo(storeData?.release_date.date || null);
  
  // Calculate Steam user review percentage
  const steamRating = storeData && storeData.positive_reviews && storeData.negative_reviews
    ? Math.round((storeData.positive_reviews / (storeData.positive_reviews + storeData.negative_reviews)) * 100)
    : null;
  
  // Check if video is available
  const hasVideo = storeData?.movies && storeData.movies.length > 0;
  const firstVideo = hasVideo ? storeData.movies[0] : null;
  
  // Get friends with significant playtime (50+ hours)
  const friendsWhoLoveIt = game && friendsData 
    ? getFriendsWithSignificantPlaytime(game.appid, friendsData.friends, 50)
    : [];
  
  // Genre matching logic
  const playerTop5Genres = getTop5Genres(games, steamCategoriesCache);
  const playerGenreNames = playerTop5Genres.map(g => g.genre);
  const gameGenres = storeData?.genres || [];
  
  // Find matching genres
  const matchedGenres = gameGenres.filter(genre => playerGenreNames.includes(genre));
  const matchCount = matchedGenres.length;
  
  // Determine badge tier
  let badge: { emoji: string; text: string; color: string; detail: string } | null = null;
  
  if (matchCount >= 3) {
    // Perfect Match: 3+ genres match
    badge = {
      emoji: '🎯',
      text: 'Perfect Match',
      color: 'bg-purple-600 border-purple-400',
      detail: `Matches ${matchedGenres.join(', ')}`
    };
  } else if (matchCount === 2) {
    // Your Style: Exactly 2 genres match
    badge = {
      emoji: '⭐',
      text: 'Your Style',
      color: 'bg-blue-600 border-blue-400',
      detail: `Matches ${matchedGenres.join(', ')}`
    };
  } else if (matchCount === 1) {
    // Possible Hit: Exactly 1 genre match
    badge = {
      emoji: '⚡',
      text: 'Possible Hit',
      color: 'bg-teal-600 border-teal-400',
      detail: `Matches ${matchedGenres.join(', ')}`
    };
  } else {
    // Outside player's genres - check for Hidden Gem or Taste Changer
    const hasHighRating = game.rating && game.rating >= 80;
    const hasHighRecommendations = storeData?.recommendations && storeData.recommendations >= 10000;
    
    if (hasHighRating && hasHighRecommendations) {
      // Hidden Gem: BOTH high rating AND high recommendations
      badge = {
        emoji: '💎',
        text: 'Hidden Gem',
        color: 'bg-cyan-600 border-cyan-400',
        detail: 'Highly rated and popular outside your usual genres'
      };
    } else if (hasHighRating || hasHighRecommendations) {
      // Taste Changer: EITHER high rating OR high recommendations
      badge = {
        emoji: '🌟',
        text: 'Taste Changer',
        color: 'bg-yellow-600 border-yellow-400',
        detail: 'Worth exploring outside your usual genres'
      };
    }
  }
  
  // Debug logging
  console.log('🎮 SuggestionCard Render:', {
    gameName: game.name,
    gameAppId: game.appid,
    storeLoading,
    hasStoreData: !!storeData,
    headerImageUrl: storeData?.header_image,
    storeDataKeys: storeData ? Object.keys(storeData) : null
  });
  
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden mb-6 border border-gray-700 shadow-xl">
      {/* Image Banner */}
      {storeLoading ? (
        <div className="w-full aspect-video md:aspect-auto md:h-64 bg-gray-800 flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : storeData?.header_image ? (
        <div className="w-full aspect-video md:aspect-auto md:h-64 bg-black flex items-center justify-center">
          <img
            src={storeData.header_image}
            alt={game.name}
            className="w-full h-full object-contain"
            onLoad={() => console.log('✅ Showcase image loaded:', storeData.header_image)}
            onError={() => console.error('❌ Showcase image failed:', storeData.header_image)}
          />
        </div>
      ) : (
        <div className="w-full aspect-video md:aspect-auto md:h-64 bg-gray-800 flex items-center justify-center">
          <div className="text-gray-400 text-center px-4">
            <div className="text-lg mb-2">No image available</div>
            <div className="text-xs text-gray-500">
              Genre loading in background may affect image display.
              <br />
              Try clicking "Suggest Another" to retry.
            </div>
          </div>
        </div>
      )}
      
      <div className="p-6">
        {/* Game Title */}
        <h3 className="text-2xl font-bold mb-2">{game.name}</h3>
        
        {/* Description */}
        {storeLoading && !storeData && (
          <div className="mb-4">
            <div className="h-4 bg-gray-700 rounded animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div>
          </div>
        )}
        
        {description && (
          <div className="mb-4">
            <p className="text-gray-300 text-base italic leading-relaxed">
              "{displayDescription}"
            </p>
            {shouldTruncate && (
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                {showFullDescription ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}
        
        {/* Genres */}
        {storeData?.genres && storeData.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {storeData.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-3 py-1 bg-gray-600 text-gray-200 rounded-full text-xs font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
        
        {/* Genre Match Badge */}
        {badge && (
          <div className={`${badge.color} border-2 rounded-lg p-3 mb-4`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{badge.emoji}</span>
              <span className="font-bold text-lg">{badge.text}</span>
            </div>
            <p className="text-sm text-gray-100">{badge.detail}</p>
          </div>
        )}
        
        {/* Release Date & Social Proof */}
        <div className="bg-black/30 backdrop-blur-sm rounded p-4 mb-4 space-y-2 border border-gray-800">
          {/* 1. Release Date */}
          {storeData?.release_date.coming_soon ? (
            <div className="text-sm">
              📅 <span className="text-yellow-400 font-semibold">Coming Soon</span>
            </div>
          ) : releaseInfo ? (
            <div className="text-sm">
              📅 <span className="font-semibold">{storeData?.release_date.date}</span>
              <span className="text-gray-400 ml-2">({releaseInfo.text}!)</span>
            </div>
          ) : storeLoading ? (
            <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2"></div>
          ) : null}
          
          {/* 2. Friends Love This */}
          {friendsWhoLoveIt.length > 0 && (
            <div className="text-sm">
              🤝 {friendsWhoLoveIt.slice(0, 3).map((f, i) => (
                <span key={f.steamid}>
                  <a
                    href={f.profileurl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-400 hover:text-blue-300"
                  >
                    {f.personaname}
                  </a>
                  {i < Math.min(2, friendsWhoLoveIt.length - 1) ? ', ' : ''}
                  {i === 2 && friendsWhoLoveIt.length > 3 && (
                    <span className="text-gray-400"> and {friendsWhoLoveIt.length - 3} more</span>
                  )}
                </span>
              ))}
              <span className="text-gray-400"> spent 50+ hours playing this</span>
            </div>
          )}
          
          {/* 3. Recommendations (Steam "thumbs up" count) */}
          {storeData?.recommendations && (
            <div className="text-sm">
              👥 <span className="font-semibold">{storeData.recommendations.toLocaleString()} players</span>
              <span className="text-gray-400 ml-1">recommend this</span>
            </div>
          )}
          
          {/* 4. Metacritic */}
          {storeData?.metacritic && (
            <div className="text-sm">
              📈 <span className="font-semibold">Metacritic: {storeData.metacritic}</span>
            </div>
          )}
          
          {/* 5. SteamSpy Rating (fallback if available) */}
          {game.rating !== undefined && game.rating !== null && (
            <div className="text-sm">
              ⭐ <span className="font-semibold">{game.rating}% positive</span>
              <span className="text-gray-400 ml-1">(SteamSpy)</span>
            </div>
          )}
          
          {/* 6. Median Playtime (from SteamSpy) */}
          {game.medianMinutes !== undefined && game.medianMinutes !== null && game.medianMinutes > 0 && (
            <div className="text-sm">
              ⏱️ <span className="font-semibold">Median playtime: {Math.round(game.medianMinutes / 60)} hours</span>
              <span className="text-gray-400 ml-1">({getPlaytimeLabel(game.medianMinutes / 60)})</span>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={onNewSuggestion}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition text-sm sm:text-base"
          >
            🎲 Suggest Another
          </button>
          <button
            onClick={() => onToggleWannaPlay(game.appid)}
            className={`px-4 py-2 rounded font-medium transition text-sm sm:text-base ${
              wannaPlayList.includes(game.appid)
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ❤️ Want To Play
          </button>
          <button
            onClick={() => onNeverSuggest(game.appid)}
            className="px-4 py-2 bg-red-900/70 hover:bg-red-900 rounded font-medium transition text-sm sm:text-base"
          >
            🚫 Never Suggest
          </button>
          <button
            onClick={() => onTogglePlayedElsewhere(game.appid)}
            className={`px-4 py-2 rounded font-medium transition text-sm sm:text-base ${
              playedElsewhereList.includes(game.appid)
                ? 'bg-blue-700 hover:bg-blue-600'
                : 'bg-blue-900/70 hover:bg-blue-900'
            }`}
          >
            {playedElsewhereList.includes(game.appid) ? '✅ Played Elsewhere' : '🎮 Played Elsewhere'}
          </button>
          <button
            onClick={(e) => handleSteamLink(game.appid, e)}
            className="col-span-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition text-sm sm:text-base"
          >
            ▶ Play Now
          </button>
        </div>
        
        {/* How we pick explanation */}
        <div className="border-t border-gray-700 pt-3">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
              🤔 How we pick a Scouted game
            </summary>
            <div className="mt-3 text-gray-300 space-y-3">
              <div>
                <p className="text-sm font-semibold mb-2">📊 Smart Selection (90% of the time):</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• 🎯 Prioritizes games matching your top 5 genres</li>
                  <li>• ⭐ Weights by SteamSpy ratings (0-100)</li>
                  <li>• 🤝 Boosts games your friends have played</li>
                  <li>• 🎲 Picks randomly from top 20% for variety</li>
                </ul>
              </div>
              
              <div>
                <p className="text-sm font-semibold mb-2">🌟 Taste Changer Mode (10% of the time):</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Suggests highly-rated games OUTSIDE your usual genres</li>
                  <li>• Helps you discover new types of games</li>
                  <li>• Only picks games with 70%+ ratings</li>
                </ul>
              </div>
              
              <div>
                <p className="text-sm font-semibold mb-2">🚫 We exclude:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Games you've marked "Never Suggest"</li>
                  <li>• Games you've "Played Elsewhere"</li>
                  <li>• (We keep "Want to Play" games to remind you!)</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

type LoadingStage = 'idle' | 'profile' | 'friends' | 'gameinfo' | 'cleanup' | 'complete';

export default function Home() {
  const [steamId, setSteamId] = useState('');
  const [games, setGames] = useState<SteamGame[]>([]);
  const [playerName, setPlayerName] = useState<string>('Your');
  
  // Social features integration
  const { friendsData, loading: friendsLoading, error: friendsError, timeAgo, reloadFromCache } = useFriendsData(steamId || null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [error, setError] = useState('');
  const [showOnlyNeverPlayed, setShowOnlyNeverPlayed] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('best-match');
  const [suggestion, setSuggestion] = useState<SteamGame | null>(null);
  const [neverSuggestList, setNeverSuggestList] = useState<number[]>([]);
  const [playedElsewhereList, setPlayedElsewhereList] = useState<number[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsLoaded, setRatingsLoaded] = useState(0);
  const [ratingsTotal, setRatingsTotal] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rememberSteamId, setRememberSteamId] = useState(false);
  const [storeData, setStoreData] = useState<SteamStoreData | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [steamIdCollapsed, setSteamIdCollapsed] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  const [showcaseCollapsed, setShowcaseCollapsed] = useState(false);
  const [trendingCollapsed, setTrendingCollapsed] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(true); // Collapsed by default
  const [steamCategoriesCache, setSteamCategoriesCache] = useState<Map<number, string[]>>(new Map());
  const [excludeVR, setExcludeVR] = useState(false);
  const [excludeMultiplayer, setExcludeMultiplayer] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [ignoredPlaytimeList, setIgnoredPlaytimeList] = useState<number[]>([]);
  const [wannaPlayList, setWannaPlayList] = useState<number[]>([]);
  const [showOnlyWannaPlay, setShowOnlyWannaPlay] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [failedRequests, setFailedRequests] = useState<FailedGameRequest[]>([]);
  const [loadStats, setLoadStats] = useState({ total: 0, successful: 0, failed: 0 });
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  
  // Fetch Steam Store data with caching
  const fetchStoreData = async (appId: number) => {
    console.log('🔍 fetchStoreData called for appId:', appId);
    
    // Check cache first (30-day TTL)
    const cacheKey = `steam_store_${appId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        
        // Check cache version - invalidate if outdated
        if (parsedCache.version !== STEAM_STORE_CACHE_VERSION) {
          console.log('🔄 Cache version mismatch for', appId, '- Expected:', STEAM_STORE_CACHE_VERSION, 'Got:', parsedCache.version);
          localStorage.removeItem(cacheKey);
          // Fall through to fetch fresh data
        } else {
          const age = Date.now() - parsedCache.timestamp;
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          
          if (age < thirtyDays) {
            console.log('✅ Using cached store data for', appId, '- has header_image:', !!parsedCache.data?.header_image);
            setStoreData(parsedCache.data);
            return;
          } else {
            console.log('⏰ Cache expired for', appId);
          }
        }
      } catch (e) {
        console.error('❌ Invalid cache for', appId, e);
      }
    } else {
      console.log('📭 No cache found for', appId);
    }
    
    // Pause low priority queue for showcase image loading
    steamRequestQueue.pauseLowPriority();
    
    // Fetch from API with HIGH PRIORITY and RETRY (user-triggered action)
    console.log('🌐 Fetching from API for', appId, '(HIGH PRIORITY with retry)');
    setStoreLoading(true);
    
    // Set up timeout to resume low priority queue
    const resumeTimeout = setTimeout(() => {
      steamRequestQueue.resumeLowPriority();
    }, 3000);
    
    try {
      const response = await steamRequestQueue.enqueueWithRetry(
        () => fetch(`/api/steam-store?appid=${appId}`),
        'high',
        2 // Max 2 retry attempts
      );
      const data = await response.json();
      
      console.log('📦 API Response:', { appId, ok: response.ok, status: response.status, hasData: !!data, hasHeaderImage: !!data?.header_image });
      
      if (response.ok) {
        setStoreData(data);
        // Cache the result with version
        localStorage.setItem(cacheKey, JSON.stringify({
          version: STEAM_STORE_CACHE_VERSION,
          data,
          timestamp: Date.now()
        }));
        // Update GENRES cache (NOT categories!)
        if (data.genres && data.genres.length > 0) {
          setSteamCategoriesCache(prev => {
            const newCache = new Map(prev);
            newCache.set(appId, data.genres);
            return newCache;
          });
        }
      } else if (response.status === 404) {
        // Game not found on Steam (region-locked, removed, or unreleased) - this is normal
        console.warn(`⚠️ Game ${appId} not available on Steam Store (404):`, data.message);
        setStoreData(null);
      } else {
        // Other errors (rate limiting, server errors, etc.) - handled gracefully, app continues working
        console.warn('⚠️ Steam Store API error for', appId, '- Status:', response.status, '- Message:', data.message, '(app continues normally)');
        setStoreData(null);
      }
    } catch (error) {
      console.error('❌ Failed to fetch Steam Store data for', appId, error);
      setStoreData(null);
    } finally {
      clearTimeout(resumeTimeout);
      steamRequestQueue.resumeLowPriority();
      setStoreLoading(false);
    }
  };
  
  // Fetch store data when suggestion changes (pre-fetch for immediate display)
  useEffect(() => {
    // Clear old data immediately when suggestion changes
    setStoreData(null);
    
    if (suggestion) {
      fetchStoreData(suggestion.appid);
    }
  }, [suggestion]);
  
  // Load saved Steam ID and remember preference on mount
  useEffect(() => {
    const savedSteamId = localStorage.getItem('savedSteamId');
    const rememberPref = localStorage.getItem('rememberSteamId') === 'true';
    
    if (savedSteamId && rememberPref) {
      setSteamId(savedSteamId);
      setRememberSteamId(true);
    }
    
    // Load collapsed states
    const savedSteamIdCollapsed = localStorage.getItem('collapsed_steamId') === 'true';
    const savedStatsCollapsed = localStorage.getItem('collapsed_stats') === 'true';
    const savedShowcaseCollapsed = localStorage.getItem('collapsed_showcase') === 'true';
    const savedTrendingCollapsed = localStorage.getItem('collapsed_trending') === 'true';
    const savedLibraryCollapsed = localStorage.getItem('collapsed_library') === 'true';
    const savedTagsCollapsed = localStorage.getItem('collapsed_tags');
    setSteamIdCollapsed(savedSteamIdCollapsed);
    setStatsCollapsed(savedStatsCollapsed);
    setShowcaseCollapsed(savedShowcaseCollapsed);
    setTrendingCollapsed(savedTrendingCollapsed);
    setLibraryCollapsed(savedLibraryCollapsed);
    // Tags collapsed by default (true) unless explicitly set to false
    setTagsCollapsed(savedTagsCollapsed === null ? true : savedTagsCollapsed === 'true');
  }, []);
  
  // Click outside handler for settings menu
  useEffect(() => {
    if (!showSettingsMenu) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    
    // Add delay to prevent immediate close from the button click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);
  
  // ⚠️ CRITICAL: Load genres from localStorage into cache on mount
  // This is ESSENTIAL for Top 5 Genres to display! DO NOT REMOVE!
  // Without this, genres stored in localStorage won't load into React state on page refresh
  // and users will see "No genre data yet" even though the data exists.
  useEffect(() => {
    // console.log('[Genre Loader] useEffect triggered, games.length:', games.length);

    if (games.length === 0) {
      // console.log('[Genre Loader] Skipping - no games loaded yet');
      return;
    }

    // console.log('[Genre Loader] Checking localStorage for cached genres...');
    // console.log('[Genre Loader] First 3 game appids:', games.slice(0, 3).map(g => g.appid));
    
    const genreMap = new Map<number, string[]>();
    let loadedCount = 0;
    let totalCacheEntries = 0;
    let sampleCache: any | null = null;
    
    // Check each game's Steam Store cache for genres
    games.forEach((game, index) => {
      const cacheKey = `steam_store_${game.appid}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        totalCacheEntries++;
        try {
          const parsedCache = JSON.parse(cached);
          
          // DEBUG: Show first cache entry structure
          if (index === 0 && !sampleCache) {
            sampleCache = parsedCache;
            console.log(`[Genre Loader] SAMPLE CACHE STRUCTURE for ${game.appid}:`, {
              hasData: !!parsedCache.data,
              hasGenres: !!parsedCache.data?.genres,
              genresType: typeof parsedCache.data?.genres,
              genresLength: parsedCache.data?.genres?.length,
              genresValue: parsedCache.data?.genres,
              fullStructure: parsedCache
            });
          }
          
          if (parsedCache.data?.genres && parsedCache.data.genres.length > 0) {
            genreMap.set(game.appid, parsedCache.data.genres);
            loadedCount++;
            if (loadedCount <= 3) { // Only log first 3
              console.log(`[Genre Loader] ✅ Found genres for game ${game.appid} (${game.name}): ${parsedCache.data.genres.join(', ')}`);
            }
          } else {
            if (index < 3) { // Only log first 3 failures
              console.warn(`[Genre Loader] ❌ Game ${game.appid} (${game.name}) has cache but NO GENRES`);
            }
          }
        } catch (e) {
          console.error(`[Genre Loader] Failed to parse cache for game ${game.appid}:`, e);
        }
      } else {
        if (index < 3) { // Only log first 3 missing
          console.warn(`[Genre Loader] ⚠️ No cache found for game ${game.appid} (${game.name})`);
        }
      }
    });
    
    console.log(`[Genre Loader] Summary: Found ${totalCacheEntries} cache entries out of ${games.length} games, ${loadedCount} have genres`);
    
    if (loadedCount > 0) {
      console.log(`[Genre Loader] ✅ SUCCESS! Loaded ${loadedCount} games with genres from localStorage`);
      setSteamCategoriesCache(genreMap);
    } else {
      console.log('[Genre Loader] ℹ️ No cached genres found - will fetch in background');
    }
  }, [games]);
  
  // Load never suggest list from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('neverSuggest');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setNeverSuggestList(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse neverSuggest from localStorage');
      }
    }
  }, []);
  
  // Load played elsewhere list from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('playedElsewhere');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPlayedElsewhereList(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse playedElsewhere from localStorage');
      }
    }
    
    // Load ignored playtime list
    const ignoredStored = localStorage.getItem('ignoredPlaytime');
    if (ignoredStored) {
      try {
        const parsed = JSON.parse(ignoredStored);
        setIgnoredPlaytimeList(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse ignoredPlaytime from localStorage');
      }
    }
    
    // Load wanna play list
    const wannaPlayStored = localStorage.getItem('wannaPlay');
    if (wannaPlayStored) {
      try {
        const parsed = JSON.parse(wannaPlayStored);
        setWannaPlayList(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse wannaPlay from localStorage');
      }
    }
    
    // Auto-refresh is always enabled
    setAutoRefreshEnabled(true);
  }, []);
  
  // DISABLED: Auto-refresh polling interval
  // User requested to disable automatic checking to prevent unnecessary API calls
  // Manual refresh is still available on the debug/recent-games page
  // useEffect(() => {
  //   if (!steamId || games.length === 0) return;
  //   
  //   // Random interval between 10-15 minutes (in milliseconds)
  //   const minInterval = 10 * 60 * 1000; // 10 minutes
  //   const maxInterval = 15 * 60 * 1000; // 15 minutes
  //   const interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  //   
  //   const intervalId = setInterval(() => {
  //     silentLibraryCheck();
  //   }, interval);
  //   
  //   // Also run an initial check after 30 seconds
  //   const initialTimeout = setTimeout(() => {
  //     silentLibraryCheck();
  //   }, 30000);
  //   
  //   return () => {
  //     clearInterval(intervalId);
  //     clearTimeout(initialTimeout);
  //   };
  // }, [autoRefreshEnabled, steamId, games.length]);
  
  // Auto-start friends verification (silent background process)
  useEffect(() => {
    if (!friendsData || friendsLoading) return;
    
    // Check if we've already auto-started this session
    if (hasAutoStarted()) return;
    
    // Find unverified friends (less than 2 attempts)
    const unverifiedFriends = getUnverifiedFriends(friendsData.friends);
    
    if (unverifiedFriends.length > 0) {
      console.log('🚀 [Main Page] Auto-starting silent verification for', unverifiedFriends.length, 'friends');
      markAutoStarted();
      
      // Start verification with callback to reload cache after each friend
      verifyFriendsBackground(unverifiedFriends, {
        onFriendVerified: () => {
          // Silently reload friends data from cache to update UI
          reloadFromCache();
        }
      });
    }
  }, [friendsData, friendsLoading, reloadFromCache]);
  
  // Update suggestion when games state changes (e.g., when ratings load)
  useEffect(() => {
    if (suggestion && games.length > 0) {
      const updatedGame = games.find(g => g.appid === suggestion.appid);
      if (updatedGame && updatedGame.rating !== suggestion.rating) {
        setSuggestion(updatedGame);
      }
    }
  }, [games, suggestion]);
  
  const fetchGames = async () => {
    if (!steamId.trim()) {
      setError('Please enter a Steam ID');
      return;
    }
    
    // Save Steam ID if remember is checked
    if (rememberSteamId) {
      localStorage.setItem('savedSteamId', steamId);
      localStorage.setItem('rememberSteamId', 'true');
    }
    
    setLoading(true);
    setLoadingStage('profile');
    setError('');
    setGames([]);
    
    try {
      // Stage 1: Fetch player info and games
      const [playerResponse, gamesResponse] = await Promise.all([
        fetch(`/api/steam-player?steamid=${steamId}`),
        fetch(`/api/steam-library?steamid=${steamId}`)
      ]);
      
      // Handle player info
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        setPlayerName(playerData.personaname || 'Your');
      }
      
      // Handle games
      const data = await gamesResponse.json();
      
      if (!gamesResponse.ok) {
        // Use detailed error message from API if available
        const errorMessage = data.message || data.error || 'Failed to fetch games';
        throw new Error(errorMessage);
      }
      
      const loadedGames = data.games || [];
      setGames(loadedGames);
      
      // Stage 2: Friends data (happens automatically via useFriendsData hook)
      setLoadingStage('friends');
      
      // Wait a bit for friends data to start loading (optional - shows the stage briefly)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stage 3: Complete! (App is ready to use)
      setLoadingStage('complete');
      
      // Set initial suggestion (with blacklist and played elsewhere list)
      // Works immediately with random selection, gets smarter as genres load
      setSuggestion(getSuggestion(loadedGames, neverSuggestList, playedElsewhereList, steamCategoriesCache, friendsData));
      
      // Start fetching ratings/genres in background (NON-BLOCKING - happens silently)
      fetchRatingsInBackground(loadedGames);
      
      // Hide completion message after 3 seconds
      setTimeout(() => {
        setLoadingStage('idle');
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoadingStage('idle');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle remember checkbox toggle
  const handleRememberToggle = (checked: boolean) => {
    setRememberSteamId(checked);
    if (checked) {
      // Save current Steam ID if exists
      if (steamId.trim()) {
        localStorage.setItem('savedSteamId', steamId);
      }
      localStorage.setItem('rememberSteamId', 'true');
    } else {
      // Clear saved Steam ID
      localStorage.removeItem('savedSteamId');
      localStorage.removeItem('rememberSteamId');
    }
  };
  
  // Handle Steam ID section collapse toggle
  const toggleSteamIdCollapse = () => {
    const newState = !steamIdCollapsed;
    setSteamIdCollapsed(newState);
    localStorage.setItem('collapsed_steamId', String(newState));
  };
  
  // Handle Stats section collapse toggle
  const toggleStatsCollapse = () => {
    const newState = !statsCollapsed;
    setStatsCollapsed(newState);
    localStorage.setItem('collapsed_stats', String(newState));
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchGames();
    }
  };
  
  // Merge Steam categories and SteamSpy tags with deduplication
  // Steam categories take priority (e.g., "Single-player" beats "Singleplayer")
  const mergeTags = (steamCategories: string[] = [], steamSpyTags: string[] = []): string[] => {
    const normalizeTag = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const merged = [...steamCategories];
    const normalizedSteam = new Set(steamCategories.map(normalizeTag));
    
    // Add SteamSpy tags that don't duplicate Steam categories
    steamSpyTags.forEach(tag => {
      if (!normalizedSteam.has(normalizeTag(tag))) {
        merged.push(tag);
      }
    });
    
    return merged;
  };
  
  // Get top tags across all games (now includes both Steam categories and SteamSpy tags)
  const getTopTags = (games: SteamGame[], storeDataCache: Map<number, string[]>, limit: number = 10): Array<{tag: string, count: number}> => {
    const tagCounts = new Map<string, number>();
    
    games.forEach(game => {
      // Get Steam categories from cache
      const steamCategories = storeDataCache.get(game.appid) || [];
      
      // Get SteamSpy tags from game data
      const steamSpyTags = game.tags || [];
      
      // Merge and deduplicate
      const allTags = mergeTags(steamCategories, steamSpyTags);
      
      allTags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  };
  
  // Filter and sort games
  let filtered = showOnlyNeverPlayed
    ? games.filter(g => g.playtime_forever === 0 && !playedElsewhereList.includes(g.appid))
    : games;
  
  // Apply "Want To Play" filter
  if (showOnlyWannaPlay) {
    filtered = filtered.filter(g => wannaPlayList.includes(g.appid));
  }
  
  // Apply VR exclusion filter
  if (excludeVR) {
    filtered = filtered.filter(game => {
      const steamCategories = steamCategoriesCache.get(game.appid) || [];
      const steamSpyTags = game.tags || [];
      const allTags = mergeTags(steamCategories, steamSpyTags);
      
      // Exclude if game has VR-related tags
      const hasVR = allTags.some(tag => 
        tag.toLowerCase().includes('vr') || 
        tag.toLowerCase().includes('virtual reality')
      );
      
      return !hasVR;
    });
  }
  
  // Apply Multiplayer exclusion filter
  if (excludeMultiplayer) {
    filtered = filtered.filter(game => {
      const steamCategories = steamCategoriesCache.get(game.appid) || [];
      const steamSpyTags = game.tags || [];
      const allTags = mergeTags(steamCategories, steamSpyTags);
      
      // Exclude if game has multiplayer-related tags (excluding co-op)
      const hasMultiplayer = allTags.some(tag => {
        const lowerTag = tag.toLowerCase();
        return (
          lowerTag.includes('multiplayer') ||
          lowerTag.includes('multi-player') ||
          lowerTag.includes('pvp') ||
          lowerTag.includes('mmo') ||
          lowerTag.includes('online pvp')
        ) && !lowerTag.includes('co-op'); // Don't exclude co-op games
      });
      
      return !hasMultiplayer;
    });
  }
  
  // Apply tag filters (AND logic - game must have all selected tags)
  if (selectedTags.length > 0) {
    filtered = filtered.filter(game => {
      // Get both Steam categories and SteamSpy tags
      const steamCategories = steamCategoriesCache.get(game.appid) || [];
      const steamSpyTags = game.tags || [];
      
      // Merge them (with deduplication)
      const allTags = mergeTags(steamCategories, steamSpyTags);
      
      if (allTags.length === 0) return false;
      
      // Check if game has all selected tags
      return selectedTags.every(selectedTag => allTags.includes(selectedTag));
    });
  }
  
  // Get player's top 5 genres for best-match sorting
  const playerTop5Genres = getTop5Genres(games, steamCategoriesCache);
  const playerGenreNames = playerTop5Genres.map(g => g.genre);
  
  const filteredAndSortedGames = sortGames(filtered, sortBy, steamCategoriesCache, playerGenreNames, friendsData);
  
  const neverPlayedCount = games.filter(g => g.playtime_forever === 0).length;
  
  // Handle suggesting another game (smart selection with genre matching, ratings, and friend data)
  const handleNewSuggestion = () => {
    setSuggestion(getSuggestion(games, neverSuggestList, playedElsewhereList, steamCategoriesCache, friendsData));
  };
  
  // Handle never suggesting a game
  const handleNeverSuggest = (appId: number) => {
    const updatedList = [...neverSuggestList, appId];
    setNeverSuggestList(updatedList);
    localStorage.setItem('neverSuggest', JSON.stringify(updatedList));
    
    // Get a new suggestion immediately
    handleNewSuggestion();
  };
  
  // Handle resetting the blacklist
  const handleResetBlacklist = () => {
    setNeverSuggestList([]);
    localStorage.removeItem('neverSuggest');
    // Get a fresh suggestion using smart selection
    if (games.length > 0) {
      setSuggestion(getSuggestion(games, [], playedElsewhereList, steamCategoriesCache, friendsData));
    }
  };
  
  // Handle toggling "played elsewhere" status
  const handleTogglePlayedElsewhere = (appId: number) => {
    const isCurrentlyMarked = playedElsewhereList.includes(appId);
    
    let updatedList: number[];
    if (isCurrentlyMarked) {
      // Remove from list
      updatedList = playedElsewhereList.filter(id => id !== appId);
    } else {
      // Add to list
      updatedList = [...playedElsewhereList, appId];
    }
    
    setPlayedElsewhereList(updatedList);
    localStorage.setItem('playedElsewhere', JSON.stringify(updatedList));
    
    // If this is the current suggestion and we just marked it as played, show a new suggestion
    if (suggestion && suggestion.appid === appId && !isCurrentlyMarked) {
      handleNewSuggestion();
    }
  };
  
  // Handle resetting played elsewhere list
  const handleResetPlayedElsewhere = () => {
    setPlayedElsewhereList([]);
    localStorage.removeItem('playedElsewhere');
  };
  
  // Handle toggling "ignore playtime" status
  const handleToggleIgnorePlaytime = (appId: number) => {
    const isCurrentlyIgnored = ignoredPlaytimeList.includes(appId);
    
    let updatedList: number[];
    if (isCurrentlyIgnored) {
      // Remove from list (un-ignore)
      updatedList = ignoredPlaytimeList.filter(id => id !== appId);
    } else {
      // Add to list (ignore)
      updatedList = [...ignoredPlaytimeList, appId];
    }
    
    setIgnoredPlaytimeList(updatedList);
    localStorage.setItem('ignoredPlaytime', JSON.stringify(updatedList));
  };
  
  // Handle toggling "wanna play" status
  const handleToggleWannaPlay = (appId: number) => {
    const isCurrentlyWanted = wannaPlayList.includes(appId);
    
    let updatedList: number[];
    if (isCurrentlyWanted) {
      // Remove from list
      updatedList = wannaPlayList.filter(id => id !== appId);
    } else {
      // Add to list
      updatedList = [...wannaPlayList, appId];
    }
    
    setWannaPlayList(updatedList);
    localStorage.setItem('wannaPlay', JSON.stringify(updatedList));
  };
  
  // Export preferences to JSON file
  const handleExportPreferences = () => {
    const preferences = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      steamId: steamId || null,
      preferences: {
        wannaPlay: wannaPlayList,
        neverSuggest: neverSuggestList,
        playedElsewhere: playedElsewhereList,
        ignoredPlaytime: ignoredPlaytimeList
      }
    };
    
    const dataStr = JSON.stringify(preferences, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `steam-preferences-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowSettingsMenu(false);
  };
  
  // Import preferences from JSON file
  const handleImportPreferences = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Validate structure
        if (!data.preferences || !data.version) {
          alert('Invalid preferences file format.');
          return;
        }
        
        // Show confirmation with what will be imported
        const counts = {
          wannaPlay: data.preferences.wannaPlay?.length || 0,
          neverSuggest: data.preferences.neverSuggest?.length || 0,
          playedElsewhere: data.preferences.playedElsewhere?.length || 0,
          ignoredPlaytime: data.preferences.ignoredPlaytime?.length || 0
        };
        
        const confirmMsg = `Import preferences from ${data.exportDate ? new Date(data.exportDate).toLocaleDateString() : 'unknown date'}?\n\n` +
          `• Want To Play: ${counts.wannaPlay} games\n` +
          `• Never Suggest: ${counts.neverSuggest} games\n` +
          `• Played Elsewhere: ${counts.playedElsewhere} games\n` +
          `• Ignored Playtime: ${counts.ignoredPlaytime} games\n` +
          (data.steamId ? `• Steam ID: ${data.steamId}\n` : '') +
          `\nThis will replace your current preferences.`;
        
        if (!confirm(confirmMsg)) {
          return;
        }
        
        // Import the data
        if (Array.isArray(data.preferences.wannaPlay)) {
          setWannaPlayList(data.preferences.wannaPlay);
          localStorage.setItem('wannaPlay', JSON.stringify(data.preferences.wannaPlay));
        }
        
        if (Array.isArray(data.preferences.neverSuggest)) {
          setNeverSuggestList(data.preferences.neverSuggest);
          localStorage.setItem('neverSuggest', JSON.stringify(data.preferences.neverSuggest));
        }
        
        if (Array.isArray(data.preferences.playedElsewhere)) {
          setPlayedElsewhereList(data.preferences.playedElsewhere);
          localStorage.setItem('playedElsewhere', JSON.stringify(data.preferences.playedElsewhere));
        }
        
        if (Array.isArray(data.preferences.ignoredPlaytime)) {
          setIgnoredPlaytimeList(data.preferences.ignoredPlaytime);
          localStorage.setItem('ignoredPlaytime', JSON.stringify(data.preferences.ignoredPlaytime));
        }
        
        // Import Steam ID if it exists in the file
        if (data.steamId) {
          setSteamId(data.steamId);
          setRememberSteamId(true);
          localStorage.setItem('savedSteamId', data.steamId);
          localStorage.setItem('rememberSteamId', 'true');
        }
        
        alert('Preferences imported successfully!');
        setShowSettingsMenu(false);
      } catch (error) {
        alert('Failed to import preferences. Invalid file format.');
        console.error('Import error:', error);
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };
  
  // Fetch Steam Store genres for a game (NOT categories - genres are "Action", "RPG", etc.)
  const fetchStoreCategories = async (appId: number): Promise<string[]> => {
    // Check cache first
    const cacheKey = `steam_store_${appId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        const age = Date.now() - parsedCache.timestamp;
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        // Return cached GENRES (not categories!)
        if (age < thirtyDays) {
          return parsedCache.data?.genres || [];
        }
      } catch (e) {
        // Invalid cache
      }
    }
    
    // Fetch from API with LOW PRIORITY (background genre loading) + RETRY
    // Use minimal mode to reduce cache size (70-80% smaller)
    try {
      const response = await steamRequestQueue.enqueueWithRetry(
        () => fetch(`/api/steam-store?appid=${appId}&mode=minimal`),
        'low',
        2  // 2 retry attempts for genres too
      );
      const data = await response.json();
      
      if (response.ok && data.genres) {
        // Cache the full result
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        return data.genres || [];
      } else {
        // Cache the failure for only 1 hour so we can retry sooner
        const oneHour = 60 * 60 * 1000;
        localStorage.setItem(cacheKey, JSON.stringify({
          data: null,
          timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000) + oneHour // Will expire in 1 hour
        }));
      }
    } catch (error) {
      // Cache the failure for only 1 hour so we can retry sooner
      const oneHour = 60 * 60 * 1000;
      localStorage.setItem(cacheKey, JSON.stringify({
        data: null,
        timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000) + oneHour // Will expire in 1 hour
      }));
      console.warn('Failed to fetch genres for', appId);
    }
    
    return [];
  };
  
  // Fetch genres for a batch of games
  const fetchCategoriesBatch = async (games: SteamGame[]): Promise<Map<number, string[]>> => {
    const categoriesMap = new Map<number, string[]>();
    const batchFailures: FailedGameRequest[] = [];
    
    // Filter out games that have cached data (success OR failure)
    const gamesToFetch = games.filter(game => {
      const cacheKey = `steam_store_${game.appid}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          const age = Date.now() - parsedCache.timestamp;
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          
          if (age < thirtyDays) {
            // Add to map if it has GENRES (not categories!)
            if (parsedCache.data?.genres && parsedCache.data.genres.length > 0) {
              console.log(`[Batch Cache] Using cached genres for ${game.appid}:`, parsedCache.data.genres);
              categoriesMap.set(game.appid, parsedCache.data.genres);
            } else {
              console.log(`[Batch Cache] Cached data for ${game.appid} has no genres`);
            }
            return false; // Skip fetching
          }
        } catch (e) {
          // Invalid cache, fetch it
          console.warn(`[Batch Cache] Invalid cache for ${game.appid}`, e);
        }
      }
      return true; // Needs fetching
    });
    
    console.log(`[Genre Batch] Fetching genres for ${gamesToFetch.length} games, ${categoriesMap.size} already cached`);
    
    // Only fetch for games that need it
    const fetchPromises = gamesToFetch.map(async (game) => {
      try {
        const genres = await fetchStoreCategories(game.appid);
        if (genres.length > 0) {
          console.log(`[Batch Fetch] Fetched genres for ${game.appid}:`, genres);
          categoriesMap.set(game.appid, genres);
        } else {
          console.warn(`[Batch Fetch] No genres returned for ${game.appid}`);
          batchFailures.push({
            appId: game.appid,
            gameName: game.name,
            reason: 'not_found',
            attempts: 1,
            lastAttempt: new Date()
          });
        }
      } catch (error) {
        console.error(`[Batch Fetch] Error fetching ${game.appid}:`, error);
        batchFailures.push({
          appId: game.appid,
          gameName: game.name,
          reason: 'unknown',
          attempts: 1,
          lastAttempt: new Date()
        });
      }
    });
    
    await Promise.all(fetchPromises);
    
    // Update failed requests state
    if (batchFailures.length > 0) {
      setFailedRequests(prev => [...prev, ...batchFailures]);
    }
    
    console.log(`[Genre Batch] Complete! Total genres loaded: ${categoriesMap.size}, Failed: ${batchFailures.length}`);
    return categoriesMap;
  };
  
  // Silent background check for library updates (playtime changes)
  const silentLibraryCheck = async () => {
    if (!steamId.trim() || games.length === 0) return;
    
    try {
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      const data = await response.json();
      
      if (!response.ok) return; // Fail silently
      
      const freshGames = data.games || [];
      
      // Check if anything changed (compare playtimes)
      let hasChanges = false;
      if (freshGames.length !== games.length) {
        hasChanges = true;
      } else {
        for (const freshGame of freshGames) {
          const existingGame = games.find(g => g.appid === freshGame.appid);
          if (!existingGame || existingGame.playtime_forever !== freshGame.playtime_forever) {
            hasChanges = true;
            break;
          }
        }
      }
      
      // Only update if there are changes
      if (hasChanges) {
        // Merge fresh library data with existing enhanced data (ratings, tags, etc.)
        const updatedGames = freshGames.map((freshGame: SteamGame) => {
          const existingGame = games.find((g: SteamGame) => g.appid === freshGame.appid);
          if (existingGame) {
            // Keep enhanced data from existing game
            return {
              ...freshGame,
              rating: existingGame.rating,
              tags: existingGame.tags,
              releaseDate: existingGame.releaseDate,
              price: existingGame.price
            };
          }
          return freshGame;
        });
        
        setGames(updatedGames);
        setLastChecked(new Date());
        
        // Update suggestion if current one was just played
        if (suggestion && suggestion.playtime_forever === 0) {
          const updatedSuggestion = updatedGames.find((g: SteamGame) => g.appid === suggestion.appid);
          if (updatedSuggestion && updatedSuggestion.playtime_forever > 0) {
            // Current suggestion was just played! Get a new one
            handleNewSuggestion();
          }
        }
      } else {
        // No changes, just update last checked time
        setLastChecked(new Date());
      }
    } catch (error) {
      // Fail silently - don't disrupt user experience
      console.log('Background check failed (silent):', error);
    }
  };
  
  // Fetch enhanced data (ratings, tags, etc.) in background (non-blocking)
  const fetchRatingsInBackground = async (gamesToRate: SteamGame[]) => {
    if (gamesToRate.length === 0) return;
    
    // Prioritize PLAYED games first (for Top 5 Genres), then never-played
    const played = gamesToRate.filter(g => g.playtime_forever > 0);
    const neverPlayed = gamesToRate.filter(g => g.playtime_forever === 0);
    const prioritized = [...played, ...neverPlayed];
    
    setRatingsLoading(true);
    setRatingsLoaded(0);
    setRatingsTotal(prioritized.length);
    
    const BATCH_SIZE = 10;
    let loadedCount = 0;
    
    // Process in batches of 10
    for (let i = 0; i < prioritized.length; i += BATCH_SIZE) {
      const batch = prioritized.slice(i, i + BATCH_SIZE);
      
      // Fetch both SteamSpy data AND Steam Store categories in parallel
      const [batchData, batchCategories] = await Promise.all([
        fetchDataBatch(batch),
        fetchCategoriesBatch(batch)
      ]);
      
      // Update games with new data (ratings, tags, release dates, prices)
      setGames(prevGames => {
        return prevGames.map(game => {
          const data = batchData.get(game.appid);
          if (data) {
            return { ...game, ...data };
          }
          return game;
        });
      });
      
      // Update categories cache
      setSteamCategoriesCache(prev => {
        const newCache = new Map(prev);
        batchCategories.forEach((categories, appId) => {
          newCache.set(appId, categories);
        });
        return newCache;
      });
      
      loadedCount += batch.length;
      setRatingsLoaded(loadedCount);
    }
    
    // Update load stats
    setLoadStats({
      total: prioritized.length,
      successful: prioritized.length - failedRequests.length,
      failed: failedRequests.length
    });
    
    // Mark as complete and set null for any games that still have undefined rating
    setRatingsLoading(false);
    setGames(prevGames => {
      return prevGames.map(game => {
        if (game.rating === undefined) {
          return { ...game, rating: null };
        }
        return game;
      });
    });
    
    // Auto-hide success message after 3 seconds
    setTimeout(() => {
      setRatingsTotal(0);
      setRatingsLoaded(0);
    }, 3000);
  };
  
  return (
    <main 
      className="min-h-screen bg-gray-900 text-white p-8"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(66, 153, 225, 0.03) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(66, 153, 225, 0.03) 0%, transparent 50%),
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 35px,
            rgba(66, 153, 225, 0.02) 35px,
            rgba(66, 153, 225, 0.02) 36px
          ),
          repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 35px,
            rgba(66, 153, 225, 0.02) 35px,
            rgba(66, 153, 225, 0.02) 36px
          )
        `,
        backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%',
      }}
    >
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <CompassIcon className="w-10 h-10 text-blue-400" />
            <h1 className="text-4xl font-bold">Steam Scout</h1>
            <CompassIcon className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-gray-400">Discover the best games hiding in your library</p>
        </div>
        
        {/* Input Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
          {/* Collapsible Header */}
          <button
            onClick={toggleSteamIdCollapse}
            className="w-full px-6 py-4 sm:py-3 flex items-center justify-between hover:bg-gray-750 transition-colors active:bg-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">💨 Steam ID</span>
              {steamId && steamIdCollapsed && (
                <span className="text-sm text-gray-400">({steamId})</span>
              )}
            </div>
            <span className="text-gray-400 text-xl">
              {steamIdCollapsed ? '▶' : '▼'}
            </span>
          </button>
          
          {/* Collapsible Content */}
          {!steamIdCollapsed && (
            <div className="p-6 border-t border-gray-700">
              <label className="block mb-2 text-sm font-medium">
                Enter your Steam ID (Example: 76561197970579347):
              </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="76561198XXXXXXXX"
              className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={fetchGames}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium transition"
            >
              {loading ? 'Loading...' : 'Get Games'}
            </button>
          </div>
          
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberSteamId}
              onChange={(e) => handleRememberToggle(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-400">
              Remember my Steam ID for next time
            </span>
          </label>
          
              <div className="flex items-center justify-between mt-2">
                <details className="text-sm">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                Find your Steam ID
              </summary>
              <p className="text-xs text-gray-300 mt-2 mb-2">
                <span className="font-semibold">In Steam:</span> Click your profile name → View Account Details<br/>
                <span className="font-semibold">In Browser:</span> Visit store.steampowered.com → Login → Account Details
              </p>
              <a
                href="https://store.steampowered.com/account/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition mb-3"
              >
                🌐 Open Steam Account Page
              </a>
              <img
                src="/help/steam-id-finder.png" 
                alt="How to Find Your Steam ID"
                className="rounded border border-gray-600"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const msg = document.createElement('p');
                    msg.className = 'text-xs text-gray-400 mt-2';
                    msg.textContent = '(Screenshot will be available after you add it to the /public/help folder)';
                    parent.appendChild(msg);
                  }
                }}
              />
                </details>
                
                {/* Settings Menu with Gear Icon */}
                <div className="relative" ref={settingsMenuRef}>
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition text-gray-300 flex items-center gap-1"
                    title="Settings"
                  >
                    ⚙️ Settings
                  </button>
                  
                  {/* Dropdown Menu - Opens upward */}
                  {showSettingsMenu && (
                    <div className="absolute right-0 bottom-full mb-1 w-48 bg-gray-800 border border-gray-600 rounded shadow-lg z-50">
                      <input
                        type="file"
                        id="import-preferences-input"
                        accept=".json"
                        onChange={handleImportPreferences}
                        className="hidden"
                      />
                      <a
                        href="/debug/friends"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition text-gray-300"
                      >
                        🐛 Friends Debug
                      </a>
                      <button
                        onClick={() => {
                          document.getElementById('import-preferences-input')?.click();
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition text-gray-300 border-t border-gray-700"
                      >
                        📥 Import Preferences
                      </button>
                      <button
                        onClick={handleExportPreferences}
                        disabled={games.length === 0}
                        className={`w-full text-left px-4 py-2 text-sm transition ${
                          games.length === 0
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                        title={games.length === 0 ? 'Load your library first' : ''}
                      >
                        📤 Export Preferences
                      </button>
                      <button
                        onClick={() => {
                          if (games.length === 0) return;
                          if (confirm('Clear all cached data? This will reset your library, ratings, blacklist, and "Played Elsewhere" list.')) {
                            localStorage.clear();
                            window.location.reload();
                          }
                        }}
                        disabled={games.length === 0}
                        className={`w-full text-left px-4 py-2 text-sm transition border-t border-gray-700 ${
                          games.length === 0
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-red-400 hover:bg-gray-700'
                        }`}
                        title={games.length === 0 ? 'Load your library first' : ''}
                      >
                        🗑️ Clear Cache
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {error && (
                <div className="mt-4">
                  <p className="text-red-400 text-sm">{error}</p>
                  
                  {/* Show help section for privacy-related errors */}
                  {(error.toLowerCase().includes('private') || error.toLowerCase().includes('privacy')) && (
                    <div className="mt-4 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                      <h3 className="text-blue-300 font-semibold mb-2">📖 How to Fix This</h3>
                      <p className="text-sm text-gray-300 mb-3">
                        To use this app, your Steam profile needs to be set to public. Here's how to change it:
                      </p>
                      <ol className="text-sm text-gray-300 space-y-2 mb-3">
                        <li>1. Log into Steam and go to your Profile</li>
                        <li>2. Click "Edit Profile"</li>
                        <li>3. Go to "Privacy Settings"</li>
                        <li>4. Set "Game details" to "Public"</li>
                        <li>5. Click "Save" and try again!</li>
                      </ol>
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-400 hover:text-blue-300 mb-2">
                          📸 Show me a visual guide
                        </summary>
                        <img 
                          src="/help/steam-privacy-settings.png" 
                          alt="Steam Privacy Settings Guide"
                          className="rounded border border-gray-600 mt-2"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              const msg = document.createElement('p');
                              msg.className = 'text-xs text-gray-400 mt-2';
                              msg.textContent = '(Screenshot will be available after you add it to the /public/help folder)';
                              parent.appendChild(msg);
                            }
                          }}
                        />
                      </details>
                      <button
                        onClick={fetchGames}
                        className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition"
                      >
                        🔄 Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Library Stats */}
        {games.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
            {/* Collapsible Header */}
          <button
            onClick={toggleStatsCollapse}
            className="w-full px-6 py-5 sm:py-4 flex items-center justify-between hover:bg-gray-750 transition-colors active:bg-gray-700"
          >
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">📊 {playerName}'s Library Stats</h2>
                {friendsData && (
                  <span className="text-xs text-gray-400">
                    (Friends data: {timeAgo})
                  </span>
                )}
              </div>
              <span className="text-gray-400 text-xl">
                {statsCollapsed ? '▶' : '▼'}
              </span>
            </button>
            
            {/* Collapsible Content */}
            {!statsCollapsed && (
              <div className="p-6 border-t border-gray-700">
                <LibraryStats 
                  games={games} 
                  playedElsewhereList={playedElsewhereList} 
                  ignoredPlaytimeList={ignoredPlaytimeList} 
                  steamCategoriesCache={steamCategoriesCache}
                  friendsData={friendsData ? { ...friendsData, timeAgo, loading: friendsLoading } : null}
                  ratingsLoading={ratingsLoading}
                  ratingsLoaded={ratingsLoaded}
                  ratingsTotal={ratingsTotal}
                  playerName={playerName}
                />
                
                {/* Privacy Settings Helper */}
                <div className="mt-6">
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                      📖 Not seeing playtime or friends? Might be a privacy setting
                    </summary>
                    <div className="mt-3 text-gray-300 space-y-3">
                      <p className="text-sm">
                        To use this app, these Steam privacy settings must be public:
                      </p>
                      <p className="text-sm font-semibold">
                        My Profile → Edit Profile → Privacy Settings
                      </p>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Set "My profile" to PUBLIC</li>
                        <li>• Set "Game details" to PUBLIC</li>
                        <li>• Set "Friends list" to PUBLIC (for social features)</li>
                        <li>• UNCHECK "Always keep my total playtime private"</li>
                      </ul>
                      <a
                        href="https://steamcommunity.com/my/edit/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition"
                      >
                        🌐 Open Steam Privacy Settings
                      </a>
                      <img
                        src="/help/steam-privacy-settings.png" 
                        alt="Steam Privacy Settings Guide"
                        className="rounded border border-gray-600 mt-3"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Trending With Friends - DISABLED temporarily until recent play data is verified */}
        {/* {games.length > 0 && friendsData && friendsData.friends && friendsData.friends.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
            <button
              onClick={() => {
                const newState = !trendingCollapsed;
                setTrendingCollapsed(newState);
                localStorage.setItem('collapsed_trending', String(newState));
              }}
              className="w-full px-6 py-5 sm:py-4 flex items-center justify-between hover:bg-gray-750 transition-colors active:bg-gray-700"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-xl font-bold">🔥 Trending With Friends</span>
                <span className="text-xs text-gray-400">({timeAgo})</span>
              </div>
              <span className="text-gray-400 text-xl">
                {trendingCollapsed ? '▶' : '▼'}
              </span>
            </button>
            
            {!trendingCollapsed && (() => {
              const trendingGames = getTrendingWithFriends(friendsData.friends);
              
              if (trendingGames.length === 0) {
                return (
                  <div className="p-6 border-t border-gray-700 text-center text-gray-400">
                    No games played in the last 30 days
                  </div>
                );
              }
              
              return (
                <div className="p-6 border-t border-gray-700">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {trendingGames.map((game) => {
                      const friendNames = game.friends.slice(0, 5).map(f => f.name).join(', ');
                      const hasMore = game.friends.length > 5;
                      const moreCount = game.friends.length - 5;
                      
                      return (
                        <div key={game.appid} className="flex flex-col">
                          <button
                            onClick={(e) => handleSteamLink(game.appid, e)}
                            className="relative w-full aspect-[2/3] bg-gray-900 rounded overflow-hidden hover:scale-105 transition-transform shadow-lg hover:shadow-xl"
                          >
                            <img
                              src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`}
                              alt={game.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.src.includes('library_600x900')) {
                                  img.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
                                } else if (img.src.includes('header.jpg')) {
                                  const iconUrl = games.find(g => g.appid === game.appid)?.img_icon_url;
                                  if (iconUrl) {
                                    img.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${iconUrl}.jpg`;
                                  }
                                }
                              }}
                            />
                            <div className="absolute top-2 right-2 bg-blue-600/90 text-white text-xs px-2 py-1 rounded shadow-lg">
                              👥 {game.friendCount}
                            </div>
                          </button>
                          
                          <div className="mt-2 text-xs text-gray-400 line-clamp-2" title={game.friends.map(f => f.name).join(', ')}>
                            {friendNames}
                            {hasMore && ` +${moreCount} more`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )} */}
        
        {/* Game Suggestion */}
        {suggestion && (
          <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
            {/* Collapsible Header */}
            <button
              onClick={() => {
                const newState = !showcaseCollapsed;
                setShowcaseCollapsed(newState);
                localStorage.setItem('collapsed_showcase', String(newState));
              }}
              className="w-full px-6 py-5 sm:py-4 flex items-center justify-between hover:bg-gray-750 transition-colors active:bg-gray-700"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-xl font-bold">🎯 Scouted For You</span>
                {showcaseCollapsed && (
                  <span className="text-sm text-gray-400">({suggestion.name})</span>
                )}
              </div>
              <span className="text-gray-400 text-xl">
                {showcaseCollapsed ? '▶' : '▼'}
              </span>
            </button>
            
            {/* Collapsible Content */}
            {!showcaseCollapsed && (
              <div className="border-t border-gray-700">
                  <SuggestionCard 
                  game={suggestion} 
                  onNewSuggestion={handleNewSuggestion}
                  onNeverSuggest={handleNeverSuggest}
                  onTogglePlayedElsewhere={handleTogglePlayedElsewhere}
                  playedElsewhereList={playedElsewhereList}
                  hiddenCount={neverSuggestList.length}
                  onResetHidden={handleResetBlacklist}
                  storeData={storeData}
                  storeLoading={storeLoading}
                  games={games}
                  steamCategoriesCache={steamCategoriesCache}
                  friendsData={friendsData}
                  onToggleWannaPlay={handleToggleWannaPlay}
                  wannaPlayList={wannaPlayList}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Your Library - Collapsible */}
        {games.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Collapsible Header */}
            <button
              onClick={() => {
                const newState = !libraryCollapsed;
                setLibraryCollapsed(newState);
                localStorage.setItem('collapsed_library', String(newState));
              }}
              className="w-full px-6 py-5 sm:py-4 flex items-center justify-between hover:bg-gray-750 transition-colors active:bg-gray-700"
            >
              <h2 className="text-2xl sm:text-xl font-bold">
                🎮 Your Library ({filteredAndSortedGames.length} games)
              </h2>
              <span className="text-gray-400 text-xl">
                {libraryCollapsed ? '▶' : '▼'}
              </span>
            </button>
            
            {/* Collapsible Content */}
            {!libraryCollapsed && (
              <div className="border-t border-gray-700">
                {/* Filter and Sort Controls */}
                <div className="p-4 bg-gray-750">
                  
                  {/* Genre Loading Progress Bar (above checkboxes) */}
                  {ratingsLoading && (
                    <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">
                          ⏳ Loading genre data in background...
                        </span>
                        <span className="text-xs text-gray-400">
                          {ratingsLoaded}/{ratingsTotal} ({Math.round((ratingsLoaded/ratingsTotal)*100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300 bg-blue-500"
                          style={{ width: `${(ratingsLoaded/ratingsTotal)*100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        This improves recommendations and Top 5 Genres. You can browse while this loads!
                      </p>
                    </div>
                  )}
                  
                  {/* Success Banner - Shows after loading completes with no failures */}
                  {!ratingsLoading && loadStats.total > 0 && failedRequests.length === 0 && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-300 font-medium">
                          ✅ Library fully loaded! {loadStats.successful} out of {loadStats.total} games
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Load Stats Bar - Shows after loading completes if there are failures */}
                  {!ratingsLoading && failedRequests.length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <button 
                          onClick={() => {
                            const elem = document.getElementById('failed-games-list');
                            if (elem) elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
                          }}
                          className="text-sm text-yellow-300 hover:text-yellow-200 transition flex items-center gap-2"
                        >
                          ⚠️ Successfully loaded {loadStats.successful} out of {loadStats.total} games
                          <span className="text-xs">▼</span>
                        </button>
                        
                        <button
                          onClick={async () => {
                            console.log('🔄 Manual retry requested for', failedRequests.length, 'games');
                            const toRetry = [...failedRequests];
                            setFailedRequests([]);
                            setRatingsLoading(true);
                            
                            // Retry each failed game
                            for (const failed of toRetry) {
                              const game = games.find(g => g.appid === failed.appId);
                              if (game) {
                                await fetchCategoriesBatch([game]);
                              }
                            }
                            
                            setRatingsLoading(false);
                          }}
                          className="text-xs px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded transition"
                        >
                          🔄 Attempt Reload
                        </button>
                      </div>
                      
                      <div id="failed-games-list" style={{ display: 'none' }} className="mt-2 pt-2 border-t border-yellow-800/50">
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {failedRequests.map(failed => (
                            <div key={failed.appId} className="text-xs flex justify-between items-center">
                              <span className="text-gray-200">{failed.gameName}</span>
                              <span className="text-gray-400 text-xs">
                                {failed.reason === 'not_found' ? 'No data available' : 'Failed to load'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Top Row: Filter Checkboxes and Sort */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
                    
                    {/* Filter Checkboxes */}
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showOnlyNeverPlayed}
                          onChange={(e) => setShowOnlyNeverPlayed(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">
                          🚫 Show only Never Played games
                          <span className="text-gray-400 ml-1">
                            ({neverPlayedCount})
                          </span>
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showOnlyWannaPlay}
                          onChange={(e) => setShowOnlyWannaPlay(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">
                          ❤️ Show only Want To Play games
                          <span className="text-gray-400 ml-1">
                            ({wannaPlayList.length})
                          </span>
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeVR}
                          onChange={(e) => setExcludeVR(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">
                          🥽 Exclude VR games
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeMultiplayer}
                          onChange={(e) => setExcludeMultiplayer(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">
                          ⚔️ Exclude PvP Multiplayer games
                        </span>
                      </label>
                    </div>
                    
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium whitespace-nowrap">
                        Sort by:
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="px-3 py-1.5 bg-gray-700 rounded border border-gray-600 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="best-match">⭐ Best Match (Genre + Rating)</option>
                        <option value="rating-desc">Rating (High to Low){ratingsLoading ? ` (loading... ${ratingsLoaded}/${ratingsTotal})` : ''}</option>
                        <option value="rating-asc">Rating (Low to High){ratingsLoading ? ` (loading... ${ratingsLoaded}/${ratingsTotal})` : ''}</option>
                        <option value="friends-playtime-desc">🤝 Friends' Total Playtime (High to Low){!friendsData ? ' (loading...)' : ''}</option>
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        <option value="playtime-asc">Playtime (Low to High)</option>
                        <option value="playtime-desc">Playtime (High to Low)</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Tag Filters Section - Collapsible */}
                  <div className="border-t border-gray-700 pt-4">
                    <button
                      onClick={() => {
                        const newState = !tagsCollapsed;
                        setTagsCollapsed(newState);
                        localStorage.setItem('collapsed_tags', String(newState));
                      }}
                      className="w-full flex items-center justify-between mb-3 hover:bg-gray-700/30 p-2 rounded transition"
                    >
                      <h3 className="text-sm font-semibold">
                        🏷️ Filter by Tags
                        {selectedTags.length > 0 && (
                          <span className="text-xs text-blue-400 ml-2">({selectedTags.length} active)</span>
                        )}
                      </h3>
                      <span className="text-gray-400">
                        {tagsCollapsed ? '▶' : '▼'}
                      </span>
                    </button>
                    
                    {!tagsCollapsed && (
                      <>
                        {selectedTags.length > 0 && (
                          <button
                            onClick={() => setSelectedTags([])}
                            className="text-xs text-blue-400 hover:text-blue-300 transition mb-3"
                          >
                            Clear filters
                          </button>
                        )}
                        
                        {(() => {
                          // Get top 20 tags only (simplified - no expand button)
                          const topTags = getTopTags(games, steamCategoriesCache, 20);
                          
                          if (ratingsLoading || topTags.length === 0) {
                            return (
                              <p className="text-sm text-gray-400">
                                {ratingsLoading 
                                  ? `⏳ Loading tags... (${ratingsLoaded}/${ratingsTotal} games processed)` 
                                  : `No tags available yet (Loaded: ${games.filter(g => g.tags && g.tags.length > 0).length}/${games.length} games have tags)`}
                              </p>
                            );
                          }
                          
                          return (
                            <>
                              <div className="flex flex-wrap gap-2">
                                {topTags.map(({ tag, count }) => {
                                  const isSelected = selectedTags.includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedTags(selectedTags.filter(t => t !== tag));
                                        } else {
                                          setSelectedTags([...selectedTags, tag]);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                                        isSelected
                                          ? 'bg-blue-600 text-white border-2 border-blue-400'
                                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-transparent'
                                      }`}
                                    >
                                      {tag} ({count})
                                    </button>
                                  );
                                })}
                              </div>
                              
                              {selectedTags.length > 0 && (
                                <p className="text-xs text-gray-400 mt-3">
                                  Showing games with {selectedTags.length === 1 ? 'tag' : 'all tags'}: {selectedTags.join(', ')}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
                
                {/* Games List */}
                <div className="p-6">
                  <div className="space-y-4">
                    {filteredAndSortedGames.map((game) => {
                      const neverPlayed = game.playtime_forever === 0;
                      const isPlayedElsewhere = playedElsewhereList.includes(game.appid);
                      const isIgnored = ignoredPlaytimeList.includes(game.appid);
                      const isWanted = wannaPlayList.includes(game.appid);
                      
                      // Calculate total friend playtime for this game
                      let totalFriendPlaytime = 0;
                      const friendsWhoPlayed: Array<{name: string, playtime: number, profileurl: string}> = [];
                      
                      if (friendsData && friendsData.friends) {
                        friendsData.friends.forEach((friend: any) => {
                          const friendGame = friend.games?.find((g: any) => g.appid === game.appid);
                          if (friendGame && friendGame.playtime_forever > 0) {
                            totalFriendPlaytime += friendGame.playtime_forever;
                            friendsWhoPlayed.push({
                              name: friend.personaname,
                              playtime: friendGame.playtime_forever,
                              profileurl: friend.profileurl
                            });
                          }
                        });
                      }
                      
                      // Sort friends by playtime and take top 3
                      const topFriends = friendsWhoPlayed
                        .sort((a, b) => b.playtime - a.playtime)
                        .slice(0, 3);
                      const remainingFriends = friendsWhoPlayed.length - 3;
                      
                      // Get game genres for tag chips
                      const gameGenres = steamCategoriesCache.get(game.appid) || [];
                      
                      // Get rating (Metacritic or SteamSpy)
                      let rating: number | null = null;
                      const storeKey = `steam_store_${game.appid}`;
                      const cached = localStorage.getItem(storeKey);
                      if (cached) {
                        try {
                          const parsedCache = JSON.parse(cached);
                          rating = parsedCache.data?.metacritic || game.rating || null;
                        } catch (e) {
                          rating = game.rating || null;
                        }
                      } else {
                        rating = game.rating || null;
                      }
                      
                      return (
                        <div 
                          key={game.appid}
                          id={`game-${game.appid}`}
                          className="bg-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all"
                        >
                          {/* Mobile: Stack Vertically, Desktop: Side by Side */}
                          <div className="flex flex-col md:flex-row">
                            {/* Box Art with Badges */}
                            <div className="relative md:flex-shrink-0 md:w-56 md:h-80 bg-gray-800 overflow-hidden">
                              <button
                                onClick={(e) => handleSteamLink(game.appid, e)}
                                className="w-full h-full hover:opacity-90 transition-opacity block"
                              >
                                <img
                                  src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`}
                                  alt={game.name}
                                  className="w-full h-full object-cover object-center"
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    if (img.src.includes('library_600x900')) {
                                      img.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
                                    } else if (img.src.includes('header.jpg')) {
                                      img.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`;
                                    }
                                  }}
                                />
                              </button>
                              
                              {/* Never Played Badge - Top Left */}
                              {neverPlayed && !isPlayedElsewhere && (
                                <div className="absolute top-2 left-2 bg-red-600/90 text-white text-xs px-2 py-1 rounded shadow-lg">
                                  ❌ Never Played
                                </div>
                              )}
                              
                              {/* Played Elsewhere Badge - Top Left */}
                              {isPlayedElsewhere && (
                                <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-xs px-2 py-1 rounded shadow-lg">
                                  ✅ Played Elsewhere
                                </div>
                              )}
                              
                              {/* Rating Badge - Top Right */}
                              {rating !== null && (
                                <div className="absolute top-2 right-2 bg-green-600/90 text-white text-xs px-2 py-1 rounded shadow-lg">
                                  ⭐ {rating}%
                                </div>
                              )}
                            </div>
                            
                            {/* Game Info - Right Side on Desktop */}
                            <div className="p-4 flex-1 flex flex-col">
                              {/* Top: Title and Scroll Button */}
                              <div className="flex items-start justify-between mb-2">
                                <button
                                  onClick={(e) => handleSteamLink(game.appid, e)}
                                  className="flex-1"
                                >
                                  <h3 className="font-bold text-lg hover:text-blue-400 transition text-left">
                                    {game.name}
                                  </h3>
                                </button>
                                <button
                                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                  className="ml-2 text-xs text-gray-400 hover:text-blue-400 transition whitespace-nowrap"
                                  title="Scroll to top"
                                >
                                  ↑ Top
                                </button>
                              </div>
                              
                              {/* Info List */}
                              <ul className="text-sm text-gray-300 space-y-1 mb-3 flex-1">
                                <li>
                                  • <span className="text-white font-medium">Your Playtime:</span> {neverPlayed ? '0 hours' : formatPlaytimeDetailed(game.playtime_forever)}
                                  {isIgnored && !neverPlayed && ' 🚫'}
                                </li>
                                
                                {game.medianMinutes !== undefined && game.medianMinutes !== null && game.medianMinutes > 0 && (
                                  <li>
                                    • <span className="text-white font-medium">Median Playtime:</span> {Math.round(game.medianMinutes / 60)} {Math.round(game.medianMinutes / 60) === 1 ? 'hour' : 'hours'}
                                  </li>
                                )}
                                
                                {/* Tag Chips */}
                                {gameGenres.length > 0 && (
                                  <li className="flex flex-wrap gap-1 items-center">
                                    • <span className="text-white font-medium">Tags:</span>
                                    {gameGenres.slice(0, 3).map((genre) => (
                                      <span
                                        key={genre}
                                        className="px-2 py-0.5 bg-gray-600 text-gray-200 rounded text-xs"
                                      >
                                        {genre}
                                      </span>
                                    ))}
                                  </li>
                                )}
                                
                                {/* Friends - Condensed */}
                                {topFriends.length > 0 && (
                                  <li>
                                    • <span className="text-white font-medium">Friends:</span>{' '}
                                    {topFriends.map((friend, idx) => (
                                      <span key={idx}>
                                        <a
                                          href={friend.profileurl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-400 hover:text-blue-300"
                                        >
                                          {friend.name}
                                        </a>
                                        {idx < topFriends.length - 1 && ', '}
                                      </span>
                                    ))}
                                    {remainingFriends > 0 && `, and ${remainingFriends} ${remainingFriends === 1 ? 'other' : 'others'}`}
                                  </li>
                                )}
                              </ul>
                              
                              {/* Action Buttons - Bottom */}
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <button
                                    onClick={() => handleToggleWannaPlay(game.appid)}
                                    className={`text-xs px-3 py-2 rounded transition ${
                                      isWanted
                                        ? 'bg-red-700 hover:bg-red-600 text-white'
                                        : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                    }`}
                                    title={isWanted ? "Remove from Want To Play" : "Add to Want To Play"}
                                  >
                                    ❤️ Want To Play
                                  </button>
                                  
                                  {neverPlayed && (
                                    <>
                                      <button
                                        onClick={() => handleTogglePlayedElsewhere(game.appid)}
                                        className={`text-xs px-3 py-2 rounded transition ${
                                          isPlayedElsewhere
                                            ? 'bg-blue-700 hover:bg-blue-600 text-white'
                                            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                        }`}
                                        title={isPlayedElsewhere ? "Unmark as played elsewhere" : "Mark as played elsewhere"}
                                      >
                                        🎮 Played Elsewhere
                                      </button>
                                      <button
                                        onClick={() => handleNeverSuggest(game.appid)}
                                        className="text-xs px-3 py-2 bg-red-900/70 hover:bg-red-900 text-gray-200 rounded transition"
                                        title="Never suggest this game"
                                      >
                                        🚫 Never Suggest
                                      </button>
                                    </>
                                  )}
                                  
                                  {!neverPlayed && (
                                    <button
                                      onClick={() => handleToggleIgnorePlaytime(game.appid)}
                                      className={`text-xs px-3 py-2 rounded transition ${
                                        isIgnored
                                          ? 'bg-orange-700 hover:bg-orange-600 text-white'
                                          : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                      }`}
                                      title={isIgnored ? "Include playtime in stats" : "Ignore playtime in stats"}
                                    >
                                      ⛔ Ignore Playtime
                                    </button>
                                  )}
                                </div>
                                
                                {/* Play Now Button - Full Width */}
                                <button
                                  onClick={(e) => handleSteamLink(game.appid, e)}
                                  className="text-xs px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition font-medium"
                                >
                                  ▶ Play Now
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Empty State */}
        {!loading && games.length === 0 && !error && (
          <div className="text-center text-gray-400 py-12">
            <p>Enter a Steam ID above to view a game library</p>
          </div>
        )}
        
        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-700 text-center text-sm text-gray-500">
          <p>Steam Scout is not affiliated with Valve Corporation</p>
          <p className="mt-2">
            Support: <span className="text-gray-400">gamedesignerjoe</span> on Discord
          </p>
        </footer>
        
      </div>
      
      {/* Rating Progress Banner */}
      <RatingProgressBanner 
        loading={ratingsLoading}
        loaded={ratingsLoaded}
        total={ratingsTotal}
        stage={loadingStage}
      />
    </main>
  );
}
