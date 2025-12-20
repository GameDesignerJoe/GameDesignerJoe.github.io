'use client';

import { useState, useEffect } from 'react';

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

type SortOption = 'name-asc' | 'name-desc' | 'playtime-asc' | 'playtime-desc' | 'appid-asc' | 'appid-desc' | 'rating-desc' | 'rating-asc' | 'release-desc' | 'release-asc';

function sortGames(games: SteamGame[], sortBy: SortOption): SteamGame[] {
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
    default:
      return sorted;
  }
}

function calculateStats(games: SteamGame[], playedElsewhereList: number[] = []): LibraryStats {
  const totalGames = games.length;
  // Exclude playedElsewhere games from never played count
  const neverPlayed = games.filter(g => 
    g.playtime_forever === 0 && !playedElsewhereList.includes(g.appid)
  ).length;
  const totalMinutes = games.reduce((sum, g) => sum + g.playtime_forever, 0);
  // Count playedElsewhere as "tried" for completion rate
  const playedElsewhereCount = games.filter(g => playedElsewhereList.includes(g.appid)).length;
  const actuallyPlayed = games.filter(g => g.playtime_forever > 0).length;
  const tried = actuallyPlayed + playedElsewhereCount;
  const completionRate = totalGames > 0 ? Math.round((tried / totalGames) * 100) : 0;
  
  // Calculate cost per hour (only for played games)
  const playedGames = games.filter(g => g.playtime_forever > 0);
  const gamesWithPrice = playedGames.filter(g => g.price !== undefined && g.price !== null && g.price > 0);
  const totalSpent = gamesWithPrice.reduce((sum, g) => sum + (g.price || 0), 0);
  const totalHoursPlayed = playedGames.reduce((sum, g) => sum + g.playtime_forever, 0) / 60;
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
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}m`;
  }
}

function getSuggestion(games: SteamGame[], blacklist: number[] = []): SteamGame | null {
  const neverPlayed = games
    .filter(g => g.playtime_forever === 0)
    .filter(g => !blacklist.includes(g.appid));
  
  if (neverPlayed.length === 0) {
    return null;
  }
  
  // Pick a random never-played game (excluding blacklist)
  const randomIndex = Math.floor(Math.random() * neverPlayed.length);
  return neverPlayed[randomIndex];
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

// Enhanced data cache interface
interface GameData {
  score: number | null;
  tags?: string[];
  releaseDate?: string;
  price?: number;
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
    const response = await fetch(`/api/steamspy-rating?appid=${appId}`);
    const data = await response.json();
    
    if (!response.ok || data.error) {
      return null;
    }
    
    return {
      score: data.rating,
      tags: data.tags || [],
      releaseDate: data.releaseDate,
      price: data.price,
      timestamp: Date.now()
    };
  } catch (e) {
    // Fetch failed, skip this game
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
        price: cached.price
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
        price: data.price
      });
      setCachedData(game.appid, {
        score: data.score,
        tags: data.tags,
        releaseDate: data.releaseDate,
        price: data.price
      });
    }
  });
  
  await Promise.all(fetchPromises);
  return gameDataMap;
}

function LibraryStats({ games, playedElsewhereList }: { games: SteamGame[], playedElsewhereList: number[] }) {
  const stats = calculateStats(games, playedElsewhereList);
  const lastNewGame = getLastNewGame(games);
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Total Games</div>
          <div className="text-2xl font-bold">{stats.totalGames}</div>
        </div>
        
        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Never Played</div>
          <div className="text-2xl font-bold text-red-400">{stats.neverPlayed}</div>
        </div>
        
        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Total Playtime</div>
          <div className="text-2xl font-bold">{formatPlaytime(stats.totalMinutes)}</div>
        </div>
        
        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Tried</div>
          <div className="text-2xl font-bold text-green-400">{stats.completionRate}%</div>
        </div>
        
        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Cost Per Hour</div>
          {stats.costPerHour !== null ? (
            <>
              <div className="text-2xl font-bold text-yellow-400">${stats.costPerHour.toFixed(2)}</div>
              <div className="text-xs text-gray-400 mt-1">{stats.gamesWithPrice} games</div>
            </>
          ) : (
            <div className="text-sm text-gray-400">No data</div>
          )}
        </div>
        
        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Last New Game</div>
          {lastNewGame ? (
            <>
              <div className="text-2xl font-bold text-blue-400">{lastNewGame.daysAgo}d ago</div>
              <div className="text-xs text-gray-400 mt-1 truncate">{lastNewGame.game.name}</div>
            </>
          ) : (
            <div className="text-sm text-gray-400">No recent tries</div>
          )}
      </div>
    </div>
  );
}

function RatingProgressBanner({ 
  loading, 
  loaded, 
  total 
}: { 
  loading: boolean;
  loaded: number;
  total: number;
}) {
  if (total === 0) return null;
  
  const percentage = total > 0 ? (loaded / total) * 100 : 0;
  const isComplete = !loading && loaded === total;
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className={`rounded-lg p-4 shadow-lg border-2 ${
        isComplete 
          ? 'bg-green-900 border-green-500' 
          : 'bg-gray-800 border-blue-500'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {isComplete ? '✅ Ratings loaded!' : '⏳ Loading ratings from SteamSpy...'}
          </span>
          <span className="text-xs text-gray-400">{loaded}/{total}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              isComplete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
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
  storeLoading
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
}) {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  
  // Reset videoFailed when game changes
  useEffect(() => {
    setVideoFailed(false);
  }, [game?.appid]);
  
  // Debug video data - MUST be at top before any conditional logic
  useEffect(() => {
    if (storeData && game) {
      const hasMovies = storeData.movies && storeData.movies.length > 0;
      console.log('📹 Video Debug for', game.name);
      console.log('  - Has movies array:', !!storeData.movies);
      console.log('  - Movies count:', storeData.movies?.length || 0);
      if (hasMovies) {
        const video = storeData.movies[0];
        console.log('  - First video:', video.name);
        console.log('  - MP4 URL:', video.mp4_480);
        console.log('  - WebM URL:', video.webm_480);
      } else {
        console.log('  - No video available, showing image');
      }
    }
  }, [storeData, game]);
  
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
  
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden mb-6 border border-gray-700 shadow-xl">
      {/* Header Video/Image Banner */}
      {firstVideo && !videoFailed ? (
        <div className="w-full aspect-video md:aspect-auto md:h-64 bg-black flex items-center justify-center relative">
          <video
            key={firstVideo.id}
            className="w-full h-full object-contain"
            autoPlay
            loop
            muted
            playsInline
            poster={firstVideo.thumbnail}
            onError={() => {
              console.log('Video failed to load, falling back to image');
              setVideoFailed(true);
            }}
          >
            <source src={firstVideo.mp4_480} type="video/mp4" />
            <source src={firstVideo.webm_480} type="video/webm" />
            Your browser does not support the video tag.
          </video>
          
          {/* Video name overlay */}
          {firstVideo.name && (
            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded text-xs text-gray-300">
              🎬 {firstVideo.name}
            </div>
          )}
        </div>
      ) : storeData?.header_image && (
        <div className="w-full aspect-video md:aspect-auto md:h-64 bg-black flex items-center justify-center">
          <img
            src={storeData.header_image}
            alt={game.name}
            className="w-full h-full object-contain opacity-0 transition-opacity duration-500"
            onLoad={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-300">
          🎯 TRY THIS NEXT
        </h2>
        
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
          
          {/* 2. Recommendations (Steam "thumbs up" count) */}
          {storeData?.recommendations && (
            <div className="text-sm">
              👥 <span className="font-semibold">{storeData.recommendations.toLocaleString()} players</span>
              <span className="text-gray-400 ml-1">recommend this</span>
            </div>
          )}
          
          {/* 3. Metacritic */}
          {storeData?.metacritic && (
            <div className="text-sm">
              🎯 <span className="font-semibold">Metacritic: {storeData.metacritic}</span>
            </div>
          )}
          
          {/* 4. SteamSpy Rating (fallback if available) */}
          {game.rating !== undefined && game.rating !== null && (
            <div className="text-sm">
              ⭐ <span className="font-semibold">{game.rating}% positive</span>
              <span className="text-gray-400 ml-1">(SteamSpy)</span>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={onNewSuggestion}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition"
          >
            🎲 Suggest Another
          </button>
          <button
            onClick={() => onNeverSuggest(game.appid)}
            className="px-4 py-2 bg-red-900/70 hover:bg-red-900 rounded font-medium transition"
          >
            🚫 Never Suggest
          </button>
          <button
            onClick={() => onTogglePlayedElsewhere(game.appid)}
            className={`px-4 py-2 rounded font-medium transition ${
              playedElsewhereList.includes(game.appid)
                ? 'bg-blue-700 hover:bg-blue-600'
                : 'bg-blue-900/70 hover:bg-blue-900'
            }`}
          >
            {playedElsewhereList.includes(game.appid) ? '✅ Played Elsewhere' : '🎮 Played Elsewhere'}
          </button>
          <a
            href={`steam://store/${game.appid}`}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition"
          >
            ▶ Play Now
          </a>
        </div>
        
        {hiddenCount > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-700 pt-3">
            <span>{hiddenCount} game{hiddenCount !== 1 ? 's' : ''} hidden from suggestions</span>
            <button
              onClick={onResetHidden}
              className="hover:text-white transition"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [steamId, setSteamId] = useState('');
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOnlyNeverPlayed, setShowOnlyNeverPlayed] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('rating-desc');
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
  const [steamCategoriesCache, setSteamCategoriesCache] = useState<Map<number, string[]>>(new Map());
  const [excludeVR, setExcludeVR] = useState(false);
  const [excludeMultiplayer, setExcludeMultiplayer] = useState(false);
  
  // Fetch Steam Store data with caching
  const fetchStoreData = async (appId: number) => {
    // Check cache first (30-day TTL)
    const cacheKey = `steam_store_${appId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        const age = Date.now() - parsedCache.timestamp;
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        if (age < thirtyDays) {
          setStoreData(parsedCache.data);
          return;
        }
      } catch (e) {
        // Invalid cache, fetch fresh
      }
    }
    
    // Fetch from API
    setStoreLoading(true);
    try {
      const response = await fetch(`/api/steam-store?appid=${appId}`);
      const data = await response.json();
      
      if (response.ok) {
        setStoreData(data);
        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        // Update categories cache
        if (data.categories && data.categories.length > 0) {
          setSteamCategoriesCache(prev => {
            const newCache = new Map(prev);
            newCache.set(appId, data.categories);
            return newCache;
          });
        }
      } else {
        // Handle error gracefully - just don't show store data
        console.warn('Steam Store API error for', appId, data.message);
        setStoreData(null);
      }
    } catch (error) {
      console.error('Failed to fetch Steam Store data:', error);
      setStoreData(null);
    } finally {
      setStoreLoading(false);
    }
  };
  
  // Fetch store data when suggestion changes (pre-fetch for immediate display)
  useEffect(() => {
    if (suggestion) {
      fetchStoreData(suggestion.appid);
    } else {
      setStoreData(null);
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
    setSteamIdCollapsed(savedSteamIdCollapsed);
    setStatsCollapsed(savedStatsCollapsed);
  }, []);
  
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
  }, []);
  
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
    setError('');
    setGames([]);
    
    try {
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      const data = await response.json();
      
      if (!response.ok) {
        // Use detailed error message from API if available
        const errorMessage = data.message || data.error || 'Failed to fetch games';
        throw new Error(errorMessage);
      }
      
      const loadedGames = data.games || [];
      setGames(loadedGames);
      
      // Set initial suggestion (with blacklist)
      setSuggestion(getSuggestion(loadedGames, neverSuggestList));
      
      // Start fetching ratings in background (non-blocking)
      fetchRatingsInBackground(loadedGames);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
  
  const filteredAndSortedGames = sortGames(filtered, sortBy);
  
  const neverPlayedCount = games.filter(g => g.playtime_forever === 0).length;
  
  // Handle suggesting another game (random, filtered by blacklist)
  const handleNewSuggestion = () => {
    const neverPlayed = games
      .filter(g => g.playtime_forever === 0)
      .filter(g => !neverSuggestList.includes(g.appid));
    
    if (neverPlayed.length === 0) {
      setSuggestion(null);
      return;
    }
    
    // Pick a random never-played game
    const randomIndex = Math.floor(Math.random() * neverPlayed.length);
    setSuggestion(neverPlayed[randomIndex]);
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
    // Get a fresh suggestion
    if (games.length > 0) {
      const neverPlayed = games.filter(g => g.playtime_forever === 0);
      if (neverPlayed.length > 0) {
        const randomIndex = Math.floor(Math.random() * neverPlayed.length);
        setSuggestion(neverPlayed[randomIndex]);
      }
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
  
  // Fetch Steam Store categories for a game
  const fetchStoreCategories = async (appId: number): Promise<string[]> => {
    // Check cache first
    const cacheKey = `steam_store_${appId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        const age = Date.now() - parsedCache.timestamp;
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        if (age < thirtyDays && parsedCache.data?.categories) {
          return parsedCache.data.categories;
        }
      } catch (e) {
        // Invalid cache
      }
    }
    
    // Fetch from API
    try {
      const response = await fetch(`/api/steam-store?appid=${appId}`);
      const data = await response.json();
      
      if (response.ok && data.categories) {
        // Cache the full result
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        return data.categories || [];
      }
    } catch (error) {
      console.warn('Failed to fetch categories for', appId);
    }
    
    return [];
  };
  
  // Fetch categories for a batch of games
  const fetchCategoriesBatch = async (games: SteamGame[]): Promise<Map<number, string[]>> => {
    const categoriesMap = new Map<number, string[]>();
    
    const fetchPromises = games.map(async (game) => {
      const categories = await fetchStoreCategories(game.appid);
      if (categories.length > 0) {
        categoriesMap.set(game.appid, categories);
      }
    });
    
    await Promise.all(fetchPromises);
    return categoriesMap;
  };
  
  // Fetch enhanced data (ratings, tags, etc.) in background (non-blocking)
  const fetchRatingsInBackground = async (gamesToRate: SteamGame[]) => {
    if (gamesToRate.length === 0) return;
    
    // Prioritize never-played games
    const neverPlayed = gamesToRate.filter(g => g.playtime_forever === 0);
    const played = gamesToRate.filter(g => g.playtime_forever > 0);
    const prioritized = [...neverPlayed, ...played];
    
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
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Play Today</h1>
          <p className="text-gray-400">Find what to play today from your Steam library.</p>
        </div>
        
        {/* Input Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
          {/* Collapsible Header */}
          <button
            onClick={toggleSteamIdCollapse}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">🎮 Steam ID</span>
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
                Don't know your Steam ID? 📖 Click here to see how to find it
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
                
                <button
                  onClick={() => {
                    if (confirm('Clear all cached data? This will reset your library, ratings, blacklist, and "Played Elsewhere" list.')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition text-gray-300"
                  title="Clear all cached data and reset the app"
                >
                  🗑️ Clear Cache
                </button>
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
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
            >
              <h2 className="text-2xl font-bold">📊 Your Library Stats</h2>
              <span className="text-gray-400 text-xl">
                {statsCollapsed ? '▶' : '▼'}
              </span>
            </button>
            
            {/* Collapsible Content */}
            {!statsCollapsed && (
              <div className="p-6 border-t border-gray-700">
                <LibraryStats games={games} playedElsewhereList={playedElsewhereList} />
              </div>
            )}
          </div>
        )}
        
        {/* Game Suggestion */}
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
        />
        
        {/* Filter and Sort Controls */}
        {games.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
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
                    Show only never played 
                    <span className="text-gray-400 ml-1">
                      ({neverPlayedCount} games)
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
                    Exclude VR games
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
                    Exclude PvP Multiplayer games
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
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="playtime-asc">Playtime (Low to High)</option>
                  <option value="playtime-desc">Playtime (High to Low)</option>
                  <option value="rating-desc">Rating (High to Low){ratingsLoading ? ` (loading... ${ratingsLoaded}/${ratingsTotal})` : ''}</option>
                  <option value="rating-asc">Rating (Low to High){ratingsLoading ? ` (loading... ${ratingsLoaded}/${ratingsTotal})` : ''}</option>
                </select>
              </div>
            </div>
            
            {/* Tag Filters Section */}
            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">🏷️ Filter by Tags</h3>
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              
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
            </div>
          </div>
        )}
        
        {/* Games List */}
        {games.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">
              Your Library ({filteredAndSortedGames.length} games)
            </h2>
            
            <div className="space-y-3">
              {filteredAndSortedGames.map((game) => {
                const hours = Math.floor(game.playtime_forever / 60);
                const minutes = game.playtime_forever % 60;
                const neverPlayed = game.playtime_forever === 0;
                const isPlayedElsewhere = playedElsewhereList.includes(game.appid);
                
                return (
                  <div 
                    key={game.appid}
                    className="bg-gray-700 rounded p-4 flex items-center justify-between gap-3"
                  >
                    <a 
                      href={`steam://store/${game.appid}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1"
                    >
                      {game.img_icon_url && (
                        <img
                          src={`https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`}
                          alt={game.name}
                          className="w-8 h-8 rounded"
                        />
                      )}
                      <div>
                        <h3 className="font-medium hover:underline">{game.name}</h3>
                        <p className="text-sm text-gray-400">
                          {hours > 0 && `${hours}h `}
                          {minutes > 0 && `${minutes}m`}
                          {neverPlayed && '0 hours'}
                          {game.rating !== undefined && ` • ${game.rating}% 👍`}
                          {game.releaseDate && ` • Released: ${game.releaseDate}`}
                        </p>
                      </div>
                    </a>
                    
                    <div className="flex items-center gap-2">
                      {neverPlayed && (
                        <button
                          onClick={() => handleTogglePlayedElsewhere(game.appid)}
                          className={`text-xs px-3 py-1.5 rounded transition whitespace-nowrap ${
                            isPlayedElsewhere
                              ? 'bg-blue-700 hover:bg-blue-600 text-blue-100'
                              : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                          }`}
                          title={isPlayedElsewhere ? "Mark as not played elsewhere" : "Mark as played elsewhere"}
                        >
                          🎮 {isPlayedElsewhere ? 'Played Elsewhere' : 'Mark Played'}
                        </button>
                      )}
                      
                      <span className={`text-sm px-3 py-1 rounded whitespace-nowrap ${
                        isPlayedElsewhere
                          ? 'bg-blue-900 text-blue-200'
                          : neverPlayed 
                            ? 'bg-red-900 text-red-200' 
                            : 'bg-green-900 text-green-200'
                      }`}>
                        {isPlayedElsewhere ? '✅ Played Elsewhere' : neverPlayed ? '❌ Never Played' : '✅ Played'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {!loading && games.length === 0 && !error && (
          <div className="text-center text-gray-400 py-12">
            <p>Enter a Steam ID above to view a game library</p>
          </div>
        )}
        
      </div>
      
      {/* Rating Progress Banner */}
      <RatingProgressBanner 
        loading={ratingsLoading}
        loaded={ratingsLoaded}
        total={ratingsTotal}
      />
    </main>
  );
}
