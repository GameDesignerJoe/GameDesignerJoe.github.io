import React from 'react';
import { SteamGame } from '@/types/steam';
import { ShopSlot } from '@/types/vault';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';
import { calculateUnlockCost } from '@/lib/game-utils';
import { canAffordDraw } from '@/lib/draw-manager';
import { getClickValue } from '@/lib/click-manager';

interface ShopSectionProps {
  shopSlots: ShopSlot[];
  games: SteamGame[];
  collectionPower: number;
  liberationKeys: number;
  onDrawSlot: (slotIndex: number) => void;
  onShopUnlock: (slot: ShopSlot, game: SteamGame) => void;
  onSwitchToKeyGames: () => void;
}

export default function ShopSection({
  shopSlots,
  games,
  collectionPower,
  liberationKeys,
  onDrawSlot,
  onShopUnlock,
  onSwitchToKeyGames
}: ShopSectionProps) {
  if (shopSlots.length === 0) return null;

  return (
    <div className="bg-vault-gray rounded-lg p-3 sm:p-6 mb-4 sm:mb-8 border border-vault-gold/30">
      <h2 className="text-lg sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-vault-gold">🛒 Shop - Unlock with Collection Power</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        {shopSlots.map((slot, index) => {
          if (slot.appId === null) {
            // Empty slot
            const canDraw = canAffordDraw(liberationKeys);
            return (
              <div
                key={index}
                onClick={() => {
                  if (canDraw) {
                    onDrawSlot(index);
                  } else {
                    onSwitchToKeyGames();
                  }
                }}
                className={`relative aspect-[2/3] bg-vault-dark rounded-lg border-2 border-dashed border-vault-gold/30 flex flex-col items-center justify-center p-4 transition-all ${
                  canDraw ? 'hover:border-vault-gold/60 cursor-pointer hover:scale-105 pulse-glow' : 'cursor-pointer hover:border-purple-500/60 opacity-50'
                }`}
              >
                <div className="text-6xl mb-2 animate-pulse">🔒</div>
                <div className="text-center text-sm text-vault-gold font-semibold">
                  {canDraw ? 'Spend 10 🔑 Keys to Draw' : 'Need 10 🔑 Keys'}
                </div>
              </div>
            );
          }
          
          // Find the game
          const game = games.find(g => g.appid === slot.appId);
          if (!game) return null;
          
          const unlockCost = calculateUnlockCost(game);
          const canAfford = collectionPower >= unlockCost;
          
          // Tier colors
          const tierColors = {
            cheap: 'border-gray-400',
            moderate: 'border-blue-500',
            epic: 'border-vault-gold',
          };
          const tierBorder = slot.tier ? tierColors[slot.tier] : 'border-gray-400';
          
          // Apply tier glow classes
          const tierGlow = slot.tier === 'cheap' ? 'tier-cheap' : 
                           slot.tier === 'moderate' ? 'tier-moderate' : 
                           slot.tier === 'epic' ? 'tier-epic' : '';
          
          return (
            <div
              key={index}
              className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 ${tierBorder} ${tierGlow} shadow-lg hover-lift cursor-pointer`}
            >
              <img
                src={getLibraryCapsule(game.appid)}
                alt={game.name}
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay with info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-3">
                <div className="text-white font-bold text-sm mb-1 line-clamp-2">{game.name}</div>
                <div className="text-xs text-gray-300 mb-2">
                  👆 +{getClickValue(game)} / ⏳ +{(getClickValue(game) * 0.1).toFixed(1)}
                </div>
                <button
                  onClick={() => onShopUnlock(slot, game)}
                  disabled={!canAfford}
                  className={`w-full py-2 px-3 rounded font-bold text-sm transition-all ${
                    canAfford
                      ? 'bg-vault-gold text-vault-dark hover:bg-yellow-400'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {canAfford ? `🔓 Unlock (${unlockCost.toLocaleString()})` : `🔒 Need ${unlockCost.toLocaleString()}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
