import React from 'react';

interface CelebrationData {
  games: Array<{ name: string; keys: number }>;
  totalKeys: number;
}

interface CelebrationModalProps {
  show: boolean;
  celebrationData: CelebrationData | null;
  onClose: () => void;
}

export default function CelebrationModal({ show, celebrationData, onClose }: CelebrationModalProps) {
  if (!show || !celebrationData) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-purple-900 via-vault-blue to-purple-900 rounded-xl p-8 max-w-2xl w-full border-4 border-vault-gold shadow-2xl animate-scale-up">
        {/* Celebration Header */}
        <div className="text-center mb-6">
          <div className="text-8xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-5xl font-bold text-vault-gold mb-2 animate-pulse">
            KEY GAME{celebrationData.games.length > 1 ? 'S' : ''} COMPLETED!
          </h2>
          <p className="text-2xl text-green-400 font-bold">
            +{celebrationData.totalKeys} 🔑 Keys Earned!
          </p>
        </div>

        {/* Games List */}
        <div className="bg-vault-dark/70 rounded-lg p-6 mb-6 max-h-60 overflow-y-auto">
          <div className="space-y-3">
            {celebrationData.games.map((game, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-vault-blue/30 rounded-lg border-2 border-purple-500/50 hover:border-purple-500 transition-all"
              >
                <span className="text-white font-bold text-lg">{game.name}</span>
                <span className="text-vault-gold font-bold text-xl">+{game.keys} 🔑</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bonus Message */}
        <div className="bg-green-600/20 border-2 border-green-500 rounded-lg p-4 mb-6 text-center">
          <div className="text-green-400 font-bold text-lg mb-1">✅ BONUS REWARD!</div>
          <div className="text-white">All drained games have been refreshed for FREE!</div>
        </div>

        {/* Continue Button */}
        <button 
          onClick={onClose}
          className="w-full bg-gradient-to-r from-vault-gold via-yellow-400 to-vault-gold text-vault-dark font-bold py-4 rounded-lg text-xl hover:scale-105 transition-transform shadow-lg shadow-vault-gold/50"
        >
          🎮 CONTINUE PLAYING
        </button>
      </div>
    </div>
  );
}
