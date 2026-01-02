# Page.tsx Refactoring Plan

## Current State
- **1,175 lines** of code
- 25+ useState hooks
- 10+ useEffect hooks
- Duplicate GameGrid/GameCard components at bottom (unused)
- Mixed concerns (UI, business logic, state management)

## Refactoring Strategy

### Phase 1: Custom Hooks (COMPLETED ✅)
Created 5 custom hooks:
1. `useSteamLibrary` - fetchLibrary, handleRefresh 
2. `useAutoSave` - auto-save and beforeunload logic
3. `usePassiveRegeneration` - passive regen system
4. `useImageRetry` - failed image retry system
5. `useModalManager` - centralized modal state

### Phase 2: Integrate Hooks into page.tsx
Replace existing useEffect blocks with custom hooks:

**Remove:**
- Lines that handle fetchLibrary (move to useSteamLibrary)
- Lines that handle handleRefresh (move to useSteamLibrary)  
- Auto-save useEffect blocks (replaced by useAutoSave)
- Passive regen useEffect (replaced by usePassiveRegeneration)
- Image retry useEffect (replaced by useImageRetry)
- Modal state variables (replaced by useModalManager)

**Keep:**
- Game handlers (handleClick, handleSelectFeatured, etc.)
- Draw/Shop/Dev panel logic
- Render/JSX

### Phase 3: Remove Dead Code
- Remove unused GameGrid component (lines ~1050-1100)
- Remove unused GameCard component (lines ~1100-1175)

## Expected Result
**Target: 400-500 lines** (down from 1,175)
- Cleaner separation of concerns
- Reusable hooks
- Easier to test and maintain
- Better for AI to parse and understand

## Files Created
- ✅ `app/hooks/useSteamLibrary.ts`
- ✅ `app/hooks/useAutoSave.ts`
- ✅ `app/hooks/usePassiveRegeneration.ts`
- ✅ `app/hooks/useImageRetry.ts`
- ✅ `app/hooks/useModalManager.ts`
