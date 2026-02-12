// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShopPanel } from '../ShopPanel';
import type { PlacedBuilding, ResourceAmounts } from '../../types/village';
import { traps as trapDataList, wallData } from '../../data/loaders/index';
import { getTownHall } from '../../data/loaders/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacedBuilding(
  buildingId: string,
  buildingType: PlacedBuilding['buildingType'] = 'defense',
  overrides?: Partial<PlacedBuilding>,
): PlacedBuilding {
  return {
    instanceId: `${buildingId}-${Math.random().toString(36).slice(2, 8)}`,
    buildingId,
    buildingType,
    level: 1,
    gridX: 0,
    gridY: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

const richResources: ResourceAmounts = {
  gold: 9_999_999,
  elixir: 9_999_999,
  darkElixir: 9_999_999,
  gems: 0,
};

const poorResources: ResourceAmounts = {
  gold: 0,
  elixir: 0,
  darkElixir: 0,
  gems: 0,
};

const defaultProps = {
  townHallLevel: 5,
  placedBuildings: [] as PlacedBuilding[],
  resources: richResources,
  onSelectBuilding: vi.fn(),
  onSelectTrap: vi.fn(),
  onSelectWall: vi.fn(),
  onClose: vi.fn(),
};

function renderShop(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<ShopPanel {...props} />);
}

function clickTab(label: string) {
  const tab = screen.getByRole('button', { name: label });
  fireEvent.click(tab);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShopPanel', () => {
  // -----------------------------------------------------------------------
  // Tab rendering
  // -----------------------------------------------------------------------

  it('renders all five tabs', () => {
    renderShop();
    for (const label of ['Defenses', 'Resources', 'Army', 'Traps', 'Walls']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
  });

  it('starts on the Defenses tab by default', () => {
    renderShop();
    const defTab = screen.getByRole('button', { name: 'Defenses' });
    expect(defTab.className).toContain('text-amber-400');
  });

  // -----------------------------------------------------------------------
  // Traps tab
  // -----------------------------------------------------------------------

  it('shows trap items when the Traps tab is clicked', () => {
    renderShop({ townHallLevel: 5 });
    clickTab('Traps');

    // At TH5, Bomb (thUnlock 3) and Spring Trap (thUnlock 4) are available
    expect(screen.getByText('Bomb')).toBeDefined();
    expect(screen.getByText('Spring Trap')).toBeDefined();
  });

  it('shows the correct max count for each trap based on maxCountByTH', () => {
    renderShop({ townHallLevel: 5, trapCounts: {} });
    clickTab('Traps');

    // At TH5: Bomb max 4, Spring Trap max 2, Air Bomb max 2
    // Verify Bomb's row shows 0/4
    const bombRow = screen.getByText('Bomb').closest('button')!;
    expect(bombRow.textContent).toContain('0/4');

    // Verify Spring Trap's row shows 0/2
    const springRow = screen.getByText('Spring Trap').closest('button')!;
    expect(springRow.textContent).toContain('0/2');
  });

  it('shows the placed trap count alongside the max count', () => {
    renderShop({ townHallLevel: 5, trapCounts: { Bomb: 2, 'Spring Trap': 1 } });
    clickTab('Traps');

    expect(screen.getByText('2/4')).toBeDefined();
    expect(screen.getByText('1/2')).toBeDefined();
  });

  it('calls onSelectTrap with the trap name when a trap item is clicked', () => {
    const onSelectTrap = vi.fn();
    renderShop({ townHallLevel: 5, onSelectTrap });
    clickTab('Traps');

    const bombButton = screen.getByText('Bomb').closest('button')!;
    fireEvent.click(bombButton);

    expect(onSelectTrap).toHaveBeenCalledWith('Bomb');
  });

  it('does not call onSelectTrap when trap count has reached the max', () => {
    const onSelectTrap = vi.fn();
    // At TH5, Spring Trap max is 2
    renderShop({
      townHallLevel: 5,
      trapCounts: { 'Spring Trap': 2 },
      onSelectTrap,
    });
    clickTab('Traps');

    const springButton = screen.getByText('Spring Trap').closest('button')!;
    fireEvent.click(springButton);

    expect(onSelectTrap).not.toHaveBeenCalled();
  });

  it('disables trap items when max count is reached', () => {
    renderShop({
      townHallLevel: 5,
      trapCounts: { 'Spring Trap': 2 },
    });
    clickTab('Traps');

    const springButton = screen.getByText('Spring Trap').closest('button')!;
    expect(springButton).toHaveProperty('disabled', true);
  });

  it('shows "Max reached" text when a trap is at capacity', () => {
    renderShop({
      townHallLevel: 5,
      trapCounts: { Bomb: 4 },
    });
    clickTab('Traps');

    expect(screen.getByText('Max reached')).toBeDefined();
  });

  it('disables trap items when resources are insufficient', () => {
    // Bomb level 1 costs 400 Gold
    const barelyPoor: ResourceAmounts = { gold: 100, elixir: 0, darkElixir: 0, gems: 0 };
    renderShop({
      townHallLevel: 5,
      resources: barelyPoor,
    });
    clickTab('Traps');

    const bombButton = screen.getByText('Bomb').closest('button')!;
    expect(bombButton).toHaveProperty('disabled', true);
  });

  it('does not show traps that are not unlocked at the current TH level', () => {
    // At TH3, Bomb is unlocked (thUnlock 3) but Spring Trap is not (thUnlock 4)
    // However the component filters by maxCountByTH first; Spring Trap has no "3" key
    renderShop({ townHallLevel: 3 });
    clickTab('Traps');

    expect(screen.getByText('Bomb')).toBeDefined();
    expect(screen.queryByText('Spring Trap')).toBeNull();
  });

  it('does not call onSelectBuilding when a trap is clicked', () => {
    const onSelectBuilding = vi.fn();
    const onSelectTrap = vi.fn();
    renderShop({ townHallLevel: 5, onSelectBuilding, onSelectTrap });
    clickTab('Traps');

    const bombButton = screen.getByText('Bomb').closest('button')!;
    fireEvent.click(bombButton);

    expect(onSelectBuilding).not.toHaveBeenCalled();
    expect(onSelectTrap).toHaveBeenCalledWith('Bomb');
  });

  // -----------------------------------------------------------------------
  // Walls tab
  // -----------------------------------------------------------------------

  it('shows a wall entry when the Walls tab is clicked', () => {
    // TH2+ has walls, TH5 has maxWalls 100
    renderShop({ townHallLevel: 5 });
    clickTab('Walls');

    expect(screen.getByText('Wall')).toBeDefined();
  });

  it('shows the correct maxWalls count from TH data', () => {
    const th5 = getTownHall(5);
    const maxWalls = th5?.maxWalls ?? 0;
    expect(maxWalls).toBe(100); // sanity check on real data

    renderShop({ townHallLevel: 5, wallCount: 0 });
    clickTab('Walls');

    expect(screen.getByText(`0/${maxWalls}`)).toBeDefined();
  });

  it('calls onSelectWall when the wall item is clicked', () => {
    const onSelectWall = vi.fn();
    renderShop({ townHallLevel: 5, onSelectWall });
    clickTab('Walls');

    const wallButton = screen.getByText('Wall').closest('button')!;
    fireEvent.click(wallButton);

    expect(onSelectWall).toHaveBeenCalledTimes(1);
  });

  it('disables the wall item when wallCount equals maxWalls', () => {
    const th5 = getTownHall(5)!;
    renderShop({ townHallLevel: 5, wallCount: th5.maxWalls });
    clickTab('Walls');

    const wallButton = screen.getByText('Wall').closest('button')!;
    expect(wallButton).toHaveProperty('disabled', true);
  });

  it('does not call onSelectWall when wall count has reached the max', () => {
    const onSelectWall = vi.fn();
    const th5 = getTownHall(5)!;
    renderShop({ townHallLevel: 5, wallCount: th5.maxWalls, onSelectWall });
    clickTab('Walls');

    const wallButton = screen.getByText('Wall').closest('button')!;
    fireEvent.click(wallButton);

    expect(onSelectWall).not.toHaveBeenCalled();
  });

  it('shows the wall cost from wallData level 1', () => {
    renderShop({ townHallLevel: 5 });
    clickTab('Walls');

    const lvl1Cost = wallData.levels[0].upgradeCost;
    const costText = `${lvl1Cost.toLocaleString()} ${wallData.levels[0].upgradeResource}`;
    expect(screen.getByText(costText)).toBeDefined();
  });

  it('shows no wall entry at TH1 since maxWalls is 0', () => {
    renderShop({ townHallLevel: 1 });
    clickTab('Walls');

    expect(screen.queryByText('Wall')).toBeNull();
    expect(screen.getByText('No buildings available in this category.')).toBeDefined();
  });

  it('does not call onSelectBuilding when a wall is clicked', () => {
    const onSelectBuilding = vi.fn();
    const onSelectWall = vi.fn();
    renderShop({ townHallLevel: 5, onSelectBuilding, onSelectWall });
    clickTab('Walls');

    const wallButton = screen.getByText('Wall').closest('button')!;
    fireEvent.click(wallButton);

    expect(onSelectBuilding).not.toHaveBeenCalled();
    expect(onSelectWall).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Close button
  // -----------------------------------------------------------------------

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderShop({ onClose });

    const closeBtn = screen.getByLabelText('Close shop');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Cross-tab behavior: building tabs still route through onSelectBuilding
  // -----------------------------------------------------------------------

  it('calls onSelectBuilding for defense tab items (not onSelectTrap or onSelectWall)', () => {
    const onSelectBuilding = vi.fn();
    const onSelectTrap = vi.fn();
    const onSelectWall = vi.fn();
    renderShop({ townHallLevel: 5, onSelectBuilding, onSelectTrap, onSelectWall });

    // Defenses tab is default; click the first defense item (Cannon)
    const cannonButton = screen.getByText('Cannon').closest('button')!;
    fireEvent.click(cannonButton);

    expect(onSelectBuilding).toHaveBeenCalledWith('Cannon', 'defense');
    expect(onSelectTrap).not.toHaveBeenCalled();
    expect(onSelectWall).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Trap display with affordable boundary
  // -----------------------------------------------------------------------

  it('enables trap items when resources exactly meet the cost', () => {
    // Bomb level 1 costs 400 Gold
    const exactResources: ResourceAmounts = { gold: 400, elixir: 0, darkElixir: 0, gems: 0 };
    renderShop({ townHallLevel: 5, resources: exactResources });
    clickTab('Traps');

    const bombButton = screen.getByText('Bomb').closest('button')!;
    expect(bombButton).toHaveProperty('disabled', false);
  });

  // -----------------------------------------------------------------------
  // Wall count reflects wallCount prop
  // -----------------------------------------------------------------------

  it('displays the current wall count from the wallCount prop', () => {
    renderShop({ townHallLevel: 5, wallCount: 42 });
    clickTab('Walls');

    expect(screen.getByText('42/100')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Trap data integrity check
  // -----------------------------------------------------------------------

  it('lists all traps that have a nonzero maxCountByTH entry for the given TH level', () => {
    const thLevel = 8;
    renderShop({ townHallLevel: thLevel });
    clickTab('Traps');

    const expectedTraps = trapDataList.filter((t) => {
      const max = t.maxCountByTH[String(thLevel)] ?? 0;
      return max > 0;
    });

    for (const trap of expectedTraps) {
      expect(screen.getByText(trap.name)).toBeDefined();
    }
  });
});
