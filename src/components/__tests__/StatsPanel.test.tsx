// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsPanel } from '../StatsPanel';
import type { GameStatistics } from '../../engine/statistics-tracker.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides?: Partial<GameStatistics>): GameStatistics {
  return {
    totalAttacks: 0,
    totalDefenses: 0,
    totalStarsEarned: 0,
    totalGoldLooted: 0,
    totalElixirLooted: 0,
    totalDarkElixirLooted: 0,
    highestTrophies: 0,
    buildingsUpgraded: 0,
    troopsTrained: 0,
    spellsUsed: 0,
    obstaclesRemoved: 0,
    ...overrides,
  };
}

const defaultProps = {
  stats: makeStats(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<StatsPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatsPanel', () => {
  it('renders the Statistics header', () => {
    renderPanel();
    expect(screen.getByText('Statistics')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const closeBtn = screen.getByLabelText('Close stats');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays the Combat section header', () => {
    renderPanel();
    expect(screen.getByText('Combat')).toBeDefined();
  });

  it('displays the Resources section header', () => {
    renderPanel();
    expect(screen.getByText('Resources')).toBeDefined();
  });

  it('displays the Progress section header', () => {
    renderPanel();
    expect(screen.getByText('Progress')).toBeDefined();
  });

  it('shows stat values formatted with toLocaleString', () => {
    const stats = makeStats({
      totalGoldLooted: 1_234_567,
      totalElixirLooted: 9_876_543,
    });
    renderPanel({ stats });

    expect(screen.getByText((1_234_567).toLocaleString())).toBeDefined();
    expect(screen.getByText((9_876_543).toLocaleString())).toBeDefined();
  });

  it('shows all stat labels from every section', () => {
    renderPanel();

    // Combat section labels
    expect(screen.getByText('Total Attacks')).toBeDefined();
    expect(screen.getByText('Total Defenses')).toBeDefined();
    expect(screen.getByText('Stars Earned')).toBeDefined();
    expect(screen.getByText('Highest Trophies')).toBeDefined();

    // Resources section labels
    expect(screen.getByText('Gold Looted')).toBeDefined();
    expect(screen.getByText('Elixir Looted')).toBeDefined();
    expect(screen.getByText('Dark Elixir Looted')).toBeDefined();

    // Progress section labels
    expect(screen.getByText('Buildings Upgraded')).toBeDefined();
    expect(screen.getByText('Troops Trained')).toBeDefined();
    expect(screen.getByText('Spells Used')).toBeDefined();
    expect(screen.getByText('Obstacles Removed')).toBeDefined();
  });

  it('displays zero values correctly when all stats are zero', () => {
    renderPanel({ stats: makeStats() });

    const zeroCells = screen.getAllByText('0');
    // All 11 stat keys should show "0"
    expect(zeroCells.length).toBe(11);
  });
});
