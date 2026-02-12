// Clan system: single-player clan management with castle troops and perks.
// All functions are pure: they return new state, never mutate.

import { getTroop } from '../data/loaders/troop-loader.ts';

export interface ClanState {
  name: string;
  level: number;
  xp: number;
  badgeIndex: number;
  castleTroops: Array<{ name: string; level: number; count: number }>;
}

export const CLAN_BADGES = [
  'Shield', 'Sword', 'Crown', 'Star', 'Dragon', 'Skull', 'Phoenix', 'Hammer',
] as const;

// XP required to reach each level (index = level)
const XP_THRESHOLDS: readonly number[] = [
  0,    // level 1 (starting)
  0,    // level 1: 0 cumulative
  500,  // level 2
  700,  // level 3
  900,  // level 4
  1200, // level 5
  1500, // level 6
  1800, // level 7
  2200, // level 8
  2600, // level 9
  3000, // level 10
] as const;

const MAX_CLAN_LEVEL = 10;

// Perk values keyed by perk name, then indexed by clan level
const PERK_TABLE: Record<string, readonly number[]> = {
  troopDonationCapacity: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  donationUpgradeBonus:  [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3],
  treasuryStorageBonus:  [0, 0, 5, 5, 10, 10, 15, 15, 20, 20, 25],
};

const PERK_NAMES = Object.keys(PERK_TABLE);

// Castle capacity by TH level (index = TH level)
const CASTLE_CAPACITY: readonly number[] = [
  0,  // TH0 (unused)
  0,  // TH1
  0,  // TH2
  10, // TH3
  15, // TH4
  15, // TH5
  20, // TH6
  20, // TH7
  25, // TH8
  30, // TH9
  35, // TH10
  35, // TH11
  40, // TH12
  45, // TH13
  45, // TH14
  45, // TH15
  45, // TH16 (cap)
] as const;

export function createClan(name: string, badgeIndex?: number): ClanState {
  return {
    name,
    level: 1,
    xp: 0,
    badgeIndex: badgeIndex ?? 0,
    castleTroops: [],
  };
}

export function addClanXP(clan: ClanState, amount: number): ClanState {
  if (clan.level >= MAX_CLAN_LEVEL) return clan;

  let xp = clan.xp + amount;
  let level = clan.level;

  while (level < MAX_CLAN_LEVEL) {
    const threshold = XP_THRESHOLDS[level + 1];
    if (threshold === undefined || xp < threshold) break;
    xp -= threshold;
    level += 1;
  }

  // Cap XP at 0 if max level reached
  if (level >= MAX_CLAN_LEVEL) {
    xp = 0;
  }

  return { ...clan, xp, level };
}

export function getClanPerk(clan: ClanState, perkName: string): number {
  const table = PERK_TABLE[perkName];
  if (!table) return 0;
  return table[clan.level] ?? 0;
}

export function getCastleCapacity(townHallLevel: number): number {
  if (townHallLevel < 0) return 0;
  if (townHallLevel >= CASTLE_CAPACITY.length) {
    return CASTLE_CAPACITY[CASTLE_CAPACITY.length - 1] ?? 0;
  }
  return CASTLE_CAPACITY[townHallLevel] ?? 0;
}

export function getCastleHousingUsed(clan: ClanState): number {
  let total = 0;
  for (const troop of clan.castleTroops) {
    const data = getTroop(troop.name);
    if (!data) continue;
    total += troop.count * data.housingSpace;
  }
  return total;
}

export function addCastleTroop(
  clan: ClanState,
  troopName: string,
  level: number,
  count: number,
  thLevel: number,
): ClanState {
  const troopData = getTroop(troopName);
  if (!troopData) return clan;

  const capacity = getCastleCapacity(thLevel);
  const used = getCastleHousingUsed(clan);
  const needed = count * troopData.housingSpace;

  if (used + needed > capacity) return clan;

  const existingIndex = clan.castleTroops.findIndex((t) => t.name === troopName);
  if (existingIndex >= 0) {
    const castleTroops = clan.castleTroops.map((t, i) =>
      i === existingIndex ? { ...t, count: t.count + count, level } : t,
    );
    return { ...clan, castleTroops };
  }

  return {
    ...clan,
    castleTroops: [...clan.castleTroops, { name: troopName, level, count }],
  };
}

export function removeCastleTroop(clan: ClanState, troopName: string): ClanState {
  return {
    ...clan,
    castleTroops: clan.castleTroops.filter((t) => t.name !== troopName),
  };
}

export function getAvailableClanPerks(
  level: number,
): Array<{ perkName: string; value: number }> {
  return PERK_NAMES
    .map((perkName) => {
      const table = PERK_TABLE[perkName];
      const value = table?.[level] ?? 0;
      return { perkName, value };
    })
    .filter((p) => p.value > 0);
}

// Re-export XP_THRESHOLDS for UI progress calculation
export function getXPForNextLevel(level: number): number {
  if (level >= MAX_CLAN_LEVEL) return 0;
  return XP_THRESHOLDS[level + 1] ?? 0;
}
