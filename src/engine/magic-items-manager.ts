// Magic item management: Books, Potions, Runes, Wall Rings.
// All functions are pure: they return new state, never mutate.

import type { VillageState, ResourceAmounts } from '../types/village.ts';

// -- Types --

export type MagicItemType = 'book' | 'potion' | 'rune' | 'wall_ring';

export interface MagicItem {
  id: string;
  name: string;
  type: MagicItemType;
  description: string;
  maxStack: number;
}

export interface MagicItemInventory {
  items: Record<string, number>; // itemId -> count
}

// -- Item Definitions --

const MAGIC_ITEMS: MagicItem[] = [
  { id: 'book_heroes', name: 'Book of Heroes', type: 'book', description: 'Instantly completes a hero upgrade', maxStack: 1 },
  { id: 'book_building', name: 'Book of Building', type: 'book', description: 'Instantly completes a building upgrade', maxStack: 1 },
  { id: 'book_spells', name: 'Book of Spells', type: 'book', description: 'Instantly completes a spell upgrade', maxStack: 1 },
  { id: 'book_everything', name: 'Book of Everything', type: 'book', description: 'Instantly completes any upgrade', maxStack: 1 },
  { id: 'research_potion', name: 'Research Potion', type: 'potion', description: 'Boosts lab speed 24x for 1 hour', maxStack: 5 },
  { id: 'resource_potion', name: 'Resource Potion', type: 'potion', description: 'Boosts collectors 2x for 1 day', maxStack: 5 },
  { id: 'builder_potion', name: 'Builder Potion', type: 'potion', description: 'Boosts builder speed 10x for 1 hour', maxStack: 5 },
  { id: 'training_potion', name: 'Training Potion', type: 'potion', description: 'Boosts troop training 4x for 1 hour', maxStack: 5 },
  { id: 'power_potion', name: 'Power Potion', type: 'potion', description: 'Boosts troops to max level for 1 hour', maxStack: 5 },
  { id: 'hero_potion', name: 'Hero Potion', type: 'potion', description: 'Boosts heroes to max level for 1 hour', maxStack: 5 },
  { id: 'rune_gold', name: 'Rune of Gold', type: 'rune', description: 'Fills gold storage to max', maxStack: 1 },
  { id: 'rune_elixir', name: 'Rune of Elixir', type: 'rune', description: 'Fills elixir storage to max', maxStack: 1 },
  { id: 'rune_dark_elixir', name: 'Rune of Dark Elixir', type: 'rune', description: 'Fills dark elixir storage to max', maxStack: 1 },
  { id: 'wall_ring', name: 'Wall Ring', type: 'wall_ring', description: 'Instantly upgrades one wall segment', maxStack: 25 },
];

const ITEM_MAP = new Map(MAGIC_ITEMS.map((item) => [item.id, item]));

// -- Public API --

/** Create an empty inventory. */
export function createInventory(): MagicItemInventory {
  return { items: {} };
}

/** Get all magic item definitions. */
export function getAllMagicItems(): MagicItem[] {
  return [...MAGIC_ITEMS];
}

/** Get a magic item definition by ID. */
export function getMagicItem(itemId: string): MagicItem | undefined {
  return ITEM_MAP.get(itemId);
}

/** Get the count of a specific item in the inventory. */
export function getItemCount(inventory: MagicItemInventory, itemId: string): number {
  return inventory.items[itemId] ?? 0;
}

/** Add an item to the inventory (respects max stack). Returns null if at max. */
export function addItem(
  inventory: MagicItemInventory,
  itemId: string,
): MagicItemInventory | null {
  const item = ITEM_MAP.get(itemId);
  if (!item) return null;

  const current = inventory.items[itemId] ?? 0;
  if (current >= item.maxStack) return null;

  return {
    items: { ...inventory.items, [itemId]: current + 1 },
  };
}

/** Remove one item from inventory. Returns null if none available. */
export function removeItem(
  inventory: MagicItemInventory,
  itemId: string,
): MagicItemInventory | null {
  const current = inventory.items[itemId] ?? 0;
  if (current <= 0) return null;

  const newItems = { ...inventory.items };
  if (current === 1) {
    delete newItems[itemId];
  } else {
    newItems[itemId] = current - 1;
  }

  return { items: newItems };
}

// -- Item Usage --

/**
 * Use a Book of Building: instantly complete one building upgrade.
 * Returns updated village state and inventory, or null if not usable.
 */
export function useBookOfBuilding(
  state: VillageState,
  inventory: MagicItemInventory,
  buildingInstanceId: string,
): { state: VillageState; inventory: MagicItemInventory } | null {
  const itemId = 'book_building';
  if (getItemCount(inventory, itemId) <= 0) return null;

  const building = state.buildings.find(
    (b) => b.instanceId === buildingInstanceId && b.isUpgrading,
  );
  if (!building) return null;

  const newInventory = removeItem(inventory, itemId);
  if (!newInventory) return null;

  // Complete the upgrade instantly
  const newState: VillageState = {
    ...state,
    buildings: state.buildings.map((b) =>
      b.instanceId === buildingInstanceId
        ? { ...b, level: b.level + 1, isUpgrading: false, upgradeTimeRemaining: 0, assignedBuilder: null }
        : b,
    ),
    builders: state.builders.map((b) =>
      b.assignedTo === buildingInstanceId
        ? { ...b, assignedTo: null, timeRemaining: 0 }
        : b,
    ),
  };

  return { state: newState, inventory: newInventory };
}

/**
 * Use a Rune: fill a specific resource storage to max.
 * Returns updated village state and inventory, or null if not usable.
 */
export function useRune(
  state: VillageState,
  inventory: MagicItemInventory,
  runeId: string,
  maxCapacity: number,
): { state: VillageState; inventory: MagicItemInventory } | null {
  if (getItemCount(inventory, runeId) <= 0) return null;

  const resourceMap: Record<string, keyof ResourceAmounts> = {
    rune_gold: 'gold',
    rune_elixir: 'elixir',
    rune_dark_elixir: 'darkElixir',
  };

  const resourceKey = resourceMap[runeId];
  if (!resourceKey) return null;

  const newInventory = removeItem(inventory, runeId);
  if (!newInventory) return null;

  const newState: VillageState = {
    ...state,
    resources: { ...state.resources, [resourceKey]: maxCapacity },
  };

  return { state: newState, inventory: newInventory };
}

/**
 * Use a Wall Ring: instantly upgrade one wall segment.
 * Returns updated walls array and inventory, or null if not usable.
 */
export function useWallRing(
  state: VillageState,
  inventory: MagicItemInventory,
  wallInstanceId: string,
): { state: VillageState; inventory: MagicItemInventory } | null {
  if (getItemCount(inventory, 'wall_ring') <= 0) return null;

  const wall = state.walls.find((w) => w.instanceId === wallInstanceId);
  if (!wall) return null;

  const newInventory = removeItem(inventory, 'wall_ring');
  if (!newInventory) return null;

  const newState: VillageState = {
    ...state,
    walls: state.walls.map((w) =>
      w.instanceId === wallInstanceId ? { ...w, level: w.level + 1 } : w,
    ),
  };

  return { state: newState, inventory: newInventory };
}

/** Get all items in inventory with their definitions. */
export function getInventoryContents(
  inventory: MagicItemInventory,
): Array<{ item: MagicItem; count: number }> {
  const result: Array<{ item: MagicItem; count: number }> = [];

  for (const [itemId, count] of Object.entries(inventory.items)) {
    if (count <= 0) continue;
    const item = ITEM_MAP.get(itemId);
    if (!item) continue;
    result.push({ item, count });
  }

  return result;
}
