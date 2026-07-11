import { useState, useCallback, useMemo } from 'react';
import { MenuScreen } from './components/MenuScreen';
import { VillageScreen } from './components/VillageScreen';
import { BattleScreen } from './components/BattleScreen';
import { CampaignScreen } from './components/CampaignScreen';
import { LoadGameScreen } from './components/LoadGameScreen';
import type { VillageState } from './types/village.ts';
import type { BattleResult } from './types/battle.ts';
import { createStarterVillage } from './engine/village-manager.ts';
import { applyPostBattleHeroRecovery } from './engine/hero-manager.ts';
import { calculateOreReward, addOres, getOres } from './engine/ore-manager.ts';
import { applyBattleOutcome } from './engine/battle-result-handler.ts';
import {
  recordPlayerAttack,
  getEnemyWarBase,
  getNextAttackerIndex,
} from './engine/clan-war-manager.ts';
import { loadAutoSave } from './hooks/useAutoSave.ts';
import { recordBattleStats, createStatistics } from './engine/statistics-tracker.ts';
import { withAchievementSync } from './engine/achievement-sync.ts';

export type Screen = 'menu' | 'village' | 'battle' | 'campaign' | 'load';

/** Drop any war attack left pending by a reload; the battle never happened. */
function clearStaleWarAttack(state: VillageState): VillageState {
  return state.pendingWarAttack ? { ...state, pendingWarAttack: undefined } : state;
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  // Resume from the autosave so a page reload does not wipe progress
  const [villageState, setVillageState] = useState<VillageState>(
    () => clearStaleWarAttack(loadAutoSave() ?? createStarterVillage()),
  );

  // Leaving the battle screen without finishing cancels the pending war attack
  const handleNavigate = useCallback((next: Screen) => {
    setScreen(next);
    if (next !== 'battle') setVillageState(clearStaleWarAttack);
  }, []);

  // When a war attack is pending, the battle screen fights the enemy war base
  const warTarget = useMemo(() => {
    if (!villageState.pendingWarAttack || !villageState.war) return null;
    return getEnemyWarBase(villageState.war, villageState.pendingWarAttack.defenderIndex);
  }, [villageState.pendingWarAttack, villageState.war]);

  const handleCampaignComplete = useCallback(
    (levelNumber: number, stars: number, loot: { gold: number; elixir: number; darkElixir: number; gems?: number } | null) => {
      setVillageState((prev) => {
        // Loot is always awarded; the star record only updates on improvement
        let resources = prev.resources;
        if (loot) {
          resources = {
            ...prev.resources,
            gold: prev.resources.gold + loot.gold,
            elixir: prev.resources.elixir + loot.elixir,
            darkElixir: prev.resources.darkElixir + loot.darkElixir,
            gems: prev.resources.gems + (loot.gems ?? 0),
          };
        }

        const existing = prev.campaignProgress.levels.find((l) => l.levelNumber === levelNumber);
        if (existing && existing.stars >= stars) {
          return withAchievementSync({ ...prev, resources });
        }

        const updatedLevels = existing
          ? prev.campaignProgress.levels.map((l) =>
              l.levelNumber === levelNumber
                ? { ...l, stars, completed: stars > 0 }
                : l,
            )
          : [
              ...prev.campaignProgress.levels,
              { levelNumber, stars, completed: stars > 0 },
            ];

        const totalStars = updatedLevels.reduce((sum, l) => sum + l.stars, 0);

        return withAchievementSync({
          ...prev,
          campaignProgress: { levels: updatedLevels, totalStars },
          resources,
        });
      });
    },
    [],
  );

  const handleBattleComplete = useCallback((result: BattleResult) => {
    setVillageState((prev) => {
      // Every attack advances battle statistics, which in turn drives the
      // combat/resource achievements. Trophies are read pre-outcome so the
      // highest-trophy record reflects the real post-battle count.
      const statistics = recordBattleStats(
        prev.statistics ?? createStatistics(),
        { stars: result.stars, loot: result.loot, trophyChange: result.trophyChange },
        prev.trophies,
      );

      // War attacks record stars on the war map; loot arrives at war's end
      if (prev.pendingWarAttack && prev.war) {
        const attackerIndex = getNextAttackerIndex(prev.war);
        const war = attackerIndex >= 0
          ? recordPlayerAttack(
              prev.war,
              attackerIndex,
              prev.pendingWarAttack.defenderIndex,
              result.stars,
              result.destructionPercent,
            )
          : prev.war;
        return withAchievementSync({
          ...prev,
          statistics,
          war,
          pendingWarAttack: undefined,
          heroes: applyPostBattleHeroRecovery(prev.heroes, result.heroesDeployed ?? []),
        });
      }

      return withAchievementSync({
        // Loot, trophies, league, star bonus stars, and league bonus to treasury
        ...applyBattleOutcome(prev, result),
        statistics,
        heroes: applyPostBattleHeroRecovery(prev.heroes, result.heroesDeployed ?? []),
        ores: addOres(getOres(prev), calculateOreReward(result.stars, result.destructionPercent)),
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {screen === 'menu' && <MenuScreen onNavigate={handleNavigate} />}
      {screen === 'village' && (
        <VillageScreen
          onNavigate={handleNavigate}
          externalState={villageState}
          externalSetState={setVillageState}
        />
      )}
      {screen === 'battle' && (
        <BattleScreen
          onNavigate={handleNavigate}
          externalState={villageState}
          onBattleComplete={handleBattleComplete}
          {...(warTarget ? { enemyBase: warTarget, warMode: true } : {})}
        />
      )}
      {screen === 'campaign' && (
        <CampaignScreen
          onNavigate={handleNavigate}
          campaignProgress={villageState.campaignProgress}
          army={villageState.army}
          onCampaignComplete={handleCampaignComplete}
        />
      )}
      {screen === 'load' && <LoadGameScreen onNavigate={handleNavigate} onLoadGame={setVillageState} />}
    </div>
  );
}

export default App;
