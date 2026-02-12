import type { TrainedTroop, ResourceAmounts } from '../types/village.ts';
import { formatResource } from '../utils/resource-format.ts';

interface AvailableSpell {
  name: string;
  housingSpace: number;
  cost: number;
  costResource: string;
}

interface SpellPanelProps {
  spells: TrainedTroop[];
  availableSpells: AvailableSpell[];
  spellCapacityUsed: number;
  spellCapacityMax: number;
  resources: ResourceAmounts;
  onTrainSpell: (spellName: string) => void;
  onRemoveSpell: (spellName: string) => void;
  onClose: () => void;
}

const RES_MAP: Record<string, keyof ResourceAmounts> = {
  Gold: 'gold',
  Elixir: 'elixir',
  'Dark Elixir': 'darkElixir',
};

function canAfford(cost: number, costResource: string, resources: ResourceAmounts): boolean {
  const key = RES_MAP[costResource];
  if (!key) return false;
  return resources[key] >= cost;
}

export function SpellPanel({
  spells,
  availableSpells,
  spellCapacityUsed,
  spellCapacityMax,
  resources,
  onTrainSpell,
  onRemoveSpell,
  onClose,
}: SpellPanelProps) {
  const capacityPercent = spellCapacityMax > 0
    ? Math.min((spellCapacityUsed / spellCapacityMax) * 100, 100)
    : 0;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-amber-400">Spells</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close spells"
          >
            x
          </button>
        </div>
        {/* Capacity bar */}
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span>{spellCapacityUsed} / {spellCapacityMax}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Current Spells */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Current Spells
          </h3>
          {spells.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No spells trained yet.</p>
          ) : (
            <div className="space-y-1">
              {spells.map((spell) => (
                <div
                  key={spell.name}
                  className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
                >
                  <div>
                    <span className="text-sm text-white">{spell.name}</span>
                    <span className="ml-2 text-xs text-purple-300">x{spell.count}</span>
                  </div>
                  <button
                    onClick={() => onRemoveSpell(spell.name)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                    aria-label={`Remove ${spell.name}`}
                  >
                    -
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available Spells */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Available Spells
          </h3>
          <div className="space-y-1">
            {availableSpells.map((spell) => {
              const affordable = canAfford(spell.cost, spell.costResource, resources);
              const hasSpace = spellCapacityUsed + spell.housingSpace <= spellCapacityMax;
              const disabled = !affordable || !hasSpace;

              return (
                <div
                  key={spell.name}
                  className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{spell.name}</span>
                    <div className="flex gap-3 text-xs text-slate-400">
                      <span>Space: {spell.housingSpace}</span>
                      <span className={affordable ? 'text-purple-300' : 'text-red-400'}>
                        {formatResource(spell.cost)} {spell.costResource}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onTrainSpell(spell.name)}
                    disabled={disabled}
                    className="w-7 h-7 flex items-center justify-center rounded bg-purple-600 hover:bg-purple-500 text-white text-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Train ${spell.name}`}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
