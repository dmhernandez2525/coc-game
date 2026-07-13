import { fireEvent, render, screen } from '@testing-library/react';
import { DefenseLogPanel } from '../DefenseLogPanel.tsx';

describe('DefenseLogPanel', () => {
  it('renders a persisted raid and starts a manual simulation', () => {
    const onSimulate = vi.fn();
    render(<DefenseLogPanel onSimulate={onSimulate} onClose={() => undefined} entries={[{
      id: 'raid', timestamp: 1, attackerName: 'Raider', attackerTownHallLevel: 10,
      stars: 1, destructionPercent: 42, durationSeconds: 90, trophyChange: 8,
      trapsTriggered: ['Bomb'], lootStolen: { gold: 100, elixir: 50, darkElixir: 0 }, result: 'victory',
    }]} />);
    expect(screen.getByText('Raider')).toBeDefined();
    expect(screen.getByText(/42%/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Incoming Raid' }));
    expect(onSimulate).toHaveBeenCalledOnce();
  });
});
