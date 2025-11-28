import React, { useState } from 'react';
import { SparklesIcon } from './icons';
import { MemoryItem } from '../types';

interface SuggestionsPanelProps {
  proposedItems: MemoryItem[];
  onEdit: (item: MemoryItem) => void;
}

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({ proposedItems, onEdit }) => {
  const [suggestionLimit, setSuggestionLimit] = useState<number>(3);

  return (
    <div className="shrink-0 h-[20%] min-h-[120px] border-t border-gray-700 bg-blue-900/5 flex flex-col">
      <div className="px-3 py-2 border-b border-blue-900/20 bg-blue-900/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">Suggested Memories</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-blue-400">
          <button onClick={() => setSuggestionLimit(prev => Math.max(1, prev - 1))} className="px-1 py-0.5 border border-blue-500/40 rounded hover:bg-blue-900/40">-</button>
          <span className="px-1 font-mono">{Math.min(suggestionLimit, proposedItems.length)}</span>
          <button onClick={() => setSuggestionLimit(prev => Math.min(5, prev + 1))} className="px-1 py-0.5 border border-blue-500/40 rounded hover:bg-blue-900/40">+</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-blue-900/20">
        {proposedItems.length === 0 ? (
          <div className="text-center text-blue-500/40 text-[10px] py-4 italic">
            Monitoring inference cycle...
          </div>
        ) : (
          <ul className="space-y-2">
            {proposedItems.slice(0, suggestionLimit).map(item => (
              <li key={item.id}>
                <button
                  onClick={() => onEdit(item)}
                  className="w-full text-left p-2 bg-gray-800 border border-blue-500/20 rounded text-[11px] text-blue-200 hover:border-blue-400/50 transition-all leading-tight break-words"
                >
                  {item.content}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SuggestionsPanel;