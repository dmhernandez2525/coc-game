import { fireEvent, render, screen } from '@testing-library/react';
import { LabPanel } from '../LabPanel.tsx';
import { getTroop } from '../../data/loaders/troop-loader.ts';

const resources = { gold: 20_000_000, elixir: 20_000_000, darkElixir: 500_000, gems: 0 };

describe('LabPanel', () => {
  it('starts available research and disables the list while a persisted job runs', () => {
    const onResearch = vi.fn();
    const barbarian = getTroop('Barbarian')!;
    const { rerender } = render(
      <LabPanel labLevel={12} troops={[barbarian]} troopLevels={{ Barbarian: 1 }}
        resources={resources} activeResearch={null} onResearch={onResearch} onClose={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Research' }));
    expect(onResearch).toHaveBeenCalledWith('Barbarian');

    rerender(
      <LabPanel labLevel={12} troops={[barbarian]} troopLevels={{ Barbarian: 1 }} resources={resources}
        activeResearch={{ troopName: 'Barbarian', fromLevel: 1, targetLevel: 2, resource: 'elixir', cost: 1000, totalTimeSeconds: 100, remainingTimeSeconds: 60 }}
        onResearch={onResearch} onClose={() => undefined} />,
    );
    expect(screen.getByText(/Researching Barbarian to Level 2/)).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    expect((screen.getByRole('button', { name: 'Researching' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
