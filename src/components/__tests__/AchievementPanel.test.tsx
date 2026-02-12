// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AchievementPanel } from '../AchievementPanel';
import type { AchievementProgress } from '../../engine/achievement-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  progress: [] as AchievementProgress[],
  onClaimReward: vi.fn(),
  onClose: vi.fn(),
};

function renderPanel(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<AchievementPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AchievementPanel', () => {
  it('renders without crashing', () => {
    renderPanel();
    expect(screen.getByText('Achievements')).toBeDefined();
  });

  it('shows the correct header text', () => {
    renderPanel();
    const header = screen.getByText('Achievements');
    expect(header.tagName).toBe('H3');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const closeBtn = screen.getByLabelText('Close achievements');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows category tabs', () => {
    renderPanel();
    for (const label of ['All', 'Combat', 'Resource', 'Building', 'Campaign']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
  });

  it('shows achievement names from the ACHIEVEMENTS list', () => {
    // Even with no progress, the panel should render all achievement cards
    renderPanel();
    expect(screen.getByText('Sweet Victory')).toBeDefined();
    expect(screen.getByText('Empire Builder')).toBeDefined();
    expect(screen.getByText('Gold Grab')).toBeDefined();
  });

  it('filters achievements when a category tab is clicked', () => {
    renderPanel();

    // Click the "Combat" tab
    const combatTab = screen.getByRole('button', { name: 'Combat' });
    fireEvent.click(combatTab);

    // "Sweet Victory" is a combat achievement, should be visible
    expect(screen.getByText('Sweet Victory')).toBeDefined();
    // "Empire Builder" is a building achievement, should not appear
    expect(screen.queryByText('Empire Builder')).toBeNull();
  });

  it('shows a Claim button when a tier has been reached but not claimed', () => {
    // sweet_victory tier 1 requires 75 trophies
    const progress: AchievementProgress[] = [
      { achievementId: 'sweet_victory', currentValue: 100, claimedTier: 0 },
    ];
    renderPanel({ progress });

    const claimButtons = screen.getAllByRole('button', { name: 'Claim' });
    expect(claimButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClaimReward with the correct achievement ID when Claim is clicked', () => {
    const onClaimReward = vi.fn();
    const progress: AchievementProgress[] = [
      { achievementId: 'sweet_victory', currentValue: 100, claimedTier: 0 },
    ];
    renderPanel({ progress, onClaimReward });

    // Find the "Claim" button inside the Sweet Victory card
    const sweetVictoryCard = screen.getByText('Sweet Victory').closest('div')!;
    const claimButton = sweetVictoryCard.querySelector('button');
    // The claimable button may not be in the exact same parent div, so use getAllByRole
    const claimButtons = screen.getAllByRole('button', { name: 'Claim' });
    fireEvent.click(claimButtons[0]);

    expect(onClaimReward).toHaveBeenCalledWith('sweet_victory');
  });
});
