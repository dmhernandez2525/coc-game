import { useState } from 'react';
import type { ReactNode } from 'react';
import { MenuScreen } from './components/MenuScreen';
import { VillageScreen } from './components/VillageScreen';
import { BattleScreen } from './components/BattleScreen';
import { CampaignScreen } from './components/CampaignScreen';
import { LoadGameScreen } from './components/LoadGameScreen';

export type Screen = 'menu' | 'village' | 'battle' | 'campaign' | 'load';

const screens: Record<Screen, (props: { onNavigate: (s: Screen) => void }) => ReactNode> = {
  menu: (props) => <MenuScreen onNavigate={props.onNavigate} />,
  village: (props) => <VillageScreen onNavigate={props.onNavigate} />,
  battle: (props) => <BattleScreen onNavigate={props.onNavigate} />,
  campaign: (props) => <CampaignScreen onNavigate={props.onNavigate} />,
  load: (props) => <LoadGameScreen onNavigate={props.onNavigate} />,
};

function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  const ScreenComponent = screens[screen];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <ScreenComponent onNavigate={setScreen} />
    </div>
  );
}

export default App;
