import React from 'react';
import { SteamGame } from '@/types/steam';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';
import { calculateUnlockCost } from '@/lib/game-utils';

interface DrawModalProps {
  show: boolean;
  drawnGame: SteamGame | null;
  revealedCard: boolean;
  liberationKeys: number;
  onCardReveal: () => void;
  onAcceptDraw: () => void;
  onRedraw: () => void;
}

export default function DrawModal({ 
  show, 
  drawnGame, 
  revealedCard, 
  liberationKeys,
  onCardReveal, 
  onAcceptDraw, 
  onRedraw 
}: DrawModalProps) {
  if (!show || !drawnGame) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-vault-blue to-vault-dark rounded-xl p-8 max-w-4xl w-full border-4 border-vault-gold shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold text-vault-gold mb-2">🎰 Draw a Game</h2>
          <p className="text-gray-300">Click a card to reveal your game!</p>
        </div>

        {/* Card Backs or Revealed Game */}
        {!revealedCard ? (
          <div className="grid grid-cols-3 gap-6 mb-6">
            {[0, 1, 2].map((cardIndex) => (
              <div
                key={cardIndex}
                onClick={onCardReveal}
                className="relative aspect-[2/3] bg-gradient-to-br from-vault-gold via-yellow-600 to-vault-gold rounded-lg border-4 border-yellow-400 cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl hover:shadow-vault-gold/50 flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="text-6xl mb-2">🃏</div>
                  <div className="text-vault-dark font-bold text-lg">CLICK ME</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-6">
            <div className="max-w-md mx-auto flip-card">
              <div className={`relative aspect-[2/3] rounded-lg overflow-hidden border-4 ${
                (() => {
                  const unlockCost = calculateUnlockCost(drawnGame);
                  const tier = unlockCost < 1000 ? 'cheap' : unlockCost < 3000 ? 'moderate' : 'epic';
                  return tier === 'cheap' ? 'border-gray-400' : tier === 'moderate' ? 'border-blue-500' : 'border-vault-gold';
                })()
              } shadow-2xl`}>
                <img
                  src={getLibraryCapsule(drawnGame.appid)}
                  alt={drawnGame.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
                {/* Game info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4">
                  <div className="text-white font-bold text-xl mb-2">{drawnGame.name}</div>
                  <div className="text-sm text-gray-300 mb-2">
                    {drawnGame.metacritic ? `⭐ ${drawnGame.metacritic}` : '⭐ ??'} • 
                    {drawnGame.hoursTobeat ? ` ${drawnGame.hoursTobeat}h` : ' ??h'}
                  </div>
                  <div className="text-vault-gold font-bold">
                    Unlock Cost: {drawnGame.metacritic && drawnGame.hoursTobeat 
                      ? Math.floor(drawnGame.metacritic * drawnGame.hoursTobeat).toLocaleString()
                      : '???'} ⚡
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-6 justify-center">
              <button
                onClick={onAcceptDraw}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-lg transition-all transform hover:scale-105"
              >
                ✅ Accept
              </button>
              <button
                onClick={onRedraw}
                disabled={liberationKeys < 5}
                className={`px-8 py-4 font-bold text-lg rounded-lg transition-all transform hover:scale-105 ${
                  liberationKeys >= 5
                    ? 'bg-vault-gold text-vault-dark hover:bg-yellow-400'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🔄 Redraw (5 🔑)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
