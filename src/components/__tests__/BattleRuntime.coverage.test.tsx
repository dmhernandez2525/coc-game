import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleResult, BattleState } from '../../types/battle';
import { createStarterVillage } from '../../engine/village-manager';
import { npcBases } from '../../data/npc-bases';
import { BattleHUD } from '../BattleHUD';
import { BattleResultScreen } from '../BattleResultScreen';
import { BattleScreen } from '../BattleScreen';

function createContext(): CanvasRenderingContext2D {
  const target: Record<PropertyKey, unknown> = {};
  return new Proxy(target, {
    get(object, property) {
      if (!(property in object)) object[property] = vi.fn();
      return object[property];
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const ctx = createContext();

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600,
    toJSON: () => ({}),
  });
});

afterEach(() => vi.useRealTimers());

describe('Battle runtime screens', () => {
  it('deploys troops, spells, a hero, clan troops, and siege support before surrendering', () => {
    const village = createStarterVillage();
    village.townHallLevel = 15;
    village.army = [{ name: 'Barbarian', level: 1, count: 3 }];
    village.spells = [{ name: 'Healing Spell', level: 1, count: 2 }];
    village.heroes = [{
      name: 'Barbarian King', level: 10, currentHp: 500, isRecovering: false,
      recoveryTimeRemaining: 0, isUpgrading: false, upgradeTimeRemaining: 0,
      equippedItems: [null, null], assignedPet: 'L.A.S.S.I',
    }];
    village.ownedPets = [{ name: 'L.A.S.S.I', level: 2 }];
    village.clan = { name: 'TEST', level: 1, xp: 0, badgeIndex: 0, castleTroops: [{ name: 'Archer', level: 1, count: 2 }] };
    village.siegeMachines = [{ name: 'Wall Wrecker', level: 1, count: 1 }];
    village.magicItems = { power_potion: 1, hero_potion: 1 };
    village.activePotions = [
      { itemId: 'power_potion', remainingMs: 1000 },
      { itemId: 'hero_potion', remainingMs: 1000 },
    ];
    const onNavigate = vi.fn();
    const onBattleComplete = vi.fn();
    const { container } = render(
      <BattleScreen onNavigate={onNavigate} externalState={village} enemyBase={npcBases[0]}
        onBattleComplete={onBattleComplete} />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.click(screen.getByRole('button', { name: /^Barbarianx3$/ }));
    fireEvent.click(canvas, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Healing Spell/ }));
    fireEvent.click(canvas, { clientX: 40, clientY: 40 });
    fireEvent.click(screen.getByRole('button', { name: /Barbarian King/ }));
    fireEvent.click(canvas, { clientX: 60, clientY: 60 });
    fireEvent.click(screen.getByRole('button', { name: /Clan Castle/ }));
    fireEvent.click(canvas, { clientX: 80, clientY: 80 });
    fireEvent.click(screen.getByRole('button', { name: /Wall Wrecker/ }));
    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(100);
    fireEvent.click(screen.getByRole('button', { name: 'Surrender' }));
    expect(screen.getByText(/Defeat|Victory!/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return Home' }));
    expect(onBattleComplete).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('village');
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('renders war mode with zero trophy offer and returns without a completion callback', () => {
    const village = createStarterVillage();
    village.army = [];
    village.spells = [];
    const onNavigate = vi.fn();
    render(<BattleScreen onNavigate={onNavigate} externalState={village} enemyBase={npcBases[0]} warMode />);
    expect(screen.getByText('No troops or spells available')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Surrender' }));
    expect(screen.getByText('+0 Trophies')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return Home' }));
    expect(onNavigate).toHaveBeenCalledWith('village');
  });

  it('renders HUD selection states and both victory and defeat result variants', () => {
    const baseState = {
      timeRemaining: 125, destructionPercent: 75, stars: 2,
      loot: { gold: 1000, elixir: 2000, darkElixir: 100 },
      availableTroops: [{ name: 'Barbarian', level: 1, count: 1 }, { name: 'Archer', level: 1, count: 0 }],
      availableSpells: [{ name: 'Healing Spell', level: 1, count: 1 }, { name: 'Rage Spell', level: 1, count: 0 }],
    } as BattleState;
    const troop = vi.fn();
    const spell = vi.fn();
    const surrender = vi.fn();
    const { rerender } = render(
      <BattleHUD state={baseState} selectedTroop="Barbarian" selectedSpell={null}
        onDeployTroop={troop} onDeploySpell={spell} onSurrender={surrender} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Barbarian/ }));
    fireEvent.click(screen.getByRole('button', { name: /Healing Spell/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Surrender' }));
    expect(troop).toHaveBeenCalledWith('Barbarian');
    expect(spell).toHaveBeenCalledWith('Healing Spell');
    expect(surrender).toHaveBeenCalled();

    const home = vi.fn();
    const victory: BattleResult = {
      stars: 3, destructionPercent: 100, loot: { gold: 1, elixir: 2, darkElixir: 3 },
      trophyChange: 10, timeUsed: 30,
    };
    rerender(<BattleResultScreen result={victory} onReturnHome={home} />);
    expect(screen.getByText('Victory!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return Home' }));
    const defeat = { ...victory, stars: 0, destructionPercent: 0, trophyChange: -5 };
    rerender(<BattleResultScreen result={defeat} onReturnHome={home} />);
    expect(screen.getByText('Defeat')).toBeTruthy();
  });
});
