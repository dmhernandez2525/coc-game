// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroPanel } from '../HeroPanel';
import type { OwnedHero } from '../../types/village';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHero(overrides?: Partial<OwnedHero>): OwnedHero {
  return {
    name: 'Barbarian King',
    level: 5,
    currentHp: 1000,
    isRecovering: false,
    recoveryTimeRemaining: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    equippedItems: [null, null],
    assignedPet: null,
    ...overrides,
  };
}

const defaultProps = {
  heroes: [] as OwnedHero[],
  townHallLevel: 5,
  onUpdateHero: vi.fn(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<HeroPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeroPanel', () => {
  it('renders without crashing', () => {
    renderPanel();
    expect(screen.getByText('Heroes')).toBeDefined();
  });

  it('shows the correct header text', () => {
    renderPanel();
    const header = screen.getByText('Heroes');
    expect(header.tagName).toBe('H2');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const closeBtn = screen.getByLabelText('Close hero panel');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows empty state message when heroes list is empty and TH is low', () => {
    // At TH5, no heroes are unlocked (first hero is Barbarian King at TH7)
    renderPanel({ heroes: [], townHallLevel: 5 });
    expect(
      screen.getByText('Heroes unlock at higher Town Hall levels.'),
    ).toBeDefined();
  });

  it('shows "no heroes owned" message when TH is high enough but heroes list is empty', () => {
    // At TH7 the Barbarian King definition exists, but the player has none
    renderPanel({ heroes: [], townHallLevel: 7 });
    expect(
      screen.getByText('No heroes owned yet. Build a hero altar to unlock heroes.'),
    ).toBeDefined();
  });

  it('shows hero names when heroes are provided', () => {
    const heroes = [
      makeHero({ name: 'Barbarian King', level: 10 }),
      makeHero({ name: 'Archer Queen', level: 20 }),
    ];
    renderPanel({ heroes, townHallLevel: 9 });

    expect(screen.getByText('Barbarian King')).toBeDefined();
    expect(screen.getByText('Archer Queen')).toBeDefined();
  });

  it('displays hero level text', () => {
    const heroes = [makeHero({ name: 'Barbarian King', level: 15 })];
    renderPanel({ heroes, townHallLevel: 7 });

    expect(screen.getByText('Level 15')).toBeDefined();
  });

  it('shows "Available" status for a healthy, non-upgrading hero', () => {
    const heroes = [makeHero({ isRecovering: false, isUpgrading: false })];
    renderPanel({ heroes, townHallLevel: 7 });

    expect(screen.getByText('Available')).toBeDefined();
  });
});
