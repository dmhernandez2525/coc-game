import {
  npcBases,
  getNPCBasesForTH,
  getNPCBasesMatchingTH,
  getNPCBaseById,
  getRandomNPCBase,
  getBaseTrophyOffer,
} from '../npc-bases.ts';

// ---------------------------------------------------------------------------
// npcBases data integrity
// ---------------------------------------------------------------------------

describe('npcBases', () => {
  it('has 75 entries (6 per TH 1-10, 3 per TH 11-15)', () => {
    expect(npcBases).toHaveLength(75);
  });

  it('every base has a non-empty id', () => {
    for (const base of npcBases) {
      expect(base.id).toBeTruthy();
      expect(typeof base.id).toBe('string');
    }
  });

  it('every base has a non-empty name', () => {
    for (const base of npcBases) {
      expect(base.name).toBeTruthy();
      expect(typeof base.name).toBe('string');
    }
  });

  it('every base has a townHallLevel between 1 and 15', () => {
    for (const base of npcBases) {
      expect(base.townHallLevel).toBeGreaterThanOrEqual(1);
      expect(base.townHallLevel).toBeLessThanOrEqual(15);
    }
  });

  it('every base has a positive trophyOffer', () => {
    for (const base of npcBases) {
      expect(base.trophyOffer).toBeGreaterThan(0);
    }
  });

  it('every base has non-negative loot values', () => {
    for (const base of npcBases) {
      expect(base.loot.gold).toBeGreaterThanOrEqual(0);
      expect(base.loot.elixir).toBeGreaterThanOrEqual(0);
      expect(base.loot.darkElixir).toBeGreaterThanOrEqual(0);
    }
  });

  it('every base has a non-empty buildings array', () => {
    for (const base of npcBases) {
      expect(base.buildings.length).toBeGreaterThan(0);
    }
  });

  it('every base contains a Town Hall building', () => {
    for (const base of npcBases) {
      const hasTH = base.buildings.some((b) => b.buildingId === 'Town Hall');
      expect(hasTH).toBe(true);
    }
  });

  it('has at least 5 bases per TH level 1 through 10', () => {
    for (let th = 1; th <= 10; th++) {
      const count = npcBases.filter((b) => b.townHallLevel === th).length;
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });

  it('has exactly 3 bases per TH level 11 through 15', () => {
    for (let th = 11; th <= 15; th++) {
      const count = npcBases.filter((b) => b.townHallLevel === th).length;
      expect(count).toBe(3);
    }
  });

  it('all base ids are unique', () => {
    const ids = npcBases.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// getNPCBasesForTH
// ---------------------------------------------------------------------------

describe('getNPCBasesForTH', () => {
  it('TH1 returns bases with townHallLevel <= 2 (TH1 + TH2 bases)', () => {
    const bases = getNPCBasesForTH(1);
    // TH1 bases (6) + TH2 bases (6) = 12
    expect(bases).toHaveLength(12);
    for (const base of bases) {
      expect(base.townHallLevel).toBeLessThanOrEqual(2);
    }
  });

  it('TH3 returns bases with townHallLevel <= 4 (TH1 through TH4)', () => {
    const bases = getNPCBasesForTH(3);
    // TH1(6) + TH2(6) + TH3(6) + TH4(6) = 24
    expect(bases).toHaveLength(24);
    for (const base of bases) {
      expect(base.townHallLevel).toBeLessThanOrEqual(4);
    }
  });

  it('TH5 returns 36 bases (townHallLevel <= 6)', () => {
    const bases = getNPCBasesForTH(5);
    expect(bases).toHaveLength(36);
  });

  it('TH0 returns only bases with townHallLevel <= 1 (TH1 bases only)', () => {
    const bases = getNPCBasesForTH(0);
    expect(bases).toHaveLength(6);
    for (const base of bases) {
      expect(base.townHallLevel).toBe(1);
    }
  });

  it('returns an empty array for a TH level with no matching bases', () => {
    // thLevel + 1 = 0, so no base has townHallLevel <= 0
    const bases = getNPCBasesForTH(-1);
    expect(bases).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getNPCBasesMatchingTH
// ---------------------------------------------------------------------------

describe('getNPCBasesMatchingTH', () => {
  it('returns only exact-TH bases when they exist', () => {
    const bases = getNPCBasesMatchingTH(6);
    expect(bases.length).toBeGreaterThanOrEqual(5);
    for (const base of bases) {
      expect(base.townHallLevel).toBe(6);
    }
  });

  it('falls back to the standard pool when no exact match exists', () => {
    const bases = getNPCBasesMatchingTH(99);
    expect(bases.length).toBeGreaterThan(0);
  });

  it('returns an empty array when even the fallback pool is empty', () => {
    expect(getNPCBasesMatchingTH(-5)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getNPCBaseById
// ---------------------------------------------------------------------------

describe('getNPCBaseById', () => {
  it('finds a handcrafted base by id', () => {
    const base = getNPCBaseById('npc_th5_1');
    expect(base).toBeDefined();
    expect(base!.townHallLevel).toBe(5);
  });

  it('finds a generated base by id', () => {
    const base = getNPCBaseById('npc_th7_g1');
    expect(base).toBeDefined();
    expect(base!.townHallLevel).toBe(7);
  });

  it('returns undefined for unknown ids', () => {
    expect(getNPCBaseById('not_a_base')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getBaseTrophyOffer
// ---------------------------------------------------------------------------

describe('getBaseTrophyOffer', () => {
  const base = getNPCBaseById('npc_th5_1')!;

  it('pays the listed offer at an even TH matchup', () => {
    expect(getBaseTrophyOffer(base, 5)).toBe(base.trophyOffer);
  });

  it('pays more when attacking up and less when attacking down', () => {
    const even = getBaseTrophyOffer(base, 5);
    expect(getBaseTrophyOffer(base, 3)).toBeGreaterThan(even);
    expect(getBaseTrophyOffer(base, 8)).toBeLessThan(even);
  });

  it('clamps offers into the 5-60 range', () => {
    expect(getBaseTrophyOffer(base, 15)).toBe(5);
    const th15Base = getNPCBaseById('npc_th15_3')!;
    expect(getBaseTrophyOffer(th15Base, 1)).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// getRandomNPCBase
// ---------------------------------------------------------------------------

describe('getRandomNPCBase', () => {
  it('returns a valid NPCBase for TH1', () => {
    const base = getRandomNPCBase(1);
    expect(base).toBeDefined();
    expect(base!.id).toBeTruthy();
    expect(base!.townHallLevel).toBeLessThanOrEqual(2);
  });

  it('returns undefined when no bases are available', () => {
    const base = getRandomNPCBase(-1);
    expect(base).toBeUndefined();
  });

  it('uses Math.random to pick a base (mocked to return first)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const available = getNPCBasesForTH(1);
      const base = getRandomNPCBase(1);
      expect(base).toEqual(available[0]);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('uses Math.random to pick a base (mocked to return last)', () => {
    // 0.999... * length floors to length - 1, which is the last element
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    try {
      const available = getNPCBasesForTH(1);
      const base = getRandomNPCBase(1);
      expect(base).toEqual(available[available.length - 1]);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('always returns a base from the available pool for TH5', () => {
    const available = getNPCBasesForTH(5);
    const ids = new Set(available.map((b) => b.id));
    for (let i = 0; i < 20; i++) {
      const base = getRandomNPCBase(5);
      expect(base).toBeDefined();
      expect(ids.has(base!.id)).toBe(true);
    }
  });
});
