// Zustand-based game state store.
// Centralizes VillageState and all actions that modify it.

import { create } from 'zustand';
import type { VillageState, PlacedBuilding, ResourceAmounts } from '../types/village.ts';
import { createStarterVillage } from '../engine/village-manager.ts';
import { tickResourceProduction, collectFromBuilding, collectAllResources, getStorageCapacity } from '../engine/resource-manager.ts';
import { getAvailableBuilder, assignBuilder, freeBuilder } from '../engine/builder-manager.ts';
import { tickSuperTroopTimers } from '../engine/super-troop-manager.ts';
import type { SuperTroopState } from '../engine/super-troop-manager.ts';
import type { MagicItemInventory } from '../engine/magic-items-manager.ts';
import { createSaveManager } from '../engine/save-manager.ts';
import type { SaveManager } from '../engine/save-manager.ts';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface GameActions {
  // Village management
  setVillageState: (state: VillageState) => void;
  placeBuilding: (building: PlacedBuilding) => void;
  removeBuilding: (instanceId: string) => void;
  startUpgrade: (instanceId: string, cost: number, resource: 'gold' | 'elixir' | 'darkElixir', time: number) => boolean;
  completeUpgrade: (instanceId: string) => void;

  // Resource collection
  collectResource: (instanceId: string) => void;
  collectAll: () => void;
  addResources: (amounts: Partial<ResourceAmounts>) => void;
  spendResources: (amounts: Partial<ResourceAmounts>) => boolean;

  // Game clock tick
  tick: (deltaMs: number) => void;

  // Army management
  setArmy: (army: VillageState['army']) => void;
  setSpells: (spells: VillageState['spells']) => void;

  // Save/Load
  save: (slotId?: string) => boolean;
  load: (slotId: string) => boolean;
  enableAutoSave: (intervalMs?: number) => void;
  disableAutoSave: () => void;

  // Navigation/meta
  setTrophies: (trophies: number) => void;
  setLeague: (league: string) => void;

  // Super troops
  setSuperTroopState: (state: SuperTroopState) => void;

  // Magic items
  setInventory: (inventory: MagicItemInventory) => void;
}

export interface GameStore extends GameActions {
  village: VillageState;
  superTroopState: SuperTroopState;
  inventory: MagicItemInventory;
  storageCaps: ResourceAmounts;
  saveManager: SaveManager;
}

// ---------------------------------------------------------------------------
// Store creation
// ---------------------------------------------------------------------------

const saveManager = createSaveManager();

export const useGameStore = create<GameStore>((set, get) => {
  const initialVillage = createStarterVillage();

  return {
    village: initialVillage,
    superTroopState: { activeBoosts: [] },
    inventory: { items: {} },
    storageCaps: getStorageCapacity(initialVillage),
    saveManager,

    // -- Village management --

    setVillageState: (state) =>
      set({ village: state, storageCaps: getStorageCapacity(state) }),

    placeBuilding: (building) =>
      set((s) => {
        const village = {
          ...s.village,
          buildings: [...s.village.buildings, building],
        };
        return { village, storageCaps: getStorageCapacity(village) };
      }),

    removeBuilding: (instanceId) =>
      set((s) => {
        const village = {
          ...s.village,
          buildings: s.village.buildings.filter((b) => b.instanceId !== instanceId),
        };
        return { village, storageCaps: getStorageCapacity(village) };
      }),

    startUpgrade: (instanceId, cost, resource, time) => {
      const state = get();
      const village = state.village;

      if (village.resources[resource] < cost) return false;

      const builder = getAvailableBuilder(village);
      if (!builder) return false;

      const afterAssign = assignBuilder(village, builder.id, instanceId, time);
      if (!afterAssign) return false;

      const updatedVillage: VillageState = {
        ...afterAssign,
        resources: {
          ...afterAssign.resources,
          [resource]: afterAssign.resources[resource] - cost,
        },
        buildings: afterAssign.buildings.map((b) =>
          b.instanceId === instanceId
            ? { ...b, isUpgrading: true, upgradeTimeRemaining: time, assignedBuilder: builder.id }
            : b,
        ),
      };

      set({ village: updatedVillage, storageCaps: getStorageCapacity(updatedVillage) });
      return true;
    },

    completeUpgrade: (instanceId) =>
      set((s) => {
        const building = s.village.buildings.find((b) => b.instanceId === instanceId);
        if (!building || !building.isUpgrading) return s;

        let village = {
          ...s.village,
          buildings: s.village.buildings.map((b) =>
            b.instanceId === instanceId
              ? { ...b, level: b.level + 1, isUpgrading: false, upgradeTimeRemaining: 0, assignedBuilder: null }
              : b,
          ),
        };

        if (building.assignedBuilder !== null) {
          const freed = freeBuilder(village, building.assignedBuilder);
          if (freed) village = freed;
        }

        return { village, storageCaps: getStorageCapacity(village) };
      }),

    // -- Resource collection --

    collectResource: (instanceId) =>
      set((s) => {
        const village = collectFromBuilding(s.village, instanceId);
        return { village };
      }),

    collectAll: () =>
      set((s) => {
        const village = collectAllResources(s.village);
        return { village };
      }),

    addResources: (amounts) =>
      set((s) => {
        const caps = s.storageCaps;
        const res = { ...s.village.resources };

        if (amounts.gold !== undefined) res.gold = Math.min(res.gold + amounts.gold, caps.gold);
        if (amounts.elixir !== undefined) res.elixir = Math.min(res.elixir + amounts.elixir, caps.elixir);
        if (amounts.darkElixir !== undefined) res.darkElixir = Math.min(res.darkElixir + amounts.darkElixir, caps.darkElixir);
        if (amounts.gems !== undefined) res.gems += amounts.gems;

        return { village: { ...s.village, resources: res } };
      }),

    spendResources: (amounts) => {
      const state = get();
      const res = state.village.resources;

      if ((amounts.gold ?? 0) > res.gold) return false;
      if ((amounts.elixir ?? 0) > res.elixir) return false;
      if ((amounts.darkElixir ?? 0) > res.darkElixir) return false;
      if ((amounts.gems ?? 0) > res.gems) return false;

      const updated: ResourceAmounts = {
        gold: res.gold - (amounts.gold ?? 0),
        elixir: res.elixir - (amounts.elixir ?? 0),
        darkElixir: res.darkElixir - (amounts.darkElixir ?? 0),
        gems: res.gems - (amounts.gems ?? 0),
      };

      set({ village: { ...state.village, resources: updated } });
      return true;
    },

    // -- Game clock --

    tick: (deltaMs) =>
      set((s) => {
        // Tick resource production
        let village = tickResourceProduction(s.village, deltaMs);

        // Tick builder timers
        const completedBuildings: string[] = [];
        const builders = village.builders.map((b) => {
          if (!b.assignedTo || b.timeRemaining <= 0) return b;
          const remaining = b.timeRemaining - deltaMs * village.gameClockSpeed;
          if (remaining <= 0) {
            completedBuildings.push(b.assignedTo);
            return { ...b, timeRemaining: 0 };
          }
          return { ...b, timeRemaining: remaining };
        });

        // Update building upgrade timers
        const buildings = village.buildings.map((b) => {
          if (!b.isUpgrading) return b;
          const remaining = b.upgradeTimeRemaining - deltaMs * village.gameClockSpeed;
          if (remaining <= 0) {
            return { ...b, upgradeTimeRemaining: 0 };
          }
          return { ...b, upgradeTimeRemaining: remaining };
        });

        village = { ...village, builders, buildings };

        // Tick super troop timers
        const superTroopState = tickSuperTroopTimers(s.superTroopState, deltaMs * village.gameClockSpeed);

        // Update total play time
        village = { ...village, totalPlayTime: village.totalPlayTime + deltaMs };

        return { village, superTroopState };
      }),

    // -- Army --

    setArmy: (army) =>
      set((s) => ({ village: { ...s.village, army } })),

    setSpells: (spells) =>
      set((s) => ({ village: { ...s.village, spells } })),

    // -- Save/Load --

    save: (slotId) => {
      const state = get();
      return state.saveManager.save(state.village, slotId);
    },

    load: (slotId) => {
      const state = get();
      const loaded = state.saveManager.load(slotId);
      if (!loaded) return false;
      set({ village: loaded, storageCaps: getStorageCapacity(loaded) });
      return true;
    },

    enableAutoSave: (intervalMs) => {
      const state = get();
      state.saveManager.enableAutoSave(() => get().village, intervalMs);
    },

    disableAutoSave: () => {
      const state = get();
      state.saveManager.disableAutoSave();
    },

    // -- Navigation/meta --

    setTrophies: (trophies) =>
      set((s) => ({ village: { ...s.village, trophies } })),

    setLeague: (league) =>
      set((s) => ({ village: { ...s.village, league } })),

    // -- Super troops --

    setSuperTroopState: (superTroopState) =>
      set({ superTroopState }),

    // -- Magic items --

    setInventory: (inventory) =>
      set({ inventory }),
  };
});
