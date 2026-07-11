import { useState } from 'react';
import type { OwnedHero, OreAmounts, OwnedLevelEntry, ResourceAmounts } from '../types/village.ts';
import {
  getAvailableHeroes,
  getHeroStats,
  getHeroAbilityInfo,
  getHeroUpgradeCost,
  isHeroAvailableForBattle,
} from '../engine/hero-manager.ts';
import { equipItem, unequipItem } from '../engine/equipment-manager.ts';
import { assignPet, unassignPet } from '../engine/pet-manager.ts';
import { formatDuration, formatResource } from '../utils/resource-format.ts';
import { EquipmentPanel } from './EquipmentPanel.tsx';
import { PetPanel } from './PetPanel.tsx';

// -- Types --

interface HeroPanelProps {
  heroes: OwnedHero[];
  townHallLevel: number;
  ores: OreAmounts;
  ownedEquipment: OwnedLevelEntry[];
  ownedPets: OwnedLevelEntry[];
  blacksmithLevel: number;
  petHouseLevel: number;
  resources: ResourceAmounts;
  onUpdateHero: (heroName: string, updatedHero: OwnedHero) => void;
  onUpgradeHero: (heroName: string) => void;
  onUpgradeEquipment: (equipmentName: string) => void;
  onUpgradePet: (petName: string) => void;
  onClose: () => void;
}

type ManagePanel = { heroName: string; type: 'equipment' | 'pet' } | null;

// -- Helpers --

function getStatusLabel(hero: OwnedHero): { text: string; color: string } {
  if (hero.isUpgrading) {
    return {
      text: `Upgrading (${formatDuration(hero.upgradeTimeRemaining)})`,
      color: 'text-blue-400',
    };
  }
  if (hero.isRecovering) {
    return {
      text: `Recovering (${formatDuration(hero.recoveryTimeRemaining)})`,
      color: 'text-orange-400',
    };
  }
  return { text: 'Available', color: 'text-green-400' };
}

/** Why the hero cannot start an upgrade right now, or null when it can. */
function getHeroUpgradeBlockReason(hero: OwnedHero, resources: ResourceAmounts): string | null {
  if (hero.isUpgrading) return 'Already upgrading';
  if (hero.isRecovering) return 'Recovering';

  const upgrade = getHeroUpgradeCost(hero.name, hero.level);
  if (!upgrade) return 'Max level';
  if (resources[upgrade.resourceKey] < upgrade.cost) return `Not enough ${upgrade.resource}`;
  return null;
}

// -- Hero Card --

function HeroCard({
  hero,
  resources,
  onUpgradeHero,
  onManage,
}: {
  hero: OwnedHero;
  resources: ResourceAmounts;
  onUpgradeHero: (heroName: string) => void;
  onManage: (heroName: string, type: 'equipment' | 'pet') => void;
}) {
  const stats = getHeroStats(hero.name, hero.level);
  const status = getStatusLabel(hero);
  const available = isHeroAvailableForBattle(hero);
  const ability = getHeroAbilityInfo(hero.name);
  const upgrade = getHeroUpgradeCost(hero.name, hero.level);
  const blockReason = getHeroUpgradeBlockReason(hero, resources);
  const equippedCount = hero.equippedItems.filter((item) => item !== null).length;

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-3">
      {/* Hero header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{hero.name}</h3>
          <span className="text-xs text-slate-400">Level {hero.level}</span>
        </div>
        <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
      </div>

      {/* HP bar */}
      {stats && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>HP</span>
            <span>
              {hero.currentHp} / {stats.hitpoints}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${available ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{
                width: `${Math.min((hero.currentHp / stats.hitpoints) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span>DPS: {stats.dps}</span>
            {stats.abilityLevel !== null && <span>Ability Lv {stats.abilityLevel}</span>}
          </div>
        </div>
      )}

      {/* Ability description */}
      {ability && (
        <div className="text-xs bg-slate-700/50 rounded px-2 py-1.5">
          <span className="text-amber-300 font-semibold">{ability.name}:</span>{' '}
          <span className="text-slate-400">{ability.description}</span>
        </div>
      )}

      {/* Hero upgrade */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {upgrade
            ? `Upgrade: ${formatResource(upgrade.cost)} ${upgrade.resource}`
            : 'Max level reached'}
        </span>
        {upgrade && (
          <button
            onClick={() => onUpgradeHero(hero.name)}
            disabled={blockReason !== null}
            title={blockReason ?? undefined}
            className="px-3 py-1 rounded text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Upgrade ${hero.name}`}
          >
            Upgrade
          </button>
        )}
      </div>
      {blockReason && blockReason !== 'Max level' && !hero.isUpgrading && (
        <p className="text-xs text-red-400">{blockReason}</p>
      )}

      {/* Equipment summary */}
      <div className="flex items-center justify-between bg-slate-700/50 rounded px-2 py-1.5">
        <div className="text-xs">
          <span className="text-slate-500 mr-1">Equipment:</span>
          {equippedCount > 0 ? (
            <span className="text-amber-300">
              {hero.equippedItems.filter((item) => item !== null).join(', ')}
            </span>
          ) : (
            <span className="text-slate-500 italic">None equipped</span>
          )}
        </div>
        <button
          onClick={() => onManage(hero.name, 'equipment')}
          className="px-2 py-0.5 rounded text-xs bg-cyan-700/60 hover:bg-cyan-600 text-cyan-100 transition-colors shrink-0"
          aria-label={`Manage equipment for ${hero.name}`}
        >
          Manage
        </button>
      </div>

      {/* Pet summary */}
      <div className="flex items-center justify-between bg-slate-700/50 rounded px-2 py-1.5">
        <div className="text-xs">
          <span className="text-slate-500 mr-1">Pet:</span>
          {hero.assignedPet ? (
            <span className="text-purple-300">{hero.assignedPet}</span>
          ) : (
            <span className="text-slate-500 italic">No Pet</span>
          )}
        </div>
        <button
          onClick={() => onManage(hero.name, 'pet')}
          className="px-2 py-0.5 rounded text-xs bg-purple-600/60 hover:bg-purple-500 text-purple-100 transition-colors shrink-0"
          aria-label={`Manage pet for ${hero.name}`}
        >
          Manage
        </button>
      </div>
    </div>
  );
}

// -- Main Panel --

export function HeroPanel({
  heroes,
  townHallLevel,
  ores,
  ownedEquipment,
  ownedPets,
  blacksmithLevel,
  petHouseLevel,
  resources,
  onUpdateHero,
  onUpgradeHero,
  onUpgradeEquipment,
  onUpgradePet,
  onClose,
}: HeroPanelProps) {
  const [managePanel, setManagePanel] = useState<ManagePanel>(null);
  const availableHeroDefinitions = getAvailableHeroes(townHallLevel);
  const hasHeroes = heroes.length > 0 || availableHeroDefinitions.length > 0;
  const managedHero = managePanel
    ? heroes.find((h) => h.name === managePanel.heroName) ?? null
    : null;

  const handleEquip = (slotIndex: 0 | 1, equipmentName: string) => {
    if (!managedHero) return;
    const updated = equipItem(managedHero, slotIndex, equipmentName);
    if (updated) {
      onUpdateHero(managedHero.name, updated);
    }
  };

  const handleUnequip = (slotIndex: 0 | 1) => {
    if (!managedHero) return;
    onUpdateHero(managedHero.name, unequipItem(managedHero, slotIndex));
  };

  const handleAssignPet = (petName: string) => {
    if (!managedHero) return;
    const updated = assignPet(managedHero, petName, heroes);
    if (updated) {
      onUpdateHero(managedHero.name, updated);
    }
  };

  const handleUnassignPet = () => {
    if (!managedHero) return;
    onUpdateHero(managedHero.name, unassignPet(managedHero));
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-400">Heroes</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close hero panel"
        >
          x
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!hasHeroes ? (
          <p className="text-sm text-slate-500 italic text-center py-8">
            Heroes unlock at higher Town Hall levels.
          </p>
        ) : heroes.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-8">
            No heroes owned yet. Build a hero altar to unlock heroes.
          </p>
        ) : (
          heroes.map((hero) => (
            <HeroCard
              key={hero.name}
              hero={hero}
              resources={resources}
              onUpgradeHero={onUpgradeHero}
              onManage={(heroName, type) => setManagePanel({ heroName, type })}
            />
          ))
        )}
      </div>

      {/* Equipment management sub-panel */}
      {managedHero && managePanel?.type === 'equipment' && (
        <EquipmentPanel
          hero={managedHero}
          ownedEquipment={ownedEquipment}
          ores={ores}
          blacksmithLevel={blacksmithLevel}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onUpgradeEquipment={onUpgradeEquipment}
          onClose={() => setManagePanel(null)}
        />
      )}

      {/* Pet management sub-panel */}
      {managedHero && managePanel?.type === 'pet' && (
        <PetPanel
          hero={managedHero}
          allHeroes={heroes}
          ownedPets={ownedPets}
          townHallLevel={townHallLevel}
          petHouseLevel={petHouseLevel}
          darkElixir={resources.darkElixir}
          onAssign={handleAssignPet}
          onUnassign={handleUnassignPet}
          onUpgradePet={onUpgradePet}
          onClose={() => setManagePanel(null)}
        />
      )}
    </div>
  );
}
