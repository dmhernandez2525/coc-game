import type { VillageState } from '../types/village';

const SAVE_KEY_PREFIX = 'coc_save_';
const INDEX_KEY = 'coc_saves_index';
const AUTOSAVE_SLOT = 'autosave';

export interface SaveSlot {
  id: string;
  name: string;
  timestamp: number;
  townHallLevel: number;
}

export interface SaveManager {
  save(state: VillageState, slotId?: string): boolean;
  load(slotId: string): VillageState | null;
  delete(slotId: string): boolean;
  listSlots(): SaveSlot[];
  enableAutoSave(getState: () => VillageState, intervalMs?: number): void;
  disableAutoSave(): void;
  isValidSave(data: unknown): data is VillageState;
}

function storageKey(slotId: string): string {
  return `${SAVE_KEY_PREFIX}${slotId}`;
}

function loadIndex(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SaveSlot[];
  } catch {
    return [];
  }
}

function saveIndex(slots: SaveSlot[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(slots));
}

const REQUIRED_KEYS: Array<keyof VillageState> = [
  'version',
  'townHallLevel',
  'buildings',
  'resources',
  'builders',
];

function isValidSave(data: unknown): data is VillageState {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  return REQUIRED_KEYS.every((key) => key in record);
}

export function createSaveManager(): SaveManager {
  let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

  const manager: SaveManager = {
    save(state: VillageState, slotId = 'slot1'): boolean {
      try {
        const serialized = JSON.stringify(state);
        localStorage.setItem(storageKey(slotId), serialized);

        // Update index
        const slots = loadIndex();
        const existingIdx = slots.findIndex((s) => s.id === slotId);
        const slotMeta: SaveSlot = {
          id: slotId,
          name: `Save ${slotId}`,
          timestamp: Date.now(),
          townHallLevel: state.townHallLevel,
        };

        if (existingIdx >= 0) {
          slots[existingIdx] = slotMeta;
        } else {
          slots.push(slotMeta);
        }
        saveIndex(slots);
        return true;
      } catch {
        return false;
      }
    },

    load(slotId: string): VillageState | null {
      try {
        const raw = localStorage.getItem(storageKey(slotId));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isValidSave(parsed)) return null;
        return parsed;
      } catch {
        return null;
      }
    },

    delete(slotId: string): boolean {
      const key = storageKey(slotId);
      if (localStorage.getItem(key) === null) return false;
      localStorage.removeItem(key);

      const slots = loadIndex().filter((s) => s.id !== slotId);
      saveIndex(slots);
      return true;
    },

    listSlots(): SaveSlot[] {
      return loadIndex();
    },

    enableAutoSave(getState: () => VillageState, intervalMs = 60_000): void {
      manager.disableAutoSave();
      autoSaveInterval = setInterval(() => {
        manager.save(getState(), AUTOSAVE_SLOT);
      }, intervalMs);
    },

    disableAutoSave(): void {
      if (autoSaveInterval !== null) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
      }
    },

    isValidSave,
  };

  return manager;
}
