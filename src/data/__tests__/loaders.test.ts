import {
  townhalls,
  getTownHall,
  getMaxBuildingCount,
  defenses,
  getDefense,
  getDefenseAtLevel,
  getAllDefenseNames,
  getTroop,
  getAllTroops,
  resourceBuildings,
  getCollectors,
  getStorages,
  getSpell,
  getAllSpells,
  getHero,
  getPet,
} from '../loaders';

// ---------------------------------------------------------------------------
// Townhall loader
// ---------------------------------------------------------------------------

describe('townhall-loader', () => {
  it('townhalls array is non-empty', () => {
    expect(townhalls.length).toBeGreaterThan(0);
  });

  it('getTownHall(1) returns TH level 1 data', () => {
    const th1 = getTownHall(1);
    expect(th1).toBeDefined();
    expect(th1!.level).toBe(1);
    expect(th1!.hp).toBeGreaterThan(0);
  });

  it('getTownHall(999) returns undefined for non-existent level', () => {
    expect(getTownHall(999)).toBeUndefined();
  });

  it('getMaxBuildingCount returns correct count for Cannon at TH1', () => {
    const count = getMaxBuildingCount(1, 'Cannon');
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Defense loader
// ---------------------------------------------------------------------------

describe('defense-loader', () => {
  it('defenses record is non-empty', () => {
    expect(Object.keys(defenses).length).toBeGreaterThan(0);
  });

  it('getDefense("Cannon") returns valid defense data', () => {
    const cannon = getDefense('Cannon');
    expect(cannon).toBeDefined();
    expect(cannon!.name).toBe('Cannon');
    expect(cannon!.levels.length).toBeGreaterThan(0);
  });

  it('getDefenseAtLevel("Cannon", 1) returns level 1 stats', () => {
    const lvl1 = getDefenseAtLevel('Cannon', 1);
    expect(lvl1).toBeDefined();
    expect(lvl1!.level).toBe(1);
    expect(lvl1!.dps).toBeGreaterThan(0);
  });

  it('getAllDefenseNames() returns an array of strings', () => {
    const names = getAllDefenseNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('Cannon');
    names.forEach((n) => expect(typeof n).toBe('string'));
  });
});

// ---------------------------------------------------------------------------
// Troop loader
// ---------------------------------------------------------------------------

describe('troop-loader', () => {
  it('getTroop("Barbarian") returns valid elixir troop data', () => {
    const barb = getTroop('Barbarian');
    expect(barb).toBeDefined();
    expect(barb!.name).toBe('Barbarian');
    expect(barb!.type).toBe('elixir');
  });

  it('getTroop("Minion") returns valid dark elixir troop data', () => {
    const minion = getTroop('Minion');
    expect(minion).toBeDefined();
    expect(minion!.name).toBe('Minion');
    expect(minion!.type).toBe('dark_elixir');
  });

  it('getAllTroops() returns a combined array from both sources', () => {
    const all = getAllTroops();
    expect(all.length).toBeGreaterThan(0);
    const names = all.map((t) => t.name);
    expect(names).toContain('Barbarian');
    expect(names).toContain('Minion');
  });

  it('normalizes favoriteTarget "None" to null', () => {
    const minion = getTroop('Minion');
    expect(minion).toBeDefined();
    // The raw JSON has "None" for Minion; loader should normalize to null
    expect(minion!.favoriteTarget).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resource loader
// ---------------------------------------------------------------------------

describe('resource-loader', () => {
  it('resourceBuildings is non-empty', () => {
    expect(resourceBuildings.length).toBeGreaterThan(0);
  });

  it('getCollectors() returns only collector buildings', () => {
    const collectors = getCollectors();
    expect(collectors.length).toBeGreaterThan(0);
    collectors.forEach((c) => expect(c.category).toBe('resource_collector'));
  });

  it('getStorages() returns only storage buildings', () => {
    const storages = getStorages();
    expect(storages.length).toBeGreaterThan(0);
    storages.forEach((s) => expect(s.category).toBe('resource_storage'));
  });
});

// ---------------------------------------------------------------------------
// Spell loader
// ---------------------------------------------------------------------------

describe('spell-loader', () => {
  it('getSpell("Lightning Spell") returns valid spell data', () => {
    const spell = getSpell('Lightning Spell');
    expect(spell).toBeDefined();
    expect(spell!.name).toBe('Lightning Spell');
    expect(spell!.type).toBe('elixir');
  });

  it('getAllSpells() combines elixir and dark spells', () => {
    const all = getAllSpells();
    expect(all.length).toBeGreaterThan(0);
    const names = all.map((s) => s.name);
    expect(names).toContain('Lightning Spell');
    expect(names).toContain('Poison Spell');
  });
});

// ---------------------------------------------------------------------------
// Hero loader
// ---------------------------------------------------------------------------

describe('hero-loader', () => {
  it('getHero("Barbarian King") returns valid hero data', () => {
    const bk = getHero('Barbarian King');
    expect(bk).toBeDefined();
    expect(bk!.name).toBe('Barbarian King');
    expect(bk!.levels.length).toBeGreaterThan(0);
  });

  it('getPet("L.A.S.S.I") returns valid pet data', () => {
    const lassi = getPet('L.A.S.S.I');
    expect(lassi).toBeDefined();
    expect(lassi!.name).toBe('L.A.S.S.I');
    expect(lassi!.levels.length).toBeGreaterThan(0);
  });
});
