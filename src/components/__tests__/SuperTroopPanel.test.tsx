// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuperTroopPanel } from '../SuperTroopPanel';
import type { SuperTroopState } from '../../engine/super-troop-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyState: SuperTroopState = { activeBoosts: [] };

const stateWithBoost: SuperTroopState = {
  activeBoosts: [
    {
      baseTroopName: 'Barbarian',
      superTroopName: 'Super Barbarian',
      remainingDurationMs: 2 * 24 * 60 * 60 * 1000, // 2 days
    },
  ],
};

const defaultProps = {
  superTroopState: emptyState,
  townHallLevel: 11,
  darkElixir: 100_000,
  onBoost: vi.fn(),
  onUnboost: vi.fn(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<SuperTroopPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SuperTroopPanel', () => {
  it('renders without crashing', () => {
    renderPanel();
    expect(screen.getByText('Super Troops')).toBeDefined();
  });

  it('shows the correct header text', () => {
    renderPanel();
    const header = screen.getByText('Super Troops');
    expect(header.tagName).toBe('H3');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const closeBtn = screen.getByLabelText('Close super troops');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the active boost counter', () => {
    renderPanel({ superTroopState: emptyState });
    expect(screen.getByText('0/2 Active')).toBeDefined();
  });

  it('shows super troop cards with names', () => {
    renderPanel();
    // The panel should show at least one super troop from the data
    // getAllSuperTroops returns the full list from economy-loader
    const cards = screen.getAllByText(/Base:/);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('shows Boost buttons for available super troops at TH11+ with enough dark elixir', () => {
    renderPanel({ townHallLevel: 11, darkElixir: 999_999 });

    const boostButtons = screen.queryAllByRole('button', { name: 'Boost' });
    expect(boostButtons.length).toBeGreaterThan(0);
  });

  it('calls onBoost when a Boost button is clicked', () => {
    const onBoost = vi.fn();
    renderPanel({ townHallLevel: 11, darkElixir: 999_999, onBoost });

    const boostButtons = screen.getAllByRole('button', { name: 'Boost' });
    fireEvent.click(boostButtons[0]);

    expect(onBoost).toHaveBeenCalledTimes(1);
  });

  it('shows Active button and remaining time for boosted troops', () => {
    renderPanel({ superTroopState: stateWithBoost });

    // The boosted troop should show an "Active" button
    const activeButtons = screen.queryAllByRole('button', { name: 'Active' });
    expect(activeButtons.length).toBeGreaterThanOrEqual(1);

    // Should show remaining time text
    expect(screen.getByText('48h 0m remaining')).toBeDefined();
  });
});
