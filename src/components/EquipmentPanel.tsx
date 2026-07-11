import type { OwnedHero, OreAmounts, OwnedLevelEntry } from '../types/village.ts';
import type { HeroEquipmentData } from '../types/troops.ts';
import {
  getUpgradeCost,
  getBlacksmithRequirement,
  getEquipmentBonuses,
  getMaxLevel,
  isMaxLevel,
  canAffordUpgrade,
} from '../engine/equipment-manager.ts';
import { heroEquipment } from '../data/loaders/hero-loader.ts';

// -- Types --

interface EquipmentPanelProps {
  hero: OwnedHero;
  ownedEquipment: OwnedLevelEntry[];
  ores: OreAmounts;
  blacksmithLevel: number;
  onEquip: (slotIndex: 0 | 1, equipmentName: string) => void;
  onUnequip: (slotIndex: 0 | 1) => void;
  onUpgradeEquipment: (equipmentName: string) => void;
  onClose: () => void;
}

interface NamedEquipment {
  name: string;
  data: HeroEquipmentData;
}

// -- Helpers --

function getNamedEquipmentForHero(heroName: string): NamedEquipment[] {
  return Object.entries(heroEquipment)
    .filter(([, eq]) => eq.hero === heroName)
    .map(([name, data]) => ({ name, data }));
}

function getEquipmentLevel(owned: OwnedLevelEntry[], name: string): number {
  return owned.find((e) => e.name === name)?.level ?? 1;
}

function getEquippedSlot(hero: OwnedHero, name: string): 0 | 1 | null {
  if (hero.equippedItems[0] === name) return 0;
  if (hero.equippedItems[1] === name) return 1;
  return null;
}

/** Reason an upgrade is blocked, or null when it can go ahead. */
function getUpgradeBlockReason(
  name: string, level: number, ores: OreAmounts, blacksmithLevel: number,
): string | null {
  if (isMaxLevel(name, level)) return 'Max level';

  const requiredBlacksmith = getBlacksmithRequirement(name, level);
  if (requiredBlacksmith !== null && blacksmithLevel < requiredBlacksmith) {
    return `Requires Blacksmith level ${requiredBlacksmith}`;
  }

  if (!canAffordUpgrade(name, level, ores)) return 'Not enough ores';
  return null;
}

function formatOreCost(cost: { shinyOre: number; glowyOre: number; starryOre: number }): string {
  const parts: string[] = [];
  if (cost.shinyOre > 0) parts.push(`${cost.shinyOre} Shiny`);
  if (cost.glowyOre > 0) parts.push(`${cost.glowyOre} Glowy`);
  if (cost.starryOre > 0) parts.push(`${cost.starryOre} Starry`);
  return parts.length > 0 ? parts.join(', ') : 'Free';
}

// -- Equipment Card --

function EquipmentCard({
  item,
  hero,
  level,
  ores,
  blacksmithLevel,
  blacksmithBuilt,
  onEquip,
  onUnequip,
  onUpgradeEquipment,
}: {
  item: NamedEquipment;
  hero: OwnedHero;
  level: number;
  ores: OreAmounts;
  blacksmithLevel: number;
  blacksmithBuilt: boolean;
  onEquip: (slotIndex: 0 | 1, equipmentName: string) => void;
  onUnequip: (slotIndex: 0 | 1) => void;
  onUpgradeEquipment: (equipmentName: string) => void;
}) {
  const equippedSlot = getEquippedSlot(hero, item.name);
  const upgradeCost = getUpgradeCost(item.name, level);
  const blockReason = getUpgradeBlockReason(item.name, level, ores, blacksmithLevel);

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-amber-300">{item.name}</span>
          <span className="ml-2 text-xs text-slate-500 capitalize">{item.data.rarity}</span>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">
          Lv {level} / {getMaxLevel(item.name)}
        </span>
      </div>

      <p className="text-xs text-slate-500">{item.data.description}</p>

      {/* Equip / unequip actions */}
      <div className="flex items-center gap-1">
        {equippedSlot !== null ? (
          <>
            <span className="text-xs text-green-400 mr-1">Equipped (Slot {equippedSlot + 1})</span>
            <button
              onClick={() => onUnequip(equippedSlot)}
              className="px-2 py-0.5 rounded text-xs bg-red-700/60 hover:bg-red-600 text-red-200 transition-colors"
              aria-label={`Unequip ${item.name}`}
            >
              Remove
            </button>
          </>
        ) : (
          ([0, 1] as const).map((slotIndex) => (
            <button
              key={slotIndex}
              onClick={() => onEquip(slotIndex, item.name)}
              disabled={!blacksmithBuilt}
              className="px-2 py-0.5 rounded text-xs bg-amber-600/60 hover:bg-amber-500 text-amber-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={`Equip ${item.name} to slot ${slotIndex + 1}`}
            >
              Equip Slot {slotIndex + 1}
            </button>
          ))
        )}
      </div>

      {/* Upgrade action */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {upgradeCost ? `Upgrade: ${formatOreCost(upgradeCost)}` : 'Max level reached'}
        </span>
        {upgradeCost && (
          <button
            onClick={() => onUpgradeEquipment(item.name)}
            disabled={!blacksmithBuilt || blockReason !== null}
            title={blockReason ?? undefined}
            className="px-2 py-0.5 rounded text-xs bg-cyan-700/60 hover:bg-cyan-600 text-cyan-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Upgrade ${item.name}`}
          >
            Upgrade
          </button>
        )}
      </div>
      {blockReason && blockReason !== 'Max level' && blacksmithBuilt && (
        <p className="text-xs text-red-400">{blockReason}</p>
      )}
    </div>
  );
}

// -- Main Panel --

export function EquipmentPanel({
  hero,
  ownedEquipment,
  ores,
  blacksmithLevel,
  onEquip,
  onUnequip,
  onUpgradeEquipment,
  onClose,
}: EquipmentPanelProps) {
  const blacksmithBuilt = blacksmithLevel > 0;
  const equipmentList = getNamedEquipmentForHero(hero.name);
  const equipmentLevels = Object.fromEntries(ownedEquipment.map((e) => [e.name, e.level]));
  const bonuses = getEquipmentBonuses(hero, equipmentLevels);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-slate-900/95 border-l-2 border-cyan-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-cyan-400">Equipment</h2>
          <span className="text-xs text-slate-400">{hero.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close equipment panel"
        >
          x
        </button>
      </div>

      {/* Ore balance */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-3 text-xs tabular-nums">
        <span className="text-cyan-300">Shiny: {ores.shinyOre}</span>
        <span className="text-purple-300">Glowy: {ores.glowyOre}</span>
        <span className="text-amber-300">Starry: {ores.starryOre}</span>
        <span className="ml-auto text-slate-500">
          {blacksmithBuilt ? `Blacksmith Lv ${blacksmithLevel}` : 'No Blacksmith'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!blacksmithBuilt && (
          <p className="text-xs text-orange-400 bg-orange-950/40 rounded px-3 py-2">
            Build the Blacksmith to equip and upgrade Hero Equipment.
          </p>
        )}

        {/* Combined bonuses from currently equipped items */}
        <div className="text-xs text-slate-400 bg-slate-800/60 rounded px-3 py-2">
          <span className="text-slate-500 uppercase tracking-wide mr-2">Equipped bonus:</span>
          +{bonuses.hitpointIncrease} HP, +{bonuses.damageIncrease} DMG, +{bonuses.speedIncrease} SPD
        </div>

        {equipmentList.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-8">
            No equipment exists for this hero.
          </p>
        ) : (
          equipmentList.map((item) => (
            <EquipmentCard
              key={item.name}
              item={item}
              hero={hero}
              level={getEquipmentLevel(ownedEquipment, item.name)}
              ores={ores}
              blacksmithLevel={blacksmithLevel}
              blacksmithBuilt={blacksmithBuilt}
              onEquip={onEquip}
              onUnequip={onUnequip}
              onUpgradeEquipment={onUpgradeEquipment}
            />
          ))
        )}
      </div>
    </div>
  );
}
