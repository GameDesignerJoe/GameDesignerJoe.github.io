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

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsedCache: FriendsData = JSON.parse(cached);
          const age = Date.now() - parsedCache.lastUpdated;
          
          if (age < CACHE_DURATION) {
            setFriendsData(parsedCache);
            setTimeAgo(getTimeAgo(parsedCache.lastUpdated));
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to parse cached friends data');
      }
    }

    // Fetch fresh data
    setLoading(true);
    setError(null);
    setLoadingProgress({ loaded: 0, total: 1 });

    try {
      const response = await fetch(`/api/steam-friends?steamid=${steamId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch friends data');
      }

      // Add timestamp
      const dataWithTimestamp: FriendsData = {
        ...data,
        lastUpdated: Date.now(),
      };

      // Cache the result
      localStorage.setItem(CACHE_KEY, JSON.stringify(dataWithTimestamp));

      setFriendsData(dataWithTimestamp);
      setTimeAgo('just now');
      setLoadingProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoadingProgress(null);
    } finally {
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
