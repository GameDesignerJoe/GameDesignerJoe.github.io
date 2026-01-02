import { useEffect } from 'react';
import { SteamGame } from '@/types/steam';
import { VaultGameState, VaultState } from '@/types/vault';
import { saveToStorage } from '@/lib/storage';

export function useAutoSave(
  vaultState: VaultState | null,
  points: number,
  unlockedGames: Array<number | string>,
  featuredGame: VaultGameState | null,
  games: SteamGame[],
  lastRefresh: number
) {
  // Debounced auto-save whenever state changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (vaultState && vaultState.version === '1.5') {
        saveToStorage({
          ...vaultState,
          points,
          unlockedGames,
          featuredGame: featuredGame?.appid || null,
          cachedLibrary: games.filter(g => String(g.appid) !== 'vault-controller'),
          lastRefresh,
        });
      } else {
        // Fall back to v1.0 format
        saveToStorage({
          points,
          unlockedGames,
          featuredGame: featuredGame?.appid || null,
          cachedLibrary: games.filter(g => String(g.appid) !== 'vault-controller'),
          lastRefresh,
          version: '1.0'
        });
      }
    }, 1000); // Save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [points, unlockedGames, featuredGame, games, lastRefresh, vaultState]);

  // Auto-save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (vaultState && vaultState.version === '1.5') {
        saveToStorage({
          ...vaultState,
          points,
          unlockedGames,
          featuredGame: featuredGame?.appid || null,
          cachedLibrary: games.filter(g => String(g.appid) !== 'vault-controller'),
          lastRefresh,
        });
      } else {
        saveToStorage({
          points,
          unlockedGames,
          featuredGame: featuredGame?.appid || null,
          cachedLibrary: games.filter(g => String(g.appid) !== 'vault-controller'),
          lastRefresh,
          version: '1.0'
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [points, unlockedGames, featuredGame, games, lastRefresh, vaultState]);
}
