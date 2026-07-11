import { describe, it, expect } from 'vitest';
import type { NPCBase } from '../npc-bases.ts';
import {
  generateMultiplayerBases,
  getCampaignBase,
  getAllCampaignBases,
  CAMPAIGN_LEVEL_COUNT,
} from '../npc-base-generator.ts';

// ---------------------------------------------------------------------------
// Shared layout validity checks
// ---------------------------------------------------------------------------

function layoutSignature(base: NPCBase): string {
  return base.buildings
    .map((b) => `${b.buildingId}@${b.gridX},${b.gridY}`)
    .sort()
    .join('|');
}

function expectSensibleLayout(base: NPCBase): void {
  // Every building sits on the battle grid with a margin
  for (const b of base.buildings) {
    expect(b.gridX).toBeGreaterThanOrEqual(4);
    expect(b.gridX).toBeLessThanOrEqual(36);
    expect(b.gridY).toBeGreaterThanOrEqual(3);
    expect(b.gridY).toBeLessThanOrEqual(27);
    expect(Number.isInteger(b.gridX)).toBe(true);
    expect(Number.isInteger(b.gridY)).toBe(true);
    expect(b.level).toBeGreaterThanOrEqual(1);
  }

  // No two buildings share a cell
  const cells = base.buildings.map((b) => `${b.gridX},${b.gridY}`);
  expect(new Set(cells).size).toBe(cells.length);

  // Instance ids are unique
  const ids = base.buildings.map((b) => b.instanceId);
  expect(new Set(ids).size).toBe(ids.length);

  // Exactly one Town Hall, centered in the layout
  const townHalls = base.buildings.filter((b) => b.buildingId === 'Town Hall');
  expect(townHalls).toHaveLength(1);
  expect(townHalls[0]!.gridX).toBe(20);
  expect(townHalls[0]!.gridY).toBe(15);
  expect(townHalls[0]!.level).toBe(base.townHallLevel);

  // At least one defense protects the base
  const defenses = base.buildings.filter((b) => b.buildingType === 'defense');
  expect(defenses.length).toBeGreaterThan(0);

  // Loot and trophies are worth raiding
  expect(base.trophyOffer).toBeGreaterThan(0);
  expect(base.loot.gold).toBeGreaterThan(0);
  expect(base.loot.elixir).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// generateMultiplayerBases
// ---------------------------------------------------------------------------

describe('generateMultiplayerBases', () => {
  const bases = generateMultiplayerBases();

  it('generates 3 extra bases for each TH from 1 to 10', () => {
    for (let th = 1; th <= 10; th++) {
      const forTH = bases.filter((b) => b.townHallLevel === th);
      expect(forTH).toHaveLength(3);
    }
  });

  it('is deterministic across calls', () => {
    const again = generateMultiplayerBases();
    expect(again).toEqual(bases);
  });

  it('gives every base a unique id', () => {
    const ids = bases.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces sensible layouts for every base', () => {
    for (const base of bases) expectSensibleLayout(base);
  });

  it('gives the three variants of a TH distinct layouts', () => {
    for (let th = 1; th <= 10; th++) {
      const signatures = bases
        .filter((b) => b.townHallLevel === th)
        .map(layoutSignature);
      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });

  it('adds walls from TH2 up but leaves TH1 camps open', () => {
    const th1Walls = bases
      .filter((b) => b.townHallLevel === 1)
      .flatMap((b) => b.buildings)
      .filter((b) => b.buildingId === 'Wall');
    expect(th1Walls).toHaveLength(0);

    for (const base of bases.filter((b) => b.townHallLevel >= 2)) {
      const walls = base.buildings.filter((b) => b.buildingId === 'Wall');
      expect(walls.length).toBeGreaterThan(0);
    }
  });

  it('includes dark elixir buildings only from TH7 up', () => {
    for (const base of bases) {
      const darkBuildings = base.buildings.filter(
        (b) => b.buildingId === 'Dark Elixir Drill' || b.buildingId === 'Dark Elixir Storage',
      );
      if (base.townHallLevel >= 7) {
        expect(darkBuildings.length).toBeGreaterThan(0);
        expect(base.loot.darkElixir).toBeGreaterThan(0);
      } else {
        expect(darkBuildings).toHaveLength(0);
        expect(base.loot.darkElixir).toBe(0);
      }
    }
  });

  it('scales loot up with TH level', () => {
    const avgGold = (th: number) => {
      const forTH = bases.filter((b) => b.townHallLevel === th);
      return forTH.reduce((sum, b) => sum + b.loot.gold, 0) / forTH.length;
    };
    expect(avgGold(10)).toBeGreaterThan(avgGold(5));
    expect(avgGold(5)).toBeGreaterThan(avgGold(1));
  });
});

// ---------------------------------------------------------------------------
// getCampaignBase
// ---------------------------------------------------------------------------

describe('getCampaignBase', () => {
  it('returns null for out-of-range levels', () => {
    expect(getCampaignBase(0)).toBeNull();
    expect(getCampaignBase(-3)).toBeNull();
    expect(getCampaignBase(CAMPAIGN_LEVEL_COUNT + 1)).toBeNull();
    expect(getCampaignBase(2.5)).toBeNull();
  });

  it('returns a base for every campaign level 1-90', () => {
    for (let level = 1; level <= CAMPAIGN_LEVEL_COUNT; level++) {
      expect(getCampaignBase(level)).not.toBeNull();
    }
  });

  it('is deterministic per level', () => {
    expect(getCampaignBase(37)).toEqual(getCampaignBase(37));
  });

  it('maps levels to TH bands of 10 (level 1-10 = TH1, 81-90 = TH9)', () => {
    expect(getCampaignBase(1)!.townHallLevel).toBe(1);
    expect(getCampaignBase(10)!.townHallLevel).toBe(1);
    expect(getCampaignBase(11)!.townHallLevel).toBe(2);
    expect(getCampaignBase(55)!.townHallLevel).toBe(6);
    expect(getCampaignBase(90)!.townHallLevel).toBe(9);
  });

  it('produces sensible layouts for all 90 levels', () => {
    for (const base of getAllCampaignBases()) expectSensibleLayout(base);
  });

  it('gives every level a distinct base id and layout within its TH band', () => {
    const bases = getAllCampaignBases();
    const ids = bases.map((b) => b.id);
    expect(new Set(ids).size).toBe(CAMPAIGN_LEVEL_COUNT);

    // Layouts within a TH band differ from each other
    for (let band = 0; band < 9; band++) {
      const signatures = bases
        .slice(band * 10, band * 10 + 10)
        .map(layoutSignature);
      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });

  it('makes harder levels within a band at least as rewarding', () => {
    // Level 10 (hard) should out-pay level 1 (easy) in the same TH1 band
    const easy = getCampaignBase(1)!;
    const hard = getCampaignBase(10)!;
    expect(hard.loot.gold).toBeGreaterThan(easy.loot.gold * 0.8);
  });
});

// ---------------------------------------------------------------------------
// getAllCampaignBases
// ---------------------------------------------------------------------------

describe('getAllCampaignBases', () => {
  it('returns all 90 bases in level order', () => {
    const bases = getAllCampaignBases();
    expect(bases).toHaveLength(CAMPAIGN_LEVEL_COUNT);
    expect(bases[0]!.id).toBe('campaign_base_1');
    expect(bases[89]!.id).toBe('campaign_base_90');
  });
});
