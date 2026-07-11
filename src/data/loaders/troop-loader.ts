import type { TroopData, SuperTroopData } from '../../types';
import elixirTroopsJson from '../elixir_troops.json';
import darkElixirTroopsJson from '../dark_elixir_troops.json';
import superTroopsJson from '../super_troops.json';

// Normalize favoriteTarget: convert "None" string to null
function normalizeTroop(troop: TroopData): TroopData {
  return {
    ...troop,
    favoriteTarget: troop.favoriteTarget === 'None' ? null : troop.favoriteTarget,
  };
}

// Elixir troops come as an object-map, normalize favoriteTarget
const rawElixirTroops = elixirTroopsJson as unknown as Record<string, TroopData>;
export const elixirTroops: Record<string, TroopData> = Object.fromEntries(
  Object.entries(rawElixirTroops).map(([key, troop]) => [key, normalizeTroop(troop)]),
);

// Dark elixir troops come as an array; normalize to Record and fix favoriteTarget
const rawDarkTroopsArray = darkElixirTroopsJson as unknown as TroopData[];
export const darkElixirTroops: Record<string, TroopData> = Object.fromEntries(
  rawDarkTroopsArray.map((troop) => [troop.name, normalizeTroop(troop)]),
);

// Super troops resolve through getTroop too so training and battle deployment
// can use them anywhere a base troop name works. Their level stats carry no
// upgrade economy (boosting replaces the base troop instead of researching),
// so upgrade fields are zeroed and the resource/type come from the base troop.
function superTroopToTroopData(superTroop: SuperTroopData): TroopData {
  const baseTroop = elixirTroops[superTroop.baseTroop] ?? darkElixirTroops[superTroop.baseTroop];

  return {
    name: superTroop.name,
    type: baseTroop?.type ?? 'elixir',
    housingSpace: superTroop.housingSpace,
    movementSpeed: superTroop.movementSpeed,
    attackRange: superTroop.attackRange,
    attackSpeed: superTroop.attackSpeed,
    damageType: superTroop.damageType,
    targetType: superTroop.targetType,
    isFlying: superTroop.isFlying,
    favoriteTarget: superTroop.favoriteTarget === 'None' ? null : superTroop.favoriteTarget,
    thUnlock: superTroop.thRequired,
    specialMechanics: superTroop.specialAbility,
    levels: superTroop.levels.map((lvl) => ({
      level: lvl.level,
      dps: lvl.dps,
      hp: lvl.hp,
      damagePerAttack: lvl.damagePerAttack,
      upgradeCost: 0,
      upgradeResource: baseTroop?.levels[0]?.upgradeResource ?? 'Elixir',
      upgradeTime: 0,
      labLevelRequired: null,
    })),
  };
}

const rawSuperTroopsArray = superTroopsJson as unknown as SuperTroopData[];
export const superTroopsAsTroops: Record<string, TroopData> = Object.fromEntries(
  rawSuperTroopsArray.map((troop) => [troop.name, superTroopToTroopData(troop)]),
);

export function getTroop(name: string): TroopData | undefined {
  return elixirTroops[name] ?? darkElixirTroops[name] ?? superTroopsAsTroops[name];
}

/** All regular troops. Super troops are excluded; they appear via boosts. */
export function getAllTroops(): TroopData[] {
  return [...Object.values(elixirTroops), ...Object.values(darkElixirTroops)];
}
