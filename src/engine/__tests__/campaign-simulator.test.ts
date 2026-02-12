import { describe, it, expect } from 'vitest';
import { simulateCampaignBattle } from '../campaign-simulator.ts';
import type { CampaignBattleResult } from '../campaign-simulator.ts';
import type { TrainedTroop } from '../../types/village.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a small army of Barbarians for quick tests. */
function makeBarbArmy(count: number, level = 1): TrainedTroop[] {
  return [{ name: 'Barbarian', level, count }];
}

/** Build a mixed army with several troop types. */
function makeMixedArmy(scale: number): TrainedTroop[] {
  return [
    { name: 'Barbarian', level: 1, count: 10 * scale },
    { name: 'Archer', level: 1, count: 10 * scale },
    { name: 'Giant', level: 1, count: 3 * scale },
    { name: 'Wizard', level: 1, count: 2 * scale },
  ];
}

// ---------------------------------------------------------------------------
// simulateCampaignBattle
// ---------------------------------------------------------------------------

describe('simulateCampaignBattle', () => {
  // 1. Invalid level numbers
  describe('invalid level numbers', () => {
    it('returns null for level 0', () => {
      const result = simulateCampaignBattle(makeBarbArmy(20), 0);
      expect(result).toBeNull();
    });

    it('returns null for level 999 (beyond 90 campaign levels)', () => {
      const result = simulateCampaignBattle(makeBarbArmy(20), 999);
      expect(result).toBeNull();
    });

    it('returns null for a negative level number', () => {
      const result = simulateCampaignBattle(makeBarbArmy(20), -1);
      expect(result).toBeNull();
    });
  });

  // 2. Empty army (empty array)
  it('returns 0 stars and 0% destruction when army is an empty array', () => {
    const result = simulateCampaignBattle([], 1);
    expect(result).not.toBeNull();
    expect(result!.stars).toBe(0);
    expect(result!.destructionPercent).toBe(0);
    expect(result!.townHallDestroyed).toBe(false);
  });

  // 3. Troops with count 0
  it('returns 0 stars when army has troops with count 0', () => {
    const army: TrainedTroop[] = [
      { name: 'Barbarian', level: 1, count: 0 },
      { name: 'Archer', level: 1, count: 0 },
    ];
    const result = simulateCampaignBattle(army, 1);
    expect(result).not.toBeNull();
    expect(result!.stars).toBe(0);
    expect(result!.destructionPercent).toBe(0);
  });

  // 4. Reasonable army against level 1 gets stars > 0
  it('returns a valid result with stars > 0 for a reasonable army against level 1', () => {
    const army = makeMixedArmy(1);
    const result = simulateCampaignBattle(army, 1);
    expect(result).not.toBeNull();
    expect(result!.stars).toBeGreaterThan(0);
    expect(result!.destructionPercent).toBeGreaterThan(0);
  });

  // 5. Stronger army yields higher destruction and stars
  it('returns higher destruction for a stronger army (more troops)', () => {
    const weakArmy = makeBarbArmy(5);
    const strongArmy = makeBarbArmy(50);
    const weakResult = simulateCampaignBattle(weakArmy, 1)!;
    const strongResult = simulateCampaignBattle(strongArmy, 1)!;

    expect(weakResult).not.toBeNull();
    expect(strongResult).not.toBeNull();
    expect(strongResult.destructionPercent).toBeGreaterThanOrEqual(
      weakResult.destructionPercent,
    );
    expect(strongResult.stars).toBeGreaterThanOrEqual(weakResult.stars);
  });

  // 6. Weaker army yields lower destruction and stars
  it('returns lower destruction for a weaker army', () => {
    const smallArmy = makeBarbArmy(3);
    const largeArmy = makeMixedArmy(3);
    const smallResult = simulateCampaignBattle(smallArmy, 1)!;
    const largeResult = simulateCampaignBattle(largeArmy, 1)!;

    expect(smallResult).not.toBeNull();
    expect(largeResult).not.toBeNull();
    expect(smallResult.destructionPercent).toBeLessThanOrEqual(
      largeResult.destructionPercent,
    );
    expect(smallResult.stars).toBeLessThanOrEqual(largeResult.stars);
  });

  // 7. Town Hall destruction when destruction >= 70%
  it('sets townHallDestroyed to true when destruction is at least 70%', () => {
    // Use a very large army to guarantee high destruction
    const army = makeMixedArmy(10);
    const result = simulateCampaignBattle(army, 1)!;
    expect(result).not.toBeNull();
    expect(result.destructionPercent).toBeGreaterThanOrEqual(70);
    expect(result.townHallDestroyed).toBe(true);
  });

  // 8. Loot is non-null when stars > 0
  it('returns non-null loot when stars > 0', () => {
    const army = makeMixedArmy(2);
    const result = simulateCampaignBattle(army, 1)!;
    expect(result).not.toBeNull();
    expect(result.stars).toBeGreaterThan(0);
    expect(result.loot).not.toBeNull();
    expect(result.loot!.gold).toBeGreaterThanOrEqual(0);
    expect(result.loot!.elixir).toBeGreaterThanOrEqual(0);
    expect(result.loot!.darkElixir).toBeGreaterThanOrEqual(0);
  });

  // 9. Loot is null when stars is 0
  it('returns null loot when stars is 0', () => {
    // Empty army gives 0 stars, loot should be null
    const result = simulateCampaignBattle([], 1)!;
    expect(result).not.toBeNull();
    expect(result.stars).toBe(0);
    expect(result.loot).toBeNull();
  });

  // 10. Deterministic results (same input = same output)
  it('produces deterministic results for identical inputs', () => {
    const army = makeMixedArmy(2);
    const result1 = simulateCampaignBattle(army, 1);
    const result2 = simulateCampaignBattle(army, 1);
    expect(result1).toEqual(result2);
  });

  // 11. Large army against level 1 gives 3 stars
  it('gives 3 stars when a large army attacks level 1', () => {
    // Massively overpowered army to guarantee 100% destruction
    const army: TrainedTroop[] = [
      { name: 'Barbarian', level: 1, count: 200 },
      { name: 'Archer', level: 1, count: 200 },
      { name: 'Giant', level: 1, count: 50 },
      { name: 'Wizard', level: 1, count: 50 },
    ];
    const result = simulateCampaignBattle(army, 1)!;
    expect(result).not.toBeNull();
    expect(result.stars).toBe(3);
    expect(result.destructionPercent).toBe(100);
  });

  // 12. Stars never exceed 3
  it('never returns more than 3 stars even with an absurdly large army', () => {
    const army = makeBarbArmy(10000);
    const result = simulateCampaignBattle(army, 1)!;
    expect(result).not.toBeNull();
    expect(result.stars).toBeLessThanOrEqual(3);
  });

  // 13. Destruction percent never exceeds 100
  it('caps destruction percent at 100 even with an overwhelming army', () => {
    const army = makeBarbArmy(10000);
    const result = simulateCampaignBattle(army, 1)!;
    expect(result).not.toBeNull();
    expect(result.destructionPercent).toBeLessThanOrEqual(100);
  });

  // Additional structural checks
  it('returns all expected fields in the result object', () => {
    const army = makeMixedArmy(1);
    const result = simulateCampaignBattle(army, 1)!;
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('stars');
    expect(result).toHaveProperty('destructionPercent');
    expect(result).toHaveProperty('townHallDestroyed');
    expect(result).toHaveProperty('loot');
    expect(typeof result.stars).toBe('number');
    expect(typeof result.destructionPercent).toBe('number');
    expect(typeof result.townHallDestroyed).toBe('boolean');
  });

  it('returns integer values for stars and destructionPercent', () => {
    const army = makeMixedArmy(1);
    const result = simulateCampaignBattle(army, 1)!;
    expect(result).not.toBeNull();
    expect(Number.isInteger(result.stars)).toBe(true);
    expect(Number.isInteger(result.destructionPercent)).toBe(true);
  });
});
