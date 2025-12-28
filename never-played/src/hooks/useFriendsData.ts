import { useState, useEffect } from 'react';
import { verifyFriendsBackground } from '@/utils/friendsVerification';

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url?: string; // Optional - stripped from cache to reduce size
}

interface Friend {
  steamid: string;
  personaname: string;
  profileurl: string;
  games?: SteamGame[];
  totalPlaytime?: number;
  verificationAttempts?: number; // Track how many times we've tried to fetch games
}

interface FriendsData {
  totalFriends: number;
  friendsWithGames: number;
  friendsWithPrivateLibraries: number;
  friends: Friend[];
  lastUpdated: number;
}

interface UseFriendsDataResult {
  friendsData: FriendsData | null;
  loading: boolean;
  error: string | null;
  loadingProgress: { loaded: number; total: number } | null;
  timeAgo: string;
  refetch: () => void;
  reloadFromCache: () => void;
}

const CACHE_KEY = 'steam_friends_data';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function useFriendsData(steamId: string | null): UseFriendsDataResult {
  const [friendsData, setFriendsData] = useState<FriendsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [timeAgo, setTimeAgo] = useState('');

  const fetchFriendsData = async (forceRefresh = false) => {
    if (!steamId) return;

    console.log('🔍 [Friends] Starting friends data fetch for Steam ID:', steamId);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsedCache: FriendsData = JSON.parse(cached);
          const age = Date.now() - parsedCache.lastUpdated;
          
          console.log('💾 [Friends] Found cached data, age:', Math.floor(age / 1000 / 60), 'minutes');
          
          if (age < CACHE_DURATION) {
            console.log('✅ [Friends] Using cached data:', parsedCache.totalFriends, 'friends');
            setFriendsData(parsedCache);
            setTimeAgo(getTimeAgo(parsedCache.lastUpdated));
            return;
          } else {
            console.log('⏰ [Friends] Cache expired, fetching fresh data');
          }
        } else {
          console.log('📭 [Friends] No cached data found');
        }
      } catch (e) {
        console.warn('⚠️ [Friends] Failed to parse cached friends data:', e);
      }
    } else {
      console.log('🔄 [Friends] Force refresh requested, skipping cache');
    }

    // Fetch fresh data
    console.log('🌐 [Friends] Starting API fetch...');
    setLoading(true);
    setError(null);
    setLoadingProgress({ loaded: 0, total: 1 });

    const startTime = Date.now();

    try {
      console.log('📡 [Friends] Calling /api/steam-friends endpoint...');
      const response = await fetch(`/api/steam-friends?steamid=${steamId}`);
      const fetchDuration = Date.now() - startTime;
      console.log('⏱️ [Friends] API response received in', fetchDuration, 'ms');
      
      const data = await response.json();
      console.log('📦 [Friends] Response data:', {
        ok: response.ok,
        status: response.status,
        totalFriends: data.totalFriends,
        friendsWithGames: data.friendsWithGames,
        friendsCount: data.friends?.length
      });

      if (!response.ok) {
        console.error('❌ [Friends] API error:', data.message);
        throw new Error(data.message || 'Failed to fetch friends data');
      }

      // INTELLIGENT MERGING: If we have cached data, merge it with fresh data
      // This prevents friends from "disappearing" due to API rate limiting
      let mergedFriends = data.friends;
      
      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const cachedData: FriendsData = JSON.parse(cached);
            const cachedFriendMap = new Map(cachedData.friends.map((f: Friend) => [f.steamid, f]));
            
            // Merge: Keep cached friends that aren't in fresh data, update ones that are
            const freshSteamIds = new Set(data.friends.map((f: Friend) => f.steamid));
            
            mergedFriends = [
              ...data.friends, // All fresh data first
              ...cachedData.friends.filter((cachedFriend: Friend) => 
                !freshSteamIds.has(cachedFriend.steamid) // Not in fresh data - preserve everyone!
                // Removed game data check - we keep ALL friends, even without games
              )
            ];
            
            console.log('🔄 [Friends] Merged data:', {
              freshCount: data.friends.length,
              cachedCount: cachedData.friends.length,
              mergedCount: mergedFriends.length,
              preserved: mergedFriends.length - data.friends.length
            });
          }
        } catch (e) {
          console.warn('⚠️ [Friends] Failed to merge with cached data:', e);
        }
      }
      
      // Add timestamp and strip unnecessary data for mobile storage limits
      const dataWithTimestamp: FriendsData = {
        totalFriends: mergedFriends.length,
        friendsWithGames: mergedFriends.filter((f: Friend) => f.games && f.games.length > 0).length,
        friendsWithPrivateLibraries: mergedFriends.filter((f: Friend) => !f.games || f.games.length === 0).length,
        friends: mergedFriends,
        lastUpdated: Date.now(),
      };

      // Strip img_icon_url from games to reduce cache size (not needed for friend cells)
      const compactData: FriendsData = {
        ...dataWithTimestamp,
        friends: dataWithTimestamp.friends.map(friend => ({
          ...friend,
          games: friend.games?.map(game => ({
            appid: game.appid,
            name: game.name,
            playtime_forever: game.playtime_forever
            // img_icon_url removed to reduce localStorage size by ~40%
          }))
        }))
      };

      // Cache the compact result
      const cacheString = JSON.stringify(compactData);
      const cacheSizeBytes = new Blob([cacheString]).size;
      const cacheSizeKB = (cacheSizeBytes / 1024).toFixed(2);
      const cacheSizeMB = (cacheSizeBytes / 1024 / 1024).toFixed(2);
      
      console.log('💾 [Friends] Caching friends data (compact mode)...');
      console.log(`📊 [Friends] Cache size: ${cacheSizeBytes} bytes (${cacheSizeKB} KB / ${cacheSizeMB} MB)`);
      
      try {
        localStorage.setItem(CACHE_KEY, cacheString);
        console.log('✅ [Friends] Cache saved successfully');
        
        // Calculate total localStorage usage
        let totalSize = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length + key.length;
          }
        }
        const totalKB = (totalSize / 1024).toFixed(2);
        const totalMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`📦 [Friends] Total localStorage usage: ${totalSize} bytes (${totalKB} KB / ${totalMB} MB)`);
        
        if (totalSize / 1024 / 1024 > 4) {
          console.warn('⚠️ [Friends] localStorage usage is high (>4MB), may cause issues on some mobile devices');
        }
      } catch (cacheError) {
        console.error('❌ [Friends] Failed to cache (quota exceeded?), continuing without cache:', cacheError);
        console.log(`💡 [Friends] Attempted to store ${cacheSizeKB} KB - try clearing old cache data`);
        // Continue even if caching fails - we still have the data in memory
      }

      console.log('✅ [Friends] Successfully loaded friends data:', compactData.totalFriends, 'friends');
      setFriendsData(compactData);
      setTimeAgo('just now');
      setLoadingProgress(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      console.error('❌ [Friends] Error fetching friends data:', errorMsg);
      setError(errorMsg);
      setLoadingProgress(null);
    } finally {
      const totalDuration = Date.now() - startTime;
      console.log('🏁 [Friends] Fetch complete, total time:', totalDuration, 'ms');
      setLoading(false);
    }
  };

  // Initial fetch - only when steamId is valid (17 characters)
  useEffect(() => {
    if (steamId && steamId.length === 17) {
      fetchFriendsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamId]);

  // Update "time ago" every minute
  useEffect(() => {
    if (!friendsData) return;

    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(friendsData.lastUpdated));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [friendsData]);

  const refetch = () => {
    fetchFriendsData(true);
  };
  
  const reloadFromCache = () => {
    // Force reload from cache without API call
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedCache: FriendsData = JSON.parse(cached);
        console.log('📥 [Friends] Reloading from cache:', parsedCache.totalFriends, 'friends');
        setFriendsData(parsedCache);
        setTimeAgo(getTimeAgo(parsedCache.lastUpdated));
      }
    } catch (e) {
      console.error('❌ [Friends] Failed to reload from cache:', e);
    }
  };
  
  // NOTE: Auto-verification disabled by user request
  // Verification now only runs manually via "Re-verify Friends" button in settings
  // This prevents Steam API rate limiting (420 errors) on page load

  return {
    friendsData,
    loading,
    error,
    loadingProgress,
    timeAgo,
    refetch,
    reloadFromCache,
  };
}
