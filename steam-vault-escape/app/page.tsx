'use client';

import { useEffect, useState } from 'react';
import { SteamGame } from '@/types/steam';
import { getVaultController } from '@/lib/vault-logic';

export default function Home() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const steamId = process.env.NEXT_PUBLIC_STEAM_ID || '76561197970579347';

  useEffect(() => {
    fetchLibrary();
  }, []);

  async function fetchLibrary() {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch library');
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Add Vault Controller at the beginning
      const vaultController = getVaultController();
      const allGames = [vaultController, ...(data.games || [])];
      
      setGames(allGames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-vault-accent">
            🔐 Steam Vault Escape
          </h1>
          <div className="text-center py-20">
            <div className="text-2xl mb-4">Loading your Steam library...</div>
            <div className="text-vault-accent animate-pulse">⚙️</div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-vault-accent">
            🔐 Steam Vault Escape
          </h1>
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
            <button
              onClick={fetchLibrary}
              className="mt-4 px-4 py-2 bg-vault-accent text-vault-dark rounded hover:bg-blue-400 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-vault-accent">
            🔐 Steam Vault Escape
          </h1>
          <p className="text-gray-400">
            Free your trapped games by playing your unplayed titles
          </p>
        </div>

        {/* Stats Bar */}
        <div className="bg-vault-gray rounded-lg p-6 mb-8 border border-vault-accent/20">
          <div className="flex gap-8">
            <div>
              <div className="text-sm text-gray-400">Total Games</div>
              <div className="text-2xl font-bold text-vault-accent">{games.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Unplayed Games</div>
              <div className="text-2xl font-bold text-vault-gold">
                {games.filter(g => g.playtime_forever === 0).length}
              </div>
            </div>
          </div>
        </div>

        {/* Games List */}
        <div className="bg-vault-gray rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Your Library</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {games.map(game => (
              <div
                key={game.appid}
                className="bg-vault-dark p-4 rounded border border-vault-accent/10 hover:border-vault-accent/30 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{game.name}</div>
                    <div className="text-sm text-gray-400">
                      {game.playtime_forever === 0 ? (
                        <span className="text-vault-gold">⭐ Never Played</span>
                      ) : (
                        <span>
                          {(game.playtime_forever / 60).toFixed(1)} hours played
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl">
                    {game.playtime_forever === 0 ? '⭐' : '🎮'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
