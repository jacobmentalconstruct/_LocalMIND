import React, { useRef } from 'react';
import { SendIcon, XIcon, BotIcon } from './icons';

interface PromptInspectorProps {
  promptText: string;
  onPromptChange: (text: string) => void;
  onRun: () => void;
  onCancel: () => void;
  model: string;
  isBuilding: boolean; // Indicates if backend is still assembling the context
}

const PromptInspector: React.FC<PromptInspectorProps> = ({
  promptText,
  onPromptChange,
  onRun,
  onCancel,
  model,
  isBuilding,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 w-full overflow-hidden transition-all">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BotIcon className="w-5 h-5 text-green-400" /> Prompt Inspector
        </h2>
        <div className="flex items-center gap-3">
          {isBuilding && (
            <span className="text-xs text-yellow-400 animate-pulse font-mono">
              Orchestrating...
            </span>
          )}
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={promptText}
          onChange={(e) => !isBuilding && onPromptChange(e.target.value)}
          className={`w-full h-full bg-[#1e1e1e] font-mono text-xs p-4 resize-none focus:outline-none transition-colors ${
            isBuilding ? 'text-gray-500 cursor-wait' : 'text-green-300'
          }`}
          spellCheck={false}
          readOnly={isBuilding}
        />
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-800 flex gap-4">
        <button
          onClick={onCancel}
          disabled={isBuilding}
          className="flex-1 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={onRun}
          disabled={isBuilding || !promptText}
          className="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 flex items-center justify-center gap-2 font-bold transition-colors"
        >
          <SendIcon className="w-4 h-4" />
          {isBuilding ? 'Building...' : 'Run Prompt'}
        </button>
      </div>
    </div>
  );
};

export default PromptInspector;
