import {
  getCampaignNPCTownHall,
  getCampaignDifficulty,
  generateCampaignArmy,
  getCampaignBattleConfig,
  calculateCampaignStars,
  calculateCampaignLoot,
} from '../campaign-battle.ts';
import type { CampaignBattleConfig } from '../campaign-battle.ts';

// ---------------------------------------------------------------------------
// getCampaignNPCTownHall
// ---------------------------------------------------------------------------

describe('getCampaignNPCTownHall', () => {
  it('returns TH1 for level 1', () => {
    expect(getCampaignNPCTownHall(1)).toBe(1);
  });

  it('returns TH1 for levels 1 through 10', () => {
    for (let i = 1; i <= 10; i++) {
      expect(getCampaignNPCTownHall(i)).toBe(1);
    }
  });

  it('returns TH2 for level 11', () => {
    expect(getCampaignNPCTownHall(11)).toBe(2);
  });

  it('returns TH2 for levels 11 through 20', () => {
    for (let i = 11; i <= 20; i++) {
      expect(getCampaignNPCTownHall(i)).toBe(2);
    }
  });

  it('returns TH5 for level 50', () => {
    expect(getCampaignNPCTownHall(50)).toBe(5);
  });

  it('returns TH9 for levels 81 through 90', () => {
    for (let i = 81; i <= 90; i++) {
      expect(getCampaignNPCTownHall(i)).toBe(9);
    }
  });

  it('caps at TH10 for levels above 90', () => {
    expect(getCampaignNPCTownHall(100)).toBe(10);
    expect(getCampaignNPCTownHall(150)).toBe(10);
  });

  it('returns TH10 for level 91 through 100', () => {
    for (let i = 91; i <= 100; i++) {
      expect(getCampaignNPCTownHall(i)).toBe(10);
    }
  });

  it('floors to TH1 for level 0 or negative numbers', () => {
    // Math.ceil(0 / 10) = 0, clamped to 1
    expect(getCampaignNPCTownHall(0)).toBe(1);
    // Math.ceil(-5 / 10) = 0, clamped to 1
    expect(getCampaignNPCTownHall(-5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getCampaignDifficulty
// ---------------------------------------------------------------------------

describe('getCampaignDifficulty', () => {
  it('returns "easy" for level 1 (position 0 in group)', () => {
    expect(getCampaignDifficulty(1)).toBe('easy');
  });

  it('returns "easy" for levels at positions 0, 1, 2 in each group', () => {
    // Group 1: levels 1, 2, 3 are positions 0, 1, 2
    expect(getCampaignDifficulty(1)).toBe('easy');
    expect(getCampaignDifficulty(2)).toBe('easy');
    expect(getCampaignDifficulty(3)).toBe('easy');
  });

  it('returns "normal" for levels at positions 3, 4, 5, 6 in each group', () => {
    // Group 1: levels 4, 5, 6, 7 are positions 3, 4, 5, 6
    expect(getCampaignDifficulty(4)).toBe('normal');
    expect(getCampaignDifficulty(5)).toBe('normal');
    expect(getCampaignDifficulty(6)).toBe('normal');
    expect(getCampaignDifficulty(7)).toBe('normal');
  });

  it('returns "hard" for levels at positions 7, 8, 9 in each group', () => {
    // Group 1: levels 8, 9, 10 are positions 7, 8, 9
    expect(getCampaignDifficulty(8)).toBe('hard');
    expect(getCampaignDifficulty(9)).toBe('hard');
    expect(getCampaignDifficulty(10)).toBe('hard');
  });

  it('wraps difficulty cycle for levels in the second group (11-20)', () => {
    expect(getCampaignDifficulty(11)).toBe('easy');
    expect(getCampaignDifficulty(14)).toBe('normal');
    expect(getCampaignDifficulty(18)).toBe('hard');
  });

  it('wraps difficulty cycle for levels in the ninth group (81-90)', () => {
    expect(getCampaignDifficulty(81)).toBe('easy');
    expect(getCampaignDifficulty(84)).toBe('normal');
    expect(getCampaignDifficulty(90)).toBe('hard');
  });

  it('handles boundary between easy and normal exactly', () => {
    // Position 2 = easy, position 3 = normal
    expect(getCampaignDifficulty(3)).toBe('easy');
    expect(getCampaignDifficulty(4)).toBe('normal');
  });

  it('handles boundary between normal and hard exactly', () => {
    // Position 6 = normal, position 7 = hard
    expect(getCampaignDifficulty(7)).toBe('normal');
    expect(getCampaignDifficulty(8)).toBe('hard');
  });
});

// ---------------------------------------------------------------------------
// generateCampaignArmy
// ---------------------------------------------------------------------------

describe('generateCampaignArmy', () => {
  it('generates an army for level 1 (TH1, easy)', () => {
    const army = generateCampaignArmy(1);
    expect(army).toHaveLength(1);
    expect(army[0]!.name).toBe('Barbarian');
  });

  it('scales troop counts down for easy difficulty (0.7x multiplier)', () => {
    const army = generateCampaignArmy(1);
    // TH1 template: Barbarian baseCount=10, easy multiplier=0.7
    // Math.round(10 * 0.7) = 7
    expect(army[0]!.count).toBe(7);
  });

  it('uses normal difficulty multiplier (1.0x) for middle levels in a group', () => {
    // Level 4 is position 3 in group 1 = normal, TH1
    const army = generateCampaignArmy(4);
    // TH1 template: Barbarian baseCount=10, normal multiplier=1.0
    expect(army[0]!.count).toBe(10);
  });

  it('scales troop counts up for hard difficulty (1.3x multiplier)', () => {
    // Level 8 is position 7 in group 1 = hard, TH1
    const army = generateCampaignArmy(8);
    // TH1 template: Barbarian baseCount=10, hard multiplier=1.3
    // Math.round(10 * 1.3) = 13
    expect(army[0]!.count).toBe(13);
  });

  it('generates a multi-troop army for TH2 levels', () => {
    // Level 11 = TH2, easy
    const army = generateCampaignArmy(11);
    expect(army).toHaveLength(2);
    expect(army[0]!.name).toBe('Barbarian');
    expect(army[1]!.name).toBe('Archer');
  });

  it('includes Giants for TH3 levels', () => {
    // Level 21 = TH3, easy
    const army = generateCampaignArmy(21);
    expect(army).toHaveLength(3);
    const names = army.map((t) => t.name);
    expect(names).toContain('Barbarian');
    expect(names).toContain('Archer');
    expect(names).toContain('Giant');
  });

  it('includes Wizards for TH5 levels', () => {
    // Level 41 = TH5, easy
    const army = generateCampaignArmy(41);
    const names = army.map((t) => t.name);
    expect(names).toContain('Wizard');
  });

  it('includes Dragons for TH7 levels', () => {
    // Level 61 = TH7, easy
    const army = generateCampaignArmy(61);
    const names = army.map((t) => t.name);
    expect(names).toContain('Dragon');
  });

  it('includes P.E.K.K.A for TH8 levels', () => {
    // Level 71 = TH8, easy
    const army = generateCampaignArmy(71);
    const names = army.map((t) => t.name);
    expect(names).toContain('P.E.K.K.A');
  });

  it('sets troop level based on TH (ceil(thLevel * 0.8))', () => {
    // TH1: ceil(1 * 0.8) = ceil(0.8) = 1
    const armyTH1 = generateCampaignArmy(1);
    expect(armyTH1[0]!.level).toBe(1);

    // TH5: ceil(5 * 0.8) = ceil(4) = 4
    const armyTH5 = generateCampaignArmy(41);
    expect(armyTH5[0]!.level).toBe(4);

    // TH10: ceil(10 * 0.8) = ceil(8) = 8
    const armyTH10 = generateCampaignArmy(91);
    expect(armyTH10[0]!.level).toBe(8);
  });

  it('ensures all troop counts are at least 1', () => {
    // Even with a low base count and low multiplier, count floors to 1
    const army = generateCampaignArmy(1);
    for (const troop of army) {
      expect(troop.count).toBeGreaterThanOrEqual(1);
    }
  });

  it('falls back to TH1 template for invalid level 0', () => {
    // getCampaignNPCTownHall(0) = max(1, ceil(0/10)) = max(1,0) = 1
    // Then template lookup for TH1
    const army = generateCampaignArmy(0);
    expect(army).toHaveLength(1);
    expect(army[0]!.name).toBe('Barbarian');
  });

  it('returns properly structured TrainedTroop objects', () => {
    const army = generateCampaignArmy(50);
    for (const troop of army) {
      expect(troop).toHaveProperty('name');
      expect(troop).toHaveProperty('level');
      expect(troop).toHaveProperty('count');
      expect(typeof troop.name).toBe('string');
      expect(typeof troop.level).toBe('number');
      expect(typeof troop.count).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// getCampaignBattleConfig
// ---------------------------------------------------------------------------

describe('getCampaignBattleConfig', () => {
  it('returns a valid config for level 1', () => {
    const config = getCampaignBattleConfig(1);
    expect(config).not.toBeNull();
    expect(config!.levelNumber).toBe(1);
    expect(config!.npcTownHallLevel).toBe(1);
    expect(config!.timeLimit).toBe(180);
  });

  it('returns null for a non-existent level (0)', () => {
    const config = getCampaignBattleConfig(0);
    expect(config).toBeNull();
  });

  it('returns null for a non-existent level (91)', () => {
    const config = getCampaignBattleConfig(91);
    expect(config).toBeNull();
  });

  it('returns null for negative level numbers', () => {
    const config = getCampaignBattleConfig(-1);
    expect(config).toBeNull();
  });

  it('includes the npcArmy in the config', () => {
    const config = getCampaignBattleConfig(1);
    expect(config).not.toBeNull();
    expect(Array.isArray(config!.npcArmy)).toBe(true);
    expect(config!.npcArmy.length).toBeGreaterThan(0);
  });

  it('uses easy star thresholds for level 1 (easy difficulty)', () => {
    const config = getCampaignBattleConfig(1);
    expect(config).not.toBeNull();
    expect(config!.starThresholds).toEqual({ one: 30, two: 50, three: 100 });
  });

  it('uses normal star thresholds for level 4 (normal difficulty)', () => {
    const config = getCampaignBattleConfig(4);
    expect(config).not.toBeNull();
    expect(config!.starThresholds).toEqual({ one: 40, two: 60, three: 100 });
  });

  it('uses hard star thresholds for level 8 (hard difficulty)', () => {
    const config = getCampaignBattleConfig(8);
    expect(config).not.toBeNull();
    expect(config!.starThresholds).toEqual({ one: 50, two: 70, three: 100 });
  });

  it('returns a valid config for the last level (90)', () => {
    const config = getCampaignBattleConfig(90);
    expect(config).not.toBeNull();
    expect(config!.levelNumber).toBe(90);
    expect(config!.npcTownHallLevel).toBe(9);
    expect(config!.timeLimit).toBe(180);
  });

  it('generates the correct TH level in config for mid-range levels', () => {
    const config = getCampaignBattleConfig(45);
    expect(config).not.toBeNull();
    expect(config!.npcTownHallLevel).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// calculateCampaignStars
// ---------------------------------------------------------------------------

describe('calculateCampaignStars', () => {
  const easyThresholds = { one: 30, two: 50, three: 100 };
  const normalThresholds = { one: 40, two: 60, three: 100 };
  const hardThresholds = { one: 50, two: 70, three: 100 };

  it('returns 0 stars for 0% destruction without TH destroyed', () => {
    expect(calculateCampaignStars(0, false, easyThresholds)).toBe(0);
  });

  it('returns 0 stars for destruction below the one-star threshold', () => {
    expect(calculateCampaignStars(29, false, easyThresholds)).toBe(0);
  });

  it('returns 1 star at exactly the one-star threshold', () => {
    expect(calculateCampaignStars(30, false, easyThresholds)).toBe(1);
  });

  it('returns 1 star between one and two-star thresholds', () => {
    expect(calculateCampaignStars(45, false, easyThresholds)).toBe(1);
  });

  it('returns 2 stars at exactly the two-star threshold', () => {
    expect(calculateCampaignStars(50, false, easyThresholds)).toBe(2);
  });

  it('returns 2 stars between two and three-star thresholds', () => {
    expect(calculateCampaignStars(75, false, easyThresholds)).toBe(2);
  });

  it('returns 3 stars at 100% destruction', () => {
    expect(calculateCampaignStars(100, false, easyThresholds)).toBe(3);
  });

  it('awards 1 star for TH destroyed even with 0% destruction', () => {
    expect(calculateCampaignStars(0, true, easyThresholds)).toBe(1);
  });

  it('awards 1 star for TH destroyed with low destruction below one-star threshold', () => {
    expect(calculateCampaignStars(10, true, easyThresholds)).toBe(1);
  });

  it('awards 2 stars when TH destroyed and destruction meets the two-star threshold', () => {
    // TH destroyed gives at least 1 star; 50% meets the two-star threshold
    expect(calculateCampaignStars(50, true, easyThresholds)).toBe(2);
  });

  it('awards 3 stars at 100% even with TH destroyed', () => {
    expect(calculateCampaignStars(100, true, easyThresholds)).toBe(3);
  });

  it('uses normal thresholds correctly: 39% = 0 stars, 40% = 1 star', () => {
    expect(calculateCampaignStars(39, false, normalThresholds)).toBe(0);
    expect(calculateCampaignStars(40, false, normalThresholds)).toBe(1);
  });

  it('uses hard thresholds correctly: 49% = 0 stars, 50% = 1 star', () => {
    expect(calculateCampaignStars(49, false, hardThresholds)).toBe(0);
    expect(calculateCampaignStars(50, false, hardThresholds)).toBe(1);
  });

  it('uses hard thresholds correctly: 69% = 1 star, 70% = 2 stars', () => {
    expect(calculateCampaignStars(69, false, hardThresholds)).toBe(1);
    expect(calculateCampaignStars(70, false, hardThresholds)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// calculateCampaignLoot
// ---------------------------------------------------------------------------

describe('calculateCampaignLoot', () => {
  it('returns null for non-existent level 0', () => {
    expect(calculateCampaignLoot(0, 3)).toBeNull();
  });

  it('returns null for non-existent level 91', () => {
    expect(calculateCampaignLoot(91, 3)).toBeNull();
  });

  it('returns null for negative level numbers', () => {
    expect(calculateCampaignLoot(-1, 3)).toBeNull();
  });

  it('returns zero loot for 0 stars', () => {
    const loot = calculateCampaignLoot(1, 0);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(0);
    expect(loot!.elixir).toBe(0);
    expect(loot!.darkElixir).toBe(0);
  });

  it('returns 50% loot for 1 star', () => {
    // Level 1: gold=500, elixir=500, darkElixir=0
    const loot = calculateCampaignLoot(1, 1);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(250);
    expect(loot!.elixir).toBe(250);
    expect(loot!.darkElixir).toBe(0);
  });

  it('returns 75% loot for 2 stars', () => {
    // Level 1: gold=500, elixir=500, darkElixir=0
    const loot = calculateCampaignLoot(1, 2);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(375);
    expect(loot!.elixir).toBe(375);
    expect(loot!.darkElixir).toBe(0);
  });

  it('returns 100% loot for 3 stars', () => {
    // Level 1: gold=500, elixir=500, darkElixir=0
    const loot = calculateCampaignLoot(1, 3);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(500);
    expect(loot!.elixir).toBe(500);
    expect(loot!.darkElixir).toBe(0);
  });

  it('returns 0 loot for invalid star count (4)', () => {
    // Stars=4 is not in the lookup, falls back to 0 multiplier
    const loot = calculateCampaignLoot(1, 4);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(0);
    expect(loot!.elixir).toBe(0);
  });

  it('returns 0 loot for negative star count', () => {
    const loot = calculateCampaignLoot(1, -1);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(0);
    expect(loot!.elixir).toBe(0);
    expect(loot!.darkElixir).toBe(0);
  });

  it('floors fractional loot values', () => {
    // Level 3 ("Goblin Outpost"): gold=1500, elixir likely similar
    // 1 star: 1500 * 0.5 = 750 (exact)
    // 2 stars: 1500 * 0.75 = 1125 (exact)
    const loot = calculateCampaignLoot(3, 2);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(Math.floor(1500 * 0.75));
  });

  it('calculates loot for the last level (90) with 3 stars', () => {
    // Level 90: gold=2500000, elixir=2500000, darkElixir=25000
    const loot = calculateCampaignLoot(90, 3);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(2_500_000);
    expect(loot!.elixir).toBe(2_500_000);
    expect(loot!.darkElixir).toBe(25_000);
  });

  it('returns proportional loot for the last level with 1 star', () => {
    const loot = calculateCampaignLoot(90, 1);
    expect(loot).not.toBeNull();
    expect(loot!.gold).toBe(1_250_000);
    expect(loot!.elixir).toBe(1_250_000);
    expect(loot!.darkElixir).toBe(12_500);
  });
});
