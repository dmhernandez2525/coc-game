interface SaveLoadPanelProps {
  slots: Array<{ id: string; name: string; timestamp: number; townHallLevel: number }>;
  onSave: (slotId: string) => void;
  onLoad: (slotId: string) => void;
  onDelete: (slotId: string) => void;
  onClose: () => void;
}

const MAX_DISPLAYED_SLOTS = 5;

export function SaveLoadPanel({ slots, onSave, onLoad, onDelete, onClose }: SaveLoadPanelProps) {
  function handleDelete(slotId: string, slotName: string) {
    const confirmed = window.confirm(`Delete save "${slotName}"? This cannot be undone.`);
    if (confirmed) onDelete(slotId);
  }

  const displayedSlots = slots.slice(0, MAX_DISPLAYED_SLOTS);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/60 rounded-lg shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-400">Save / Load</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close save load panel"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          {/* Quick Save */}
          <button
            onClick={() => onSave('slot1')}
            className="w-full py-2 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            Quick Save
          </button>

          {/* Save Slots */}
          {displayedSlots.length === 0 ? (
            <p className="text-center text-slate-500 py-6 text-sm">No saved games yet.</p>
          ) : (
            <div className="space-y-2">
              {displayedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="bg-slate-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-white">{slot.name}</span>
                    <span className="text-xs text-slate-400">TH {slot.townHallLevel}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {new Date(slot.timestamp).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onLoad(slot.id)}
                      className="flex-1 py-1.5 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(slot.id, slot.name)}
                      className="flex-1 py-1.5 rounded text-xs font-semibold bg-red-800/60 hover:bg-red-700 text-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
