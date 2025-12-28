'use client';

import { useState, useEffect } from 'react';
import { useFriendsData } from '@/hooks/useFriendsData';
import Link from 'next/link';

interface Friend {
  steamid: string;
  personaname: string;
  profileurl: string;
  games?: Array<{
    appid: number;
    name: string;
    playtime_forever: number;
    rtime_last_played?: number;
  }>;
}

interface FriendRecentGame {
  friend: Friend;
  recentGame: {
    appid: number;
    name: string;
    playtime: number;
    lastPlayed: number;
    daysAgo: number;
  } | null;
}

export default function RecentGamesDebugPage() {
  const [steamId, setSteamId] = useState('');
  const { friendsData, loading, error, timeAgo, refetch } = useFriendsData(steamId || null);
  
  // Load saved Steam ID on mount
  useEffect(() => {
    const savedSteamId = localStorage.getItem('savedSteamId');
    if (savedSteamId) {
      setSteamId(savedSteamId);
    }
  }, []);
  
  // Process friends to find their most recent game
  const friendsWithRecentGames: FriendRecentGame[] = friendsData ? friendsData.friends.map(friend => {
    if (!friend.games || friend.games.length === 0) {
      return { friend, recentGame: null };
    }
    
    // Find game with highest rtime_last_played
    const gamesWithTimestamp = friend.games.filter(g => g.rtime_last_played);
    
    if (gamesWithTimestamp.length === 0) {
      return { friend, recentGame: null };
    }
    
    const mostRecent = gamesWithTimestamp.reduce((max, game) => 
      (game.rtime_last_played || 0) > (max.rtime_last_played || 0) ? game : max
    );
    
    const now = Math.floor(Date.now() / 1000);
    const daysAgo = Math.floor((now - (mostRecent.rtime_last_played || 0)) / (60 * 60 * 24));
    
    return {
      friend,
      recentGame: {
        appid: mostRecent.appid,
        name: mostRecent.name,
        playtime: mostRecent.playtime_forever,
        lastPlayed: mostRecent.rtime_last_played || 0,
        daysAgo
      }
    };
  }).sort((a, b) => {
    // Sort by most recent first (lowest daysAgo)
    if (!a.recentGame && !b.recentGame) return 0;
    if (!a.recentGame) return 1;
    if (!b.recentGame) return -1;
    return a.recentGame.daysAgo - b.recentGame.daysAgo;
  }) : [];
  
  // Calculate stats
  const stats = {
    totalFriends: friendsWithRecentGames.length,
    withTimestamps: friendsWithRecentGames.filter(f => f.recentGame !== null).length,
    withoutTimestamps: friendsWithRecentGames.filter(f => f.recentGame === null).length,
    recentlyActive: friendsWithRecentGames.filter(f => f.recentGame && f.recentGame.daysAgo <= 30).length,
    within15Days: friendsWithRecentGames.filter(f => f.recentGame && f.recentGame.daysAgo <= 15).length
  };
  
  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            ← Back to Main Page
          </Link>
          <h1 className="text-3xl font-bold mb-2">🕐 Friends' Recent Games Debug</h1>
          <p className="text-gray-400">Shows each friend's most recently played game to verify rtime_last_played data</p>
        </div>
        
        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
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
            
            <button
              onClick={() => refetch()}
              disabled={loading || !steamId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium whitespace-nowrap"
            >
              {loading ? 'Loading...' : '🔄 Refresh Data'}
            </button>
          </div>
          
          {friendsData && (
            <div className="mt-4 text-sm text-gray-400">
              Last updated: {timeAgo}
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm">
              ❌ Error: {error}
            </div>
          )}
        </div>
        
        {/* Stats Summary */}
        {friendsData && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold mb-3">📊 Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-2xl font-bold">{stats.totalFriends}</div>
                <div className="text-xs text-gray-400">Total Friends</div>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.withTimestamps}</div>
                <div className="text-xs text-gray-400">With Timestamp Data</div>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.withoutTimestamps}</div>
                <div className="text-xs text-gray-400">No Timestamp Data</div>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.recentlyActive}</div>
                <div className="text-xs text-gray-400">Active (Last 30 Days)</div>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.within15Days}</div>
                <div className="text-xs text-gray-400">Active (Last 15 Days)</div>
              </div>
            </div>
            
            {stats.withoutTimestamps > 0 && (
              <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-sm">
                ⚠️ <strong>{stats.withoutTimestamps} friends</strong> have no timestamp data. 
                This usually means their game details are private or the Steam API didn't return the data.
                {stats.withoutTimestamps === stats.totalFriends && (
                  <div className="mt-2 text-yellow-300 font-semibold">
                    🚨 No friends have timestamp data! The API parameter might be missing.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Friends Table */}
        {friendsData && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4">All Friends ({friendsWithRecentGames.length})</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Friend Name</th>
                    <th className="text-left p-2">Most Recent Game</th>
                    <th className="text-right p-2">Playtime</th>
                    <th className="text-right p-2">Last Played</th>
                    <th className="text-right p-2">Days Ago</th>
                    <th className="text-center p-2">Has Timestamp?</th>
                  </tr>
                </thead>
                <tbody>
                  {friendsWithRecentGames.map((item, index) => {
                    const { friend, recentGame } = item;
                    const name = friend.personaname || 'Private Profile';
                    const hasTimestamp = recentGame !== null;
                    const isRecent = recentGame && recentGame.daysAgo <= 30;
                    
                    return (
                      <tr 
                        key={friend.steamid} 
                        className={`border-b border-gray-700 hover:bg-gray-750 ${
                          isRecent ? 'bg-blue-900/20' : ''
                        }`}
                      >
                        <td className="p-2 text-gray-400">{index + 1}</td>
                        <td className="p-2">
                          <a
                            href={friend.profileurl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400"
                          >
                            {name}
                          </a>
                        </td>
                        <td className="p-2">
                          {recentGame ? (
                            <a
                              href={`https://store.steampowered.com/app/${recentGame.appid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {recentGame.name}
                            </a>
                          ) : (
                            <span className="text-gray-500 italic">No data</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {recentGame ? `${Math.floor(recentGame.playtime / 60)}h` : '-'}
                        </td>
                        <td className="p-2 text-right text-xs text-gray-400">
                          {recentGame ? new Date(recentGame.lastPlayed * 1000).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {recentGame ? (
                            <span className={
                              recentGame.daysAgo <= 7 ? 'text-green-400' :
                              recentGame.daysAgo <= 30 ? 'text-blue-400' :
                              recentGame.daysAgo <= 90 ? 'text-yellow-400' :
                              'text-gray-400'
                            }>
                              {recentGame.daysAgo}d
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-2 text-center">
                          {hasTimestamp ? (
                            <span className="text-green-400" title="Has timestamp data">✅</span>
                          ) : friend.games && friend.games.length > 0 ? (
                            <span className="text-yellow-400" title="Has games but no timestamps">⚠️</span>
                          ) : (
                            <span className="text-red-400" title="No games data">❌</span>
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
