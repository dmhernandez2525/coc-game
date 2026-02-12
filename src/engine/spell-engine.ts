import type {
  BattleState, ActiveSpell, DeployedTroop, BattleBuilding, ActiveDefense,
} from '../types/battle.ts';
import type { SpellData, SpellLevelStats } from '../types/troops.ts';
import { getSpell } from '../data/loaders/spell-loader.ts';
import { distance } from './targeting-ai.ts';

type SpellEffect =
  | 'instant_damage' | 'instant_building_pct'
  | 'heal_over_time' | 'buff' | 'debuff'
  | 'freeze' | 'haste' | 'skeleton_spawn' | 'bat_spawn' | 'clone' | 'invisibility'
  | 'jump';

const SPELL_EFFECTS: Record<string, SpellEffect> = {
  'Lightning Spell': 'instant_damage',
  'Earthquake Spell': 'instant_building_pct',
  'Healing Spell': 'heal_over_time',
  'Rage Spell': 'buff',
  'Poison Spell': 'debuff',
  'Freeze Spell': 'freeze',
  'Jump Spell': 'jump',
  'Haste Spell': 'haste',
  'Skeleton Spell': 'skeleton_spawn',
  'Bat Spell': 'bat_spawn',
  'Clone Spell': 'clone',
  'Invisibility Spell': 'invisibility',
};

export function isInRadius(x1: number, y1: number, x2: number, y2: number, radius: number): boolean {
  return distance(x1, y1, x2, y2) <= radius;
}

function resolveLevel(spell: SpellData, level: number): SpellLevelStats | undefined {
  return spell.levels.find((l) => l.level === level);
}

/** Read a numeric field from spell level stats with a fallback. */
function stat(stats: SpellLevelStats | undefined, key: string, fallback: number): number {
  return (stats?.[key] as number | undefined) ?? fallback;
}

// -- Instant spell application ----------------------------------------------

function applyHpDamage<T extends { currentHp: number; maxHp: number; isDestroyed: boolean; x: number; y: number }>(
  items: T[], x: number, y: number, radius: number, dmgFn: (item: T) => number,
): T[] {
  return items.map((item) => {
    if (item.isDestroyed || !isInRadius(x, y, item.x, item.y, radius)) return item;
    const hp = Math.max(0, item.currentHp - dmgFn(item));
    return { ...item, currentHp: hp, isDestroyed: hp <= 0 };
  });
}

export function applyLightningDamage(
  buildings: BattleBuilding[], defenses: ActiveDefense[],
  x: number, y: number, radius: number, totalDamage: number,
): { buildings: BattleBuilding[]; defenses: ActiveDefense[] } {
  const count = buildings.filter((b) => !b.isDestroyed && isInRadius(x, y, b.x, b.y, radius)).length
    + defenses.filter((d) => !d.isDestroyed && isInRadius(x, y, d.x, d.y, radius)).length;
  if (count === 0) return { buildings, defenses };
  const dmgEach = totalDamage / count;
  return {
    buildings: applyHpDamage(buildings, x, y, radius, () => dmgEach),
    defenses: applyHpDamage(defenses, x, y, radius, () => dmgEach),
  };
}

/**
 * Calculate Earthquake diminishing returns damage.
 * Successive casts on the same building: 1st = full, 2nd = 1/3, 3rd = 1/5, 4th = 1/7.
 * Formula: damage = baseDamage / (2*n - 1) where n = hit count (1-based).
 * For walls: 4th+ earthquake always destroys the wall (returns maxHp as damage).
 * 3 earthquakes can never destroy a wall of any level.
 */
export function earthquakeDamageForHit(
  baseDamagePercent: number, hitNumber: number, maxHp: number, isWall: boolean,
): number {
  if (isWall && hitNumber >= 4) return maxHp; // 4 earthquakes always destroy walls
  const diminishedPercent = baseDamagePercent / (2 * hitNumber - 1);
  return maxHp * (diminishedPercent / 100);
}

export function applyEarthquakeDamage(
  buildings: BattleBuilding[], defenses: ActiveDefense[],
  x: number, y: number, radius: number, damagePercent: number,
): { buildings: BattleBuilding[]; defenses: ActiveDefense[] } {
  const updatedBuildings = buildings.map((b) => {
    if (b.isDestroyed || !isInRadius(x, y, b.x, b.y, radius)) return b;
    const hitCount = (b.earthquakeHitCount ?? 0) + 1;
    const isWall = b.name === 'Wall';
    const dmg = earthquakeDamageForHit(damagePercent, hitCount, b.maxHp, isWall);
    const hp = Math.max(0, b.currentHp - dmg);
    return { ...b, currentHp: hp, isDestroyed: hp <= 0, earthquakeHitCount: hitCount };
  });

  const updatedDefenses = defenses.map((d) => {
    if (d.isDestroyed || !isInRadius(x, y, d.x, d.y, radius)) return d;
    // Defenses use the same diminishing returns (non-wall formula)
    const matchBuilding = updatedBuildings.find((b) => b.instanceId === d.buildingInstanceId);
    const hitCount = matchBuilding?.earthquakeHitCount ?? 1;
    const dmg = earthquakeDamageForHit(damagePercent, hitCount, d.maxHp, false);
    const hp = Math.max(0, d.currentHp - dmg);
    return { ...d, currentHp: hp, isDestroyed: hp <= 0 };
  });

  return { buildings: updatedBuildings, defenses: updatedDefenses };
}

// -- Spell deployment -------------------------------------------------------

type InstantApplier = (
  state: BattleState, spellData: SpellData, ls: SpellLevelStats, x: number, y: number,
) => BattleState;

const INSTANT_APPLIERS: Record<string, InstantApplier> = {
  instant_damage: (state, spellData, ls, x, y) => {
    const { buildings, defenses } = applyLightningDamage(
      state.buildings, state.defenses, x, y, spellData.radius ?? 2, stat(ls, 'totalDamage', 0),
    );
    return { ...state, buildings, defenses };
  },
  instant_building_pct: (state, _sd, ls, x, y) => {
    const { buildings, defenses } = applyEarthquakeDamage(
      state.buildings, state.defenses, x, y, stat(ls, 'radius', 3.5), stat(ls, 'damagePercent', 0),
    );
    return { ...state, buildings, defenses };
  },
  freeze: (state, spellData, ls, x, y) => {
    const radius = spellData.radius ?? 3.5;
    const freezeDuration = stat(ls, 'freezeTime', spellData.duration ?? 4);
    const elapsed = 180 - state.timeRemaining; // Current elapsed time

    // Freeze defenses in radius
    const defenses = state.defenses.map((d) => {
      if (d.isDestroyed || !isInRadius(x, y, d.x, d.y, radius)) return d;
      return {
        ...d, isFrozen: true, frozenUntil: elapsed + freezeDuration,
        // Reset Inferno Tower damage ramp when frozen
        infernoRampTime: d.name === 'Inferno Tower' ? 0 : d.infernoRampTime,
      };
    });

    // Freeze enemy CC troops in radius (slow to 0 speed)
    const troops = state.deployedTroops.map((t) => {
      if (t.state === 'dead' || !isInRadius(x, y, t.x, t.y, radius)) return t;
      // Enemy troops would be frozen in a real implementation
      return t;
    });

    return { ...state, defenses, deployedTroops: troops };
  },
  skeleton_spawn: (state, _sd, ls, x, y) => {
    const count = stat(ls, 'skeletonCount', 8);
    const skeletons: DeployedTroop[] = [];
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 3;
      const offsetY = (Math.random() - 0.5) * 3;
      skeletons.push({
        id: `skeleton_${Date.now()}_${i}`,
        name: 'Skeleton',
        level: 1,
        currentHp: 30,
        maxHp: 30,
        x: x + offsetX,
        y: y + offsetY,
        targetId: null,
        state: 'idle',
        dps: 25,
        baseDps: 25,
        attackRange: 0.5,
        movementSpeed: 24,
        isFlying: false,
      });
    }
    return { ...state, deployedTroops: [...state.deployedTroops, ...skeletons] };
  },
  bat_spawn: (state, _sd, ls, x, y) => {
    const count = stat(ls, 'batCount', 7);
    const bats: DeployedTroop[] = [];
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 3;
      const offsetY = (Math.random() - 0.5) * 3;
      bats.push({
        id: `bat_${Date.now()}_${i}`,
        name: 'Bat',
        level: 1,
        currentHp: 20,
        maxHp: 20,
        x: x + offsetX,
        y: y + offsetY,
        targetId: null,
        state: 'idle',
        dps: 30,
        baseDps: 30,
        attackRange: 0.5,
        movementSpeed: 32,
        isFlying: true,
      });
    }
    return { ...state, deployedTroops: [...state.deployedTroops, ...bats] };
  },
};

export function deploySpell(
  state: BattleState, spellName: string, x: number, y: number,
): BattleState | null {
  const idx = state.availableSpells.findIndex((s) => s.name === spellName && s.count > 0);
  if (idx === -1) return null;

  const spellData = getSpell(spellName);
  if (!spellData) return null;

  const slot = state.availableSpells[idx]!;
  const levelStats = resolveLevel(spellData, slot.level);
  if (!levelStats) return null;

  const effect = SPELL_EFFECTS[spellName];
  if (!effect) return null;

  const availableSpells = state.availableSpells.map((s, i) =>
    i === idx ? { ...s, count: s.count - 1 } : s,
  );
  const base = { ...state, availableSpells };

  const instantApply = INSTANT_APPLIERS[effect];
  if (instantApply) return instantApply(base, spellData, levelStats, x, y);

  // Duration spells: create an ActiveSpell entry
  const radius = stat(levelStats, 'radius', spellData.radius ?? 5);
  const duration = spellData.duration ?? 0;
  const activeSpell: ActiveSpell = {
    id: `${spellData.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: spellData.name, level: slot.level, x, y,
    radius, remainingDuration: duration, totalDuration: duration,
  };
  return { ...base, spells: [...base.spells, activeSpell] };
}

// -- Per-tick effects -------------------------------------------------------

type TickResult = {
  spells: ActiveSpell[]; troops: DeployedTroop[];
  buildings: BattleBuilding[]; defenses: ActiveDefense[];
};

function spellStat(spell: ActiveSpell, key: string, fallback: number): number {
  const data = getSpell(spell.name);
  if (!data) return fallback;
  return stat(resolveLevel(data, spell.level), key, fallback);
}

type TickApplier = (spell: ActiveSpell, troops: DeployedTroop[], deltaSec: number) => DeployedTroop[];

const TICK_APPLIERS: Record<string, TickApplier> = {
  heal_over_time: (spell, troops, deltaSec) => {
    const heal = spellStat(spell, 'healingPerSecond', 0) * deltaSec;
    return troops.map((t) => {
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      if (t.healingNerfed) return t; // Inferno Tower negates healing
      return { ...t, currentHp: Math.min(t.maxHp, t.currentHp + heal) };
    });
  },
  buff: (spell, troops) => {
    const mult = spellStat(spell, 'damageMultiplier', 1);
    const spd = spellStat(spell, 'speedIncrease', 0);
    return troops.map((t) => {
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      return { ...t, dps: t.baseDps * mult, movementSpeed: t.movementSpeed + spd };
    });
  },
  haste: (spell, troops) => {
    // Haste only boosts speed, NOT damage
    const spd = spellStat(spell, 'speedIncrease', 28);
    return troops.map((t) => {
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      return { ...t, movementSpeed: t.movementSpeed + spd };
    });
  },
  debuff: (spell, troops, deltaSec) => {
    const dmg = spellStat(spell, 'maxDamagePerSecond', 0) * deltaSec;
    const slowFactor = spellStat(spell, 'speedDecrease', 0.5);
    return troops.map((t) => {
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      const hp = Math.max(0, t.currentHp - dmg);
      return {
        ...t, currentHp: hp,
        movementSpeed: t.movementSpeed * slowFactor, // Poison slows movement
        state: hp <= 0 ? 'dead' as const : t.state,
      };
    });
  },
  invisibility: (spell, troops) => {
    // Troops in radius become untargetable (reuse burrowed flag)
    return troops.map((t) => {
      if (t.state === 'dead') return t;
      const inRadius = isInRadius(spell.x, spell.y, t.x, t.y, spell.radius);
      return { ...t, isBurrowed: inRadius || t.isBurrowed };
    });
  },
  jump: (spell, troops) => {
    // Ground troops in radius can jump over walls (ignore wall collision)
    return troops.map((t) => {
      if (t.state === 'dead' || t.isFlying) return t;
      const inRadius = isInRadius(spell.x, spell.y, t.x, t.y, spell.radius);
      return { ...t, jumpSpellActive: inRadius };
    });
  },
};

export function tickSpells(
  spells: ActiveSpell[], troops: DeployedTroop[],
  buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): TickResult {
  const deltaSec = deltaMs / 1000;
  let updatedTroops = [...troops];

  for (const spell of spells) {
    const effect = SPELL_EFFECTS[spell.name];
    const applier = effect ? TICK_APPLIERS[effect] : undefined;
    if (applier) updatedTroops = applier(spell, updatedTroops, deltaSec);
  }

  const updatedSpells = spells
    .map((s) => ({ ...s, remainingDuration: s.remainingDuration - deltaSec }))
    .filter((s) => s.remainingDuration > 0);

  return { spells: updatedSpells, troops: updatedTroops, buildings: [...buildings], defenses: [...defenses] };
}
