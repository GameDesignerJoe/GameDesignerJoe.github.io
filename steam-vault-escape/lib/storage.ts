// localStorage wrapper for save/load - v1.5

import { VaultState } from '@/types/vault';
import { STORAGE_KEY, STORAGE_VERSION } from './constants';

/**
 * Save vault state to localStorage
 * Supports both v1.0 and v1.5 formats during migration
 */
export function saveToStorage(state: VaultState): void {
  try {
    const serialized = {
      ...state,
      version: STORAGE_VERSION, // Ensure version is always current
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('[Storage] Failed to save state:', error);
  }
}

/**
 * Load vault state from localStorage
 * Handles version migration from v1.0 to v1.5
 */
export function loadFromStorage(): VaultState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    // Check version
    if (parsed.version === '1.5') {
      // v1.5 save - return as-is
      return parsed as VaultState;
    } else if (parsed.version === '1.0') {
      // v1.0 save - return for backward compatibility
      // The app will continue using v1.0 until we implement full v1.5 logic
      console.log('[Storage] Loading v1.0 save format');
      return parsed as VaultState;
    } else {
      // Unknown version - clear and start fresh
      console.warn('[Storage] Unknown save version, clearing data');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  } catch (error) {
    console.error('[Storage] Failed to load state:', error);
    return null;
  }
}

/**
 * Migrate v1.0 save to v1.5 format
 * Call this when implementing full v1.5 logic
 */
export function migrateToV15(oldState: VaultState): VaultState {
  // This will be implemented when we build the full v1.5 pool system
  // For now, just clear old saves and start fresh
  console.log('[Storage] Migration to v1.5 - starting fresh');
  return {
    version: '1.5',
    collectionPower: 0,
    liberationKeys: 0,
    pool1_unlocked: [],
    pool2_hidden: [],
    pool3_keyGames: [],
    shopSlots: [],
    gameProgress: {},
    lastSync: Date.now(),
    steamId: '',
  };
}

/**
 * Clear saved state
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Storage] Cleared');
  } catch (error) {
    console.error('[Storage] Failed to clear:', error);
  }
}
