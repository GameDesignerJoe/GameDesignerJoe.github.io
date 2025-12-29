'use client';

import { useEffect, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SteamGame } from '@/types/steam';
import { VaultGameState } from '@/types/vault';
import { getVaultController, toVaultGameState } from '@/lib/vault-logic';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';
import { loadFromStorage, saveToStorage } from '@/lib/storage';

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
  const [clickAnimations, setClickAnimations] = useState<Array<{ value: number; id: number; angle: number; distance: number; startX: number; startY: number }>>([]);
  const [passiveIncome, setPassiveIncome] = useState(0);
  const [passiveProgress, setPassiveProgress] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const steamId = process.env.NEXT_PUBLIC_STEAM_ID || '76561197970579347';

  // Load saved state on mount
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      setPoints(saved.points);
      setUnlockedGames(saved.unlockedGames);
      setLastRefresh(saved.lastRefresh);
      
      // Load cached library if available
      if (saved.cachedLibrary && saved.cachedLibrary.length > 0) {
        const vaultController = getVaultController();
        setGames([vaultController, ...saved.cachedLibrary]);
        setIsLoading(false);
        
        // Set featured game if saved
        if (saved.featuredGame) {
          // Find the game in loaded library
          const allGames = [vaultController, ...saved.cachedLibrary];
          const savedFeatured = allGames.find(g => String(g.appid) === String(saved.featuredGame));
          if (savedFeatured) {
            const featuredState = toVaultGameState(savedFeatured, saved.unlockedGames);
            setFeaturedGame(featuredState);
          }
        }
      } else {
        // No cached library, fetch fresh
        fetchLibrary();
      }
    } else {
      // No saved data, fetch library
      fetchLibrary();
    }
  }, []);

  // Save state whenever it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToStorage({
        points,
        unlockedGames,
        featuredGame: featuredGame?.appid || null,
        cachedLibrary: games.filter(g => String(g.appid) !== 'vault-controller'), // Don't cache fake game
        lastRefresh,
        version: '1.0'
      });
    }, 1000); // Save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [points, unlockedGames, featuredGame, games, lastRefresh]);

  // Auto-save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveToStorage({
        points,
        unlockedGames,
        featuredGame: featuredGame?.appid || null,
        cachedLibrary: games.filter(g => String(g.appid) !== 'vault-controller'),
        lastRefresh,
        version: '1.0'
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [points, unlockedGames, featuredGame, games, lastRefresh]);

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
    
    // Victory detection - check if all non-Liberation-Key games are unlocked
    if (vaultStates.length > 1 && !hasWon) {
      const lockedCount = vaultStates.filter(g => g.state === 'locked').length;
      if (lockedCount === 0) {
        setHasWon(true);
        setShowVictory(true);
      }
    }
  }, [games, unlockedGames, hasWon]);

  // Passive income timer - runs every 100ms for smooth updates
  useEffect(() => {
    if (!featuredGame || featuredGame.passiveRate <= 0) return;
    
    const interval = setInterval(() => {
      // Only add passive income if tab is focused
      if (document.hasFocus()) {
        // Add passive income (divided by 10 since we run 10 times per second)
        setPoints(prev => prev + (passiveIncome / 10));
        
        // Update progress bar for featured game
        setPassiveProgress(prev => {
          const newProgress = prev + (featuredGame.passiveRate / 10);
          
          // Check if progress bar is full
          if (newProgress >= 100) {
            // Award bonus points
            setPoints(p => p + 100);
            
            // Trigger burst animation
            setShowBurst(true);
            setTimeout(() => setShowBurst(false), 600);
            
            // Reset progress
            return 0;
          }
          
          return newProgress;
        });
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [passiveIncome, featuredGame]);

  // Handle clicking the featured game
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!featuredGame) return;
    
    const earnedPoints = featuredGame.clickValue;
    setPoints(prev => prev + earnedPoints);
    
    // Get button dimensions
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Choose a random edge (0=top, 1=right, 2=bottom, 3=left)
    const edge = Math.floor(Math.random() * 4);
    let startX, startY;
    
    switch(edge) {
      case 0: // top edge
        startX = Math.random() * rect.width;
        startY = 0;
        break;
      case 1: // right edge
        startX = rect.width;
        startY = Math.random() * rect.height;
        break;
      case 2: // bottom edge
        startX = Math.random() * rect.width;
        startY = rect.height;
        break;
      case 3: // left edge
      default:
        startX = 0;
        startY = Math.random() * rect.height;
        break;
    }
    
    // Calculate outward angle from edge
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const angleFromCenter = Math.atan2(startY - centerY, startX - centerX) * (180 / Math.PI);
    
    const randomDistance = 80 + Math.random() * 40; // 80-120px
    
    const animationId = Date.now() + Math.random(); // Unique ID
    
    setClickAnimations(prev => [...prev, { 
      value: earnedPoints, 
      id: animationId,
      angle: angleFromCenter,
      distance: randomDistance,
      startX,
      startY
    }]);
    
    // Remove this animation after it completes
    setTimeout(() => {
      setClickAnimations(prev => prev.filter(anim => anim.id !== animationId));
    }, 1200);
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
      setLastRefresh(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      // Fetch fresh library
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch library');
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const freshGames = data.games || [];
      
      // Detect newly unlocked Liberation Keys
      const oldGames = games.filter(g => String(g.appid) !== 'vault-controller');
      let bonusPoints = 0;
      let newlyUnlocked: string[] = [];
      
      freshGames.forEach((freshGame: SteamGame) => {
        const oldGame = oldGames.find(g => String(g.appid) === String(freshGame.appid));
        
        if (oldGame) {
          // Check if it crossed the 30-minute threshold
          const oldMinutes = oldGame.playtime_forever;
          const newMinutes = freshGame.playtime_forever;
          
          if (oldMinutes < 30 && newMinutes >= 30) {
            // Liberation Key unlocked!
            const bonus = 50 + (newMinutes * 0.5);
            bonusPoints += bonus;
            newlyUnlocked.push(freshGame.name);
            
            // Auto-unlock the game
            setUnlockedGames(prev => [...prev, freshGame.appid]);
          }
        }
      });
      
      // Update library
      const vaultController = getVaultController();
      const allGames = [vaultController, ...freshGames];
      setGames(allGames);
      setLastRefresh(Date.now());
      
      // Award bonus points
      if (bonusPoints > 0) {
        setPoints(prev => prev + bonusPoints);
        alert(`🎉 Liberation Key${newlyUnlocked.length > 1 ? 's' : ''} Unlocked!\n\n${newlyUnlocked.join('\n')}\n\n+${Math.floor(bonusPoints)} bonus points!`);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRefreshing(false);
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
              {/* Clickable Game Image */}
              <div className="relative mb-6">
                <button
                  onClick={handleClick}
                  className={`relative block transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-vault-accent rounded-lg overflow-hidden shadow-lg ${showBurst ? 'scale-110' : ''}`}
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
                  
                  {/* Passive Progress Bar */}
                  {featuredGame.passiveRate > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-3 bg-black/60">
                      <div 
                        className={`h-full bg-gradient-to-r from-vault-gold via-yellow-400 to-vault-gold transition-all duration-100 ${passiveProgress > 90 ? 'shadow-lg shadow-vault-gold/50 animate-pulse' : ''}`}
                        style={{ width: `${passiveProgress}%` }}
                      />
                    </div>
                  )}
                  
                  {/* Burst Effect */}
                  {showBurst && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-6xl font-bold text-vault-gold animate-ping">
                        +100
                      </div>
                    </div>
                  )}
                </button>
                {/* Render all click animations */}
                {clickAnimations.map(anim => (
                  <div 
                    key={anim.id}
                    className="absolute text-vault-gold font-bold pointer-events-none"
                    style={{
                      left: `${anim.startX}px`,
                      top: `${anim.startY}px`,
                      animation: 'floatOut 1.2s ease-out forwards',
                      '--float-angle': `${anim.angle}deg`,
                      '--float-distance': `${anim.distance}px`,
                    } as React.CSSProperties}
                  >
                    +{anim.value.toFixed(1)}
                  </div>
                ))}
              </div>
              
              {/* Game Details */}
              <div className="text-center">
                <div className="text-2xl font-bold text-vault-gold">
                  👆 +{featuredGame.clickValue} / ⏳ +{featuredGame.passiveRate}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <div className="bg-vault-gray rounded-lg p-6 mb-8 border border-vault-accent/20">
          <div className="flex justify-between items-start">
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
            <div className="text-right">
              <div className="text-xs text-gray-500">Last updated</div>
              <div className="text-sm text-gray-400">
                {new Date(lastRefresh).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Sort Controls */}
        <div className="flex gap-4 mb-4 items-center flex-wrap justify-between">
          {/* Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
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

          {/* Sort Dropdown & Refresh Button */}
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
            
            {/* Refresh Library Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-4 py-2 rounded font-semibold transition-all flex items-center gap-2 ${
                isRefreshing
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-vault-accent text-vault-dark hover:bg-blue-400'
              }`}
              title="Check for Liberation Keys you've unlocked by playing"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              {isRefreshing ? 'Refreshing...' : 'Refresh Library'}
            </button>
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

        {/* Victory Screen Modal */}
        {showVictory && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-vault-blue to-vault-dark rounded-xl p-8 max-w-2xl w-full border-4 border-vault-gold shadow-2xl animate-scale-up">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-5xl font-bold text-vault-gold mb-2">VICTORY!</h2>
                <p className="text-2xl text-vault-accent">All Games Unlocked!</p>
              </div>
              <div className="bg-vault-dark/50 rounded-lg p-6 mb-6 space-y-3">
                <div className="flex justify-between"><span className="text-gray-400">Total Games:</span><span className="font-bold text-vault-accent">{vaultGames.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Total Points:</span><span className="font-bold text-vault-gold">{Math.floor(points).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Passive Rate:</span><span className="font-bold text-green-400">+{passiveIncome}/sec</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Liberation Keys:</span><span className="font-bold text-vault-gold">{vaultGames.filter(g => g.state === 'liberationKey').length}</span></div>
              </div>
              <button onClick={() => setShowVictory(false)} className="w-full bg-vault-gold text-vault-dark font-bold py-4 rounded-lg text-xl hover:bg-yellow-400 transition-colors">
                CONTINUE PLAYING
              </button>
            </div>
          </div>
        )}

        {/* Dev Panel Button */}
        <button
          onClick={() => setShowDevPanel(!showDevPanel)}
          className="fixed bottom-4 right-4 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all z-40"
          title="Developer Tools"
        >
          ⚙️
        </button>

        {/* Dev Panel */}
        {showDevPanel && (
          <div className="fixed bottom-20 right-4 bg-vault-dark border-2 border-vault-accent rounded-lg p-4 shadow-2xl z-40 w-80">
            <h3 className="text-lg font-bold text-vault-accent mb-3">Dev Tools</h3>
            <div className="space-y-2">
              <button onClick={() => setPoints(p => p + 1000)} className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded font-semibold">+1000 Points</button>
              <button onClick={() => setPoints(p => p + 10000)} className="w-full bg-green-700 hover:bg-green-600 text-white py-2 rounded font-semibold">+10000 Points</button>
              <button onClick={() => setUnlockedGames(vaultGames.filter(g => g.unlockCost < 100).map(g => g.appid))} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-semibold">Unlock Cheap Games</button>
              <button onClick={() => setUnlockedGames(vaultGames.map(g => g.appid))} className="w-full bg-blue-700 hover:bg-blue-600 text-white py-2 rounded font-semibold">Unlock All Games</button>
              <button onClick={() => setShowVictory(true)} className="w-full bg-vault-gold hover:bg-yellow-400 text-vault-dark py-2 rounded font-semibold">Show Victory</button>
              <button onClick={() => {if(confirm('Reset all progress?')){setPoints(0);setUnlockedGames(['vault-controller']);setHasWon(false);localStorage.clear();}}} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded font-semibold">Reset Progress</button>
            </div>
          </div>
        )}
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
    estimateSize: () => 310, // Estimated row height (card height + gap) - middle ground for 2:3 aspect ratio
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  return (
    <div className="bg-vault-gray rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Your Library ({filteredGames.length} games)</h2>
      
      <div
        ref={parentRef}
        className="h-[700px] overflow-y-auto scrollbar-hide relative"
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
        
        {/* State indicator overlay */}
        {isLocked ? (
          // Centered lock for locked games
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl drop-shadow-2xl">🔒</span>
          </div>
        ) : (
          // Top-left indicator for other states
          <div className="absolute top-2 left-2">
            {isPlayable && !isFeatured && <span className="text-3xl drop-shadow-lg">✅</span>}
            {isPlayable && isFeatured && <span className="text-3xl drop-shadow-lg animate-pulse">⭐</span>}
            {isKey && <span className="text-3xl drop-shadow-lg animate-pulse">⭐</span>}
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
