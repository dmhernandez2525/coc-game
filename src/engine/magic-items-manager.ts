// Magic item management: Books, Potions, Runes, Wall Rings.
// All functions are pure: they return new state, never mutate.

import type { VillageState, ResourceAmounts, ActivePotionBoost } from '../types/village.ts';
import type { TrainedTroop, OwnedHero } from '../types/village.ts';
import { getStorageCapacity } from './resource-manager.ts';
import { getHeroStats } from './hero-manager.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { getHero } from '../data/loaders/hero-loader.ts';
import { gemsAndItemsData, wallData } from '../data/loaders/economy-loader.ts';

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

// -- Internal effect helpers --

/** Instantly finish an in-progress building upgrade and free its builder. */
function completeBuildingUpgrade(state: VillageState, buildingInstanceId: string): VillageState {
  return {
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
}

/** Instantly finish an in-progress hero upgrade (mirrors tickHeroUpgrades). */
function completeHeroUpgrade(hero: OwnedHero): OwnedHero {
  const newLevel = hero.level + 1;
  const stats = getHeroStats(hero.name, newLevel);
  return {
    ...hero,
    level: newLevel,
    currentHp: stats?.hitpoints ?? hero.currentHp,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
  };
}

const SPELL_UPGRADE_BUILDINGS = ['Spell Factory', 'Dark Spell Factory'];

function findUpgradingBuilding(state: VillageState, buildingIds?: string[]): string | null {
  const match = state.buildings.find(
    (b) => b.isUpgrading && (!buildingIds || buildingIds.includes(b.buildingId)),
  );
  return match?.instanceId ?? null;
}

function applyBookOfBuilding(state: VillageState): VillageState | null {
  const target = findUpgradingBuilding(state);
  return target ? completeBuildingUpgrade(state, target) : null;
}

function applyBookOfSpells(state: VillageState): VillageState | null {
  const target = findUpgradingBuilding(state, SPELL_UPGRADE_BUILDINGS);
  return target ? completeBuildingUpgrade(state, target) : null;
}

function applyBookOfHeroes(state: VillageState): VillageState | null {
  const hero = state.heroes.find((h) => h.isUpgrading);
  if (!hero) return null;
  return {
    ...state,
    heroes: state.heroes.map((h) => (h.name === hero.name ? completeHeroUpgrade(h) : h)),
  };
}

function applyBookOfEverything(state: VillageState): VillageState | null {
  return applyBookOfBuilding(state) ?? applyBookOfHeroes(state);
}

function applyRuneById(runeId: string): (state: VillageState) => VillageState | null {
  const resourceMap: Record<string, keyof ResourceAmounts> = {
    rune_gold: 'gold',
    rune_elixir: 'elixir',
    rune_dark_elixir: 'darkElixir',
  };

  return (state) => {
    const resourceKey = resourceMap[runeId];
    if (!resourceKey) return null;
    const caps = getStorageCapacity(state);
    if (state.resources[resourceKey] >= caps[resourceKey]) return null;
    return {
      ...state,
      resources: { ...state.resources, [resourceKey]: caps[resourceKey] },
    };
  };
}

function getMaxWallLevel(): number {
  return wallData.levels.length;
}

function applyWallRing(state: VillageState): VillageState | null {
  const maxLevel = getMaxWallLevel();
  // Upgrade the lowest-level wall that is not already maxed
  const target = [...state.walls]
    .filter((w) => w.level < maxLevel)
    .sort((a, b) => a.level - b.level)[0];
  if (!target) return null;

  return {
    ...state,
    walls: state.walls.map((w) =>
      w.instanceId === target.instanceId ? { ...w, level: w.level + 1 } : w,
    ),
  };
}

// -- Potion boosts --

const HOUR_MS = 60 * 60 * 1000;

/** Boost duration per potion (game-clock milliseconds). */
const POTION_DURATIONS_MS: Record<string, number> = {
  research_potion: HOUR_MS,
  resource_potion: 24 * HOUR_MS,
  builder_potion: HOUR_MS,
  training_potion: HOUR_MS,
  power_potion: HOUR_MS,
  hero_potion: HOUR_MS,
};

/** Speed multipliers granted by each timed potion while active. */
const POTION_MULTIPLIERS: Record<string, Partial<PotionMultipliers>> = {
  research_potion: { labSpeed: 24 },
  resource_potion: { collectorSpeed: 2 },
  builder_potion: { builderSpeed: 10 },
  training_potion: { trainingSpeed: 4 },
};

export interface PotionMultipliers {
  builderSpeed: number;
  collectorSpeed: number;
  trainingSpeed: number;
  labSpeed: number;
}

function activatePotion(state: VillageState, itemId: string): VillageState | null {
  const duration = POTION_DURATIONS_MS[itemId];
  if (!duration) return null;

  const active = state.activePotions ?? [];
  const existing = active.find((p) => p.itemId === itemId);

  // Drinking the same potion again extends its remaining time
  const activePotions: ActivePotionBoost[] = existing
    ? active.map((p) =>
        p.itemId === itemId ? { ...p, remainingMs: p.remainingMs + duration } : p,
      )
    : [...active, { itemId, remainingMs: duration }];

  return { ...state, activePotions };
}

/** Check whether a potion boost is currently active. */
export function isPotionActive(state: VillageState, itemId: string): boolean {
  return (state.activePotions ?? []).some((p) => p.itemId === itemId && p.remainingMs > 0);
}

/**
 * Advance potion timers by real elapsed time, scaled by the game clock.
 * Expired potions are removed. Returns the same state when none are active.
 */
export function tickPotions(state: VillageState, deltaMs: number): VillageState {
  const active = state.activePotions ?? [];
  if (active.length === 0) return state;

  const elapsed = deltaMs * state.gameClockSpeed;
  const activePotions = active
    .map((p) => ({ ...p, remainingMs: p.remainingMs - elapsed }))
    .filter((p) => p.remainingMs > 0);

  return { ...state, activePotions };
}

/** Combined speed multipliers from all currently active potions. */
export function getPotionMultipliers(state: VillageState): PotionMultipliers {
  const result: PotionMultipliers = {
    builderSpeed: 1,
    collectorSpeed: 1,
    trainingSpeed: 1,
    labSpeed: 1,
  };

  for (const potion of state.activePotions ?? []) {
    const mults = POTION_MULTIPLIERS[potion.itemId];
    if (!mults) continue;
    result.builderSpeed *= mults.builderSpeed ?? 1;
    result.collectorSpeed *= mults.collectorSpeed ?? 1;
    result.trainingSpeed *= mults.trainingSpeed ?? 1;
    result.labSpeed *= mults.labSpeed ?? 1;
  }

  return result;
}

/** Power Potion: raise every army troop to its maximum data level for battle. */
export function applyPowerPotionToArmy(army: TrainedTroop[]): TrainedTroop[] {
  return army.map((troop) => {
    const data = getTroop(troop.name);
    const maxLevel = data?.levels[data.levels.length - 1]?.level ?? troop.level;
    return maxLevel > troop.level ? { ...troop, level: maxLevel } : troop;
  });
}

/** Hero Potion: the battle level for a hero while the potion is active. */
export function getHeroPotionLevel(heroName: string, currentLevel: number): number {
  const maxLevel = getHero(heroName)?.maxLevel ?? currentLevel;
  return Math.max(currentLevel, maxLevel);
}

// -- Village-level inventory API --

/** Read the magic item inventory stored on the village (empty when absent). */
export function getVillageInventory(state: VillageState): MagicItemInventory {
  return { items: state.magicItems ?? {} };
}

/** Add one item to the village inventory. Returns null when at max stack. */
export function addVillageItem(state: VillageState, itemId: string): VillageState | null {
  const updated = addItem(getVillageInventory(state), itemId);
  if (!updated) return null;
  return { ...state, magicItems: updated.items };
}

// Effect dispatch table: each entry transforms the village or returns null
// when the item has no valid target right now (the item is NOT consumed then)
const ITEM_EFFECTS: Record<string, (state: VillageState) => VillageState | null> = {
  book_building: applyBookOfBuilding,
  book_heroes: applyBookOfHeroes,
  book_spells: applyBookOfSpells,
  book_everything: applyBookOfEverything,
  research_potion: (s) => activatePotion(s, 'research_potion'),
  resource_potion: (s) => activatePotion(s, 'resource_potion'),
  builder_potion: (s) => activatePotion(s, 'builder_potion'),
  training_potion: (s) => activatePotion(s, 'training_potion'),
  power_potion: (s) => activatePotion(s, 'power_potion'),
  hero_potion: (s) => activatePotion(s, 'hero_potion'),
  rune_gold: applyRuneById('rune_gold'),
  rune_elixir: applyRuneById('rune_elixir'),
  rune_dark_elixir: applyRuneById('rune_dark_elixir'),
  wall_ring: applyWallRing,
};

/**
 * Use a magic item from the village inventory, applying its real effect.
 * Returns null when the item is missing, unknown, or has no valid target;
 * the item is only consumed when its effect applies.
 */
export function applyVillageMagicItem(state: VillageState, itemId: string): VillageState | null {
  const inventory = getVillageInventory(state);
  if (getItemCount(inventory, itemId) <= 0) return null;

  const effect = ITEM_EFFECTS[itemId];
  if (!effect) return null;

  const affected = effect(state);
  if (!affected) return null;

  const newInventory = removeItem(inventory, itemId);
  if (!newInventory) return null;

  return { ...affected, magicItems: newInventory.items };
}

// -- Acquisition (Trader gem prices from gems_and_items.json) --

interface TraderItemEntry {
  name: string;
  gemCostTrader: number | null;
}

interface TraderData {
  books: TraderItemEntry[];
  potions: TraderItemEntry[];
  runes: TraderItemEntry[];
  other: TraderItemEntry[];
}

const traderData = gemsAndItemsData.magicItems as unknown as TraderData;

const traderCostByName = new Map<string, number>(
  [...traderData.books, ...traderData.potions, ...traderData.runes, ...traderData.other]
    .filter((entry) => entry.gemCostTrader !== null)
    .map((entry) => [entry.name, entry.gemCostTrader as number]),
);

// Items the Trader never stocks get a fixed shop price here
const FALLBACK_GEM_COSTS: Record<string, number> = {
  'Book of Everything': 1500,
  'Training Potion': 285,
};

/** Gem cost to buy a magic item, or undefined if it cannot be bought. */
export function getItemGemCost(itemId: string): number | undefined {
  const item = ITEM_MAP.get(itemId);
  if (!item) return undefined;
  return traderCostByName.get(item.name) ?? FALLBACK_GEM_COSTS[item.name];
}

/**
 * Buy a magic item with gems. Returns null when the item is unknown,
 * the stack is full, or the village cannot afford it.
 */
export function buyMagicItemWithGems(state: VillageState, itemId: string): VillageState | null {
  const cost = getItemGemCost(itemId);
  if (cost === undefined) return null;
  if (state.resources.gems < cost) return null;

  const withItem = addVillageItem(state, itemId);
  if (!withItem) return null;

  return {
    ...withItem,
    resources: { ...withItem.resources, gems: withItem.resources.gems - cost },
  };
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
