import React from 'react';
import { SteamGame } from '@/types/steam';
import { VaultGameState, VaultState } from '@/types/vault';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';
import { getClickValue, getMaxPower, calculateRefreshCost } from '@/lib/click-manager';
import { toVaultGameState } from '@/lib/vault-logic';

interface GameLibraryProps {
  vaultState: VaultState | null;
  games: SteamGame[];
  libraryTab: 'unlocked' | 'keyGames';
  collectionPower: number;
  liberationKeys: number;
  featuredGame: VaultGameState | null;
  onTabChange: (tab: 'unlocked' | 'keyGames') => void;
  onSelectGame: (game: VaultGameState) => void;
  onRefreshGame: (gameId: number, cost: number) => void;
  onSwitchToKeyGames: () => void;
  setLiberationKeys: (value: number | ((prev: number) => number)) => void;
}

export default function GameLibrary({
  vaultState,
  games,
  libraryTab,
  collectionPower,
  liberationKeys,
  featuredGame,
  onTabChange,
  onSelectGame,
  onRefreshGame,
  onSwitchToKeyGames,
  setLiberationKeys
}: GameLibraryProps) {
  if (!vaultState) return null;

  return (
    <div className="bg-vault-gray rounded-lg p-6 mb-8 border border-green-500/30">
      {/* Section Toggle Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => onTabChange('unlocked')}
          className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
            libraryTab === 'unlocked'
              ? 'bg-green-600 text-white shadow-lg shadow-green-500/50 scale-105'
              : 'bg-vault-dark text-gray-400 hover:bg-gray-700 hover:scale-102'
          }`}
        >
          🎮 Game Library
        </button>
        <button
          onClick={() => onTabChange('keyGames')}
          className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
            libraryTab === 'keyGames'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 scale-105'
              : 'bg-vault-dark text-gray-400 hover:bg-gray-700 hover:scale-102'
          }`}
        >
          ⭐ Key Games
        </button>
      </div>

      {/* Game Library Tab Content */}
      {libraryTab === 'unlocked' && vaultState.pool1_unlocked && vaultState.pool1_unlocked.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-green-400">🎮 Game Library</h2>
            <div className="text-right">
              <div className="text-sm text-gray-400">⚡ Collection Power</div>
              <div className="text-3xl font-bold text-green-400">{collectionPower.toLocaleString()}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {vaultState.pool1_unlocked
              .map(appId => games.find(g => g.appid === appId))
              .filter((game): game is SteamGame => game !== undefined)
              .sort((a, b) => {
                // Sort by click value (highest first)
                const aClickValue = getClickValue(a);
                const bClickValue = getClickValue(b);
                return bClickValue - aClickValue;
              })
              .map(game => {
                const appId = game.appid;
                const progress = vaultState.gameProgress?.[appId];
                const clickValue = getClickValue(game);
                const maxPower = getMaxPower(game);
                const currentPower = progress?.currentPower || 0;
                const remainingPower = maxPower - currentPower;
                const isDrained = remainingPower < clickValue;
                const refreshCost = calculateRefreshCost(game);
                const progressPercent = maxPower > 0 ? (remainingPower / maxPower) * 100 : 100;
                
                return (
                  <div
                    key={appId}
                    className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 ${
                      featuredGame?.appid === appId ? 'border-vault-accent ring-4 ring-vault-accent' : 'border-green-500'
                    } shadow-lg transition-all hover:scale-105 cursor-pointer`}
                    onClick={() => {
                      if (isDrained) {
                        onSwitchToKeyGames();
                        return;
                      }
                      
                      const vaultGameState = toVaultGameState(game, vaultState.pool1_unlocked || []);
                      onSelectGame(vaultGameState);
                    }}
                  >
                    <img
                      src={getLibraryCapsule(game.appid)}
                      alt={game.name}
                      onError={handleImageError}
                      className={`w-full h-full object-cover ${isDrained ? 'grayscale' : ''}`}
                    />
                    
                    {/* Drained overlay */}
                    {isDrained && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-3">
                        <div className="text-4xl mb-2">⚠️</div>
                        <div className="text-white font-bold text-sm mb-2">DRAINED</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (liberationKeys < refreshCost) return;
                            
                            setLiberationKeys(prev => prev - refreshCost);
                            onRefreshGame(appId, refreshCost);
                          }}
                          disabled={liberationKeys < refreshCost}
                          className={`px-3 py-1 rounded font-bold text-xs ${
                            liberationKeys >= refreshCost
                              ? 'bg-vault-gold text-vault-dark hover:bg-yellow-400'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Refresh for {refreshCost} 🔑
                        </button>
                      </div>
                    )}
                    
                    {/* Info overlay */}
                    {!isDrained && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-3">
                        <div className="text-white font-bold text-xs mb-1 line-clamp-2">{game.name}</div>
                        <div className="text-xs text-green-400 mb-2">+{clickValue} power per click</div>
                        
                        {/* Progress bar with countdown number */}
                        <div className="relative w-full bg-gray-700 rounded-full h-3 mb-1">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              progressPercent < 20 ? 'bg-red-500' : progressPercent < 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-bold text-xs drop-shadow-lg">
                              {remainingPower.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* Key Games Tab Content - Empty State */}
      {libraryTab === 'keyGames' && vaultState.pool3_keyGames && vaultState.pool3_keyGames.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-center max-w-2xl">
            <div className="text-8xl mb-6">🎉</div>
            <h2 className="text-5xl font-bold text-purple-500 mb-4">Congratulations!</h2>
            <p className="text-2xl text-white mb-6">
              You've played all your Steam games.
            </p>
            <p className="text-xl text-purple-400 mb-4">
              You are in the top <span className="font-bold text-vault-gold">0.00001%</span> of Steam players who have done that.
            </p>
            <p className="text-lg text-gray-400 italic">
              We did the math.*
            </p>
            <div className="mt-8 text-xs text-gray-500">
              *Actual percentage may vary based on library size and definition of "played"
            </div>
          </div>
        </div>
      )}

      {/* Key Games Tab Content - With Games */}
      {libraryTab === 'keyGames' && vaultState.pool3_keyGames && vaultState.pool3_keyGames.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-3xl font-bold text-purple-500">⭐ Key Games - Play to Earn Keys</h2>
              <p className="text-gray-400 text-sm mt-1">Click any game to launch it in Steam. Play 30+ minutes to earn keys!</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Never-Played Games</div>
              <div className="text-3xl font-bold text-purple-500">{vaultState.pool3_keyGames.length}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {vaultState.pool3_keyGames
              .map(appId => games.find(g => g.appid === appId))
              .filter((game): game is SteamGame => game !== undefined)
              .sort((a, b) => {
                // Sort by Metacritic score (highest first), then alphabetically
                const aScore = a.metacritic || 0;
                const bScore = b.metacritic || 0;
                if (aScore !== bScore) return bScore - aScore;
                return a.name.localeCompare(b.name);
              })
              .map(game => {
                const keyValue = game.metacritic || 70;
                
                return (
                  <div
                    key={game.appid}
                    onClick={() => {
                      window.open(`steam://store/${game.appid}`, '_blank');
                      console.log(`[Key Game] Launching ${game.name} in Steam`);
                    }}
                    className="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-purple-500 shadow-lg transition-all hover:scale-105 hover:shadow-purple-500/50 cursor-pointer"
                  >
                    <img
                      src={getLibraryCapsule(game.appid)}
                      alt={game.name}
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Info overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-3">
                      <div className="text-white font-bold text-sm mb-2 line-clamp-2">{game.name}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-purple-400 font-bold text-lg">
                          🔑 {keyValue} Keys
                        </div>
                        <div className="text-xs text-gray-300">
                          Play to Earn
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
