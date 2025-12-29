'use client';

import { useEffect, useState } from 'react';
import { SteamGame } from '@/types/steam';
import { VaultGameState } from '@/types/vault';
import { getVaultController, toVaultGameState } from '@/lib/vault-logic';

export default function Home() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [vaultGames, setVaultGames] = useState<VaultGameState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'locked' | 'playable' | 'liberationKey'>('all');
  const [unlockedGames, setUnlockedGames] = useState<Array<number | string>>(['vault-controller']);
  const steamId = process.env.NEXT_PUBLIC_STEAM_ID || '76561197970579347';

  useEffect(() => {
    fetchLibrary();
  }, []);

  // Convert games to vault states whenever games or unlocked list changes
  useEffect(() => {
    const vaultStates = games.map(game => toVaultGameState(game, unlockedGames));
    setVaultGames(vaultStates);
  }, [games, unlockedGames]);

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
              <div className="text-2xl font-bold text-vault-accent">{vaultGames.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">🔒 Locked</div>
              <div className="text-2xl font-bold text-red-400">
                {vaultGames.filter(g => g.state === 'locked').length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">✅ Playable</div>
              <div className="text-2xl font-bold text-green-400">
                {vaultGames.filter(g => g.state === 'playable').length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">⭐ Liberation Keys</div>
              <div className="text-2xl font-bold text-vault-gold">
                {vaultGames.filter(g => g.state === 'liberationKey').length}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded transition-colors ${
              filter === 'all'
                ? 'bg-vault-accent text-vault-dark font-bold'
                : 'bg-vault-gray text-gray-300 hover:bg-vault-gray/70'
            }`}
          >
            All ({vaultGames.length})
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`px-4 py-2 rounded transition-colors ${
              filter === 'locked'
                ? 'bg-red-500 text-white font-bold'
                : 'bg-vault-gray text-gray-300 hover:bg-vault-gray/70'
            }`}
          >
            🔒 Locked ({vaultGames.filter(g => g.state === 'locked').length})
          </button>
          <button
            onClick={() => setFilter('playable')}
            className={`px-4 py-2 rounded transition-colors ${
              filter === 'playable'
                ? 'bg-green-500 text-white font-bold'
                : 'bg-vault-gray text-gray-300 hover:bg-vault-gray/70'
            }`}
          >
            ✅ Playable ({vaultGames.filter(g => g.state === 'playable').length})
          </button>
          <button
            onClick={() => setFilter('liberationKey')}
            className={`px-4 py-2 rounded transition-colors ${
              filter === 'liberationKey'
                ? 'bg-vault-gold text-vault-dark font-bold'
                : 'bg-vault-gray text-gray-300 hover:bg-vault-gray/70'
            }`}
          >
            ⭐ Keys ({vaultGames.filter(g => g.state === 'liberationKey').length})
          </button>
        </div>

        {/* Games List */}
        <div className="bg-vault-gray rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Your Library</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {vaultGames
              .filter(game => filter === 'all' || game.state === filter)
              .map(game => {
                const isLocked = game.state === 'locked';
                const isPlayable = game.state === 'playable';
                const isKey = game.state === 'liberationKey';
                
                return (
                  <div
                    key={game.appid}
                    className={`p-4 rounded border transition-all ${
                      isLocked
                        ? 'bg-vault-dark/50 border-red-500/30 opacity-60'
                        : isKey
                        ? 'bg-vault-dark border-vault-gold shadow-lg shadow-vault-gold/20'
                        : 'bg-vault-dark border-green-500/30'
                    } hover:scale-[1.02]`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isLocked && <span className="text-red-400 text-xl">🔒</span>}
                          {isPlayable && <span className="text-green-400 text-xl">✅</span>}
                          {isKey && <span className="text-vault-gold text-xl animate-pulse">⭐</span>}
                          <div className="font-semibold">{game.name}</div>
                        </div>
                        <div className="text-sm text-gray-400 ml-8">
                          {isKey ? (
                            <span className="text-vault-gold font-semibold">
                              LIBERATION KEY - Play 30 min to unlock FREE!
                            </span>
                          ) : (
                            <>
                              {game.hoursPlayed.toFixed(1)} hours played
                              {isLocked && (
                                <span className="text-red-400 ml-2">
                                  • Unlock cost: {game.unlockCost.toLocaleString()} points
                                </span>
                              )}
                              {isPlayable && (
                                <span className="text-green-400 ml-2">
                                  • +{game.passiveRate}/sec • +{game.clickValue}/click
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-3xl">
                        {isLocked && '🔒'}
                        {isPlayable && '✅'}
                        {isKey && '⭐'}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </main>
  );
}
