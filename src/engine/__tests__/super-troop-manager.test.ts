import {
  createSuperTroopState,
  getAllSuperTroops,
  getSuperTroop,
  getSuperVariant,
  canBoost,
  boostSuperTroop,
  unboostSuperTroop,
  tickSuperTroopTimers,
  isTroopBoosted,
  getActiveSuperTroop,
  getBoostDurationMs,
  getMaxActiveBoosts,
  type SuperTroopState,
  type SuperTroopBoost,
} from '../super-troop-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a state with one active boost for "Super Barbarian". */
function stateWithSuperBarbarian(): SuperTroopState {
  return {
    activeBoosts: [
      {
        baseTroopName: 'Barbarian',
        superTroopName: 'Super Barbarian',
        remainingDurationMs: getBoostDurationMs(),
      },
    ],
  };
}

/** Build a state that has the maximum number of active boosts. */
function stateAtMaxBoosts(): SuperTroopState {
  return {
    activeBoosts: [
      {
        baseTroopName: 'Barbarian',
        superTroopName: 'Super Barbarian',
        remainingDurationMs: getBoostDurationMs(),
      },
      {
        baseTroopName: 'Archer',
        superTroopName: 'Super Archer',
        remainingDurationMs: getBoostDurationMs(),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// createSuperTroopState
// ---------------------------------------------------------------------------

describe('createSuperTroopState', () => {
  it('returns an object with an empty activeBoosts array', () => {
    const state = createSuperTroopState();
    expect(state).toEqual({ activeBoosts: [] });
  });

  it('returns a new reference on each call', () => {
    const a = createSuperTroopState();
    const b = createSuperTroopState();
    expect(a).not.toBe(b);
    expect(a.activeBoosts).not.toBe(b.activeBoosts);
  });
});

// ---------------------------------------------------------------------------
// getAllSuperTroops
// ---------------------------------------------------------------------------

describe('getAllSuperTroops', () => {
  it('returns a non-empty array', () => {
    const troops = getAllSuperTroops();
    expect(troops.length).toBeGreaterThan(0);
  });

  it('returns a fresh copy each time (immutability)', () => {
    const first = getAllSuperTroops();
    const second = getAllSuperTroops();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// getSuperTroop
// ---------------------------------------------------------------------------

describe('getSuperTroop', () => {
  it('returns data for a valid super troop name', () => {
    const data = getSuperTroop('Super Barbarian');
    expect(data).toBeDefined();
    expect(data!.name).toBe('Super Barbarian');
    expect(data!.baseTroop).toBe('Barbarian');
  });

  it('returns undefined for an unknown name', () => {
    expect(getSuperTroop('Mega Dragon 9000')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getSuperVariant
// ---------------------------------------------------------------------------

describe('getSuperVariant', () => {
  it('returns the super variant for a base troop that has one', () => {
    const variant = getSuperVariant('Barbarian');
    expect(variant).toBeDefined();
    expect(variant!.name).toBe('Super Barbarian');
    expect(variant!.baseTroop).toBe('Barbarian');
  });

  it('returns undefined for a base troop with no super variant', () => {
    expect(getSuperVariant('NonExistentTroop')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// canBoost
// ---------------------------------------------------------------------------

describe('canBoost', () => {
  const empty = createSuperTroopState();

  it('returns false when TH level is below 11', () => {
    expect(canBoost(empty, 'Super Barbarian', 10, 999_999)).toBe(false);
  });

  it('returns false when TH level is below the specific troop requirement', () => {
    // Super Giant requires TH12
    expect(canBoost(empty, 'Super Giant', 11, 999_999)).toBe(false);
  });

  it('returns false when activeBoosts is already at max', () => {
    const full = stateAtMaxBoosts();
    expect(canBoost(full, 'Super Giant', 14, 999_999)).toBe(false);
  });

  it('returns false when the super troop is already boosted', () => {
    const state = stateWithSuperBarbarian();
    expect(canBoost(state, 'Super Barbarian', 14, 999_999)).toBe(false);
  });

  it('returns false when the same base troop is already boosted', () => {
    // If "Super Barbarian" is active, boosting another super that also uses
    // "Barbarian" as its base should fail. Since there is only one super per
    // base troop in the data set, we test this by crafting state directly.
    const state: SuperTroopState = {
      activeBoosts: [
        {
          baseTroopName: 'Barbarian',
          superTroopName: 'Super Barbarian',
          remainingDurationMs: getBoostDurationMs(),
        },
      ],
    };
    expect(canBoost(state, 'Super Barbarian', 14, 999_999)).toBe(false);
  });

  it('returns false when dark elixir is insufficient', () => {
    // Super Barbarian costs 25000 DE
    expect(canBoost(empty, 'Super Barbarian', 14, 24_999)).toBe(false);
  });

  it('returns false for an unknown super troop name', () => {
    expect(canBoost(empty, 'Fake Troop', 14, 999_999)).toBe(false);
  });

  it('returns true when all conditions are met', () => {
    expect(canBoost(empty, 'Super Barbarian', 14, 25_000)).toBe(true);
  });

  it('returns true with exactly the required dark elixir amount', () => {
    const superData = getSuperTroop('Super Barbarian');
    expect(canBoost(empty, 'Super Barbarian', 14, superData!.boostCost)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// boostSuperTroop
// ---------------------------------------------------------------------------

describe('boostSuperTroop', () => {
  it('creates a boost entry with correct fields', () => {
    const state = createSuperTroopState();
    const result = boostSuperTroop(state, 'Super Barbarian', 14, 100_000);

    expect(result).not.toBeNull();
    expect(result!.state.activeBoosts).toHaveLength(1);

    const boost = result!.state.activeBoosts[0];
    expect(boost.baseTroopName).toBe('Barbarian');
    expect(boost.superTroopName).toBe('Super Barbarian');
    expect(boost.remainingDurationMs).toBe(getBoostDurationMs());
  });

  it('returns null when canBoost conditions are not met', () => {
    const state = createSuperTroopState();
    expect(boostSuperTroop(state, 'Super Barbarian', 5, 100_000)).toBeNull();
  });

  it('deducts the correct cost', () => {
    const state = createSuperTroopState();
    const result = boostSuperTroop(state, 'Super Barbarian', 14, 100_000);
    const expectedCost = getSuperTroop('Super Barbarian')!.boostCost;
    expect(result!.cost).toBe(expectedCost);
  });

  it('does not mutate the original state', () => {
    const state = createSuperTroopState();
    const original = { ...state, activeBoosts: [...state.activeBoosts] };
    boostSuperTroop(state, 'Super Barbarian', 14, 100_000);
    expect(state).toEqual(original);
  });

  it('allows boosting a second super troop', () => {
    const state = createSuperTroopState();
    const first = boostSuperTroop(state, 'Super Barbarian', 14, 100_000);
    expect(first).not.toBeNull();

    const second = boostSuperTroop(first!.state, 'Super Archer', 14, 100_000);
    expect(second).not.toBeNull();
    expect(second!.state.activeBoosts).toHaveLength(2);
  });

  it('returns null when trying to exceed max active boosts', () => {
    const full = stateAtMaxBoosts();
    expect(boostSuperTroop(full, 'Super Giant', 14, 100_000)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// unboostSuperTroop
// ---------------------------------------------------------------------------

describe('unboostSuperTroop', () => {
  it('removes the targeted boost', () => {
    const state = stateWithSuperBarbarian();
    const updated = unboostSuperTroop(state, 'Super Barbarian');
    expect(updated.activeBoosts).toHaveLength(0);
  });

  it('leaves other boosts untouched', () => {
    const state = stateAtMaxBoosts();
    const updated = unboostSuperTroop(state, 'Super Barbarian');
    expect(updated.activeBoosts).toHaveLength(1);
    expect(updated.activeBoosts[0].superTroopName).toBe('Super Archer');
  });

  it('does not mutate the original state', () => {
    const state = stateAtMaxBoosts();
    const originalLength = state.activeBoosts.length;
    unboostSuperTroop(state, 'Super Barbarian');
    expect(state.activeBoosts).toHaveLength(originalLength);
  });

  it('returns unchanged state when boost name does not exist', () => {
    const state = stateWithSuperBarbarian();
    const updated = unboostSuperTroop(state, 'Nonexistent Super');
    expect(updated.activeBoosts).toHaveLength(1);
    expect(updated.activeBoosts[0].superTroopName).toBe('Super Barbarian');
  });
});

// ---------------------------------------------------------------------------
// tickSuperTroopTimers
// ---------------------------------------------------------------------------

describe('tickSuperTroopTimers', () => {
  it('decrements remaining duration by the delta', () => {
    const state = stateWithSuperBarbarian();
    const delta = 1000;
    const updated = tickSuperTroopTimers(state, delta);
    expect(updated.activeBoosts[0].remainingDurationMs).toBe(
      getBoostDurationMs() - delta,
    );
  });

  it('removes boosts that have expired (duration <= 0)', () => {
    const state: SuperTroopState = {
      activeBoosts: [
        {
          baseTroopName: 'Barbarian',
          superTroopName: 'Super Barbarian',
          remainingDurationMs: 500,
        },
      ],
    };
    const updated = tickSuperTroopTimers(state, 500);
    expect(updated.activeBoosts).toHaveLength(0);
  });

  it('removes boosts whose duration goes negative', () => {
    const state: SuperTroopState = {
      activeBoosts: [
        {
          baseTroopName: 'Barbarian',
          superTroopName: 'Super Barbarian',
          remainingDurationMs: 100,
        },
      ],
    };
    const updated = tickSuperTroopTimers(state, 200);
    expect(updated.activeBoosts).toHaveLength(0);
  });

  it('keeps boosts that still have time left', () => {
    const state = stateAtMaxBoosts();
    const updated = tickSuperTroopTimers(state, 1000);
    expect(updated.activeBoosts).toHaveLength(2);
    for (const boost of updated.activeBoosts) {
      expect(boost.remainingDurationMs).toBe(getBoostDurationMs() - 1000);
    }
  });

  it('handles mixed expired and active boosts', () => {
    const state: SuperTroopState = {
      activeBoosts: [
        {
          baseTroopName: 'Barbarian',
          superTroopName: 'Super Barbarian',
          remainingDurationMs: 100,
        },
        {
          baseTroopName: 'Archer',
          superTroopName: 'Super Archer',
          remainingDurationMs: 50_000,
        },
      ],
    };
    const updated = tickSuperTroopTimers(state, 200);
    expect(updated.activeBoosts).toHaveLength(1);
    expect(updated.activeBoosts[0].superTroopName).toBe('Super Archer');
    expect(updated.activeBoosts[0].remainingDurationMs).toBe(49_800);
  });

  it('does not mutate the original state', () => {
    const state = stateWithSuperBarbarian();
    const originalDuration = state.activeBoosts[0].remainingDurationMs;
    tickSuperTroopTimers(state, 5000);
    expect(state.activeBoosts[0].remainingDurationMs).toBe(originalDuration);
  });
});

// ---------------------------------------------------------------------------
// isTroopBoosted
// ---------------------------------------------------------------------------

describe('isTroopBoosted', () => {
  it('returns true when the base troop is currently boosted', () => {
    const state = stateWithSuperBarbarian();
    expect(isTroopBoosted(state, 'Barbarian')).toBe(true);
  });

  it('returns false when the base troop is not boosted', () => {
    const state = stateWithSuperBarbarian();
    expect(isTroopBoosted(state, 'Archer')).toBe(false);
  });

  it('returns false for an empty state', () => {
    const state = createSuperTroopState();
    expect(isTroopBoosted(state, 'Barbarian')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getActiveSuperTroop
// ---------------------------------------------------------------------------

describe('getActiveSuperTroop', () => {
  it('returns the super troop name when the base troop is boosted', () => {
    const state = stateWithSuperBarbarian();
    expect(getActiveSuperTroop(state, 'Barbarian')).toBe('Super Barbarian');
  });

  it('returns undefined when the base troop is not boosted', () => {
    const state = stateWithSuperBarbarian();
    expect(getActiveSuperTroop(state, 'Giant')).toBeUndefined();
  });

  it('returns undefined for an empty state', () => {
    const state = createSuperTroopState();
    expect(getActiveSuperTroop(state, 'Barbarian')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getBoostDurationMs / getMaxActiveBoosts (constants)
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('getBoostDurationMs returns 3 days in milliseconds', () => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(getBoostDurationMs()).toBe(threeDaysMs);
  });

  it('getMaxActiveBoosts returns 2', () => {
    expect(getMaxActiveBoosts()).toBe(2);
  });
});
