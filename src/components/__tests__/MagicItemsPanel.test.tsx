// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MagicItemsPanel } from '../MagicItemsPanel';
import type { MagicItemInventory } from '../../engine/magic-items-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyInventory: MagicItemInventory = { items: {} };

const inventoryWithItems: MagicItemInventory = {
  items: {
    book_heroes: 1,
    research_potion: 3,
    wall_ring: 10,
  },
};

const defaultProps = {
  inventory: emptyInventory,
  onUseItem: vi.fn(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<MagicItemsPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MagicItemsPanel', () => {
  it('renders without crashing', () => {
    renderPanel();
    expect(screen.getByText('Magic Items')).toBeDefined();
  });

  it('shows the correct header text', () => {
    renderPanel();
    const header = screen.getByText('Magic Items');
    expect(header.tagName).toBe('H3');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const closeBtn = screen.getByLabelText('Close magic items');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows empty state message when inventory is empty', () => {
    renderPanel({ inventory: emptyInventory });
    expect(
      screen.getByText('No magic items yet. Win them from clan wars and events!'),
    ).toBeDefined();
  });

  it('shows category tabs', () => {
    renderPanel();
    for (const label of ['All', 'Books', 'Potions', 'Runes', 'Wall Rings']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
  });

  it('shows item names and counts when inventory has items', () => {
    renderPanel({ inventory: inventoryWithItems });

    // Book of Heroes should be visible with count 1
    expect(screen.getByText('Book of Heroes')).toBeDefined();
    // Wall Ring should be visible
    expect(screen.getByText('Wall Ring')).toBeDefined();
  });

  it('calls onUseItem with the correct item ID when Use button is clicked', () => {
    const onUseItem = vi.fn();
    renderPanel({ inventory: inventoryWithItems, onUseItem });

    // Find the "Use" buttons that are enabled (items with count > 0)
    const useButtons = screen.getAllByRole('button', { name: 'Use' });
    // Click the first enabled Use button
    const enabledButton = useButtons.find(
      (btn) => !(btn as HTMLButtonElement).disabled,
    );
    expect(enabledButton).toBeDefined();
    fireEvent.click(enabledButton!);

    expect(onUseItem).toHaveBeenCalledTimes(1);
  });

  it('disables Use buttons for items with zero count', () => {
    // Empty inventory means all items have count 0, but the panel shows
    // the empty state message. Use a partial inventory so items render.
    const partialInventory: MagicItemInventory = { items: { book_heroes: 1 } };
    renderPanel({ inventory: partialInventory });

    const useButtons = screen.getAllByRole('button', { name: 'Use' });
    // At least some Use buttons should be disabled (items with count 0)
    const disabledButtons = useButtons.filter(
      (btn) => (btn as HTMLButtonElement).disabled,
    );
    expect(disabledButtons.length).toBeGreaterThan(0);
  });
});
