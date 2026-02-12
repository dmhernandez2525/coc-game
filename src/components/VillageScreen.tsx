import type { Screen } from '../App';

interface VillageScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function VillageScreen({ onNavigate }: VillageScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-3xl font-bold">Village</h2>
      <p className="text-gray-400">Village view coming in Phase 2</p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onNavigate('battle')}
          className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
        >
          Attack
        </button>
        <button
          onClick={() => onNavigate('menu')}
          className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
        >
          Menu
        </button>
      </div>
    </div>
  );
}
