// Spell training queue: separate from troop queue, gated by Spell Factory.
// All functions are pure: they return new state, never mutate.

import type { VillageState, TrainedTroop, ResourceAmounts } from '../types/village.ts';
import { getSpell, getAllSpells as loadAllSpells } from '../data/loaders/spell-loader.ts';
import type { SpellData } from '../types/troops.ts';

// -- Types --

export interface SpellTrainingCost {
  amount: number;
  resource: string;
  time: number; // seconds
}

// -- Constants --

const RESOURCE_KEY_MAP: Record<string, keyof ResourceAmounts> = {
  Elixir: 'elixir',
  'Dark Elixir': 'darkElixir',
};

const SPELL_FACTORY_MAP: Record<string, string> = {
  elixir: 'Spell Factory',
  dark_elixir: 'Dark Spell Factory',
};

// -- Public API --

/** Get the spell factory level from the village. */
export function getSpellFactoryLevel(state: VillageState): number {
  const factory = state.buildings.find((b) => b.buildingId === 'Spell Factory');
  return factory?.level ?? 0;
}

/** Get the dark spell factory level from the village. */
export function getDarkSpellFactoryLevel(state: VillageState): number {
  const factory = state.buildings.find((b) => b.buildingId === 'Dark Spell Factory');
  return factory?.level ?? 0;
}

/** Get the max spell capacity from spell factory levels. */
export function getMaxSpellCapacity(state: VillageState): number {
  // Each Spell Factory level adds 1 spell capacity (up to level 6 = 11 spells)
  // Each factory level roughly: 2 spells at lv1, +1 per level
  const sfLevel = getSpellFactoryLevel(state);
  const dsfLevel = getDarkSpellFactoryLevel(state);

  // Base capacity from spell factory: starts at 2, +1 per level
  const baseCapacity = sfLevel > 0 ? sfLevel + 1 : 0;
  // Dark spell factory adds 1 per level (0 if not built)
  const darkCapacity = dsfLevel > 0 ? dsfLevel : 0;

  return baseCapacity + darkCapacity;
}

/** Get the total spell housing currently used. */
export function getCurrentSpellHousing(state: VillageState): number {
  let total = 0;
  for (const spell of state.spells) {
    const data = getSpell(spell.name);
    if (!data) continue;
    total += spell.count * (data.housingSpace ?? 1);
  }
  return total;
}

/** Get the training cost for a spell. */
export function getSpellTrainingCost(spellName: string): SpellTrainingCost | undefined {
  const spell = getSpell(spellName);
  if (!spell) return undefined;

  const firstLevel = spell.levels[0];
  if (!firstLevel) return undefined;

  // Use the upgrade cost of level 1 as training cost, or derive from housing space
  const resource = spell.type === 'dark_elixir' ? 'Dark Elixir' : 'Elixir';
  const housingSpace = spell.housingSpace ?? 1;

  return {
    amount: housingSpace * (spell.type === 'dark_elixir' ? 150 : 2000),
    resource,
    time: housingSpace * 60, // 1 minute per housing space
  };
}

/** Check if a spell can be trained (factory exists, capacity available, resources sufficient). */
export function canTrainSpell(state: VillageState, spellName: string): boolean {
  const spell = getSpell(spellName);
  if (!spell) return false;

  // Check factory exists
  const factoryName = SPELL_FACTORY_MAP[spell.type];
  if (!factoryName) return false;

  const factoryLevel = state.buildings.find((b) => b.buildingId === factoryName)?.level ?? 0;
  if (factoryLevel === 0) return false;

  // Check capacity
  const maxCapacity = getMaxSpellCapacity(state);
  const currentHousing = getCurrentSpellHousing(state);
  const spellHousing = spell.housingSpace ?? 1;
  if (currentHousing + spellHousing > maxCapacity) return false;

  // Check resources
  const cost = getSpellTrainingCost(spellName);
  if (!cost) return false;

  const resourceKey = RESOURCE_KEY_MAP[cost.resource];
  if (!resourceKey) return false;

  return state.resources[resourceKey] >= cost.amount;
}

/** Get all spells available for training at the current TH level. */
export function getAvailableSpells(state: VillageState): SpellData[] {
  const sfLevel = getSpellFactoryLevel(state);
  const dsfLevel = getDarkSpellFactoryLevel(state);
  const allSpells = loadAllSpells();

  return allSpells.filter((spell) => {
    if (spell.thUnlock > state.townHallLevel) return false;

    if (spell.type === 'elixir' && sfLevel === 0) return false;
    if (spell.type === 'dark_elixir' && dsfLevel === 0) return false;

    return true;
  });
}

/**
 * Train a spell: deduct resources, add to spell list.
 * Returns null if training is not possible.
 */
export function trainSpell(state: VillageState, spellName: string): VillageState | null {
  if (!canTrainSpell(state, spellName)) return null;

  const cost = getSpellTrainingCost(spellName);
  if (!cost) return null;

  const resourceKey = RESOURCE_KEY_MAP[cost.resource];
  if (!resourceKey) return null;

  const resources: ResourceAmounts = {
    ...state.resources,
    [resourceKey]: state.resources[resourceKey] - cost.amount,
  };

  const existingIndex = state.spells.findIndex((s) => s.name === spellName);
  let spells: TrainedTroop[];
  if (existingIndex >= 0) {
    spells = state.spells.map((s, i) =>
      i === existingIndex ? { ...s, count: s.count + 1 } : s,
    );
  } else {
    spells = [...state.spells, { name: spellName, level: 1, count: 1 }];
  }

  return { ...state, resources, spells };
}

/** Remove a spell from the trained spell list. */
export function removeSpell(
  state: VillageState,
  spellName: string,
  count: number = 1,
): VillageState {
  const spells = state.spells
    .map((s) => {
      if (s.name !== spellName) return s;
      return { ...s, count: s.count - count };
    })
    .filter((s) => s.count > 0);

  return { ...state, spells };
}

