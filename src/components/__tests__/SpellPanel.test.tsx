// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpellPanel } from '../SpellPanel';
import type { TrainedTroop, ResourceAmounts } from '../../types/village.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const richResources: ResourceAmounts = {
  gold: 9_999_999,
  elixir: 9_999_999,
  darkElixir: 9_999_999,
  gems: 0,
};

const defaultAvailableSpells = [
  { name: 'Lightning Spell', housingSpace: 1, cost: 15000, costResource: 'Elixir' },
  { name: 'Healing Spell', housingSpace: 2, cost: 20000, costResource: 'Elixir' },
  { name: 'Earthquake Spell', housingSpace: 1, cost: 500, costResource: 'Dark Elixir' },
];

const defaultProps = {
  spells: [] as TrainedTroop[],
  availableSpells: defaultAvailableSpells,
  spellCapacityUsed: 0,
  spellCapacityMax: 5,
  resources: richResources,
  onTrainSpell: vi.fn(),
  onRemoveSpell: vi.fn(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<SpellPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpellPanel', () => {
  it('renders the Spells header', () => {
    renderPanel();
    expect(screen.getByText('Spells')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const closeBtn = screen.getByLabelText('Close spells');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the spell capacity text', () => {
    renderPanel({ spellCapacityUsed: 3, spellCapacityMax: 5 });
    expect(screen.getByText('3 / 5')).toBeDefined();
  });

  it('shows available spell names', () => {
    renderPanel();

    expect(screen.getByText('Lightning Spell')).toBeDefined();
    expect(screen.getByText('Healing Spell')).toBeDefined();
    expect(screen.getByText('Earthquake Spell')).toBeDefined();
  });

  it('shows "No spells trained yet." when spells list is empty', () => {
    renderPanel({ spells: [] });
    expect(screen.getByText('No spells trained yet.')).toBeDefined();
  });

  it('shows trained spells with their count', () => {
    const spells: TrainedTroop[] = [
      { name: 'Lightning Spell', level: 1, count: 3 },
    ];
    renderPanel({ spells });

    // "Lightning Spell" appears in both trained and available sections
    const matches = screen.getAllByText('Lightning Spell');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('x3')).toBeDefined();
  });

  it('calls onTrainSpell when the train button for a spell is clicked', () => {
    const onTrainSpell = vi.fn();
    renderPanel({ onTrainSpell });

    const trainBtn = screen.getByLabelText('Train Lightning Spell');
    fireEvent.click(trainBtn);

    expect(onTrainSpell).toHaveBeenCalledWith('Lightning Spell');
  });

  it('disables the train button when capacity is full', () => {
    renderPanel({
      spellCapacityUsed: 5,
      spellCapacityMax: 5,
    });

    const trainBtn = screen.getByLabelText('Train Lightning Spell');
    expect(trainBtn).toHaveProperty('disabled', true);
  });
});
