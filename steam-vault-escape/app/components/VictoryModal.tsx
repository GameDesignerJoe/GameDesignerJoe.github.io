import React from 'react';
import { VaultGameState } from '@/types/vault';

interface VictoryModalProps {
  show: boolean;
  vaultGames: VaultGameState[];
  points: number;
  passiveIncome: number;
  onClose: () => void;
}

export default function VictoryModal({ show, vaultGames, points, passiveIncome, onClose }: VictoryModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-vault-blue to-vault-dark rounded-xl p-8 max-w-2xl w-full border-4 border-vault-gold shadow-2xl animate-scale-up">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-5xl font-bold text-vault-gold mb-2">VICTORY!</h2>
          <p className="text-2xl text-vault-accent">All Games Unlocked!</p>
        </div>
        <div className="bg-vault-dark/50 rounded-lg p-6 mb-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Games:</span>
            <span className="font-bold text-vault-accent">{vaultGames.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Points:</span>
            <span className="font-bold text-vault-gold">{Math.floor(points).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Passive Rate:</span>
            <span className="font-bold text-green-400">+{passiveIncome}/sec</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Keys Earned:</span>
            <span className="font-bold text-vault-gold">
              {vaultGames.filter(g => g.state === 'liberationKey').length}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-full bg-vault-gold text-vault-dark font-bold py-4 rounded-lg text-xl hover:bg-yellow-400 transition-colors"
        >
          CONTINUE PLAYING
        </button>
      </div>
    </div>
  );
}
