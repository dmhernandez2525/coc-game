interface SettingsPanelProps {
  gameSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onResetProgress: () => void;
  onClose: () => void;
}

const SPEED_OPTIONS = [1, 10, 100] as const;

export function SettingsPanel({
  gameSpeed,
  onChangeSpeed,
  onResetProgress,
  onClose,
}: SettingsPanelProps) {
  function handleReset() {
    const confirmed = window.confirm(
      'Are you sure you want to reset all progress? This cannot be undone.',
    );
    if (confirmed) onResetProgress();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/60 rounded-lg shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-400">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close settings"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-5">
          {/* Game Speed */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Game Speed
            </label>
            <div className="flex gap-2">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => onChangeSpeed(speed)}
                  className={`flex-1 py-2 rounded text-sm font-semibold transition-colors ${
                    gameSpeed === speed
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Reset Progress */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Danger Zone
            </label>
            <button
              onClick={handleReset}
              className="w-full py-2 rounded text-sm font-semibold bg-red-800 hover:bg-red-700 text-red-100 transition-colors"
            >
              Reset Progress
            </button>
            <p className="text-xs text-slate-500 mt-1">
              This will erase all saved data and start fresh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
