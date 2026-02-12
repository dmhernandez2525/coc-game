import { useState, useCallback } from 'react';
import type { Screen } from '../App.tsx';
import { createSaveManager } from '../engine/save-manager.ts';
import type { SaveSlot } from '../engine/save-manager.ts';

interface LoadGameScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function LoadGameScreen({ onNavigate }: LoadGameScreenProps) {
  const [manager] = useState(() => createSaveManager());
  const [slots, setSlots] = useState<SaveSlot[]>(() => manager.listSlots());
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setSlots(manager.listSlots());
  }, [manager]);

  const handleLoad = useCallback(
    (slotId: string) => {
      const state = manager.load(slotId);
      if (state) {
        setMessage('Game loaded! Returning to village...');
        setTimeout(() => onNavigate('village'), 500);
      } else {
        setMessage('Failed to load save file.');
        setTimeout(() => setMessage(null), 2000);
      }
    },
    [manager, onNavigate],
  );

  const handleDelete = useCallback(
    (slotId: string) => {
      manager.delete(slotId);
      refresh();
      setMessage('Save deleted.');
      setTimeout(() => setMessage(null), 1500);
    },
    [manager, refresh],
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-slate-900">
      <h1 className="text-3xl font-bold text-amber-400">Saved Games</h1>

      {message && (
        <div className="px-4 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
          {message}
        </div>
      )}

      {slots.length === 0 ? (
        <p className="text-slate-500">No saved games found.</p>
      ) : (
        <div className="w-full max-w-md flex flex-col gap-2 px-4">
          {slots.slice(0, 5).map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">{slot.name}</p>
                <p className="text-xs text-slate-400">
                  TH{slot.townHallLevel} · {new Date(slot.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLoad(slot.id)}
                  className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-semibold transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => {
                    const confirmed = window.confirm('Delete this save?');
                    if (confirmed) handleDelete(slot.id);
                  }}
                  className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs font-semibold transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onNavigate('menu')}
        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors mt-4"
      >
        Back to Menu
      </button>
    </div>
  );
}
