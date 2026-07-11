// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClanWarPanel } from '../ClanWarPanel';
import type { WarState } from '../../engine/clan-war-manager.ts';
import { getSelectableWarBases } from '../../engine/clan-war-manager.ts';
import { createWarLeagueState } from '../../engine/war-league-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMember(name: string, thLevel: number) {
  return {
    name,
    townHallLevel: thLevel,
    attacksRemaining: 2,
    bestAttackStars: 0,
    bestAttackDestruction: 0,
  };
}

function makeWarState(overrides?: Partial<WarState>): WarState {
  return {
    phase: 'preparation',
    playerClan: {
      name: 'Test Clan',
      members: [makeMember('Player 1', 8), makeMember('Player 2', 7)],
      totalStars: 0,
      totalDestruction: 0,
    },
    enemyClan: {
      name: 'Goblin Horde',
      members: [makeMember('Enemy 1', 8), makeMember('Enemy 2', 7)],
      totalStars: 0,
      totalDestruction: 0,
    },
    warSize: 5,
    preparationTimeRemaining: 86400,
    battleTimeRemaining: 86400,
    ...overrides,
  };
}

const defaultProps = {
  war: null as WarState | null,
  clanName: 'Test Clan' as string | null,
  townHallLevel: 8,
  warLeague: createWarLeagueState(),
  availableWarBases: getSelectableWarBases(8),
  onStartWar: vi.fn(),
  onSelectWarBase: vi.fn(),
  onAttack: vi.fn(),
  onEndWar: vi.fn(),
  onStartNewWar: vi.fn(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<ClanWarPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClanWarPanel', () => {
  it('renders the Clan War header', () => {
    renderPanel();
    expect(screen.getByText('Clan War')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const closeBtn = screen.getByLabelText('Close clan war');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "Join a clan" message when clanName is null', () => {
    renderPanel({ clanName: null });
    expect(screen.getByText('Join a clan to participate in Clan Wars.')).toBeDefined();
  });

  it('shows Start War button when there is a clan but no active war', () => {
    renderPanel({ clanName: 'Test Clan', war: null });
    expect(screen.getByRole('button', { name: 'Start War' })).toBeDefined();
  });

  it('calls onStartWar with the selected war size when Start War is clicked', () => {
    const onStartWar = vi.fn();
    renderPanel({ clanName: 'Test Clan', war: null, onStartWar });

    const startBtn = screen.getByRole('button', { name: 'Start War' });
    fireEvent.click(startBtn);

    // Default selection is the first war size (5)
    expect(onStartWar).toHaveBeenCalledWith(5);
  });

  it('shows preparation phase info when war is in preparation', () => {
    const war = makeWarState({ phase: 'preparation' });
    renderPanel({ war });

    expect(screen.getByText('Preparation Day')).toBeDefined();
  });

  it('shows End War button during battle phase', () => {
    const war = makeWarState({ phase: 'battle' });
    renderPanel({ war });

    expect(screen.getByRole('button', { name: 'End War' })).toBeDefined();
  });

  it('shows VS text on the scoreboard when war is active', () => {
    const war = makeWarState({ phase: 'battle' });
    renderPanel({ war });

    expect(screen.getByText('VS')).toBeDefined();
  });

  it('shows the war league badge for a clan', () => {
    renderPanel();
    expect(screen.getByText('War League')).toBeDefined();
    expect(screen.getByText('Bronze League III')).toBeDefined();
  });

  it('offers war base selection during preparation', () => {
    const war = makeWarState({ phase: 'preparation' });
    renderPanel({ war });

    expect(screen.getByText('War Base')).toBeDefined();
    expect(screen.getByText('No war base selected. Pick a layout before battle day.')).toBeDefined();
  });

  it('calls onSelectWarBase when a layout is chosen', () => {
    const onSelectWarBase = vi.fn();
    const war = makeWarState({ phase: 'preparation' });
    renderPanel({ war, onSelectWarBase });

    const baseId = defaultProps.availableWarBases[0]!.id;
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: baseId } });

    expect(onSelectWarBase).toHaveBeenCalledWith(baseId);
  });

  it('shows the defense rating once a war base is selected', () => {
    const war = makeWarState({
      phase: 'preparation',
      playerWarBaseId: defaultProps.availableWarBases[0]!.id,
    });
    renderPanel({ war });

    expect(screen.getByText(/Defense rating \d+%/)).toBeDefined();
  });

  it('calls onAttack with the defender index when an enemy base is tapped', () => {
    const onAttack = vi.fn();
    const war = makeWarState({ phase: 'battle' });
    renderPanel({ war, onAttack });

    fireEvent.click(screen.getByText('Enemy 2'));

    expect(onAttack).toHaveBeenCalledWith(1);
  });

  it('shows the persisted result and a Start New War button when ended', () => {
    const onStartNewWar = vi.fn();
    const war = makeWarState({
      phase: 'ended',
      result: 'victory',
      lootAwarded: { gold: 123000, elixir: 45000, darkElixir: 0 },
    });
    renderPanel({ war, onStartNewWar });

    expect(screen.getByText('Victory')).toBeDefined();
    expect(screen.getByText('123,000')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Start New War' }));
    expect(onStartNewWar).toHaveBeenCalledTimes(1);
  });
});
