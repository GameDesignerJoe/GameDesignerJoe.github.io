'use client';

import { useEffect, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SteamGame } from '@/types/steam';
import { VaultGameState } from '@/types/vault';
import { getVaultController, toVaultGameState } from '@/lib/vault-logic';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';

export default function Home() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [vaultGames, setVaultGames] = useState<VaultGameState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'locked' | 'playable' | 'liberationKey'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'cost' | 'hours' | 'name' | 'passive'>('default');
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
            <div className="flex flex-col items-center mt-4">
              {/* Game Title */}
              <h2 className="text-3xl font-bold mb-6 text-center">{featuredGame.name}</h2>
              
              {/* Clickable Game Image */}
              <div className="relative mb-6">
                <button
                  onClick={handleClick}
                  className="relative block transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-vault-accent rounded-lg overflow-hidden shadow-lg"
                  style={{ width: '300px', height: '450px' }}
                >
                  <img
                    src={getLibraryCapsule(featuredGame.appid)}
                    alt={featuredGame.name}
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-vault-accent/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-2xl font-bold drop-shadow-lg">CLICK TO PLAY</span>
                  </div>
                </button>
                {clickAnimation && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-vault-gold font-bold text-3xl animate-bounce pointer-events-none">
                    +{clickAnimation.value.toFixed(1)}
                  </div>
                )}
              </div>
              
              {/* Game Details */}
              <div className="text-center space-y-2">
                <div className="text-gray-300">
                  {featuredGame.hoursPlayed.toFixed(1)} hours played
                </div>
                <div className="text-2xl font-bold text-vault-gold">
                  👆 +{featuredGame.clickValue} per click
                </div>
                <div className="text-sm text-gray-400">
                  Passive: +{featuredGame.passiveRate}/sec
                </div>
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

        {/* Filter and Sort Controls */}
        <div className="flex gap-4 mb-4 items-center flex-wrap">
          {/* Filter Buttons */}
          <div className="flex gap-2">
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

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-vault-gray text-white px-3 py-2 rounded border border-gray-600 hover:border-gray-500 focus:border-vault-accent focus:outline-none"
            >
              <option value="default">Default</option>
              <option value="cost">Unlock Cost</option>
              <option value="hours">Hours Played</option>
              <option value="name">Name (A-Z)</option>
              <option value="passive">Passive Income</option>
            </select>
          </div>
        </div>

        {/* Games Grid */}
        <GameGrid
          vaultGames={vaultGames}
          filter={filter}
          sortBy={sortBy}
          featuredGame={featuredGame}
          points={points}
          handleSelectFeatured={handleSelectFeatured}
          handleUnlock={handleUnlock}
          handlePlayLiberationKey={handlePlayLiberationKey}
        />
      </div>
    </main>
  );
}

// Separate component for virtualized grid
function GameGrid({
  vaultGames,
  filter,
  sortBy,
  featuredGame,
  points,
  handleSelectFeatured,
  handleUnlock,
  handlePlayLiberationKey,
}: {
  vaultGames: VaultGameState[];
  filter: 'all' | 'locked' | 'playable' | 'liberationKey';
  sortBy: 'default' | 'cost' | 'hours' | 'name' | 'passive';
  featuredGame: VaultGameState | null;
  points: number;
  handleSelectFeatured: (game: VaultGameState) => void;
  handleUnlock: (game: VaultGameState) => void;
  handlePlayLiberationKey: (game: VaultGameState) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_ROW = 6;

  // Filter and sort games
  const filteredGames = vaultGames
    .filter(game => filter === 'all' || game.state === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'cost':
          return a.unlockCost - b.unlockCost;
        case 'hours':
          return b.hoursPlayed - a.hoursPlayed;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'passive':
          return b.passiveRate - a.passiveRate;
        case 'default':
        default:
          if (a.state === 'playable' && b.state === 'playable') {
            return b.passiveRate - a.passiveRate;
          }
          return 0;
      }
    });

  // Calculate rows
  const rowCount = Math.ceil(filteredGames.length / ITEMS_PER_ROW);

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Estimated row height (card height + gap)
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  return (
    <div className="bg-vault-gray rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Your Library ({filteredGames.length} games)</h2>
      
      <div
        ref={parentRef}
        className="h-[700px] overflow-y-auto scrollbar-hide"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * ITEMS_PER_ROW;
            const rowGames = filteredGames.slice(startIndex, startIndex + ITEMS_PER_ROW);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 px-1">
                  {rowGames.map((game) => (
                    <GameCard
                      key={game.appid}
                      game={game}
                      isFeatured={featuredGame?.appid === game.appid}
                      canAfford={points >= game.unlockCost}
                      handleSelectFeatured={handleSelectFeatured}
                      handleUnlock={handleUnlock}
                      handlePlayLiberationKey={handlePlayLiberationKey}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Separate GameCard component
function GameCard({
  game,
  isFeatured,
  canAfford,
  handleSelectFeatured,
  handleUnlock,
  handlePlayLiberationKey,
}: {
  game: VaultGameState;
  isFeatured: boolean;
  canAfford: boolean;
  handleSelectFeatured: (game: VaultGameState) => void;
  handleUnlock: (game: VaultGameState) => void;
  handlePlayLiberationKey: (game: VaultGameState) => void;
}) {
  const isLocked = game.state === 'locked';
  const isPlayable = game.state === 'playable';
  const isKey = game.state === 'liberationKey';

  return (
    <div
      onClick={() => !isLocked && handleSelectFeatured(game)}
      className={`group relative rounded-lg overflow-hidden transition-all ${
        isLocked
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer hover:scale-105'
      } ${
        isFeatured
          ? 'ring-4 ring-vault-accent shadow-lg shadow-vault-accent/50'
          : isKey
          ? 'ring-2 ring-vault-gold shadow-lg shadow-vault-gold/30'
          : isPlayable
          ? 'ring-2 ring-green-500/30'
          : ''
      }`}
    >
      {/* Game Box Art */}
      <div className="relative aspect-[2/3] bg-gradient-to-br from-vault-dark to-vault-gray">
        <img
          src={getLibraryCapsule(game.appid)}
          alt={game.name}
          onError={handleImageError}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Overlay with state indicator */}
        <div className="absolute top-2 left-2">
          {isLocked && <span className="text-3xl drop-shadow-lg">🔒</span>}
          {isPlayable && !isFeatured && <span className="text-3xl drop-shadow-lg">✅</span>}
          {isPlayable && isFeatured && <span className="text-3xl drop-shadow-lg animate-pulse">⭐</span>}
          {isKey && <span className="text-3xl drop-shadow-lg animate-pulse">⭐</span>}
        </div>

        {/* Locked overlay bars */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-full space-y-2 px-2">
              <div className="h-2 bg-red-500/50 rounded"></div>
              <div className="h-2 bg-red-500/50 rounded"></div>
              <div className="h-2 bg-red-500/50 rounded"></div>
            </div>
          </div>
        )}

        {/* Hover overlay with info */}
        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
          <div>
            <div className="font-bold text-sm mb-1 line-clamp-2">{game.name}</div>
            <div className="text-xs text-gray-300">
              {game.hoursPlayed.toFixed(1)} hrs
            </div>
          </div>
          
          <div className="text-xs space-y-1">
            {isKey && (
              <div className="text-vault-gold font-semibold">
                Play 30 min to unlock FREE!
              </div>
            )}
            {isLocked && (
              <div className="text-red-400">
                Unlock: {game.unlockCost.toLocaleString()}pts
              </div>
            )}
            {isPlayable && (
              <div className="text-green-400">
                +{game.passiveRate}/sec
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isLocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnlock(game);
              }}
              disabled={!canAfford}
              className={`w-full py-1 px-2 rounded text-xs font-bold transition-all ${
                canAfford
                  ? 'bg-vault-accent text-vault-dark hover:bg-blue-400'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {canAfford ? '🔓 UNLOCK' : 'LOCKED'}
            </button>
          )}
          {isKey && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayLiberationKey(game);
              }}
              className="w-full bg-vault-gold text-vault-dark hover:bg-yellow-400 font-bold py-1 px-2 rounded text-xs transition-all"
            >
              🎮 PLAY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
