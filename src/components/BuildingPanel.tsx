import type { PlacedBuilding } from '../types/village.ts';

interface UpgradeCost {
  amount: number;
  resource: string;
  time: number;
}

interface BuildingPanelProps {
  building: PlacedBuilding;
  onUpgrade: () => void;
  onMove: () => void;
  onRemove: () => void;
  onClose: () => void;
  canUpgrade: boolean;
  upgradeCost: UpgradeCost | null;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

const TYPE_LABELS: Record<PlacedBuilding['buildingType'], string> = {
  defense: 'Defense',
  resource_collector: 'Resource',
  resource_storage: 'Storage',
  army: 'Army',
  other: 'Special',
};

export function BuildingPanel({
  building,
  onUpgrade,
  onMove,
  onRemove,
  onClose,
  canUpgrade,
  upgradeCost,
}: BuildingPanelProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 border-t-2 border-amber-500/60 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-amber-400">
              {building.buildingId}
            </h3>
            <span className="text-sm px-2 py-0.5 rounded bg-slate-700 text-slate-300">
              Level {building.level}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              {TYPE_LABELS[building.buildingType]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close panel"
          >
            x
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-slate-300 mb-3">
          <span>
            Position: ({building.gridX}, {building.gridY})
          </span>
          {building.isUpgrading && (
            <span className="text-amber-300">
              Upgrading... {formatTime(building.upgradeTimeRemaining)}
            </span>
          )}
        </div>

        {/* Upgrade info */}
        {upgradeCost && (
          <div className="text-sm text-slate-400 mb-3">
            Upgrade to Level {building.level + 1}:{' '}
            <span className="text-amber-300">
              {upgradeCost.amount.toLocaleString()} {upgradeCost.resource}
            </span>
            {' '}({formatTime(upgradeCost.time)})
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onUpgrade}
            disabled={!canUpgrade || building.isUpgrading}
            className="px-4 py-1.5 rounded font-semibold text-sm transition-colors bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Upgrade
          </button>
          <button
            onClick={onMove}
            className="px-4 py-1.5 rounded font-semibold text-sm transition-colors bg-slate-600 hover:bg-slate-500 text-white"
          >
            Move
          </button>
          {building.buildingId !== 'Town Hall' && (
            <button
              onClick={onRemove}
              className="px-4 py-1.5 rounded font-semibold text-sm transition-colors bg-red-700 hover:bg-red-600 text-white"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
