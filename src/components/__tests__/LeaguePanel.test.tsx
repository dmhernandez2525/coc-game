// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeaguePanel } from '../LeaguePanel';
import { STAR_BONUS_STARS_REQUIRED } from '../../engine/trophy-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  league: 'Gold III',
  trophies: 1450,
  starBonusStars: 0,
  treasury: { gold: 0, elixir: 0, darkElixir: 0 },
  treasuryCapacity: { gold: 2000000, elixir: 2000000, darkElixir: 10000 },
  onClaimStarBonus: vi.fn(),
  onCollectTreasury: vi.fn(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<LeaguePanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LeaguePanel', () => {
  it('renders without crashing', () => {
    renderPanel();
    expect(screen.getByText('League')).toBeDefined();
  });

  it('shows the current league and trophies', () => {
    renderPanel();
    // The league name appears in the summary card and the ladder
    expect(screen.getAllByText('Gold III').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('1,450 trophies')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByLabelText('Close league'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows star bonus progress', () => {
    renderPanel({ starBonusStars: 3 });
    expect(screen.getByText(`3 / ${STAR_BONUS_STARS_REQUIRED} stars`)).toBeDefined();
  });

  it('disables the star bonus claim until enough stars are earned', () => {
    const onClaimStarBonus = vi.fn();
    renderPanel({ starBonusStars: 2, onClaimStarBonus });
    const button = screen.getByText('Earn stars in battle');
    fireEvent.click(button);
    expect(onClaimStarBonus).not.toHaveBeenCalled();
  });

  it('claims the star bonus when ready', () => {
    const onClaimStarBonus = vi.fn();
    renderPanel({ starBonusStars: STAR_BONUS_STARS_REQUIRED, onClaimStarBonus });
    fireEvent.click(screen.getByText('Claim to Treasury'));
    expect(onClaimStarBonus).toHaveBeenCalledTimes(1);
  });

  it('disables treasury collection when empty', () => {
    const onCollectTreasury = vi.fn();
    renderPanel({ onCollectTreasury });
    fireEvent.click(screen.getByText('Collect'));
    expect(onCollectTreasury).not.toHaveBeenCalled();
  });

  it('collects the treasury when it holds loot', () => {
    const onCollectTreasury = vi.fn();
    renderPanel({
      treasury: { gold: 5000, elixir: 100, darkElixir: 0 },
      onCollectTreasury,
    });
    fireEvent.click(screen.getByText('Collect'));
    expect(onCollectTreasury).toHaveBeenCalledTimes(1);
  });

  it('lists every league tier', () => {
    renderPanel();
    expect(screen.getByText('Bronze III')).toBeDefined();
    expect(screen.getByText('Legend')).toBeDefined();
  });
});
