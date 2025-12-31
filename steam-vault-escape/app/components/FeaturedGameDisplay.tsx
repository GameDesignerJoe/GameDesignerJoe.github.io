import React from 'react';
import { SteamGame } from '@/types/steam';
import { VaultGameState, VaultState } from '@/types/vault';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';
import { getClickValue, getMaxPower, calculateRefreshCost } from '@/lib/click-manager';

interface FeaturedGameDisplayProps {
  featuredGame: VaultGameState | null;
  vaultState: VaultState | null;
  games: SteamGame[];
  collectionPower: number;
  liberationKeys: number;
  showBurst: boolean;
  clickAnimations: Array<{ value: number; id: number; angle: number; distance: number; startX: number; startY: number }>;
  onGameClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRefresh: (gameId: number, cost: number) => void;
  onSwitchToKeyGames: () => void;
}

export default function FeaturedGameDisplay({
  featuredGame,
  vaultState,
  games,
  collectionPower,
  liberationKeys,
  showBurst,
  clickAnimations,
  onGameClick,
  onRefresh,
  onSwitchToKeyGames,
}: FeaturedGameDisplayProps) {
  if (!featuredGame || !vaultState) return null;

  const game = games.find(g => g.appid === featuredGame.appid);
  if (!game) return null;

  const appId = Number(featuredGame.appid);
  const progress = vaultState.gameProgress?.[appId];
  const clickValue = getClickValue(game);
  const maxPower = getMaxPower(game);
  const currentPower = progress?.currentPower || 0;
  const remainingPower = maxPower - currentPower;
  const isDrained = remainingPower < clickValue;
  const progressPercent = maxPower > 0 ? (remainingPower / maxPower) * 100 : 100;
  const refreshCost = calculateRefreshCost(game);

  return (
    <div className="flex flex-col items-center mb-8">
      {/* Clickable Game Image with Collection Power on sides */}
      <div className="relative mb-6 flex items-center gap-6">
        {/* Collection Power - Left Side */}
        <div className="flex items-center gap-2">
          <span className="text-4xl">⚡</span>
          <div className="text-4xl font-bold text-green-400">
            {collectionPower.toLocaleString()}
          </div>
        </div>

        {/* Game Card Container */}
        <div className="relative" style={{ width: '300px', height: '450px' }}>
          {/* Main Game Card - clickable */}
          <div
            onClick={(e) => {
              if (isDrained) return;
              onGameClick(e as any);
            }}
            className={`relative block transition-all hover:scale-105 active:scale-95 ${
              isDrained ? 'cursor-default' : 'cursor-pointer'
            } rounded-lg overflow-hidden shadow-lg ${showBurst ? 'scale-110' : ''}`}
            style={{ width: '300px', height: '450px' }}
          >
            <img
              src={getLibraryCapsule(featuredGame.appid)}
              alt={featuredGame.name}
              onError={handleImageError}
              className={`w-full h-full object-cover ${isDrained ? 'grayscale' : ''}`}
            />

            {/* Drained overlay - show when game is drained */}
            {isDrained && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-6xl mb-4">⚠️</div>
                <div className="text-white text-4xl font-bold drop-shadow-lg mb-2">DRAINED</div>
                <div className="text-gray-300 text-lg">Game needs to recharge</div>
              </div>
            )}
            
            {/* Hover overlay - only show for non-drained games */}
            {!isDrained && (
              <div className="absolute inset-0 bg-vault-accent/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="text-white text-2xl font-bold drop-shadow-lg">CLICK TO PLAY</span>
              </div>
            )}
            
            {/* Power Bar - Always Visible (with refresh button when drained) */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-4 py-3 pointer-events-none">
              {/* Progress Bar */}
              <div className="relative w-full bg-gray-700 rounded-full h-4 mb-1">
                <div 
                  className={`h-full rounded-full transition-all ${
                    progressPercent < 20 ? 'bg-red-500' : progressPercent < 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
                {/* Countdown number centered in bar */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-sm drop-shadow-lg">
                    {remainingPower.toLocaleString()}
                  </span>
                </div>
              </div>
              
              {/* Refresh Button - Positioned right below progress bar when drained */}
              {isDrained && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // If not enough keys, switch to Key Games tab
                    if (liberationKeys < refreshCost) {
                      onSwitchToKeyGames();
                      return;
                    }
                    
                    onRefresh(appId, refreshCost);
                  }}
                  className={`w-full mt-2 py-2 rounded-lg font-bold text-sm transition-all pointer-events-auto ${
                    liberationKeys >= refreshCost
                      ? 'bg-gradient-to-br from-yellow-300 via-vault-gold to-yellow-600 text-vault-dark shadow-lg shadow-vault-gold/50 animate-pulse hover:shadow-vault-gold/80 hover:scale-105'
                      : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                  }`}
                >
                  {liberationKeys >= refreshCost ? `🔑 Refresh (${refreshCost} Keys)` : `Need ${refreshCost} 🔑 Keys`}
                </button>
              )}
            </div>
            
            {/* Burst Effect */}
            {showBurst && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-6xl font-bold text-vault-gold animate-ping">
                  +100
                </div>
              </div>
            )}
          </div>
          
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

        {/* Liberation Keys - Right Side */}
        <div className="flex items-center gap-2">
          <div className="text-4xl font-bold text-vault-gold">
            {liberationKeys}
          </div>
          <span className="text-4xl">🔑</span>
        </div>
      </div>
      
      {/* Game Details */}
      <div className="text-center">
        <div className="text-2xl font-bold text-vault-gold">
          {(() => {
            const clickVal = getClickValue(game);
            const passiveVal = (clickVal * 0.1).toFixed(1);
            return `👆 +${clickVal} / ⏳ +${passiveVal}`;
          })()}
        </div>
      </div>
    </div>
  );
}
