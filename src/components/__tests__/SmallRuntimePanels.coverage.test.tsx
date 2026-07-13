import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllTroops } from '../../data/loaders/troop-loader';
import { getAllSiegeMachines } from '../../engine/siege-manager';
import { createClan } from '../../engine/clan-manager';
import { createSaveManager } from '../../engine/save-manager';
import { createStarterVillage } from '../../engine/village-manager';
import type { OwnedHero } from '../../types/village';
import { ArmyPanel } from '../ArmyPanel';
import { ClanPanel } from '../ClanPanel';
import { EquipmentPanel } from '../EquipmentPanel';
import { GemShopPanel } from '../GemShopPanel';
import { HUD } from '../HUD';
import { LayoutPresetsPanel } from '../LayoutPresetsPanel';
import { LoadGameScreen } from '../LoadGameScreen';
import { MenuScreen } from '../MenuScreen';
import { NotificationToasts } from '../NotificationToasts';
import { PetPanel } from '../PetPanel';
import { SaveLoadPanel } from '../SaveLoadPanel';
import { SettingsPanel } from '../SettingsPanel';

const hero: OwnedHero = {
  name: 'Barbarian King', level: 50, currentHp: 1000, isRecovering: false,
  recoveryTimeRemaining: 0, isUpgrading: false, upgradeTimeRemaining: 0,
  equippedItems: [null, null], assignedPet: null,
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('small runtime panels', () => {
  it('operates army and siege controls in unlocked, locked, empty, and full states', () => {
    const train = vi.fn();
    const remove = vi.fn();
    const trainSiege = vi.fn();
    const removeSiege = vi.fn();
    const close = vi.fn();
    const troops = getAllTroops().slice(0, 2);
    const sieges = getAllSiegeMachines().slice(0, 2);
    const { rerender } = render(
      <ArmyPanel army={[{ name: troops[0].name, level: 1, count: 2 }]} availableTroops={troops}
        lockedTroops={[{ name: 'Locked', housingSpace: 3, unlockHint: 'Town Hall 9' }]}
        housingUsed={2} housingMax={100} resources={{ gold: 1e9, elixir: 1e9, darkElixir: 1e9, gems: 1e9 }}
        siegeMachines={[{ name: sieges[0].name, level: 1, count: 1 }]} availableSieges={sieges}
        siegeCapacityUsed={1} siegeCapacityMax={5} onTrain={train} onRemove={remove}
        onTrainSiege={trainSiege} onRemoveSiege={removeSiege} onClose={close} />,
    );
    fireEvent.click(screen.getByRole('button', { name: `Remove ${troops[0].name}` }));
    fireEvent.click(screen.getByRole('button', { name: `Train ${troops[0].name}` }));
    fireEvent.click(screen.getByRole('button', { name: `Remove ${sieges[0].name}` }));
    fireEvent.click(screen.getByRole('button', { name: `Train ${sieges[0].name}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect([remove, train, removeSiege, trainSiege, close].every(mock => mock.mock.calls.length > 0)).toBe(true);
    rerender(
      <ArmyPanel army={[]} availableTroops={troops} housingUsed={0} housingMax={0}
        resources={{ gold: 0, elixir: 0, darkElixir: 0, gems: 0 }} siegeUnlockHint="Requires Workshop"
        onTrain={train} onRemove={remove} onTrainSiege={trainSiege} onRemoveSiege={removeSiege} onClose={close} />,
    );
    expect(screen.getByText('No troops trained yet.')).toBeTruthy();
    expect(screen.getByText('Requires Workshop')).toBeTruthy();
  });

  it('creates a clan and operates troop requests and removals across TH gates', () => {
    const create = vi.fn();
    const request = vi.fn();
    const remove = vi.fn();
    const close = vi.fn();
    const { rerender } = render(
      <ClanPanel clan={null} townHallLevel={1} onCreateClan={create} onRequestTroops={request}
        onRemoveCastleTroop={remove} onClose={close} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Clan name'), { target: { value: '  Coders  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(create).toHaveBeenCalledWith('Coders');
    const clan = createClan('Coders');
    clan.level = 10;
    clan.xp = 100;
    clan.castleTroops = [{ name: 'Archer', level: 1, count: 1 }];
    rerender(
      <ClanPanel clan={clan} townHallLevel={15} onCreateClan={create} onRequestTroops={request}
        onRemoveCastleTroop={remove} onClose={close} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request Troops' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Archer from castle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(request).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('Archer');
  });

  it('renders equipment and pet gates and invokes available actions', () => {
    const equip = vi.fn();
    const unequip = vi.fn();
    const upgradeEquipment = vi.fn();
    const close = vi.fn();
    const { unmount } = render(
      <EquipmentPanel hero={hero} ownedEquipment={[]} ores={{ shinyOre: 1e9, glowyOre: 1e9, starryOre: 1e9 }}
        blacksmithLevel={10} onEquip={equip} onUnequip={unequip}
        onUpgradeEquipment={upgradeEquipment} onClose={close} />,
    );
    const equipButton = screen.getAllByRole('button', { name: /Equip .* to slot/ }).find(button => !button.hasAttribute('disabled'));
    const upgradeButton = screen.getAllByRole('button', { name: /Upgrade/ }).find(button => !button.hasAttribute('disabled'));
    if (equipButton) fireEvent.click(equipButton);
    if (upgradeButton) fireEvent.click(upgradeButton);
    fireEvent.click(screen.getByRole('button', { name: 'Close equipment panel' }));
    expect(equip).toHaveBeenCalled();
    unmount();

    const assign = vi.fn();
    const unassign = vi.fn();
    const upgradePet = vi.fn();
    render(
      <PetPanel hero={hero} allHeroes={[hero]} ownedPets={[]} townHallLevel={16} petHouseLevel={11}
        darkElixir={1e9} onAssign={assign} onUnassign={unassign} onUpgradePet={upgradePet} onClose={close} />,
    );
    const assignButton = screen.getAllByRole('button', { name: /Assign/ }).find(button => !button.hasAttribute('disabled'));
    const petUpgrade = screen.getAllByRole('button', { name: /Upgrade/ }).find(button => !button.hasAttribute('disabled'));
    if (assignButton) fireEvent.click(assignButton);
    if (petUpgrade) fireEvent.click(petUpgrade);
    fireEvent.click(screen.getByRole('button', { name: 'Close pet panel' }));
    expect(assign).toHaveBeenCalled();
    expect(upgradePet).toHaveBeenCalled();
  });

  it('operates HUD, gem purchases, notifications, and top-level menu navigation', () => {
    const collect = vi.fn();
    const league = vi.fn();
    const { unmount } = render(
      <HUD resources={{ gold: 100, elixir: 200, darkElixir: 300, gems: 400 }}
        storageCaps={{ gold: 100, elixir: 1000, darkElixir: 1000, gems: Infinity }}
        builders={{ idle: 1, total: 2 }} townHallLevel={15} trophies={1234} league="Gold"
        onOpenLeague={league} onCollectAll={collect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /League/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Collect All' }));
    expect(league).toHaveBeenCalled();
    expect(collect).toHaveBeenCalled();
    unmount();

    const buy = vi.fn();
    const close = vi.fn();
    const shop = render(<GemShopPanel gems={50} onBuyResources={buy} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: /Buy 10,000 Gold/ }));
    expect(screen.getByText('Purchased!')).toBeTruthy();
    vi.advanceTimersByTime(800);
    fireEvent.click(screen.getByRole('button', { name: 'Close gem shop' }));
    expect(buy).toHaveBeenCalledWith('gold', 10_000, 10);
    shop.unmount();

    const dismiss = vi.fn();
    const toasts = render(<NotificationToasts notifications={[
      { id: 'a', kind: 'success', message: 'Success', remainingMs: 50, totalMs: 100 },
      { id: 'b', kind: 'info', message: 'Info', remainingMs: 0, totalMs: 0 },
      { id: 'c', kind: 'warning', message: 'Warning', remainingMs: 50, totalMs: 100 },
      { id: 'd', kind: 'error', message: 'Error', remainingMs: 50, totalMs: 100 },
    ]} onDismiss={dismiss} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]);
    expect(dismiss).toHaveBeenCalledWith('a');
    toasts.unmount();

    const navigate = vi.fn();
    render(<MenuScreen onNavigate={navigate} />);
    for (const name of ['Play', 'Campaign', 'Load Game']) fireEvent.click(screen.getByRole('button', { name }));
    expect(navigate.mock.calls.map(call => call[0])).toEqual(['village', 'campaign', 'load']);
  });

  it('saves, loads, deletes, resets, and switches layout/settings controls', () => {
    const save = vi.fn();
    const load = vi.fn();
    const remove = vi.fn();
    const close = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const slots = [{ id: 'slot1', name: 'Village', timestamp: 1, townHallLevel: 2 }];
    const { unmount } = render(
      <SaveLoadPanel slots={slots} onSave={save} onLoad={load} onDelete={remove} onClose={close} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quick Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close save load panel' }));
    expect(save).toHaveBeenCalledWith('slot1');
    expect(load).toHaveBeenCalledWith('slot1');
    expect(remove).toHaveBeenCalledWith('slot1');
    unmount();

    const changeSpeed = vi.fn();
    const reset = vi.fn();
    const settings = render(<SettingsPanel gameSpeed={1} onChangeSpeed={changeSpeed} onResetProgress={reset} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: '10x' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(changeSpeed).toHaveBeenCalledWith(10);
    expect(reset).toHaveBeenCalled();
    settings.unmount();

    const presets = [{ id: 'layout-1', name: 'Home', timestamp: 1, townHallLevel: 2 }];
    const layout = render(<LayoutPresetsPanel presets={presets} onSave={save} onLoad={load} onDelete={remove} onClose={close} />);
    fireEvent.change(screen.getByPlaceholderText('Layout name'), { target: { value: 'War' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close layout presets' }));
    expect(save).toHaveBeenCalledWith('War');
    layout.unmount();
  });

  it('loads and deletes persisted villages from LoadGameScreen', () => {
    const manager = createSaveManager();
    manager.save(createStarterVillage(), 'slot1');
    const navigate = vi.fn();
    const loaded = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LoadGameScreen onNavigate={navigate} onLoadGame={loaded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(loaded).toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(navigate).toHaveBeenCalledWith('village');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Menu' }));
    expect(navigate).toHaveBeenCalledWith('menu');
  });
});
