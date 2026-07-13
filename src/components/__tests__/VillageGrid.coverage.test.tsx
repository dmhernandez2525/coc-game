import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarterVillage } from '../../engine/village-manager';
import { VillageGrid } from '../VillageGrid';

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
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640,
    toJSON: () => ({}),
  });
});

describe('VillageGrid canvas runtime', () => {
  it('draws buildings, upgrading collectors, every wall palette, traps, and placement validity', () => {
    const state = createStarterVillage();
    state.buildings = [
      { ...state.buildings[0], instanceId: 'town', gridX: 0, gridY: 0, isUpgrading: true, upgradeTimeRemaining: 10 },
      { ...state.buildings[1], instanceId: 'gold', gridX: 5, gridY: 0, uncollectedResources: 100 },
      { ...state.buildings[2], instanceId: 'elixir', gridX: 9, gridY: 0, uncollectedResources: 100 },
      { ...state.buildings[3], instanceId: 'storage', gridX: 13, gridY: 0 },
      { ...state.buildings[5], instanceId: 'camp', gridX: 17, gridY: 0 },
      { ...state.buildings[7], instanceId: 'defense', gridX: 23, gridY: 0 },
    ];
    state.walls = [1, 3, 5, 7, 9, 12, 20].map((level, index) => ({
      instanceId: `wall-${level}`, level, gridX: index, gridY: 8,
    }));
    state.traps = [
      { instanceId: 'armed', trapId: 'Bomb', level: 1, gridX: 1, gridY: 10, isArmed: true },
      { instanceId: 'spent', trapId: 'Bomb', level: 1, gridX: 2, gridY: 10, isArmed: false },
    ];
    const onPlacementClick = vi.fn();
    const onBuildingClick = vi.fn();
    const { container, rerender } = render(
      <VillageGrid state={state} onBuildingClick={onBuildingClick} selectedBuilding="town"
        placementMode={{ buildingId: 'Cannon', width: 3, height: 3 }} onPlacementClick={onPlacementClick} />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseMove(canvas, { clientX: 600, clientY: 200 });
    fireEvent.mouseDown(canvas, { clientX: 600, clientY: 200 });
    fireEvent.mouseUp(canvas, { clientX: 600, clientY: 200 });
    expect(onPlacementClick).toHaveBeenCalled();

    rerender(
      <VillageGrid state={state} onBuildingClick={onBuildingClick} selectedBuilding={null}
        placementMode={null} onPlacementClick={onPlacementClick} />,
    );
    fireEvent.mouseDown(canvas, { clientX: 480, clientY: 80 });
    fireEvent.mouseUp(canvas, { clientX: 480, clientY: 80 });
    expect(onBuildingClick).toHaveBeenCalledWith('town');

    fireEvent.wheel(canvas, { deltaY: -200 });
    fireEvent.wheel(canvas, { deltaY: 10_000 });
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 140, clientY: 140 });
    fireEvent.mouseUp(canvas, { clientX: 160, clientY: 160 });
    fireEvent.mouseLeave(canvas);

    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.setLineDash).toHaveBeenCalled();
  });
});
