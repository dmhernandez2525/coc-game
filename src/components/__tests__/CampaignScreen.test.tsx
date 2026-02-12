// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CampaignScreen } from '../CampaignScreen';
import type { CampaignProgress, TrainedTroop } from '../../types/village.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProgress(overrides?: Partial<CampaignProgress>): CampaignProgress {
  return {
    levels: [],
    totalStars: 0,
    ...overrides,
  };
}

const defaultProps = {
  onNavigate: vi.fn(),
  campaignProgress: makeProgress(),
  army: [] as TrainedTroop[],
  onCampaignComplete: vi.fn(),
};

function renderScreen(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(<CampaignScreen {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CampaignScreen', () => {
  it('renders the Campaign header', () => {
    renderScreen();
    expect(screen.getByText('Campaign')).toBeDefined();
  });

  it('shows the Back to Village button', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'Back to Village' })).toBeDefined();
  });

  it('calls onNavigate with "village" when Back to Village is clicked', () => {
    const onNavigate = vi.fn();
    renderScreen({ onNavigate });

    const backBtn = screen.getByRole('button', { name: 'Back to Village' });
    fireEvent.click(backBtn);

    expect(onNavigate).toHaveBeenCalledWith('village');
  });

  it('shows a warning when the army is empty', () => {
    renderScreen({ army: [] });
    expect(
      screen.getByText(
        'No troops trained! Go back to your village and train an army before attacking.',
      ),
    ).toBeDefined();
  });

  it('does not show the empty-army warning when troops are present', () => {
    const army: TrainedTroop[] = [{ name: 'Barbarian', level: 1, count: 10 }];
    renderScreen({ army });

    expect(
      screen.queryByText(
        'No troops trained! Go back to your village and train an army before attacking.',
      ),
    ).toBeNull();
  });

  it('shows the first level as clickable (enabled)', () => {
    renderScreen();

    // The first campaign level button should not be disabled
    const buttons = screen.getAllByRole('button');
    // Find a button that contains "1." (the first level card)
    const firstLevelBtn = buttons.find(
      (btn) => btn.textContent?.includes('1.'),
    );
    expect(firstLevelBtn).toBeDefined();
    expect(firstLevelBtn).toHaveProperty('disabled', false);
  });

  it('displays total stars out of 270', () => {
    const progress = makeProgress({ totalStars: 7 });
    renderScreen({ campaignProgress: progress });

    // The header shows "totalStars / 270" with a star character
    // Use a specific pattern that matches only the header span
    expect(screen.getByText(/7\s*\/\s*270/)).toBeDefined();
  });

  it('shows the army composition when troops are present', () => {
    const army: TrainedTroop[] = [
      { name: 'Barbarian', level: 1, count: 20 },
      { name: 'Archer', level: 1, count: 15 },
    ];
    renderScreen({ army });

    expect(screen.getByText(/Barbarian x20/)).toBeDefined();
    expect(screen.getByText(/Archer x15/)).toBeDefined();
  });
});
