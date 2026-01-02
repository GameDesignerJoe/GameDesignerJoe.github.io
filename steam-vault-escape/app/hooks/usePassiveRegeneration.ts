import { useEffect } from 'react';
import { SteamGame } from '@/types/steam';
import { VaultState } from '@/types/vault';
import { getMaxPower } from '@/lib/click-manager';
import { THRESHOLDS } from '@/lib/constants';

export function usePassiveRegeneration(
  vaultState: VaultState | null,
  games: SteamGame[],
  setVaultState: (state: VaultState) => void
) {
  useEffect(() => {
    if (!vaultState || !vaultState.gameProgress) return;
    
    const interval = setInterval(() => {
      // Only regenerate if tab is focused
      if (!document.hasFocus()) return;
      
      let hasChanges = false;
      const updatedProgress = { ...vaultState.gameProgress };
      
      // Check each game in Pool 1 for passive regeneration
      vaultState.pool1_unlocked?.forEach(appId => {
        const progress = updatedProgress[appId];
        if (!progress) return;
        
        // NEW RULE: Only regen if game is DRAINED
        if (!progress.isDrained) return;
        
        const game = games.find(g => g.appid === appId);
        if (!game) return;
        
        const maxPower = getMaxPower(game);
        
        // Passive regen rate: % of max power per second (from config)
        const regenRatePercent = THRESHOLDS.PASSIVE_REGEN_RATE_PERCENT / 100;
        const regenRate = maxPower * regenRatePercent;
        
        // Reduce currentPower (remember: higher = more drained, 0 = full health)
        const newCurrentPower = Math.max(0, progress.currentPower - regenRate);
        
        // Check if FULLY recharged (must be 100% to unmark as drained)
        const isFullyRecharged = newCurrentPower === 0;
        
        if (newCurrentPower !== progress.currentPower) {
          updatedProgress[appId] = {
            ...progress,
            currentPower: newCurrentPower,
            isDrained: !isFullyRecharged,
            drainedAt: isFullyRecharged ? undefined : progress.drainedAt,
          };
          hasChanges = true;
          
          // Log when game is fully recharged
          if (isFullyRecharged) {
            console.log(`[Passive Regen] ${game.name} is fully recharged and ready to play!`);
          }
        }
      });
      
      // Update state if any changes
      if (hasChanges) {
        setVaultState({
          ...vaultState,
          gameProgress: updatedProgress,
        });
      }
    }, 1000); // Run every 1 second
    
    return () => clearInterval(interval);
  }, [vaultState, games, setVaultState]);
}
