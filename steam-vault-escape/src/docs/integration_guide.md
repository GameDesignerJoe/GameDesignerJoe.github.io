# Integration Guide: Custom Hooks into page.tsx

## Summary
We've created 5 custom hooks that will reduce page.tsx from **1,175 lines to ~400-500 lines** (60% reduction).

## Step 1: Update Imports

**REPLACE this import section:**
```typescript
import { useEffect, useState, useRef } from 'react';
```

**WITH:**
```typescript
import { useEffect, useState } from 'react';
import { useModalManager, useSteamLibrary, useAutoSave, usePassiveRegeneration, useImageRetry } from './hooks';
```

## Step 2: Replace Modal State with useModalManager

**REMOVE these state declarations (lines ~60-75):**
```typescript
const [showVictory, setShowVictory] = useState(false);
const [showDrawModal, setShowDrawModal] = useState(false);
const [drawSlotIndex, setDrawSlotIndex] = useState<number | null>(null);
const [drawnGame, setDrawnGame] = useState<SteamGame | null>(null);
const [revealedCard, setRevealedCard] = useState(false);
const [drawnGamesThisSession, setDrawnGamesThisSession] = useState<number[]>([]);
const [showSteamIdInput, setShowSteamIdInput] = useState(false);
const [steamIdInputValue, setSteamIdInputValue] = useState('');
const [showCelebration, setShowCelebration] = useState(false);
const [celebrationData, setCelebrationData] = useState<{...} | null>(null);
```

**ADD instead:**
```typescript
const [modalState, modalActions] = useModalManager();
```

**Then update all references:**
- `showVictory` → `modalState.showVictory`
- `setShowVictory(true)` → `modalActions.openVictory()`
- `showDrawModal` → `modalState.showDrawModal`
- `drawnGame` → `modalState.drawnGame`
- etc.

## Step 3: Integrate useSteamLibrary Hook

**ADD after state declarations:**
```typescript
const { fetchLibrary, handleRefresh } = useSteamLibrary(
  steamId,
  games,
  vaultState,
  isRefreshing,
  setGames,
  setIsLoading,
  setError,
  setIsRefreshing,
  setIsInitializingPools,
  setVaultState,
  setShopSlots,
  setUnlockedGames,
  setFeaturedGame,
  setLiberationKeys,
  modalActions.openCelebration,
  setHasInitializedOnce,
  hasInitializedOnce,
  liberationKeys
);
```

**REMOVE the standalone fetchLibrary function (lines ~650-750)**
**REMOVE the standalone handleRefresh function (lines ~850-950)**

## Step 4: Integrate useAutoSave Hook

**ADD after useSteamLibrary:**
```typescript
useAutoSave(vaultState, points, unlockedGames, featuredGame, games, lastRefresh);
```

**REMOVE these useEffect blocks (lines ~180-250):**
- The debounced auto-save useEffect
- The beforeunload useEffect

## Step 5: Integrate usePassiveRegeneration Hook

**ADD:**
```typescript
usePassiveRegeneration(vaultState, games, setVaultState);
```

**REMOVE the passive regeneration useEffect block (lines ~320-380)**

## Step 6: Integrate useImageRetry Hook

**ADD:**
```typescript
useImageRetry(vaultState, games, featuredGame, shopSlots, setLastRefresh);
```

**REMOVE the image retry useEffect block (lines ~280-320)**

## Step 7: Remove Dead Code

**DELETE these unused components at the bottom (lines ~1050-1175):**
- `GameGrid` component
- `GameCard` component

These were defined but never used in the JSX.

## Step 8: Update Modal References in JSX

Throughout the JSX, update modal references:
- `showSteamIdInput` → `modalState.showSteamIdInput`
- `steamIdInputValue` → `modalState.steamIdInputValue`
- `setSteamIdInputValue` → `modalActions.setSteamIdInputValue`
- `setShowSteamIdInput(false)` → `modalActions.closeSteamIdInput()`

Similar for all other modals (victory, celebration, draw).

## Expected Result

**Before:** 1,175 lines
**After:** ~400-500 lines (60% reduction)

**Benefits:**
✅ Cleaner code structure
✅ Reusable hooks across components
✅ Easier to test individual pieces
✅ Better separation of concerns
✅ Much easier for AI to parse and understand
✅ Reduced cognitive load when reading the file

## Testing Checklist

After integration, test:
- [ ] Game loads correctly
- [ ] Clicking games generates power
- [ ] Auto-save works
- [ ] Passive regeneration works
- [ ] Image retry works
- [ ] All modals open/close correctly
- [ ] Draw system works
- [ ] Shop unlocking works
- [ ] Dev panel works
