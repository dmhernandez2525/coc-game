// Pet management: assignment, deployment, and battle processing.
// All functions are pure: they return new state, never mutate.

import type { PetData, PetLevelStats } from '../types/troops.ts';
import type { OwnedHero } from '../types/village.ts';
import type { DeployedTroop } from '../types/battle.ts';
import { getPet, pets } from '../data/loaders/hero-loader.ts';

// -- Types --

export interface OwnedPet {
  name: string;
  level: number;
}

// -- Public API --

/** Get all available pets for a given Town Hall level. */
export function getAvailablePets(townHallLevel: number): PetData[] {
  return Object.values(pets).filter((p) => p.thUnlock <= townHallLevel);
}

/** Get stats for a pet at a specific level. */
export function getPetStats(petName: string, level: number): PetLevelStats | undefined {
  const pet = getPet(petName);
  if (!pet) return undefined;
  return pet.levels.find((l) => l.level === level);
}

/** Check if a pet can be assigned (not already assigned to another hero). */
export function canAssignPet(
  petName: string, heroes: OwnedHero[], heroName: string,
): boolean {
  const pet = getPet(petName);
  if (!pet) return false;

  // Check the pet isn't already assigned to a different hero
  return !heroes.some((h) => h.assignedPet === petName && h.name !== heroName);
}

/**
 * Assign a pet to a hero. Returns updated hero, or null if invalid.
 * Only one pet per hero, and a pet can only be assigned to one hero at a time.
 */
export function assignPet(
  hero: OwnedHero, petName: string, allHeroes: OwnedHero[],
): OwnedHero | null {
  if (!canAssignPet(petName, allHeroes, hero.name)) return null;
  return { ...hero, assignedPet: petName };
}

/** Remove the pet assignment from a hero. */
export function unassignPet(hero: OwnedHero): OwnedHero {
  return { ...hero, assignedPet: null };
}

/**
 * Deploy a pet alongside its hero in battle.
 * Returns a DeployedTroop representing the pet, or null if no pet assigned.
 */
export function deployPet(
  hero: OwnedHero, petLevel: number, heroX: number, heroY: number,
): DeployedTroop | null {
  if (!hero.assignedPet) return null;

  const petData = getPet(hero.assignedPet);
  if (!petData) return null;

  const stats = petData.levels.find((l) => l.level === petLevel);
  if (!stats) return null;

  const offsetX = (Math.random() - 0.5) * 2;
  const offsetY = (Math.random() - 0.5) * 2;

  return {
    id: `pet_${hero.assignedPet}_${Date.now()}`,
    name: hero.assignedPet,
    level: petLevel,
    currentHp: stats.hp,
    maxHp: stats.hp,
    x: heroX + offsetX,
    y: heroY + offsetY,
    targetId: null,
    state: 'idle',
    dps: stats.dps,
    baseDps: stats.dps,
    attackRange: 1,
    movementSpeed: petData.movementSpeed,
    isFlying: petData.isFlying,
    canJumpWalls: petData.name === 'L.A.S.S.I' || petData.name === 'Mighty Yak',
  };
}

/** Get the upgrade cost for a pet at its current level. */
export function getPetUpgradeCost(
  petName: string, currentLevel: number,
): { cost: number; resource: string } | null {
  const pet = getPet(petName);
  if (!pet) return null;

  const nextStats = pet.levels.find((l) => l.level === currentLevel + 1);
  if (!nextStats) return null;

  return { cost: nextStats.upgradeCost, resource: pet.upgradeResource };
}

/** Check if a pet is at its max level. */
export function isPetMaxLevel(petName: string, currentLevel: number): boolean {
  const pet = getPet(petName);
  if (!pet) return true;
  return currentLevel >= pet.levels.length;
}

/**
 * Upgrade a pet by one level.
 * Returns updated pet list, or null if upgrade not possible.
 */
export function upgradePet(
  ownedPets: OwnedPet[], petName: string, availableResources: number,
): { pets: OwnedPet[]; cost: number } | null {
  const idx = ownedPets.findIndex((p) => p.name === petName);
  if (idx === -1) return null;

  const current = ownedPets[idx]!;
  const costInfo = getPetUpgradeCost(petName, current.level);
  if (!costInfo) return null;

  if (availableResources < costInfo.cost) return null;

  const upgraded = ownedPets.map((p, i) =>
    i === idx ? { ...p, level: p.level + 1 } : p,
  );

  return { pets: upgraded, cost: costInfo.cost };
}
