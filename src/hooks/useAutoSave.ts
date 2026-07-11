// Auto-save hook: periodically saves village state to localStorage.
// Works with the existing useState-based state management.

import { useEffect, useRef } from 'react';
import type { VillageState } from '../types/village.ts';
import { createSaveManager } from '../engine/save-manager.ts';

const DEFAULT_INTERVAL_MS = 30_000; // 30 seconds

const saveManager = createSaveManager();

/**
 * Periodically auto-saves the village state to localStorage.
 * Also saves on component unmount for safety. When `onSaved` is supplied it is
 * called with the save timestamp after each successful write, letting the UI
 * surface a "Saved" indicator.
 */
export function useAutoSave(
  state: VillageState,
  intervalMs: number = DEFAULT_INTERVAL_MS,
  onSaved?: (timestamp: number) => void,
): void {
  const stateRef = useRef(state);
  const onSavedRef = useRef(onSaved);

  // Keep the refs in sync after each committed render (refs must not be
  // written during render)
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const persist = () => {
    if (saveManager.save(stateRef.current, 'autosave')) {
      onSavedRef.current?.(Date.now());
    }
  };

  useEffect(() => {
    const id = setInterval(persist, intervalMs);

    return () => {
      clearInterval(id);
      // Save one last time on unmount
      persist();
    };
  }, [intervalMs]);
}

/** Load the auto-saved state (if any). Returns null if no auto-save exists. */
export function loadAutoSave(): VillageState | null {
  return saveManager.load('autosave');
}
