import { fireEvent, render, screen } from '@testing-library/react';
import { BuildingPanel } from '../BuildingPanel.tsx';
import type { PlacedBuilding } from '../../types/village.ts';

function building(buildingId: string, ammo: number, maxAmmo: number): PlacedBuilding {
  return {
    instanceId: 'defense', buildingId, buildingType: 'defense', level: 1,
    gridX: 1, gridY: 2, isUpgrading: false, upgradeTimeRemaining: 0, assignedBuilder: null,
    ammo, maxAmmo,
  };
}

describe('BuildingPanel ammunition UI', () => {
  it('shows and invokes a free Scattershot reload', () => {
    const onReloadAmmo = vi.fn();
    render(<BuildingPanel building={building('Scattershot', 12, 90)} onUpgrade={() => undefined}
      onMove={() => undefined} onRemove={() => undefined} onClose={() => undefined}
      canUpgrade={false} upgradeCost={null} onReloadAmmo={onReloadAmmo} canReloadAmmo />);
    expect(screen.getByText('12 / 90')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reload (Free)' }));
    expect(onReloadAmmo).toHaveBeenCalledOnce();
  });

  it('keeps X-Bow targeting and disables reload when full', () => {
    render(<BuildingPanel building={building('X-Bow', 1000, 1000)} onUpgrade={() => undefined}
      onMove={() => undefined} onRemove={() => undefined} onClose={() => undefined}
      canUpgrade={false} upgradeCost={null} onToggleXBowMode={() => undefined}
      onReloadAmmo={() => undefined} canReloadAmmo={false} />);
    expect(screen.getByRole('button', { name: /Ground & Air/ })).toBeDefined();
    expect((screen.getByRole('button', { name: /Reload, 10,000 Elixir/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
