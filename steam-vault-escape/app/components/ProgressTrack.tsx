// Progress Track Component - Shows unlocked games and next reward

import { SteamGame } from '@/types/steam';
import { ProgressReward, UnlockedGame, getTierBorderColor } from '@/types/progress';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';

interface ProgressTrackProps {
  nextReward: ProgressReward;
  unlockedGames: UnlockedGame[];
  games: SteamGame[];
  totalGamesInLibrary: number;
}

export default function ProgressTrack({
  nextReward,
  unlockedGames,
  games,
  totalGamesInLibrary,
}: ProgressTrackProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <div>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-vault-gold flex items-center gap-2">
            🏆 Progress Track - Unlock Games to Progress
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Goal: Unlock all of the games in your Steam Library.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs sm:text-sm text-gray-400">Games Unlocked</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-vault-gold">
            {unlockedGames.length} of {totalGamesInLibrary}
          </div>
        </div>
      </div>

      {/* Progress Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Reward Cell - Always First */}
        <RewardCell reward={nextReward} />

        {/* Unlocked Games (Newest First) */}
        {unlockedGames.map((unlockedGame) => {
          const game = games.find(g => g.appid === unlockedGame.appId);
          if (!game) return null;

          return (
            <GameCard
              key={unlockedGame.appId}
              game={game}
              tier={unlockedGame.tier}
            />
          );
        })}
      </div>
    </div>
  );
}

// Reward Cell Component
function RewardCell({ reward }: { reward: ProgressReward }) {
  return (
    <div className="relative aspect-[2/3] rounded-lg overflow-hidden border-4 border-vault-gold bg-gradient-to-br from-vault-blue/30 via-vault-dark to-black shadow-lg shadow-vault-gold/30">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        <div className="text-sm text-gray-300 mb-2 leading-tight">
          Unlock Your Next Game To Earn This Reward
        </div>
        <div className="text-6xl mb-3">{reward.icon}</div>
        <div className="text-3xl font-bold text-vault-gold mb-1">
          {reward.amount.toLocaleString()}
        </div>
        <div className="text-sm text-gray-300">{reward.label}</div>
      </div>
    </div>
  );
}

// Game Card Component
function GameCard({ game, tier }: { game: SteamGame; tier: 'cheap' | 'moderate' | 'epic' }) {
  const borderColor = getTierBorderColor(tier);

  return (
    <div
      className={`relative aspect-[2/3] rounded-lg overflow-hidden border-4 ${borderColor} shadow-lg transition-all hover:scale-105 cursor-pointer`}
      onClick={() => {
        // Open Steam to this game
        window.open(`steam://store/${game.appid}`, '_blank');
      }}
    >
      <img
        src={getLibraryCapsule(game.appid)}
        alt={game.name}
        onError={handleImageError}
        className="w-full h-full object-cover"
      />
      
      {/* Game info overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
        <div className="text-white font-bold text-sm mb-1 line-clamp-2">{game.name}</div>
        <div className="text-xs text-gray-300">
          {game.playtime_forever ? `${Math.floor(game.playtime_forever / 60)}h played` : 'Not played'}
        </div>
      </div>
    </div>
  );
}
