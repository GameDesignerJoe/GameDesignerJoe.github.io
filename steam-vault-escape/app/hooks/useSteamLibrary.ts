import { useCallback } from 'react';
import { SteamGame } from '@/types/steam';
import { VaultState } from '@/types/vault';
import { loadFromStorage } from '@/lib/storage';
import { initializePools, needsPoolInitialization } from '@/lib/pool-manager';
import { initializeShop } from '@/lib/shop-manager';
import { initialMetadataEnrichment } from '@/lib/metadata-enrichment';
import { detectNewlyPlayedKeyGames, calculateTotalKeysAwarded } from '@/lib/key-game-detector';
import { autoRefreshAllDrained } from '@/lib/click-manager';
import { pickRandomReward } from '@/types/progress';
import type { UnlockedGame } from '@/types/progress';

interface UseSteamLibraryReturn {
  fetchLibrary: () => Promise<void>;
  handleRefresh: () => Promise<void>;
}

export function useSteamLibrary(
  steamId: string,
  games: SteamGame[],
  vaultState: VaultState | null,
  isRefreshing: boolean,
  setGames: (games: SteamGame[]) => void,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  setIsRefreshing: (refreshing: boolean) => void,
  setIsInitializingPools: (initializing: boolean) => void,
  setVaultState: (state: VaultState) => void,
  setShopSlots: (slots: any[]) => void,
  setUnlockedGames: (games: (number | string)[]) => void,
  setFeaturedGame: (game: any) => void,
  setLiberationKeys: (value: number | ((prev: number) => number)) => void,
  openCelebration: (data: any) => void,
  setHasInitializedOnce: (value: boolean) => void,
  hasInitializedOnce: boolean,
  liberationKeys: number
): UseSteamLibraryReturn {

  const fetchLibrary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch library');
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const fetchedGames = data.games || [];
      setGames(fetchedGames);
      
      // Check if we need to initialize pools (first time v1.5 setup)
      const savedState = loadFromStorage();
      if (needsPoolInitialization(savedState) && !hasInitializedOnce) {
        console.log('[Vault] Initializing v1.5 pool system...');
        setIsInitializingPools(true);
        setHasInitializedOnce(true);
        
        try {
          const poolData = await initializePools(fetchedGames);
          
          // Add starting game to progress track
          const startingGameForTrack: UnlockedGame | null = poolData.startingGame ? {
            appId: poolData.startingGame.appid,
            unlockTimestamp: Date.now(),
            tier: 'cheap',
            name: poolData.startingGame.name,
          } : null;
          
          // Create new v1.5 state
          const newState: VaultState = {
            version: '1.5',
            collectionPower: 0,
            liberationKeys: 0,
            pool1_unlocked: poolData.pool1_unlocked,
            pool2_hidden: poolData.pool2_hidden,
            pool3_keyGames: poolData.pool3_keyGames,
            shopSlots: [],
            gameProgress: {},
            progressTrack: {
              nextReward: pickRandomReward(),
              unlockedGames: startingGameForTrack ? [startingGameForTrack] : [],
            },
            lastSync: Date.now(),
            steamId: steamId,
            cachedLibrary: fetchedGames,
          };
          
          // Set starting game as featured FIRST
          if (poolData.startingGame) {
            const { toVaultGameState } = await import('@/lib/vault-logic');
            const startingVaultState = toVaultGameState(
              poolData.startingGame,
              poolData.pool1_unlocked
            );
            setFeaturedGame(startingVaultState);
            setUnlockedGames(poolData.pool1_unlocked);
          }
          
          // Metadata enrichment
          console.log('[Vault] Enriching Pool 2 with metadata...');
          const enrichedGames = await initialMetadataEnrichment(poolData.pool2_hidden, fetchedGames);
          
          // Initialize shop
          console.log('[Vault] Initializing shop with pre-enriched games...');
          const shopResult = await initializeShop(poolData.pool2_hidden, enrichedGames);
          
          // Update state ONCE with everything ready
          newState.cachedLibrary = enrichedGames;
          newState.shopSlots = shopResult.shopSlots;
          newState.pool2_hidden = shopResult.updatedPool2;
          
          setVaultState(newState);
          setShopSlots(shopResult.shopSlots);
          setGames(enrichedGames);
          
          console.log('[Vault] Pool initialization complete!', {
            pool1: poolData.pool1_unlocked.length,
            pool2: poolData.pool2_hidden.length,
            pool3: poolData.pool3_keyGames.length,
            startingGame: poolData.startingGame?.name,
          });
        } catch (initError) {
          console.error('[Vault] Pool initialization failed:', initError);
        } finally {
          setIsInitializingPools(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [steamId, hasInitializedOnce, setGames, setVaultState, setShopSlots, setUnlockedGames, setFeaturedGame, setHasInitializedOnce]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !vaultState) return;
    
    setIsRefreshing(true);
    
    try {
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch library');
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const freshGames = data.games || [];
      
      // Detect newly played key games
      const cachedGames = games;
      const detectionResults = detectNewlyPlayedKeyGames(
        freshGames,
        cachedGames,
        vaultState.pool3_keyGames || []
      );
      
      if (detectionResults.length > 0) {
        console.log(`[Key Detection] Found ${detectionResults.length} newly played Key Game(s)!`);
        
        const totalKeys = calculateTotalKeysAwarded(detectionResults);
        setLiberationKeys(prev => prev + totalKeys);
        
        // Move games from Pool 3 → Pool 2
        let updatedPool3 = [...(vaultState.pool3_keyGames || [])];
        let updatedPool2 = [...(vaultState.pool2_hidden || [])];
        
        detectionResults.forEach(result => {
          updatedPool3 = updatedPool3.filter(id => id !== result.game.appid);
          updatedPool2.push(result.game.appid);
        });
        
        // Auto-refresh all drained games
        const refreshedProgress = autoRefreshAllDrained(vaultState.gameProgress || {});
        
        // Update vault state
        const updatedState: VaultState = {
          ...vaultState,
          pool2_hidden: updatedPool2,
          pool3_keyGames: updatedPool3,
          gameProgress: refreshedProgress,
          liberationKeys: liberationKeys + totalKeys,
          lastSync: Date.now(),
        };
        
        setVaultState(updatedState);
        
        // Show celebration modal
        openCelebration({
          games: detectionResults.map(r => ({ name: r.game.name, keys: r.keysAwarded })),
          totalKeys,
        });
      }
      
      // Update library
      setGames(freshGames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, vaultState, steamId, games, liberationKeys, setGames, setError, setIsRefreshing, setLiberationKeys, setVaultState, openCelebration]);

  return {
    fetchLibrary,
    handleRefresh,
  };
}
