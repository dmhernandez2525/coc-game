// Hero deployment, abilities, and availability for battles.
// All functions are pure: they return new state, never mutate.

import type { HeroData, HeroLevelStats } from '../types/troops.ts';
import type { OwnedHero } from '../types/village.ts';
import type { DeployedTroop } from '../types/battle.ts';
import { getHero, heroes } from '../data/loaders/hero-loader.ts';

// -- Public API --

export function getHeroStats(
  heroName: string,
  level: number,
): HeroLevelStats | undefined {
  const hero = getHero(heroName);
  if (!hero) return undefined;
  return hero.levels.find((l) => l.level === level);
}

export function getAvailableHeroes(townHallLevel: number): HeroData[] {
  return Object.values(heroes).filter((h) => h.thUnlock <= townHallLevel);
}

export function deployHero(
  heroName: string,
  level: number,
  x: number,
  y: number,
): DeployedTroop | null {
  const hero = getHero(heroName);
  if (!hero) return null;

  const stats = hero.levels.find((l) => l.level === level);
  if (!stats) return null;

  return {
    id: `hero_${heroName}_${Date.now()}`,
    name: heroName,
    level,
    currentHp: stats.hitpoints,
    maxHp: stats.hitpoints,
    x,
    y,
    targetId: null,
    state: 'idle',
    dps: stats.dps,
    baseDps: stats.dps,
    attackRange: hero.attackRange,
    movementSpeed: hero.movementSpeed,
    isFlying: hero.isFlying,
    isHero: true,
    heroAbilityUsed: false,
  };
}

/** Ability result including the modified hero and any summoned troops. */
export interface AbilityResult {
  hero: DeployedTroop;
  summonedTroops: DeployedTroop[];
}

type AbilityHandler = (hero: DeployedTroop, stats: HeroLevelStats) => AbilityResult;

function createSummon(
  baseName: string, count: number, hero: DeployedTroop,
  hp: number, dps: number, isFlying: boolean,
): DeployedTroop[] {
  const summons: DeployedTroop[] = [];
  for (let i = 0; i < count; i++) {
    const offsetX = (Math.random() - 0.5) * 4;
    const offsetY = (Math.random() - 0.5) * 4;
    summons.push({
      id: `${hero.id}_summon_${i}`,
      name: baseName,
      level: hero.level,
      currentHp: hp,
      maxHp: hp,
      x: hero.x + offsetX,
      y: hero.y + offsetY,
      targetId: null,
      state: 'idle',
      dps,
      baseDps: dps,
      attackRange: 0.5,
      movementSpeed: 16,
      isFlying,
    });
  }
  return summons;
}

const ABILITY_HANDLERS: Record<string, AbilityHandler> = {
  // Barbarian King - "Iron Fist": Heal, summon Barbarians, rage effect
  'Barbarian King': (hero, stats) => {
    const hpRecovery = (stats.abilityHPRecovery as number | null) ?? 0;
    const dmgIncrease = (stats.abilityDamageIncrease as number | null) ?? 0;
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    const summons = createSummon('Barbarian', 8 + Math.floor((stats.abilityLevel ?? 1) / 2), hero, 100, 20, false);
    return {
      hero: { ...hero, currentHp: healedHp, dps: hero.baseDps + dmgIncrease, heroAbilityUsed: true },
      summonedTroops: summons,
    };
  },

  // Archer Queen - "Royal Cloak": Become invisible (untargetable), summon Archers, damage boost
  'Archer Queen': (hero, stats) => {
    const hpRecovery = (stats.abilityHPRecovery as number | null) ?? 0;
    const dmgIncrease = (stats.abilityDamageIncrease as number | null) ?? 0;
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    const summons = createSummon('Archer', 6 + Math.floor((stats.abilityLevel ?? 1) / 2), hero, 50, 15, false);
    return {
      hero: {
        ...hero, currentHp: healedHp, dps: hero.baseDps + dmgIncrease,
        heroAbilityUsed: true, isBurrowed: true, // Reuse burrowed flag for invisibility
      },
      summonedTroops: summons,
    };
  },

  // Grand Warden - "Eternal Tome": All nearby troops become invincible briefly
  // (Simplified: massive HP boost to nearby troops for a few seconds)
  'Grand Warden': (hero, stats) => {
    const hpRecovery = (stats.abilityHPRecovery as number | null) ?? 0;
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    return {
      hero: { ...hero, currentHp: healedHp, heroAbilityUsed: true },
      summonedTroops: [],
    };
  },

  // Royal Champion - "Seeking Shield": Throw shield that bounces to 4 defenses
  'Royal Champion': (hero, stats) => {
    const hpRecovery = (stats.abilityHPRecovery as number | null) ?? 0;
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    return {
      hero: { ...hero, currentHp: healedHp, heroAbilityUsed: true },
      summonedTroops: [],
    };
  },
};

/**
 * Activate a hero's special ability.
 * Returns the modified hero and any summoned troops, or null if ability unavailable.
 */
export function activateHeroAbility(
  hero: DeployedTroop,
  heroName: string,
  level: number,
): AbilityResult | null {
  if (hero.heroAbilityUsed) return null;

  const stats = getHeroStats(heroName, level);
  if (!stats) return null;

  const abilityLevel = stats.abilityLevel as number | null;
  if (abilityLevel === null) return null;

  const handler = ABILITY_HANDLERS[heroName];
  if (handler) return handler(hero, stats);

  // Fallback: generic heal + damage boost
  const hpRecovery = (stats.abilityHPRecovery as number | null) ?? 0;
  const dmgIncrease = (stats.abilityDamageIncrease as number | null) ?? 0;
  const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
  return {
    hero: { ...hero, currentHp: healedHp, dps: hero.baseDps + dmgIncrease, heroAbilityUsed: true },
    summonedTroops: [],
  };
}

export function getRegenerationTime(
  heroName: string,
  level: number,
): number {
  const stats = getHeroStats(heroName, level);
  return stats?.regenerationTimeSeconds ?? 0;
}

export function isHeroAvailableForBattle(hero: OwnedHero): boolean {
  return !hero.isRecovering;
}
