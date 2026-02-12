import type { ResourceAmounts } from '../types/village.ts';
import type { TroopData } from '../types/troops.ts';
import { formatResource } from '../utils/resource-format.ts';
import { formatDuration } from '../utils/resource-format.ts';

interface LabPanelProps {
  labLevel: number;
  troops: TroopData[];
  troopLevels: Record<string, number>;
  resources: ResourceAmounts;
  onResearch: (troopName: string) => void;
  onClose: () => void;
}

function canAffordUpgrade(
  cost: number,
  resource: string,
  resources: ResourceAmounts,
): boolean {
  const key = resource as keyof ResourceAmounts;
  return resources[key] >= cost;
}

export function LabPanel({
  labLevel,
  troops,
  troopLevels,
  resources,
  onResearch,
  onClose,
}: LabPanelProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-amber-400">Laboratory</h2>
            <span className="text-sm px-2 py-0.5 rounded bg-slate-700 text-slate-300">
              Level {labLevel}
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

        {/* Research list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {troops.map((troop) => {
            const currentLevel = troopLevels[troop.name] ?? 1;
            const maxLevel = troop.levels.length;
            const isMaxed = currentLevel >= maxLevel;
            const nextLevelData = troop.levels[currentLevel];

            const labRequired = nextLevelData?.labLevelRequired ?? 0;
            const labTooLow = !isMaxed && labRequired !== null && labRequired > labLevel;

            const upgradeCost = nextLevelData?.upgradeCost ?? 0;
            const upgradeResource = nextLevelData?.upgradeResource ?? 'elixir';
            const upgradeTime = nextLevelData?.upgradeTime ?? 0;

            const affordable = !isMaxed && canAffordUpgrade(upgradeCost, upgradeResource, resources);
            const disabled = isMaxed || !affordable || labTooLow;

            return (
              <div
                key={troop.name}
                className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{troop.name}</span>
                    {isMaxed ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300 font-semibold">
                        Max
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Lv {currentLevel} &rarr; {currentLevel + 1}
                      </span>
                    )}
                  </div>
                  {!isMaxed && (
                    <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                      <span className={affordable ? 'text-amber-300' : 'text-red-400'}>
                        {formatResource(upgradeCost)} {upgradeResource}
                      </span>
                      <span>{formatDuration(upgradeTime)}</span>
                      {labTooLow && (
                        <span className="text-red-400">Lab Lv {labRequired} req.</span>
                      )}
                    </div>
                  )}
                </div>
                {!isMaxed && (
                  <button
                    onClick={() => onResearch(troop.name)}
                    disabled={disabled}
                    className="px-3 py-1 rounded text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Research
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
