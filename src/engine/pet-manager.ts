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

function numericStat(stats: PetLevelStats, key: string, fallback: number): number {
  const value = stats[key];
  return typeof value === 'number' ? value : fallback;
}

function percentStat(stats: PetLevelStats, key: string, fallback: number): number {
  const value = stats[key];
  if (typeof value === 'number') return value / 100;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed / 100;
  }
  return fallback;
}

const PET_TRAIT_BUILDERS: Record<string, PetTraitBuilder> = {
  'L.A.S.S.I': () => ({ canJumpWalls: true }),
  'Mighty Yak': () => ({ canJumpWalls: true, wallDamageMultiplier: 20 }),
  'Electro Owl': () => ({ chainTargets: 2, chainDamageDecay: 0.8, attackRange: 3.5 }),
  'Unicorn': (stats) => ({ healPerSecond: stats.healingPerSecond ?? 0, healRadius: 5, dps: 0, baseDps: 0 }),
  'Frosty': (stats) => ({
    frostmitesPerSummon: numericStat(stats, 'frostmitesPerSummon', 1),
    maxFrostmites: numericStat(stats, 'maxFrostmites', 4),
  }),
  'Diggy': (stats) => ({ stunDuration: numericStat(stats, 'stunDuration', 2) }),
  'Poison Lizard': (stats) => ({
    poisonDps: numericStat(stats, 'poisonDps', 80),
    poisonSpeedMultiplier: 1 - percentStat(stats, 'speedDecrease', 0.26),
    poisonAttackMultiplier: 1 - percentStat(stats, 'attackDecrease', 0.35),
    attackRange: 4,
  }),
  'Phoenix': (stats) => ({ phoenixReviveDuration: numericStat(stats, 'reviveDuration', 6) }),
  'Spirit Fox': (stats) => ({
    spiritWalkDuration: numericStat(stats, 'invisibilityDuration', 4),
    spiritWalkCooldown: numericStat(stats, 'abilityCooldown', 6),
  }),
  'Angry Jelly': (stats) => ({ brainwashDuration: numericStat(stats, 'brainwashDuration', 25) }),
  'Sneezy': (stats) => ({ boogersPerSummon: numericStat(stats, 'boogersPerSneeze', 2) }),
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
    baseMovementSpeed: petData.movementSpeed,
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

function findOwner(pet: DeployedTroop, troops: DeployedTroop[]): DeployedTroop | undefined {
  return troops.find(troop => troop.isHero && troop.name === pet.ownerHeroName && !troop.isDefender);
}

function summonPetUnit(pet: DeployedTroop, name: string, index: number, elapsed: number): DeployedTroop {
  return {
    id: `${pet.id}_${name}_${Math.floor(elapsed * 1000)}_${index}`,
    name,
    level: pet.level,
    currentHp: Math.max(1, Math.round(pet.maxHp * 0.08)),
    maxHp: Math.max(1, Math.round(pet.maxHp * 0.08)),
    x: pet.x + (index - 1) * 0.4,
    y: pet.y + (index % 2 === 0 ? -0.4 : 0.4),
    targetId: null,
    state: 'idle',
    dps: Math.max(10, pet.baseDps * 0.2),
    baseDps: Math.max(10, pet.baseDps * 0.2),
    attackRange: 0.8,
    movementSpeed: pet.movementSpeed,
    isFlying: name === 'Frostmite',
    isPet: true,
    ownerHeroName: pet.ownerHeroName,
  };
}

export function tickPetAbilities(
  troops: DeployedTroop[],
  defenses: Array<{ buildingInstanceId: string; isDestroyed: boolean; isFrozen?: boolean; frozenUntil?: number }>,
  elapsed: number,
  deltaMs: number,
): DeployedTroop[] {
  const summons: DeployedTroop[] = [];
  for (const pet of troops.filter(troop => troop.isPet && !['Frostmite', 'Booger'].includes(troop.name))) {
    const owner = findOwner(pet, troops);

    if (pet.name === 'Mighty Yak' && owner?.state === 'dead') {
      pet.dps = pet.baseDps * 1.7;
      pet.movementSpeed = (pet.baseMovementSpeed ?? pet.movementSpeed) * 1.16;
    }

    if (pet.name === 'Frosty' && pet.state !== 'dead' && elapsed >= (pet.petAbilityReadyAt ?? 0)) {
      const current = troops.filter(troop => troop.name === 'Frostmite' && troop.ownerHeroName === pet.ownerHeroName && troop.state !== 'dead').length;
      const count = Math.min(pet.frostmitesPerSummon ?? 1, Math.max(0, (pet.maxFrostmites ?? 4) - current));
      for (let index = 0; index < count; index++) summons.push(summonPetUnit(pet, 'Frostmite', index, elapsed));
      pet.petAbilityReadyAt = elapsed + 5;
    }

    if (pet.name === 'Sneezy' && pet.state !== 'dead' && elapsed >= (pet.petAbilityReadyAt ?? 0)) {
      const count = pet.boogersPerSummon ?? 2;
      for (let index = 0; index < count; index++) summons.push(summonPetUnit(pet, 'Booger', index, elapsed));
      pet.petAbilityReadyAt = elapsed + 5;
      if (owner?.state === 'dead') pet.dps = pet.baseDps * 1.5;
    }

    if (pet.name === 'Diggy' && pet.state === 'attacking' && pet.targetId) {
      const target = defenses.find(defense => defense.buildingInstanceId === pet.targetId && !defense.isDestroyed);
      if (target) {
        target.isFrozen = true;
        target.frozenUntil = Math.max(target.frozenUntil ?? 0, elapsed + (pet.stunDuration ?? 2));
      }
    }

    if (pet.name === 'Poison Lizard' && pet.state !== 'dead') {
      const target = troops.find(troop => troop.isDefender && troop.state !== 'dead'
        && Math.hypot(troop.x - pet.x, troop.y - pet.y) <= pet.attackRange);
      if (target) {
        target.currentHp = Math.max(0, target.currentHp - (pet.poisonDps ?? 80) * deltaMs / 1000);
        target.poisonedUntil = elapsed + 2;
        target.poisonDamagePerSecond = pet.poisonDps ?? 80;
        target.baseMovementSpeed = target.baseMovementSpeed ?? target.movementSpeed;
        target.movementSpeed = target.baseMovementSpeed * (pet.poisonSpeedMultiplier ?? 0.74);
        target.attackRateMultiplier = pet.poisonAttackMultiplier ?? 0.65;
        if (target.currentHp <= 0) target.state = 'dead';
      }
    }

    if (pet.name === 'Phoenix' && owner?.state === 'dead' && !pet.petAbilityConsumed) {
      owner.state = 'idle';
      owner.currentHp = Math.max(1, owner.maxHp * 0.5);
      owner.invincibleUntil = elapsed + (pet.phoenixReviveDuration ?? 6);
      pet.petAbilityConsumed = true;
    }

    if (pet.name === 'Spirit Fox' && owner && pet.state !== 'dead' && elapsed >= (pet.petAbilityReadyAt ?? 0)) {
      const duration = pet.spiritWalkDuration ?? 4;
      owner.isBurrowed = true;
      owner.invisibleUntil = elapsed + duration;
      pet.isBurrowed = true;
      pet.invisibleUntil = elapsed + duration;
      pet.petAbilityReadyAt = elapsed + (pet.spiritWalkCooldown ?? 6);
    }

    if (pet.name === 'Angry Jelly' && owner && owner.state !== 'dead' && !pet.petAbilityConsumed) {
      owner.favoriteTargetOverride = 'Defenses';
      owner.favoriteTargetOverrideUntil = elapsed + (pet.brainwashDuration ?? 25);
      pet.petAbilityConsumed = true;
    }
  }
  return summons;
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
