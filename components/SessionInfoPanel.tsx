import React, { useState, useEffect } from 'react';
import { BrainCircuitIcon, TrashIcon, BookIcon } from './icons';
import { getSessionSummary } from '../services/ollamaService';

interface SessionInfoPanelProps {
  activeSummarizer: string;
  availableSummarizers: string[];
  onSummarizerChange: (model: string) => void;
  onWipeSQLite: () => void;
  onWipeVector: () => void;
}

const SessionInfoPanel: React.FC<SessionInfoPanelProps> = ({
  activeSummarizer,
  availableSummarizers,
  onSummarizerChange,
  onWipeSQLite,
  onWipeVector,
}) => {
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
    <div className="shrink-0 border-b border-gray-700 bg-gray-800/40 flex flex-col h-[15%] min-h-[100px]">
      <div className="px-3 py-2 bg-gray-800/80 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuitIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Session Context</span>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={activeSummarizer}
            onChange={(e) => onSummarizerChange(e.target.value)}
            className="w-24 text-[9px] bg-gray-900 border border-gray-600 rounded text-gray-400 focus:outline-none focus:border-indigo-500"
            title="Select Summarizer Model"
          >
            {availableSummarizers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={onWipeSQLite} className="p-1 hover:text-red-400 text-gray-500" title="Wipe Chat History">
            <TrashIcon className="w-3 h-3" />
          </button>
          <button onClick={onWipeVector} className="p-1 hover:text-red-400 text-gray-500" title="Wipe Vector DB">
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
  );
};

export default SessionInfoPanel;