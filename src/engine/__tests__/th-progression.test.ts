import type { VillageState, CampaignProgress, CampaignLevelProgress } from '../../types/village.ts';
import { resetInstanceCounter } from '../village-helpers.ts';
import { createStarterVillage, startUpgrade, completeUpgrade } from '../village-manager.ts';
import {
  getTownHallUpgradeCost,
  canStartTownHallUpgrade,
  startTownHallUpgrade,
} from '../upgrade-manager.ts';
import { getMaxCountForTH } from '../village-helpers.ts';
import { getAvailableTroops } from '../army-manager.ts';
import { tickBuildingUpgrades } from '../../hooks/useResources.ts';
import {
  getCampaignLevel,
  calculateBattleStars,
  isFirstClear,
  getMilestoneGems,
  applyCampaignBattleResult,
} from '../campaign-manager.ts';

beforeEach(() => {
  resetInstanceCounter();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TH_INSTANCE = 'bld_1';

function richVillage(overrides: Partial<VillageState['resources']> = {}): VillageState {
  const state = createStarterVillage();
  return {
    ...state,
    resources: { ...state.resources, gold: 50_000, elixir: 50_000, ...overrides },
  };
}

function makeProgress(levels: CampaignLevelProgress[] = []): CampaignProgress {
  return {
    levels,
    totalStars: levels.reduce((sum, l) => sum + l.stars, 0),
  };
}

/** Progress with `fullClears` three-star levels plus one level at `extraStars`. */
function progressWithStars(fullClears: number, extraStars: number): CampaignProgress {
  const levels: CampaignLevelProgress[] = [];
  for (let i = 1; i <= fullClears; i++) {
    levels.push({ levelNumber: i, stars: 3, completed: true });
  }
  if (extraStars > 0) {
    levels.push({ levelNumber: fullClears + 1, stars: extraStars, completed: true });
  }
  return makeProgress(levels);
}

// ===========================================================================
// TH upgrade lifecycle (cost, builder, resources, timer completion)
// ===========================================================================
describe('Town Hall upgrade lifecycle', () => {
  it('reads the TH2 upgrade cost and time from the data', () => {
    const cost = getTownHallUpgradeCost(1);
    expect(cost).toEqual({ cost: 1000, resource: 'Gold', time: 10 });
  });

  it('startUpgrade on the Town Hall deducts resources and assigns a builder', () => {
    const state = richVillage();
    const after = startUpgrade(state, TH_INSTANCE);

    expect(after).not.toBeNull();
    expect(after!.resources.gold).toBe(49_000);

    const th = after!.buildings.find((b) => b.instanceId === TH_INSTANCE);
    expect(th?.isUpgrading).toBe(true);
    expect(th?.upgradeTimeRemaining).toBe(10);
    expect(th?.assignedBuilder).not.toBeNull();
    expect(after!.builders.some((b) => b.assignedTo === TH_INSTANCE)).toBe(true);
  });

  it('startUpgrade fails when the player cannot afford the TH upgrade', () => {
    const state = createStarterVillage(); // 500 gold < 1000 cost
    expect(startUpgrade(state, TH_INSTANCE)).toBeNull();
  });

  it('startTownHallUpgrade fails when no builder is free', () => {
    const state = richVillage();
    const busyBuilders = state.builders.map((b) =>
      b.isUnlocked ? { ...b, assignedTo: 'bld_2', timeRemaining: 100 } : b,
    );
    const busy = { ...state, builders: busyBuilders };

    expect(canStartTownHallUpgrade(busy)).toBe(false);
    expect(startTownHallUpgrade(busy)).toBeNull();
  });

  it('completeUpgrade on the Town Hall raises the townHallLevel', () => {
    const state = richVillage();
    const afterStart = startUpgrade(state, TH_INSTANCE);
    expect(afterStart).not.toBeNull();

    const afterComplete = completeUpgrade(afterStart!, TH_INSTANCE);
    expect(afterComplete.townHallLevel).toBe(2);

    const th = afterComplete.buildings.find((b) => b.instanceId === TH_INSTANCE);
    expect(th?.level).toBe(2);
    expect(th?.isUpgrading).toBe(false);
    expect(afterComplete.builders.every((b) => b.assignedTo !== TH_INSTANCE)).toBe(true);
  });

  it('completeUpgrade on a non-TH building leaves townHallLevel unchanged', () => {
    const state = richVillage();
    const afterStart = startUpgrade(state, 'bld_8'); // Cannon
    expect(afterStart).not.toBeNull();

    const afterComplete = completeUpgrade(afterStart!, 'bld_8');
    expect(afterComplete.townHallLevel).toBe(1);
  });

  it('the upgrade tick pipeline completes a TH upgrade after its full duration', () => {
    const state = richVillage();
    const afterStart = startTownHallUpgrade(state);
    expect(afterStart).not.toBeNull();

    // Halfway: still upgrading, TH level unchanged
    const halfway = tickBuildingUpgrades(afterStart!, 5_000);
    expect(halfway.townHallLevel).toBe(1);
    const midTH = halfway.buildings.find((b) => b.instanceId === TH_INSTANCE);
    expect(midTH?.isUpgrading).toBe(true);
    expect(midTH?.upgradeTimeRemaining).toBe(5);

    // Full duration elapsed: upgrade completes through the tick pipeline
    const done = tickBuildingUpgrades(halfway, 5_000);
    expect(done.townHallLevel).toBe(2);
    const doneTH = done.buildings.find((b) => b.instanceId === TH_INSTANCE);
    expect(doneTH?.level).toBe(2);
    expect(doneTH?.isUpgrading).toBe(false);
  });
});

// ===========================================================================
// TH level gating (buildings and troops)
// ===========================================================================
describe('Town Hall gating', () => {
  it('locks Archer Tower at TH1 and unlocks it at TH2', () => {
    expect(getMaxCountForTH('Archer Tower', 1)).toBe(0);
    expect(getMaxCountForTH('Archer Tower', 2)).toBeGreaterThanOrEqual(1);
  });

  it('gates troop availability behind TH and barracks levels', () => {
    const state = createStarterVillage();
    const names = getAvailableTroops(state).map((t) => t.name);

    expect(names).toContain('Barbarian');
    expect(names).not.toContain('Archer'); // requires Barracks level 2

    // Raising the barracks level unlocks the Archer
    const upgraded: VillageState = {
      ...state,
      buildings: state.buildings.map((b) =>
        b.buildingId === 'Barracks' ? { ...b, level: 2 } : b,
      ),
    };
    expect(getAvailableTroops(upgraded).map((t) => t.name)).toContain('Archer');
  });

  it('unlocks more of an existing building after a TH upgrade completes', () => {
    const state = richVillage();
    const before = getMaxCountForTH('Cannon', state.townHallLevel);

    const upgraded = completeUpgrade(startUpgrade(state, TH_INSTANCE)!, TH_INSTANCE);
    const after = getMaxCountForTH('Cannon', upgraded.townHallLevel);

    expect(after).toBeGreaterThanOrEqual(before);
  });
});

// ===========================================================================
// Canonical star calculation (50% / Town Hall / 100%)
// ===========================================================================
describe('calculateBattleStars', () => {
  it('awards 0 stars below 50% with the TH standing', () => {
    expect(calculateBattleStars(0, false)).toBe(0);
    expect(calculateBattleStars(49, false)).toBe(0);
  });

  it('awards 1 star for 50%+ destruction without the TH', () => {
    expect(calculateBattleStars(50, false)).toBe(1);
    expect(calculateBattleStars(99, false)).toBe(1);
  });

  it('awards 1 star for TH destruction below 50%', () => {
    expect(calculateBattleStars(30, true)).toBe(1);
  });

  it('awards 2 stars for 50%+ destruction plus the TH', () => {
    expect(calculateBattleStars(50, true)).toBe(2);
    expect(calculateBattleStars(99, true)).toBe(2);
  });

  it('awards 3 stars at 100% destruction', () => {
    expect(calculateBattleStars(100, true)).toBe(3);
    // The TH is always destroyed at 100%, so the flag cannot lower the result
    expect(calculateBattleStars(100, false)).toBe(3);
  });
});

// ===========================================================================
// Campaign rules: first clear vs replay, milestones, no trophies
// ===========================================================================
describe('campaign battle rewards', () => {
  it('awards full level loot on the first clear', () => {
    const level = getCampaignLevel(1)!;
    const rewards = applyCampaignBattleResult(makeProgress(), 1, 2);

    expect(rewards.firstClear).toBe(true);
    expect(rewards.loot).toEqual({
      gold: level.goldLoot,
      elixir: level.elixirLoot,
      darkElixir: level.darkElixirLoot,
    });
  });

  it('awards no loot on a replay, even when stars improve', () => {
    const cleared = makeProgress([{ levelNumber: 1, stars: 1, completed: true }]);
    expect(isFirstClear(cleared, 1)).toBe(false);

    const rewards = applyCampaignBattleResult(cleared, 1, 3);
    expect(rewards.firstClear).toBe(false);
    expect(rewards.loot).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
    expect(rewards.progress.levels.find((l) => l.levelNumber === 1)?.stars).toBe(3);
  });

  it('awards no loot on a failed attack (0 stars)', () => {
    const rewards = applyCampaignBattleResult(makeProgress(), 1, 0);
    expect(rewards.loot).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
    expect(rewards.gemsAwarded).toBe(0);
  });

  it('a failed attempt keeps the level a first clear for the next try', () => {
    const afterFail = applyCampaignBattleResult(makeProgress(), 1, 0);
    expect(isFirstClear(afterFail.progress, 1)).toBe(true);
  });

  it('never changes trophies', () => {
    const win = applyCampaignBattleResult(makeProgress(), 1, 3);
    const loss = applyCampaignBattleResult(makeProgress(), 1, 0);
    expect(win.trophyChange).toBe(0);
    expect(loss.trophyChange).toBe(0);
  });

  it('awards milestone gems when total stars cross a tier', () => {
    // 49 x 3 stars + 2 stars = 149 total; improving level 50 to 3 crosses 150
    const progress = progressWithStars(49, 2);
    expect(progress.totalStars).toBe(149);

    const rewards = applyCampaignBattleResult(progress, 50, 3);
    expect(rewards.progress.totalStars).toBe(150);
    expect(rewards.gemsAwarded).toBe(35);
  });

  it('awards the 225-star tier gems when crossed', () => {
    // 74 x 3 stars + 2 stars = 224 total; improving level 75 to 3 crosses 225
    const progress = progressWithStars(74, 2);
    expect(progress.totalStars).toBe(224);

    const rewards = applyCampaignBattleResult(progress, 75, 3);
    expect(rewards.gemsAwarded).toBe(170);
  });

  it('does not re-award a tier that was already crossed', () => {
    // 50 x 3 stars = 150 total, already past the first tier
    const progress = progressWithStars(50, 0);

    const rewards = applyCampaignBattleResult(progress, 51, 3);
    expect(rewards.progress.totalStars).toBe(153);
    expect(rewards.gemsAwarded).toBe(0);
  });

  it('awards no gems when stars do not improve', () => {
    const progress = progressWithStars(49, 3); // 150 total, level 50 already 3-starred
    const rewards = applyCampaignBattleResult(progress, 50, 3);
    expect(rewards.progress.totalStars).toBe(150);
    expect(rewards.gemsAwarded).toBe(0);
  });

  it('getMilestoneGems sums every tier crossed in one jump', () => {
    expect(getMilestoneGems(149, 150)).toBe(35);
    expect(getMilestoneGems(140, 270)).toBe(35 + 170 + 350);
    expect(getMilestoneGems(150, 150)).toBe(0);
    expect(getMilestoneGems(150, 224)).toBe(0);
  });
});
