import {
  GEM_PACKAGES,
  calculateSpeedUpCost,
  calculateResourcePurchase,
  buyResources,
} from '../gem-shop.ts';
import type { GemPackage } from '../gem-shop.ts';
import type { ResourceAmounts } from '../../types/village.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeResources(
  gold: number,
  elixir: number,
  darkElixir: number,
  gems = 0,
): ResourceAmounts {
  return { gold, elixir, darkElixir, gems };
}

// ---------------------------------------------------------------------------
// GEM_PACKAGES
// ---------------------------------------------------------------------------

describe('GEM_PACKAGES', () => {
  it('contains exactly 5 packages', () => {
    expect(GEM_PACKAGES).toHaveLength(5);
  });

  it('has correct gem counts in ascending order', () => {
    const gemCounts = GEM_PACKAGES.map((p: GemPackage) => p.gems);
    expect(gemCounts).toEqual([80, 500, 1_200, 2_500, 6_500]);
  });

  it('has a label string for every package', () => {
    for (const pkg of GEM_PACKAGES) {
      expect(typeof pkg.label).toBe('string');
      expect(pkg.label.length).toBeGreaterThan(0);
    }
  });

  it('has unique labels across all packages', () => {
    const labels = GEM_PACKAGES.map((p: GemPackage) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

// ---------------------------------------------------------------------------
// calculateSpeedUpCost - zero and negative inputs
// ---------------------------------------------------------------------------

describe('calculateSpeedUpCost', () => {
  describe('zero and negative inputs', () => {
    it('returns 0 for 0 seconds', () => {
      expect(calculateSpeedUpCost(0)).toBe(0);
    });

    it('returns 0 for negative seconds', () => {
      expect(calculateSpeedUpCost(-1)).toBe(0);
    });

    it('returns 0 for a large negative value', () => {
      expect(calculateSpeedUpCost(-100_000)).toBe(0);
    });
  });

  // ---
  // Exact breakpoint values
  // ---

  describe('exact breakpoint values', () => {
    it('returns 1 gem at exactly 60 seconds (1 minute)', () => {
      expect(calculateSpeedUpCost(60)).toBe(1);
    });

    it('returns 20 gems at exactly 3,600 seconds (1 hour)', () => {
      expect(calculateSpeedUpCost(3_600)).toBe(20);
    });

    it('returns 260 gems at exactly 86,400 seconds (1 day)', () => {
      expect(calculateSpeedUpCost(86_400)).toBe(260);
    });

    it('returns 1,000 gems at exactly 604,800 seconds (7 days)', () => {
      expect(calculateSpeedUpCost(604_800)).toBe(1_000);
    });
  });

  // ---
  // Interpolation between first two breakpoints (0s-60s, 0-1 gem)
  // ---

  describe('interpolation in the 0s to 60s range', () => {
    it('returns 1 gem for 1 second (rounds up from a tiny fraction)', () => {
      // fraction = 1/60 = 0.0167, gems = 0 + 0.0167 * 1 = 0.0167, ceil = 1
      expect(calculateSpeedUpCost(1)).toBe(1);
    });

    it('returns 1 gem at the midpoint of 30 seconds', () => {
      // fraction = 30/60 = 0.5, gems = 0 + 0.5 * 1 = 0.5, ceil = 1
      expect(calculateSpeedUpCost(30)).toBe(1);
    });

    it('returns 1 gem at 59 seconds', () => {
      // fraction = 59/60 = 0.983, gems = 0.983, ceil = 1
      expect(calculateSpeedUpCost(59)).toBe(1);
    });
  });

  // ---
  // Interpolation between 60s-3600s breakpoints (1-20 gems)
  // ---

  describe('interpolation in the 60s to 3,600s range', () => {
    it('calculates cost at 1,830 seconds (midpoint)', () => {
      // fraction = (1830 - 60) / (3600 - 60) = 1770 / 3540 = 0.5
      // gems = 1 + 0.5 * 19 = 1 + 9.5 = 10.5, ceil = 11
      expect(calculateSpeedUpCost(1_830)).toBe(11);
    });

    it('calculates cost at 120 seconds', () => {
      // fraction = (120 - 60) / (3600 - 60) = 60 / 3540 = 0.01695
      // gems = 1 + 0.01695 * 19 = 1 + 0.322 = 1.322, ceil = 2
      expect(calculateSpeedUpCost(120)).toBe(2);
    });

    it('calculates cost at 1,800 seconds (30 minutes)', () => {
      // fraction = (1800 - 60) / (3600 - 60) = 1740 / 3540 = 0.49153
      // gems = 1 + 0.49153 * 19 = 1 + 9.339 = 10.339, ceil = 11
      expect(calculateSpeedUpCost(1_800)).toBe(11);
    });
  });

  // ---
  // Interpolation between 3,600s-86,400s breakpoints (20-260 gems)
  // ---

  describe('interpolation in the 3,600s to 86,400s range', () => {
    it('calculates cost at 45,000 seconds (midpoint area)', () => {
      // fraction = (45000 - 3600) / (86400 - 3600) = 41400 / 82800 = 0.5
      // gems = 20 + 0.5 * 240 = 20 + 120 = 140, ceil = 140
      expect(calculateSpeedUpCost(45_000)).toBe(140);
    });

    it('calculates cost at 43,200 seconds (12 hours)', () => {
      // fraction = (43200 - 3600) / (86400 - 3600) = 39600 / 82800 = 0.47826
      // gems = 20 + 0.47826 * 240 = 20 + 114.783 = 134.783, ceil = 135
      expect(calculateSpeedUpCost(43_200)).toBe(135);
    });
  });

  // ---
  // Interpolation between 86,400s-604,800s breakpoints (260-1000 gems)
  // ---

  describe('interpolation in the 86,400s to 604,800s range', () => {
    it('calculates cost at 345,600 seconds (midpoint, 4 days)', () => {
      // fraction = (345600 - 86400) / (604800 - 86400) = 259200 / 518400 = 0.5
      // gems = 260 + 0.5 * 740 = 260 + 370 = 630, ceil = 630
      expect(calculateSpeedUpCost(345_600)).toBe(630);
    });

    it('calculates cost at 172,800 seconds (2 days)', () => {
      // fraction = (172800 - 86400) / (604800 - 86400) = 86400 / 518400 = 0.16667
      // gems = 260 + 0.16667 * 740 = 260 + 123.333 = 383.333, ceil = 384
      expect(calculateSpeedUpCost(172_800)).toBe(384);
    });
  });

  // ---
  // Extrapolation beyond the last breakpoint
  // ---

  describe('extrapolation beyond 604,800 seconds', () => {
    it('extrapolates cost for 1,209,600 seconds (14 days)', () => {
      // The last segment rate: (1000 - 260) / (604800 - 86400) = 740 / 518400
      // extraGems = (1209600 - 604800) * (740 / 518400) = 604800 * 0.001428 = 863.999..
      // total = 1000 + 864 = 1864, ceil = 1864
      const rate = 740 / 518_400;
      const extra = (1_209_600 - 604_800) * rate;
      const expected = Math.ceil(1_000 + extra);
      expect(calculateSpeedUpCost(1_209_600)).toBe(expected);
    });

    it('extrapolates cost just 1 second beyond the last breakpoint', () => {
      // extraGems = 1 * (740 / 518400) = 0.001428
      // total = 1000 + 0.001428 = 1000.001428, ceil = 1001
      expect(calculateSpeedUpCost(604_801)).toBe(1_001);
    });

    it('extrapolates cost for a very large value (30 days)', () => {
      const thirtyDays = 30 * 86_400; // 2,592,000
      const rate = 740 / 518_400;
      const extra = (thirtyDays - 604_800) * rate;
      const expected = Math.ceil(1_000 + extra);
      expect(calculateSpeedUpCost(thirtyDays)).toBe(expected);
    });
  });

  // ---
  // General properties
  // ---

  describe('general properties', () => {
    it('always returns an integer', () => {
      const testValues = [0, 1, 30, 60, 120, 1_800, 3_600, 43_200, 86_400, 604_800, 1_000_000];
      for (const v of testValues) {
        const result = calculateSpeedUpCost(v);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('is monotonically non-decreasing for increasing seconds', () => {
      let prev = 0;
      const steps = [0, 1, 30, 60, 120, 1_830, 3_600, 43_200, 86_400, 345_600, 604_800, 1_000_000];
      for (const s of steps) {
        const cost = calculateSpeedUpCost(s);
        expect(cost).toBeGreaterThanOrEqual(prev);
        prev = cost;
      }
    });
  });
});

// ---------------------------------------------------------------------------
// calculateResourcePurchase
// ---------------------------------------------------------------------------

describe('calculateResourcePurchase', () => {
  it('returns gold and elixir each equal to gems * 1,000', () => {
    const result = calculateResourcePurchase(5);
    expect(result.gold).toBe(5_000);
    expect(result.elixir).toBe(5_000);
  });

  it('returns zeros for 0 gems', () => {
    const result = calculateResourcePurchase(0);
    expect(result.gold).toBe(0);
    expect(result.elixir).toBe(0);
  });

  it('returns zeros for negative gem count', () => {
    const result = calculateResourcePurchase(-10);
    expect(result.gold).toBe(0);
    expect(result.elixir).toBe(0);
  });

  it('handles 1 gem correctly', () => {
    const result = calculateResourcePurchase(1);
    expect(result.gold).toBe(1_000);
    expect(result.elixir).toBe(1_000);
  });

  it('handles a large gem count', () => {
    const result = calculateResourcePurchase(6_500);
    expect(result.gold).toBe(6_500_000);
    expect(result.elixir).toBe(6_500_000);
  });

  it('always returns equal gold and elixir amounts', () => {
    const testCounts = [1, 10, 100, 500, 1_200, 2_500];
    for (const count of testCounts) {
      const result = calculateResourcePurchase(count);
      expect(result.gold).toBe(result.elixir);
    }
  });
});

// ---------------------------------------------------------------------------
// buyResources - successful purchases
// ---------------------------------------------------------------------------

describe('buyResources', () => {
  describe('successful purchases', () => {
    it('deducts gems and adds gold', () => {
      const resources = makeResources(1_000, 500, 200, 100);
      const result = buyResources(resources, 'gold', 5_000, 5);
      expect(result).not.toBeNull();
      expect(result!.gems).toBe(95);
      expect(result!.gold).toBe(6_000);
    });

    it('deducts gems and adds elixir', () => {
      const resources = makeResources(1_000, 500, 200, 100);
      const result = buyResources(resources, 'elixir', 3_000, 3);
      expect(result).not.toBeNull();
      expect(result!.gems).toBe(97);
      expect(result!.elixir).toBe(3_500);
    });

    it('deducts gems and adds dark elixir', () => {
      const resources = makeResources(1_000, 500, 200, 50);
      const result = buyResources(resources, 'darkElixir', 100, 10);
      expect(result).not.toBeNull();
      expect(result!.gems).toBe(40);
      expect(result!.darkElixir).toBe(300);
    });

    it('allows spending all gems exactly', () => {
      const resources = makeResources(0, 0, 0, 25);
      const result = buyResources(resources, 'gold', 25_000, 25);
      expect(result).not.toBeNull();
      expect(result!.gems).toBe(0);
      expect(result!.gold).toBe(25_000);
    });

    it('preserves other resource amounts unchanged', () => {
      const resources = makeResources(1_000, 2_000, 3_000, 50);
      const result = buyResources(resources, 'gold', 500, 5);
      expect(result).not.toBeNull();
      expect(result!.elixir).toBe(2_000);
      expect(result!.darkElixir).toBe(3_000);
    });
  });

  // ---
  // Insufficient gems
  // ---

  describe('insufficient gems', () => {
    it('returns null when gems are less than cost', () => {
      const resources = makeResources(1_000, 500, 200, 4);
      const result = buyResources(resources, 'gold', 5_000, 5);
      expect(result).toBeNull();
    });

    it('returns null when player has 0 gems', () => {
      const resources = makeResources(1_000, 500, 200, 0);
      const result = buyResources(resources, 'elixir', 1_000, 1);
      expect(result).toBeNull();
    });
  });

  // ---
  // Invalid parameters
  // ---

  describe('invalid parameters', () => {
    it('returns null for zero gem cost', () => {
      const resources = makeResources(0, 0, 0, 100);
      const result = buyResources(resources, 'gold', 1_000, 0);
      expect(result).toBeNull();
    });

    it('returns null for negative gem cost', () => {
      const resources = makeResources(0, 0, 0, 100);
      const result = buyResources(resources, 'gold', 1_000, -5);
      expect(result).toBeNull();
    });

    it('returns null for zero amount', () => {
      const resources = makeResources(0, 0, 0, 100);
      const result = buyResources(resources, 'gold', 0, 5);
      expect(result).toBeNull();
    });

    it('returns null for negative amount', () => {
      const resources = makeResources(0, 0, 0, 100);
      const result = buyResources(resources, 'elixir', -500, 5);
      expect(result).toBeNull();
    });
  });

  // ---
  // Immutability
  // ---

  describe('immutability', () => {
    it('does not mutate the original resources object on success', () => {
      const resources = makeResources(1_000, 500, 200, 50);
      const original = { ...resources };
      buyResources(resources, 'gold', 5_000, 5);
      expect(resources).toEqual(original);
    });

    it('does not mutate the original resources object on failure', () => {
      const resources = makeResources(1_000, 500, 200, 2);
      const original = { ...resources };
      buyResources(resources, 'gold', 5_000, 5);
      expect(resources).toEqual(original);
    });

    it('returns a new object reference on success', () => {
      const resources = makeResources(0, 0, 0, 100);
      const result = buyResources(resources, 'gold', 1_000, 1);
      expect(result).not.toBeNull();
      expect(result).not.toBe(resources);
    });
  });
});
