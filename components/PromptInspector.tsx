import React, { useRef, useEffect } from 'react';
import { SendIcon, XIcon, BotIcon, SparklesIcon, CheckIcon, TrashIcon } from './icons';

interface PromptInspectorProps {
  promptText: string;
  previewText: string | null;
  onPromptChange: (text: string) => void;
  onCommit: () => void;
  onDiscard: () => void;
  onReRun: () => void; // Manual re-run if they edit the prompt
  onCancel: () => void; // Close inspector entirely
  model: string;
  isBuilding: boolean;
  isInferring: boolean;
}

const PromptInspector: React.FC<PromptInspectorProps> = ({
  promptText,
  previewText,
  onPromptChange,
  onCommit,
  onDiscard,
  onReRun,
  onCancel,
  model,
  isBuilding,
  isInferring,
}) => {
  const previewRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll preview when it updates
  useEffect(() => {
    if (previewRef.current && previewText) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [previewText]);

  // Visual State Logic
  const isBusy = isBuilding || isInferring;
  const statusColor = isBusy ? 'text-amber-400' : 'text-green-400';
  const borderColor = isBusy ? 'border-amber-500/30' : 'border-green-500/30';

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 w-full overflow-hidden transition-all">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800">
        <h2 className={`text-xs font-bold flex items-center gap-2 uppercase tracking-wider ${isBusy ? 'text-amber-400' : 'text-gray-400'}`}>
          <BotIcon className={`w-4 h-4 ${isBusy ? 'animate-pulse' : ''}`} /> 
          {isBuilding ? 'Orchestrating...' : isInferring ? 'Inferring...' : 'Prompt Staging'}
        </h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-white"><XIcon className="w-4 h-4" /></button>
      </div>

      {/* Split View Container */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* TOP: PROMPT INPUT */}
        <div className={`relative flex-1 min-h-0 flex flex-col ${previewText ? 'h-1/2 border-b border-gray-700' : 'h-full'}`}>
            <div className="absolute top-2 right-2 text-[10px] text-gray-600 font-mono pointer-events-none z-10">INPUT TEMPLATE</div>
            <textarea
                value={promptText}
                onChange={(e) => !isBusy && onPromptChange(e.target.value)}
                className={`w-full h-full bg-[#1e1e1e] font-mono text-xs p-4 resize-none focus:outline-none transition-colors ${statusColor} ${isBusy ? 'cursor-wait' : ''}`}
                spellCheck={false}
                placeholder="Orchestrated prompt will appear here..."
                readOnly={isBusy}
            />
        </div>

        {/* BOTTOM: PREVIEW OUTPUT (Only shows if there is a preview or we are waiting for one) */}
        {(previewText || isInferring) && (
            <div className="flex-1 min-h-0 flex flex-col bg-gray-900/50 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-2 bg-gray-800/50 border-b border-gray-700/50 text-[10px] text-indigo-300 font-bold uppercase tracking-wider flex justify-between items-center">
                    <span>Model Response ({model})</span>
                    {isInferring && <span className="text-amber-400 animate-pulse">GENERATING DRAFT...</span>}
                </div>
                <textarea
                    ref={previewRef}
                    value={previewText || ''}
                    readOnly
                    className={`w-full h-full bg-[#151515] font-sans text-xs p-4 resize-none focus:outline-none leading-relaxed ${isInferring ? 'text-amber-500/50' : 'text-gray-300'}`}
                    placeholder="Waiting for model..."
                />
            </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className={`p-3 border-t border-gray-700 bg-gray-800 flex gap-2 ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* DISCARD */}
        <button
          onClick={onDiscard}
          className="px-3 py-2 rounded bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-900/40 flex items-center justify-center gap-2 text-xs font-bold transition-all"
          title="Discard Draft"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>

        {/* RE-RUN (If user edited prompt) */}
        <button
          onClick={onReRun}
          className="flex-1 px-3 py-2 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 flex items-center justify-center gap-2 text-xs font-bold transition-all"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Re-Run
        </button>

        {/* COMMIT */}
        <button
        onClick={onCommit}
        className="flex-[2] px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs font-bold transition-all"
        >
        <CheckIcon className="w-3.5 h-3.5" />
        Commit
        </button>
      </div>
    </div>
  );
};

export default PromptInspector;