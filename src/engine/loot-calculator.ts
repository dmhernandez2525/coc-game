import type { VillageState, ResourceAmounts, PlacedBuilding } from '../types/village.ts';
import { getTreasury, calculateTreasurySteal } from './treasury-manager.ts';

const STORAGE_LOOT_PCT: Record<number, { goldElixir: number; darkElixir: number }> = {
  1: { goldElixir: 0.20, darkElixir: 0 },
  2: { goldElixir: 0.20, darkElixir: 0 },
  3: { goldElixir: 0.20, darkElixir: 0 },
  4: { goldElixir: 0.20, darkElixir: 0 },
  5: { goldElixir: 0.20, darkElixir: 0 },
  6: { goldElixir: 0.18, darkElixir: 0.06 },
  7: { goldElixir: 0.16, darkElixir: 0.06 },
  8: { goldElixir: 0.14, darkElixir: 0.06 },
  9: { goldElixir: 0.12, darkElixir: 0.05 },
  10: { goldElixir: 0.10, darkElixir: 0.05 },
  11: { goldElixir: 0.08, darkElixir: 0.045 },
  12: { goldElixir: 0.08, darkElixir: 0.045 },
  13: { goldElixir: 0.08, darkElixir: 0.045 },
  14: { goldElixir: 0.08, darkElixir: 0.045 },
  15: { goldElixir: 0.04, darkElixir: 0.035 },
  16: { goldElixir: 0.04, darkElixir: 0.035 },
  17: { goldElixir: 0.04, darkElixir: 0.035 },
};

const TH_PENALTY: Record<number, number> = {
  0: 1.0,
  1: 0.9,
  2: 0.5,
  3: 0.25,
};

const COLLECTOR_RESOURCE_MAP: Record<string, 'gold' | 'elixir' | 'darkElixir'> = {
  'Gold Mine': 'gold',
  'Elixir Collector': 'elixir',
  'Dark Elixir Drill': 'darkElixir',
};

const TROPHY_MULTIPLIERS: Record<number, number> = {
  0: -1,
  1: 0.5,
  2: 0.75,
  3: 1,
};

export function calculateStorageLoot(
  defenderResources: ResourceAmounts,
  defenderTHLevel: number,
): { gold: number; elixir: number; darkElixir: number } {
  const pct = STORAGE_LOOT_PCT[defenderTHLevel] ?? STORAGE_LOOT_PCT[17]!;

  return {
    gold: Math.floor(defenderResources.gold * pct.goldElixir),
    elixir: Math.floor(defenderResources.elixir * pct.goldElixir),
    darkElixir: Math.floor(defenderResources.darkElixir * pct.darkElixir),
  };
}

export function calculateCollectorLoot(
  defenderBuildings: PlacedBuilding[],
): { gold: number; elixir: number; darkElixir: number } {
  const totals = { gold: 0, elixir: 0, darkElixir: 0 };

  for (const building of defenderBuildings) {
    if (building.buildingType !== 'resource_collector') continue;

    const resourceKey = COLLECTOR_RESOURCE_MAP[building.buildingId];
    if (!resourceKey) continue;

    const uncollected = building.uncollectedResources ?? 0;
    totals[resourceKey] += Math.floor(uncollected * 0.5);
  }

  return totals;
}

export function applyTHPenalty(
  loot: { gold: number; elixir: number; darkElixir: number },
  attackerTH: number,
  defenderTH: number,
): { gold: number; elixir: number; darkElixir: number } {
  const diff = attackerTH - defenderTH;

  if (diff <= 0) {
    return { ...loot };
  }

  const multiplier = diff >= 4 ? 0.05 : (TH_PENALTY[diff] ?? 0.05);

  return {
    gold: Math.floor(loot.gold * multiplier),
    elixir: Math.floor(loot.elixir * multiplier),
    darkElixir: Math.floor(loot.darkElixir * multiplier),
  };
}

export function calculateTotalLoot(
  defenderVillage: VillageState,
  attackerTHLevel: number,
): { gold: number; elixir: number; darkElixir: number } {
  const storageLoot = calculateStorageLoot(
    defenderVillage.resources,
    defenderVillage.townHallLevel,
  );
  const collectorLoot = calculateCollectorLoot(defenderVillage.buildings);

  const combined = {
    gold: storageLoot.gold + collectorLoot.gold,
    elixir: storageLoot.elixir + collectorLoot.elixir,
    darkElixir: storageLoot.darkElixir + collectorLoot.darkElixir,
  };

  const penalized = applyTHPenalty(combined, attackerTHLevel, defenderVillage.townHallLevel);

  // Treasury contents are far better protected: only 3% is stealable,
  // and the TH-difference penalty does not apply to it
  const treasuryLoot = calculateTreasurySteal(getTreasury(defenderVillage));

  return {
    gold: penalized.gold + treasuryLoot.gold,
    elixir: penalized.elixir + treasuryLoot.elixir,
    darkElixir: penalized.darkElixir + treasuryLoot.darkElixir,
  };
}

// Buildings that hold each resource type during a raid, in priority order.
const LOOT_HOLDER_IDS: Record<'gold' | 'elixir' | 'darkElixir', string[]> = {
  gold: ['Gold Storage', 'Gold Mine', 'Town Hall'],
  elixir: ['Elixir Storage', 'Elixir Collector', 'Town Hall'],
  darkElixir: ['Dark Elixir Storage', 'Dark Elixir Drill', 'Town Hall'],
};

/**
 * Spread the total available loot across the defender buildings that hold each
 * resource. The attacker earns a building's share when it is destroyed.
 * Splits evenly per resource; any rounding remainder goes to the first holder
 * so the distributed total always matches the input exactly.
 */
export function distributeLootAcrossBuildings(
  totalLoot: { gold: number; elixir: number; darkElixir: number },
  buildings: PlacedBuilding[],
): Record<string, { gold: number; elixir: number; darkElixir: number }> {
  const shares: Record<string, { gold: number; elixir: number; darkElixir: number }> = {};

  for (const resource of ['gold', 'elixir', 'darkElixir'] as const) {
    const amount = totalLoot[resource];
    if (amount <= 0) continue;

    const holderIds = LOOT_HOLDER_IDS[resource];
    let holders = buildings.filter((b) => holderIds.includes(b.buildingId));
    if (holders.length === 0) holders = buildings;
    if (holders.length === 0) continue;

    const perBuilding = Math.floor(amount / holders.length);
    const remainder = amount - perBuilding * holders.length;

    holders.forEach((holder, i) => {
      const share = shares[holder.instanceId] ?? { gold: 0, elixir: 0, darkElixir: 0 };
      share[resource] += perBuilding + (i === 0 ? remainder : 0);
      shares[holder.instanceId] = share;
    });
  }

  return shares;
}

export function calculateTrophyChange(stars: number, trophyOffer: number): number {
  const multiplier = TROPHY_MULTIPLIERS[stars];
  if (multiplier === undefined) return 0;

  if (stars === 0) return -trophyOffer;

  return Math.floor(trophyOffer * multiplier);
}
