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
    attackRange: hero.attackRange,
    movementSpeed: hero.movementSpeed,
    isFlying: hero.isFlying,
  };
}

export function activateHeroAbility(
  hero: DeployedTroop,
  heroName: string,
  level: number,
): DeployedTroop | null {
  const stats = getHeroStats(heroName, level);
  if (!stats) return null;

  const abilityLevel = stats.abilityLevel as number | null;
  if (abilityLevel === null) return null;

  const hpRecovery = (stats.abilityHPRecovery as number | null) ?? 0;
  const dmgIncrease = (stats.abilityDamageIncrease as number | null) ?? 0;

  const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);

  return {
    ...hero,
    currentHp: healedHp,
    dps: hero.dps + dmgIncrease,
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
