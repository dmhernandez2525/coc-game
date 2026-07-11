import { useState } from 'react';
import type { LayoutPresetMeta } from '../engine/layout-presets.ts';
import { MAX_LAYOUT_PRESETS } from '../engine/layout-presets.ts';

interface LayoutPresetsPanelProps {
  presets: LayoutPresetMeta[];
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function LayoutPresetsPanel({ presets, onSave, onLoad, onDelete, onClose }: LayoutPresetsPanelProps) {
  const [name, setName] = useState('');
  const atCapacity = presets.length >= MAX_LAYOUT_PRESETS;

  const handleSave = () => {
    if (atCapacity) return;
    onSave(name);
    setName('');
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div>
          <h3 className="text-lg font-bold text-amber-400">Layout Presets</h3>
          <p className="text-xs text-slate-400">
            Save and switch village arrangements. Resources are never affected.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close layout presets"
        >
          x
        </button>
      </div>

      {/* Save new */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Layout name"
            maxLength={24}
            disabled={atCapacity}
            className="flex-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
          />
          <button
            onClick={handleSave}
            disabled={atCapacity}
            className="px-3 py-1.5 rounded text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {presets.length} / {MAX_LAYOUT_PRESETS} slots used
          {atCapacity && ' (delete one to save a new layout)'}
        </p>
      </div>

      {/* Preset list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {presets.map((preset) => (
          <div key={preset.id} className="rounded-lg bg-slate-800 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-white truncate">{preset.name}</span>
              <span className="text-[10px] text-slate-500 shrink-0 ml-2">TH{preset.townHallLevel}</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">{formatTimestamp(preset.timestamp)}</p>
            <div className="flex gap-2">
              <button
                onClick={() => onLoad(preset.id)}
                className="flex-1 px-2 py-1 rounded text-xs font-semibold bg-sky-700 hover:bg-sky-600 text-white transition-colors"
              >
                Load
              </button>
              <button
                onClick={() => onDelete(preset.id)}
                className="px-2 py-1 rounded text-xs font-semibold bg-slate-700 hover:bg-red-700 text-slate-200 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {presets.length === 0 && (
          <p className="text-center text-slate-500 py-8 text-sm">
            No saved layouts yet. Arrange your village, then save it here.
          </p>
        )}
      </div>
    </div>
  );
}
