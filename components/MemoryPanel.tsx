// components/MemoryPanel.tsx
import React, { useState, useEffect } from 'react'; // Added useEffect
import { MemoryItem } from '../types';
import { TrashIcon, BrainCircuitIcon, SaveIcon, BookIcon } from './icons'; // Assume BookIcon exists
import { getSessionSummary } from '../services/ollamaService'; // Import the new service

interface MemoryPanelProps {
  memoryItems: MemoryItem[]; // These are now just the "Facts"
  onDelete: (id: string) => void;
  onClear: () => void;
  // We can remove onUpdate for now to simplify, or keep it
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ memoryItems, onDelete, onClear }) => {
  const [sessionSummary, setSessionSummary] = useState("Session active. No history compacted yet.");

  // Poll for session summary (or trigger it on chat completion in App.tsx)
  useEffect(() => {
     const fetchSummary = async () => {
         const txt = await getSessionSummary();
         if (txt) setSessionSummary(txt);
     };
     fetchSummary();
     // In a real app, you'd trigger this update via a prop from App.tsx instead of polling/once
     const interval = setInterval(fetchSummary, 5000); 
     return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-1/3 max-w-sm flex flex-col bg-gray-900 border-r border-gray-700 h-screen font-sans">
      
      {/* SECTION 1: WORKING MEMORY (The Session Context) */}
      <div className="flex flex-col h-1/2 border-b border-gray-700">
          <div className="p-4 bg-gray-800 flex items-center gap-2 shadow-sm">
             <BrainCircuitIcon className="w-5 h-5 text-indigo-400" />
             <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Working Memory</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-900/50">
            <div className="prose prose-invert prose-xs text-gray-400">
                {sessionSummary ? (
                    sessionSummary.split('\n').map((line, i) => (
                        <p key={i} className="mb-2">{line}</p>
                    ))
                ) : (
                    <p className="italic opacity-50">Conversational context is raw. Compactor standing by...</p>
                )}
            </div>
          </div>
      </div>

      {/* SECTION 2: LONG TERM FACTS (The RAG Items) */}
      <div className="flex flex-col h-1/2 bg-gray-800/30">
        <div className="p-4 bg-gray-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
                <BookIcon className="w-5 h-5 text-emerald-400" /> {/* Use a book or similar icon */}
                <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Learned Facts</h2>
            </div>
            <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300">Clear</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
            {memoryItems.length === 0 ? (
                <div className="text-center text-gray-500 mt-8 text-xs">
                    No permanent facts extracted yet.
                </div>
            ) : (
                <ul className="space-y-2">
                    {memoryItems.map((item) => (
                        <li key={item.id} className="group relative p-3 bg-gray-700/40 rounded border border-gray-700 hover:border-emerald-500/50 transition-colors">
                            <p className="text-xs text-gray-300 pr-6">{item.content}</p>
                            <button 
                                onClick={() => onDelete(item.id)}
                                className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <TrashIcon className="w-3 h-3" />
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