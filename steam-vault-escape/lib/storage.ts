// localStorage wrapper for save/load

import { VaultState } from '@/types/vault';
import { STORAGE_KEY, STORAGE_VERSION } from './constants';

interface StoredState {
  version: string;
  points: number;
  unlockedGames: Array<number | string>;
  featuredGame: number | string | null;
  cachedLibrary: any[];
  lastRefresh: number;
}

/**
 * Save vault state to localStorage
 */
export function saveToStorage(state: VaultState): void {
  try {
    const serialized: StoredState = {
      version: STORAGE_VERSION,
      points: state.points,
      unlockedGames: state.unlockedGames,
      featuredGame: state.featuredGame,
      cachedLibrary: state.cachedLibrary,
      lastRefresh: state.lastRefresh,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

/**
 * Load vault state from localStorage
 */
export function loadFromStorage(): VaultState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed: StoredState = JSON.parse(stored);
    
    // Version check
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('Save version mismatch, clearing data');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return {
      points: parsed.points,
      unlockedGames: parsed.unlockedGames,
      featuredGame: parsed.featuredGame,
      cachedLibrary: parsed.cachedLibrary,
      lastRefresh: parsed.lastRefresh,
      version: parsed.version,
    };
  } catch (error) {
    console.error('Failed to load state:', error);
    return null;
  }
}

/**
 * Clear saved state
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear storage:', error);
  }
}
