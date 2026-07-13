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

const CURRENT_SAVE_VERSION = 1;

const RESOURCE_KEYS = ['gold', 'elixir', 'darkElixir', 'gems'] as const;

function isValidSave(data: unknown): data is VillageState {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  if (record.version !== CURRENT_SAVE_VERSION) return false;
  if (typeof record.townHallLevel !== 'number') return false;
  if (!Array.isArray(record.buildings) || !Array.isArray(record.builders)) return false;
  const resources = record.resources as Record<string, unknown> | null;
  if (typeof resources !== 'object' || resources === null) return false;
  return RESOURCE_KEYS.every((key) => typeof resources[key] === 'number');
}

/**
 * Fill in fields that older or partial saves may lack so downstream
 * consumers (storage math, army UI, campaign screens) never crash.
 * Fields already present with the right shape are passed through untouched.
 */
function normalizeSave(data: VillageState): VillageState {
  return {
    ...data,
    walls: Array.isArray(data.walls) ? data.walls : [],
    traps: Array.isArray(data.traps) ? data.traps : [],
    obstacles: Array.isArray(data.obstacles) ? data.obstacles : [],
    army: Array.isArray(data.army) ? data.army : [],
    spells: Array.isArray(data.spells) ? data.spells : [],
    heroes: Array.isArray(data.heroes) ? data.heroes : [],
    ...(data.troopLevels && typeof data.troopLevels === 'object' ? { troopLevels: data.troopLevels } : {}),
    ...(data.activeResearch !== undefined ? { activeResearch: data.activeResearch } : {}),
    ores: data.ores ?? { shinyOre: 0, glowyOre: 0, starryOre: 0 },
    ownedEquipment: Array.isArray(data.ownedEquipment) ? data.ownedEquipment : [],
    ownedPets: Array.isArray(data.ownedPets) ? data.ownedPets : [],
    campaignProgress: data.campaignProgress ?? { levels: [], totalStars: 0 },
    trophies: typeof data.trophies === 'number' ? data.trophies : 0,
    league: typeof data.league === 'string' ? data.league : 'Unranked',
    obstacleCounter: typeof data.obstacleCounter === 'number' ? data.obstacleCounter : 0,
    lastSaveTimestamp: typeof data.lastSaveTimestamp === 'number' ? data.lastSaveTimestamp : 0,
    totalPlayTime: typeof data.totalPlayTime === 'number' ? data.totalPlayTime : 0,
    gameClockSpeed: typeof data.gameClockSpeed === 'number' ? data.gameClockSpeed : 1,
  };
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
        return normalizeSave(parsed);
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
