import type { Screen } from '../App';

interface BattleScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function BattleScreen({ onNavigate }: BattleScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-3xl font-bold">Battle</h2>
      <p className="text-gray-400">Battle system coming in Phase 5</p>
      <button
        onClick={() => onNavigate('village')}
        className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
      >
        Return to Village
      </button>
    </div>
  );
}
