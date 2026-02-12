import type { Screen } from '../App';

interface CampaignScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function CampaignScreen({ onNavigate }: CampaignScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-3xl font-bold">Campaign</h2>
      <p className="text-gray-400">Single player campaign coming in Phase 8</p>
      <button
        onClick={() => onNavigate('menu')}
        className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
      >
        Back to Menu
      </button>
    </div>
  );
}
