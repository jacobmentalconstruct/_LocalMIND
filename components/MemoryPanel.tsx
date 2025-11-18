
import React from 'react';
import { MemoryItem } from '../types';
import { TrashIcon, BrainCircuitIcon, EraserIcon } from './icons';

interface MemoryPanelProps {
  memoryItems: MemoryItem[];
  onDelete: (id: string) => void;
  onClear: () => void;
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ memoryItems, onDelete, onClear }) => {
  return (
    <aside className="w-1/3 max-w-sm flex flex-col bg-gray-800 border-r border-gray-700 h-screen">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BrainCircuitIcon className="w-6 h-6 text-indigo-400" />
          Long-Term Memory
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Saved facts and context. Toggle "Use Memory" to include this in prompts.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {memoryItems.length === 0 ? (
          <div className="text-center text-gray-500 px-4 py-8">
            <p>No memories saved.</p>
            <p className="text-xs mt-2">Click the save icon on an assistant's message to add it here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {memoryItems.map((item) => (
              <li key={item.id} className="group flex items-start gap-2 p-2 bg-gray-700/50 rounded-md text-sm">
                <span className="flex-1 pt-1">{item.content}</span>
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1 rounded text-gray-500 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete memory item"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {memoryItems.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClear}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 rounded-md hover:bg-red-500/20 transition-colors"
          >
            <EraserIcon className="w-4 h-4" />
            Clear All Memories
          </button>
        </div>
      )}
    </aside>
  );
};

export default MemoryPanel;
