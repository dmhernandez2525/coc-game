// Hero deployment, abilities, and availability for battles.
// All functions are pure: they return new state, never mutate.

import type { HeroData, HeroLevelStats } from '../types/troops.ts';
import type { OwnedHero, ResourceAmounts } from '../types/village.ts';
import type { DeployedTroop, HeroBattleStatus } from '../types/battle.ts';
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
  isDefender = false,
): DeployedTroop | null {
  const hero = getHero(heroName);
  if (!hero) return null;

  const stats = hero.levels.find((l) => l.level === level);
  if (!stats) return null;

  const lifeAuraBoostPercent = heroName === 'Grand Warden'
    ? ((stats.lifeAuraHPBoostPercent as number | null | undefined) ?? 0)
    : 0;

  return {
    id: `hero_${isDefender ? 'def_' : ''}${heroName}_${Date.now()}`,
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
    ...(lifeAuraBoostPercent > 0 ? { lifeAuraBoostPercent, lifeAuraRadius: 7 } : {}),
    ...(isDefender ? { isDefender: true } : {}),
  };
}

/** Grand Warden Eternal Tome: troops near the Warden take no damage briefly. */
export interface TomeInvincibility {
  durationSeconds: number;
  radius: number;
}

/** Royal Champion Seeking Shield: thrown shield bounces between defenses. */
export interface ShieldStrike {
  damage: number;
  targets: number;
}

/** Ability result including the modified hero and any summoned troops. */
export interface AbilityResult {
  hero: DeployedTroop;
  summonedTroops: DeployedTroop[];
  tomeInvincibility?: TomeInvincibility;
  shieldStrike?: ShieldStrike;
}

const WARDEN_TOME_RADIUS = 7;
const WARDEN_TOME_FALLBACK_DURATION = 3.5;

type AbilityHandler = (hero: DeployedTroop, stats: HeroLevelStats, elapsed: number) => AbilityResult;

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
      ...(hero.isDefender ? { isDefender: true } : {}),
    });
  }
  return summons;
}

/** Read a numeric ability stat from hero level data with a fallback. */
function heroStat(stats: HeroLevelStats, key: string, fallback: number): number {
  return (stats[key] as number | null | undefined) ?? fallback;
}

const ABILITY_HANDLERS: Record<string, AbilityHandler> = {
  // Barbarian King - "Iron Fist": Heal, summon Barbarians, rage effect.
  // Summon count and heal scale with abilityLevel (every 5 hero levels).
  'Barbarian King': (hero, stats) => {
    const hpRecovery = heroStat(stats, 'abilityHPRecovery', 0);
    const dmgIncrease = heroStat(stats, 'abilityDamageIncrease', 0);
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    const summonCount = heroStat(stats, 'summonedBarbarians', 6);
    const summons = createSummon('Barbarian', summonCount, hero, 100, 20, false);
    return {
      hero: { ...hero, currentHp: healedHp, dps: hero.baseDps + dmgIncrease, heroAbilityUsed: true },
      summonedTroops: summons,
    };
  },

  // Archer Queen - "Royal Cloak": Become invisible (untargetable), summon Archers, damage boost
  'Archer Queen': (hero, stats, elapsed) => {
    const hpRecovery = heroStat(stats, 'abilityHPRecovery', 0);
    const dmgIncrease = heroStat(stats, 'abilityDamageIncrease', 0);
    const cloakDurationSec = heroStat(stats, 'abilityDurationMs', 0) / 1000;
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    const summonCount = heroStat(stats, 'summonedArchers', 5);
    const summons = createSummon('Archer', summonCount, hero, 50, 15, false);
    return {
      hero: {
        ...hero, currentHp: healedHp, dps: hero.baseDps + dmgIncrease,
        heroAbilityUsed: true, isBurrowed: true, // Reuse burrowed flag for invisibility
        invisibleUntil: elapsed + cloakDurationSec, // Cloak expires; tickBattle clears the flag
      },
      summonedTroops: summons,
    };
  },

  // Grand Warden - "Eternal Tome": Nearby troops become invincible briefly.
  // Duration scales with abilityLevel; the battle engine applies the effect.
  'Grand Warden': (hero, stats) => {
    const hpRecovery = heroStat(stats, 'abilityHPRecovery', 0);
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    const durationSeconds = heroStat(stats, 'eternalTomeDurationSeconds', WARDEN_TOME_FALLBACK_DURATION);
    return {
      hero: { ...hero, currentHp: healedHp, heroAbilityUsed: true },
      summonedTroops: [],
      tomeInvincibility: { durationSeconds, radius: WARDEN_TOME_RADIUS },
    };
  },

  // Royal Champion - "Seeking Shield": Heal, then throw a shield that bounces
  // between the nearest defenses. Damage and heal scale with abilityLevel.
  'Royal Champion': (hero, stats) => {
    const hpRecovery = heroStat(stats, 'seekingShieldHPRecovery', 0);
    const healedHp = Math.min(hero.currentHp + hpRecovery, hero.maxHp);
    const damage = heroStat(stats, 'seekingShieldDamage', 0);
    const targets = heroStat(stats, 'seekingShieldTargets', 4);
    return {
      hero: { ...hero, currentHp: healedHp, heroAbilityUsed: true },
      summonedTroops: [],
      shieldStrike: { damage, targets },
    };
  },

  // Minion Prince - "Health Recovery": Heal scales every 5 levels via healthRecovery
  'Minion Prince': (hero, stats) => {
    const hpRecovery = heroStat(stats, 'healthRecovery', 0);
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
 * elapsed is the current battle time in seconds, used for timed effects.
 */
export function activateHeroAbility(
  hero: DeployedTroop,
  heroName: string,
  level: number,
  elapsed = 0,
): AbilityResult | null {
  if (hero.heroAbilityUsed) return null;

  const stats = getHeroStats(heroName, level);
  if (!stats) return null;

  const abilityLevel = stats.abilityLevel as number | null;
  if (abilityLevel === null) return null;

  const handler = ABILITY_HANDLERS[heroName];
  if (handler) return handler(hero, stats, elapsed);

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
  return !hero.isRecovering && !hero.isUpgrading;
}

/**
 * Apply post-battle hero HP to the village heroes. Heroes that took damage
 * enter recovery with a timer proportional to the HP they are missing.
 * Heroes that were not deployed are returned unchanged.
 */
export function applyPostBattleHeroRecovery(
  heroes: OwnedHero[],
  deployed: HeroBattleStatus[],
): OwnedHero[] {
  return heroes.map((hero) => {
    const status = deployed.find((d) => d.name === hero.name);
    if (!status) return hero;

    const stats = getHeroStats(hero.name, hero.level);
    const maxHp = stats?.hitpoints ?? hero.currentHp;
    if (maxHp <= 0 || status.remainingHp >= maxHp) {
      return { ...hero, currentHp: maxHp, isRecovering: false, recoveryTimeRemaining: 0 };
    }

    const missingRatio = 1 - status.remainingHp / maxHp;
    const fullRegen = getRegenerationTime(hero.name, hero.level);
    return {
      ...hero,
      currentHp: status.remainingHp,
      isRecovering: true,
      recoveryTimeRemaining: Math.ceil(fullRegen * missingRatio),
    };
  });
}

// -- Hero upgrades --

/** Maps hero upgrade resource names onto village resource keys. */
const UPGRADE_RESOURCE_KEYS: Record<string, keyof ResourceAmounts> = {
  'Gold': 'gold',
  'Elixir': 'elixir',
  'Dark Elixir': 'darkElixir',
};

export interface HeroUpgradeCost {
  cost: number;
  resource: string;
  resourceKey: keyof ResourceAmounts;
  timeSeconds: number;
}

/** Get a hero's ability name and description for display. */
export function getHeroAbilityInfo(
  heroName: string,
): { name: string; description: string } | null {
  const hero = getHero(heroName);
  if (!hero) return null;
  return { name: hero.abilityName, description: hero.abilityDescription };
}

/**
 * Get the cost to upgrade a hero from its current level to the next.
 * Returns null when the hero is unknown or already at max level.
 */
export function getHeroUpgradeCost(
  heroName: string, currentLevel: number,
): HeroUpgradeCost | null {
  const hero = getHero(heroName);
  if (!hero) return null;

  const nextStats = hero.levels.find((l) => l.level === currentLevel + 1);
  if (!nextStats) return null;

  return {
    cost: nextStats.upgradeCost,
    resource: hero.upgradeResource,
    resourceKey: UPGRADE_RESOURCE_KEYS[hero.upgradeResource] ?? 'elixir',
    timeSeconds: nextStats.upgradeTimeSeconds,
  };
}

/**
 * Start a hero upgrade, deducting its cost from the village resources.
 * Returns null when the hero is busy, maxed, or the cost is unaffordable.
 */
export function startHeroUpgrade(
  hero: OwnedHero, resources: ResourceAmounts,
): { hero: OwnedHero; resources: ResourceAmounts } | null {
  if (hero.isUpgrading || hero.isRecovering) return null;

  const upgrade = getHeroUpgradeCost(hero.name, hero.level);
  if (!upgrade) return null;
  if (resources[upgrade.resourceKey] < upgrade.cost) return null;

  return {
    hero: { ...hero, isUpgrading: true, upgradeTimeRemaining: upgrade.timeSeconds },
    resources: {
      ...resources,
      [upgrade.resourceKey]: resources[upgrade.resourceKey] - upgrade.cost,
    },
  };
}

/**
 * Advance hero upgrade timers by elapsed seconds. Heroes whose timer
 * reaches zero gain a level and return at full HP. Pure: returns the
 * same array when no hero is upgrading.
 */
export function tickHeroUpgrades(
  heroes: OwnedHero[],
  elapsedSeconds: number,
): OwnedHero[] {
  if (!heroes.some((h) => h.isUpgrading)) return heroes;

  return heroes.map((hero) => {
    if (!hero.isUpgrading) return hero;

    const remaining = Math.max(0, hero.upgradeTimeRemaining - elapsedSeconds);
    if (remaining > 0) return { ...hero, upgradeTimeRemaining: remaining };

    const newLevel = hero.level + 1;
    const stats = getHeroStats(hero.name, newLevel);
    return {
      ...hero,
      level: newLevel,
      currentHp: stats?.hitpoints ?? hero.currentHp,
      isUpgrading: false,
      upgradeTimeRemaining: 0,
    };
  });
}

/**
 * Advance hero recovery timers by elapsed seconds. Heroes whose timer
 * reaches zero come back at full HP. Pure: returns the same array when
 * no hero is recovering.
 */
export function tickHeroRecovery(
  heroes: OwnedHero[],
  elapsedSeconds: number,
): OwnedHero[] {
  if (!heroes.some((h) => h.isRecovering)) return heroes;

  return heroes.map((hero) => {
    if (!hero.isRecovering) return hero;

    const remaining = Math.max(0, hero.recoveryTimeRemaining - elapsedSeconds);
    if (remaining > 0) return { ...hero, recoveryTimeRemaining: remaining };

    const stats = getHeroStats(hero.name, hero.level);
    return {
      ...hero,
      currentHp: stats?.hitpoints ?? hero.currentHp,
      isRecovering: false,
      recoveryTimeRemaining: 0,
    };
  });
}
