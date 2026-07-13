import type {
  BattleState, ActiveSpell, DeployedTroop, BattleBuilding, ActiveDefense,
} from '../types/battle.ts';
import type { SpellData, SpellLevelStats } from '../types/troops.ts';
import { getSpell } from '../data/loaders/spell-loader.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { distance } from './targeting-ai.ts';

type SpellEffect =
  | 'instant_damage' | 'instant_building_pct'
  | 'heal_over_time' | 'buff' | 'debuff'
  | 'freeze' | 'haste' | 'skeleton_spawn' | 'bat_spawn' | 'clone' | 'invisibility'
  | 'jump' | 'recall';

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
  'Recall Spell': 'recall',
};

// Clone Spell copies are weaker than the originals and expire on their own.
const CLONE_HP_MULTIPLIER = 1;
const CLONE_FALLBACK_LIFESPAN = 30;
const CLONE_FALLBACK_RADIUS = 3.5;
const RECALL_FALLBACK_RADIUS = 5;

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

// -- Clone and Recall helpers -------------------------------------------------

/** Pick units nearest the spell center whose combined housing fits the cap. */
function packByHousing(
  candidates: DeployedTroop[], x: number, y: number, capacity: number,
): DeployedTroop[] {
  const sorted = [...candidates].sort(
    (a, b) => distance(x, y, a.x, a.y) - distance(x, y, b.x, b.y),
  );
  const picked: DeployedTroop[] = [];
  let remaining = capacity;
  for (const t of sorted) {
    const housing = unitHousing(t);
    if (housing === undefined || housing > remaining) continue;
    picked.push(t);
    remaining -= housing;
  }
  return picked;
}

function unitHousing(troop: DeployedTroop): number | undefined {
  if (troop.isPet) return 0;
  return troop.isHero ? 25 : getTroop(troop.name)?.housingSpace;
}

/** Clone targets attacker troops only; never heroes, defenders, or other clones. */
function isClonableTroop(t: DeployedTroop, x: number, y: number, radius: number): boolean {
  if (t.state === 'dead' || t.isDefender || t.isHero || t.isPet || t.isClone) return false;
  return isInRadius(x, y, t.x, t.y, radius);
}

/**
 * Recall independently returns deploy-bar troops, heroes, and assigned pets
 * inside its radius. Clones, summons, and defenders stay put.
 */
function isRecallableTroop(t: DeployedTroop, x: number, y: number, radius: number): boolean {
  if (t.state === 'dead' || t.isDefender || t.isClone) return false;
  if (t.isPet) {
    if (!t.ownerHeroName || ['Frostmite', 'Booger'].includes(t.name)) return false;
    return isInRadius(x, y, t.x, t.y, radius);
  }
  if (!t.id.startsWith('troop_') && !t.isHero) return false;
  return isInRadius(x, y, t.x, t.y, radius);
}

/** Build a full-HP copy of a troop with a limited lifespan. */
function makeClone(source: DeployedTroop, lifespan: number, index: number): DeployedTroop {
  const hp = Math.max(1, Math.round(source.maxHp * CLONE_HP_MULTIPLIER));
  return {
    ...source,
    id: `clone_${source.id}_${index}`,
    currentHp: hp,
    maxHp: hp,
    x: source.x + ((index % 3) - 1) * 0.5,
    y: source.y + ((Math.floor(index / 3) % 3) - 1) * 0.5,
    targetId: null,
    state: 'idle',
    isClone: true,
    cloneLifespanRemaining: lifespan,
  };
}

/** Merge recalled units back into the attacker's deploy bar counts. */
function returnTroopsToDeployBar(
  available: BattleState['availableTroops'], recalled: DeployedTroop[],
): BattleState['availableTroops'] {
  const updated = available.map((s) => ({ ...s }));
  for (const t of recalled) {
    const slot = updated.find((s) => s.name === t.name && s.level === t.level);
    if (slot) slot.count += 1;
    else updated.push({ name: t.name, level: t.level, count: 1 });
  }
  return updated;
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
    const freezeDuration = stat(ls, 'freezeDuration', spellData.duration ?? 4);
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

    // Freeze enemy Clan Castle troops in radius until the battle clock expires it.
    const troops = state.deployedTroops.map((t) => {
      if (!t.isDefender || t.state === 'dead' || !isInRadius(x, y, t.x, t.y, radius)) return t;
      return { ...t, isFrozen: true, frozenUntil: elapsed + freezeDuration };
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
  clone: (state, spellData, ls, x, y) => {
    const radius = spellData.radius ?? CLONE_FALLBACK_RADIUS;
    const capacity = stat(ls, 'clonedCapacity', 22);
    const lifespan = (spellData.clonedLifespan as number | undefined) ?? CLONE_FALLBACK_LIFESPAN;
    const eligible = state.deployedTroops.filter((t) => isClonableTroop(t, x, y, radius));
    const selected = packByHousing(eligible, x, y, capacity);
    const clones = selected
      .map((t, i) => makeClone(t, lifespan, i));
    const usedCapacity = selected.reduce((sum, troop) => sum + (unitHousing(troop) ?? 0), 0);
    const ringDuration = (spellData.spellDuration as number | undefined) ?? 18;
    const ring: ActiveSpell = {
      id: `clone-ring-${Date.now()}`,
      name: 'Clone Spell',
      level: ls.level,
      x,
      y,
      radius,
      remainingDuration: ringDuration,
      totalDuration: ringDuration,
      remainingCloneCapacity: capacity - usedCapacity,
      clonedSourceIds: selected.map((troop) => troop.id),
      cloneLifespan: lifespan,
    };
    return { ...state, deployedTroops: [...state.deployedTroops, ...clones], spells: [...state.spells, ring] };
  },
  recall: (state, spellData, ls, x, y) => {
    const radius = spellData.radius ?? RECALL_FALLBACK_RADIUS;
    const capacity = stat(ls, 'recalledCapacity', 83);
    const eligible = state.deployedTroops.filter((t) => isRecallableTroop(t, x, y, radius));
    const recalled = packByHousing(eligible, x, y, capacity);
    if (recalled.length === 0) return state;
    const recalledHeroes = new Set(recalled.filter(t => t.isHero).map(t => t.name));
    const recalledPets = recalled.filter(t => t.isPet && t.ownerHeroName);
    const recalledPetOwners = new Set(recalledPets.map(t => t.ownerHeroName));
    const recalledIds = new Set(recalled.map((t) => t.id));
    const regularTroops = recalled.filter(t => !t.isHero && !t.isPet);
    return {
      ...state,
      deployedTroops: state.deployedTroops.filter((t) => !recalledIds.has(t.id)),
      availableTroops: returnTroopsToDeployBar(state.availableTroops, regularTroops),
      availableHeroes: (state.availableHeroes ?? []).map((hero) => {
        if (!recalledHeroes.has(hero.name) && !recalledPetOwners.has(hero.name)) return hero;
        const recalledHero = recalled.find((troop) => troop.isHero && troop.name === hero.name);
        const recalledPet = recalledPets.find((troop) => troop.ownerHeroName === hero.name);
        return {
          ...hero,
          deployed: recalledHero ? false : hero.deployed,
          recalledTroop: recalledHero ? { ...recalledHero } : hero.recalledTroop,
          pet: hero.pet
            ? { ...hero.pet, recalledTroop: recalledPet ? { ...recalledPet } : hero.pet.recalledTroop }
            : hero.pet,
        };
      }),
    };
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

function applyCloneRing(
  spell: ActiveSpell,
  troops: DeployedTroop[],
): { spell: ActiveSpell; troops: DeployedTroop[] } {
  const remaining = spell.remainingCloneCapacity ?? 0;
  if (remaining <= 0) return { spell, troops };
  const alreadyCloned = new Set(spell.clonedSourceIds ?? []);
  const candidates = troops.filter((troop) => (
    !alreadyCloned.has(troop.id)
    && isClonableTroop(troop, spell.x, spell.y, spell.radius)
  ));
  const selected = packByHousing(candidates, spell.x, spell.y, remaining);
  if (selected.length === 0) return { spell, troops };
  const clones = selected.map((troop, index) => (
    makeClone(troop, spell.cloneLifespan ?? CLONE_FALLBACK_LIFESPAN, troops.length + index)
  ));
  const used = selected.reduce((sum, troop) => sum + (unitHousing(troop) ?? 0), 0);
  return {
    spell: {
      ...spell,
      remainingCloneCapacity: remaining - used,
      clonedSourceIds: [...alreadyCloned, ...selected.map((troop) => troop.id)],
    },
    troops: [...troops, ...clones],
  };
}

const TICK_APPLIERS: Record<string, TickApplier> = {
  heal_over_time: (spell, troops, deltaSec) => {
    const heal = spellStat(spell, 'healingPerSecond', 0) * deltaSec;
    return troops.map((t) => {
      if (t.isDefender) return t; // Attacker spells never help defender units
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      if (t.healingNerfed) return t; // Inferno Tower negates healing
      return { ...t, currentHp: Math.min(t.maxHp, t.currentHp + heal) };
    });
  },
  buff: (spell, troops) => {
    const mult = spellStat(spell, 'damageMultiplier', 1);
    const spd = spellStat(spell, 'speedIncrease', 0);
    return troops.map((t) => {
      if (t.isDefender) return t; // Attacker spells never help defender units
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      return {
        ...t,
        preSpellDps: t.preSpellDps ?? t.dps,
        dps: t.baseDps * mult,
        preSpellMovementSpeed: t.preSpellMovementSpeed ?? t.movementSpeed,
        movementSpeed: t.movementSpeed + spd,
      };
    });
  },
  haste: (spell, troops) => {
    // Haste only boosts speed, NOT damage
    const spd = spellStat(spell, 'speedIncrease', 28);
    return troops.map((t) => {
      if (t.isDefender) return t; // Attacker spells never help defender units
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      return {
        ...t,
        preSpellMovementSpeed: t.preSpellMovementSpeed ?? t.movementSpeed,
        movementSpeed: t.movementSpeed + spd,
      };
    });
  },
  debuff: (spell, troops, deltaSec) => {
    const dmg = spellStat(spell, 'maxDamagePerSecond', 0) * deltaSec;
    const slowPct = spellStat(spell, 'speedDecrease', 50); // percentage slow
    const attackSlowPct = spellStat(spell, 'attackRateDecrease', 35);
    return troops.map((t) => {
      // Poison only affects defender troops, never the attacker's own army
      if (!t.isDefender) return t;
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      const hp = Math.max(0, t.currentHp - dmg);
      return {
        ...t, currentHp: hp,
        preSpellMovementSpeed: t.preSpellMovementSpeed ?? t.movementSpeed,
        movementSpeed: t.movementSpeed * (1 - slowPct / 100), // Poison slows movement
        preSpellAttackRateMultiplier: t.preSpellAttackRateMultiplier ?? t.attackRateMultiplier ?? 1,
        attackRateMultiplier: (t.preSpellAttackRateMultiplier ?? t.attackRateMultiplier ?? 1)
          * (1 - attackSlowPct / 100),
        state: hp <= 0 ? 'dead' as const : t.state,
      };
    });
  },
  invisibility: (spell, troops) => {
    // Troops in radius become untargetable (reuse burrowed flag)
    return troops.map((t) => {
      if (t.state === 'dead' || t.isDefender) return t;
      const inRadius = isInRadius(spell.x, spell.y, t.x, t.y, spell.radius);
      return { ...t, isBurrowed: inRadius || t.isBurrowed };
    });
  },
  jump: (spell, troops) => {
    // Ground troops in radius can jump over walls (ignore wall collision)
    return troops.map((t) => {
      if (t.state === 'dead' || t.isFlying || t.isDefender) return t;
      const inRadius = isInRadius(spell.x, spell.y, t.x, t.y, spell.radius);
      return { ...t, jumpSpellActive: inRadius || t.jumpSpellActive === true };
    });
  },
};

/**
 * Restore spell-modified stats and flags before recomputing coverage for
 * this tick. Keeps buffs from compounding and clears effects once a troop
 * leaves a spell radius or the spell expires. Miner burrowing and hero
 * cloak invisibility are managed elsewhere, so their flags are preserved.
 */
function clearSpellEffects(t: DeployedTroop): DeployedTroop {
  if (t.state === 'dead') return t;
  const cleared = { ...t };
  if (cleared.preSpellDps !== undefined) {
    cleared.dps = cleared.preSpellDps;
    cleared.preSpellDps = undefined;
  }
  if (cleared.preSpellMovementSpeed !== undefined) {
    cleared.movementSpeed = cleared.preSpellMovementSpeed;
    cleared.preSpellMovementSpeed = undefined;
  }
  if (cleared.preSpellAttackRateMultiplier !== undefined) {
    cleared.attackRateMultiplier = cleared.preSpellAttackRateMultiplier;
    cleared.preSpellAttackRateMultiplier = undefined;
  }
  if (cleared.name !== 'Miner' && cleared.invisibleUntil === undefined) {
    cleared.isBurrowed = false;
  }
  cleared.jumpSpellActive = false;
  return cleared;
}

export function tickSpells(
  spells: ActiveSpell[], troops: DeployedTroop[],
  buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): TickResult {
  const deltaSec = deltaMs / 1000;
  let updatedTroops = troops.map(clearSpellEffects);

  const activeSpellStates = spells.map((spell) => ({ ...spell }));
  for (let index = 0; index < activeSpellStates.length; index++) {
    const spell = activeSpellStates[index]!;
    const effect = SPELL_EFFECTS[spell.name];
    if (effect === 'clone') {
      const result = applyCloneRing(spell, updatedTroops);
      activeSpellStates[index] = result.spell;
      updatedTroops = result.troops;
      continue;
    }
    const applier = effect ? TICK_APPLIERS[effect] : undefined;
    if (applier) updatedTroops = applier(spell, updatedTroops, deltaSec);
  }

  const updatedSpells = activeSpellStates
    .map((s) => ({ ...s, remainingDuration: s.remainingDuration - deltaSec }))
    .filter((s) => s.remainingDuration > 0);

  return { spells: updatedSpells, troops: updatedTroops, buildings: [...buildings], defenses: [...defenses] };
}
