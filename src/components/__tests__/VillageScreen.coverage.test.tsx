import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClan } from '../../engine/clan-manager';
import { createStatistics } from '../../engine/statistics-tracker';
import { createStarterVillage } from '../../engine/village-manager';
import type { VillageState } from '../../types/village';

type MockProps = Record<string, unknown>;

function invoke(props: MockProps, name: string, ...args: unknown[]) {
  const callback = props[name];
  if (typeof callback === 'function') {
    (callback as (...values: unknown[]) => unknown)(...args);
  }
}

function getArray<T>(props: MockProps, name: string): T[] {
  return Array.isArray(props[name]) ? props[name] as T[] : [];
}

function CloseButton({ props }: { props: MockProps }) {
  return <button onClick={() => invoke(props, 'onClose')}>CLOSE PANEL</button>;
}

vi.mock('../../hooks/useAutoSave', () => ({ useAutoSave: vi.fn() }));

vi.mock('../NotificationToasts', () => ({
  NotificationToasts: (props: MockProps) => {
    const notifications = getArray<{ id: string; message: string }>(props, 'notifications');
    return notifications.length > 0 ? (
      <button onClick={() => invoke(props, 'onDismiss', notifications[0].id)}>
        DISMISS {notifications[0].message}
      </button>
    ) : null;
  },
}));

vi.mock('../VillageGrid', () => ({
  VillageGrid: (props: MockProps) => {
    const state = props.state as VillageState;
    const townHall = state.buildings.find((building) => building.buildingId === 'Town Hall');
    const collector = state.buildings.find((building) => building.buildingType === 'resource_collector');
    const defense = state.buildings.find((building) => building.buildingType === 'defense');
    return (
      <div>
        <button onClick={() => townHall && invoke(props, 'onBuildingClick', townHall.instanceId)}>SELECT TOWN HALL</button>
        <button onClick={() => collector && invoke(props, 'onBuildingClick', collector.instanceId)}>COLLECT BUILDING</button>
        <button onClick={() => defense && invoke(props, 'onBuildingClick', defense.instanceId)}>SELECT DEFENSE</button>
        <button onClick={() => invoke(props, 'onPlacementClick', 2, 2)}>PLACE ON GRID</button>
      </div>
    );
  },
}));

vi.mock('../HUD', () => ({
  HUD: (props: MockProps) => (
    <div>
      <button onClick={() => invoke(props, 'onOpenLeague')}>HUD LEAGUE</button>
      <button onClick={() => invoke(props, 'onCollectAll')}>HUD COLLECT ALL</button>
    </div>
  ),
}));

vi.mock('../BuildingPanel', () => ({
  BuildingPanel: (props: MockProps) => (
    <div>
      <span>PANEL building</span>
      <button onClick={() => invoke(props, 'onUpgrade')}>BUILDING UPGRADE</button>
      <button onClick={() => invoke(props, 'onToggleXBowMode')}>BUILDING TARGET MODE</button>
      <button onClick={() => invoke(props, 'onReloadAmmo')}>BUILDING RELOAD</button>
      <button onClick={() => invoke(props, 'onMove')}>BUILDING MOVE</button>
      <button onClick={() => invoke(props, 'onRemove')}>BUILDING REMOVE</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../ShopPanel', () => ({
  ShopPanel: (props: MockProps) => (
    <div>
      <span>PANEL shop</span>
      <button onClick={() => invoke(props, 'onSelectBuilding', 'Cannon', 'defense')}>SHOP BUILDING</button>
      <button onClick={() => invoke(props, 'onSelectTrap', 'Bomb')}>SHOP TRAP</button>
      <button onClick={() => invoke(props, 'onSelectWall')}>SHOP WALL</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../SettingsPanel', () => ({
  SettingsPanel: (props: MockProps) => (
    <div>
      <span>PANEL settings</span>
      <button onClick={() => invoke(props, 'onChangeSpeed', 10)}>SET SPEED</button>
      <button onClick={() => invoke(props, 'onResetProgress')}>RESET PROGRESS</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../SaveLoadPanel', () => ({
  SaveLoadPanel: (props: MockProps) => (
    <div>
      <span>PANEL saveLoad</span>
      <button onClick={() => invoke(props, 'onSave', 'coverage-slot')}>SAVE SLOT</button>
      <button onClick={() => invoke(props, 'onLoad', 'coverage-slot')}>LOAD SLOT</button>
      <button onClick={() => invoke(props, 'onDelete', 'coverage-slot')}>DELETE SLOT</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../GemShopPanel', () => ({
  GemShopPanel: (props: MockProps) => (
    <div>
      <span>PANEL gemShop</span>
      <button onClick={() => invoke(props, 'onBuyResources', 'gold', 100, 1)}>BUY GOLD</button>
      <button onClick={() => invoke(props, 'onBuyResources', 'elixir', 100, Number.MAX_SAFE_INTEGER)}>BUY TOO MUCH</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../ArmyPanel', () => ({
  ArmyPanel: (props: MockProps) => {
    const troop = getArray<{ name: string }>(props, 'availableTroops')[0]?.name ?? 'Barbarian';
    const siege = getArray<{ name: string }>(props, 'availableSieges')[0]?.name ?? 'Wall Wrecker';
    return (
      <div>
        <span>PANEL army</span>
        <button onClick={() => invoke(props, 'onTrain', troop)}>TRAIN TROOP</button>
        <button onClick={() => invoke(props, 'onRemove', troop)}>REMOVE TROOP</button>
        <button onClick={() => invoke(props, 'onTrainSiege', siege)}>TRAIN SIEGE</button>
        <button onClick={() => invoke(props, 'onRemoveSiege', siege)}>REMOVE SIEGE</button>
        <CloseButton props={props} />
      </div>
    );
  },
}));

vi.mock('../LabPanel', () => ({
  LabPanel: (props: MockProps) => {
    const troop = getArray<{ name: string }>(props, 'troops')[0]?.name ?? 'Barbarian';
    return (
      <div>
        <span>PANEL lab</span>
        <button onClick={() => invoke(props, 'onResearch', troop)}>START RESEARCH</button>
        <CloseButton props={props} />
      </div>
    );
  },
}));

vi.mock('../ClanPanel', () => ({
  ClanPanel: (props: MockProps) => (
    <div>
      <span>PANEL clan</span>
      <button onClick={() => invoke(props, 'onCreateClan', 'Runtime Clan')}>CREATE CLAN</button>
      <button onClick={() => invoke(props, 'onRequestTroops')}>REQUEST CASTLE</button>
      <button onClick={() => invoke(props, 'onRemoveCastleTroop', 'Archer')}>REMOVE CASTLE</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../HeroPanel', () => ({
  HeroPanel: (props: MockProps) => {
    const hero = getArray<{ name: string }>(props, 'heroes')[0];
    return (
      <div>
        <span>PANEL heroes</span>
        <button onClick={() => hero && invoke(props, 'onUpdateHero', hero.name, { ...hero, level: 51 })}>UPDATE HERO</button>
        <button onClick={() => hero && invoke(props, 'onUpgradeHero', hero.name)}>UPGRADE HERO</button>
        <button onClick={() => invoke(props, 'onUpgradeEquipment', 'Barbarian Puppet')}>UPGRADE EQUIPMENT</button>
        <button onClick={() => invoke(props, 'onUpgradePet', 'L.A.S.S.I')}>UPGRADE PET</button>
        <CloseButton props={props} />
      </div>
    );
  },
}));

vi.mock('../AchievementPanel', () => ({
  AchievementPanel: (props: MockProps) => {
    const progress = getArray<{ achievementId: string }>(props, 'progress');
    return (
      <div>
        <span>PANEL achievements</span>
        <button onClick={() => invoke(props, 'onClaimReward', progress[0]?.achievementId ?? 'sweet_victory')}>CLAIM ACHIEVEMENT</button>
        <CloseButton props={props} />
      </div>
    );
  },
}));

vi.mock('../MagicItemsPanel', () => ({
  MagicItemsPanel: (props: MockProps) => (
    <div>
      <span>PANEL magicItems</span>
      <button onClick={() => invoke(props, 'onUseItem', 'rune_gold')}>USE ITEM</button>
      <button onClick={() => invoke(props, 'onBuyItem', 'training_potion')}>BUY ITEM</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../SuperTroopPanel', () => ({
  SuperTroopPanel: (props: MockProps) => (
    <div>
      <span>PANEL superTroops</span>
      <button onClick={() => invoke(props, 'onBoost', 'Super Barbarian')}>BOOST TROOP</button>
      <button onClick={() => invoke(props, 'onUnboost', 'Super Barbarian')}>UNBOOST TROOP</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../LeaguePanel', () => ({
  LeaguePanel: (props: MockProps) => (
    <div>
      <span>PANEL league</span>
      <button onClick={() => invoke(props, 'onClaimStarBonus')}>CLAIM STAR BONUS</button>
      <button onClick={() => invoke(props, 'onCollectTreasury')}>COLLECT TREASURY</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../StatsPanel', () => ({
  StatsPanel: (props: MockProps) => <div><span>PANEL stats</span><CloseButton props={props} /></div>,
}));

vi.mock('../DefenseLogPanel', () => ({
  DefenseLogPanel: (props: MockProps) => (
    <div>
      <span>PANEL defenseLog</span>
      <button onClick={() => invoke(props, 'onSimulate')}>SIMULATE DEFENSE</button>
      <CloseButton props={props} />
    </div>
  ),
}));

vi.mock('../LayoutPresetsPanel', () => ({
  LayoutPresetsPanel: (props: MockProps) => {
    const preset = getArray<{ id: string }>(props, 'presets')[0];
    return (
      <div>
        <span>PANEL layoutPresets</span>
        <button onClick={() => invoke(props, 'onSave', 'Coverage Layout')}>SAVE LAYOUT</button>
        <button onClick={() => invoke(props, 'onLoad', preset?.id ?? 'missing')}>LOAD LAYOUT</button>
        <button onClick={() => invoke(props, 'onDelete', preset?.id ?? 'missing')}>DELETE LAYOUT</button>
        <CloseButton props={props} />
      </div>
    );
  },
}));

vi.mock('../SpellPanel', () => ({
  SpellPanel: (props: MockProps) => {
    const spell = getArray<{ name: string }>(props, 'availableSpells')[0]?.name ?? 'Lightning Spell';
    return (
      <div>
        <span>PANEL spells</span>
        <button onClick={() => invoke(props, 'onTrainSpell', spell)}>TRAIN SPELL</button>
        <button onClick={() => invoke(props, 'onRemoveSpell', spell)}>REMOVE SPELL</button>
        <CloseButton props={props} />
      </div>
    );
  },
}));

vi.mock('../ClanWarPanel', () => ({
  ClanWarPanel: (props: MockProps) => {
    const war = props.war as { phase?: string } | null;
    const base = getArray<{ id: string }>(props, 'availableWarBases')[0];
    return (
      <div>
        <span>PANEL clanWar {war?.phase ?? 'none'}</span>
        <button onClick={() => invoke(props, 'onStartWar', 5)}>START WAR</button>
        <button onClick={() => invoke(props, 'onSelectWarBase', base?.id ?? 'base-1')}>SELECT WAR BASE</button>
        <button onClick={() => invoke(props, 'onStartBattle')}>START BATTLE DAY</button>
        <button onClick={() => invoke(props, 'onAttack', 0)}>WAR ATTACK</button>
        <button onClick={() => invoke(props, 'onEndWar')}>END WAR</button>
        <button onClick={() => invoke(props, 'onStartNewWar')}>NEW WAR</button>
        <CloseButton props={props} />
      </div>
    );
  },
}));

import { VillageScreen } from '../VillageScreen';

function makeRichVillage(): VillageState {
  const state = createStarterVillage();
  state.townHallLevel = 15;
  state.resources = { gold: 1_000_000_000, elixir: 1_000_000_000, darkElixir: 1_000_000_000, gems: 1_000_000_000 };
  state.trophies = 1_000;
  state.starBonusStars = 5;
  state.clan = createClan('Coverage Clan');
  state.clan.castleTroops = [{ name: 'Archer', level: 1, count: 1 }];
  state.heroes = [{
    name: 'Barbarian King', level: 50, currentHp: 1_000, isRecovering: false,
    recoveryTimeRemaining: 0, isUpgrading: false, upgradeTimeRemaining: 0,
    equippedItems: [null, null], assignedPet: null,
  }];
  state.traps = [
    { instanceId: 'trap-1', trapId: 'Bomb', level: 1, gridX: 1, gridY: 1, isArmed: false },
    { instanceId: 'trap-2', trapId: 'Bomb', level: 1, gridX: 3, gridY: 3, isArmed: false },
  ];
  state.magicItems = { rune_gold: 1 };
  state.statistics = { ...createStatistics(), troopsTrained: 100, buildingsUpgraded: 100 };
  state.lastDefenseAt = Date.now();
  const collector = state.buildings.find((building) => building.buildingType === 'resource_collector');
  if (collector) collector.uncollectedResources = 500;
  return state;
}

function VillageHarness({ initialState, onNavigate }: {
  initialState: VillageState;
  onNavigate: (screenName: string) => void;
}) {
  const [state, setState] = useState(initialState);
  return <VillageScreen externalState={state} externalSetState={setState} onNavigate={onNavigate} />;
}

function openPanel(buttonName: string, panelName: string) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  expect(screen.getByText(new RegExp(`PANEL ${panelName}`))).toBeTruthy();
}

function closePanel() {
  fireEvent.click(screen.getByRole('button', { name: 'CLOSE PANEL' }));
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('VillageScreen complete runtime orchestration', () => {
  it('runs every village panel and its stateful actions', () => {
    const navigate = vi.fn();
    render(<VillageHarness initialState={makeRichVillage()} onNavigate={navigate} />);

    openPanel('Army', 'army');
    for (const action of ['TRAIN TROOP', 'REMOVE TROOP', 'TRAIN SIEGE', 'REMOVE SIEGE']) fireEvent.click(screen.getByRole('button', { name: action }));
    closePanel();

    openPanel('Lab', 'lab');
    fireEvent.click(screen.getByRole('button', { name: 'START RESEARCH' }));
    closePanel();

    openPanel('Clan', 'clan');
    for (const action of ['CREATE CLAN', 'REQUEST CASTLE', 'REMOVE CASTLE']) fireEvent.click(screen.getByRole('button', { name: action }));
    closePanel();

    openPanel('Spells', 'spells');
    fireEvent.click(screen.getByRole('button', { name: 'TRAIN SPELL' }));
    fireEvent.click(screen.getByRole('button', { name: 'REMOVE SPELL' }));
    closePanel();

    openPanel('Heroes', 'heroes');
    for (const action of ['UPDATE HERO', 'UPGRADE HERO', 'UPGRADE EQUIPMENT', 'UPGRADE PET']) fireEvent.click(screen.getByRole('button', { name: action }));
    closePanel();

    openPanel('Achievements', 'achievements');
    fireEvent.click(screen.getByRole('button', { name: 'CLAIM ACHIEVEMENT' }));
    closePanel();

    openPanel('Magic Items', 'magicItems');
    fireEvent.click(screen.getByRole('button', { name: 'USE ITEM' }));
    fireEvent.click(screen.getByRole('button', { name: 'BUY ITEM' }));
    closePanel();

    openPanel('Super Troops', 'superTroops');
    fireEvent.click(screen.getByRole('button', { name: 'BOOST TROOP' }));
    fireEvent.click(screen.getByRole('button', { name: 'UNBOOST TROOP' }));
    closePanel();

    fireEvent.click(screen.getByRole('button', { name: 'HUD LEAGUE' }));
    expect(screen.getByText('PANEL league')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'CLAIM STAR BONUS' }));
    fireEvent.click(screen.getByRole('button', { name: 'COLLECT TREASURY' }));
    closePanel();

    for (const [button, panel] of [['Stats', 'stats'], ['Defense Log', 'defenseLog']] as const) {
      openPanel(button, panel);
      if (panel === 'defenseLog') fireEvent.click(screen.getByRole('button', { name: 'SIMULATE DEFENSE' }));
      closePanel();
    }

    openPanel('Layouts', 'layoutPresets');
    fireEvent.click(screen.getByRole('button', { name: 'SAVE LAYOUT' }));
    fireEvent.click(screen.getByRole('button', { name: 'LOAD LAYOUT' }));
    fireEvent.click(screen.getByRole('button', { name: 'DELETE LAYOUT' }));
    closePanel();

    openPanel('Clan War', 'clanWar');
    fireEvent.click(screen.getByRole('button', { name: 'START WAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'SELECT WAR BASE' }));
    fireEvent.click(screen.getByRole('button', { name: 'START BATTLE DAY' }));
    fireEvent.click(screen.getByRole('button', { name: 'WAR ATTACK' }));
    fireEvent.click(screen.getByRole('button', { name: 'END WAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'NEW WAR' }));
    closePanel();

    openPanel('Gem Shop', 'gemShop');
    fireEvent.click(screen.getByRole('button', { name: 'BUY GOLD' }));
    fireEvent.click(screen.getByRole('button', { name: 'BUY TOO MUCH' }));
    closePanel();

    openPanel('Save/Load', 'saveLoad');
    fireEvent.click(screen.getByRole('button', { name: 'SAVE SLOT' }));
    fireEvent.click(screen.getByRole('button', { name: 'LOAD SLOT' }));

    openPanel('Settings', 'settings');
    fireEvent.click(screen.getByRole('button', { name: 'SET SPEED' }));
    fireEvent.click(screen.getByRole('button', { name: 'RESET PROGRESS' }));

    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(navigate.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining(['battle', 'campaign', 'menu']));
  });

  it('runs grid collection, selection, building actions, placement, and trap rearming', () => {
    render(<VillageHarness initialState={makeRichVillage()} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'HUD COLLECT ALL' }));
    fireEvent.click(screen.getByRole('button', { name: 'COLLECT BUILDING' }));
    fireEvent.click(screen.getByRole('button', { name: 'SELECT TOWN HALL' }));
    expect(screen.getByText(/Upgrade to Level 16/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));

    fireEvent.click(screen.getByRole('button', { name: 'SELECT DEFENSE' }));
    expect(screen.getByText('PANEL building')).toBeTruthy();
    for (const action of ['BUILDING UPGRADE', 'BUILDING TARGET MODE', 'BUILDING RELOAD']) fireEvent.click(screen.getByRole('button', { name: action }));
    fireEvent.click(screen.getByRole('button', { name: 'BUILDING MOVE' }));
    expect(screen.getByText(/Placing: Cannon/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    openPanel('Shop', 'shop');
    fireEvent.click(screen.getByRole('button', { name: 'SHOP BUILDING' }));
    fireEvent.click(screen.getByRole('button', { name: 'PLACE ON GRID' }));
    openPanel('Shop', 'shop');
    fireEvent.click(screen.getByRole('button', { name: 'SHOP TRAP' }));
    fireEvent.click(screen.getByRole('button', { name: 'PLACE ON GRID' }));
    openPanel('Shop', 'shop');
    fireEvent.click(screen.getByRole('button', { name: 'SHOP WALL' }));

    fireEvent.click(screen.getByRole('button', { name: /Rearm 2 traps/ }));
    openPanel('Defense Log', 'defenseLog');
    fireEvent.click(screen.getByRole('button', { name: 'SIMULATE DEFENSE' }));
    fireEvent.click(screen.getByRole('button', { name: /DISMISS/ }));
    closePanel();
  });
});
