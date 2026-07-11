import { useRef, useEffect, useState, useCallback } from 'react';
import type { VillageState, PlacedBuilding, PlacedWall, PlacedTrap } from '../types/village.ts';
import {
  GRID_SIZE,
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToScreen,
  screenToGrid,
  canPlaceBuilding,
  buildOccupiedSet,
} from '../utils/grid-utils.ts';
import { getWallConnection } from '../utils/wall-connections.ts';

export interface PlacementMode {
  buildingId: string;
  width: number;
  height: number;
  /** What is being placed. Defaults to a building when omitted. */
  kind?: 'building' | 'trap';
  /** Trap type name, present only when kind is 'trap'. */
  trapId?: string;
}

interface VillageGridProps {
  state: VillageState;
  onBuildingClick: (instanceId: string) => void;
  selectedBuilding: string | null;
  placementMode: PlacementMode | null;
  onPlacementClick: (gridX: number, gridY: number) => void;
}

const BUILDING_COLORS: Record<PlacedBuilding['buildingType'], string> = {
  defense: '#dc2626',
  resource_collector: '#eab308',
  resource_storage: '#f97316',
  army: '#3b82f6',
  other: '#6b7280',
};

const BUILDING_SIZES: Record<string, { w: number; h: number }> = {
  'Town Hall': { w: 4, h: 4 }, 'Army Camp': { w: 5, h: 5 },
};

function getBuildingSize(id: string): { w: number; h: number } {
  return BUILDING_SIZES[id] ?? { w: 3, h: 3 };
}

export function VillageGrid({
  state,
  onBuildingClick,
  selectedBuilding,
  placementMode,
  onPlacementClick,
}: VillageGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [mouseGrid, setMouseGrid] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0, startX: 0, startY: 0 });

  const canvasWidth = 960;
  const canvasHeight = 640;

  // Center offset so grid origin appears in the middle of the canvas
  const originX = canvasWidth / 2;
  const originY = 80;

  const toCanvas = useCallback(
    (gx: number, gy: number) => {
      const s = gridToScreen(gx, gy);
      return {
        x: (s.x + camera.x) * zoom + originX,
        y: (s.y + camera.y) * zoom + originY,
      };
    },
    [camera, zoom, originX, originY],
  );

  const fromCanvas = useCallback(
    (cx: number, cy: number) => {
      const sx = (cx - originX) / zoom - camera.x;
      const sy = (cy - originY) / zoom - camera.y;
      return screenToGrid(sx, sy);
    },
    [camera, zoom, originX, originY],
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale the backing store by devicePixelRatio so HiDPI displays render crisply
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== canvasWidth * dpr || canvas.height !== canvasHeight * dpr) {
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw grass tiles
    ctx.save();
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const p = toCanvas(gx, gy);
        drawIsometricTile(ctx, p.x, p.y, zoom, '#3a7d2c', '#2d6622');
      }
    }
    ctx.restore();

    // Draw walls with connection logic
    if (state.walls && state.walls.length > 0) {
      const wallSet = new Set(state.walls.map((w) => `${w.gridX},${w.gridY}`));
      for (const wall of state.walls) {
        drawWall(ctx, wall, wallSet, toCanvas, zoom, wall.instanceId === selectedBuilding);
      }
    }

    // Draw traps (hidden from attacker, visible to owner)
    if (state.traps && state.traps.length > 0) {
      for (const trap of state.traps) {
        drawTrap(ctx, trap, toCanvas, zoom);
      }
    }

    // Draw buildings
    for (const bld of state.buildings) {
      const size = getBuildingSize(bld.buildingId);
      drawBuilding(ctx, bld, size, toCanvas, zoom, bld.instanceId === selectedBuilding);
    }

    // Draw placement ghost
    if (placementMode && mouseGrid) {
      const occupied = buildOccupiedSet(
        state.buildings.map((b) => {
          const s = getBuildingSize(b.buildingId);
          return { gridX: b.gridX, gridY: b.gridY, width: s.w, height: s.h };
        }),
      );
      const valid = canPlaceBuilding(
        mouseGrid.x,
        mouseGrid.y,
        placementMode.width,
        placementMode.height,
        occupied,
      );
      const color = valid ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)';

      for (let dx = 0; dx < placementMode.width; dx++) {
        for (let dy = 0; dy < placementMode.height; dy++) {
          const p = toCanvas(mouseGrid.x + dx, mouseGrid.y + dy);
          drawIsometricTile(ctx, p.x, p.y, zoom, color, color);
        }
      }
    }
  }, [state, camera, zoom, mouseGrid, selectedBuilding, placementMode, toCanvas]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Convert client coordinates to canvas coordinates (accounts for CSS scaling)
      const scale = canvasWidth / rect.width;
      const cx = (e.clientX - rect.left) * scale;
      const cy = (e.clientY - rect.top) * scale;

      if (dragRef.current.dragging) {
        const dx = (e.clientX - dragRef.current.lastX) * scale;
        const dy = (e.clientY - dragRef.current.lastY) * scale;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        setCamera((prev) => ({ x: prev.x + dx / zoom, y: prev.y + dy / zoom }));
        return;
      }

      if (placementMode) {
        const g = fromCanvas(cx, cy);
        setMouseGrid({ x: g.gridX, y: g.gridY });
      }
    },
    [placementMode, zoom, fromCanvas],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      dragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const wasDragging = dragRef.current.dragging;
      // Compare against where the drag started, not the last mousemove position
      const movedFar =
        Math.abs(e.clientX - dragRef.current.startX) > 4 ||
        Math.abs(e.clientY - dragRef.current.startY) > 4;
      dragRef.current.dragging = false;

      // If the mouse moved significantly, treat it as a drag (not a click)
      if (wasDragging && movedFar) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = canvasWidth / rect.width;
      const cx = (e.clientX - rect.left) * scale;
      const cy = (e.clientY - rect.top) * scale;
      const g = fromCanvas(cx, cy);

      if (placementMode) {
        onPlacementClick(g.gridX, g.gridY);
        return;
      }

      // Check if a building was clicked
      for (const bld of state.buildings) {
        const size = getBuildingSize(bld.buildingId);
        if (
          g.gridX >= bld.gridX &&
          g.gridX < bld.gridX + size.w &&
          g.gridY >= bld.gridY &&
          g.gridY < bld.gridY + size.h
        ) {
          onBuildingClick(bld.instanceId);
          return;
        }
      }
    },
    [state.buildings, placementMode, onPlacementClick, onBuildingClick, fromCanvas],
  );

  // Wheel zoom needs a native non-passive listener: React registers root wheel
  // listeners as passive, so preventDefault() would be ignored and the page scrolls.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => Math.max(0.4, Math.min(2.5, prev - e.deltaY * 0.001)));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="block mx-auto cursor-grab active:cursor-grabbing rounded-lg border border-slate-700"
      style={{ width: '100%', maxWidth: canvasWidth, height: 'auto' }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}

// --- Drawing helpers ---

function drawIsometricTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  fill: string,
  stroke: string,
) {
  const hw = (TILE_WIDTH / 2) * zoom;
  const hh = (TILE_HEIGHT / 2) * zoom;
  ctx.beginPath();
  ctx.moveTo(x, y - hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x - hw, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  bld: PlacedBuilding,
  size: { w: number; h: number },
  toCanvas: (gx: number, gy: number) => { x: number; y: number },
  zoom: number,
  isSelected: boolean,
) {
  const color = BUILDING_COLORS[bld.buildingType];
  const topLeft = toCanvas(bld.gridX, bld.gridY);
  const topRight = toCanvas(bld.gridX + size.w, bld.gridY);
  const bottomLeft = toCanvas(bld.gridX, bld.gridY + size.h);
  const bottomRight = toCanvas(bld.gridX + size.w, bld.gridY + size.h);

  // Draw isometric footprint
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isSelected) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Level badge
  const center = toCanvas(bld.gridX + size.w / 2, bld.gridY + size.h / 2);
  const fontSize = Math.max(10, 12 * zoom);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(String(bld.level), center.x, center.y);

  // Building name (abbreviated)
  const nameSize = Math.max(7, 8 * zoom);
  ctx.font = `${nameSize}px sans-serif`;
  ctx.fillStyle = '#ffffffcc';
  const abbrev = bld.buildingId.length > 8 ? bld.buildingId.slice(0, 7) + '.' : bld.buildingId;
  ctx.fillText(abbrev, center.x, center.y + fontSize * 0.8);

  // Upgrade progress bar (if upgrading)
  if (bld.isUpgrading && bld.upgradeTimeRemaining > 0) {
    const barW = Math.max(20, 30 * zoom);
    const barH = Math.max(3, 4 * zoom);
    const barX = center.x - barW / 2;
    const barY = center.y + fontSize * 1.5;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#fbbf24';
    // We don't have the total upgrade time, so just show a pulsing bar
    const pulse = (Math.sin(Date.now() / 500) + 1) / 2;
    ctx.fillRect(barX, barY, barW * pulse, barH);
  }

  // Uncollected resource indicator (bubble above building)
  const uncollected = bld.uncollectedResources ?? 0;
  if (uncollected > 0 && bld.buildingType === 'resource_collector') {
    const bubbleY = topLeft.y - 10 * zoom;
    const bubbleR = Math.max(5, 7 * zoom);
    ctx.beginPath();
    ctx.arc(center.x, bubbleY, bubbleR, 0, Math.PI * 2);
    ctx.fillStyle = bld.buildingId.includes('Gold') ? '#fbbf24' : '#a855f7';
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = `bold ${Math.max(6, 7 * zoom)}px sans-serif`;
    ctx.fillStyle = '#000';
    ctx.fillText('$', center.x, bubbleY + 1);
  }
}

// Wall colors by level range
const WALL_COLORS: Array<{ maxLevel: number; fill: string; stroke: string }> = [
  { maxLevel: 2, fill: '#9ca3af', stroke: '#6b7280' },   // Wood/Stone
  { maxLevel: 4, fill: '#d4a574', stroke: '#a87c4f' },   // Gold
  { maxLevel: 6, fill: '#818cf8', stroke: '#6366f1' },   // Crystal
  { maxLevel: 8, fill: '#1e1e1e', stroke: '#4a4a4a' },   // Dark
  { maxLevel: 10, fill: '#ef4444', stroke: '#b91c1c' },  // Lava
  { maxLevel: 15, fill: '#60a5fa', stroke: '#2563eb' },   // Legendary
];

function getWallColor(level: number): { fill: string; stroke: string } {
  for (const wc of WALL_COLORS) {
    if (level <= wc.maxLevel) return wc;
  }
  return WALL_COLORS[WALL_COLORS.length - 1]!;
}

// Directions in the same order the connection classifier reports them, so the
// junction art (arms toward each connected neighbour + a center joint whose
// size reflects straight/corner/T/cross) is driven off the tested classifier.
const WALL_DIRECTIONS: Array<{ key: 'north' | 'south' | 'west' | 'east'; dx: number; dy: number }> = [
  { key: 'north', dx: 0, dy: -1 },
  { key: 'south', dx: 0, dy: 1 },
  { key: 'west', dx: -1, dy: 0 },
  { key: 'east', dx: 1, dy: 0 },
];

// Center joint radius (in tile-half units) by connection count, so a straight
// run reads differently from a corner, T-junction, or a 4-way cross.
const JOINT_SCALE_BY_COUNT = [0.28, 0.3, 0.36, 0.42, 0.5];

function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: PlacedWall,
  wallSet: Set<string>,
  toCanvas: (gx: number, gy: number) => { x: number; y: number },
  zoom: number,
  isSelected: boolean,
) {
  const { fill, stroke } = getWallColor(wall.level);
  const p = toCanvas(wall.gridX, wall.gridY);
  const hw = (TILE_WIDTH / 2) * zoom;
  const hh = (TILE_HEIGHT / 2) * zoom;

  // Draw base wall tile (slightly smaller than full tile)
  const scale = 0.85;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - hh * scale);
  ctx.lineTo(p.x + hw * scale, p.y);
  ctx.lineTo(p.x, p.y + hh * scale);
  ctx.lineTo(p.x - hw * scale, p.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#fbbf24' : stroke;
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.stroke();

  // Classify how this segment connects to its neighbours and draw an arm toward
  // each connected side plus a center joint sized for the junction type.
  const connection = getWallConnection(wall.gridX, wall.gridY, wallSet);
  ctx.strokeStyle = fill;
  ctx.lineWidth = Math.max(2, 3 * zoom);
  for (const dir of WALL_DIRECTIONS) {
    if (!connection.neighbours[dir.key]) continue;
    const np = toCanvas(wall.gridX + dir.dx, wall.gridY + dir.dy);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo((p.x + np.x) / 2, (p.y + np.y) / 2);
    ctx.stroke();
  }

  const jointScale = JOINT_SCALE_BY_COUNT[connection.count] ?? 0.28;
  ctx.beginPath();
  ctx.arc(p.x, p.y, hw * jointScale, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
}

function drawTrap(
  ctx: CanvasRenderingContext2D,
  trap: PlacedTrap,
  toCanvas: (gx: number, gy: number) => { x: number; y: number },
  zoom: number,
) {
  const p = toCanvas(trap.gridX, trap.gridY);
  const hw = (TILE_WIDTH / 2) * zoom;
  const hh = (TILE_HEIGHT / 2) * zoom;

  // Draw a small diamond with dashed outline (indicating hidden)
  const scale = 0.6;
  ctx.save();
  ctx.setLineDash([3 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - hh * scale);
  ctx.lineTo(p.x + hw * scale, p.y);
  ctx.lineTo(p.x, p.y + hh * scale);
  ctx.lineTo(p.x - hw * scale, p.y);
  ctx.closePath();
  ctx.fillStyle = trap.isArmed ? 'rgba(239,68,68,0.4)' : 'rgba(100,100,100,0.3)';
  ctx.fill();
  ctx.strokeStyle = trap.isArmed ? '#ef4444' : '#6b7280';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // Trap icon (small "!" for armed, "x" for disarmed)
  const fontSize = Math.max(8, 10 * zoom);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = trap.isArmed ? '#fca5a5' : '#9ca3af';
  ctx.fillText(trap.isArmed ? '!' : 'x', p.x, p.y);
  ctx.restore();
}
