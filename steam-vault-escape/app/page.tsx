'use client';

import { useEffect, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SteamGame } from '@/types/steam';
import { VaultGameState, VaultState, ShopSlot } from '@/types/vault';
import { toVaultGameState } from '@/lib/vault-logic';
import { getLibraryCapsule, handleImageError } from '@/lib/steam-images';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { initializePools, needsPoolInitialization, getPoolStats } from '@/lib/pool-manager';
import { initializeShop } from '@/lib/shop-manager';
import { handleGameClick, calculateRefreshCost, refreshDrainedGame, getClickValue, getMaxPower, autoRefreshAllDrained, calculateRechargeDuration } from '@/lib/click-manager';
import { calculateUnlockCost } from '@/lib/game-utils';
import { THRESHOLDS } from '@/lib/constants';
import { drawGameFromPool2, getSlotTargetTier, canAffordDraw } from '@/lib/draw-manager';
import { initialMetadataEnrichment, topUpMetadataBuffer } from '@/lib/metadata-enrichment';
import { detectNewlyPlayedKeyGames, calculateTotalKeysAwarded, KeyGameDetectionResult } from '@/lib/key-game-detector';
import { retryOnUnlock, retryOnDraw, retryOnFeatured, retryMultipleImages, getFailedImages, getImageStats } from '@/lib/image-retry-manager';
import { loadBalanceConfig } from '@/lib/config-loader';
import { pickRandomReward, REWARD_POOL } from '@/types/progress';
import type { UnlockedGame } from '@/types/progress';

// Import components
import ToastNotification from './components/ToastNotification';
import SteamIdInput from './components/SteamIdInput';
import VictoryModal from './components/VictoryModal';
import CelebrationModal from './components/CelebrationModal';
import DrawModal from './components/DrawModal';
import DevPanel from './components/DevPanel';
import FeaturedGameDisplay from './components/FeaturedGameDisplay';
import ShopSection from './components/ShopSection';
import GameLibrary from './components/GameLibrary';
import ProgressTrack from './components/ProgressTrack';

export default function Home() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [vaultGames, setVaultGames] = useState<VaultGameState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'locked' | 'playable' | 'liberationKey'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'cost' | 'hours' | 'name' | 'passive'>('default');
  const [unlockedGames, setUnlockedGames] = useState<Array<number | string>>(['vault-controller']);
  const [points, setPoints] = useState(0);
  const [featuredGame, setFeaturedGame] = useState<VaultGameState | null>(null);
  const [clickAnimations, setClickAnimations] = useState<Array<{ value: number; id: number; angle: number; distance: number; startX: number; startY: number }>>([]);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'unlocked' | 'keyGames' | 'progressTrack'>('unlocked'); // Tab state
  
  // v1.5 Pool state
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [isInitializingPools, setIsInitializingPools] = useState(false);
  const [hasInitializedOnce, setHasInitializedOnce] = useState(false);
  const [shopSlots, setShopSlots] = useState<ShopSlot[]>([]);
  const [collectionPower, setCollectionPower] = useState(0);
  const [liberationKeys, setLiberationKeys] = useState(0);
  
  // Draw modal state
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [drawSlotIndex, setDrawSlotIndex] = useState<number | null>(null);
  const [drawnGame, setDrawnGame] = useState<SteamGame | null>(null);
  const [revealedCard, setRevealedCard] = useState(false);
  const [drawnGamesThisSession, setDrawnGamesThisSession] = useState<number[]>([]); // Track all drawn games in this draw session
  
  // Steam ID state
  const [steamId, setSteamId] = useState<string>('');
  const [showSteamIdInput, setShowSteamIdInput] = useState(false);
  const [steamIdInputValue, setSteamIdInputValue] = useState('');
  
  // Celebration modal state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{games: Array<{name: string, keys: number}>, totalKeys: number} | null>(null);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'warning' | 'info'>('info');
  const [currentTime, setCurrentTime] = useState(Date.now()); // For countdown timers
  
  // Toast helper function
  const showToast = (message: string, type: 'error' | 'warning' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000); // Auto-dismiss after 4 seconds
  };
  
  // Update current time every second for countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load balance config on mount (FIRST THING)
  useEffect(() => {
    loadBalanceConfig().then(() => {
      console.log('[Balance] Config loaded successfully');
    }).catch(err => {
      console.error('[Balance] Failed to load config:', err);
    });
  }, []);

  // Check for saved Steam ID on mount
  useEffect(() => {
    const savedSteamId = localStorage.getItem('steamId');
    if (savedSteamId) {
      setSteamId(savedSteamId);
      console.log('[Steam ID] Loaded from storage:', savedSteamId);
    } else {
      // No Steam ID - show input modal with default value
      const defaultId = '76561197970579347';
      setSteamIdInputValue(defaultId); // Pre-fill with default
      setShowSteamIdInput(true);
      console.log('[Steam ID] No saved ID - showing input modal with default:', defaultId);
    }
  }, []);

  // Load saved state on mount (after Steam ID is set)
  useEffect(() => {
    if (!steamId) {
      console.log('[Vault] Waiting for Steam ID...');
      return; // Wait for Steam ID
    }
    
    console.log('[Vault] Steam ID available, loading saved state...');
    const saved = loadFromStorage();
    if (saved) {
      setPoints(saved.points || 0);
      setUnlockedGames(saved.unlockedGames || ['vault-controller']);
      setLastRefresh(saved.lastRefresh || Date.now());
      
      // Load v1.5 state if available
      if (saved.version === '1.5' && saved.shopSlots) {
        console.log('[Vault] Loading v1.5 state from localStorage');
        setVaultState(saved as VaultState);
        setShopSlots(saved.shopSlots || []);
        setCollectionPower(saved.collectionPower || 0);
        setLiberationKeys(saved.liberationKeys || 0);
        
        // Load unlocked games from pool1
        if (saved.pool1_unlocked) {
          setUnlockedGames(saved.pool1_unlocked);
        }
      }
      
      // Load cached library if available
      if (saved.cachedLibrary && saved.cachedLibrary.length > 0) {
        setGames(saved.cachedLibrary);
        setIsLoading(false);
        
        // Set featured game if saved
        if (saved.featuredGame && saved.unlockedGames) {
          // Find the game in loaded library
          const savedFeatured = saved.cachedLibrary.find(g => String(g.appid) === String(saved.featuredGame));
          if (savedFeatured) {
            const featuredState = toVaultGameState(savedFeatured, saved.unlockedGames);
            setFeaturedGame(featuredState);
          }
        }
        
        // Check if we need to initialize pools even with cached library
        if (needsPoolInitialization(saved)) {
          console.log('[Vault] Cached library exists but needs v1.5 initialization');
          fetchLibrary();
        }
      } else {
        // No cached library, fetch fresh
        fetchLibrary();
      }
    } else {
      // No saved data, fetch library
      fetchLibrary();
    }
  }, [steamId]); // Run when steamId changes

  // Save state whenever it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // If we have v1.5 state, save it properly
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

  // Convert games to vault states whenever games or unlocked list changes
  useEffect(() => {
    const vaultStates = games.map(game => toVaultGameState(game, unlockedGames));
    setVaultGames(vaultStates);
    
    // Auto-select Vault Controller as featured if nothing is featured
    if (!featuredGame && vaultStates.length > 0) {
      const vaultController = vaultStates.find(g => g.appid === 'vault-controller');
      if (vaultController) {
        setFeaturedGame(vaultController);
      }
    }
    
    // Victory detection - check if all non-Liberation-Key games are unlocked
    if (vaultStates.length > 1 && !hasWon) {
      const lockedCount = vaultStates.filter(g => g.state === 'locked').length;
      if (lockedCount === 0) {
        setHasWon(true);
        setShowVictory(true);
      }
    }
  }, [games, unlockedGames, hasWon]);
  
  // KEY MOMENT: Retry failed images on page load/session start
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
  }, [vaultState, games.length]); // Only run once when vault state is ready

  // v1.0 passive income system removed - v1.5 uses click-based Collection Power generation
  
  // PASSIVE REGENERATION: ONLY recharge drained games (not partial games)
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
        const regenRatePercent = THRESHOLDS.PASSIVE_REGEN_RATE_PERCENT / 100; // Convert % to decimal
        const regenRate = maxPower * regenRatePercent;
        
        // Reduce currentPower (remember: higher = more drained, 0 = full health)
        const newCurrentPower = Math.max(0, progress.currentPower - regenRate);
        
        // Check if FULLY recharged (must be 100% to unmark as drained)
        const isFullyRecharged = newCurrentPower === 0;
        
        if (newCurrentPower !== progress.currentPower) {
          updatedProgress[appId] = {
            ...progress,
            currentPower: newCurrentPower,
            isDrained: !isFullyRecharged, // Only unmark when FULLY recharged
            drainedAt: isFullyRecharged ? undefined : progress.drainedAt, // Clear timestamp when fully recharged
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
  }, [vaultState, games]);

  // Handle clicking the featured game (v1.5 - generates Collection Power)
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!featuredGame || !vaultState) return;
    
    // Find the actual game data
    const game = games.find(g => g.appid === featuredGame.appid);
    if (!game) return;
    
    // Get current progress
    const appId = Number(featuredGame.appid);
    const currentProgress = vaultState.gameProgress?.[appId];
    
    // Handle the click using v1.5 click manager
    const result = handleGameClick(game, currentProgress);
    
    console.log('[Click] Result:', { 
      game: game.name, 
      powerGained: result.powerGained, 
      isDrained: result.isDrained,
      wasAlreadyDrained: currentProgress?.isDrained,
      currentPower: result.newProgress.currentPower,
      maxPower: result.newProgress.maxPower
    });
    
    // Check if THIS click resulted in no power (game is NOW drained)
    if (result.powerGained === 0) {
      console.log(`[Click] ${game.name} is drained - switching to Key Games tab`);
      setLibraryTab('keyGames');
      return;
    }
    
    // Add Collection Power
    setCollectionPower(prev => prev + result.powerGained);
    console.log('[Click] Added', result.powerGained, 'Collection Power');
    
    // Update game progress
    if (!vaultState.gameProgress) vaultState.gameProgress = {};
    vaultState.gameProgress[appId] = result.newProgress;
    setVaultState({...vaultState});
    
    const earnedPoints = result.powerGained;
    
    // Get button dimensions
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Choose a random edge (0=top, 1=right, 2=bottom, 3=left)
    const edge = Math.floor(Math.random() * 4);
    let startX, startY;
    
    switch(edge) {
      case 0: // top edge
        startX = Math.random() * rect.width;
        startY = 0;
        break;
      case 1: // right edge
        startX = rect.width;
        startY = Math.random() * rect.height;
        break;
      case 2: // bottom edge
        startX = Math.random() * rect.width;
        startY = rect.height;
        break;
      case 3: // left edge
      default:
        startX = 0;
        startY = Math.random() * rect.height;
        break;
    }
    
    // Calculate outward angle from edge
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const angleFromCenter = Math.atan2(startY - centerY, startX - centerX) * (180 / Math.PI);
    
    const randomDistance = 80 + Math.random() * 40; // 80-120px
    
    const animationId = Date.now() + Math.random(); // Unique ID
    
    setClickAnimations(prev => [...prev, { 
      value: earnedPoints, 
      id: animationId,
      angle: angleFromCenter,
      distance: randomDistance,
      startX,
      startY
    }]);
    
    // Remove this animation after it completes
    setTimeout(() => {
      setClickAnimations(prev => prev.filter(anim => anim.id !== animationId));
    }, 1200);
  }

  // Handle selecting a game as featured
  function handleSelectFeatured(game: VaultGameState) {
    if (game.state === 'playable') {
      setFeaturedGame(game);
      
      // KEY MOMENT: Retry image load for featured game
      const steamGame = games.find(g => g.appid === game.appid);
      if (steamGame) {
        retryOnFeatured(steamGame);
      }
    }
  }

  // Handle unlocking a game
  function handleUnlock(game: VaultGameState) {
    // Check if can afford
    if (points < game.unlockCost) {
      return; // Not enough points
    }
    
    // Deduct points
    setPoints(prev => prev - game.unlockCost);
    
    // Add to unlocked games
    setUnlockedGames(prev => [...prev, game.appid]);
    
    // Show animation (could add toast notification here)
    console.log(`Unlocked ${game.name}!`);
  }

  // Handle "playing" a Liberation Key - opens Steam app
  function handlePlayLiberationKey(game: VaultGameState) {
    if (game.state !== 'liberationKey') return;
    
    // Open Steam app directly to the game's store page
    window.location.href = `steam://store/${game.appid}`;
  }

  // Handle drawing a new game for an empty slot
  function handleDrawSlot(slotIndex: number) {
    if (!vaultState) return;
    
    // Check if can afford
    if (!canAffordDraw(liberationKeys)) {
      console.log('[Draw] Cannot afford - need 10 keys, have:', liberationKeys);
      return;
    }
    
    // Get target tier for this slot
    const targetTier = getSlotTargetTier(slotIndex);
    
    // Draw a game from Pool 2
    const result = drawGameFromPool2(vaultState.pool2_hidden || [], games, targetTier);
    
    if (!result) {
      alert('No games available to draw! Pool 2 is empty.');
      return;
    }
    
    // Open the draw modal
    setDrawSlotIndex(slotIndex);
    setDrawnGame(result.game);
    setRevealedCard(false);
    setShowDrawModal(true);
    setDrawnGamesThisSession([result.game.appid]); // Start tracking drawn games
    
    console.log('[Draw] Opening modal for slot', slotIndex, 'drew:', result.game.name);
    
    // KEY MOMENT: Retry image load for drawn game
    retryOnDraw(result.game);
  }
  
  // Handle revealing the card (animation trigger)
  function handleCardReveal() {
    if (revealedCard) return; // Already revealed
    
    // Deduct 10 keys for the draw
    setLiberationKeys(prev => prev - 10);
    
    // Trigger reveal animation
    setRevealedCard(true);
  }
  
  // Handle accepting the drawn game
  function handleAcceptDraw() {
    if (!vaultState || !drawnGame || drawSlotIndex === null) return;
    
    // Fill the shop slot with the drawn game
    const updatedShopSlots = [...shopSlots];
    // Calculate the ACTUAL tier based on the game's unlock cost
    const unlockCost = calculateUnlockCost(drawnGame);
    const actualTier = unlockCost < 1000 ? 'cheap' : unlockCost < 3000 ? 'moderate' : 'epic';
    updatedShopSlots[drawSlotIndex] = {
      appId: drawnGame.appid,
      tier: actualTier, // Use actual game tier, not slot pattern tier
    };
    
    setShopSlots(updatedShopSlots);
    
    // IMPORTANT: Remove drawn game from Pool 2 so it can't be drawn again
    const updatedPool2 = vaultState.pool2_hidden?.filter(id => id !== drawnGame.appid) || [];
    
    // Update vault state
    const updatedState: VaultState = {
      ...vaultState,
      pool2_hidden: updatedPool2,
      shopSlots: updatedShopSlots,
      liberationKeys,
    };
    setVaultState(updatedState);
    
    // Close modal and clear session
    setShowDrawModal(false);
    setDrawnGame(null);
    setDrawSlotIndex(null);
    setRevealedCard(false);
    setDrawnGamesThisSession([]); // Clear session history
    
    console.log('[Draw] Accepted draw:', drawnGame.name);
  }
  
  // Handle redrawing (costs 5 keys)
  function handleRedraw() {
    if (!vaultState || !drawnGame) return;
    
    // Check if can afford redraw
    if (liberationKeys < 5) {
      console.log('[Draw] Cannot afford redraw - need 5 keys, have:', liberationKeys);
      return;
    }
    
    // Deduct 5 keys
    setLiberationKeys(prev => prev - 5);
    
    // Add current game to session exclusion list
    const updatedExclusions = [...drawnGamesThisSession, drawnGame.appid];
    setDrawnGamesThisSession(updatedExclusions);
    
    // Draw a new game, EXCLUDING ALL games drawn in this session
    const targetTier = drawSlotIndex !== null ? getSlotTargetTier(drawSlotIndex) : undefined;
    const result = drawGameFromPool2(
      vaultState.pool2_hidden || [], 
      games, 
      targetTier,
      updatedExclusions // Exclude ALL previously drawn games in this session
    );
    
    if (!result) {
      alert('No more games available to draw!');
      return;
    }
    
    // Update drawn game and reset reveal
    setDrawnGame(result.game);
    setRevealedCard(false);
    
    console.log('[Draw] Redrew:', result.game.name, '(excluded:', updatedExclusions.length, 'games)');
  }
  
  // Handle unlocking a game from the shop
  async function handleShopUnlock(slot: ShopSlot, game: SteamGame) {
    if (!vaultState) return;
    
    const unlockCost = calculateUnlockCost(game);
    
    // Check if can afford
    if (collectionPower < unlockCost) {
      console.log('[Shop] Cannot afford:', game.name, 'Need:', unlockCost, 'Have:', collectionPower);
      return;
    }
    
    // Deduct collection power
    setCollectionPower(prev => prev - unlockCost);
    
    // Move game from Pool 2 to Pool 1
    const newPool2 = vaultState.pool2_hidden?.filter(id => id !== game.appid) || [];
    const newPool1 = [...(vaultState.pool1_unlocked || []), game.appid];
    
    // Update vault state
    const updatedState: VaultState = {
      ...vaultState,
      pool1_unlocked: newPool1,
      pool2_hidden: newPool2,
      collectionPower: collectionPower - unlockCost,
    };
    
    // Clear the shop slot (replace with empty slot)
    const updatedShopSlots = shopSlots.map(s => 
      s === slot ? { appId: null, tier: null } : s
    );
    updatedState.shopSlots = updatedShopSlots;
    
    setVaultState(updatedState);
    setShopSlots(updatedShopSlots);
    setUnlockedGames(newPool1);
    
    console.log(`[Shop] Unlocked ${game.name}! Spent ${unlockCost} Collection Power`);
    
    // PROGRESS TRACK: Award reward and add game
    if (updatedState.progressTrack) {
      const currentReward = updatedState.progressTrack.nextReward;
      
      // Award the reward
      if (currentReward.type === 'power') {
        setCollectionPower(prev => prev + currentReward.amount);
        console.log(`[Progress Track] Awarded ${currentReward.amount} Collection Power!`);
      } else if (currentReward.type === 'keys') {
        setLiberationKeys(prev => prev + currentReward.amount);
        console.log(`[Progress Track] Awarded ${currentReward.amount} Keys!`);
      }
      
      // Add game to progress track (newest first)
      const newUnlockedGame: UnlockedGame = {
        appId: game.appid,
        unlockTimestamp: Date.now(),
        tier: unlockCost < 1000 ? 'cheap' : unlockCost < 3000 ? 'moderate' : 'epic',
        name: game.name,
      };
      
      updatedState.progressTrack = {
        nextReward: pickRandomReward(),
        unlockedGames: [newUnlockedGame, ...updatedState.progressTrack.unlockedGames],
      };
      
      console.log(`[Progress Track] Added ${game.name} to progress track. Next reward: ${updatedState.progressTrack.nextReward.amount} ${updatedState.progressTrack.nextReward.label}`);
    }
    
    // KEY MOMENT: Retry image load for newly unlocked game
    retryOnUnlock(game);
    
    // TOP UP METADATA BUFFER: Enrich more Pool 2 games if needed
    console.log('[Metadata] Checking if buffer needs top-up after unlock...');
    const enrichedGames = await topUpMetadataBuffer(newPool2, games);
    setGames(enrichedGames);
    updatedState.cachedLibrary = enrichedGames;
    setVaultState(updatedState);
  }

  async function fetchLibrary() {
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
      setLastRefresh(Date.now());
      
      // Check if we need to initialize pools (first time v1.5 setup)
      const savedState = loadFromStorage();
      if (needsPoolInitialization(savedState) && !hasInitializedOnce) {
        console.log('[Vault] Initializing v1.5 pool system...');
        setIsInitializingPools(true);
        setHasInitializedOnce(true); // Mark as initialized to prevent double init
        
        try {
          const poolData = await initializePools(fetchedGames);
          
          // Add starting game to progress track
          const startingGameForTrack: UnlockedGame | null = poolData.startingGame ? {
            appId: poolData.startingGame.appid,
            unlockTimestamp: Date.now(),
            tier: 'cheap', // Starting games are always low playtime
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
          
          // Set starting game as featured FIRST (before updating games array)
          if (poolData.startingGame) {
            const startingVaultState = toVaultGameState(
              poolData.startingGame,
              poolData.pool1_unlocked
            );
            setFeaturedGame(startingVaultState);
            setUnlockedGames(poolData.pool1_unlocked);
          }
          
          // METADATA ENRICHMENT: Ensure 10 Pool 2 games have metadata BEFORE shop init
          console.log('[Vault] Enriching Pool 2 with metadata...');
          const enrichedGames = await initialMetadataEnrichment(poolData.pool2_hidden, fetchedGames);
          
          // Initialize shop with games from Pool 2 (now ALL enriched, no more async calls)
          console.log('[Vault] Initializing shop with pre-enriched games...');
          const shopResult = await initializeShop(poolData.pool2_hidden, enrichedGames);
          
          // Update state ONCE with everything ready
          newState.cachedLibrary = enrichedGames;
          newState.shopSlots = shopResult.shopSlots;
          newState.pool2_hidden = shopResult.updatedPool2;
          
          // Single atomic update - prevents re-renders mid-initialization
          setVaultState(newState);
          setShopSlots(shopResult.shopSlots);
          setGames(enrichedGames);
          
          console.log('[Vault] Initialization complete - no more updates should occur');
          
          // Save the new state
          saveToStorage(newState);
          
          console.log('[Vault] Pool initialization complete!', {
            pool1: poolData.pool1_unlocked.length,
            pool2: poolData.pool2_hidden.length,
            pool3: poolData.pool3_keyGames.length,
            startingGame: poolData.startingGame?.name,
          });
        } catch (initError) {
          console.error('[Vault] Pool initialization failed:', initError);
          // Continue with v1.0 mode if initialization fails
        } finally {
          setIsInitializingPools(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  // TEST FUNCTION: Simulate Key Game Detection
  function testKeyGameDetection() {
    if (!vaultState || !vaultState.pool3_keyGames?.length) {
      alert('❌ No Key Games available to test!');
      return;
    }
    
    // Pick a random Key Game from Pool 3
    const randomIndex = Math.floor(Math.random() * vaultState.pool3_keyGames.length);
    const testGameId = vaultState.pool3_keyGames[randomIndex];
    const testGame = games.find(g => g.appid === testGameId);
    
    if (!testGame) {
      alert('❌ Test game not found in library!');
      return;
    }
    
    console.log(`[TEST] Simulating Key Game detection for: ${testGame.name}`);
    
    // Create simulated cached library (game had 25 minutes)
    const cachedGames = games.map(g => 
      g.appid === testGameId 
        ? { ...g, playtime_forever: 25 }
        : g
    );
    
    // Create simulated current library (game now has 35 minutes)
    const currentGames = games.map(g => 
      g.appid === testGameId 
        ? { ...g, playtime_forever: 35 }
        : g
    );
    
    // Run detection system
    const detectionResults = detectNewlyPlayedKeyGames(
      currentGames,
      cachedGames,
      vaultState.pool3_keyGames || []
    );
    
    if (detectionResults.length === 0) {
      alert('❌ Detection failed - no games detected. Check console for details.');
      console.error('[TEST] Detection failed for:', testGame.name);
      return;
    }
    
    console.log(`[TEST] ✅ Detection successful!`, detectionResults);
    
    // Calculate total keys awarded
    const totalKeys = calculateTotalKeysAwarded(detectionResults);
    
    // Award keys
    setLiberationKeys(prev => prev + totalKeys);
    
    // Move games from Pool 3 → Pool 2
    let updatedPool3 = [...(vaultState.pool3_keyGames || [])];
    let updatedPool2 = [...(vaultState.pool2_hidden || [])];
    
    detectionResults.forEach(result => {
      // Remove from Pool 3
      updatedPool3 = updatedPool3.filter(id => id !== result.game.appid);
      // Add to Pool 2
      updatedPool2.push(result.game.appid);
    });
    
    // Auto-refresh all drained games (FREE!)
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
    setCelebrationData({
      games: detectionResults.map(r => ({ name: r.game.name, keys: r.keysAwarded })),
      totalKeys,
    });
    setShowCelebration(true);
  }

  async function handleRefresh() {
    if (isRefreshing || !vaultState) return;
    
    setIsRefreshing(true);
    
    try {
      // Fetch fresh library
      const response = await fetch(`/api/steam-library?steamid=${steamId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch library');
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const freshGames = data.games || [];
      
      // M6: DETECT NEWLY PLAYED KEY GAMES
      const cachedGames = games;
      const detectionResults = detectNewlyPlayedKeyGames(
        freshGames,
        cachedGames,
        vaultState.pool3_keyGames || []
      );
      
      if (detectionResults.length > 0) {
        console.log(`[Key Detection] Found ${detectionResults.length} newly played Key Game(s)!`);
        
        // Calculate total keys awarded
        const totalKeys = calculateTotalKeysAwarded(detectionResults);
        
        // Award keys
        setLiberationKeys(prev => prev + totalKeys);
        
        // Move games from Pool 3 → Pool 2
        let updatedPool3 = [...(vaultState.pool3_keyGames || [])];
        let updatedPool2 = [...(vaultState.pool2_hidden || [])];
        
        detectionResults.forEach(result => {
          // Remove from Pool 3
          updatedPool3 = updatedPool3.filter(id => id !== result.game.appid);
          // Add to Pool 2
          updatedPool2.push(result.game.appid);
        });
        
        // Auto-refresh all drained games (FREE!)
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
        setCelebrationData({
          games: detectionResults.map(r => ({ name: r.game.name, keys: r.keysAwarded })),
          totalKeys,
        });
        setShowCelebration(true);
      }
      
      // Update library
      setGames(freshGames);
      setLastRefresh(Date.now());
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRefreshing(false);
    }
  }

  // Render Steam ID input modal FIRST if needed
  if (showSteamIdInput) {
    return (
      <>
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-vault-blue to-vault-dark rounded-xl p-8 max-w-md w-full border-4 border-vault-gold shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-vault-gold mb-2">🎮 Welcome!</h2>
              <p className="text-gray-300">Enter your Steam ID to get started</p>
            </div>
            
            <input
              type="text"
              value={steamIdInputValue}
              onChange={(e) => setSteamIdInputValue(e.target.value)}
              placeholder="76561197970579347"
              className="w-full px-4 py-3 bg-vault-dark border-2 border-vault-gold/50 rounded-lg text-white text-center text-lg mb-4 focus:outline-none focus:border-vault-gold"
            />
            
            <button
              onClick={() => {
                if (steamIdInputValue.trim()) {
                  const newSteamId = steamIdInputValue.trim();
                  setSteamId(newSteamId);
                  localStorage.setItem('steamId', newSteamId);
                  setShowSteamIdInput(false);
                  console.log('[Steam ID] Saved:', newSteamId);
                }
              }}
              disabled={!steamIdInputValue.trim()}
              className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
                steamIdInputValue.trim()
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
      </>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-vault-accent">
            🔐 Steam Vault Escape
          </h1>
          <div className="text-center py-8">
            <div className="text-2xl mb-4">Loading your Steam library...</div>
            <div className="text-vault-accent animate-pulse text-4xl mb-8">⚙️</div>
          </div>
          
          {/* Skeleton Loaders */}
          <div className="space-y-8">
            {/* Featured Game Skeleton */}
            <div className="flex flex-col items-center">
              <div className="w-24 h-8 bg-gray-700 rounded animate-pulse mb-4"></div>
              <div className="w-[300px] h-[450px] bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg animate-pulse"></div>
            </div>
            
            {/* Shop Skeleton */}
            <div className="bg-vault-gray rounded-lg p-6">
              <div className="w-64 h-8 bg-gray-700 rounded animate-pulse mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg animate-pulse"></div>
                ))}
              </div>
            </div>
            
            {/* Library Skeleton */}
            <div className="bg-vault-gray rounded-lg p-6">
              <div className="w-48 h-8 bg-gray-700 rounded animate-pulse mb-4"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-vault-accent">
            🔐 Steam Vault Escape
          </h1>
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
            <button
              onClick={fetchLibrary}
              className="mt-4 px-4 py-2 bg-vault-accent text-vault-dark rounded hover:bg-blue-400 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - Minimized for space */}
        <div className="mb-2 sm:mb-4">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-vault-accent text-center">
            🔐 Steam Vault Escape
          </h1>
        </div>

        {/* Featured Game Section */}
        <FeaturedGameDisplay
          featuredGame={featuredGame}
          vaultState={vaultState}
          games={games}
          collectionPower={collectionPower}
          liberationKeys={liberationKeys}
          showBurst={false}
          clickAnimations={clickAnimations}
          currentTime={currentTime}
          onGameClick={handleClick}
          onRefresh={(gameId, cost) => {
            setLiberationKeys(prev => prev - cost);
            const game = games.find(g => g.appid === gameId);
            if (game && vaultState) {
              const progress = vaultState.gameProgress?.[gameId];
              const refreshed = refreshDrainedGame(game, progress!);
              if (!vaultState.gameProgress) vaultState.gameProgress = {};
              vaultState.gameProgress[gameId] = refreshed;
              setVaultState({...vaultState});
            }
          }}
          onSwitchToKeyGames={() => setLibraryTab('keyGames')}
        />

        {/* Shop Section */}
        <ShopSection
          shopSlots={shopSlots}
          games={games}
          collectionPower={collectionPower}
          liberationKeys={liberationKeys}
          onDrawSlot={handleDrawSlot}
          onShopUnlock={handleShopUnlock}
          onSwitchToKeyGames={() => setLibraryTab('keyGames')}
        />

        {/* Tabbed Library Section - Game Library + Key Games */}
        {vaultState && (
          <div className="bg-vault-gray rounded-lg p-3 sm:p-6 mb-4 sm:mb-8 border border-green-500/30">
            {/* Section Toggle Buttons */}
            <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6">
              <button
                onClick={() => setLibraryTab('unlocked')}
                className={`px-3 py-2 sm:px-8 sm:py-4 rounded-lg font-bold text-xs sm:text-lg transition-all ${
                  libraryTab === 'unlocked'
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/50 scale-105'
                    : 'bg-vault-dark text-gray-400 hover:bg-gray-700 hover:scale-102'
                }`}
              >
                🎮 Game Library
              </button>
              <button
                onClick={() => setLibraryTab('keyGames')}
                className={`px-3 py-2 sm:px-8 sm:py-4 rounded-lg font-bold text-xs sm:text-lg transition-all ${
                  libraryTab === 'keyGames'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                    : 'bg-vault-dark text-gray-400 hover:bg-gray-700 hover:scale-102'
                }`}
              >
                ⭐ Key Games
              </button>
              <button
                onClick={() => setLibraryTab('progressTrack')}
                className={`px-3 py-2 sm:px-8 sm:py-4 rounded-lg font-bold text-xs sm:text-lg transition-all ${
                  libraryTab === 'progressTrack'
                    ? 'bg-vault-gold text-vault-dark shadow-lg shadow-vault-gold/50 scale-105'
                    : 'bg-vault-dark text-gray-400 hover:bg-gray-700 hover:scale-102'
                }`}
              >
                🏆 Progress Track
              </button>
            </div>

            {/* Game Library Tab Content */}
            {libraryTab === 'unlocked' && vaultState.pool1_unlocked && vaultState.pool1_unlocked.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-3xl font-bold text-green-400">🎮 Game Library</h2>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">⚡ Collection Power</div>
                    <div className="text-3xl font-bold text-green-400">{collectionPower.toLocaleString()}</div>
                  </div>
                </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {vaultState.pool1_unlocked
                .map(appId => games.find(g => g.appid === appId))
                .filter((game): game is SteamGame => game !== undefined)
                .sort((a, b) => {
                  // Sort by click value (highest first)
                  const aClickValue = getClickValue(a);
                  const bClickValue = getClickValue(b);
                  return bClickValue - aClickValue;
                })
                .map(game => {
                const appId = game.appid; // Get appId from game
                const progress = vaultState.gameProgress?.[appId];
                const clickValue = getClickValue(game);
                const maxPower = getMaxPower(game);
                const currentPower = progress?.currentPower || 0;
                const remainingPower = maxPower - currentPower; // Countdown number
                const isDrained = progress?.isDrained || false; // Read from saved state, not calculated!
                const refreshCost = calculateRefreshCost(game);
                // Progress bar shows remaining power
                const progressPercent = maxPower > 0 ? (remainingPower / maxPower) * 100 : 100;
                
                return (
                  <div
                    key={appId}
                    className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 ${
                      featuredGame?.appid === appId ? 'border-vault-accent ring-4 ring-vault-accent' : 'border-green-500'
                    } shadow-lg transition-all hover:scale-105 cursor-pointer`}
                    onClick={() => {
                      // If drained, switch to Key Games tab instead of selecting
                      if (isDrained) {
                        setLibraryTab('keyGames');
                        console.log(`[Game Library] ${game.name} is drained - switched to Key Games tab`);
                        return;
                      }
                      
                      // Otherwise, select this game as featured - don't generate power here
                      const vaultGameState = toVaultGameState(game, vaultState.pool1_unlocked || []);
                      setFeaturedGame(vaultGameState);
                      console.log(`[Game Library] Selected ${game.name} as featured game`);
                    }}
                  >
                    <img
                      src={getLibraryCapsule(game.appid)}
                      alt={game.name}
                      onError={handleImageError}
                      className={`w-full h-full object-cover ${isDrained ? 'grayscale' : ''}`}
                    />
                    
                    {/* Drained overlay with countdown */}
                    {isDrained && (() => {
                      // Calculate recharge time remaining
                      const rechargeDuration = calculateRechargeDuration(game);
                      const drainedAt = progress?.drainedAt || Date.now();
                      const elapsedSeconds = (currentTime - drainedAt) / 1000;
                      const remainingSeconds = Math.max(0, rechargeDuration - elapsedSeconds);
                      
                      // Format as MM:SS
                      const minutes = Math.floor(remainingSeconds / 60);
                      const seconds = Math.floor(remainingSeconds % 60);
                      const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      
                      return (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-3">
                          <div className="text-4xl mb-2">⏱️</div>
                          <div className="text-white font-bold text-sm mb-1">RECHARGING</div>
                          <div className="text-vault-gold font-bold text-lg mb-3">{timeDisplay}</div>
                          <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (liberationKeys < refreshCost) return;
                            
                            setLiberationKeys(prev => prev - refreshCost);
                            const refreshed = refreshDrainedGame(game, progress!);
                            if (!vaultState.gameProgress) vaultState.gameProgress = {};
                            vaultState.gameProgress[appId] = refreshed;
                            setVaultState({...vaultState});
                            
                            console.log(`[Refresh] Refreshed ${game.name} for ${refreshCost} keys`);
                          }}
                          disabled={liberationKeys < refreshCost}
                          className={`px-3 py-1 rounded font-bold text-xs ${
                            liberationKeys >= refreshCost
                              ? 'bg-vault-gold text-vault-dark hover:bg-yellow-400'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Refresh for {refreshCost} 🔑
                        </button>
                        </div>
                      );
                    })()}
                    
                    {/* Info overlay */}
                    {!isDrained && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-3">
                        <div className="text-white font-bold text-xs mb-1 line-clamp-2">{game.name}</div>
                        <div className="text-xs text-green-400 mb-2">+{clickValue} power per click</div>
                        
                        {/* Progress bar with countdown number */}
                        <div className="relative w-full bg-gray-700 rounded-full h-3 mb-1">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              progressPercent < 20 ? 'bg-red-500' : progressPercent < 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                          {/* Countdown number centered in bar */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-bold text-xs drop-shadow-lg">
                              {remainingPower.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}

            {/* Key Games Tab Content - Empty State */}
            {libraryTab === 'keyGames' && vaultState.pool3_keyGames && vaultState.pool3_keyGames.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="text-center max-w-2xl">
                  <div className="text-8xl mb-6">🎉</div>
                  <h2 className="text-5xl font-bold text-purple-500 mb-4">Congratulations!</h2>
                  <p className="text-2xl text-white mb-6">
                    You've played all your Steam games.
                  </p>
                  <p className="text-xl text-purple-400 mb-4">
                    You are in the top <span className="font-bold text-vault-gold">0.00001%</span> of Steam players who have done that.
                  </p>
                  <p className="text-lg text-gray-400 italic">
                    We did the math.*
                  </p>
                  <div className="mt-8 text-xs text-gray-500">
                    *Actual percentage may vary based on library size and definition of "played"
                  </div>
                </div>
              </div>
            )}

            {/* Progress Track Tab Content */}
            {libraryTab === 'progressTrack' && vaultState.progressTrack && (
              <ProgressTrack
                nextReward={vaultState.progressTrack.nextReward}
                unlockedGames={vaultState.progressTrack.unlockedGames}
                games={games}
                totalGamesInLibrary={games.length}
              />
            )}

            {/* Key Games Tab Content - With Games */}
            {libraryTab === 'keyGames' && vaultState.pool3_keyGames && vaultState.pool3_keyGames.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-purple-500">⭐ Key Games - Play to Earn Keys</h2>
                    <p className="text-gray-400 text-sm mt-1">Click any game to launch it in Steam. Play 30+ minutes to earn keys!</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Never-Played Games</div>
                    <div className="text-3xl font-bold text-purple-500">{vaultState.pool3_keyGames.length}</div>
                  </div>
                </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {vaultState.pool3_keyGames
                .map(appId => games.find(g => g.appid === appId))
                .filter((game): game is SteamGame => game !== undefined)
                .sort((a, b) => {
                  // Sort by Metacritic score (highest first), then alphabetically
                  const aScore = a.metacritic || 0;
                  const bScore = b.metacritic || 0;
                  if (aScore !== bScore) return bScore - aScore;
                  return a.name.localeCompare(b.name);
                })
                .map(game => {
                  const keyValue = game.metacritic || 70; // Default to 70 if no Metacritic
                  
                  return (
                    <div
                      key={game.appid}
                      onClick={() => {
                        // Launch Steam to this game's store page
                        window.open(`steam://store/${game.appid}`, '_blank');
                        console.log(`[Key Game] Launching ${game.name} in Steam`);
                      }}
                      className="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-purple-500 shadow-lg transition-all hover:scale-105 hover:shadow-purple-500/50 cursor-pointer"
                    >
                      <img
                        src={getLibraryCapsule(game.appid)}
                        alt={game.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Info overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-3">
                        <div className="text-white font-bold text-sm mb-2 line-clamp-2">{game.name}</div>
                        <div className="flex items-center justify-between">
                          <div className="text-purple-400 font-bold text-lg">
                            🔑 {keyValue} Keys
                          </div>
                          <div className="text-xs text-gray-300">
                            Play to Earn
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
              </>
            )}
          </div>
        )}


        {/* Victory Screen Modal */}
        {showVictory && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-vault-blue to-vault-dark rounded-xl p-8 max-w-2xl w-full border-4 border-vault-gold shadow-2xl animate-scale-up">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-5xl font-bold text-vault-gold mb-2">VICTORY!</h2>
                <p className="text-2xl text-vault-accent">All Games Unlocked!</p>
              </div>
              <div className="bg-vault-dark/50 rounded-lg p-6 mb-6 space-y-3">
                <div className="flex justify-between"><span className="text-gray-400">Total Games:</span><span className="font-bold text-vault-accent">{vaultGames.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Collection Power:</span><span className="font-bold text-green-400">{collectionPower.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Keys Earned:</span><span className="font-bold text-vault-gold">{liberationKeys}</span></div>
              </div>
              <button onClick={() => setShowVictory(false)} className="w-full bg-vault-gold text-vault-dark font-bold py-4 rounded-lg text-xl hover:bg-yellow-400 transition-colors">
                CONTINUE PLAYING
              </button>
            </div>
          </div>
        )}

        {/* Draw Modal */}
        {showDrawModal && drawnGame && (
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
                      onClick={handleCardReveal}
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
                      onClick={handleAcceptDraw}
                      className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-lg transition-all transform hover:scale-105"
                    >
                      ✅ Accept
                    </button>
                    <button
                      onClick={handleRedraw}
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
        )}

        {/* Celebration Modal - Key Game Completed! */}
        {showCelebration && celebrationData && (
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
                onClick={() => {
                  setShowCelebration(false);
                  setCelebrationData(null);
                }}
                className="w-full bg-gradient-to-r from-vault-gold via-yellow-400 to-vault-gold text-vault-dark font-bold py-4 rounded-lg text-xl hover:scale-105 transition-transform shadow-lg shadow-vault-gold/50"
              >
                🎮 CONTINUE PLAYING
              </button>
            </div>
          </div>
        )}

        {/* Dev Panel Button */}
        <button
          onClick={() => setShowDevPanel(!showDevPanel)}
          className="fixed bottom-4 right-4 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all z-40"
          title="Developer Tools"
        >
          ⚙️
        </button>

        {/* Steam ID Input Modal */}
        {showSteamIdInput && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-vault-blue to-vault-dark rounded-xl p-8 max-w-md w-full border-4 border-vault-gold shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-vault-gold mb-2">🎮 Welcome!</h2>
                <p className="text-gray-300">Enter your Steam ID to get started</p>
              </div>
              
              <input
                type="text"
                value={steamIdInputValue}
                onChange={(e) => setSteamIdInputValue(e.target.value)}
                placeholder="76561197970579347"
                className="w-full px-4 py-3 bg-vault-dark border-2 border-vault-gold/50 rounded-lg text-white text-center text-lg mb-4 focus:outline-none focus:border-vault-gold"
              />
              
              <button
                onClick={() => {
                  if (steamIdInputValue.trim()) {
                    const newSteamId = steamIdInputValue.trim();
                    setSteamId(newSteamId);
                    localStorage.setItem('steamId', newSteamId);
                    setShowSteamIdInput(false);
                    console.log('[Steam ID] Saved:', newSteamId);
                  }
                }}
                disabled={!steamIdInputValue.trim()}
                className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
                  steamIdInputValue.trim()
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
        )}

        {/* Dev Panel */}
        {showDevPanel && (
          <div className="fixed bottom-20 right-4 bg-vault-dark border-2 border-vault-accent rounded-lg p-4 shadow-2xl z-40 w-80">
            <h3 className="text-lg font-bold text-vault-accent mb-3">Dev Tools</h3>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  const defaultId = '76561197970579347';
                  setSteamIdInputValue(defaultId);
                  setShowSteamIdInput(true);
                  console.log('[Dev] Opening Steam ID input with default value');
                }} 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-semibold"
              >
                🆔 Change Steam ID
              </button>
              <button 
                onClick={testKeyGameDetection}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded font-semibold"
              >
                🧪 Test Key Detection
              </button>
              <button 
                onClick={() => {
                  if (vaultState && vaultState.pool1_unlocked) {
                    const newProgress = { ...vaultState.gameProgress };
                    
                    // Drain every game in Pool 1
                    vaultState.pool1_unlocked.forEach(appId => {
                      const game = games.find(g => g.appid === appId);
                      if (game) {
                        const maxPower = getMaxPower(game);
                        newProgress[appId] = {
                          currentPower: maxPower,
                          maxPower: maxPower,
                          isDrained: true,
                          lastPlaytime: game.playtime_forever,
                          drainedAt: Date.now(), // Set timestamp for proper recharge display
                        };
                      }
                    });
                    
                    setVaultState({
                      ...vaultState,
                      gameProgress: newProgress
                    });
                    console.log('[Dev] Drained all games in Pool 1');
                  }
                }} 
                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2 rounded font-semibold"
              >
                ⚠️ Drain Every Game
              </button>
              <button 
                onClick={() => {
                  if (vaultState && vaultState.gameProgress) {
                    const refreshed = autoRefreshAllDrained(vaultState.gameProgress);
                    setVaultState({
                      ...vaultState,
                      gameProgress: refreshed
                    });
                    console.log('[Dev] Reset all drained games');
                  }
                }} 
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded font-semibold"
              >
                ♻️ Reset All Drained
              </button>
              <button 
                onClick={() => {
                  if (vaultState && vaultState.pool2_hidden) {
                    // Move all Pool 2 games to Pool 1
                    const newPool1 = [...(vaultState.pool1_unlocked || []), ...(vaultState.pool2_hidden || [])];
                    setVaultState({
                      ...vaultState,
                      pool1_unlocked: newPool1,
                      pool2_hidden: [],
                    });
                    setUnlockedGames(newPool1);
                    console.log('[Dev] Emptied Pool 2 - moved all to Pool 1');
                  }
                }} 
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-semibold text-sm"
              >
                🗑️ Empty Pool 2
              </button>
              <button 
                onClick={() => {
                  if (vaultState && vaultState.pool3_keyGames) {
                    // Move all Pool 3 games to Pool 1
                    const newPool1 = [...(vaultState.pool1_unlocked || []), ...(vaultState.pool3_keyGames || [])];
                    setVaultState({
                      ...vaultState,
                      pool1_unlocked: newPool1,
                      pool3_keyGames: [],
                    });
                    setUnlockedGames(newPool1);
                    console.log('[Dev] Emptied Pool 3 - moved all to Pool 1');
                  }
                }} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded font-semibold text-sm"
              >
                🗑️ Empty Pool 3
              </button>
              <button onClick={() => setCollectionPower(p => p + 1000)} className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded font-semibold">+1000 Power</button>
              <button onClick={() => setLiberationKeys(k => k + 100)} className="w-full bg-vault-gold hover:bg-yellow-400 text-vault-dark py-2 rounded font-semibold">+100 Keys</button>
              <button 
                onClick={() => {
                  if(confirm('🚨 NUCLEAR RESET 🚨\n\nThis will:\n• Clear ALL save data\n• Reset your library\n• Reload the page\n• Reinitialize everything\n\nAre you sure?')){
                    // Clear all storage
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    // Reset ALL state to initial values
                    setGames([]);
                    setVaultGames([]);
                    setVaultState(null);
                    setShopSlots([]);
                    setCollectionPower(0);
                    setLiberationKeys(0);
                    setUnlockedGames(['vault-controller']);
                    setFeaturedGame(null);
                    setPoints(0);
                    
                    // Force reload
                    setTimeout(() => window.location.reload(), 100);
                  }
                }} 
                className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold text-sm border-2 border-red-400"
              >
                🚨 NUCLEAR RESET 🚨
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Separate component for virtualized grid
function GameGrid({
  vaultGames,
  filter,
  sortBy,
  featuredGame,
  points,
  handleSelectFeatured,
  handleUnlock,
  handlePlayLiberationKey,
}: {
  vaultGames: VaultGameState[];
  filter: 'all' | 'locked' | 'playable' | 'liberationKey';
  sortBy: 'default' | 'cost' | 'hours' | 'name' | 'passive';
  featuredGame: VaultGameState | null;
  points: number;
  handleSelectFeatured: (game: VaultGameState) => void;
  handleUnlock: (game: VaultGameState) => void;
  handlePlayLiberationKey: (game: VaultGameState) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_ROW = 6;

  // Filter and sort games
  const filteredGames = vaultGames
    .filter(game => filter === 'all' || game.state === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'cost':
          return a.unlockCost - b.unlockCost;
        case 'hours':
          return b.hoursPlayed - a.hoursPlayed;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'passive':
          return b.passiveRate - a.passiveRate;
        case 'default':
        default:
          if (a.state === 'playable' && b.state === 'playable') {
            return b.passiveRate - a.passiveRate;
          }
          return 0;
      }
    });

  // Calculate rows
  const rowCount = Math.ceil(filteredGames.length / ITEMS_PER_ROW);

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 310, // Estimated row height (card height + gap) - middle ground for 2:3 aspect ratio
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  return (
    <div className="bg-vault-gray rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Your Library ({filteredGames.length} games)</h2>
      
      <div
        ref={parentRef}
        className="h-[700px] overflow-y-auto scrollbar-hide relative"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            paddingTop: '8px',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * ITEMS_PER_ROW;
            const rowGames = filteredGames.slice(startIndex, startIndex + ITEMS_PER_ROW);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 px-2 py-1">
                  {rowGames.map((game) => (
                    <GameCard
                      key={game.appid}
                      game={game}
                      isFeatured={featuredGame?.appid === game.appid}
                      canAfford={points >= game.unlockCost}
                      handleSelectFeatured={handleSelectFeatured}
                      handleUnlock={handleUnlock}
                      handlePlayLiberationKey={handlePlayLiberationKey}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Separate GameCard component
function GameCard({
  game,
  isFeatured,
  canAfford,
  handleSelectFeatured,
  handleUnlock,
  handlePlayLiberationKey,
}: {
  game: VaultGameState;
  isFeatured: boolean;
  canAfford: boolean;
  handleSelectFeatured: (game: VaultGameState) => void;
  handleUnlock: (game: VaultGameState) => void;
  handlePlayLiberationKey: (game: VaultGameState) => void;
}) {
  const isLocked = game.state === 'locked';
  const isPlayable = game.state === 'playable';
  const isKey = game.state === 'liberationKey';

  return (
    <div
      onClick={() => !isLocked && handleSelectFeatured(game)}
      className={`group relative rounded-lg overflow-hidden transition-all ${
        isLocked
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer hover:scale-105'
      } ${
        isFeatured
          ? 'ring-4 ring-vault-accent shadow-lg shadow-vault-accent/50'
          : isKey
          ? 'ring-2 ring-vault-gold shadow-lg shadow-vault-gold/30'
          : isPlayable
          ? 'ring-2 ring-green-500/30'
          : ''
      }`}
    >
      {/* Game Box Art */}
      <div className="relative aspect-[2/3] bg-gradient-to-br from-vault-dark to-vault-gray">
        <img
          src={getLibraryCapsule(game.appid)}
          alt={game.name}
          onError={handleImageError}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* State indicator overlay */}
        {isLocked ? (
          // Centered lock for locked games
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl drop-shadow-2xl">🔒</span>
          </div>
        ) : (
          // Top-left indicator for other states
          <div className="absolute top-2 left-2">
            {isPlayable && !isFeatured && <span className="text-3xl drop-shadow-lg">✅</span>}
            {isPlayable && isFeatured && <span className="text-3xl drop-shadow-lg animate-pulse">⭐</span>}
            {isKey && <span className="text-3xl drop-shadow-lg animate-pulse">⭐</span>}
          </div>
        )}

        {/* Hover overlay with info */}
        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
          <div>
            <div className="font-bold text-sm mb-1 line-clamp-2">{game.name}</div>
            <div className="text-xs text-gray-300">
              {game.hoursPlayed.toFixed(1)} hrs
            </div>
          </div>
          
          <div className="text-xs space-y-1">
            {isKey && (
              <div className="text-vault-gold font-semibold">
                Play 30 min to unlock FREE!
              </div>
            )}
            {isLocked && (
              <div className="text-red-400">
                Unlock: {game.unlockCost.toLocaleString()}pts
              </div>
            )}
            {isPlayable && (
              <div className="text-green-400">
                +{game.passiveRate}/sec
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isLocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnlock(game);
              }}
              disabled={!canAfford}
              className={`w-full py-1 px-2 rounded text-xs font-bold transition-all ${
                canAfford
                  ? 'bg-vault-accent text-vault-dark hover:bg-blue-400'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {canAfford ? '🔓 UNLOCK' : 'LOCKED'}
            </button>
          )}
          {isKey && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayLiberationKey(game);
              }}
              className="w-full bg-vault-gold text-vault-dark hover:bg-yellow-400 font-bold py-1 px-2 rounded text-xs transition-all"
            >
              🎮 PLAY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
