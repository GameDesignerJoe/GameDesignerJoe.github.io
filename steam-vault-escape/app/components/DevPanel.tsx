import React from 'react';
import { SteamGame } from '@/types/steam';
import { VaultState } from '@/types/vault';
import { getMaxPower } from '@/lib/click-manager';
import { autoRefreshAllDrained } from '@/lib/click-manager';

interface DevPanelProps {
  show: boolean;
  vaultState: VaultState | null;
  games: SteamGame[];
  onToggle: () => void;
  onChangeSteamId: () => void;
  onTestKeyDetection: () => void;
  onDrainAllGames: () => void;
  onResetAllDrained: () => void;
  onEmptyPool2: () => void;
  onEmptyPool3: () => void;
  onAddPower: () => void;
  onAddKeys: () => void;
  onNuclearReset: () => void;
  setVaultState: (state: VaultState) => void;
}

export default function DevPanel({ 
  show, 
  vaultState,
  games,
  onToggle, 
  onChangeSteamId, 
  onTestKeyDetection,
  onDrainAllGames,
  onResetAllDrained,
  onEmptyPool2,
  onEmptyPool3,
  onAddPower,
  onAddKeys,
  onNuclearReset,
  setVaultState
}: DevPanelProps) {
  return (
    <>
      {/* Dev Panel Button */}
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all z-40"
        title="Developer Tools"
      >
        ⚙️
      </button>

      {/* Dev Panel */}
      {show && (
        <div className="fixed bottom-20 right-4 bg-vault-dark border-2 border-vault-accent rounded-lg p-4 shadow-2xl z-40 w-80">
          <h3 className="text-lg font-bold text-vault-accent mb-3">Dev Tools</h3>
          <div className="space-y-2">
            <button 
              onClick={onChangeSteamId}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-semibold"
            >
              🆔 Change Steam ID
            </button>
            <button 
              onClick={onTestKeyDetection}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded font-semibold"
            >
              🧪 Test Key Detection
            </button>
            <button 
              onClick={onDrainAllGames}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2 rounded font-semibold"
            >
              ⚠️ Drain Every Game
            </button>
            <button 
              onClick={onResetAllDrained}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded font-semibold"
            >
              ♻️ Reset All Drained
            </button>
            <button 
              onClick={onEmptyPool2}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-semibold text-sm"
            >
              🗑️ Empty Pool 2
            </button>
            <button 
              onClick={onEmptyPool3}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded font-semibold text-sm"
            >
              🗑️ Empty Pool 3
            </button>
            <button 
              onClick={onAddPower}
              className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded font-semibold"
            >
              +1000 Power
            </button>
            <button 
              onClick={onAddKeys}
              className="w-full bg-vault-gold hover:bg-yellow-400 text-vault-dark py-2 rounded font-semibold"
            >
              +100 Keys
            </button>
            <button 
              onClick={onNuclearReset}
              className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold text-sm border-2 border-red-400"
            >
              🚨 NUCLEAR RESET 🚨
            </button>
          </div>
        </div>
      )}
    </>
  );
}
