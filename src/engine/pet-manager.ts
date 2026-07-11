// Pet management: assignment, deployment, and battle processing.
// All functions are pure: they return new state, never mutate.

import type { PetData, PetLevelStats } from '../types/troops.ts';
import type { OwnedHero, PlacedBuilding } from '../types/village.ts';
import type { DeployedTroop } from '../types/battle.ts';
import { getPet, pets } from '../data/loaders/hero-loader.ts';

// -- Types --

export interface OwnedPet {
  name: string;
  level: number;
}

// Battle traits per pet: how each pet's signature ability maps onto the
// battle engine's property-driven mechanics.
// L.A.S.S.I springs over walls; Electro Owl's zap chains between targets
// (handled by the chain-lightning mechanic); Mighty Yak busts walls;
// Unicorn heals instead of fighting (handled by the healer mechanic).
type PetTraitBuilder = (stats: PetLevelStats) => Partial<DeployedTroop>;

const PET_TRAIT_BUILDERS: Record<string, PetTraitBuilder> = {
  'L.A.S.S.I': () => ({ canJumpWalls: true }),
  'Mighty Yak': () => ({ canJumpWalls: true, wallDamageMultiplier: 20 }),
  'Electro Owl': () => ({ chainTargets: 2, chainDamageDecay: 0.8, attackRange: 3.5 }),
  'Unicorn': (stats) => ({ healPerSecond: stats.healingPerSecond ?? 0, healRadius: 5, dps: 0, baseDps: 0 }),
};

// -- Public API --

/** Get all available pets for a given Town Hall level. */
export function getAvailablePets(townHallLevel: number): PetData[] {
  return Object.values(pets).filter((p) => p.thUnlock <= townHallLevel);
}

/** Get the placed Pet House's level. Returns 0 when it is not built. */
export function getPetHouseLevel(buildings: PlacedBuilding[]): number {
  return buildings.find((b) => b.buildingId === 'Pet House')?.level ?? 0;
}

/** Check if a pet is unlocked by both Town Hall and Pet House level. */
export function isPetUnlocked(
  petName: string, townHallLevel: number, petHouseLevel: number,
): boolean {
  const pet = getPet(petName);
  if (!pet) return false;
  return pet.thUnlock <= townHallLevel && pet.petHouseLevelRequired <= petHouseLevel;
}

/** Get the pets unlocked by the current Town Hall and Pet House levels. */
export function getUnlockedPets(townHallLevel: number, petHouseLevel: number): PetData[] {
  return Object.values(pets).filter((p) => isPetUnlocked(p.name, townHallLevel, petHouseLevel));
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
 * Create a battle unit for a pet near the given position, applying the
 * pet's signature battle traits. Returns null for unknown pets or levels.
 */
export function createPetTroop(
  petName: string, petLevel: number, x: number, y: number,
): DeployedTroop | null {
  const petData = getPet(petName);
  if (!petData) return null;

  const stats = petData.levels.find((l) => l.level === petLevel);
  if (!stats) return null;

  const offsetX = (Math.random() - 0.5) * 2;
  const offsetY = (Math.random() - 0.5) * 2;
  const traits = PET_TRAIT_BUILDERS[petName]?.(stats) ?? {};

  return {
    id: `pet_${petName}_${Date.now()}`,
    name: petName,
    level: petLevel,
    currentHp: stats.hp,
    maxHp: stats.hp,
    x: x + offsetX,
    y: y + offsetY,
    targetId: null,
    state: 'idle',
    dps: stats.dps ?? 0,
    baseDps: stats.dps ?? 0,
    attackRange: 1,
    movementSpeed: petData.movementSpeed,
    isFlying: petData.isFlying,
    isPet: true,
    ...traits,
  };
}

/**
 * Deploy a pet alongside its hero in battle.
 * Returns a DeployedTroop representing the pet, or null if no pet assigned.
 */
export function deployPet(
  hero: OwnedHero, petLevel: number, heroX: number, heroY: number,
): DeployedTroop | null {
  if (!hero.assignedPet) return null;
  return createPetTroop(hero.assignedPet, petLevel, heroX, heroY);
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

/**
 * Upgrade a pet by one level, seeding a level 1 entry when the pet has
 * never been upgraded before. Same contract as upgradePet.
 */
export function upgradeOwnedPet(
  ownedPets: OwnedPet[], petName: string, availableResources: number,
): { pets: OwnedPet[]; cost: number } | null {
  if (!getPet(petName)) return null;

  const withEntry = ownedPets.some((p) => p.name === petName)
    ? ownedPets
    : [...ownedPets, { name: petName, level: 1 }];

  return upgradePet(withEntry, petName, availableResources);
}

/** Get the level of an owned pet, defaulting to 1 when never upgraded. */
export function getOwnedPetLevel(ownedPets: OwnedPet[], petName: string): number {
  return ownedPets.find((p) => p.name === petName)?.level ?? 1;
}
