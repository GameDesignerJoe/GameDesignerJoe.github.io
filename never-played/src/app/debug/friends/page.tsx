'use client';

import { useState, useEffect } from 'react';
import { useFriendsData } from '@/hooks/useFriendsData';
import Link from 'next/link';

interface Friend {
  steamid: string;
  personaname: string;
  profileurl: string;
  games?: Array<{ appid: number; name: string; playtime_forever: number }>;
  totalPlaytime?: number;
  verificationAttempts?: number;
}

interface CachedFriendsData {
  friends: Friend[];
  totalFriends: number;
  friendsWithGames: number;
  friendsWithPrivateLibraries: number;
  lastUpdated: number;
}

interface FriendsSnapshot {
  timestamp: number;
  totalFriends: number;
  friendsWithGames: number;
  friends: Array<{
    steamid: string;
    name: string;
    totalGames: number;
    playedGames: number;
    completionRate: number;
    totalPlaytime: number;
    hasGames: boolean;
  }>;
}

export default function FriendsDebugPage() {
  const [steamId, setSteamId] = useState('');
  const [snapshots, setSnapshots] = useState<FriendsSnapshot[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'completion' | 'games' | 'played' | 'playtime' | 'hasData'>('completion');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{ current: number; total: number } | null>(null);
  const [backgroundVerifying, setBackgroundVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState<{ 
    current: number; 
    total: number; 
    currentFriend: string;
  } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  const { friendsData, loading, error, timeAgo, refetch, reloadFromCache } = useFriendsData(steamId || null);
  
  // Load saved Steam ID on mount
  useEffect(() => {
    const savedSteamId = localStorage.getItem('savedSteamId');
    if (savedSteamId) {
      setSteamId(savedSteamId);
    }
  }, []);
  
  // Auto-start background verification when data loads
  useEffect(() => {
    if (!friendsData || loading || backgroundVerifying) return;
    
    // Check if we've already auto-started this session
    const hasAutoStarted = sessionStorage.getItem('verification_auto_started');
    if (hasAutoStarted) return;
    
    // Find unverified friends (not enough attempts yet)
    const unverifiedFriends = friendsData.friends.filter(
      f => !f.games && (f.verificationAttempts || 0) < 2
    );
    
    if (unverifiedFriends.length > 0) {
      console.log('🚀 [Auto-Start] Beginning verification of', unverifiedFriends.length, 'unverified friends');
      sessionStorage.setItem('verification_auto_started', 'true');
      startBackgroundVerification(unverifiedFriends);
    }
  }, [friendsData, loading, backgroundVerifying]);
  
  // Create snapshot from current friends data
  const takeSnapshot = () => {
    if (!friendsData) return;
    
    const snapshot: FriendsSnapshot = {
      timestamp: Date.now(),
      totalFriends: friendsData.totalFriends,
      friendsWithGames: friendsData.friendsWithGames,
      friends: friendsData.friends.map(friend => {
        const totalGames = friend.games?.length || 0;
        const playedGames = friend.games?.filter(g => g.playtime_forever > 0).length || 0;
        const completionRate = totalGames > 0 ? (playedGames / totalGames) * 100 : 0;
        const totalPlaytime = friend.games?.reduce((sum, g) => sum + g.playtime_forever, 0) || 0;
        
        return {
          steamid: friend.steamid,
          name: friend.personaname || 'Private Profile',
          totalGames,
          playedGames,
          completionRate,
          totalPlaytime,
          hasGames: !!friend.games && friend.games.length > 0
        };
      })
    };
    
    setSnapshots(prev => [snapshot, ...prev].slice(0, 5)); // Keep last 5 snapshots
  };
  
  // Sort friends data
  const sortedFriends = friendsData ? [...friendsData.friends].sort((a, b) => {
    let aVal: any, bVal: any;
    
    switch (sortBy) {
      case 'name':
        // Case-insensitive sorting
        aVal = (a.personaname || 'Private Profile').toLowerCase();
        bVal = (b.personaname || 'Private Profile').toLowerCase();
        break;
      case 'completion':
        const aTotalGames = a.games?.length || 0;
        const aPlayedGames = a.games?.filter(g => g.playtime_forever > 0).length || 0;
        aVal = aTotalGames > 0 ? (aPlayedGames / aTotalGames) * 100 : 0;
        
        const bTotalGames = b.games?.length || 0;
        const bPlayedGames = b.games?.filter(g => g.playtime_forever > 0).length || 0;
        bVal = bTotalGames > 0 ? (bPlayedGames / bTotalGames) * 100 : 0;
        break;
      case 'games':
        aVal = a.games?.length || 0;
        bVal = b.games?.length || 0;
        break;
      case 'played':
        aVal = a.games?.filter(g => g.playtime_forever > 0).length || 0;
        bVal = b.games?.filter(g => g.playtime_forever > 0).length || 0;
        break;
      case 'playtime':
        aVal = a.games?.reduce((sum, g) => sum + g.playtime_forever, 0) || 0;
        bVal = b.games?.reduce((sum, g) => sum + g.playtime_forever, 0) || 0;
        break;
      case 'hasData':
        aVal = (a.games && a.games.length > 0) ? 1 : 0;
        bVal = (b.games && b.games.length > 0) ? 1 : 0;
        break;
    }
    
    if (sortDir === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  }).filter(friend => {
    if (!searchTerm) return true;
    const name = friend.personaname || 'Private Profile';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  }) : [];
  
  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };
  
  // Retry missing friends
  const retryMissingFriends = async () => {
    if (!friendsData) return;
    
    // Get friends without game data
    const missingFriends = friendsData.friends.filter(f => !f.games || f.games.length === 0);
    
    if (missingFriends.length === 0) {
      alert('All friends already have game data!');
      return;
    }
    
    const steamIds = missingFriends.map(f => f.steamid);
    
    setRetrying(true);
    
    try {
      console.log('🔄 [Debug] Retrying', steamIds.length, 'friends:', steamIds);
      
      const response = await fetch('/api/steam-friends-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamIds })
      });
      
      const result = await response.json();
      
      console.log('📦 [Debug] Retry result:', result);
      
      if (response.ok && result.success) {
        // MANUALLY MERGE retry results into cache instead of refetching
        const CACHE_KEY = 'steam_friends_data';
        const cached = localStorage.getItem(CACHE_KEY);
        
        if (cached) {
          try {
            const cachedData: CachedFriendsData = JSON.parse(cached);
            const retryMap = new Map<string, Friend>(result.friends.map((f: Friend) => [f.steamid, f]));
            
            // Update friends: merge retry results with existing data
            const updatedFriends = cachedData.friends.map((friend: Friend) => {
              const retryData = retryMap.get(friend.steamid);
              if (retryData) {
                console.log('✅ [Debug] Updated friend:', retryData.personaname || retryData.steamid, 'games:', retryData.games?.length || 0);
                // Increment verification attempts
                const previousAttempts = friend.verificationAttempts || 0;
                const newAttempts = previousAttempts + (retryData.verificationAttempts || 1);
                
                // Prefer retry data (it's fresher)
                return {
                  ...friend,
                  ...retryData,
                  // Ensure we keep games data if retry succeeded
                  games: retryData.games || friend.games,
                  // Track verification attempts
                  verificationAttempts: newAttempts
                } as Friend;
              }
              return friend;
            });
            
            // Recalculate counts
            const updatedData = {
              ...cachedData,
              friends: updatedFriends,
              friendsWithGames: updatedFriends.filter((f: Friend) => f.games && f.games.length > 0).length,
              friendsWithPrivateLibraries: updatedFriends.filter((f: Friend) => !f.games || f.games.length === 0).length,
              lastUpdated: Date.now()
            };
            
            console.log('💾 [Debug] Saving updated cache:', {
              totalFriends: updatedData.totalFriends,
              friendsWithGames: updatedData.friendsWithGames,
              friendsWithPrivateLibraries: updatedData.friendsWithPrivateLibraries
            });
            
            // Save back to cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
            
            // Reload from cache (don't refetch, which would hit the API and lose our retry results!)
            reloadFromCache();
            
            alert(`✅ Retry complete! Successfully loaded ${result.successful}/${result.retried} friends.`);
          } catch (e) {
            console.error('❌ [Debug] Failed to merge retry results:', e);
            alert('⚠️ Retry succeeded but failed to update cache. Try refreshing the page.');
          }
        } else {
          console.warn('⚠️ [Debug] No cache found, doing full refetch');
          refetch();
          alert(`✅ Retry complete! Successfully loaded ${result.successful}/${result.retried} friends.`);
        }
      } else {
        alert(`❌ Retry failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ [Debug] Retry error:', error);
      alert('❌ Failed to retry friends. Check console for details.');
    } finally {
      setRetrying(false);
    }
  };
  
  // Background verification - processes friends one at a time
  const startBackgroundVerification = async (friendsToVerify: Friend[]) => {
    if (backgroundVerifying) return; // Already running
    
    setBackgroundVerifying(true);
    setIsPaused(false);
    const CACHE_KEY = 'steam_friends_data';
    
    console.log('🚀 [Background] Starting verification of', friendsToVerify.length, 'friends');
    
    for (let i = 0; i < friendsToVerify.length; i++) {
      // Check if paused
      if (isPaused) {
        console.log('⏸️ [Background] Paused at', i, '/', friendsToVerify.length);
        break;
      }
      
      const friend = friendsToVerify[i];
      const friendName = friend.personaname || `Friend ${friend.steamid.slice(-4)}`;
      
      setVerificationProgress({
        current: i + 1,
        total: friendsToVerify.length,
        currentFriend: friendName
      });
      
      try {
        console.log(`🔍 [Background] Verifying ${i + 1}/${friendsToVerify.length}: ${friendName}`);
        
        // Call single friend API
        const response = await fetch('/api/steam-friend-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steamId: friend.steamid })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.friend) {
            // Update cache immediately
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
              const cachedData = JSON.parse(cached);
              
              // Find and update this specific friend
              const updatedFriends = cachedData.friends.map((f: Friend) => {
                if (f.steamid === result.friend.steamid) {
                  const previousAttempts = f.verificationAttempts || 0;
                  const newAttempts = previousAttempts + 1;
                  
                  console.log(`✅ [Background] Updated ${result.friend.personaname}: ${result.friend.games?.length || 0} games (attempt ${newAttempts})`);
                  
                  return {
                    ...f,
                    ...result.friend,
                    games: result.friend.games || f.games,
                    verificationAttempts: newAttempts
                  };
                }
                return f;
              });
              
              // Recalculate counts
              const updatedData = {
                ...cachedData,
                friends: updatedFriends,
                friendsWithGames: updatedFriends.filter((f: Friend) => f.games && f.games.length > 0).length,
                friendsWithPrivateLibraries: updatedFriends.filter((f: Friend) => !f.games || f.games.length === 0).length,
                lastUpdated: Date.now()
              };
              
              // Save and reload
              localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
              reloadFromCache(); // UI updates immediately!
            }
          }
        }
        
        // Rate limiting delay (500ms between requests)
        if (i < friendsToVerify.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ [Background] Error verifying ${friendName}:`, error);
      }
    }
    
    setBackgroundVerifying(false);
    setVerificationProgress(null);
    console.log('🏁 [Background] Verification complete!');
  };
  
  // Compare snapshots
  const compareSnapshots = (snap1: FriendsSnapshot, snap2: FriendsSnapshot) => {
    const missing = snap1.friends.filter(f1 => 
      !snap2.friends.find(f2 => f2.steamid === f1.steamid)
    );
    const added = snap2.friends.filter(f2 => 
      !snap1.friends.find(f1 => f1.steamid === f2.steamid)
    );
    const changed = snap1.friends.filter(f1 => {
      const f2 = snap2.friends.find(f => f.steamid === f1.steamid);
      return f2 && (
        f1.totalGames !== f2.totalGames ||
        f1.completionRate !== f2.completionRate ||
        f1.hasGames !== f2.hasGames
      );
    });
    
    return { missing, added, changed };
  };
  
  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            ← Back to Main Page
          </Link>
          <h1 className="text-3xl font-bold mb-2">👥 Friends Leaderboards</h1>
          <p className="text-gray-400">See how you rank against your Steam friends across different stats</p>
        </div>
        
        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm mb-1">Steam ID</label>
              <input
                type="text"
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="Enter Steam ID"
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600"
              />
            </div>
            
            <div className="flex gap-2 items-end">
              <button
                onClick={() => refetch()}
                disabled={loading || !steamId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium"
              >
                {loading ? 'Loading...' : '🔄 Refresh Data'}
              </button>
            </div>
          </div>
          
          {friendsData && (
            <div className="mt-4 text-sm text-gray-400">
              Last updated: {timeAgo} | Total friends: {friendsData.totalFriends} | With games: {friendsData.friendsWithGames} | Private: {friendsData.totalFriends - friendsData.friendsWithGames}
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm">
              ❌ Error: {error}
            </div>
          )}
        </div>
        
        {/* Retry Missing Friends */}
        {friendsData && (() => {
          const missingFriends = friendsData.friends.filter(f => !f.games || f.games.length === 0);
          const unverifiedCount = missingFriends.filter(f => (f.verificationAttempts || 0) < 2).length;
          const confirmedPrivateCount = missingFriends.filter(f => (f.verificationAttempts || 0) >= 2).length;
          
          if (missingFriends.length === 0) return null;
          
          return (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-yellow-300 mb-1">
                    {unverifiedCount > 0 ? '❓ Unverified Friends' : '🔒 Private Game Libraries'}
                  </h3>
                  <p className="text-sm text-gray-300">
                    {unverifiedCount > 0 && `${unverifiedCount} friend${unverifiedCount !== 1 ? 's' : ''} need verification (marked ❓)`}
                    {unverifiedCount > 0 && confirmedPrivateCount > 0 && ' • '}
                    {confirmedPrivateCount > 0 && `${confirmedPrivateCount} confirmed private (marked 🔒)`}
                  </p>
                </div>
                
                <button
                  onClick={() => startBackgroundVerification(missingFriends)}
                  disabled={backgroundVerifying}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded font-medium transition whitespace-nowrap"
                >
                  {backgroundVerifying ? '⏳ Verifying...' : '🔄 Start Verification'}
                </button>
              </div>
              
              {retrying && (
                <div className="mt-3 text-sm text-gray-300">
                  ⏳ This may take a while... (retrying with delays to avoid rate limits)
                </div>
              )}
            </div>
          );
        })()}
        
        {/* Background Verification Progress */}
        {backgroundVerifying && verificationProgress && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-blue-300">
                  📡 Background Verification in Progress
                </h3>
                <p className="text-sm text-gray-300 mt-1">
                  Checking: {verificationProgress.currentFriend} ({verificationProgress.current}/{verificationProgress.total})
                </p>
              </div>
              
              <button
                onClick={() => setIsPaused(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition whitespace-nowrap"
              >
                ⏸️ Pause
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(verificationProgress.current / verificationProgress.total) * 100}%` }}
              />
            </div>
            
            <div className="text-xs text-gray-400 mt-1">
              {Math.round((verificationProgress.current / verificationProgress.total) * 100)}% complete
            </div>
          </div>
        )}
        
        {/* Friends Table */}
        {friendsData && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">All Friends ({sortedFriends.length})</h2>
              
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search friends..."
                className="px-3 py-1 bg-gray-700 rounded border border-gray-600 text-sm"
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th 
                      className="text-left p-2 cursor-pointer hover:bg-gray-700"
                      onClick={() => toggleSort('name')}
                    >
                      Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right p-2 cursor-pointer hover:bg-gray-700"
                      onClick={() => toggleSort('games')}
                    >
                      Total Games {sortBy === 'games' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right p-2 cursor-pointer hover:bg-gray-700"
                      onClick={() => toggleSort('played')}
                    >
                      Played {sortBy === 'played' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right p-2 cursor-pointer hover:bg-gray-700"
                      onClick={() => toggleSort('completion')}
                    >
                      Completion % {sortBy === 'completion' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right p-2 cursor-pointer hover:bg-gray-700"
                      onClick={() => toggleSort('playtime')}
                    >
                      Total Playtime {sortBy === 'playtime' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-center p-2 cursor-pointer hover:bg-gray-700"
                      onClick={() => toggleSort('hasData')}
                    >
                      Has Data {sortBy === 'hasData' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFriends.map((friend, index) => {
                    const totalGames = friend.games?.length || 0;
                    const playedGames = friend.games?.filter(g => g.playtime_forever > 0).length || 0;
                    const completionRate = totalGames > 0 ? ((playedGames / totalGames) * 100).toFixed(1) : '0.0';
                    const totalPlaytime = friend.games?.reduce((sum, g) => sum + g.playtime_forever, 0) || 0;
                    const totalHours = Math.floor(totalPlaytime / 60);
                    const hasGames = !!friend.games && friend.games.length > 0;
                    const name = friend.personaname || 'Private Profile';
                    const isPrivate = !friend.personaname || !hasGames;
                    
                    return (
                      <tr 
                        key={friend.steamid} 
                        className={`border-b border-gray-700 hover:bg-gray-750 ${
                          parseFloat(completionRate) === 100 ? 'bg-green-900/20' : ''
                        }`}
                      >
                        <td className="p-2 text-gray-400">{index + 1}</td>
                        <td className="p-2">
                          <a
                            href={friend.profileurl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`hover:text-blue-400 ${isPrivate ? 'italic text-gray-400' : ''}`}
                          >
                            {name}
                          </a>
                        </td>
                        <td className="p-2 text-right">{totalGames}</td>
                        <td className="p-2 text-right">{playedGames}</td>
                        <td className="p-2 text-right font-semibold">
                          {completionRate}%
                        </td>
                        <td className="p-2 text-right">
                          {totalHours.toLocaleString()}h
                        </td>
                        <td className="p-2 text-center">
                          {hasGames ? (
                            <span className="text-green-400" title="Public game library">✅</span>
                          ) : (friend.verificationAttempts || 0) >= 2 ? (
                            <span className="text-yellow-400" title={`Confirmed private after ${friend.verificationAttempts} attempts`}>🔒</span>
                          ) : (
                            <span className="text-gray-400" title="Not yet verified - click 'Check Again' to verify">❓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {!friendsData && !loading && !error && (
          <div className="text-center text-gray-400 py-12">
            Enter a Steam ID above to load friends data
          </div>
        )}
      </div>
    </main>
  );
}
