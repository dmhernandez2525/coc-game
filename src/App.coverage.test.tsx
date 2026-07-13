import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleResult } from './types/battle';
import type { VillageState } from './types/village';
import { createStarterVillage } from './engine/village-manager';

const runtime = vi.hoisted(() => ({ loadState: null as VillageState | null }));

vi.mock('./hooks/useAutoSave', () => ({ loadAutoSave: () => runtime.loadState }));
vi.mock('./components/MenuScreen', () => ({
  MenuScreen: ({ onNavigate }: { onNavigate: (screen: string) => void }) => (
    <div>
      <button onClick={() => onNavigate('village')}>OPEN VILLAGE</button>
      <button onClick={() => onNavigate('campaign')}>OPEN CAMPAIGN</button>
      <button onClick={() => onNavigate('load')}>OPEN LOAD</button>
    </div>
  ),
}));
vi.mock('./components/VillageScreen', () => ({
  VillageScreen: ({ onNavigate, externalState }: { onNavigate: (screen: string) => void; externalState: VillageState }) => (
    <div>
      <span>VILLAGE {externalState.resources.gold}</span>
      <button onClick={() => onNavigate('battle')}>OPEN BATTLE</button>
      <button onClick={() => onNavigate('campaign')}>VILLAGE CAMPAIGN</button>
      <button onClick={() => onNavigate('menu')}>VILLAGE MENU</button>
    </div>
  ),
}));
vi.mock('./components/BattleScreen', () => ({
  BattleScreen: ({ onNavigate, onBattleComplete, enemyBase, warMode }: {
    onNavigate: (screen: string) => void;
    onBattleComplete: (result: BattleResult) => void;
    enemyBase?: { id: string };
    warMode?: boolean;
  }) => (
    <div>
      <span>{warMode ? `WAR ${enemyBase?.id}` : 'RAID'}</span>
      <button onClick={() => onBattleComplete({
        stars: 2, destructionPercent: 75,
        loot: { gold: 100, elixir: 200, darkElixir: 3 }, trophyChange: 10,
        timeUsed: 30, heroesDeployed: [],
      })}>COMPLETE BATTLE</button>
      <button onClick={() => onNavigate('village')}>LEAVE BATTLE</button>
    </div>
  ),
}));
vi.mock('./components/CampaignScreen', () => ({
  CampaignScreen: ({ onNavigate, onCampaignComplete }: {
    onNavigate: (screen: string) => void;
    onCampaignComplete: (level: number, stars: number, loot: BattleResult['loot'] | null) => void;
  }) => (
    <div>
      <button onClick={() => onCampaignComplete(1, 1, { gold: 10, elixir: 20, darkElixir: 1 })}>NEW CAMPAIGN WIN</button>
      <button onClick={() => onCampaignComplete(1, 0, null)}>REPEAT CAMPAIGN</button>
      <button onClick={() => onNavigate('village')}>LEAVE CAMPAIGN</button>
    </div>
  ),
}));
vi.mock('./components/LoadGameScreen', () => ({
  LoadGameScreen: ({ onNavigate, onLoadGame }: {
    onNavigate: (screen: string) => void;
    onLoadGame: (state: VillageState) => void;
  }) => (
    <div>
      <button onClick={() => onLoadGame(createStarterVillage())}>RESTORE</button>
      <button onClick={() => onNavigate('menu')}>LEAVE LOAD</button>
    </div>
  ),
}));

import App from './App';

beforeEach(() => {
  runtime.loadState = null;
});

describe('App screen orchestration', () => {
  it('navigates all screens and settles campaign and multiplayer results', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'OPEN CAMPAIGN' }));
    fireEvent.click(screen.getByRole('button', { name: 'NEW CAMPAIGN WIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'REPEAT CAMPAIGN' }));
    fireEvent.click(screen.getByRole('button', { name: 'LEAVE CAMPAIGN' }));
    expect(screen.getByText(/VILLAGE 510/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'OPEN BATTLE' }));
    expect(screen.getByText('RAID')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETE BATTLE' }));
    fireEvent.click(screen.getByRole('button', { name: 'LEAVE BATTLE' }));
    fireEvent.click(screen.getByRole('button', { name: 'VILLAGE MENU' }));
    fireEvent.click(screen.getByRole('button', { name: 'OPEN LOAD' }));
    fireEvent.click(screen.getByRole('button', { name: 'RESTORE' }));
    fireEvent.click(screen.getByRole('button', { name: 'LEAVE LOAD' }));
    expect(screen.getByRole('button', { name: 'OPEN VILLAGE' })).toBeTruthy();
  });

  it('drops an autosaved stale pending attack when it leaves the battle route', () => {
    const saved = createStarterVillage();
    saved.pendingWarAttack = { defenderIndex: 0 };
    runtime.loadState = saved;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'OPEN VILLAGE' }));
    expect(screen.getByText('VILLAGE 500')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'VILLAGE CAMPAIGN' }));
    expect(screen.getByRole('button', { name: 'NEW CAMPAIGN WIN' })).toBeTruthy();
  });
});
