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
  const [points, setPoints] = useState(0);
  const [featuredGame, setFeaturedGame] = useState<VaultGameState | null>(null);
  const [clickAnimation, setClickAnimation] = useState<{ value: number; id: number } | null>(null);
  const [passiveIncome, setPassiveIncome] = useState(0);
  const steamId = process.env.NEXT_PUBLIC_STEAM_ID || '76561197970579347';

  useEffect(() => {
    fetchLibrary();
  }, []);

  // Convert games to vault states whenever games or unlocked list changes
  useEffect(() => {
    const vaultStates = games.map(game => toVaultGameState(game, unlockedGames));
    setVaultGames(vaultStates);
    
    // Calculate total passive income
    const totalPassive = vaultStates
      .filter(g => g.state === 'playable')
      .reduce((sum, g) => sum + g.passiveRate, 0);
    setPassiveIncome(Math.round(totalPassive * 10) / 10);
    
    // Auto-select Vault Controller as featured if nothing is featured
    if (!featuredGame && vaultStates.length > 0) {
      const vaultController = vaultStates.find(g => g.appid === 'vault-controller');
      if (vaultController) {
        setFeaturedGame(vaultController);
      }
    }
  }, [games, unlockedGames]);

  // Passive income timer - runs every 100ms for smooth updates
  useEffect(() => {
    if (passiveIncome <= 0) return;
    
    const interval = setInterval(() => {
      // Add passive income (divided by 10 since we run 10 times per second)
      setPoints(prev => prev + (passiveIncome / 10));
    }, 100);
    
    return () => clearInterval(interval);
  }, [passiveIncome]);

  // Handle clicking the featured game
  function handleClick() {
    if (!featuredGame) return;
    
    const earnedPoints = featuredGame.clickValue;
    setPoints(prev => prev + earnedPoints);
    
    // Show floating animation
    setClickAnimation({ value: earnedPoints, id: Date.now() });
    setTimeout(() => setClickAnimation(null), 1000);
  }

  // Handle selecting a game as featured
  function handleSelectFeatured(game: VaultGameState) {
    if (game.state === 'playable') {
      setFeaturedGame(game);
    }
  }

  // Handle unlocking a game
  function handleUnlock(game: VaultGameState) {
    // Check if can afford
    if (points < game.unlockCost) {
      return; // Not enough points
    }
    
    // Deduct points
    setPoints(prev => prev - game.unlockCost);
    
    // Add to unlocked games
    setUnlockedGames(prev => [...prev, game.appid]);
    
    // Show animation (could add toast notification here)
    console.log(`Unlocked ${game.name}!`);
  }

  // Handle "playing" a Liberation Key (simulated)
  function handlePlayLiberationKey(game: VaultGameState) {
    if (game.state !== 'liberationKey') return;
    
    // Simulate playing for 30 minutes
    const bonusPoints = 50 + (30 * 0.5); // Base 50 + 15 = 65 points
    
    // Award bonus points
    setPoints(prev => prev + bonusPoints);
    
    // Unlock the game (it's now playable!)
    setUnlockedGames(prev => [...prev, game.appid]);
    
    // Show success message
    console.log(`🎉 Liberation Key activated! ${game.name} unlocked with +${bonusPoints} bonus points!`);
  }

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
        {/* Header with Points */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-vault-accent">
              🔐 Steam Vault Escape
            </h1>
            <p className="text-gray-400">
              Free your trapped games by playing your unplayed titles
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">💰 Points</div>
            <div className="text-5xl font-bold text-vault-accent">
              {Math.floor(points).toLocaleString()}
            </div>
            {passiveIncome > 0 && (
              <div className="text-sm text-green-400 animate-pulse">
                +{passiveIncome.toFixed(1)}/sec
              </div>
            )}
          </div>
        </div>

        {/* Featured Game Section */}
        {featuredGame && (
          <div className="bg-gradient-to-r from-vault-blue to-vault-gray rounded-lg p-6 mb-8 border-2 border-vault-accent shadow-xl relative overflow-hidden">
            <div className="absolute top-2 left-2 text-xs font-bold text-vault-accent uppercase tracking-wider">
              ⭐ Featured Game
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">{featuredGame.name}</h2>
                <div className="text-gray-300 mb-4">
                  {featuredGame.hoursPlayed.toFixed(1)} hours played
                </div>
                <div className="text-2xl font-bold text-vault-gold mb-2">
                  👆 +{featuredGame.clickValue} per click
                </div>
                <div className="text-sm text-gray-400">
                  Passive: +{featuredGame.passiveRate}/sec
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={handleClick}
                  className="bg-vault-accent hover:bg-blue-400 text-vault-dark font-bold py-6 px-12 rounded-lg text-2xl transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  CLICK TO PLAY
                </button>
                {clickAnimation && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-vault-gold font-bold text-3xl animate-bounce pointer-events-none">
                    +{clickAnimation.value.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
              .sort((a, b) => {
                // Sort playable games by passive rate (highest first)
                if (a.state === 'playable' && b.state === 'playable') {
                  return b.passiveRate - a.passiveRate;
                }
                // Keep other states in original order
                return 0;
              })
              .map(game => {
                const isLocked = game.state === 'locked';
                const isPlayable = game.state === 'playable';
                const isKey = game.state === 'liberationKey';
                
                const isFeatured = featuredGame?.appid === game.appid;
                
                const canAfford = points >= game.unlockCost;
                
                return (
                  <div
                    key={game.appid}
                    onClick={() => !isLocked && handleSelectFeatured(game)}
                    className={`p-4 rounded border transition-all ${
                      isLocked
                        ? 'bg-vault-dark/50 border-red-500/30 opacity-60'
                        : isKey
                        ? 'bg-vault-dark border-vault-gold shadow-lg shadow-vault-gold/20'
                        : isFeatured
                        ? 'bg-vault-dark border-vault-accent shadow-lg shadow-vault-accent/30 ring-2 ring-vault-accent'
                        : 'bg-vault-dark border-green-500/30 cursor-pointer hover:border-green-400'
                    } hover:scale-[1.02]`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isLocked && <span className="text-red-400 text-xl">🔒</span>}
                          {isPlayable && !isFeatured && <span className="text-green-400 text-xl">✅</span>}
                          {isPlayable && isFeatured && <span className="text-vault-accent text-xl">⭐</span>}
                          {isKey && <span className="text-vault-gold text-xl animate-pulse">⭐</span>}
                          <div className="font-semibold">{game.name}</div>
                          {isFeatured && (
                            <span className="text-xs bg-vault-accent text-vault-dark px-2 py-1 rounded font-bold">
                              FEATURED
                            </span>
                          )}
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
                      <div className="flex items-center gap-3">
                        {isLocked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlock(game);
                            }}
                            disabled={!canAfford}
                            className={`px-4 py-2 rounded font-bold transition-all ${
                              canAfford
                                ? 'bg-vault-accent text-vault-dark hover:bg-blue-400 hover:scale-105'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {canAfford ? '🔓 UNLOCK' : '🔒 LOCKED'}
                          </button>
                        )}
                        {isKey && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayLiberationKey(game);
                            }}
                            className="bg-vault-gold text-vault-dark hover:bg-yellow-400 font-bold px-4 py-2 rounded transition-all hover:scale-105 animate-pulse"
                          >
                            🎮 PLAY 30 MIN
                          </button>
                        )}
                        <div className="text-3xl">
                          {isLocked && '🔒'}
                          {isPlayable && '✅'}
                          {isKey && '⭐'}
                        </div>
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
