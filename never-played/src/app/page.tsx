'use client';

import { useState, useEffect } from 'react';

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  rating?: number | null; // Steam review score (0-100), null if no data available
}

interface LibraryStats {
  totalGames: number;
  neverPlayed: number;
  totalMinutes: number;
  completionRate: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'playtime-asc' | 'playtime-desc' | 'appid-asc' | 'appid-desc' | 'rating-desc' | 'rating-asc';

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
    default:
      return sorted;
  }
}

function calculateStats(games: SteamGame[]): LibraryStats {
  const totalGames = games.length;
  const neverPlayed = games.filter(g => g.playtime_forever === 0).length;
  const totalMinutes = games.reduce((sum, g) => sum + g.playtime_forever, 0);
  const completionRate = totalGames > 0 ? Math.round(((totalGames - neverPlayed) / totalGames) * 100) : 0;
  
  return {
    totalGames,
    neverPlayed,
    totalMinutes,
    completionRate
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

// Rating cache helpers
function getCachedRating(appId: number): number | null {
  const cached = localStorage.getItem(`rating_${appId}`);
  if (!cached) return null;
  
  try {
    const { score, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    if (age < sevenDays) {
      return score;
    }
  } catch (e) {
    // Invalid cache entry
  }
  
  return null;
}

function setCachedRating(appId: number, score: number) {
  localStorage.setItem(`rating_${appId}`, JSON.stringify({
    score,
    timestamp: Date.now()
  }));
}

// Fetch rating from SteamSpy (via our API to avoid CORS)
async function fetchSteamSpyRating(appId: number): Promise<number | null> {
  try {
    const response = await fetch(`/api/steamspy-rating?appid=${appId}`);
    const data = await response.json();
    
    if (!response.ok || data.error) {
      return null;
    }
    
    return data.rating;
  } catch (e) {
    // Fetch failed, skip this game
    return null;
  }
}

// Fetch ratings for a batch of games (10 parallel)
async function fetchRatingBatch(games: SteamGame[]): Promise<Map<number, number>> {
  const ratings = new Map<number, number>();
  
  const fetchPromises = games.map(async (game) => {
    // Check cache first
    const cached = getCachedRating(game.appid);
    if (cached !== null) {
      ratings.set(game.appid, cached);
      return;
    }
    
    // Fetch from SteamSpy
    const rating = await fetchSteamSpyRating(game.appid);
    if (rating !== null) {
      ratings.set(game.appid, rating);
      setCachedRating(game.appid, rating);
    }
  });
  
  await Promise.all(fetchPromises);
  return ratings;
}

function LibraryStats({ games }: { games: SteamGame[] }) {
  const stats = calculateStats(games);
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">📊 Your Library Stats</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
  hiddenCount,
  onResetHidden
}: { 
  game: SteamGame | null;
  onNewSuggestion: () => void;
  onNeverSuggest: (appId: number) => void;
  hiddenCount: number;
  onResetHidden: () => void;
}) {
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
  
  return (
    <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-6 mb-6 border-2 border-blue-500">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        🎯 TRY THIS NEXT
      </h2>
      
      <div className="flex items-center gap-4 mb-4">
        {game.img_icon_url && (
          <img
            src={`https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`}
            alt={game.name}
            className="w-16 h-16 rounded"
          />
        )}
        <div>
          <h3 className="text-xl font-bold">{game.name}</h3>
          <p className="text-gray-300 text-sm">App ID: {game.appid}</p>
        </div>
      </div>
      
      <div className="bg-gray-900/50 rounded p-3 mb-4">
        <p className="text-sm font-semibold mb-2">Why this game?</p>
        <ul className="text-sm space-y-1">
          <li>• One of your oldest games (Low App ID)</li>
          <li>
            • Rating: {
              game.rating === undefined 
                ? 'Loading...' 
                : game.rating === null 
                  ? 'No data available' 
                  : `${game.rating}% 👍`
            }
          </li>
        </ul>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={onNewSuggestion}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition"
        >
          🎲 Suggest Another
        </button>
        <button
          onClick={() => onNeverSuggest(game.appid)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium transition"
        >
          🚫 Never Suggest
        </button>
        <a
          href={`steam://store/${game.appid}`}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition"
        >
          🎮 View in Steam
        </a>
      </div>
      
      {hiddenCount > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-400">
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
  );
}

export default function Home() {
  const [steamId, setSteamId] = useState('');
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOnlyNeverPlayed, setShowOnlyNeverPlayed] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [suggestion, setSuggestion] = useState<SteamGame | null>(null);
  const [neverSuggestList, setNeverSuggestList] = useState<number[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsLoaded, setRatingsLoaded] = useState(0);
  const [ratingsTotal, setRatingsTotal] = useState(0);
  
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
    
    setLoading(true);
    setError('');
    setGames([]);
    
    try {
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch games');
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
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchGames();
    }
  };
  
  // Filter and sort games
  const filteredAndSortedGames = sortGames(
    showOnlyNeverPlayed
      ? games.filter(g => g.playtime_forever === 0)
      : games,
    sortBy
  );
  
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
  
  // Fetch ratings in background (non-blocking)
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
      const batchRatings = await fetchRatingBatch(batch);
      
      // Update games with new ratings
      setGames(prevGames => {
        return prevGames.map(game => {
          const rating = batchRatings.get(game.appid);
          if (rating !== undefined) {
            return { ...game, rating };
          }
          return game;
        });
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
          <p className="text-gray-400">Display Your Steam Library (76561197970579347)</p>
        </div>
        
        {/* Input Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <label className="block mb-2 text-sm font-medium">
            Enter your Steam ID:
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
          
          <p className="mt-2 text-sm text-gray-400">
            Don't know your Steam ID? Find it at{' '}
            <a 
              href="https://steamidfinder.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              steamidfinder.com
            </a>
          </p>
          
          {error && (
            <p className="mt-2 text-red-400 text-sm">{error}</p>
          )}
        </div>
        
        {/* Library Stats */}
        {games.length > 0 && <LibraryStats games={games} />}
        
        {/* Game Suggestion */}
        <SuggestionCard 
          game={suggestion} 
          onNewSuggestion={handleNewSuggestion}
          onNeverSuggest={handleNeverSuggest}
          hiddenCount={neverSuggestList.length}
          onResetHidden={handleResetBlacklist}
        />
        
        {/* Filter and Sort Controls */}
        {games.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              
              {/* Filter Checkbox */}
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
                  <option value="appid-asc">App ID (Oldest First)</option>
                  <option value="appid-desc">App ID (Newest First)</option>
                </select>
              </div>
              
            </div>
            
            {sortBy.includes('appid') && (
              <p className="text-xs text-gray-400 mt-2">
                * App ID sorting is approximate - lower IDs are generally older games
              </p>
            )}
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
                
                return (
                  <div 
                    key={game.appid}
                    className="bg-gray-700 rounded p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {game.img_icon_url && (
                        <img
                          src={`https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`}
                          alt={game.name}
                          className="w-8 h-8 rounded"
                        />
                      )}
                      <div>
                        <h3 className="font-medium">{game.name}</h3>
                        <p className="text-sm text-gray-400">
                          {hours > 0 && `${hours}h `}
                          {minutes > 0 && `${minutes}m`}
                          {neverPlayed && '0 hours'}
                          {game.rating !== undefined && ` • ${game.rating}% 👍`}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`text-sm px-3 py-1 rounded ${
                      neverPlayed 
                        ? 'bg-red-900 text-red-200' 
                        : 'bg-green-900 text-green-200'
                    }`}>
                      {neverPlayed ? '❌ Never Played' : '✅ Played'}
                    </span>
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
