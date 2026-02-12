import { useState, useCallback } from 'react';
import { MenuScreen } from './components/MenuScreen';
import { VillageScreen } from './components/VillageScreen';
import { BattleScreen } from './components/BattleScreen';
import { CampaignScreen } from './components/CampaignScreen';
import { LoadGameScreen } from './components/LoadGameScreen';
import type { VillageState } from './types/village.ts';
import { createStarterVillage } from './engine/village-manager.ts';

export type Screen = 'menu' | 'village' | 'battle' | 'campaign' | 'load';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [villageState, setVillageState] = useState<VillageState>(createStarterVillage);

  const handleCampaignComplete = useCallback(
    (levelNumber: number, stars: number, loot: { gold: number; elixir: number; darkElixir: number } | null) => {
      setVillageState((prev) => {
        const existing = prev.campaignProgress.levels.find((l) => l.levelNumber === levelNumber);
        if (existing && existing.stars >= stars) return prev;

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

        let resources = prev.resources;
        if (loot) {
          resources = {
            ...prev.resources,
            gold: prev.resources.gold + loot.gold,
            elixir: prev.resources.elixir + loot.elixir,
            darkElixir: prev.resources.darkElixir + loot.darkElixir,
          };
        }

        return {
          ...prev,
          campaignProgress: { levels: updatedLevels, totalStars },
          resources,
        };
      });
    },
    [],
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {screen === 'menu' && <MenuScreen onNavigate={setScreen} />}
      {screen === 'village' && (
        <VillageScreen
          onNavigate={setScreen}
          externalState={villageState}
          externalSetState={setVillageState}
        />
      )}
      {screen === 'battle' && <BattleScreen onNavigate={setScreen} />}
      {screen === 'campaign' && (
        <CampaignScreen
          onNavigate={setScreen}
          campaignProgress={villageState.campaignProgress}
          army={villageState.army}
          onCampaignComplete={handleCampaignComplete}
        />
      )}
      {screen === 'load' && <LoadGameScreen onNavigate={setScreen} />}
    </div>
  );
}

export default App;
