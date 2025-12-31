import React from 'react';

interface SteamIdInputProps {
  show: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

export default function SteamIdInput({ show, inputValue, onInputChange, onSubmit }: SteamIdInputProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-vault-blue to-vault-dark rounded-xl p-8 max-w-md w-full border-4 border-vault-gold shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-vault-gold mb-2">🎮 Welcome!</h2>
          <p className="text-gray-300">Enter your Steam ID to get started</p>
        </div>
        
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="76561197970579347"
          className="w-full px-4 py-3 bg-vault-dark border-2 border-vault-gold/50 rounded-lg text-white text-center text-lg mb-4 focus:outline-none focus:border-vault-gold"
        />
        
        <button
          onClick={onSubmit}
          disabled={!inputValue.trim()}
          className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
            inputValue.trim()
              ? 'bg-vault-gold text-vault-dark hover:bg-yellow-400 cursor-pointer'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Start Playing
        </button>
        
        <p className="text-xs text-gray-400 text-center mt-4">
          Don't know your Steam ID? Find it on your Steam profile URL
        </p>
      </div>
    </div>
  );
}
