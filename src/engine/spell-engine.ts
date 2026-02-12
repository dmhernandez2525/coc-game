import type {
  BattleState, ActiveSpell, DeployedTroop, BattleBuilding, ActiveDefense,
} from '../types/battle.ts';
import type { SpellData, SpellLevelStats } from '../types/troops.ts';
import { getSpell } from '../data/loaders/spell-loader.ts';
import { distance } from './targeting-ai.ts';

type SpellEffect = 'instant_damage' | 'instant_building_pct' | 'heal_over_time' | 'buff' | 'debuff';

const SPELL_EFFECTS: Record<string, SpellEffect> = {
  'Lightning Spell': 'instant_damage',
  'Earthquake Spell': 'instant_building_pct',
  'Healing Spell': 'heal_over_time',
  'Rage Spell': 'buff',
  'Poison Spell': 'debuff',
  'Freeze Spell': 'buff',
  'Haste Spell': 'buff',
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

export function applyEarthquakeDamage(
  buildings: BattleBuilding[], defenses: ActiveDefense[],
  x: number, y: number, radius: number, damagePercent: number,
): { buildings: BattleBuilding[]; defenses: ActiveDefense[] } {
  const fraction = damagePercent / 100;
  return {
    buildings: applyHpDamage(buildings, x, y, radius, (b) => b.maxHp * fraction),
    defenses: applyHpDamage(defenses, x, y, radius, (d) => d.maxHp * fraction),
  };
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
      return { ...t, currentHp: Math.min(t.maxHp, t.currentHp + heal) };
    });
  },
  buff: (spell, troops) => {
    if (spell.name !== 'Rage Spell') return troops;
    const mult = spellStat(spell, 'damageMultiplier', 1);
    const spd = spellStat(spell, 'speedIncrease', 0);
    return troops.map((t) => {
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      return { ...t, dps: t.dps * mult, movementSpeed: t.movementSpeed + spd };
    });
  },
  debuff: (spell, troops, deltaSec) => {
    const dmg = spellStat(spell, 'maxDamagePerSecond', 0) * deltaSec;
    return troops.map((t) => {
      if (t.state === 'dead' || !isInRadius(spell.x, spell.y, t.x, t.y, spell.radius)) return t;
      const hp = Math.max(0, t.currentHp - dmg);
      return { ...t, currentHp: hp, state: hp <= 0 ? 'dead' as const : t.state };
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
