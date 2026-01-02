import { useEffect } from 'react';
import { SteamGame } from '@/types/steam';
import { VaultGameState, VaultState, ShopSlot } from '@/types/vault';
import { retryMultipleImages, getImageStats } from '@/lib/image-retry-manager';

export function useImageRetry(
  vaultState: VaultState | null,
  games: SteamGame[],
  featuredGame: VaultGameState | null,
  shopSlots: ShopSlot[],
  setLastRefresh: (time: number) => void
) {
  useEffect(() => {
    if (!vaultState || games.length === 0) return;
    
    // Small delay to let images attempt initial load first
    const retryTimer = setTimeout(async () => {
      const failedCount = getImageStats().failed;
      if (failedCount === 0) return; // No failures to retry
      
      console.log(`[Image Retry] Session start - found ${failedCount} failed images`);
      
      // Collect important game IDs to retry
      const gamesToRetry: number[] = [];
      
      // 1. Featured game
      if (featuredGame && typeof featuredGame.appid === 'number') {
        gamesToRetry.push(featuredGame.appid);
      }
      
      // 2. Shop slot games
      shopSlots.forEach(slot => {
        if (slot.appId && typeof slot.appId === 'number') {
          gamesToRetry.push(slot.appId);
        }
      });
      
      // 3. Pool 1 unlocked games (limit to first 20 to avoid overwhelming)
      const pool1Games = (vaultState.pool1_unlocked || [])
        .filter((id): id is number => typeof id === 'number')
        .slice(0, 20);
      gamesToRetry.push(...pool1Games);
      
      // Retry all collected games
      if (gamesToRetry.length > 0) {
        const succeeded = await retryMultipleImages(gamesToRetry);
        if (succeeded.length > 0) {
          console.log(`[Image Retry] Session start recovered ${succeeded.length} images!`);
          // Force a small re-render to update images
          setLastRefresh(Date.now());
        }
      }
    }, 2000); // Wait 2 seconds after page load
    
    return () => clearTimeout(retryTimer);
  }, [vaultState, games.length, featuredGame, shopSlots, setLastRefresh]); // Only run once when vault state is ready
}
