import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarterVillage } from '../../engine/village-manager';
import { detectVillageEvents } from '../../engine/village-events';
import {
  createNotification,
  dismissNotification,
  nextNotificationId,
  pushNotification,
  tickNotifications,
} from '../../engine/notification-manager';
import { useGameClock } from '../useGameClock';
import { useVillage } from '../useVillage';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useVillage runtime', () => {
  it('selects, upgrades, removes, places, and cancels buildings', () => {
    const { result } = renderHook(() => useVillage());
    const rich = createStarterVillage();
    rich.townHallLevel = 15;
    rich.resources = { gold: 50_000_000, elixir: 50_000_000, darkElixir: 50_000_000, gems: 10_000 };
    act(() => result.current.setState(rich));

    const cannon = result.current.state.buildings.find(building => building.buildingId === 'Cannon')!;
    act(() => result.current.handleBuildingClick(cannon.instanceId));
    expect(result.current.selectedBuilding?.buildingId).toBe('Cannon');
    expect(result.current.canUpgrade).toBe(true);
    act(() => result.current.handleUpgrade());
    expect(result.current.state.buildings.find(building => building.instanceId === cannon.instanceId)?.isUpgrading).toBe(true);
    act(() => result.current.handleClosePanel());
    expect(result.current.selectedBuilding).toBeNull();

    const removable = result.current.state.buildings.find(building => building.buildingId === 'Gold Mine')!;
    act(() => result.current.handleBuildingClick(removable.instanceId));
    act(() => result.current.handleRemove());
    expect(result.current.state.buildings.some(building => building.instanceId === removable.instanceId)).toBe(false);

    const before = result.current.state.buildings.length;
    act(() => result.current.startPlacement('Cannon', 'defense', { free: true }));
    expect(result.current.placementMode).toMatchObject({ buildingId: 'Cannon', width: 3, height: 3 });
    act(() => result.current.handlePlacementClick(1, 1));
    expect(result.current.state.buildings).toHaveLength(before + 1);
    act(() => result.current.startPlacement('Unknown Building', 'other'));
    act(() => result.current.handlePlacementClick(8, 8));
    act(() => result.current.cancelPlacement());
    expect(result.current.placementMode).toBeNull();
  });

  it('places traps, rejects occupied tiles, and protects the Town Hall from removal', () => {
    const { result } = renderHook(() => useVillage());
    const rich = createStarterVillage();
    rich.townHallLevel = 15;
    rich.resources.gold = 50_000_000;
    rich.resources.elixir = 50_000_000;
    act(() => result.current.setState(rich));
    act(() => result.current.startTrapPlacement('Bomb'));
    act(() => result.current.handlePlacementClick(2, 2));
    expect(result.current.state.traps).toHaveLength(1);
    act(() => result.current.startPlacement('Cannon', 'defense', { free: true }));
    act(() => result.current.handlePlacementClick(2, 2));
    expect(result.current.placementMode).not.toBeNull();
    act(() => result.current.cancelPlacement());
    const townHall = result.current.state.buildings.find(building => building.buildingId === 'Town Hall')!;
    act(() => result.current.handleBuildingClick(townHall.instanceId));
    act(() => result.current.handleRemove());
    expect(result.current.state.buildings.some(building => building.instanceId === townHall.instanceId)).toBe(true);
  });
});

describe('clock, events, and notifications', () => {
  it('starts, pauses, resumes, changes speed, stops, and cleans up the game clock', () => {
    const { result, unmount } = renderHook(() => useGameClock({ speedMultiplier: 2, tickIntervalMs: 50 }));
    expect(result.current.isRunning).toBe(false);
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.elapsedMs).toBeGreaterThan(0);
    act(() => result.current.pause());
    expect(result.current.isPaused).toBe(true);
    act(() => result.current.setSpeed(3));
    expect(result.current.speed).toBe(3);
    act(() => result.current.resume());
    act(() => result.current.stop());
    expect(result.current.isRunning).toBe(false);
    unmount();
  });

  it('detects upgrade, builder, army, and storage transitions', () => {
    const prev = createStarterVillage();
    const next = structuredClone(prev);
    prev.buildings[0].isUpgrading = true;
    prev.buildings[0].level = 1;
    next.buildings[0].isUpgrading = false;
    next.buildings[0].level = 2;
    prev.builders[0].assignedTo = prev.buildings[0].instanceId;
    next.builders[0].assignedTo = null;
    next.army = [{ name: 'Barbarian', level: 1, count: 20 }];
    next.resources.gold = 1_000_000;
    next.resources.elixir = 1_000_000;
    const events = detectVillageEvents(prev, next);
    expect(events.map(event => event.type)).toEqual(expect.arrayContaining(['upgrade_complete', 'builders_free', 'army_ready']));
  });

  it('creates, caps, advances, expires, and dismisses notifications', () => {
    const first = createNotification(nextNotificationId(), 'success', 'Done', 100);
    const second = createNotification(nextNotificationId(), 'error', 'Failed', 200);
    const unchanged: typeof first[] = [];
    expect(tickNotifications(unchanged, 100)).toBe(unchanged);
    const queue = pushNotification(pushNotification([], first), second, 1);
    expect(queue).toEqual([second]);
    expect(tickNotifications(queue, 0)).toBe(queue);
    expect(tickNotifications(queue, 250)).toEqual([]);
    expect(dismissNotification(queue, 'missing')).toBe(queue);
    expect(dismissNotification(queue, second.id)).toEqual([]);
  });
});
