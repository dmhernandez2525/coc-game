import type { PlacedBuilding } from '../../types/village.ts';
import {
  createEmptyOres,
  calculateOreReward,
  addOres,
  canAffordOres,
  spendOres,
  getBlacksmithLevel,
  isBlacksmithBuilt,
} from '../ore-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuilding(overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: 'bld_1',
    buildingId: 'Blacksmith',
    buildingType: 'army',
    level: 1,
    gridX: 10,
    gridY: 10,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createEmptyOres
// ---------------------------------------------------------------------------
describe('createEmptyOres', () => {
  it('returns a zeroed wallet', () => {
    expect(createEmptyOres()).toEqual({ shinyOre: 0, glowyOre: 0, starryOre: 0 });
  });

  it('returns a fresh object each call', () => {
    expect(createEmptyOres()).not.toBe(createEmptyOres());
  });
});

// ---------------------------------------------------------------------------
// calculateOreReward
// ---------------------------------------------------------------------------
describe('calculateOreReward', () => {
  it('is deterministic for the same inputs', () => {
    expect(calculateOreReward(2, 74)).toEqual(calculateOreReward(2, 74));
  });

  it('pays only destruction-scaled shiny ore on a loss', () => {
    expect(calculateOreReward(0, 40)).toEqual({ shinyOre: 80, glowyOre: 0, starryOre: 0 });
  });

  it('pays glowy ore per star on a win', () => {
    const reward = calculateOreReward(2, 60);
    expect(reward.shinyOre).toBe(60 * 2 + 2 * 100);
    expect(reward.glowyOre).toBe(12);
    expect(reward.starryOre).toBe(0);
  });

  it('pays the starry bonus only on a three-star raid', () => {
    expect(calculateOreReward(2, 99).starryOre).toBe(0);
    expect(calculateOreReward(3, 100).starryOre).toBe(5);
  });

  it('clamps out-of-range inputs', () => {
    expect(calculateOreReward(-1, -10)).toEqual({ shinyOre: 0, glowyOre: 0, starryOre: 0 });
    expect(calculateOreReward(5, 250)).toEqual({ shinyOre: 500, glowyOre: 18, starryOre: 5 });
  });

  it('rounds fractional destruction percentages', () => {
    expect(calculateOreReward(0, 49.6).shinyOre).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// addOres / canAffordOres / spendOres
// ---------------------------------------------------------------------------
describe('addOres', () => {
  it('sums each ore type', () => {
    const total = addOres(
      { shinyOre: 100, glowyOre: 10, starryOre: 1 },
      { shinyOre: 50, glowyOre: 5, starryOre: 2 },
    );
    expect(total).toEqual({ shinyOre: 150, glowyOre: 15, starryOre: 3 });
  });

  it('does not mutate the inputs', () => {
    const current = { shinyOre: 100, glowyOre: 10, starryOre: 1 };
    addOres(current, { shinyOre: 50, glowyOre: 5, starryOre: 2 });
    expect(current).toEqual({ shinyOre: 100, glowyOre: 10, starryOre: 1 });
  });
});

describe('canAffordOres', () => {
  it('returns true when every ore type is covered', () => {
    expect(canAffordOres(
      { shinyOre: 100, glowyOre: 10, starryOre: 1 },
      { shinyOre: 100, glowyOre: 10, starryOre: 1 },
    )).toBe(true);
  });

  it('returns false when any single ore type falls short', () => {
    expect(canAffordOres(
      { shinyOre: 100, glowyOre: 10, starryOre: 0 },
      { shinyOre: 50, glowyOre: 5, starryOre: 1 },
    )).toBe(false);
  });
});

describe('spendOres', () => {
  it('deducts the cost from the wallet', () => {
    const result = spendOres(
      { shinyOre: 100, glowyOre: 10, starryOre: 1 },
      { shinyOre: 60, glowyOre: 10, starryOre: 0 },
    );
    expect(result).toEqual({ shinyOre: 40, glowyOre: 0, starryOre: 1 });
  });

  it('returns null when the cost is unaffordable', () => {
    expect(spendOres(
      { shinyOre: 10, glowyOre: 0, starryOre: 0 },
      { shinyOre: 60, glowyOre: 0, starryOre: 0 },
    )).toBeNull();
  });

  it('does not mutate the wallet', () => {
    const wallet = { shinyOre: 100, glowyOre: 10, starryOre: 1 };
    spendOres(wallet, { shinyOre: 60, glowyOre: 10, starryOre: 0 });
    expect(wallet).toEqual({ shinyOre: 100, glowyOre: 10, starryOre: 1 });
  });
});

// ---------------------------------------------------------------------------
// getBlacksmithLevel / isBlacksmithBuilt
// ---------------------------------------------------------------------------
describe('getBlacksmithLevel', () => {
  it('returns 0 when no Blacksmith is placed', () => {
    expect(getBlacksmithLevel([])).toBe(0);
    expect(getBlacksmithLevel([makeBuilding({ buildingId: 'Cannon' })])).toBe(0);
  });

  it('returns the placed Blacksmith level', () => {
    expect(getBlacksmithLevel([makeBuilding({ level: 4 })])).toBe(4);
  });
});

describe('isBlacksmithBuilt', () => {
  it('reflects the Blacksmith presence', () => {
    expect(isBlacksmithBuilt([])).toBe(false);
    expect(isBlacksmithBuilt([makeBuilding()])).toBe(true);
  });
});
