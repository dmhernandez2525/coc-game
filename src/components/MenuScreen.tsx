import type { Screen } from '../App';

interface MenuScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function MenuScreen({ onNavigate }: MenuScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-5xl font-bold text-yellow-400">Clash of Clans</h1>
      <p className="text-gray-400 text-lg">Single Player Edition</p>
      <div className="flex flex-col gap-3 mt-8">
        <button
          onClick={() => onNavigate('village')}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-lg font-semibold transition-colors"
        >
          Play
        </button>
        <button
          onClick={() => onNavigate('campaign')}
          className="px-8 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg text-lg font-semibold transition-colors"
        >
          Campaign
        </button>
        <button
          onClick={() => onNavigate('load')}
          className="px-8 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg text-lg font-semibold transition-colors"
        >
          Load Game
        </button>
      </div>
    </div>
  );
}
