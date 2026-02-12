// Auto-save hook: periodically saves village state to localStorage.
// Works with the existing useState-based state management.

import { useEffect, useRef } from 'react';
import type { VillageState } from '../types/village.ts';
import { createSaveManager } from '../engine/save-manager.ts';

const DEFAULT_INTERVAL_MS = 30_000; // 30 seconds

const saveManager = createSaveManager();

/**
 * Periodically auto-saves the village state to localStorage.
 * Also saves on component unmount for safety.
 */
export function useAutoSave(
  state: VillageState,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): void {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const id = setInterval(() => {
      saveManager.save(stateRef.current, 'autosave');
    }, intervalMs);

    return () => {
      clearInterval(id);
      // Save one last time on unmount
      saveManager.save(stateRef.current, 'autosave');
    };
  }, [intervalMs]);
}

/** Load the auto-saved state (if any). Returns null if no auto-save exists. */
export function loadAutoSave(): VillageState | null {
  return saveManager.load('autosave');
}
