// Integration tests for applyBattleOutcome, the single entry point both app
// shells use after a multiplayer battle: loot, trophies, league recalculation,
// star bonus stars, and the league win bonus into the treasury.

import type { VillageState } from '../../types/village.ts';
import type { BattleResult } from '../../types/battle.ts';
import { applyBattleOutcome } from '../battle-result-handler.ts';
import { getStarBonusStars } from '../trophy-manager.ts';
import { getStorageCapacity } from '../resource-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVillage(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 10,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 10000, elixir: 10000, darkElixir: 500, gems: 100 },
    builders: [],
    army: [],
    spells: [],
    heroes: [],
    trophies: 1400,
    league: 'Gold III',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: 0,
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

function makeResult(overrides?: Partial<BattleResult>): BattleResult {
  return {
    stars: 3,
    destructionPercent: 100,
    loot: { gold: 5000, elixir: 4000, darkElixir: 100 },
    trophyChange: 30,
    timeUsed: 120,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyBattleOutcome
// ---------------------------------------------------------------------------
describe('applyBattleOutcome', () => {
  it('credits loot and trophies on victory', () => {
    const state = applyBattleOutcome(makeVillage(), makeResult());
    expect(state.resources.gold).toBe(15000);
    expect(state.resources.elixir).toBe(14000);
    expect(state.resources.darkElixir).toBe(600);
    expect(state.trophies).toBe(1430);
  });

  it('caps looted resources at storage capacity', () => {
    const village = makeVillage();
    const caps = getStorageCapacity(village);
    const state = applyBattleOutcome(village, makeResult({
      loot: { gold: caps.gold + 999999, elixir: 0, darkElixir: 0 },
    }));
    expect(state.resources.gold).toBe(caps.gold);
  });

  it('recalculates the league after a trophy change', () => {
    const state = applyBattleOutcome(
      makeVillage({ trophies: 1590 }),
      makeResult({ trophyChange: 20 }),
    );
    expect(state.trophies).toBe(1610);
    expect(state.league).toBe('Gold II');
  });

  it('demotes the league on a losing attack', () => {
    const state = applyBattleOutcome(
      makeVillage({ trophies: 1405 }),
      makeResult({ stars: 0, destructionPercent: 20, trophyChange: -30, loot: { gold: 0, elixir: 0, darkElixir: 0 } }),
    );
    expect(state.trophies).toBe(1375);
    expect(state.league).toBe('Silver I');
  });

  it('deposits the league win bonus into the treasury on victory', () => {
    const state = applyBattleOutcome(makeVillage(), makeResult());
    // Gold III full bonus at 100% destruction is 10000 gold and elixir
    expect(state.treasury?.gold).toBe(10000);
    expect(state.treasury?.elixir).toBe(10000);
  });

  it('awards no league bonus on defeat', () => {
    const state = applyBattleOutcome(
      makeVillage(),
      makeResult({ stars: 0, trophyChange: -30 }),
    );
    expect(state.treasury ?? { gold: 0 }).toMatchObject({ gold: 0 });
  });

  it('accumulates star bonus stars', () => {
    const once = applyBattleOutcome(makeVillage(), makeResult({ stars: 2 }));
    expect(getStarBonusStars(once)).toBe(2);
    const twice = applyBattleOutcome(once, makeResult({ stars: 3 }));
    expect(getStarBonusStars(twice)).toBe(5);
  });

  it('does not mutate the input state', () => {
    const village = makeVillage();
    applyBattleOutcome(village, makeResult());
    expect(village.trophies).toBe(1400);
    expect(village.treasury).toBeUndefined();
  });
});
