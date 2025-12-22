import { useState, useEffect } from 'react';

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
}

interface Friend {
  steamid: string;
  personaname: string;
  profileurl: string;
  games?: SteamGame[];
  totalPlaytime?: number;
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

      // Add timestamp
      const dataWithTimestamp: FriendsData = {
        ...data,
        lastUpdated: Date.now(),
      };

      // Cache the result
      console.log('💾 [Friends] Caching friends data...');
      localStorage.setItem(CACHE_KEY, JSON.stringify(dataWithTimestamp));

      console.log('✅ [Friends] Successfully loaded friends data:', dataWithTimestamp.totalFriends, 'friends');
      setFriendsData(dataWithTimestamp);
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

  // Initial fetch
  useEffect(() => {
    if (steamId) {
      fetchFriendsData();
    }
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

  return {
    friendsData,
    loading,
    error,
    loadingProgress,
    timeAgo,
    refetch,
  };
}
