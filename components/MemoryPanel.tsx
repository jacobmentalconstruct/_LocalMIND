// components/MemoryPanel.tsx
import React, { useState, useEffect } from 'react';
import { MemoryItem } from '../types';
import { TrashIcon, BrainCircuitIcon, BookIcon, SparklesIcon, PlusIcon, PencilIcon } from './icons'; 
import { getSessionSummary } from '../services/ollamaService';

interface MemoryPanelProps {
  memoryItems: MemoryItem[];       
  proposedItems: MemoryItem[];     
  onDelete: (id: string) => void;
  onClear: () => void;
  onEdit: (item: MemoryItem) => void;
  onCreate: () => void;
// Summarizer & Reset Props
activeSummarizer: string;
availableSummarizers: string[];
onSummarizerChange: (model: string) => void;
onWipeSQLite: () => void;
onWipeVector: () => void;
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({
memoryItems, 
proposedItems, 
onDelete, 
onClear, 
onEdit, 
onCreate,
activeSummarizer,
availableSummarizers,
onSummarizerChange,
onWipeSQLite,
onWipeVector
}) => {
const [activeTab, setActiveTab] = useState<'toc' | 'list'>('toc');
const [suggestionLimit, setSuggestionLimit] = useState<number>(3);
  const [sessionSummary, setSessionSummary] = useState("Initializing session context...");

  useEffect(() => {
     const fetchSummary = async () => {
         const txt = await getSessionSummary();
         if (txt) setSessionSummary(txt);
     };
     fetchSummary();
     const interval = setInterval(fetchSummary, 5000); 
     return () => clearInterval(interval);
  }, []);

  return (
    <aside className="h-full flex flex-col bg-gray-900 border-r border-gray-700 font-sans text-gray-300 overflow-hidden">
      
      {/* --- TOP: CHAT INFO / SUMMARY --- */}
      <div className="shrink-0 border-b border-gray-700 bg-gray-800/40 flex flex-col h-[15%] min-h-[100px]">
          <div className="px-3 py-2 bg-gray-800/80 border-b border-gray-700/50 flex items-center justify-between">
             <div className="flex items-center gap-2">
             <BrainCircuitIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Session Context</span>
          </div>
      <div className="flex items-center gap-1">
      {/* Summarizer Dropdown */}
      <select
      value={activeSummarizer}
      onChange={(e) => onSummarizerChange(e.target.value)}
      className="w-24 text-[9px] bg-gray-900 border border-gray-600 rounded text-gray-400 focus:outline-none focus:border-indigo-500"
      title="Select Summarizer Model"
      >
      {availableSummarizers.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {/* Wipe Buttons */}
      <button onClick={onWipeSQLite} className="p-1 hover:text-red-400 text-gray-500" title="Wipe Chat History (SQLite)">
      <TrashIcon className="w-3 h-3" />
      </button>
      <button onClick={onWipeVector} className="p-1 hover:text-red-400 text-gray-500" title="Wipe Long-Term Memory (Vector)">
      <BookIcon className="w-3 h-3" />
      </button>
      </div>
      </div>
      <div className="flex-1 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
            <div className="prose prose-invert prose-xs text-xs text-gray-400 leading-relaxed">
                {sessionSummary}
            </div>
          </div>
      </div>

      {/* --- MIDDLE: MEMORY TOC / LIST (Expands) --- */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
        <div className="flex items-center bg-gray-900 border-b border-gray-800">
        <button
        className={`flex-1 py-2 text-[11px] uppercase font-bold tracking-wider ${activeTab === 'toc' ? 'bg-gray-800 text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
        onClick={() => setActiveTab('toc')}
        >
        Table of Contents
        </button>
        <button
        className={`flex-1 py-2 text-[11px] uppercase font-bold tracking-wider ${activeTab === 'list' ? 'bg-gray-800 text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
        onClick={() => setActiveTab('list')}
        >
        Memory List
        </button>
        </div>
        
        <div className="px-3 py-2 bg-gray-800 flex items-center justify-between border-b border-gray-700 sticky top-0 z-10">
            <div className="flex items-center gap-2">
                <BookIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-200">Memory Index</span>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={onCreate} className="p-1 hover:bg-gray-700 rounded text-emerald-400 transition-colors" title="Add Entry">
                    <PlusIcon className="w-3 h-3" />
                </button>
                <button onClick={onClear} className="p-1 hover:bg-gray-700 rounded text-red-400 transition-colors" title="Clear Index">
                    <TrashIcon className="w-3 h-3" />
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700">
          {activeTab === 'toc' && (
            <>
              {memoryItems.length === 0 ? (
                <div className="p-4 text-center text-gray-600 text-xs italic">
              Index empty.
            </div>
              ) : (
                <ul className="divide-y divide-gray-800">
                  {memoryItems.map((item) => (
                    <li key={item.id} className="group hover:bg-gray-800/50 transition-colors">
                      <button
                      onClick={() => onEdit(item)}
                    className="w-full text-left px-3 py-2 flex flex-col gap-0.5"
                      >
                        <span className="text-xs font-medium text-gray-300 group-hover:text-emerald-400 truncate block">
                      {item.content.substring(0, 40)}...
                      </span>
                        <span className="text-[10px] text-gray-500 truncate block">
                      {item.content.substring(40, 100)}...
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
)}
        
          {activeTab === 'list' && (
            <>
          {memoryItems.length === 0 ? (
        <div className="p-4 text-center text-gray-600 text-xs italic">
No memories saved yet.
          </div>
          ) : (
          <ul className="divide-y divide-gray-800">
          {memoryItems.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-800/50 transition-colors">
          <button
          onClick={() => onEdit(item)}
          className="flex-1 text-left flex flex-col gap-0.5"
          >
          <span className="text-xs font-medium text-gray-200 truncate">
          {item.content.substring(0, 60)}...
          </span>
          <span className="text-[10px] text-gray-500 truncate">
          {item.content.substring(60, 140)}...
          </span>
          </button>
          <div className="flex items-center gap-1">
          <button
          onClick={() => onEdit(item)}
          className="p-1 rounded hover:bg-gray-700 text-gray-300 hover:text-emerald-400"
          title="Edit memory"
          >
          <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button
          onClick={() => onDelete(item.id)}
          className="p-1 rounded hover:bg-gray-700 text-red-400 hover:text-red-300"
          title="Delete memory"
          >
          <TrashIcon className="w-3.5 h-3.5" />
          </button>
          </div>
          </li>
          ))}
          </ul>
          )}
          </>
          )}
        </div>
        

      </div>
      
      {/* --- BOTTOM: SUGGESTIONS (Fixed Height) --- */}
      <div className="shrink-0 h-[20%] min-h-[120px] border-t border-gray-700 bg-blue-900/5 flex flex-col">
            <div className="px-3 py-2 border-b border-blue-900/20 bg-blue-900/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">Suggested Memories</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-blue-400">
            <span className="mr-1">Show</span>
      <button
      onClick={() => setSuggestionLimit(prev => Math.max(1, prev - 1))}
      className="px-1 py-0.5 border border-blue-500/40 rounded hover:bg-blue-900/40"
      title="Show fewer suggestions"
      >
      -
      </button>
      <span className="px-1 font-mono">
      {Math.min(suggestionLimit, proposedItems.length)}
      </span>
      <button
      onClick={() => setSuggestionLimit(prev => Math.min(5, prev + 1))}
      className="px-1 py-0.5 border border-blue-500/40 rounded hover:bg-blue-900/40"
      title="Show more suggestions (max 5)"
      >
      +
      </button>
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
    </aside>
  );
};

export default MemoryPanel;











